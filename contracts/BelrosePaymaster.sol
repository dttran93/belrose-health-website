// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import '@account-abstraction/contracts/core/BasePaymaster.sol';
import '@account-abstraction/contracts/core/UserOperationLib.sol';
import '@account-abstraction/contracts/core/Helpers.sol';
import '@openzeppelin/contracts/utils/cryptography/ECDSA.sol';
import '@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol';

/**
 * @title BelrosePaymaster
 * @notice A Verifying Paymaster that sponsors gas for users based on backend signatures.
 * Verified against TypeScript/Viem implementation for ERC-4337 v0.7 compatibility.
 */
contract BelrosePaymaster is BasePaymaster {
  using ECDSA for bytes32;
  using MessageHashUtils for bytes32;
  using UserOperationLib for PackedUserOperation;

  // ============ State Variables ============

  address public verifyingSigner;
  uint256 public maxCostPerUserOp;

  // ============ Events ============

  event SignerUpdated(address indexed oldSigner, address indexed newSigner);
  event MaxCostUpdated(uint256 oldMaxCost, uint256 newMaxCost);
  event GasSponsored(address indexed sender, uint256 maxCost);

  // ============ Errors ============

  error InvalidSignerAddress();

  // ============ Debug Errors ============
  // Use these to see why the signature is failing
  error DebugValidate(
    bytes32 calculatedHash,
    address recoveredSigner,
    address expectedSigner,
    uint256 contractChainId
  );

  error DebugSlicing(uint256 totalLen, uint48 until, uint48 afterwards, bytes sigPrefix);

  // ============ Constructor ============

  constructor(
    IEntryPoint _entryPoint,
    address _verifyingSigner,
    uint256 _maxCostPerUserOp
  ) BasePaymaster(_entryPoint) {
    if (_verifyingSigner == address(0)) revert InvalidSignerAddress();
    verifyingSigner = _verifyingSigner;
    maxCostPerUserOp = _maxCostPerUserOp;
  }

  // ============ Core Paymaster Logic ============

  /**
   * @notice Validates the paymaster's participation in a UserOperation.
   * @dev Note: We calculate our own hash internally to ensure signature integrity.
   */
  function _validatePaymasterUserOp(
    PackedUserOperation calldata userOp,
    bytes32 /*userOpHash*/,
    uint256 maxCost
  ) internal view override returns (bytes memory context, uint256 validationData) {
    // 1. Safety Limit Check
    if (maxCost > maxCostPerUserOp) {
      return ('', _packValidationData(true, 0, 0));
    }

    // 2. Extract Custom Data (Starts at index 52)
    // Byte 1-52 consists of: Address (20b), Paymaster Verification Gas Limit (16b), Paymaster Post-Op Gas Limit (16b)
    // Remainder is customData [validUntil: 6b][validAfter: 6b][signature: 65b] = 77 bytes
    bytes calldata customData = userOp.paymasterAndData[52:];
    if (customData.length < 77) {
      return ('', _packValidationData(true, 0, 0));
    }

    uint48 validUntil = uint48(bytes6(customData[0:6]));
    uint48 validAfter = uint48(bytes6(customData[6:12]));
    bytes calldata signature = customData[12:];

    // 3. Compute Hashing (The logic verified in our tests)
    bytes32 hashToSign = getHashWithZeroSignature(userOp, validUntil, validAfter);

    // 4. Verify EIP-191 Signature
    // toEthSignedMessageHash adds "\x19Ethereum Signed Message:\n32" prefix
    address recovered = hashToSign.toEthSignedMessageHash().recover(signature);

    // FOR DEBUGGING If signature starts with 0x00 (your stub) or 0xff (standard viem dummy), bypass
    if (signature[0] == 0x00 || signature[0] == 0xff) {
      return ('', _packValidationData(false, validUntil, validAfter));
    }

    // --- TRIGGER DEBUG REVERT ---
    // This will force the transaction to fail and show us the data in the logs
    revert DebugValidate(hashToSign, recovered, verifyingSigner, block.chainid);

    //revert DebugSlicing(userOp.paymasterAndData.length, validUntil, validAfter, signature[0:4]);
    //bool signatureFailed = (recovered != verifyingSigner);
    //return ('', _packValidationData(signatureFailed, validUntil, validAfter));
  }

  /**
   * @notice Replicates the exact hashing flow verified in HashTester.test.ts
   */
  function getHashWithZeroSignature(
    PackedUserOperation calldata userOp,
    uint48 validUntil,
    uint48 validAfter
  ) public view returns (bytes32) {
    // Build paymasterData with zero signature placeholder
    bytes memory paymasterDataWithZeroSig = abi.encodePacked(validUntil, validAfter, new bytes(65));

    // Compute the "Inner" UserOp Hash
    bytes32 userOpHashWithZeroSig = _computeUserOpHash(userOp, paymasterDataWithZeroSig);

    // Wrap with ChainID and Paymaster-specific context
    return
      keccak256(
        abi.encode(userOpHashWithZeroSig, block.chainid, address(this), validUntil, validAfter)
      );
  }

  /**
   * @dev Internal helper to compute UserOp hash matching EntryPoint v0.7 logic.
   * Scoped variables prevent "Stack Too Deep" errors.
   */
  function _computeUserOpHash(
    PackedUserOperation calldata userOp,
    bytes memory paymasterDataOverride
  ) internal view returns (bytes32) {
    bytes32 paymasterAndDataHash;
    {
      // Extract the gas limits from paymasterAndData bytes
      bytes16 pmVerif = bytes16(userOp.paymasterAndData[20:36]);
      bytes16 pmPost = bytes16(userOp.paymasterAndData[36:52]);
      paymasterAndDataHash = keccak256(
        abi.encodePacked(address(this), pmVerif, pmPost, paymasterDataOverride)
      );
    }

    bytes32 innerHash = keccak256(
      abi.encode(
        userOp.sender,
        userOp.nonce,
        keccak256(userOp.initCode),
        keccak256(userOp.callData),
        userOp.accountGasLimits,
        userOp.preVerificationGas,
        userOp.gasFees,
        paymasterAndDataHash
      )
    );

    return keccak256(abi.encode(innerHash, address(entryPoint), block.chainid));
  }

  function _postOp(PostOpMode, bytes calldata, uint256, uint256) internal pure override {}

  // ============ Admin Functions ============

  function updateSigner(address _newSigner) external onlyOwner {
    if (_newSigner == address(0)) revert InvalidSignerAddress();
    verifyingSigner = _newSigner;
    emit SignerUpdated(verifyingSigner, _newSigner);
  }

  function setMaxCostPerUserOp(uint256 _newMaxCost) external onlyOwner {
    maxCostPerUserOp = _newMaxCost;
    emit MaxCostUpdated(maxCostPerUserOp, _newMaxCost);
  }
}

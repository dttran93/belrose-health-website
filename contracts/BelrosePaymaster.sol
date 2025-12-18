// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import '@account-abstraction/contracts/core/BasePaymaster.sol';
import '@account-abstraction/contracts/core/UserOperationLib.sol';
import '@account-abstraction/contracts/core/Helpers.sol';
import '@openzeppelin/contracts/utils/cryptography/ECDSA.sol';
import '@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol';

/**
 * @title BelrosePaymaster
 * @notice A Verifying Paymaster that sponsors gas for users when your backend approves
 */
contract BelrosePaymaster is BasePaymaster {
  using ECDSA for bytes32;
  using MessageHashUtils for bytes32;
  using UserOperationLib for PackedUserOperation;

  // ============ State Variables ============

  /// @notice The address whose signatures we trust (your backend's signing wallet)
  address public verifyingSigner;

  /// @notice Maximum gas cost we'll sponsor per UserOperation (safety limit)
  uint256 public maxCostPerUserOp;

  /// @notice Track used signatures to prevent replay attacks
  mapping(bytes32 => bool) public usedSignatures;

  // ============ Events ============

  event SignerUpdated(address indexed oldSigner, address indexed newSigner);
  event MaxCostUpdated(uint256 oldMaxCost, uint256 newMaxCost);
  event GasSponsored(address indexed sender, bytes32 indexed userOpHash, uint256 maxCost);

  // ============ Errors ============

  error InvalidSignatureLength();
  error SignatureAlreadyUsed();
  error CostExceedsMax(uint256 cost, uint256 max);
  error InvalidSignerAddress();

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

  function _validatePaymasterUserOp(
    PackedUserOperation calldata userOp,
    bytes32 userOpHash,
    uint256 maxCost
  ) internal override returns (bytes memory context, uint256 validationData) {
    if (maxCost > maxCostPerUserOp) {
      revert CostExceedsMax(maxCost, maxCostPerUserOp);
    }

    // paymasterAndData format: [paymaster(20)][validUntil(6)][validAfter(6)][signature(65)]
    bytes calldata paymasterData = userOp.paymasterAndData;

    if (paymasterData.length < 97) {
      revert InvalidSignatureLength();
    }

    uint48 validUntil = uint48(bytes6(paymasterData[20:26]));
    uint48 validAfter = uint48(bytes6(paymasterData[26:32]));
    bytes calldata signature = paymasterData[32:97];

    // Build hash that backend should have signed
    bytes32 hash = keccak256(
      abi.encode(userOpHash, block.chainid, address(this), validUntil, validAfter)
    ).toEthSignedMessageHash();

    // Prevent replay
    if (usedSignatures[hash]) {
      revert SignatureAlreadyUsed();
    }
    usedSignatures[hash] = true;

    // Verify signature
    address recovered = hash.recover(signature);

    if (recovered != verifyingSigner) {
      return ('', _packValidationData(true, validUntil, validAfter));
    }

    emit GasSponsored(userOp.sender, userOpHash, maxCost);
    return ('', _packValidationData(false, validUntil, validAfter));
  }

  function _postOp(PostOpMode, bytes calldata, uint256, uint256) internal pure override {
    // No post-op logic needed
  }

  // ============ View Functions ============

  function getHash(
    bytes32 userOpHash,
    uint48 validUntil,
    uint48 validAfter
  ) public view returns (bytes32) {
    return
      keccak256(abi.encode(userOpHash, block.chainid, address(this), validUntil, validAfter))
        .toEthSignedMessageHash();
  }

  // ============ Admin Functions ============

  function updateSigner(address _newSigner) external onlyOwner {
    if (_newSigner == address(0)) revert InvalidSignerAddress();
    emit SignerUpdated(verifyingSigner, _newSigner);
    verifyingSigner = _newSigner;
  }

  function setMaxCostPerUserOp(uint256 _newMaxCost) external onlyOwner {
    emit MaxCostUpdated(maxCostPerUserOp, _newMaxCost);
    maxCostPerUserOp = _newMaxCost;
  }
}

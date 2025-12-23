// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;
import '@account-abstraction/contracts/core/UserOperationLib.sol';

contract HashTester {
  using UserOperationLib for PackedUserOperation;

  function getHash(
    PackedUserOperation calldata userOp,
    address entryPoint,
    uint256 chainId,
    address paymaster,
    uint48 validUntil,
    uint48 validAfter
  ) public pure returns (bytes32) {
    // This is a copy-paste of your hash logic without the BasePaymaster baggage
    bytes memory paymasterDataWithZeroSig = abi.encodePacked(validUntil, validAfter, new bytes(65));

    bytes32 accountGasLimitsHash = keccak256(abi.encodePacked(userOp.accountGasLimits));
    bytes32 gasFeesHash = keccak256(abi.encodePacked(userOp.gasFees));

    // Unpack gas limits manually for the test
    uint128 pmVerif = uint128(bytes16(userOp.paymasterAndData[20:36]));
    uint128 pmPost = uint128(bytes16(userOp.paymasterAndData[36:52]));

    bytes32 paymasterAndDataHash = keccak256(
      abi.encodePacked(paymaster, pmVerif, pmPost, paymasterDataWithZeroSig)
    );

    bytes32 innerHash = keccak256(
      abi.encode(
        userOp.sender,
        userOp.nonce,
        keccak256(userOp.initCode),
        keccak256(userOp.callData),
        accountGasLimitsHash,
        userOp.preVerificationGas,
        gasFeesHash,
        paymasterAndDataHash
      )
    );

    bytes32 userOpHash = keccak256(abi.encode(innerHash, entryPoint, chainId));

    return keccak256(abi.encode(userOpHash, chainId, paymaster, validUntil, validAfter));
  }
}

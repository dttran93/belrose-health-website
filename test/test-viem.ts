import { encodeAbiParameters, keccak256, encodePacked, Address, hexToBigInt } from 'viem';

export function calculateUserOpHash(userOp: any, entryPoint: Address, chainId: number) {
  const accountGasLimitsHash = keccak256(userOp.accountGasLimits);
  const gasFeesHash = keccak256(userOp.gasFees);

  const safeHexToBigInt = (hex: string) =>
    hex === '0x' || hex === '' ? 0n : hexToBigInt(hex as `0x${string}`);

  // 1. Slicing paymasterAndData (v0.7 structure)
  const paymasterAddress = userOp.paymasterAndData.slice(0, 42) as Address;
  const pmVerifGasBI = safeHexToBigInt(`0x${userOp.paymasterAndData.slice(42, 74)}`);
  const pmPostOpGasBI = safeHexToBigInt(`0x${userOp.paymasterAndData.slice(74, 106)}`);
  const validUntilBI = safeHexToBigInt(`0x${userOp.paymasterAndData.slice(106, 118)}`);
  const validAfterBI = safeHexToBigInt(`0x${userOp.paymasterAndData.slice(118, 130)}`);

  // Custom Data: validUntil (index 106-118), validAfter (index 118-130)
  const zeroSignature = `0x${'00'.repeat(65)}` as `0x${string}`;

  // Use BigInt for packing logic to match Solidity uint48/uint128

  const paymasterDataOverride = encodePacked(
    ['uint48', 'uint48', 'bytes'] as any,
    [validUntilBI, validAfterBI, zeroSignature] as any
  );

  const paymasterAndDataHash = keccak256(
    encodePacked(
      ['address', 'uint128', 'uint128', 'bytes'],
      [paymasterAddress, pmVerifGasBI, pmPostOpGasBI, paymasterDataOverride]
    )
  );

  // 2. Compute Inner Hash
  const innerHash = keccak256(
    encodeAbiParameters(
      [
        { type: 'address' },
        { type: 'uint256' },
        { type: 'bytes32' },
        { type: 'bytes32' },
        { type: 'bytes32' },
        { type: 'uint256' },
        { type: 'bytes32' },
        { type: 'bytes32' },
      ],
      [
        userOp.sender,
        BigInt(userOp.nonce),
        keccak256(userOp.initCode),
        keccak256(userOp.callData),
        accountGasLimitsHash,
        BigInt(userOp.preVerificationGas),
        gasFeesHash,
        paymasterAndDataHash,
      ]
    )
  );

  return keccak256(
    encodeAbiParameters(
      [{ type: 'bytes32' }, { type: 'address' }, { type: 'uint256' }],
      [innerHash, entryPoint, BigInt(chainId)]
    )
  );
}

export function calculateFinalPaymasterHash(
  userOpHash: `0x${string}`,
  chainId: number | bigint,
  paymasterAddress: Address,
  validUntil: any,
  validAfter: any
) {
  const abiParameters = [
    { type: 'bytes32' },
    { type: 'uint256' },
    { type: 'address' },
    { type: 'uint48' },
    { type: 'uint48' },
  ] as const; // 'as const' is the magic for Viem types

  const values = [
    userOpHash,
    BigInt(chainId),
    paymasterAddress,
    BigInt(validUntil),
    BigInt(validAfter),
  ] as const;

  // We cast to 'any' here to force the compiler to ignore the internal mismatch
  return keccak256(encodeAbiParameters(abiParameters as any, values as any));
}

import { expect } from 'chai';
import hre from 'hardhat';
const { ethers } = hre as any;

describe('Belrose Hashing Verification', function () {
  it('Should match the TypeScript hash calculation with Solidity', async function () {
    // 1. Import your TS logic
    const { calculateUserOpHash, calculateFinalPaymasterHash } = await import('../test-viem.js');
    const [owner] = await ethers.getSigners();

    // 2. Deploy the HashTester (No safety checks, will deploy instantly)
    const HashTester = await ethers.getContractFactory('HashTester');
    const tester = await HashTester.deploy();
    const testerAddress = await tester.getAddress();

    // 3. Mock Data (Use realistic v0.7 values)
    const entryPointAddr = '0x0000000071727De22E5E9d8BAf0edAc6f37da032';
    const paymasterAddr = '0x1234567890123456789012345678901234567890';
    const chainId = 31337; // Hardhat default
    const validUntil = 1735689600n;
    const validAfter = 1704067200n;

    const paymasterAndData = ethers.solidityPacked(
      ['address', 'uint128', 'uint128', 'uint48', 'uint48'],
      [paymasterAddr, 100000n, 50000n, validUntil, validAfter]
    );

    const userOp = {
      sender: owner.address,
      nonce: 0n,
      initCode: '0x',
      callData: '0x',
      accountGasLimits: ethers.toBeHex(ethers.parseUnits('1', 'gwei'), 32),
      preVerificationGas: 100000n,
      gasFees: ethers.toBeHex(ethers.parseUnits('1', 'gwei'), 32),
      paymasterAndData: paymasterAndData, // Use the packed string here
      signature: '0x',
    };

    // 4. Get Hash from Solidity
    const contractHash = await tester.getHash(
      userOp,
      entryPointAddr,
      chainId,
      paymasterAddr,
      validUntil,
      validAfter
    );

    // 5. Get Hash from TypeScript
    const tsUserOpHash = calculateUserOpHash(userOp, entryPointAddr, chainId);
    const tsFinalHash = calculateFinalPaymasterHash(
      tsUserOpHash,
      chainId,
      paymasterAddr,
      validUntil,
      validAfter
    );

    console.log('\n--- DATA VERIFICATION ---');
    console.log('Chain ID:       ', chainId);
    console.log('EntryPoint:     ', entryPointAddr);
    console.log('Paymaster:      ', paymasterAddr);
    console.log('\n--- HASH RESULTS ---');
    console.log('Solidity Hash:  ', contractHash);
    console.log('TypeScript Hash:', tsFinalHash);
    console.log('--------------------\n');

    expect(contractHash).to.equal(tsFinalHash);
  });
});

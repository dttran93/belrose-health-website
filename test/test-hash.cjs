const { ethers } = require('ethers');

// From your logs
const userOpHash = '0x925f25970a3359537abfb8b4b8f3e2cc20a2a8f1d33a8e7df21c6e8fd8c047e0';
const chainId = 11155111n;
const paymasterAddress = '0x61c383ac415aa12B35512278F9eef8DAa4214924';
const validUntil = 1766313619n;
const validAfter = 0n;
const signature =
  '0x70f337492e031070fd4e2cef200e09988029d32b743f35204e07826572f8d3094d77b6fa7da71f68752276f3d045c502b0988e3060886fb503bf19e87c0d97bf1b';

const abiCoder = new ethers.AbiCoder();

const encoded = abiCoder.encode(
  ['bytes32', 'uint256', 'address', 'uint48', 'uint48'],
  [userOpHash, chainId, paymasterAddress, validUntil, validAfter]
);

const hash = ethers.keccak256(encoded);
console.log('Computed hash:', hash);
console.log('Backend hash:', '0xd3b18a0733aab76f21d93cdbfc3f224f9f61abf8f4edce3aa8d99b7d310a960e');
console.log(
  'Hash match:',
  hash === '0xd3b18a0733aab76f21d93cdbfc3f224f9f61abf8f4edce3aa8d99b7d310a960e'
);

const recoveredAddress = ethers.verifyMessage(ethers.getBytes(hash), signature);
console.log('Recovered signer:', recoveredAddress);
console.log('Expected signer:', '0x875622a16aC9Daa000Cbb34fE396EDc37EB72217');
console.log(
  'Signer match:',
  recoveredAddress.toLowerCase() === '0x875622a16aC9Daa000Cbb34fE396EDc37EB72217'.toLowerCase()
);

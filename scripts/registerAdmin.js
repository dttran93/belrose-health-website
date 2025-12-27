import hre from 'hardhat';

async function main() {
  const ADMIN_ADDRESS = '0x485cc0e0a6D17832aeb2FD1932697beAA57cBB36';
  const CONTRACT_ADDRESS = '0x0FdDcE7EdebD73C6d1A11983bb6a759132543aaD';

  console.log('--- System Admin Registration ---');

  // 1. Connect to contract
  const contract = await hre.ethers.getContractAt('MemberRoleManager', CONTRACT_ADDRESS);
  const [deployer] = await hre.ethers.getSigners();

  console.log(`Using Wallet: ${deployer.address}`);

  // 2. Check current status
  const status = await contract.wallets(ADMIN_ADDRESS);

  // Note: Adjust 'isWalletActive' based on your exact struct field name
  if (status.isWalletActive) {
    console.log(`✅ Address ${ADMIN_ADDRESS} is already an active member.`);
    return;
  }

  // 3. Generate a system UID hash for the admin
  // We use a constant string or the address itself to generate the bytes32 ID
  const adminIdHash = hre.ethers.id('SYSTEM_ADMIN_' + ADMIN_ADDRESS.toLowerCase());

  console.log(`📝 Registering admin with ID Hash: ${adminIdHash}`);

  // 4. Execute Registration
  const tx = await contract.addMember(ADMIN_ADDRESS, adminIdHash);
  console.log(`⏳ Transaction sent: ${tx.hash}`);

  const receipt = await tx.wait();
  console.log(`✅ Successfully registered in block: ${receipt.blockNumber}`);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

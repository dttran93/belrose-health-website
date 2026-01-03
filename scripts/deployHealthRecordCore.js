import hre from 'hardhat';

async function main() {
  console.log('🚀 Starting deployment of HealthRecordCore...\n');

  // ==================== CONFIG ====================
  // UPDATE THIS: Use your deployed MemberRoleManager address
  const MEMBER_ROLE_MANAGER_ADDRESS = '0x0FdDcE7EdebD73C6d1A11983bb6a759132543aaD';
  // ================================================

  const [deployer] = await hre.ethers.getSigners();
  console.log('🔑 Deploying with account:', deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log('💰 Account balance:', hre.ethers.formatEther(balance), 'ETH');

  if (balance === 0n) {
    console.error('❌ Account has no ETH! Get Sepolia ETH from a faucet.');
    process.exit(1);
  }

  // Check if MemberRoleManager address is provided
  if (!MEMBER_ROLE_MANAGER_ADDRESS || MEMBER_ROLE_MANAGER_ADDRESS === '') {
    console.error('❌ ERROR: You must provide a MEMBER_ROLE_MANAGER_ADDRESS in the script.');
    process.exit(1);
  }

  console.log(`🔗 Linking to MemberRoleManager at: ${MEMBER_ROLE_MANAGER_ADDRESS}`);

  // Deploy HealthRecordCore
  console.log('\n--- Deploying HealthRecordCore ---\n');
  const HealthRecordCore = await hre.ethers.getContractFactory('HealthRecordCore', deployer);

  // Passing the MemberRoleManager address to the constructor
  const healthRecordCore = await HealthRecordCore.deploy(MEMBER_ROLE_MANAGER_ADDRESS);

  await healthRecordCore.waitForDeployment();
  const healthRecordCoreAddress = await healthRecordCore.getAddress();

  // Summary
  console.log('\n========================================');
  console.log('🎉 DEPLOYMENT COMPLETE!');
  console.log('========================================');
  console.log(`HealthRecordCore:   ${healthRecordCoreAddress}`);
  console.log(`MemberRoleManager:  ${MEMBER_ROLE_MANAGER_ADDRESS}`);
  console.log(`Admin (deployer):   ${deployer.address}`);

  // Etherscan link
  console.log(`\n🔍 Etherscan:`);
  console.log(`https://sepolia.etherscan.io/address/${healthRecordCoreAddress}`);

  // PowerShell Verification String
  // Note: We must include the constructor argument in the verification command
  console.log('\n📝 COPY THIS TO VERIFY (PowerShell Ready):');
  console.log(
    `npx hardhat verify --network sepolia ${healthRecordCoreAddress} "${MEMBER_ROLE_MANAGER_ADDRESS}"`
  );
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Deployment failed:', error);
    process.exit(1);
  });

// scripts/deploy.js
import hre from 'hardhat';

async function main() {
  console.log('🚀 Starting deployment of MemberRoleManager + HealthRecordCore...\n');

  const [deployer] = await hre.ethers.getSigners();
  console.log('🔑 Deploying with account:', deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log('💰 Account balance:', hre.ethers.formatEther(balance), 'ETH');

  if (balance === 0n) {
    console.error('❌ Account has no ETH! Get Sepolia ETH from a faucet.');
    process.exit(1);
  }

  // Deploy MemberRoleManager first
  console.log('\n--- Step 1: Deploy MemberRoleManager ---\n');
  const MemberRoleManager = await hre.ethers.getContractFactory('MemberRoleManager', deployer);
  const memberRoleManager = await MemberRoleManager.deploy();
  await memberRoleManager.waitForDeployment();
  const memberRoleManagerAddress = await memberRoleManager.getAddress();
  console.log('✅ MemberRoleManager deployed to:', memberRoleManagerAddress);

  // Deploy HealthRecordCore with MemberRoleManager address
  console.log('\n--- Step 2: Deploy HealthRecordCore ---\n');
  const HealthRecordCore = await hre.ethers.getContractFactory('HealthRecordCore', deployer);
  const healthRecordCore = await HealthRecordCore.deploy(memberRoleManagerAddress);
  await healthRecordCore.waitForDeployment();
  const healthRecordCoreAddress = await healthRecordCore.getAddress();
  console.log('✅ HealthRecordCore deployed to:', healthRecordCoreAddress);

  // Summary
  console.log('\n========================================');
  console.log('🎉 DEPLOYMENT COMPLETE!');
  console.log('========================================');
  console.log(`MemberRoleManager:  ${memberRoleManagerAddress}`);
  console.log(`HealthRecordCore:   ${healthRecordCoreAddress}`);
  console.log(`\n🔍 Etherscan:`);
  console.log(`https://sepolia.etherscan.io/address/${memberRoleManagerAddress}`);
  console.log(`https://sepolia.etherscan.io/address/${healthRecordCoreAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Deployment failed:', error);
    process.exit(1);
  });

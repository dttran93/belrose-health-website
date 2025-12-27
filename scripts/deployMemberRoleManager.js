// scripts/deployMemberRoleManager.js
import hre from 'hardhat';

async function main() {
  console.log('🚀 Starting deployment of MemberRoleManager...\n');

  const [deployer] = await hre.ethers.getSigners();
  console.log('🔑 Deploying with account:', deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log('💰 Account balance:', hre.ethers.formatEther(balance), 'ETH');

  if (balance === 0n) {
    console.error('❌ Account has no ETH! Get Sepolia ETH from a faucet.');
    process.exit(1);
  }

  // Deploy MemberRoleManager
  console.log('\n--- Deploying MemberRoleManager ---\n');
  const MemberRoleManager = await hre.ethers.getContractFactory('MemberRoleManager', deployer);
  const memberRoleManager = await MemberRoleManager.deploy();
  await memberRoleManager.waitForDeployment();
  const memberRoleManagerAddress = await memberRoleManager.getAddress();

  // Summary
  console.log('\n========================================');
  console.log('🎉 DEPLOYMENT COMPLETE!');
  console.log('========================================');
  console.log(`MemberRoleManager:  ${memberRoleManagerAddress}`);
  console.log(`Admin (deployer):   ${deployer.address}`);

  // Etherscan link
  console.log(`\n🔍 Etherscan:`);
  console.log(`https://sepolia.etherscan.io/address/${memberRoleManagerAddress}`);

  // PowerShell Verification String
  // MemberRoleManager has no constructor arguments, so verification is simple
  console.log('\n📝 COPY THIS TO VERIFY (PowerShell Ready):');
  console.log(`npx hardhat verify --network sepolia ${memberRoleManagerAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Deployment failed:', error);
    process.exit(1);
  });

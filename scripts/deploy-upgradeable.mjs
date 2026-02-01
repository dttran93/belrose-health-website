import hre from 'hardhat';
const { ethers, upgrades } = hre;

async function main() {
  console.log('🚀 Deploying Upgradeable Contracts...\n');

  const [deployer] = await ethers.getSigners();
  console.log('Deploying with account:', deployer.address);
  console.log(
    'Account balance:',
    ethers.formatEther(await ethers.provider.getBalance(deployer.address)),
    'ETH\n'
  );

  // ==========================================
  // 1. Deploy MemberRoleManager Proxy
  // ==========================================
  console.log('📝 Deploying MemberRoleManager...');

  const MemberRoleManager = await ethers.getContractFactory('MemberRoleManager');

  const memberRoleManagerProxy = await upgrades.deployProxy(
    MemberRoleManager,
    [], // initialize() takes no parameters
    {
      kind: 'uups',
      initializer: 'initialize',
    }
  );

  await memberRoleManagerProxy.waitForDeployment();
  const memberRoleManagerAddress = await memberRoleManagerProxy.getAddress();

  console.log('✅ MemberRoleManager Proxy deployed to:', memberRoleManagerAddress);

  // Get implementation address (for verification later)
  const implementationAddress =
    await upgrades.erc1967.getImplementationAddress(memberRoleManagerAddress);
  console.log('📄 Implementation address:', implementationAddress);

  // ==========================================
  // Summary
  // ==========================================
  console.log('\n📋 Deployment Summary:');
  console.log('================================');
  console.log('MemberRoleManager Proxy:', memberRoleManagerAddress);
  console.log('MemberRoleManager Implementation:', implementationAddress);
  console.log('================================');
  console.log('\n✅ Deployment complete!');
  console.log('\n💡 Use the PROXY address in your frontend:', memberRoleManagerAddress);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

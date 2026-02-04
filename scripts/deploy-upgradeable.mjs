import hre from 'hardhat';
const { ethers, upgrades } = hre;

async function main() {
  console.log('🚀 Deploying Both Upgradeable Contracts...\n');

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

  const mrmImplementation =
    await upgrades.erc1967.getImplementationAddress(memberRoleManagerAddress);
  console.log('📄 MemberRoleManager Implementation:', mrmImplementation, '\n');

  // ==========================================
  // 2. Deploy HealthRecordCore Proxy
  // ==========================================
  console.log('📝 Deploying HealthRecordCore...');

  const HealthRecordCore = await ethers.getContractFactory('HealthRecordCore');
  const healthRecordCoreProxy = await upgrades.deployProxy(
    HealthRecordCore,
    [memberRoleManagerAddress], // initialize(address _memberRoleManager)
    {
      kind: 'uups',
      initializer: 'initialize',
    }
  );

  await healthRecordCoreProxy.waitForDeployment();
  const healthRecordCoreAddress = await healthRecordCoreProxy.getAddress();

  console.log('✅ HealthRecordCore Proxy deployed to:', healthRecordCoreAddress);

  const hrcImplementation =
    await upgrades.erc1967.getImplementationAddress(healthRecordCoreAddress);
  console.log('📄 HealthRecordCore Implementation:', hrcImplementation, '\n');

  // ==========================================
  // Summary
  // ==========================================
  console.log('📋 Deployment Summary:');
  console.log('================================');
  console.log('MemberRoleManager:');
  console.log('  Proxy:', memberRoleManagerAddress);
  console.log('  Implementation:', mrmImplementation);
  console.log('');
  console.log('HealthRecordCore:');
  console.log('  Proxy:', healthRecordCoreAddress);
  console.log('  Implementation:', hrcImplementation);
  console.log('================================');
  console.log('\n✅ Both contracts deployed successfully!');
  console.log('\n💡 Use these PROXY addresses in your frontend:');
  console.log('   MemberRoleManager:', memberRoleManagerAddress);
  console.log('   HealthRecordCore:', healthRecordCoreAddress);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

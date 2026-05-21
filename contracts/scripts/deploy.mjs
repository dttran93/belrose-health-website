import hre from 'hardhat';
const { ethers } = hre;

async function main() {
  console.log('🚀 Deploying Both Upgradeable Contracts...\n');

  const [deployer] = await ethers.getSigners();
  console.log('Deploying with account:', deployer.address);
  console.log(
    'Account balance:',
    ethers.formatEther(await ethers.provider.getBalance(deployer.address)),
    'ETH\n'
  );

  const ERC1967Proxy = await ethers.getContractFactory('ERC1967Proxy');

  // ==========================================
  // 1. Deploy MemberRoleManager
  // ==========================================
  console.log('📝 Deploying MemberRoleManager...');

  const MemberRoleManager = await ethers.getContractFactory('MemberRoleManager');
  const mrmImpl = await MemberRoleManager.deploy();
  await mrmImpl.waitForDeployment();
  const mrmImplAddress = await mrmImpl.getAddress();
  console.log('📄 MemberRoleManager Implementation:', mrmImplAddress);

  const mrmInitData = mrmImpl.interface.encodeFunctionData('initialize', []);
  const mrmProxy = await ERC1967Proxy.deploy(mrmImplAddress, mrmInitData);
  await mrmProxy.waitForDeployment();
  const mrmProxyAddress = await mrmProxy.getAddress();
  console.log('✅ MemberRoleManager Proxy:', mrmProxyAddress, '\n');

  // ==========================================
  // 2. Deploy HealthRecordCore
  // ==========================================
  console.log('📝 Deploying HealthRecordCore...');

  const HealthRecordCore = await ethers.getContractFactory('HealthRecordCore');
  const hrcImpl = await HealthRecordCore.deploy();
  await hrcImpl.waitForDeployment();
  const hrcImplAddress = await hrcImpl.getAddress();
  console.log('📄 HealthRecordCore Implementation:', hrcImplAddress);

  const hrcInitData = hrcImpl.interface.encodeFunctionData('initialize', [mrmProxyAddress]);
  const hrcProxy = await ERC1967Proxy.deploy(hrcImplAddress, hrcInitData);
  await hrcProxy.waitForDeployment();
  const hrcProxyAddress = await hrcProxy.getAddress();
  console.log('✅ HealthRecordCore Proxy:', hrcProxyAddress, '\n');

  // ==========================================
  // 3. Wire contracts together
  // ==========================================
  console.log('🔗 Linking HealthRecordCore to MemberRoleManager...');
  const mrm = await ethers.getContractAt('MemberRoleManager', mrmProxyAddress);
  await mrm.setHealthRecordCore(hrcProxyAddress);
  console.log('✅ Linked\n');

  // ==========================================
  // Summary
  // ==========================================
  console.log('📋 Deployment Summary:');
  console.log('================================');
  console.log('MemberRoleManager:');
  console.log('  Proxy:         ', mrmProxyAddress);
  console.log('  Implementation:', mrmImplAddress);
  console.log('');
  console.log('HealthRecordCore:');
  console.log('  Proxy:         ', hrcProxyAddress);
  console.log('  Implementation:', hrcImplAddress);
  console.log('================================');
  console.log('\n✅ Both contracts deployed successfully!');
  console.log('\n💡 Update these in your frontend config:');
  console.log('   MEMBER_ROLE_MANAGER_PROXY:', mrmProxyAddress);
  console.log('   HEALTH_RECORD_CORE_PROXY: ', hrcProxyAddress);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

import hre from 'hardhat';
const { ethers } = hre;

// Existing HealthRecordCore proxy — stays unchanged.
// Source of truth: packages/shared/src/blockchainAddresses.ts
const EXISTING_HRC_PROXY = {
  baseSepolia: '0xE1012A0D698cced489C47189F9DC9372d6Fb104B',
};

async function main() {
  const network = hre.network.name;
  console.log(`\n🚀 Deploying MemberRoleManager on ${network}...\n`);

  const hrcProxyAddress = EXISTING_HRC_PROXY[network];
  if (!hrcProxyAddress) {
    throw new Error(`No existing HRC proxy address configured for network: ${network}`);
  }

  const [deployer] = await ethers.getSigners();
  console.log('Deploying with account:', deployer.address);
  console.log(
    'Account balance:',
    ethers.formatEther(await ethers.provider.getBalance(deployer.address)),
    'ETH\n'
  );

  const ERC1967Proxy = await ethers.getContractFactory('ERC1967Proxy');

  // ==========================================
  // 1. Deploy new MemberRoleManager
  // ==========================================
  console.log('📝 Deploying MemberRoleManager implementation...');
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
  // 2. Wire both directions
  // ==========================================
  console.log('🔗 Wiring contracts together...');

  const mrm = await ethers.getContractAt('MemberRoleManager', mrmProxyAddress);
  await mrm.setHealthRecordCore(hrcProxyAddress);
  console.log('  ✅ MemberRoleManager → HealthRecordCore');

  const hrc = await ethers.getContractAt('HealthRecordCore', hrcProxyAddress);
  await hrc.setMemberRoleManager(mrmProxyAddress);
  console.log('  ✅ HealthRecordCore   → MemberRoleManager\n');

  // ==========================================
  // Summary
  // ==========================================
  console.log('📋 Deployment Summary:');
  console.log('================================');
  console.log('MemberRoleManager (NEW):');
  console.log('  Proxy:         ', mrmProxyAddress);
  console.log('  Implementation:', mrmImplAddress);
  console.log('');
  console.log('HealthRecordCore (unchanged):');
  console.log('  Proxy:         ', hrcProxyAddress);
  console.log('================================');
  console.log('\n⚠️  Update packages/shared/src/blockchainAddresses.ts:');
  console.log(`   MEMBER_ROLE_MANAGER ${network} proxy: '${mrmProxyAddress}'`);
  console.log(`   MEMBER_ROLE_MANAGER ${network} impl:  '${mrmImplAddress}'`);
  console.log('\n⚠️  Then run: npx hardhat verify --network', network, mrmImplAddress);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

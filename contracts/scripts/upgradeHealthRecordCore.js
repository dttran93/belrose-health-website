// scripts/upgradeHealthRecordCore.js
import hre from 'hardhat';
const { ethers, upgrades } = hre;

const HEALTH_RECORD_CORE_PROXY = '0x66A8b985C61205e63D7d7DEA72Dfa5849a3e66De';
const MEMBER_ROLE_MANAGER_PROXY = '0xdF9583C25E234A34a1E47d9830722123CA228a1a';

async function main() {
  console.log('🚀 Starting HealthRecordCore upgrade...');
  console.log('📍 Proxy address (will not change):', HEALTH_RECORD_CORE_PROXY);
  const oldImplAddress = await upgrades.erc1967.getImplementationAddress(HEALTH_RECORD_CORE_PROXY);
  console.log('📍 Current implementation address (Will be changed):', oldImplAddress);

  const HealthRecordCoreV2 = await ethers.getContractFactory('HealthRecordCore');

  console.log('\n📋 Importing existing proxy into upgrades registry...');
  await upgrades.forceImport(HEALTH_RECORD_CORE_PROXY, HealthRecordCoreV2, { kind: 'uups' });
  console.log('✅ Proxy imported successfully');

  console.log('\n📦 Deploying new implementation...');
  const upgraded = await upgrades.upgradeProxy(HEALTH_RECORD_CORE_PROXY, HealthRecordCoreV2, {
    kind: 'uups',
    redeployImplementation: 'always',
  });
  await upgraded.waitForDeployment();

  const newImplAddress = await upgrades.erc1967.getImplementationAddress(
    await upgraded.getAddress(),
    { provider: ethers.provider } // forces on-chain lookup
  );

  console.log('✅ Proxy upgraded successfully!');
  console.log('📍 Proxy address (unchanged):', await upgraded.getAddress());
  console.log('📍 New implementation address:', newImplAddress);

  // Verify MemberRoleManager reference
  console.log('\n🔍 Verifying MemberRoleManager reference...');
  const currentMRM = await upgraded.memberRoleManager();
  console.log('📍 Current MemberRoleManager:', currentMRM);

  if (currentMRM.toLowerCase() !== MEMBER_ROLE_MANAGER_PROXY.toLowerCase()) {
    console.log('⚠️  MemberRoleManager mismatch! Updating...');
    const tx = await upgraded.setMemberRoleManager(MEMBER_ROLE_MANAGER_PROXY);
    await tx.wait();
    console.log('✅ MemberRoleManager updated. Tx:', tx.hash);
  } else {
    console.log('✅ MemberRoleManager reference is correct — no update needed.');
  }

  console.log('\n📝 ACTION REQUIRED — update blockchainAddresses.ts:');
  console.log(`   implementation: '${newImplAddress}',`);
  console.log('   (proxy address stays the same — no frontend changes needed)');
  console.log(
    `\n📝 ACTION REQUIRED — verify on network: npx hardhat verify --network baseSepolia '${newImplAddress}'`
  );
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

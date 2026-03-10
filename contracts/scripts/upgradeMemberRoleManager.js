// scripts/upgradeMemberRoleManager.js
import hre from 'hardhat';
const { ethers, upgrades } = hre;

const MEMBER_ROLE_MANAGER_PROXY = '0xC31477f563dC8f7529Ba6AE7E410ABdB84C27d7C';
const HEALTH_RECORD_CORE_PROXY = '0x97F9eD2af3f9a30Eac958D0994a0F131Eda11A57';

async function main() {
  console.log('🚀 Starting MemberRoleManager upgrade...');
  console.log('📍 Proxy address (will not change):', MEMBER_ROLE_MANAGER_PROXY);

  const MemberRoleManagerV2 = await ethers.getContractFactory('MemberRoleManager');

  // No forceImport — upgradeProxy handles registry internally
  console.log('\n📦 Deploying new implementation...');
  const upgraded = await upgrades.upgradeProxy(MEMBER_ROLE_MANAGER_PROXY, MemberRoleManagerV2, {
    kind: 'uups',
    redeployImplementation: 'always', // force fresh deployment every time
  });
  await upgraded.waitForDeployment();

  const newImplAddress = await upgrades.erc1967.getImplementationAddress(
    await upgraded.getAddress(),
    { provider: ethers.provider } // forces on-chain lookup
  );

  console.log('✅ Proxy upgraded successfully!');
  console.log('📍 Proxy address (unchanged):', await upgraded.getAddress());
  console.log('📍 New implementation address:', newImplAddress);

  // Verify HealthRecordCore reference
  console.log('\n🔍 Verifying HealthRecordCore reference...');
  const currentHRC = await upgraded.getHealthRecordCore();
  console.log('📍 Current HealthRecordCore:', currentHRC);

  if (currentHRC.toLowerCase() !== HEALTH_RECORD_CORE_PROXY.toLowerCase()) {
    console.log('⚠️  HealthRecordCore mismatch! Updating...');
    const tx = await upgraded.setHealthRecordCore(HEALTH_RECORD_CORE_PROXY);
    await tx.wait();
    console.log('✅ HealthRecordCore updated. Tx:', tx.hash);
  } else {
    console.log('✅ HealthRecordCore reference is correct — no update needed.');
  }

  console.log('\n📝 ACTION REQUIRED — update blockchainAddresses.ts:');
  console.log(`   implementation: '${newImplAddress}',`);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

// scripts/upgradeHealthRecordCore.js
import hre from 'hardhat';
const { ethers, upgrades } = hre;

const HEALTH_RECORD_CORE_PROXY = '0x97F9eD2af3f9a30Eac958D0994a0F131Eda11A57';
const MEMBER_ROLE_MANAGER_PROXY = '0xC31477f563dC8f7529Ba6AE7E410ABdB84C27d7C';

async function main() {
  console.log('🚀 Starting HealthRecordCore upgrade...');
  console.log('📍 Proxy address (will not change):', HEALTH_RECORD_CORE_PROXY);

  const HealthRecordCoreV2 = await ethers.getContractFactory('HealthRecordCore');

  // No forceImport — redeployImplementation: 'always' forces fresh bytecode every time
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
    `\n📝 ACTION REQUIRED — verify on network: npx hardhat verify --network sepolia '${newImplAddress}'`
  );
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

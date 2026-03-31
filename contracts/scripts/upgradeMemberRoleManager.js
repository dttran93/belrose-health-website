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

  const deployTx = upgraded.deploymentTransaction();
  console.log('📍 Upgrade tx hash:', deployTx?.hash);

  await upgraded.waitForDeployment();

  // Poll until slot value changes from old implementation
  /**
   * NOTE YOU HAD ISSUES WITH THIS PREVIOUSLY. THE IMPLEMENTATION ADDRESS WAS UPGRADE ON CHAIN
   * BUT THIS SCRIPT RELAYED THE OLD IMPLEMENTATION ADDRESS CAUSING CONFUSION. PROBABLY A CACHING ISSUE
   * NEXT TIME EXPERIMENT WITH USING THE SCRIPT BELOW TO PULL THE SLOT DIRECTLY AND VERIFY THERE'S A CHANGE
   * CALL checkImpl.js JUST IN CASE
   */
  console.log('⏳ Waiting for RPC to reflect new implementation...');
  let newImplAddress = '';
  const slot = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
  for (let i = 0; i < 10; i++) {
    await new Promise(resolve => setTimeout(resolve, 3000));
    const value = await ethers.provider.getStorage(MEMBER_ROLE_MANAGER_PROXY, slot);
    newImplAddress = '0x' + value.slice(-40);
    console.log(`   Attempt ${i + 1}: ${newImplAddress}`);
    if (newImplAddress.toLowerCase() !== '0xa2eb35c3db09283847def81e3a9cc0f41204fe85') break;
  }

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

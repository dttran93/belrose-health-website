// scripts/setHealthRecordCore.js
import hre from 'hardhat';
const { ethers } = hre;

async function main() {
  console.log('🔗 Setting HealthRecordCore reference...');

  const PROXY_ADDRESS = '0xC31477f563dC8f7529Ba6AE7E410ABdB84C27d7C';
  const HEALTH_RECORD_CORE_ADDRESS = '0x97F9eD2af3f9a30Eac958D0994a0F131Eda11A57'; // ← Add your HealthRecordCore address here

  const memberRoleManager = await ethers.getContractAt('MemberRoleManager', PROXY_ADDRESS);

  try {
    const currentHealthRecordCore = await memberRoleManager.getHealthRecordCore();
    console.log('Current HealthRecordCore:', currentHealthRecordCore);
  } catch (error) {
    console.log('HealthRecordCore getter is now available');
  }

  console.log('Setting HealthRecordCore address...');
  const tx = await memberRoleManager.setHealthRecordCore(HEALTH_RECORD_CORE_ADDRESS);
  console.log('Transaction sent:', tx.hash);

  await tx.wait();
  console.log('✅ HealthRecordCore set!');

  // Verify
  const newHealthRecordCore = await memberRoleManager.getHealthRecordCore();
  console.log('Final HealthRecordCore:', newHealthRecordCore);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

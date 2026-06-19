import hre from 'hardhat';
const { ethers } = hre;

// Run this after a failed deployMemberRoleManager.mjs to retry the HRC wiring step.
const NEW_MRM_PROXY   = '0x15B6247f1305ed1Ab3947765DF01d26D849B62d7';
const EXISTING_HRC_PROXY = '0x66A8b985C61205e63D7d7DEA72Dfa5849a3e66De';

async function main() {
  console.log('\n🔗 Wiring HealthRecordCore → MemberRoleManager...\n');
  const hrc = await ethers.getContractAt('HealthRecordCore', EXISTING_HRC_PROXY);
  await hrc.setMemberRoleManager(NEW_MRM_PROXY);
  console.log('✅ Done. HRC now points to:', NEW_MRM_PROXY);
}

main()
  .then(() => process.exit(0))
  .catch(error => { console.error(error); process.exit(1); });

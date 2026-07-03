import hre from 'hardhat';
const { ethers } = hre;

// Run this after a failed deployMemberRoleManager.mjs to retry the HRC wiring step.
const NEW_MRM_PROXY   = '0x61CcF57C332D32c4d906ac64674BBA4E10CCB07B';
const EXISTING_HRC_PROXY = '0xE1012A0D698cced489C47189F9DC9372d6Fb104B';

async function main() {
  console.log('\n🔗 Wiring HealthRecordCore → MemberRoleManager...\n');
  const hrc = await ethers.getContractAt('HealthRecordCore', EXISTING_HRC_PROXY);
  await hrc.setMemberRoleManager(NEW_MRM_PROXY);
  console.log('✅ Done. HRC now points to:', NEW_MRM_PROXY);
}

main()
  .then(() => process.exit(0))
  .catch(error => { console.error(error); process.exit(1); });

import hre from 'hardhat';
import { HEALTH_RECORD_CORE, MEMBER_ROLE_MANAGER } from './_shared/blockchainAddresses.core.js';
const { ethers } = hre;

// Run this after a failed deployMemberRoleManager.mjs to retry the HRC wiring step.
const NEW_MRM_PROXY   = MEMBER_ROLE_MANAGER.proxy;
const EXISTING_HRC_PROXY = HEALTH_RECORD_CORE.proxy;

async function main() {
  console.log('\n🔗 Wiring HealthRecordCore → MemberRoleManager...\n');
  const hrc = await ethers.getContractAt('HealthRecordCore', EXISTING_HRC_PROXY);
  await hrc.setMemberRoleManager(NEW_MRM_PROXY);
  console.log('✅ Done. HRC now points to:', NEW_MRM_PROXY);
}

main()
  .then(() => process.exit(0))
  .catch(error => { console.error(error); process.exit(1); });

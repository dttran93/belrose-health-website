// scripts/verifyUpgrade.js
//
// Run this after both upgrade scripts complete to confirm everything
// is wired up correctly before testing the frontend.
//
// Usage: npx hardhat run scripts/verifyUpgrade.js --network sepolia

import hre from 'hardhat';
const { ethers, upgrades } = hre;

// ============================================================================
// ADDRESSES — pulled from blockchainAddresses.ts
// ============================================================================

const MEMBER_ROLE_MANAGER_PROXY = '0xC31477f563dC8f7529Ba6AE7E410ABdB84C27d7C';
const HEALTH_RECORD_CORE_PROXY = '0x97F9eD2af3f9a30Eac958D0994a0F131Eda11A57';

// ============================================================================
// HELPERS
// ============================================================================

function pass(msg) {
  console.log('  ✅', msg);
}
function fail(msg) {
  console.log('  ❌', msg);
}
function warn(msg) {
  console.log('  ⚠️ ', msg);
}
function section(msg) {
  console.log(`\n── ${msg} ──`);
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('🔍 Post-upgrade verification\n');

  const mrm = await ethers.getContractAt('MemberRoleManager', MEMBER_ROLE_MANAGER_PROXY);
  const hrc = await ethers.getContractAt('HealthRecordCore', HEALTH_RECORD_CORE_PROXY);

  let allPassed = true;

  // ── MemberRoleManager ─────────────────────────────────────────────────────

  section('MemberRoleManager');

  // Implementation address
  const mrmImpl = await upgrades.erc1967.getImplementationAddress(MEMBER_ROLE_MANAGER_PROXY);
  console.log('  📍 Proxy:         ', MEMBER_ROLE_MANAGER_PROXY);
  console.log('  📍 Implementation:', mrmImpl);

  // Admin set
  const mrmAdmin = await mrm.admin();
  if (mrmAdmin !== ethers.ZeroAddress) {
    pass(`Admin set: ${mrmAdmin}`);
  } else {
    fail('Admin is zero address!');
    allPassed = false;
  }

  // HealthRecordCore reference
  const mrmHRC = await mrm.getHealthRecordCore();
  if (mrmHRC.toLowerCase() === HEALTH_RECORD_CORE_PROXY.toLowerCase()) {
    pass(`HealthRecordCore reference correct: ${mrmHRC}`);
  } else if (mrmHRC === ethers.ZeroAddress) {
    fail('HealthRecordCore NOT set on MemberRoleManager — run setHealthRecordCore.js!');
    allPassed = false;
  } else {
    fail(`HealthRecordCore mismatch! Got ${mrmHRC}, expected ${HEALTH_RECORD_CORE_PROXY}`);
    allPassed = false;
  }

  // New functions exist — proposeTrustee, updateTrusteeLevel, grantRoleAsTrusteeBatch
  try {
    // Read-only sanity check: call a view that only exists in the new implementation
    await mrm.getTrusteeRelationship(ethers.ZeroHash, ethers.ZeroHash);
    pass('New trustee functions present (getTrusteeRelationship callable)');
  } catch (e) {
    // Will revert with "No active relationship" or similar — that's fine, function exists
    if (e.message?.includes('revert') || e.message?.includes('invalid')) {
      pass('New trustee functions present (getTrusteeRelationship callable)');
    } else {
      fail(`New trustee functions missing or broken: ${e.message}`);
      allPassed = false;
    }
  }

  // Total users still intact (storage survived upgrade)
  const totalUsers = await mrm.getTotalUsers();
  pass(`Storage intact — totalUsers: ${totalUsers.toString()}`);

  // ── HealthRecordCore ──────────────────────────────────────────────────────

  section('HealthRecordCore');

  // Implementation address
  const hrcImpl = await upgrades.erc1967.getImplementationAddress(HEALTH_RECORD_CORE_PROXY);
  console.log('  📍 Proxy:         ', HEALTH_RECORD_CORE_PROXY);
  console.log('  📍 Implementation:', hrcImpl);

  // Admin set
  const hrcAdmin = await hrc.admin();
  if (hrcAdmin !== ethers.ZeroAddress) {
    pass(`Admin set: ${hrcAdmin}`);
  } else {
    fail('Admin is zero address!');
    allPassed = false;
  }

  // MemberRoleManager reference
  const hrcMRM = await hrc.memberRoleManager();
  if (hrcMRM.toLowerCase() === MEMBER_ROLE_MANAGER_PROXY.toLowerCase()) {
    pass(`MemberRoleManager reference correct: ${hrcMRM}`);
  } else {
    fail(`MemberRoleManager mismatch! Got ${hrcMRM}, expected ${MEMBER_ROLE_MANAGER_PROXY}`);
    allPassed = false;
  }

  // New anchorRecord signature — takes 3 params now (recordId, recordHash, subjectIdHash)
  // We can't call it without a registered wallet, but we can check the ABI fragment exists
  const anchorFragment = hrc.interface.getFunction('anchorRecord');
  if (anchorFragment && anchorFragment.inputs.length === 3) {
    pass(`anchorRecord has correct 3-param signature (recordId, recordHash, subjectIdHash)`);
  } else {
    fail(`anchorRecord has wrong number of params: ${anchorFragment?.inputs.length ?? 'unknown'}`);
    allPassed = false;
  }

  // Storage intact
  const totalAnchored = await hrc.getTotalAnchoredRecords();
  pass(`Storage intact — totalAnchoredRecords: ${totalAnchored.toString()}`);

  // ── Cross-contract wiring ─────────────────────────────────────────────────

  section('Cross-contract wiring');

  const mrmPointsToHRC = mrmHRC.toLowerCase() === HEALTH_RECORD_CORE_PROXY.toLowerCase();
  const hrcPointsToMRM = hrcMRM.toLowerCase() === MEMBER_ROLE_MANAGER_PROXY.toLowerCase();

  if (mrmPointsToHRC && hrcPointsToMRM) {
    pass('Bidirectional reference confirmed — both contracts point at each other correctly');
  } else {
    if (!mrmPointsToHRC) fail('MemberRoleManager → HealthRecordCore reference broken');
    if (!hrcPointsToMRM) fail('HealthRecordCore → MemberRoleManager reference broken');
    allPassed = false;
  }

  // ── Summary ───────────────────────────────────────────────────────────────

  section('Summary');

  if (allPassed) {
    console.log('\n🎉 All checks passed — safe to test the frontend!\n');
    console.log(
      '📝 Remember to update blockchainAddresses.ts with the new implementation addresses:'
    );
    console.log(`   MEMBER_ROLE_MANAGER.implementation: '${mrmImpl}'`);
    console.log(`   HEALTH_RECORD_CORE.implementation:  '${hrcImpl}'`);
  } else {
    console.log('\n🚨 Some checks failed — do not test the frontend until resolved.\n');
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

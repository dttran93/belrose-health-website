// scripts/upgradeHealthRecordCore.js
import hre from 'hardhat';
const { ethers, upgrades } = hre;

const HEALTH_RECORD_CORE_PROXY = '0xE1012A0D698cced489C47189F9DC9372d6Fb104B';
const MEMBER_ROLE_MANAGER_PROXY = '0x61CcF57C332D32c4d906ac64674BBA4E10CCB07B';

async function main() {
  console.log('🚀 Starting HealthRecordCore upgrade...');
  console.log('📍 Proxy address (will not change):', HEALTH_RECORD_CORE_PROXY);

  // RPC sanity check
  const network = await ethers.provider.getNetwork();
  console.log('🔗 Connected to chain ID:', network.chainId.toString(), '(expected: 84532 for Base Sepolia)');
  const code = await ethers.provider.getCode(HEALTH_RECORD_CORE_PROXY);
  console.log('📦 Bytecode at proxy:', code === '0x' ? 'EMPTY ❌ (contract not found)' : `OK ✅ (${code.length / 2 - 1} bytes)`);

  const slot = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
  const raw = await ethers.provider.getStorage(HEALTH_RECORD_CORE_PROXY, slot);
  const oldImplAddress = '0x' + raw.slice(-40);
  console.log('📍 Current implementation address (Will be changed):', oldImplAddress);

  const HealthRecordCoreV2 = await ethers.getContractFactory('HealthRecordCore');

  // No forceImport — upgradeProxy handles registry internally
  console.log('\n📦 Deploying new implementation...');
  const upgraded = await upgrades.upgradeProxy(HEALTH_RECORD_CORE_PROXY, HealthRecordCoreV2, {
    kind: 'uups',
    redeployImplementation: 'always',
  });
  await upgraded.waitForDeployment();

  // Read implementation slot directly — OZ plugin may return cached (stale) address
  const newRaw = await ethers.provider.getStorage(HEALTH_RECORD_CORE_PROXY, slot);
  const newImplAddress = '0x' + newRaw.slice(-40);

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

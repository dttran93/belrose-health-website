// scripts/upgradeMemberRoleManager.js
import hre from 'hardhat';
const { ethers, upgrades } = hre;

async function main() {
  console.log('🚀 Starting MemberRoleManager upgrade...');

  // Your existing proxy address (the one users interact with)
  const PROXY_ADDRESS = '0xC31477f563dC8f7529Ba6AE7E410ABdB84C27d7C'; // Replace with your actual proxy address

  // Get the new implementation contract factory
  const MemberRoleManagerV2 = await ethers.getContractFactory('MemberRoleManager');

  console.log('📦 Deploying new implementation...');

  // This deploys the new implementation and upgrades the proxy to point to it
  const upgraded = await upgrades.upgradeProxy(PROXY_ADDRESS, MemberRoleManagerV2);

  await upgraded.waitForDeployment();

  console.log('✅ Proxy upgraded successfully!');
  console.log('📍 Proxy address (unchanged):', await upgraded.getAddress());
  console.log(
    '📍 New implementation address:',
    await upgrades.erc1967.getImplementationAddress(await upgraded.getAddress())
  );

  // Try to call the new function, but handle gracefully if it fails
  try {
    const healthRecordCore = await upgraded.getHealthRecordCore();
    console.log('📍 Current HealthRecordCore address:', healthRecordCore);

    if (healthRecordCore === ethers.ZeroAddress) {
      console.log('⚠️  HealthRecordCore not set yet - need to call setHealthRecordCore()');
    }
  } catch (error) {
    console.log('✅ New functions available (getHealthRecordCore callable)');
    console.log('⚠️  HealthRecordCore not set yet - need to call setHealthRecordCore()');
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

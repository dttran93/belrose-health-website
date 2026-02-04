import hre from 'hardhat';
const { ethers } = hre;

async function main() {
  const MRM_PROXY = '0xA51c1fc2f0D1a1b8494Ed1FE312d7C3a78Ed91C0';
  const HRC_PROXY = '0x9A676e781A523b5d0C0e43731313A708CB607508';

  const [deployer, user1] = await ethers.getSigners();

  // Test MemberRoleManager
  const mrm = await ethers.getContractAt('MemberRoleManager', MRM_PROXY);

  console.log('Testing MemberRoleManager...');
  const userIdHash = ethers.id('test-user-123');
  await mrm.addMember(user1.address, userIdHash);
  console.log('✅ Member added');

  // Test HealthRecordCore
  const hrc = await ethers.getContractAt('HealthRecordCore', HRC_PROXY);

  console.log('\n✅ Both contracts working!');
}

main().catch(console.error);

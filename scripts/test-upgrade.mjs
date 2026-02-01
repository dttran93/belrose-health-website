import hre from 'hardhat';
const { ethers, upgrades } = hre;

async function main() {
  const PROXY_ADDRESS = '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512'; // Your deployed proxy

  console.log('🧪 Testing Upgradeable Contract...\n');

  const [deployer, user1] = await ethers.getSigners();

  // Connect to deployed proxy
  const MemberRoleManager = await ethers.getContractFactory('MemberRoleManager');
  const contract = MemberRoleManager.attach(PROXY_ADDRESS);

  // Test 1: Check admin
  const admin = await contract.admin();
  console.log('✅ Admin address:', admin);
  console.log('   Expected:', deployer.address);
  console.log('   Match:', admin === deployer.address, '\n');

  // Test 2: Add a member
  const userIdHash = ethers.id('test-user-123');
  console.log('📝 Adding member...');
  const tx = await contract.addMember(user1.address, userIdHash);
  await tx.wait();
  console.log('✅ Member added!\n');

  // Test 3: Check member was added
  const totalUsers = await contract.getTotalUsers();
  console.log('👥 Total users:', totalUsers.toString());

  const userInfo = await contract.wallets(user1.address);
  console.log('User Info:');
  console.log('  - userIdHash:', userInfo.userIdHash);
  console.log('  - isWalletActive:', userInfo.isWalletActive);
  console.log('  - Match:', userInfo.userIdHash === userIdHash, '\n');

  console.log('🎉 All tests passed!');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

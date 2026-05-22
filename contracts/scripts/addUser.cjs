const { ethers } = require('hardhat');

async function main() {
  const contractAddress = '0xdF9583C25E234A34a1E47d9830722123CA228a1a';
  if (!contractAddress) throw new Error('Missing CONTRACT_ADDRESS');

  const userIdHash = '0xc47eaa04c4ef76d274fdff0fbe74449b0c11f28521d7e4e7085142cd83ff8ce3';
  const walletAddresses = [
    '0xDD3e22B75250803B90183bFB6d4F5880260eb7ca',
    '0xE2f6B8578f7870Bde02894bc989A4e17E200578f',
  ];

  const [adminSigner] = await ethers.getSigners();
  console.log(`🔑 Using Admin: ${adminSigner.address}`);

  const registryContract = await ethers.getContractAt('MemberRoleManager', contractAddress);

  console.log(`🚀 Dispatching addMemberBatch...`);
  const txResponse = await registryContract.addMemberBatch(walletAddresses, userIdHash);

  console.log(`🔗 Tx Sent: ${txResponse.hash}`);
  const receipt = await txResponse.wait(1);
  console.log(`✅ Confirmed in block ${receipt.blockNumber}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

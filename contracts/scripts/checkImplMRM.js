import hre from 'hardhat';

async function main() {
  const slot = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
  const value = await hre.ethers.provider.getStorage(
    '0x61CcF57C332D32c4d906ac64674BBA4E10CCB07B', // MemberRoleManager proxy
    slot
  );
  console.log('Current implementation:', '0x' + value.slice(-40));
}

main().catch(console.error);

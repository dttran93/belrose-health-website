import hre from 'hardhat';

async function main() {
  const slot = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
  const value = await hre.ethers.provider.getStorage(
    '0xC31477f563dC8f7529Ba6AE7E410ABdB84C27d7C',
    slot
  );
  console.log('Current implementation:', '0x' + value.slice(-40));
}

main().catch(console.error);

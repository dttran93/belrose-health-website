import hre from 'hardhat';

async function main() {
  const slot = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
  const value = await hre.ethers.provider.getStorage(
    '0x66A8b985C61205e63D7d7DEA72Dfa5849a3e66De', // HealthRecordCore proxy
    slot
  );
  console.log('Current implementation:', '0x' + value.slice(-40));
}

main().catch(console.error);

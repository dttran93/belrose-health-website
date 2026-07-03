import hre from 'hardhat';

async function main() {
  const slot = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
  const value = await hre.ethers.provider.getStorage(
    '0xE1012A0D698cced489C47189F9DC9372d6Fb104B', // HealthRecordCore proxy
    slot
  );
  console.log('Current implementation:', '0x' + value.slice(-40));
}

main().catch(console.error);

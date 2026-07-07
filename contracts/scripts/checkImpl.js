import hre from 'hardhat';
import { HEALTH_RECORD_CORE } from './_shared/blockchainAddresses.core.js';

async function main() {
  const slot = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
  const value = await hre.ethers.provider.getStorage(HEALTH_RECORD_CORE.proxy, slot);
  console.log('Current implementation:', '0x' + value.slice(-40));
}

main().catch(console.error);

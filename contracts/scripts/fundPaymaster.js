import hre from 'hardhat';

const PAYMASTER_ADDRESS = '0x967e757609E1118E7164e51A204772a14804E253';

async function main() {
  const [signer] = await hre.ethers.getSigners();

  const paymaster = await hre.ethers.getContractAt('BelrosePaymaster', PAYMASTER_ADDRESS, signer);

  // Check current deposit
  const currentDeposit = await paymaster.getDeposit();
  console.log('Current deposit:', hre.ethers.formatEther(currentDeposit), 'ETH');

  // Add more funds
  const tx = await paymaster.deposit({ value: hre.ethers.parseEther('0.5') });
  await tx.wait();

  const newDeposit = await paymaster.getDeposit();
  console.log('New deposit:', hre.ethers.formatEther(newDeposit), 'ETH');
}

main();

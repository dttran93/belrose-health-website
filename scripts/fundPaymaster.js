import hre from 'hardhat';

const PAYMASTER_ADDRESS = '0xe59573d7856cB641F8790A336EcD7165c706B6EC';

async function main() {
  const [signer] = await hre.ethers.getSigners();

  const paymaster = await hre.ethers.getContractAt('BelrosePaymaster', PAYMASTER_ADDRESS, signer);

  // Check current deposit
  const currentDeposit = await paymaster.getDeposit();
  console.log('Current deposit:', hre.ethers.formatEther(currentDeposit), 'ETH');

  // Add more funds
  const tx = await paymaster.deposit({ value: hre.ethers.parseEther('0.05') });
  await tx.wait();

  const newDeposit = await paymaster.getDeposit();
  console.log('New deposit:', hre.ethers.formatEther(newDeposit), 'ETH');
}

main();

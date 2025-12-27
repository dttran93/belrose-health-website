// scripts/updatePaymasterSigner.js
import hre from 'hardhat';

async function main() {
  const PAYMASTER_ADDRESS = '0x967e757609E1118E7164e51A204772a14804E253';
  const NEW_SIGNER = '0x875622a16aC9Daa000Cbb34fE396EDc37EB72217';

  console.log('Starting signer update...');
  console.log('Paymaster:', PAYMASTER_ADDRESS);
  console.log('New signer:', NEW_SIGNER);

  if (!NEW_SIGNER) {
    throw new Error('❌ ADMIN_WALLET_ADDRESS not set in .env');
  }

  const paymaster = await hre.ethers.getContractAt('BelrosePaymaster', PAYMASTER_ADDRESS);

  console.log('Current signer:', await paymaster.verifyingSigner());

  const tx = await paymaster.updateSigner(NEW_SIGNER);
  console.log('⏳ Transaction sent:', tx.hash);

  await tx.wait();

  console.log('✅ Signer updated to:', NEW_SIGNER);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

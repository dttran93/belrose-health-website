// scripts/transferPaymasterOwnership.js
import hre from 'hardhat';

async function main() {
  const PAYMASTER_ADDRESS = '0x967e757609E1118E7164e51A204772a14804E253';
  const NEW_OWNER = '0x485cc0e0a6D17832aeb2FD1932697beAA57cBB36';

  console.log('Starting ownership transfer...');
  console.log('Paymaster:', PAYMASTER_ADDRESS);
  console.log('New owner:', NEW_OWNER);

  if (!NEW_OWNER) {
    throw new Error('❌ ADMIN_WALLET_ADDRESS not set in .env');
  }

  const paymaster = await hre.ethers.getContractAt('BelrosePaymaster', PAYMASTER_ADDRESS);

  console.log('Current owner:', await paymaster.owner());

  const tx = await paymaster.transferOwnership(NEW_OWNER);
  console.log('⏳ Transaction sent:', tx.hash);

  await tx.wait();

  console.log('✅ Ownership transferred to:', NEW_OWNER);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

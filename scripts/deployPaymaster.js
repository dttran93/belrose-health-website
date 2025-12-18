// scripts/deployPaymaster.js
import hre from 'hardhat';

// EntryPoint addresses (canonical deployments)
const ENTRYPOINT_ADDRESSES = {
  // v0.7 - newer, recommended
  v07: '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
  // v0.6 - older but widely supported
  v06: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
};

async function main() {
  console.log('🚀 Deploying BelrosePaymaster...\n');

  const [deployer] = await hre.ethers.getSigners();
  console.log('🔑 Deploying with account:', deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log('💰 Account balance:', hre.ethers.formatEther(balance), 'ETH');

  if (balance === 0n) {
    console.error('❌ Account has no ETH! Get Sepolia ETH from a faucet.');
    process.exit(1);
  }

  // ============ Configuration ============

  // Which EntryPoint version to use
  // v0.7 is newer and recommended for new projects
  // v0.6 has wider bundler support currently
  const ENTRYPOINT_VERSION = 'v07';
  const entryPointAddress = ENTRYPOINT_ADDRESSES[ENTRYPOINT_VERSION];

  // Your backend's signing wallet
  // This is the wallet that will sign sponsorship approvals
  // IMPORTANT: Generate a new wallet for this, keep the private key secure!
  const VERIFYING_SIGNER = process.env.PAYMASTER_SIGNER_ADDRESS;

  if (!VERIFYING_SIGNER) {
    console.error('❌ PAYMASTER_SIGNER_ADDRESS not set in environment!');
    console.log('\nTo generate a signer wallet:');
    console.log('  const wallet = ethers.Wallet.createRandom();');
    console.log('  console.log("Address:", wallet.address);');
    console.log('  console.log("Private Key:", wallet.privateKey);');
    console.log('\nThen add to .env:');
    console.log('  PAYMASTER_SIGNER_ADDRESS=0x...');
    console.log('  PAYMASTER_SIGNER_PRIVATE_KEY=0x...');
    process.exit(1);
  }

  // Maximum gas cost to sponsor per UserOperation
  // 0.01 ETH is generous for most operations on Sepolia
  const MAX_COST_PER_USEROP = hre.ethers.parseEther('0.01');

  // Initial deposit to fund gas sponsorship
  // This is how much ETH will be available to sponsor transactions
  const INITIAL_DEPOSIT = hre.ethers.parseEther('0.05');

  // ============ Deploy ============

  console.log('\n--- Configuration ---');
  console.log('EntryPoint version:', ENTRYPOINT_VERSION);
  console.log('EntryPoint address:', entryPointAddress);
  console.log('Verifying signer:', VERIFYING_SIGNER);
  console.log('Max cost per UserOp:', hre.ethers.formatEther(MAX_COST_PER_USEROP), 'ETH');
  console.log('Initial deposit:', hre.ethers.formatEther(INITIAL_DEPOSIT), 'ETH');

  console.log('\n--- Deploying Contract ---\n');

  const BelrosePaymaster = await hre.ethers.getContractFactory('BelrosePaymaster', deployer);

  const paymaster = await BelrosePaymaster.deploy(
    entryPointAddress,
    VERIFYING_SIGNER,
    MAX_COST_PER_USEROP
  );

  await paymaster.waitForDeployment();
  const paymasterAddress = await paymaster.getAddress();

  console.log('✅ BelrosePaymaster deployed to:', paymasterAddress);

  // ============ Fund the Paymaster ============

  console.log('\n--- Funding Paymaster ---\n');

  // Deposit ETH to EntryPoint for gas sponsorship
  const depositTx = await paymaster.deposit({ value: INITIAL_DEPOSIT });
  await depositTx.wait();

  console.log('✅ Deposited', hre.ethers.formatEther(INITIAL_DEPOSIT), 'ETH to EntryPoint');

  // Check the deposit
  const deposit = await paymaster.getDeposit();
  console.log('📊 Current deposit balance:', hre.ethers.formatEther(deposit), 'ETH');

  // ============ Summary ============

  console.log('\n========================================');
  console.log('🎉 DEPLOYMENT COMPLETE!');
  console.log('========================================');
  console.log(`Paymaster Address:    ${paymasterAddress}`);
  console.log(`EntryPoint (${ENTRYPOINT_VERSION}):     ${entryPointAddress}`);
  console.log(`Verifying Signer:     ${VERIFYING_SIGNER}`);
  console.log(`Deposit Balance:      ${hre.ethers.formatEther(deposit)} ETH`);

  console.log('\n🔍 Etherscan:');
  console.log(`https://sepolia.etherscan.io/address/${paymasterAddress}`);

  console.log('\n📝 Next Steps:');
  console.log('1. Add to your .env file:');
  console.log(`   PAYMASTER_CONTRACT_ADDRESS=${paymasterAddress}`);
  console.log(`   ENTRYPOINT_ADDRESS=${entryPointAddress}`);
  console.log('\n2. Verify the contract on Etherscan:');
  console.log(`   npx hardhat verify --network sepolia ${paymasterAddress} \\`);
  console.log(`     "${entryPointAddress}" \\`);
  console.log(`     "${VERIFYING_SIGNER}" \\`);
  console.log(`     "${MAX_COST_PER_USEROP}"`);
  console.log('\n3. Build your backend signing service');
  console.log('\n4. Update your frontend to use account abstraction');
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Deployment failed:', error);
    process.exit(1);
  });

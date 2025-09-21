const hre = require('hardhat');

async function main() {
  console.log('🚀 Starting deployment...');

  // Get the deployer account
  const [deployer] = await hre.ethers.getSigners();
  console.log('🔑 Deploying with account:', deployer.address);

  // Check account balance
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log('💰 Account balance:', hre.ethers.formatEther(balance), 'POL');

  // Get the contract factory with signer
  const HealthRecordVerification = await hre.ethers.getContractFactory(
    'HealthRecordVerification',
    deployer
  );

  // Deploy the contract
  console.log('⏳ Deploying contract...');
  const healthRecord = await HealthRecordVerification.deploy();

  // Wait for deployment
  await healthRecord.waitForDeployment();

  // Get the contract address
  const contractAddress = await healthRecord.getAddress();

  console.log('✅ Contract deployed successfully!');
  console.log(`📍 Contract Address: ${contractAddress}`);
  console.log(`🌐 Network: ${hre.network.name}`);

  // Save this info - you'll need it for your React app!
  console.log('\n🔧 IMPORTANT - Copy this address to your React app:');
  console.log(`CONTRACT_ADDRESS = "${contractAddress}"`);

  // Show block explorer link
  if (hre.network.name === 'mumbai') {
    console.log(
      `\n🔍 View on PolygonScan: https://mumbai.polygonscan.com/address/${contractAddress}`
    );
  } else if (hre.network.name === 'sepolia') {
    console.log(`\n🔍 View on Etherscan: https://sepolia.etherscan.io/address/${contractAddress}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Deployment failed:', error);
    process.exit(1);
  });

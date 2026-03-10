// scripts/deployPaymaster.js
import pkg from 'hardhat';
const { ethers } = pkg;

async function main() {
  console.log('🚀 Deploying Updated BelrosePaymaster...\n');

  const [deployer] = await ethers.getSigners();
  console.log('🔑 Deploying with account:', deployer.address);

  // ============ Configuration ============
  const ENTRYPOINT_ADDRESS = '0x0000000071727De22E5E9d8BAf0edAc6f37da032'; // v0.7 canonical

  const VERIFYING_SIGNER = process.env.PAYMASTER_SIGNER_ADDRESS;
  const MAX_COST_PER_USEROP = ethers.parseEther('0.01');
  const INITIAL_DEPOSIT = ethers.parseEther('0.05');

  if (!VERIFYING_SIGNER) {
    throw new Error('❌ Missing PAYMASTER_SIGNER_ADDRESS in .env');
  }

  // ============ Deploy ============
  const BelrosePaymaster = await ethers.getContractFactory('BelrosePaymaster');

  console.log('⏳ Deploying contract...');
  const paymaster = await BelrosePaymaster.deploy(
    ENTRYPOINT_ADDRESS,
    VERIFYING_SIGNER,
    MAX_COST_PER_USEROP
  );

  await paymaster.waitForDeployment();
  const paymasterAddress = await paymaster.getAddress();

  // ============ Fund ============
  console.log('⏳ Depositing ETH to EntryPoint...');
  // This calls the deposit() function on your contract, which forwards to EntryPoint
  const depositTx = await paymaster.deposit({ value: INITIAL_DEPOSIT });
  await depositTx.wait();

  console.log(`✅ Deployed to: ${paymasterAddress}`);
  console.log(`✅ Funded with: ${ethers.formatEther(INITIAL_DEPOSIT)} ETH`);

  // ============ PowerShell Verification String ============
  console.log('\n📝 COPY THIS TO VERIFY (PowerShell Ready):');
  // .toString() ensures BigInts don't print with an 'n' (e.g. 1000n) which breaks CLI
  console.log(`npx hardhat verify --network sepolia ${paymasterAddress} \`
  "${ENTRYPOINT_ADDRESS}" \`
  "${VERIFYING_SIGNER}" \`
  "${MAX_COST_PER_USEROP.toString()}"`);
}

main().catch(error => {
  console.error('❌ Deployment failed:', error);
  process.exitCode = 1;
});

// scripts/migrateMembers.js
// Reads users from Firestore and registers them on the new MemberRoleManager contract

import hre from 'hardhat';
import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// ============ Configuration ============

const MEMBER_ROLE_MANAGER_ADDRESS = '0x0FdDcE7EdebD73C6d1A11983bb6a759132543aaD';

// Path to your Firebase service account key
const SERVICE_ACCOUNT_PATH =
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './.firebaseServiceAccountKey.json';

// ============ Setup ============

async function initializeFirebase() {
  if (admin.apps.length === 0) {
    const serviceAccount = JSON.parse(readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }
  return admin.firestore();
}

async function main() {
  console.log('🚀 Starting member migration to new contract...\n');

  // Validate config
  if (!MEMBER_ROLE_MANAGER_ADDRESS) {
    throw new Error('❌ MEMBER_ROLE_MANAGER_ADDRESS not set in .env');
  }

  // Get deployer (admin wallet)
  const [deployer] = await hre.ethers.getSigners();
  console.log('🔑 Admin wallet:', deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log('💰 Balance:', hre.ethers.formatEther(balance), 'ETH\n');

  // Connect to contract
  const contract = await hre.ethers.getContractAt('MemberRoleManager', MEMBER_ROLE_MANAGER_ADDRESS);
  console.log('📄 Contract:', MEMBER_ROLE_MANAGER_ADDRESS);

  // Verify we're the admin
  const contractAdmin = await contract.admin();
  if (contractAdmin.toLowerCase() !== deployer.address.toLowerCase()) {
    throw new Error(`❌ Deployer is not contract admin. Admin is: ${contractAdmin}`);
  }
  console.log('✅ Confirmed as contract admin\n');

  // Initialize Firestore
  console.log('🔥 Connecting to Firestore...');
  const db = await initializeFirebase();

  // Fetch users with wallets
  console.log('📥 Fetching users with wallets...\n');
  const usersSnapshot = await db.collection('users').get();

  const usersToMigrate = [];
  usersSnapshot.forEach(doc => {
    const data = doc.data();
    const walletAddress = data.wallet?.address;

    if (walletAddress) {
      usersToMigrate.push({
        firestoreId: doc.id,
        walletAddress: walletAddress,
        email: data.email || 'N/A',
      });
    }
  });

  console.log(`Found ${usersToMigrate.length} users with wallets\n`);

  if (usersToMigrate.length === 0) {
    console.log('✅ No users to migrate');
    return;
  }

  // Display users to migrate
  console.log('--- Users to migrate ---');
  usersToMigrate.forEach((user, i) => {
    console.log(`${i + 1}. ${user.email} - ${user.walletAddress}`);
  });
  console.log('');

  // Migrate each user
  console.log('--- Starting migration ---\n');

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (const user of usersToMigrate) {
    const userIdHash = hre.ethers.id(user.firestoreId); // keccak256 of Firebase UID

    try {
      // Check if already registered
      const existingMember = await contract.wallets(user.walletAddress);

      if (existingMember.userIdHash !== hre.ethers.ZeroHash) {
        console.log(`⏭️  SKIP: ${user.email} - Already registered`);
        skipCount++;
        continue;
      }

      // Register member
      console.log(`📝 Registering: ${user.email} (${user.walletAddress})`);
      const tx = await contract.addMember(user.walletAddress, userIdHash);
      console.log(`   ⏳ TX: ${tx.hash}`);

      const receipt = await tx.wait();
      console.log(`   ✅ Confirmed in block: ${receipt.blockNumber}`);

      // Update Firestore with blockchain info (matches registerMemberOnChain structure)
      await db
        .collection('users')
        .doc(user.firestoreId)
        .update({
          blockchainMember: {
            registered: true,
            walletAddress: user.walletAddress,
            userIdHash: userIdHash,
            txHash: tx.hash,
            blockNumber: receipt?.blockNumber,
            registeredAt: admin.firestore.Timestamp.now(),
            status: 'Active',
            contractAddress: MEMBER_ROLE_MANAGER_ADDRESS,
            migratedFromScript: true,
          },
        });

      successCount++;
    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}`);
      errorCount++;
    }

    console.log('');
  }

  // Summary
  console.log('========================================');
  console.log('🎉 MIGRATION COMPLETE');
  console.log('========================================');
  console.log(`✅ Registered: ${successCount}`);
  console.log(`⏭️  Skipped:    ${skipCount}`);
  console.log(`❌ Errors:     ${errorCount}`);
  console.log(`📊 Total:      ${usersToMigrate.length}`);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });

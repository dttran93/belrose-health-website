// functions/scripts/migrateUsersToBaseSepolia.ts
//
// One-time migration script: reads all users from Firestore who have wallets
//  then registers them on the new baseSepolia MemberRoleManager contract via
//  addMemberBatch, and updates Firestore.
//
// Usage:
//   cd functions
//   npx tsx scripts/migrateUsersToBaseSepolia.ts            # dry run (no writes)
//   npx tsx scripts/migrateUsersToBaseSepolia.ts --execute  # real run

import * as admin from 'firebase-admin';
import * as path from 'path';
import { ethers } from 'ethers';
import 'dotenv/config';

// ── Firebase init ─────────────────────────────────────────────────────────────

const serviceAccount = require(path.join(__dirname, '..', '..', '.firebaseServiceAccountKey.json'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// ── Config ────────────────────────────────────────────────────────────────────

// TODO: After deploying to baseSepolia, paste your new proxy address here
const BASE_SEPOLIA_RPC = 'https://sepolia.base.org';
const MEMBER_ROLE_MANAGER_ADDRESS = '0x61CcF57C332D32c4d906ac64674BBA4E10CCB07B';
const ADMIN_PRIVATE_KEY = 'process.env.ADMIN_WALLET_PRIVATE_KEY';

const DRY_RUN = !process.argv.includes('--execute');

// ── Minimal ABI — only what we need ──────────────────────────────────────────

const ABI = [
  'function addMemberBatch(address[] calldata walletAddresses, bytes32 userIdHash) external',
  // Used to check if a wallet is already registered before calling
  'function wallets(address wallet) external view returns (bytes32 userIdHash, bool isWalletActive)',
];

// ── Types ─────────────────────────────────────────────────────────────────────

interface UserWalletData {
  userId: string;
  userIdHash: string;
  wallets: { address: string; type: 'eoa' | 'smartAccount' }[];
  oldOnChainIdentity: any; // archived for audit
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getAdminContract() {
  if (!ADMIN_PRIVATE_KEY) throw new Error('ADMIN_WALLET_PRIVATE_KEY env var not set');
  const provider = new ethers.JsonRpcProvider(BASE_SEPOLIA_RPC);
  const signer = new ethers.Wallet(ADMIN_PRIVATE_KEY, provider);
  return new ethers.Contract(MEMBER_ROLE_MANAGER_ADDRESS, ABI, signer);
}

function buildBlockchainRef(txHash: string, blockNumber: number) {
  return {
    txHash,
    blockNumber,
    network: 'baseSepolia',
    contractAddress: MEMBER_ROLE_MANAGER_ADDRESS,
  };
}

// ── Step 1: Fetch users from Firestore ───────────────────────────────────────
// Targets users who have a Sepolia onChainIdentity — we're migrating them to
// baseSepolia and overwriting that field with the new registration.

async function fetchUsersToMigrate(): Promise<UserWalletData[]> {
  console.log('\n📦 Fetching users from Firestore...');

  const snapshot = await db.collection('users').get();
  const toMigrate: UserWalletData[] = [];

  for (const doc of snapshot.docs) {
    const data = doc.data();

    // Skip users with no wallet — nothing to migrate
    if (!data.wallet?.address) {
      console.log(`  ⏭️  ${doc.id}: no wallet, skipping`);
      continue;
    }

    const walletList: UserWalletData['wallets'] = [{ address: data.wallet.address, type: 'eoa' }];

    if (data.wallet.smartAccountAddress) {
      walletList.push({ address: data.wallet.smartAccountAddress, type: 'smartAccount' });
    }

    toMigrate.push({
      userId: doc.id,
      userIdHash: ethers.id(doc.id),
      wallets: walletList,
      oldOnChainIdentity: data.onChainIdentity,
    });
  }

  console.log(`\n🔍 Found ${toMigrate.length} user(s) to migrate`);
  return toMigrate;
}

// ── Step 2: Register on-chain + update Firestore ─────────────────────────────

async function migrateUser(user: UserWalletData, contract: ethers.Contract) {
  const { userId, userIdHash, wallets } = user;
  const walletAddresses = wallets.map(w => w.address);

  console.log(`\n👤 User: ${userId}`);
  console.log(`   userIdHash: ${userIdHash}`);
  console.log(`   Wallets: ${walletAddresses.join(', ')}`);

  if (DRY_RUN) {
    console.log(
      `   🧪 DRY RUN — would call addMemberBatch(${JSON.stringify(walletAddresses)}, ${userIdHash})`
    );
    return { status: 'dry-run', txHash: null, blockNumber: null };
  }

  // Check if already registered on baseSepolia — handles re-runs and any users
  // who were manually registered before this script ran (no try/catch: if the
  // RPC call fails we want to know about it and abort, not silently skip)
  const onChainData = await contract.wallets(walletAddresses[0]);
  if (onChainData.userIdHash !== ethers.ZeroHash) {
    console.log(`   ⚠️  Already registered on baseSepolia — skipping tx, updating Firestore only`);
    return { status: 'already-on-chain', txHash: null, blockNumber: null };
  }

  // Send the transaction
  const tx = await contract.addMemberBatch(walletAddresses, userIdHash);
  console.log(`   ⛓️  Tx sent: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`   ✅ Confirmed in block ${receipt.blockNumber}`);

  return { status: 'registered', txHash: tx.hash, blockNumber: receipt.blockNumber };
}

async function updateFirestore(
  userId: string,
  userIdHash: string,
  wallets: UserWalletData['wallets'],
  txHash: string,
  blockNumber: number,
  oldOnChainIdentity: any
) {
  const blockchainRef = buildBlockchainRef(txHash, blockNumber);
  const now = admin.firestore.Timestamp.now();

  const linkedWallets = wallets.map(w => ({
    address: w.address.toLowerCase(),
    type: w.type,
    isWalletActive: true,
    registeredAt: now,
    blockchainRef,
  }));

  await db
    .collection('users')
    .doc(userId)
    .update({
      // Overwrite with baseSepolia registration
      onChainIdentity: {
        userIdHash,
        status: 'Active',
        linkedWallets,
        registeredAt: now,
        blockchainRef,
      },
      // Archive the old Sepolia registration for audit purposes
      onChainIdentity_sepolia: oldOnChainIdentity,
    });

  console.log(`   📝 Firestore updated for ${userId}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('   Belrose: Migrate Users → baseSepolia             ');
  console.log(`   Mode: ${DRY_RUN ? '🧪 DRY RUN (pass --execute to write)' : '🚀 LIVE'}`);
  console.log('═══════════════════════════════════════════════════');

  const users = await fetchUsersToMigrate();
  if (users.length === 0) {
    console.log('\n✅ No users to migrate. Exiting.');
    process.exit(0);
  }

  const contract = DRY_RUN ? null : getAdminContract();

  const results = { success: 0, skipped: 0, failed: 0 };

  for (const user of users) {
    try {
      if (DRY_RUN) {
        // In dry run mode, just log what would happen
        await migrateUser(user, null as any);
        results.skipped++;
        continue;
      }

      const { status, txHash, blockNumber } = await migrateUser(user, contract!);

      if (status === 'registered' && txHash && blockNumber) {
        await updateFirestore(
          user.userId,
          user.userIdHash,
          user.wallets,
          txHash,
          blockNumber,
          user.oldOnChainIdentity
        );
        results.success++;
      } else if (status === 'already-on-chain') {
        // Already registered on baseSepolia — nothing to do.
        console.log(`   ✅ Already on baseSepolia, Firestore untouched`);
        results.skipped++;
      } else {
        results.skipped++;
      }
    } catch (err) {
      console.error(`   ❌ Failed for ${user.userId}:`, err);
      results.failed++;
      // Continue with the next user rather than aborting
    }
  }

  console.log('\n═══════════════════════════════════════════════════');
  console.log(`   ✅ Registered:  ${results.success}`);
  console.log(`   ⏭️  Skipped:     ${results.skipped}`);
  console.log(`   ❌ Failed:      ${results.failed}`);
  console.log('═══════════════════════════════════════════════════\n');

  process.exit(results.failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

// functions/scripts/reregisterUsers.ts
//
// Re-registers all Firestore users on a freshly deployed MemberRoleManager contract.
// Use this any time the MRM proxy address changes (e.g. storage-breaking redeploy in dev).
//
// Usage:
//   cd functions
//   npx tsx scripts/reregisterUsers.ts             # dry run — no writes
//   npx tsx scripts/reregisterUsers.ts --execute   # live run

import * as admin from 'firebase-admin';
import * as path from 'path';
import { ethers } from 'ethers';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '..', '..', '.env.local') });

// ── Firebase init ─────────────────────────────────────────────────────────────

const serviceAccount = require(path.join(__dirname, '..', '..', '.firebaseServiceAccountKey.json'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// ── Config ────────────────────────────────────────────────────────────────────

const RPC_URL      = 'https://sepolia.base.org';
const MRM_PROXY    = '0x61CcF57C332D32c4d906ac64674BBA4E10CCB07B';
// Admin/deployer wallet — reuses the same PRIVATE_KEY already in root .env.local
// (same key used to deploy the contracts), rather than duplicating it elsewhere.
const PRIVATE_KEY  = process.env.PRIVATE_KEY;

const DRY_RUN = !process.argv.includes('--execute');

// ── Minimal ABI ───────────────────────────────────────────────────────────────

const ABI = [
  'function addMemberBatch(address[] calldata walletAddresses, bytes32 userIdHash) external',
  'function wallets(address wallet) external view returns (bytes32 userIdHash, bool isWalletActive)',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function getContract() {
  if (!PRIVATE_KEY) throw new Error('ADMIN_WALLET_PRIVATE_KEY not set in environment');
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const signer   = new ethers.Wallet(PRIVATE_KEY, provider);
  return new ethers.Contract(MRM_PROXY, ABI, signer);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('   Belrose: Re-register Users on new MRM           ');
  console.log(`   Contract: ${MRM_PROXY}`);
  console.log(`   Mode:     ${DRY_RUN ? '🧪 DRY RUN (pass --execute to write)' : '🚀 LIVE'}`);
  console.log('═══════════════════════════════════════════════════\n');

  const contract = DRY_RUN ? null : getContract();

  const snapshot = await db.collection('users').get();
  console.log(`📦 Found ${snapshot.size} user documents\n`);

  const results = { registered: 0, skipped: 0, failed: 0 };

  for (const userDoc of snapshot.docs) {
    const uid  = userDoc.id;
    const data = userDoc.data();

    if (!data.wallet?.address) {
      console.log(`⏭️  ${uid}: no wallet — skipping`);
      results.skipped++;
      continue;
    }

    const userIdHash     = ethers.id(uid); // keccak256 of Firebase UID
    const walletAddresses: string[] = [data.wallet.address];
    if (data.wallet.smartAccountAddress) {
      walletAddresses.push(data.wallet.smartAccountAddress);
    }

    console.log(`👤 ${uid}`);
    console.log(`   userIdHash: ${userIdHash}`);
    console.log(`   Wallets:    ${walletAddresses.join(', ')}`);

    if (DRY_RUN) {
      console.log(`   🧪 would call addMemberBatch([${walletAddresses.join(', ')}], ${userIdHash})\n`);
      results.skipped++;
      continue;
    }

    try {
      // Skip if already registered on this contract
      const onChainData = await contract!.wallets(walletAddresses[0]);
      if (onChainData.userIdHash !== ethers.ZeroHash) {
        console.log(`   ⚠️  Already registered — skipping tx\n`);
        results.skipped++;
        continue;
      }

      const tx      = await contract!.addMemberBatch(walletAddresses, userIdHash);
      console.log(`   ⛓️  Tx: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`   ✅ Block ${receipt.blockNumber}`);

      // Update Firestore — shape must match BelroseUserProfile.onChainIdentity in src/types/core.ts
      const now = admin.firestore.Timestamp.now();
      const blockchainRef = {
        txHash:          tx.hash,
        blockNumber:     receipt.blockNumber,
        network:         'baseSepolia',
        contractAddress: MRM_PROXY,
      };
      await userDoc.ref.update({
        onChainIdentity: {
          userIdHash,
          onChainStatus: [{ status: 'Active', statusUpdatedAt: now, statusBlockchainRef: blockchainRef }],
          linkedWallets: walletAddresses.map((address, i) => ({
            address: address.toLowerCase(),
            type:    i === 0 ? 'eoa' : 'smart-account',
            isWalletActive: true,
            linkedAt: now,
            blockchainRef,
          })),
        },
      });

      console.log(`   📝 Firestore updated\n`);
      results.registered++;
    } catch (err) {
      console.error(`   ❌ Failed:`, err);
      results.failed++;
    }
  }

  console.log('═══════════════════════════════════════════════════');
  console.log(`   ✅ Registered: ${results.registered}`);
  console.log(`   ⏭️  Skipped:    ${results.skipped}`);
  console.log(`   ❌ Failed:     ${results.failed}`);
  console.log('═══════════════════════════════════════════════════\n');

  process.exit(results.failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});

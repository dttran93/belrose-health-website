// functions/scripts/migrateOnChainStatus.ts
//
// One-time migration: moves the flat onChainIdentity.status / statusUpdatedAt /
// statusBlockchainRef fields into the new onChainStatus audit-log array.
//
// Usage:
//   cd functions
//   npx tsx scripts/migrateOnChainStatus.ts            # dry run (no writes)
//   npx tsx scripts/migrateOnChainStatus.ts --execute  # real run

import * as admin from 'firebase-admin';
import * as path from 'path';

// ── Firebase init ─────────────────────────────────────────────────────────────

const serviceAccount = require(path.join(__dirname, '..', '..', '.firebaseServiceAccountKey.json'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// ── Config ────────────────────────────────────────────────────────────────────

const DRY_RUN = !process.argv.includes('--execute');

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('   Belrose: Migrate onChainIdentity → onChainStatus array  ');
  console.log(`   Mode: ${DRY_RUN ? '🧪 DRY RUN (pass --execute to write)' : '🚀 LIVE'}`);
  console.log('═══════════════════════════════════════════════════════════');

  const snapshot = await db.collection('users').get();
  console.log(`\n📦 Found ${snapshot.size} total user(s)\n`);

  const results = { migrated: 0, cleaned: 0, skipped: 0, failed: 0 };

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const identity = data.onChainIdentity;

    // No onChainIdentity at all — nothing to do
    if (!identity) {
      results.skipped++;
      continue;
    }

    const hasOldFields =
      identity.status !== undefined ||
      identity.statusUpdatedAt !== undefined ||
      identity.statusBlockchainRef !== undefined;

    const hasNewArray = Array.isArray(identity.onChainStatus);

    if (!hasOldFields && hasNewArray) {
      // Already fully migrated
      results.skipped++;
      continue;
    }

    if (hasNewArray && hasOldFields) {
      // Array already populated by newer code but old flat fields still linger — just clean up
      console.log(`🧹 Clean stale flat fields: ${doc.id} (${identity.status})`);
      if (!DRY_RUN) {
        await doc.ref.update({
          'onChainIdentity.status': admin.firestore.FieldValue.delete(),
          'onChainIdentity.statusUpdatedAt': admin.firestore.FieldValue.delete(),
          'onChainIdentity.statusBlockchainRef': admin.firestore.FieldValue.delete(),
        });
      }
      results.cleaned++;
      continue;
    }

    if (!identity.status) {
      // Has identity object but no status at all — skip
      results.skipped++;
      continue;
    }

    // Full migration: build the onChainStatus array from the flat fields
    const statusEntry: Record<string, any> = {
      status: identity.status,
    };
    if (identity.statusUpdatedAt !== undefined) {
      statusEntry.statusUpdatedAt = identity.statusUpdatedAt;
    }
    if (identity.statusBlockchainRef !== undefined) {
      statusEntry.statusBlockchainRef = identity.statusBlockchainRef;
    }

    console.log(`🔄 Migrate: ${doc.id}  status=${identity.status}`);

    if (!DRY_RUN) {
      await doc.ref.update({
        'onChainIdentity.onChainStatus': [statusEntry],
        'onChainIdentity.status': admin.firestore.FieldValue.delete(),
        'onChainIdentity.statusUpdatedAt': admin.firestore.FieldValue.delete(),
        'onChainIdentity.statusBlockchainRef': admin.firestore.FieldValue.delete(),
      });
    }

    results.migrated++;
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`   🔄 Migrated:       ${results.migrated}`);
  console.log(`   🧹 Cleaned up:     ${results.cleaned}`);
  console.log(`   ⏭️  Skipped:        ${results.skipped}`);
  console.log(`   ❌ Failed:         ${results.failed}`);
  if (DRY_RUN) {
    console.log('\n   ℹ️  Dry run — no writes made. Pass --execute to apply.');
  }
  console.log('═══════════════════════════════════════════════════════════\n');

  process.exit(results.failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

// scripts/ingestNHSEngland.ts
//
// Ingests NHS England healthcare providers from the Directory of Healthcare
// Services (DoHS) API v3 into the `providers_england` Firestore collection.
//
// ─── IMPORTANT: SPECULATIVE API SHAPE ────────────────────────────────────────
// This script is written against the DoHS v3 OAS spec at:
//   https://digital.nhs.uk/restapi/oas/474338
//
// The actual response shape may differ once you have API access and test
// against real data. If it does:
//   1. Update ONLY the parsing logic in mapDoHSOrganisation()
//   2. The FirestoreProviderDoc shape and everything downstream is unchanged
//
// This is the correct place to absorb all API-specific messiness.
// NHSEnglandDirectory.ts never needs to change regardless of API shape.
// ─────────────────────────────────────────────────────────────────────────────
//
// Usage:
//   DOHS_API_KEY=<your_key> ts-node scripts/ingestNHSEngland.ts
//
// Optional flags:
//   --type GP          Only ingest GP practices (faster for testing)
//   --limit 100        Stop after 100 orgs (for dry runs)
//   --dry-run          Parse and log but don't write to Firestore
//
// Prerequisites:
//   1. Register for a DoHS API key at: https://onboarding.prod.api.platform.nhs.uk
//   2. Place your Firebase service account key at scripts/serviceAccountKey.json
//   3. npm install node-fetch @types/node-fetch (if not already present)
//
// Estimated run time: ~10-15 minutes for ~100k organisations.
// Re-running is safe — uses Firestore set() which upserts.

import * as admin from 'firebase-admin';
import * as path from 'path';

// ── Config ────────────────────────────────────────────────────────────────────

const DOHS_BASE_URL = 'https://api.service.nhs.uk/service-search-api';
const API_VERSION = '?api-version=3';
const PAGE_SIZE = 100; // DoHS max page size
const BATCH_SIZE = 500; // Firestore max batch size
const RATE_LIMIT_MS = 100; // Delay between API pages to avoid rate limiting

// DoHS OrganisationTypeId values we care about.
// Full list: https://digital.nhs.uk/developer/api-catalogue/directory-of-healthcare-services/guide-to-search-identifiers-and-service-codes
const ORG_TYPE_MAP: Record<string, FirestoreProviderDoc['type']> = {
  GP: 'gp_practice',
  HOS: 'hospital',
  CLI: 'clinic',
  // Add more as needed
};

// Parent organisation type mappings from DoHS relationship types
const PARENT_TYPE_MAP: Record<string, FirestoreParentRef['type']> = {
  PCN: 'Primary Care Network',
  ICB: 'Integrated Care Board',
  TRUST: 'Trust',
  NHS_ENG: 'NHS England',
};

// ── Firebase admin init ───────────────────────────────────────────────────────

const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// ── Types mirroring NHSEnglandDirectory.ts ────────────────────────────────────
// Duplicated here intentionally — the script is standalone and shouldn't
// import from the frontend src/ tree. Keep in sync with NHSEnglandDirectory.ts.

interface FirestoreProviderDoc {
  name: string;
  type: 'gp_practice' | 'hospital' | 'clinic' | 'other';
  status: 'active' | 'closed';
  email: string | null;
  phone: string | null;
  addressLines: string[];
  postCode: string;
  countryCode: string;
  parentInstitutions: FirestoreParentRef[];
  searchTokens: string[];
  source: 'nhs_england';
  ingestedAt: admin.firestore.FieldValue;
  lastUpdatedAt?: string;
}

interface FirestoreParentRef {
  id: string;
  name: string;
  type: 'Primary Care Network' | 'Integrated Care Board' | 'Trust' | 'NHS England' | 'Other';
  level: number;
}

// ── Speculative DoHS v3 API response shape ────────────────────────────────────
// Based on the OAS spec. WILL LIKELY NEED ADJUSTING once you have real access.
// Update mapDoHSOrganisation() below if the actual shape differs.

interface DoHSOrganisation {
  ODSCode: string;
  OrganisationName: string;
  OrganisationTypeId: string;
  OrganisationStatus: string; // "Visible" | "Hidden" | "Closed"
  Address1?: string;
  Address2?: string;
  Address3?: string;
  City?: string;
  County?: string;
  Postcode?: string;
  // Contacts is an array in DoHS — each entry has a ContactType and ContactValue
  Contacts?: DoHSContact[];
  // Parent relationships
  Relationships?: DoHSRelationship[];
  // When the record was last updated in DoHS
  LastUpdatedDate?: string;
}

interface DoHSContact {
  ContactType: string; // "Tel" | "Email" | "Web" | etc.
  ContactValue: string;
  ContactAvailabilityType?: string; // "Public" | "Non-Public"
}

interface DoHSRelationship {
  RelationshipType: string; // "PCT" | "ICB" | "PCN" | etc.
  RelatedODSCode: string;
  RelatedOrganisationName: string;
  Status: string;
}

interface DoHSResponse {
  value: DoHSOrganisation[];
  '@odata.count'?: number;
  '@odata.nextLink'?: string;
}

// ── Tokenisation (must match NHSEnglandDirectory.ts exactly) ─────────────────

const STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'nhs',
  'dr',
  'st',
  'mr',
  'mrs',
  'medical',
  'centre',
  'center',
  'practice',
  'surgery',
  'health',
  'care',
  'clinic',
  'road',
  'street',
  'lane',
  'of',
  'at',
  'in',
  'on',
  'to',
]);

function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(t => t.length >= 2)
    .filter(t => !STOP_WORDS.has(t));
}

// ── API shape → Firestore shape ───────────────────────────────────────────────
// THIS IS THE ONLY FUNCTION THAT KNOWS ABOUT THE DoHS API SHAPE.
// Update this if the actual API response differs from the OAS spec.

function mapDoHSOrganisation(org: DoHSOrganisation): {
  id: string;
  doc: FirestoreProviderDoc;
} | null {
  // Skip organisations without an ODS code or name
  if (!org.ODSCode || !org.OrganisationName) return null;

  // Map status — anything not explicitly "Visible" is treated as closed
  const status: FirestoreProviderDoc['status'] =
    org.OrganisationStatus === 'Visible' ? 'active' : 'closed';

  // Map organisation type
  const type: FirestoreProviderDoc['type'] = ORG_TYPE_MAP[org.OrganisationTypeId] ?? 'other';

  // Build address lines — filter out empty strings
  const addressLines = [org.Address1, org.Address2, org.Address3, org.City, org.County].filter(
    (line): line is string => !!line?.trim()
  );

  const postCode = org.Postcode?.trim() ?? '';

  // Extract contacts
  // NOTE: DoHS has "Public" and "Non-Public" email types.
  // We store the public email only — the non-public one requires DoS onboarding.
  const publicEmail =
    org.Contacts?.find(c => c.ContactType === 'Email' && c.ContactAvailabilityType !== 'Non-Public')
      ?.ContactValue ?? null;

  const phone = org.Contacts?.find(c => c.ContactType === 'Tel')?.ContactValue ?? null;

  // Map parent relationships
  // Level 1 = PCN (immediate parent for GPs), Level 2 = ICB
  const parentInstitutions: FirestoreParentRef[] = (org.Relationships ?? [])
    .filter(r => r.Status === 'Active' && PARENT_TYPE_MAP[r.RelationshipType])
    .map(r => ({
      id: r.RelatedODSCode,
      name: r.RelatedOrganisationName,
      type: PARENT_TYPE_MAP[r.RelationshipType] ?? 'Other',
      level: r.RelationshipType === 'PCN' ? 1 : 2,
    }))
    // Sort by level so immediate parent comes first
    .sort((a, b) => a.level - b.level);

  // Build search tokens from name + postcode
  const searchTokens = [
    ...tokenise(org.OrganisationName),
    ...tokenise(postCode),
    // Raw postcode district prefix for short queries like "N1"
    postCode.toLowerCase().replace(/\s+/g, '').slice(0, 4),
  ].filter((t, i, arr) => t.length >= 2 && arr.indexOf(t) === i); // dedupe

  const doc: FirestoreProviderDoc = {
    name: org.OrganisationName,
    type,
    status,
    email: publicEmail,
    phone,
    addressLines,
    postCode,
    countryCode: 'GB',
    parentInstitutions,
    searchTokens,
    source: 'nhs_england',
    ingestedAt: admin.firestore.FieldValue.serverTimestamp(),
    lastUpdatedAt: org.LastUpdatedDate,
  };

  return { id: org.ODSCode, doc };
}

// ── DoHS API fetching ─────────────────────────────────────────────────────────

async function fetchPage(url: string, apiKey: string): Promise<DoHSResponse> {
  const res = await fetch(url, {
    headers: {
      apikey: apiKey,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`DoHS API error: ${res.status} ${res.statusText} — ${await res.text()}`);
  }

  return res.json() as Promise<DoHSResponse>;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function ingest() {
  const apiKey = process.env.DOHS_API_KEY;
  if (!apiKey) {
    console.error('❌ DOHS_API_KEY environment variable not set');
    process.exit(1);
  }

  // Parse CLI flags
  const args = process.argv.slice(2);
  const typeFlag = args.find((_, i) => args[i - 1] === '--type');
  const limitFlag = parseInt(args.find((_, i) => args[i - 1] === '--limit') ?? '0');
  const dryRun = args.includes('--dry-run');

  if (dryRun) console.log('🔍 DRY RUN — no Firestore writes will be made');

  // Build initial URL
  // Filter to organisations we care about and select only needed fields
  const typeFilter = typeFlag ? `&$filter=OrganisationTypeId eq '${typeFlag}'` : '';
  const select = [
    'ODSCode',
    'OrganisationName',
    'OrganisationTypeId',
    'OrganisationStatus',
    'Address1',
    'Address2',
    'Address3',
    'City',
    'County',
    'Postcode',
    'Contacts',
    'Relationships',
    'LastUpdatedDate',
  ].join(',');

  let nextUrl: string | null =
    `${DOHS_BASE_URL}${API_VERSION}&$top=${PAGE_SIZE}&$select=${select}${typeFilter}`;

  let batch = db.batch();
  let batchCount = 0;
  let totalWritten = 0;
  let totalSkipped = 0;
  let pageNumber = 0;

  console.log('🏥 Starting NHS England provider ingestion...');

  while (nextUrl) {
    pageNumber++;

    let response: DoHSResponse;
    try {
      response = await fetchPage(nextUrl, apiKey);
    } catch (err: any) {
      console.error(`❌ Failed to fetch page ${pageNumber}:`, err.message);
      // Commit what we have so far before exiting
      if (batchCount > 0 && !dryRun) await batch.commit();
      process.exit(1);
    }

    for (const org of response.value) {
      const mapped = mapDoHSOrganisation(org);

      if (!mapped) {
        totalSkipped++;
        continue;
      }

      if (!dryRun) {
        const docRef = db.collection('providers_england').doc(mapped.id);
        batch.set(docRef, mapped.doc);
        batchCount++;

        if (batchCount === BATCH_SIZE) {
          await batch.commit();
          console.log(`  ✅ Committed batch — ${totalWritten + batchCount} written so far`);
          batch = db.batch();
          batchCount = 0;
        }
      } else {
        // Dry run: just log the first few to verify mapping
        if (totalWritten < 3) {
          console.log('\n📄 Sample mapped document:');
          console.log(JSON.stringify({ id: mapped.id, ...mapped.doc }, null, 2));
        }
      }

      totalWritten++;

      if (limitFlag && totalWritten >= limitFlag) {
        console.log(`\n🛑 Reached --limit ${limitFlag}`);
        nextUrl = null;
        break;
      }
    }

    // Pagination — DoHS uses @odata.nextLink for cursor-based pagination
    nextUrl = response['@odata.nextLink'] ?? null;

    // Brief pause to avoid hammering the API
    if (nextUrl) await new Promise(r => setTimeout(r, RATE_LIMIT_MS));
  }

  // Commit final partial batch
  if (batchCount > 0 && !dryRun) {
    await batch.commit();
  }

  console.log(`\n✅ Ingestion complete`);
  console.log(`   Written:  ${totalWritten}`);
  console.log(`   Skipped:  ${totalSkipped} (no ODS code, no name, or unmappable)`);
  if (dryRun) console.log('   (DRY RUN — nothing was written to Firestore)');
  console.log('\n   Run monthly to keep the dataset fresh.');
  console.log('   Or set up the scheduledSyncNHSEngland Cloud Function for automatic updates.');

  process.exit(0);
}

ingest().catch(err => {
  console.error('❌ Ingestion failed:', err);
  process.exit(1);
});

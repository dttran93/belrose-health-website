// functions/scripts/seedNHSEnglandTest.ts
//
// Seeds the `providers_england` Firestore collection with 20 real NHS GP
// practices for local development and testing.
//
// Geocodes each practice's postcode via api.postcodes.io (free, no key needed)
// and stores lat/lng flat on the document alongside the address fields.
//
// Usage:
//   cd functions
//   npx tsx scripts/seedNHSEnglandTest.ts
//
// Safe to re-run — uses set() which upserts.

import * as admin from 'firebase-admin';
import * as path from 'path';

// ── Firebase init ─────────────────────────────────────────────────────────────

const serviceAccount = require(path.join(__dirname, '..', '..', '.firebaseServiceAccountKey.json'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// ── Types (mirrored from NHSEnglandDirectory.ts) ──────────────────────────────

interface FirestoreProviderDoc {
  name: string;
  type: 'gp_practice' | 'hospital' | 'clinic' | 'other';
  status: 'active' | 'closed';
  email: string | null;
  phone: string | null;
  addressLines: string[];
  postCode: string;
  countryCode: string;
  lat: number | null; // WGS84 latitude — null if geocoding failed
  lng: number | null; // WGS84 longitude — null if geocoding failed
  parentInstitutions: FirestoreParentRef[];
  searchTokens: string[];
  source: 'nhs_england';
  ingestedAt: admin.firestore.FieldValue;
}

interface FirestoreParentRef {
  id: string;
  name: string;
  type: 'Primary Care Network' | 'Integrated Care Board' | 'Trust' | 'NHS England' | 'Other';
  level: number;
}

// ── Tokenisation (must match NHSEnglandDirectory.ts) ──────────────────────────

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

function buildSearchTokens(name: string, postCode: string): string[] {
  return [
    ...tokenise(name),
    ...tokenise(postCode),
    postCode.toLowerCase().replace(/\s+/g, '').slice(0, 4),
  ].filter((t, i, arr) => t.length >= 2 && arr.indexOf(t) === i);
}

// ── Geocoding via postcodes.io ────────────────────────────────────────────────

interface PostcodesIOResult {
  latitude: number;
  longitude: number;
}

/**
 * Bulk geocode an array of postcodes using the postcodes.io bulk endpoint.
 * Returns a map of postcode → {lat, lng} | null.
 * Free, no API key required, max 100 postcodes per request.
 */
async function geocodePostcodes(
  postcodes: string[]
): Promise<Map<string, { lat: number; lng: number } | null>> {
  const result = new Map<string, { lat: number; lng: number } | null>();

  try {
    const res = await fetch('https://api.postcodes.io/postcodes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postcodes }),
    });

    const data = (await res.json()) as {
      result: Array<{
        query: string;
        result: PostcodesIOResult | null;
      }>;
    };

    for (const item of data.result) {
      if (item.result) {
        result.set(item.query.trim().toUpperCase(), {
          lat: item.result.latitude,
          lng: item.result.longitude,
        });
      } else {
        result.set(item.query.trim().toUpperCase(), null);
      }
    }
  } catch (err) {
    console.warn('⚠️  Geocoding failed, coordinates will be null:', err);
  }

  return result;
}

// ── Practice data ─────────────────────────────────────────────────────────────

interface PracticeInput {
  id: string;
  name: string;
  addressLines: string[];
  postCode: string;
  phone: string;
  icbCode: string;
  icbName: string;
  status?: 'active' | 'closed';
}

const PRACTICES: PracticeInput[] = [
  // ── Your real test cases ─────────────────────────────────────────────────
  {
    id: 'E87009',
    name: 'The Garway Medical Practice',
    addressLines: ['Pickering House', 'Hallfield Estate', 'London'],
    postCode: 'W2 6HF',
    phone: '020 76162900',
    icbCode: 'Z9B2Z',
    icbName: 'NHS North West London ICB',
  },
  {
    id: 'E87047',
    name: 'Earls Court Medical Centre',
    addressLines: ['248 Earls Court Road', 'London'],
    postCode: 'SW5 9AD',
    phone: '020 78351455',
    icbCode: 'Z9B2Z',
    icbName: 'NHS North West London ICB',
  },

  // ── London ────────────────────────────────────────────────────────────────
  {
    id: 'E87007',
    name: 'Westbourne Grove Medical Centre',
    addressLines: ['241 Westbourne Grove', 'London'],
    postCode: 'W11 2SE',
    phone: '020 72295800',
    icbCode: 'Z9B2Z',
    icbName: 'NHS North West London ICB',
  },
  {
    id: 'F84729',
    name: 'The Manor Park Practice',
    addressLines: ['778 Romford Road', 'London'],
    postCode: 'E12 5JG',
    phone: '020 84780533',
    icbCode: 'Z9B1Z',
    icbName: 'NHS North East London ICB',
  },
  {
    id: 'F83680',
    name: 'Sobell Medical Centre',
    addressLines: ['272 Holloway Road', 'London'],
    postCode: 'N7 6NE',
    phone: '020 76093050',
    icbCode: 'Z9B1Z',
    icbName: 'NHS North Central London ICB',
  },
  {
    id: 'F84077',
    name: 'Newham Vicarage Practice',
    addressLines: ['Vicarage Lane Health Centre', '10 Vicarage Lane', 'Stratford', 'London'],
    postCode: 'E15 4ES',
    phone: '020 85362266',
    icbCode: 'Z9B1Z',
    icbName: 'NHS North East London ICB',
  },

  // ── North ─────────────────────────────────────────────────────────────────
  {
    id: 'B86008',
    name: 'Alwoodley Medical Centre',
    addressLines: ['Saxon Mount', 'Moortown', 'Leeds'],
    postCode: 'LS17 5DT',
    phone: '0113 3930119',
    icbCode: 'QWO',
    icbName: 'NHS West Yorkshire ICB',
  },
  {
    id: 'B83614',
    name: 'Picton Medical Centre',
    addressLines: ['Whetley Medical Centre', '2 Saplin Street', 'Bradford'],
    postCode: 'BD8 9DW',
    phone: '01274 019605',
    icbCode: 'QWO',
    icbName: 'NHS West Yorkshire ICB',
  },
  {
    id: 'Y00411',
    name: 'Dearne Valley Group Practice',
    addressLines: ['The Thurnscoe LIFT Building', 'Holly Bush Drive', 'Thurnscoe', 'Rotherham'],
    postCode: 'S63 0LU',
    phone: '01709 886354',
    icbCode: 'QF7',
    icbName: 'NHS South Yorkshire ICB',
  },
  {
    id: 'P81646',
    name: 'Lathom House Surgery',
    addressLines: [
      'Burscough Health Centre',
      'Stanley Court',
      'Lord Street',
      'Burscough',
      'Ormskirk',
    ],
    postCode: 'L40 4LA',
    phone: '01704 396060',
    icbCode: 'QYG',
    icbName: 'NHS Cheshire and Merseyside ICB',
  },

  // ── Midlands ──────────────────────────────────────────────────────────────
  {
    id: 'C82111',
    name: 'Campus View Medical Centre',
    addressLines: ['The Medical Centre', 'Ashby Road', 'Loughborough'],
    postCode: 'LE11 3TU',
    phone: '01509 277577',
    icbCode: 'QNQ',
    icbName: 'NHS Leicester, Leicestershire and Rutland ICB',
  },
  {
    id: 'N81008',
    name: 'The Cedars Medical Centre',
    addressLines: ['Sandbach Road South', 'Alsager', 'Stoke-on-Trent'],
    postCode: 'ST7 2LU',
    phone: '01270 443080',
    icbCode: 'QYG',
    icbName: 'NHS Cheshire and Merseyside ICB',
  },
  {
    id: 'M85774',
    name: 'Springfield Surgery',
    addressLines: [
      'Sparkhill Primary Care Centre',
      '856 Stratford Road',
      'Sparkhill',
      'Birmingham',
    ],
    postCode: 'B11 4BW',
    phone: '0345 2450753',
    icbCode: 'QHL',
    icbName: 'NHS Birmingham and Solihull ICB',
  },
  {
    id: 'C82013',
    name: 'Bushloe Surgery',
    addressLines: ['Two Steeples Medical Centre', 'Abington Close', 'Wigston'],
    postCode: 'LE18 2EW',
    phone: '0116 3440233',
    icbCode: 'QNQ',
    icbName: 'NHS Leicester, Leicestershire and Rutland ICB',
  },

  // ── South East ────────────────────────────────────────────────────────────
  {
    id: 'G81031',
    name: 'The Hill Surgery',
    addressLines: ['Ore Clinic', '407 Old London Road', 'Hastings'],
    postCode: 'TN35 5BH',
    phone: '01424 720878',
    icbCode: 'QNX',
    icbName: 'NHS Sussex ICB',
  },
  {
    id: 'G82019',
    name: 'Edenbridge Medical Practice',
    addressLines: ['Edenbridge Memorial Health Centre', 'Four Elms Road', 'Edenbridge'],
    postCode: 'TN8 6FY',
    phone: '01732 865055',
    icbCode: 'QKS',
    icbName: 'NHS Kent and Medway ICB',
  },
  {
    id: 'G82796',
    name: 'Broadstairs Medical Practice',
    addressLines: ['The Broadway', 'Broadstairs'],
    postCode: 'CT10 2AJ',
    phone: '01843 608836',
    icbCode: 'QKS',
    icbName: 'NHS Kent and Medway ICB',
  },
  {
    id: 'G82708',
    name: 'Marlowe Park Medical Centre',
    addressLines: ['Wells Road', 'Strood', 'Rochester'],
    postCode: 'ME2 2PW',
    phone: '01634 724556',
    icbCode: 'QKS',
    icbName: 'NHS Kent and Medway ICB',
  },

  // ── South West ────────────────────────────────────────────────────────────
  {
    id: 'L83064',
    name: 'Church View Surgery',
    addressLines: ['30 Holland Road', 'Plymstock', 'Plymouth'],
    postCode: 'PL9 9BN',
    phone: '01752 403206',
    icbCode: 'QJK',
    icbName: 'NHS Devon ICB',
  },
  {
    id: 'L83147',
    name: 'Lisson Grove Medical Centre',
    addressLines: ['3-5 Lisson Grove', 'Mutley', 'Plymouth'],
    postCode: 'PL4 7DL',
    phone: '01752 205555',
    icbCode: 'QJK',
    icbName: 'NHS Devon ICB',
  },
  {
    id: 'J81076',
    name: 'Ammonite Health Partnership',
    addressLines: ['Bridport Medical Centre', 'West Allington', 'Bridport'],
    postCode: 'DT6 5BN',
    phone: '01308 861800',
    icbCode: 'QVV',
    icbName: 'NHS Dorset ICB',
  },
];

// ── Main ──────────────────────────────────────────────────────────────────────

async function seed() {
  console.log(`🌱 Geocoding ${PRACTICES.length} postcodes via postcodes.io...`);

  // Bulk geocode all postcodes in one request
  const postcodes = PRACTICES.map(p => p.postCode);
  const coords = await geocodePostcodes(postcodes);

  let geocoded = 0;
  let missing = 0;
  for (const [pc, c] of coords) {
    if (c) geocoded++;
    else missing++;
  }
  console.log(`  ✅ Geocoded: ${geocoded}  ❌ Failed: ${missing}`);

  console.log(`\n🏥 Writing ${PRACTICES.length} practices to providers_england...`);

  const batch = db.batch();

  for (const p of PRACTICES) {
    const coord = coords.get(p.postCode.trim().toUpperCase()) ?? null;

    const doc: FirestoreProviderDoc = {
      name: p.name,
      type: 'gp_practice',
      status: p.status ?? 'active',
      email: null, // epraccur.csv doesn't include emails
      phone: p.phone,
      addressLines: p.addressLines,
      postCode: p.postCode,
      countryCode: 'GB',
      lat: coord?.lat ?? null,
      lng: coord?.lng ?? null,
      parentInstitutions: [
        {
          id: p.icbCode,
          name: p.icbName,
          type: 'Integrated Care Board',
          level: 2,
        },
      ],
      searchTokens: buildSearchTokens(p.name, p.postCode),
      source: 'nhs_england',
      ingestedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const ref = db.collection('providers_england').doc(p.id);
    batch.set(ref, doc);

    const coordStr = coord ? `${coord.lat.toFixed(4)}, ${coord.lng.toFixed(4)}` : 'no coords';
    console.log(`  + ${p.id} — ${p.name} (${p.postCode}) [${coordStr}]`);
  }

  await batch.commit();

  console.log(`\n✅ Seeded ${PRACTICES.length} practices`);
  console.log('   Search should now work for: "garway", "earls court", "alwoodley" etc.');
  console.log('   Postcode prefixes: "W2", "SW5", "LS17", "TN35", "PL9" etc.');

  process.exit(0);
}

seed().catch(err => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});

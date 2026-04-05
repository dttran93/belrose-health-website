// src/features/ProviderDirectory/NHSEnglandDirectory.ts

/**
 * NHSEnglandDirectory
 *
 * Implements ProviderDirectory against the `providers_england` Firestore
 * collection, which is populated by the ingestNHSEngland.ts script.
 *
 * Collection: providers_england
 * Document ID: ODS code (e.g. "A81001")
 *
 * Search strategy:
 *   Firestore doesn't support native full-text search. We work around this
 *   by storing a `searchTokens` string[] on each document at ingest time
 *   (lowercase words from name + postcode, stop words removed). We query
 *   with `array-contains` on the most selective token in the user's query,
 *   fetch up to FETCH_LIMIT results, then re-rank client-side by counting
 *   how many of the user's tokens appear in each document's searchTokens.
 *
 *   This handles "barnsbury medical" well — "barnsbury" is the primary token,
 *   client-side scoring promotes results that also contain "medical".
 *   Postcode prefix search ("N1") also works via the postcode token.
 *
 *   Limitation: single array-contains per Firestore query. Won't handle
 *   mid-word typos. If you need richer search, swap the Firestore query for
 *   an Algolia/Typesense call — the ProviderDirectory interface stays the same.
 */

import {
  getFirestore,
  collection,
  query,
  where,
  limit,
  getDocs,
  doc,
  getDoc,
} from 'firebase/firestore';
import type {
  ProviderDirectory,
  ProviderDirectoryResult,
  ProviderSearchOptions,
  ParentInstitution,
} from '@/features/ProviderDirectory/types';

// How many docs to pull from Firestore before client-side re-ranking.
// Higher = better recall at the cost of more reads.
const FETCH_LIMIT = 50;
const MIN_QUERY_LENGTH = 2;

// ── Firestore document shape ──────────────────────────────────────────────────
// This is what the ingestion script writes. Kept internal to this file —
// nothing outside NHSEnglandDirectory should depend on this raw shape.

interface FirestoreProviderDoc {
  // Core identity
  name: string;
  type: 'gp_practice' | 'hospital' | 'clinic' | 'other';
  status: 'active' | 'closed';

  // Contact
  email: string | null;
  phone: string | null;

  // Address — stored flat for simplicity, mapped to ProviderAddress on read
  addressLines: string[]; // e.g. ["12 Barnsbury Street", "Islington", "London"]
  postCode: string; // e.g. "N1 1PN"

  // countryCode is always 'GB' for this collection but stored explicitly
  // so the mapping function stays generic
  countryCode: string;

  // Parent hierarchy — ODS code references only, no nested full objects
  // Ordered level ascending: [PCN (level 1), ICB (level 2)]
  parentInstitutions: FirestoreParentRef[];

  // Search
  searchTokens: string[];

  // Provenance
  source: 'nhs_england';
  ingestedAt: any; // Firestore Timestamp
  lastUpdatedAt?: any;
}

interface FirestoreParentRef {
  id: string; // ODS code of the parent — use getById() to fetch full details
  name: string; // Denormalised for display without a second query
  type: 'Primary Care Network' | 'Integrated Care Board' | 'Trust' | 'NHS England' | 'Other';
  level: number;
}

// ── Directory implementation ──────────────────────────────────────────────────

export class NHSEnglandDirectory implements ProviderDirectory {
  private db = getFirestore();
  private col = collection(this.db, 'providers_england');

  // ── search ──────────────────────────────────────────────────────────────────

  async search(
    rawQuery: string,
    options: ProviderSearchOptions = {}
  ): Promise<ProviderDirectoryResult[]> {
    const { limit: resultLimit = 10 } = options;

    const cleaned = rawQuery.trim().toLowerCase();
    if (cleaned.length < MIN_QUERY_LENGTH) return [];

    const queryTokens = tokenise(cleaned);
    if (queryTokens.length === 0) return [];

    // Use the longest token as the primary Firestore index key —
    // longer tokens are more selective and return fewer false positives
    const primaryToken = queryTokens.reduce((a, b) => (a.length >= b.length ? a : b));

    let q = query(
      this.col,
      where('searchTokens', 'array-contains', primaryToken),
      where('status', '==', 'active'),
      limit(FETCH_LIMIT)
    );

    // Optionally filter by provider type
    if (options.type) {
      q = query(
        this.col,
        where('searchTokens', 'array-contains', primaryToken),
        where('status', '==', 'active'),
        where('type', '==', options.type),
        limit(FETCH_LIMIT)
      );
    }

    const snap = await getDocs(q);
    const docs = snap.docs.map(
      d => ({ id: d.id, ...d.data() }) as FirestoreProviderDoc & { id: string }
    );

    // Client-side re-ranking: score by how many query tokens appear in searchTokens
    const scored = docs
      .map(d => ({
        doc: d,
        score: queryTokens.filter(t => d.searchTokens.includes(t)).length,
      }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, resultLimit)
      .map(({ doc: d }) => toResult(d.id, d));

    return scored;
  }

  // ── getById ─────────────────────────────────────────────────────────────────

  async getById(id: string): Promise<ProviderDirectoryResult | null> {
    const snap = await getDoc(doc(this.col, id));
    if (!snap.exists()) return null;
    return toResult(snap.id, snap.data() as FirestoreProviderDoc);
  }
}

// ── Mapping ───────────────────────────────────────────────────────────────────

/**
 * Map a raw Firestore document to the canonical ProviderDirectoryResult.
 *
 * This is the only function in this file that knows about both the raw
 * Firestore shape AND the canonical type. If the NHS data model changes,
 * this is the only place to update.
 */
function toResult(id: string, d: FirestoreProviderDoc): ProviderDirectoryResult {
  const parentInstitutions: ParentInstitution[] = (d.parentInstitutions ?? []).map(p => ({
    id: p.id,
    name: p.name,
    type: p.type,
    level: p.level,
  }));

  return {
    id,
    institutionName: d.name,
    email: d.email,
    phone: d.phone,
    address: {
      lines: d.addressLines,
      postCode: d.postCode,
      countryCode: d.countryCode,
      // England doesn't use administrativeArea in the US state sense —
      // omitting it keeps the address clean
    },
    countryCode: d.countryCode,
    type: d.type,
    source: 'nhs_england',
    parentInstitutions,
    displayLabel: `${d.name} · ${d.postCode}`,
  };
}

// ── Tokenisation ──────────────────────────────────────────────────────────────

/**
 * Tokenise a string into searchable lowercase words.
 *
 * IMPORTANT: This must match the tokenisation in ingestNHSEngland.ts exactly.
 * If you change this function, re-run the ingestion script to rebuild
 * the searchTokens arrays in Firestore.
 */
export function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // strip punctuation
    .split(/\s+/)
    .filter(t => t.length >= 2)
    .filter(t => !STOP_WORDS.has(t));
}

// Words excluded from the search index — too common to be useful as
// primary tokens and would return too many false positives
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

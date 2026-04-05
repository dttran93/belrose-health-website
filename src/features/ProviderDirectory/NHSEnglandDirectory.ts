// src/features/ProviderDirectory/NHSEnglandDirectory.ts

/**
 * NHSEnglandDirectory
 *
 * Implements ProviderDirectory against the `providers_england` Firestore
 * collection, populated by the ingestNHSEngland.ts script.
 *
 * Search strategy:
 *   Stores a `searchTokens` string[] on each document at ingest time.
 *   Queries with `array-contains` on the most selective token, fetches
 *   up to FETCH_LIMIT results, then re-ranks client-side.
 *
 *   Status is NOT filtered here — both active and closed practices are
 *   returned. The UI handles closed practices by showing a warning and
 *   suggesting escalation to the parent ICB. This is intentional: a
 *   patient may need records from a practice that has since closed, and
 *   hiding it would leave them with no path forward.
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
  ProviderStatus,
} from './types';

// How many docs to pull from Firestore before client-side re-ranking.
// Higher = better recall at the cost of more reads.
const FETCH_LIMIT = 50;
const MIN_QUERY_LENGTH = 2;

// ── Firestore document shape ──────────────────────────────────────────────────
// This is what the ingestion script writes. Kept internal to this file —
// nothing outside NHSEnglandDirectory should depend on this raw shape.

interface FirestoreProviderDoc {
  name: string;
  type: 'gp_practice' | 'hospital' | 'clinic' | 'other';
  status: 'active' | 'closed';
  email: string | null;
  phone: string | null;
  addressLines: string[];
  postCode: string;
  countryCode: string;
  // Coordinates stored flat on the doc rather than nested —
  // avoids Firestore partial-update issues with nested objects
  lat: number | null;
  lng: number | null;
  parentInstitutions: FirestoreParentRef[];
  searchTokens: string[];
  source: 'nhs_england';
  ingestedAt: any;
  lastUpdatedAt?: string;
}

interface FirestoreParentRef {
  id: string;
  name: string;
  type: 'Primary Care Network' | 'Integrated Care Board' | 'Trust' | 'NHS England' | 'Other';
  level: number;
}

// ── Directory implementation ──────────────────────────────────────────────────

export class NHSEnglandDirectory implements ProviderDirectory {
  private db = getFirestore();
  private col = collection(this.db, 'providers_england');

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

    const q = query(
      this.col,
      where('searchTokens', 'array-contains', primaryToken),
      limit(FETCH_LIMIT)
    );

    const snap = await getDocs(q);
    const docs = snap.docs.map(d => ({
      id: d.id,
      ...(d.data() as FirestoreProviderDoc),
    }));

    return docs
      .filter(d => !options.type || d.type === options.type)
      .map(d => ({
        doc: d,
        score: queryTokens.filter(t => d.searchTokens.includes(t)).length,
      }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        // Active practices rank above closed at equal score
        return (b.doc.status === 'active' ? 1 : 0) - (a.doc.status === 'active' ? 1 : 0);
      })
      .slice(0, resultLimit)
      .map(({ doc: d }) => toResult(d.id, d));
  }

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

  // Reconstruct the optional coordinates object from flat fields
  const coordinates = d.lat != null && d.lng != null ? { lat: d.lat, lng: d.lng } : null;

  return {
    id,
    institutionName: d.name,
    status: (d.status ?? 'active') as ProviderStatus,
    email: d.email,
    phone: d.phone,
    address: {
      lines: d.addressLines,
      postCode: d.postCode,
      countryCode: d.countryCode,
      coordinates,
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

// src/features/ProviderDirectory/types.ts

/**
 * Core abstraction for provider directory lookups.
 *
 * All directory implementations (NHS England, NHS Scotland, NPI US, etc.)
 * must return data in this shape. The UI and request form never import
 * anything NHS-specific — they only depend on these types.
 */

// ── Result types ──────────────────────────────────────────────────────────────

export type ProviderSource = 'nhs_england'; // | 'nhs_scotland' | 'us_npi' | etc. (future additions)

export type ProviderType = 'gp_practice' | 'hospital' | 'clinic' | 'other';

export type ProviderStatus = 'active' | 'closed';

export interface ProviderDirectoryResult {
  // Unique identifier within the source system
  // e.g. ODS code for NHS, NPI number for US
  id: string;
  institutionName: string;

  // Active = operating normally.
  // Closed = no longer operating — UI should warn the user and suggest
  // escalating to the parent ICB via parentInstitutions.
  status: ProviderStatus;

  parentInstitutions: ParentInstitution[];
  email: string | null;
  phone: string | null;
  address: ProviderAddress;
  countryCode: string; // destructured from address for easier filtering
  type: ProviderType;
  source: ProviderSource;
  displayLabel: string; // Human-readable label shown in search results (e.g. "Barnsbury Medical Centre · N1 1PN")
}

export interface ProviderAddress {
  lines: string[]; // Address lines, e.g. ["123 Main St", "County", "Anytown", "City" etc.]
  postCode: string;
  countryCode: string; // ISO 3166-1 alpha-2, e.g. "GB" or "US"
  administrativeArea?: string; // States/provinces/regions (e.g. California, Scotland, Ontario etc.)
  coordinates?: {
    lat: number;
    lng: number;
  } | null;
}

export interface ParentInstitution {
  id: string; // Unique identifier of institution, needs to be consistent with ID used in Provider Directory for lookups (e.g. ODS code for NHS)
  name: string;
  type: 'Primary Care Network' | 'Integrated Care Board' | 'Trust' | 'NHS England' | 'Other';
  level: number; // 1 = immediate parent, 2 = grandparent etc.
}

// ── Search options ────────────────────────────────────────────────────────────

export interface ProviderSearchOptions {
  // Max results to return (default: 10)
  limit?: number;
  // Optionally restrict to a provider type (e.g. only GP practices, only hospitals)
  type?: ProviderType;
  // Other potential options here, nearAddress, within a certain postcode etc.
}

// ── Directory interface ───────────────────────────────────────────────────────

/**
 * Every provider directory implementation must implement this interface.
 * The UI depends only on this — never on the concrete class.
 */
export interface ProviderDirectory {
  /**
   * Search by institution name or postcode fragment.
   * Returns results ordered by relevance.
   */
  search(query: string, options?: ProviderSearchOptions): Promise<ProviderDirectoryResult[]>;
  getById(id: string): Promise<ProviderDirectoryResult | null>;
}

// ── Region type ───────────────────────────────────────────────────────────────
/**
 * These types support 2 purposes:
 * 1.) ProviderDirectoryFactory routing, either NHSEnglandDirectory, future USDirectory implementations etc.
 * 2.) Reduce the search space. When England is selected, only search England collection
 */

export type ProviderRegion = 'england' | 'scotland' | 'wales' | 'northern_ireland' | 'us';

export interface RegionConfig {
  region: ProviderRegion;
  label: string; // e.g. "England (NHS)"
  available: boolean; // false = shown in UI but disabled ("coming soon")
}

export const REGION_CONFIGS: RegionConfig[] = [
  { region: 'england', label: 'England (NHS)', available: true },
  { region: 'scotland', label: 'Scotland (NHS)', available: false },
  { region: 'wales', label: 'Wales (NHS)', available: false },
  { region: 'northern_ireland', label: 'Northern Ireland (NHS)', available: false },
  { region: 'us', label: 'United States', available: false },
];

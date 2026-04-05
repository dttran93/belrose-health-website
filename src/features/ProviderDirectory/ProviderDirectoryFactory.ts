// src/features/ProviderDirectory/ProviderDirectoryFactory.ts

import type { ProviderDirectory, ProviderRegion } from './types';
import { NHSEnglandDirectory } from './NHSEnglandDirectory';

/**
 * Returns the correct ProviderDirectory implementation for a given region.
 *
 * Adding a new region:
 *   1. Create the implementation class (e.g. NPIDirectory.ts)
 *   2. Import it here and add a case
 *   3. Flip `available: true` in REGION_CONFIGS in types.ts
 *   — nothing else needs to change
 */
export class ProviderDirectoryFactory {
  static getDirectory(region: ProviderRegion): ProviderDirectory {
    switch (region) {
      case 'england':
        return new NHSEnglandDirectory();

      // ── Future implementations ────────────────────────────────────────────
      // case 'scotland':
      //   return new NHSScotlandDirectory();
      // case 'us':
      //   return new NPIDirectory();

      default:
        throw new Error(
          `No provider directory available for region "${region}". ` +
            `Check REGION_CONFIGS in types.ts for supported regions.`
        );
    }
  }
}

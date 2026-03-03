// src/features/HealthProfile/components/overview/renderers/detail/useResourceFields.ts

import { useMemo } from 'react';
import { FHIRResource } from '@/types/fhir';
import { formatTimestamp } from '@/utils/dataFormattingUtils';

export interface ResolvedField {
  label: string;
  value: string;
}

/**
 * Resolves a dot-notation path against an object.
 * e.g. resolvePath(obj, 'clinicalStatus.coding.0.code')
 * Handles both numeric array indices and named keys.
 */
function resolvePath(obj: any, path: string): unknown {
  return path.split('.').reduce((curr, key) => {
    if (curr == null) return undefined;
    return curr[key];
  }, obj);
}

/**
 * Detects whether a string looks like an ISO date and formats it nicely.
 * Avoids mangling non-date strings like status codes.
 */
function maybeFormatDate(value: string): string {
  // ISO date pattern: starts with 4-digit year
  if (/^\d{4}-\d{2}/.test(value)) {
    const formatted = formatTimestamp(value, 'date-short');
    return formatted !== 'Unknown date' ? formatted : value;
  }
  return value;
}

/**
 * Given a FHIR resource and a field label map, returns an array of
 * { label, value } pairs for every field that is actually populated.
 * Fields with null/undefined/empty values are silently skipped.
 */
export function useResourceFields(
  resource: FHIRResource,
  fieldMap: Record<string, string>
): ResolvedField[] {
  return useMemo(() => {
    const results: ResolvedField[] = [];
    const seen = new Set<string>(); // deduplicate labels if multiple paths resolve the same thing

    for (const [path, label] of Object.entries(fieldMap)) {
      if (seen.has(label)) continue;

      const raw = resolvePath(resource, path);
      if (raw == null || raw === '') continue;

      const value =
        typeof raw === 'boolean'
          ? raw
            ? 'Yes'
            : 'No'
          : typeof raw === 'string'
            ? maybeFormatDate(raw)
            : String(raw);

      results.push({ label, value });
      seen.add(label);
    }

    return results;
  }, [resource, fieldMap]);
}

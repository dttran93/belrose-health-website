// src/features/HealthProfile/config/HealthDataViews.ts

import { HealthProfileCategory } from '../utils/fhirGroupingUtils';

export interface HealthDataView {
  id: string;
  label: string;
  description?: string;
  /**
   * Ordered list of categories to display.
   * Categories not in this list are hidden in this view, but data still
   * exists in GroupedHealthData — nothing is discarded.
   */
  sections: HealthProfileCategory[];
}

/**
 * Summary Care Record — the default GP view.
 * Allergies first (safety-critical), then medications, then clinical history.
 */
export const SCR_VIEW: HealthDataView = {
  id: 'scr',
  label: 'Summary Care Record',
  description: 'Core clinical information in the order a GP would review it.',
  sections: ['allergies', 'medications', 'conditions', 'immunizations', 'procedures', 'visits'],
};

/**
 * Full data view — every populated category in priority order.
 * Use this for the "All Data" tab or any non-clinical context.
 */
export const ALL_DATA_VIEW: HealthDataView = {
  id: 'all',
  label: 'All Data',
  sections: [
    'allergies',
    'medications',
    'conditions',
    'immunizations',
    'procedures',
    'visits',
    'observations',
    'family_history',
    'documents',
    'care_team',
    'patients',
    'providers',
    'locations',
    'other',
  ],
};

// To add a specialty views and custom views later:
//   1. Add a new ProfileView const here
//   2. Pass it to HealthDataDisplay via the `view` prop
//   No component changes needed.
//
// export const CARDIOLOGY_VIEW: ProfileView = {
//   id: 'cardiology',
//   label: 'Cardiology',
//   sections: ['conditions', 'medications', 'observations', 'procedures', 'allergies', 'visits'],
// };

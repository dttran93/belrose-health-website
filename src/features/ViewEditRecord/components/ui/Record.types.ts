import { ReactNode } from 'react';

// Basic FHIR resource structure
export interface FHIRResource {
  resourceType: string;
  id?: string;
  status?: string;
  [key: string]: any; // Allow for any additional FHIR properties
}

// FHIR Bundle entry structure
export interface FHIREntry {
  fullUrl?: string;
  resource: FHIRResource;
  search?: {
    mode: 'match' | 'include';
    score?: number;
  };
}

// FHIR Bundle structure
export interface FHIRBundle {
  resourceType?: 'Bundle';
  id?: string;
  type?: 'document' | 'collection' | 'searchset' | 'history' | 'transaction' | 'transaction-response' | 'batch' | 'batch-response';
  timestamp?: string;
  total?: number;
  entry?: FHIREntry[];
}

// Props for individual FHIR resource card
export interface FHIRResourceCardProps {
  resource: FHIRResource;
  index: number;
  config?: ResourceDisplayConfig; // For future database-driven styling
  //Edit mode props
  editable?: boolean;
  onChange?: (updatedResource: any) => void;
}

// Props for the main FHIR cards display component
export interface HealthRecordProps {
  fhirData: FHIRBundle | null | undefined;
  className?: string;
  //Edit mode props
  editable?: boolean;
  onSave?: (updatedData: any) => void;
  onCancel?: () => void;
}

// Props for FHIR field component
export interface EditFHIRFieldProps {
  label: string;
  value: any;
  depth?: number;
  editable?: boolean;
  onChange?: (newValue: any) => void;
  onDelete?: () => void;
  canDelete?: boolean;
  path?: string;
}

// Future database configuration types (for your Firestore styling system)
export interface ResourceDisplayConfig {
  resourceType: string;
  displayName?: string;
  icon?: string;
  colorScheme?: {
    primary: string;
    background: string;
    border: string;
    text: string;
  };
  layout?: 'card' | 'compact' | 'detailed';
  priority?: number;
  prominentFields?: string[];
  hiddenFields?: string[];
  customComponent?: string;
}

// Configuration for field display (building on your dynamic field concept)
export interface FieldDisplayConfig {
  fieldPath: string; // FHIR path like "name[0].given"
  label?: string;
  type: 'text' | 'date' | 'number' | 'boolean' | 'array' | 'object';
  display: 'prominent' | 'secondary' | 'hidden';
  format?: string; // For dates, numbers, etc.
  icon?: string;
  group?: string; // For grouping related fields
}

// Props for when you add database-driven field rendering
export interface FHIRFieldProps {
  resource: FHIRResource;
  fieldConfig: FieldDisplayConfig;
  value: any;
}

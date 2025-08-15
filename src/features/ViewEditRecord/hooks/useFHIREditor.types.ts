import { FHIRBundle } from '@/types/fhir';
import { FileObject } from '@/types/core';

// Simplified types - just what we need
export type UserId = string | undefined;
export type FileId = string | undefined;

export interface UseFhirEditorReturn {
  fhirData: FHIRBundle | null;
  originalFhir: FHIRBundle | null;
  loading: boolean;
  error: Error | null;
  hasChanges: boolean;
}

export interface UseFhirEditSaverReturn {
  saveFhirEdits: (
    userId: string, 
    fileId: string, 
    updatedFhir: FHIRBundle, 
    changeDescription?: string
  ) => Promise<void>;
  saving: boolean;
  error: Error | null;
}

export interface UseFhirRecordsListReturn {
  records: FileObject[];
  loading: boolean;
  error: Error | null;
}
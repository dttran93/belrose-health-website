import { Timestamp } from 'firebase/firestore';
import { FHIRBundle } from '@/types/fhir';

// ============================================================================
// CORE DATA TYPES
// ============================================================================

/**
 * Represents a FHIR record as stored in Firestore and returned by hooks
 */
export interface FhirRecord {
  id: string;
  fileName: string;
  resourceType: string;
  createdAt: Timestamp | Date;
  lastEditedAt?: Timestamp | Date | null;
  hasBeenEdited: boolean;
}

/**
 * Structure of a Firestore document in the users/{userId}/files collection
 */
export interface FirestoreDocument {
  fhirData?: FHIRBundle;
  fileName?: string;
  name?: string;
  createdAt?: Timestamp;
  uploadedAt?: Timestamp;
  lastEditedAt?: Timestamp;
  editedByUser?: boolean;
  lastEditDescription?: string;
  [key: string]: any; // For any additional fields from your AddRecord workflow
}

// ============================================================================
// HOOK RETURN TYPES
// ============================================================================

/**
 * Return type for useFhirEditor hook
 */
export interface UseFhirEditorReturn {
  fhirData: FHIRBundle | null;
  originalFhir: FHIRBundle | null;
  loading: boolean;
  error: Error | null;
  hasChanges: boolean;
}

/**
 * Return type for useFhirEditSaver hook
 */
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

/**
 * Return type for useFhirRecordsList hook
 */
export interface UseFhirRecordsListReturn {
  records: FhirRecord[];
  loading: boolean;
  error: Error | null;
}

// ============================================================================
// FUNCTION PARAMETER TYPES
// ============================================================================

/**
 * Parameters for the saveFhirEdits function
 */
export interface SaveFhirEditsParams {
  userId: string;
  fileId: string;
  updatedFhir: FHIRBundle;
  changeDescription?: string;
}

/**
 * Parameters for hook functions
 */
export type UserId = string | undefined;
export type FileId = string | undefined;
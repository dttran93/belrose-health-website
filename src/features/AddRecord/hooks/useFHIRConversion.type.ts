import type { 
  FHIRWithValidation, 
  FHIRResource, 
  FHIRBundle, 
  FHIRBundleEntry 
} from '../services/fhirConversionService.type';
import type { FileObject, FileStatus } from '@/types/core';

export interface ReviewedData {
  subject: string;
  provider?: string | null;
  institution?: string | null;
  address?: string | null;
  notes: string;
  documentType: string;
  confirmedAt: string;
}

export interface PatientResource extends FHIRResource {
  resourceType: 'Patient';
  name?: PatientName[];
  birthDate?: string;
  gender?: string;
  identifier?: PatientIdentifier[];
  address?: PatientAddress[];
}

export interface PatientName {
  use?: string;
  family?: string;
  given?: string[];
  text?: string;
}

export interface PatientIdentifier {
  system?: string;
  value?: string;
  type?: {
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
  };
}

export interface PatientAddress {
  use?: string;
  line?: string[];
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  text?: string;
}

export interface ObservationResource extends FHIRResource {
  resourceType: 'Observation';
  status: string;
  code?: CodeableConcept;
  subject?: Reference;
  effectiveDateTime?: string;
  performer?: Reference[];
  valueQuantity?: Quantity;
  valueString?: string;
  component?: ObservationComponent[];
}

export interface CodeableConcept {
  coding?: Coding[];
  text?: string;
}

export interface Coding {
  system?: string;
  code?: string;
  display?: string;
}

export interface Reference {
  reference?: string;
  display?: string;
}

export interface Quantity {
  value?: number;
  unit?: string;
  system?: string;
  code?: string;
}

export interface ObservationComponent {
  code?: CodeableConcept;
  valueQuantity?: Quantity;
  valueString?: string;
}

export interface HealthRecordData {
  id: string;
  subject: string;
  provider: string;
  institutionName: string;
  institutionAddress: string;
  date: string | undefined;
  clinicNotes: string;
  attachments: Array<{
    name: string;
    size: string;
    url: string;
  }>;
  isBlockchainVerified: boolean;
  createdAt: string;
  lastModified: string;
  originalFhirData: FHIRWithValidation;
}

export interface FHIRConversionHookReturn {
  fhirData: Map<string, FHIRWithValidation>;
  reviewedData: Map<string, ReviewedData>;
  handleFHIRConverted: (fileId: string, fhirData: FHIRWithValidation) => Promise<void>;
  handleDataConfirmed: (fileId: string, editedData: any) => Promise<void>;
  handleDataRejected: (fileId: string) => void;
  isAllFilesConverted: () => boolean;
  isAllFilesReviewed: () => boolean;
  getFHIRStats: () => number;
  reset: () => void;
}

export interface FHIRConversionHookParams {
  processedFiles: FileObject[];
  firestoreData?: Map<string, any>;
  updateFirestoreRecord?: (fileId: string, data: any) => void;
  uploadFiles?: () => Promise<any[]>; // No parameters, returns upload results
  removeProcessedFile?: (fileId: string) => void;
}

export interface ExtractedDataHelpers {
  mapFHIRToHealthRecord: (fhirData: FHIRWithValidation, fileName: string, fileId: string) => HealthRecordData | null;
  buildClinicalNotes: (observations: FHIRBundleEntry[], patientResource: PatientResource | null) => string;
  extractPatientName: (patientResource: PatientResource | null) => string;
  extractProvider: (observations: FHIRBundleEntry[]) => string | null;
  extractInstitution: (observations: FHIRBundleEntry[]) => string | null;
  extractAddress: (patientResource: PatientResource | null) => string | null;
  generateNotes: (observations: FHIRBundleEntry[], patientResource: PatientResource | null) => string;
  determineSubject: (observations: FHIRBundleEntry[], fileName: string) => string;
}

/**
 * Constants for document type detection
 */
export const DOCUMENT_TYPE_KEYWORDS = {
  VISION: ['vision', 'eye', 'glasses', 'contact', 'prescription'],
  LAB: ['lab', 'laboratory', 'blood', 'test', 'result'],
  PRESCRIPTION: ['prescription', 'medication', 'drug', 'pharmacy'],
  REPORT: ['report', 'summary', 'findings', 'diagnosis']
} as const;

export const DEFAULT_DOCUMENT_TYPES = {
  VISION_PRESCRIPTION: 'Vision Prescription',
  LABORATORY_RESULTS: 'Laboratory Results', 
  PRESCRIPTION: 'Prescription',
  MEDICAL_REPORT: 'Medical Report',
  MEDICAL_RECORD: 'Medical Record'
} as const;

export type DocumentType = typeof DEFAULT_DOCUMENT_TYPES[keyof typeof DEFAULT_DOCUMENT_TYPES];
import { ReactNode } from 'react';

// ==================== USER & AUTHENTICATION ====================

export interface User {
  uid: string;
  email: string | null;
  emailVerified?: boolean;
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
  photoURL?: string | null;

  encryption?: {
    enabled: boolean;
    salt: string; // base64 encoded
    passwordHash: string; // for verification only
    recoveryKeyHash: string; // for recovery key verification
    setupAt: string;
    lastUnlockedAt?: string; // track usage
  };
}

// Authentication context data structure
export interface AuthContextData {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  isAuthenticated: boolean;
}

// Props for components that need auth context
export interface AuthProviderProps {
  children: ReactNode;
}

export interface ProtectedRouteProps {
  children: ReactNode;
}

// Location state for navigation
export interface LocationState {
  from: {
    pathname: string;
  };
}

export interface UserProfile extends User {
  createdAt: any;
  updatedAt: any;
  emailVerifiedAt?: any;

  generatedWallet?: {
    address: string;
    encryptedPrivateKey: string;
    keyIv: string;
    keyAuthTag: string;
    keySalt: string;
    encryptedMnemonic: string; // Backup recovery phrase
    mnemonicIv: string;
    mnemonicAuthTag: string;
    mnemonicSalt: string;
    walletType: 'generated';
    createdAt: string;
  };

  connectedWallet?: {
    address: string;
    authMethod: 'web3auth' | 'metamask';
    connectedAt: string;
    lastUsed: string;
    userInfo?: {
      email?: string;
      name?: string;
      profileImage?: string;
      typeOfLogin?: string;
    };
  };
  preferences?: {
    blockchainVerificationEnabled: boolean;
    autoConnectWallet: boolean;
  };
}

// ==================== HEALTH RECORDS FILE ====================

export interface BelroseFields {
  // Core display fields - these are what users see in list views
  visitType?: string; // e.g., "Follow-up Appointment", "Lab Results", "Imaging Study"
  title?: string; // Short descriptive title (e.g., "Cardiology Follow-up")
  summary?: string; // Tweet-length summary, main information a future reader would need to know
  detailedNarrative?: string; //detailed information on the medical interaction. derived from FHIR, but human readable

  // Key dates and people
  completedDate?: string; // ISO date string - the main date for this record
  provider?: string; // Primary provider name
  institution?: string; // Healthcare institution/facility
  patient?: string; // Patient Name

  // Simple processing metadata
  aiProcessedAt?: string; // ISO timestamp when AI processing completed
  aiFailureReason?: string; // If AI processing failed, why?
}

export interface BlockchainVerification {
  blockchainTxId: string; //Transaction ID on the blockchain
  providerSignature?: string; //Digital signature (for provider records)
  signerId?: string; //ID of who signed it
  blockchainNetwork: string; //blockchain network, e.g. ethereum, solana
  timestamp: number; //when it was recorded
  isVerified: boolean; //whether blockchain verification passed. May change this to a credit system of sorts in the future
}

export type AIProcessingStatus =
  | 'pending' // AI processing not yet started
  | 'processing' // AI is currently processing
  | 'completed' // AI processing finished successfully
  | 'failed' // AI processing failed
  | 'not_needed'; // This record type doesn't need AI processing

export type FileStatus =
  | 'pending' // File uploaded, waiting to process
  | 'processing' // Currently being processed
  | 'uploading' // Currently uploading, use for making sure there aren't multiple uploads
  | 'completed' // Successfully processed
  | 'error'; // Failed with error

export type SourceType = 'Plain Text Submission' | 'Manual FHIR JSON Submission' | 'File Upload';

//Processing Stages good for the progress chips in the Add Record process
export type ProcessingStages =
  | 'Starting processing...'
  | 'Extracting text...'
  | 'Text extraction completed'
  | 'Converting to FHIR...'
  | 'FHIR conversion completed'
  | 'Completing...'
  | 'AI processing...'
  | 'AI analyzing content...'
  | 'Encrypting record data...'
  | 'Record encrypted'
  | 'Generating record hash...'
  | undefined;

export interface VirtualFileInput {
  fileName?: string;
  sourceType?: SourceType;
  extractedText?: string;
  fhirData?: any;
  wordCount?: number;
  [key: string]: any;
}

export interface FileObject {
  id: string; //fileId. Generated in useFileManager via createFileObject() or addVirtualFile(). file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}
  firestoreId?: string; //Id for firestore set after upload
  fileSize: number; //file size. Set in createFileObject in useFileManager.ts. file.size for real files
  fileType: string; //file type. Set in createFileObject in useFileManager.ts. file.type for real files or application/fhir+json for virtual - NEVER undefined
  status: FileStatus; //Processing property. Initially set as pending. Then pending/processing... see below
  error?: string; //Failed processing
  originalFileHash?: string | null; //hash of the original file that was uploaded
  uploadedAt?: string | number;
  wordCount?: number; //calculated during text extraction
  sourceType?: SourceType;
  lastModified?: string; //Filetracking for UI state management.
  isVirtual?: boolean; //for virtual files
  storagePath?: string;
  downloadURL?: string;
  recordHash?: string | null; //has of the record content
  previousRecordHash?: string | null; //to establish chain of records in case they are edited
  processingStage?: ProcessingStages;
  uploadInProgress?: boolean; // for managing upload process

  // PLAIN TEXT PERSONAL HEALTH DATA, MUST BE ENCRYPTED
  fileName: string; //file name or custom name for virtual files. set by createFileObject() in useFileManager.ts
  file?: File; //actual file object from file input. Real life upload not virtual. Generated in createFileObject in useFileManager.ts
  extractedText?: string | null; //text extracted from image/pdf
  originalText?: string | null; //text typed into app by user
  fhirData?: any;
  belroseFields?: BelroseFields; //AI enriched fields for easy labeling within the Belrose App
  customData?: any; //for non-medical data that may come in different formats, but not be particularly suited to FHIR format

  //For processing Belrose, AI enriched Fields
  aiProcessingStatus?: AIProcessingStatus;

  //For versioning purposes
  versionInfo?: {
    versionId?: string;
    timestamp?: string;
    isHistoricalView?: true;
  };

  //Blockchain Verification
  blockchainVerification?: BlockchainVerification;
  isProviderRecord?: boolean;

  encryptedData?: {
    encryptedKey: string; // Single key for all encrypted data (Base64)

    // Encrypted fileName (always exists - contains PII!)
    fileName: {
      encrypted: ArrayBuffer; // Only exists during upload process
      iv: string; // Base64
    };

    // Encrypted file (original upload) - stored in memory during processing
    file?: {
      encrypted: ArrayBuffer; // Only exists during upload process
      iv: string; // Base64
    };

    // Encrypted extracted text
    extractedText?: {
      encrypted: ArrayBuffer; // Only exists during upload process
      iv: string; // Base64
    };

    // Encrypted original text (if exists)
    originalText?: {
      encrypted: ArrayBuffer; // Only exists during upload process
      iv: string; // Base64
    };

    // Encrypted FHIR data (if exists)
    fhirData?: {
      encrypted: ArrayBuffer; // Only exists during upload process
      iv: string; // Base64
    };

    // Encrypted belrose fields (if exists)
    belroseFields?: {
      encrypted: ArrayBuffer; // Only exists during upload process
      iv: string; // Base64
    };

    // Encrypted custom data (if exists)
    customData?: {
      encrypted: ArrayBuffer; // Only exists during upload process
      iv: string; // Base64
    };
  };
}

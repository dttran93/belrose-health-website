import { ReactNode } from 'react';

// ==================== USER & AUTHENTICATION ====================

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
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
  visitType?: string;           // e.g., "Follow-up Appointment", "Lab Results", "Imaging Study"
  title?: string;               // Short descriptive title (e.g., "Cardiology Follow-up")
  summary?: string;             // Slightly longer summary, main information a future reader would need to know
  
  // Key dates and people
  completedDate?: string;       // ISO date string - the main date for this record
  provider?: string;            // Primary provider name
  institution?: string;         // Healthcare institution/facility
  patient?: string;             // Patient Name
  
  // Simple processing metadata
  aiProcessedAt?: string;       // ISO timestamp when AI processing completed
  aiFailureReason?: string;     // If AI processing failed, why?
}

export interface BlockchainVerification {
  recordHash: string; //has of the record content
  blockchainTxId: string; //Transaction ID on the blockchain
  providerSignature?: string; //Digital signature (for provider records)
  signerId?: string; //ID of who signed it
  blockchainNetwork: string; //blockchain network, e.g. ethereum, solana
  timestamp: number; //when it was recorded
  isVerified: boolean; //whether blockchain verification passed. May change this to a credit system of sorts in the future
  previousRecordHash?: string;
}

export type AIProcessingStatus =
  | 'pending'        // AI processing not yet started
  | 'processing'     // AI is currently processing
  | 'completed'      // AI processing finished successfully
  | 'failed'         // AI processing failed
  | 'not_needed';    // This record type doesn't need AI processing

export type FileStatus = 
  | 'pending'      // File uploaded, waiting to process
  | 'processing'   // Currently being processed
  | 'uploading'    // Currently uploading, use for making sure there aren't multiple uploads  
  | 'completed'    // Successfully processed
  | 'error';       // Failed with error

export type SourceType = 'Plain Text Submission' | 'Manual FHIR JSON Submission' | 'File Upload';

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
  file?: File; //actual file object from file input. Real life upload not virtual. Generated in createFileObject in useFileManager.ts
  fileName: string; //file name or custom name for virtual files. set by createFileObject() in useFileManager.ts
  fileSize: number; //file size. Set in createFileObject in useFileManager.ts. file.size for real files
  fileType: string; //file type. Set in createFileObject in useFileManager.ts. file.type for real files or application/fhir+json for virtual - NEVER undefined
  status: FileStatus; //Processing property. Initially set as pending. Then pending/processing... see below
  error?: string; //Failed processing
  extractedText?: string | null; //text extracted from image/pdf
  originalText?: string | null;
  originalFileHash?: string | null; //hash of the original file that was uploaded
  uploadedAt?: string;
  wordCount?: number; //calculated during text extraction
  sourceType?: SourceType;
  lastModified?: number; //Filetracking for UI state management.
  isVirtual?: boolean; //for virtual files
  fhirData?: any;
  downloadURL?: string;
  [key: string]: any;

  //For AI enrichedFields
  belroseFields?: BelroseFields; // Make this optional since not all records may have it yet
  aiProcessingStatus?: AIProcessingStatus;

  //Blockchain Verification
  blockchainVerification?: BlockchainVerification;
  isProviderRecord?: boolean;
}



export type VerificationStatus = 'idle' | 'loading' | 'verifying' | 'complete' | 'error';

export type VerificationProvider = 'idswyft'; //Add others in the future

export interface VerifiedData {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  address: string;
  postcode?: string;
  verified?: boolean;
}

export interface VerificationResult {
  verified: boolean;
  data?: VerifiedData;
  inquiryId: string;
  reason?: string;
}

export interface VerificationAdapterProps {
  userId: string;
  onStatusChange: (status: VerificationStatus) => void;
  onSuccess: (result: VerificationResult) => void;
  onError: (error: Error) => void;
  onBack?: () => void;
}

export type VerificationAdapter = React.ComponentType<VerificationAdapterProps>;

// IDSwyft-specific result structure
export interface IDswyftVerificationResult {
  verificationId: string;
  status: 'verified' | 'failed' | 'manual_review' | 'HARD_REJECTED';
  ocrData: {
    fullName: string;
    dateOfBirth: string;
    idNumber: string;
    expiryDate: string;
    rawText: string;
  };
  rejectionReason?: string;
  retryAvailable?: boolean;
}

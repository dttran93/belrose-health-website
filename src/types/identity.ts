export type VerificationStatus = 'idle' | 'loading' | 'verifying' | 'complete' | 'error';

export type VerificationProvider = 'persona'; //Add others in the future

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
}

export type VerificationAdapter = React.ComponentType<VerificationAdapterProps>;
import React, { useState } from 'react';
import { Shield, CheckCircle, AlertCircle, FileText, Camera, Clock } from 'lucide-react';

// Mock types for demo - replace with your actual types
type VerificationStatus = 'idle' | 'loading' | 'verifying' | 'complete' | 'error';

interface IdentityVerificationProps {
  userId: string;
  onSuccess: (result: any) => void;
  onError: (error: Error) => void;
  isCompleted?: boolean;
  initialVerifiedData?: {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    address: string;
  };
  isActivated?: boolean;
}

const IdentityVerificationForm: React.FC<IdentityVerificationProps> = ({
  userId,
  onSuccess,
  onError,
  isCompleted = false,
  initialVerifiedData,
  isActivated = false,
}) => {
  const [status, setStatus] = useState<VerificationStatus>('idle');

  const handleStartVerification = () => {
    setStatus('loading');
    // This will trigger PersonaAdapter
    console.log('Starting verification for user:', userId);
  };

  const getStatusMessage = () => {
    switch (status) {
      case 'idle':
        return 'Ready to verify your identity';
      case 'loading':
        return 'Preparing verification...';
      case 'verifying':
        return 'Please complete the verification steps';
      case 'complete':
        return 'Identity verified successfully!';
      case 'error':
        return 'Verification failed. Please try again.';
      default:
        return '';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'idle':
        return <Shield className="w-8 h-8 text-white" />;
      case 'loading':
      case 'verifying':
        return <Clock className="w-8 h-8 text-white animate-pulse" />;
      case 'complete':
        return <CheckCircle className="w-8 h-8 text-white" />;
      case 'error':
        return <AlertCircle className="w-8 h-8 text-white" />;
      default:
        return <Shield className="w-8 h-8 text-white" />;
    }
  };

  if (isCompleted && initialVerifiedData) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500 rounded-full mb-4">
            <CheckCircle className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Identity Verified</h2>
          <p className="text-gray-600 mt-2">
            Your identity has been successfully verified with Persona
          </p>
        </div>

        {/* Verified Data Display */}
        <div className="bg-green-50 border-2 border-green-500 rounded-lg p-6">
          <h3 className="font-semibold text-green-900 mb-4">Verified Information</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-green-800">Full Name:</span>
              <span className="text-sm font-medium text-green-900">
                {initialVerifiedData.firstName} {initialVerifiedData.lastName}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-green-800">Date of Birth:</span>
              <span className="text-sm font-medium text-green-900">
                {initialVerifiedData.dateOfBirth}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-green-800">Address:</span>
              <span className="text-sm font-medium text-green-900 text-right max-w-xs">
                {initialVerifiedData.address}
              </span>
            </div>
          </div>
          <p className="text-xs text-green-700 mt-4 pt-4 border-t border-green-200">
            This information is securely stored and encrypted
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 bg-primary">
          {getStatusIcon()}
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Verify Your Identity</h2>
        <p className="text-gray-600 mt-2">
          We use identity verification to avoid bad actors from influencing our ecosystem.
        </p>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900">
            <p className="font-semibold mb-1">Optional, but</p>
            <p className="text-blue-800">
              If you want us to request your medical records from the NHS, we need to verify your
              identity. This is a one-time process that takes about 2-3 minutes.
            </p>
          </div>
        </div>
      </div>

      {/* What You'll Need */}
      {status === 'idle' && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
            <FileText className="w-5 h-5 mr-2 text-gray-600" />
            What you'll need
          </h3>
          <div className="space-y-3">
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-semibold text-blue-600">1</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">Government-issued photo ID</p>
                <p className="text-xs text-gray-600 mt-1">
                  UK passport, driver's license, or national ID card
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-semibold text-blue-600">2</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">Device with camera</p>
                <p className="text-xs text-gray-600 mt-1">
                  To take a photo of your ID and a selfie for verification
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-semibold text-blue-600">3</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">2-3 minutes</p>
                <p className="text-xs text-gray-600 mt-1">
                  Quick process with instant verification
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Status Messages */}
      {status === 'loading' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
            <p className="text-sm text-blue-900">{getStatusMessage()}</p>
          </div>
        </div>
      )}

      {status === 'verifying' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <Clock className="w-5 h-5 text-blue-600 animate-pulse" />
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-900">{getStatusMessage()}</p>
              <p className="text-xs text-blue-700 mt-1">
                Follow the instructions in the verification window
              </p>
            </div>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-900">{getStatusMessage()}</p>
              <p className="text-xs text-red-700 mt-1">
                Please ensure your ID is clear and matches your details
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Security Notice */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <Shield className="w-5 h-5 text-gray-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-gray-700">
            <p className="font-semibold mb-1">Your privacy is protected</p>
            <p className="text-gray-600 text-xs">
              Verification is handled by Persona, a secure identity verification service. Your
              documents are encrypted and stored securely in compliance with GDPR.
            </p>
          </div>
        </div>
      </div>

      {!isActivated && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-900 flex-1">
              <p className="font-semibold mb-2">
                Create your Belrose Account (Step 1) before verifying your identity.
              </p>
            </div>
          </div>
        </div>
      )}

      {isActivated && (
        <>
          {/* Action Button */}
          {status === 'idle' && (
            <button
              onClick={handleStartVerification}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
            >
              <Camera className="w-5 h-5" />
              <span>Start Identity Verification</span>
            </button>
          )}

          {status === 'error' && (
            <button
              onClick={handleStartVerification}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
            >
              Try Again
            </button>
          )}

          {/* This is where PersonaAdapter will actually render when integrated */}
          <div id="persona-container" className="hidden">
            {/* PersonaAdapter component will be rendered here */}
          </div>
        </>
      )}
    </div>
  );
};

export default IdentityVerificationForm;

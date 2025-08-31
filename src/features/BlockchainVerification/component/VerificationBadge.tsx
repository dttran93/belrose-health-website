import React from 'react';
import { FileObject } from '@/types/core';
import { useBlockchainVerification } from '../hooks/useBlockchainVerification';

interface VerificationBadgeProps {
  fileObject: FileObject;
  size?: 'sm' | 'md' | 'lg';
  showDetails?: boolean;
  onClick?: () => void;
}

export const VerificationBadge: React.FC<VerificationBadgeProps> = ({
  fileObject,
  size = 'md',
  showDetails = false,
  onClick
}) => {
  const { getVerificationStatus, isSelfReported } = useBlockchainVerification();
  
  if (!isSelfReported(fileObject)) {
    return "Self-Reported";
  }

  const { status, message, icon } = getVerificationStatus(fileObject);
  
  // Size classes
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1 text-sm', 
    lg: 'px-4 py-2 text-base'
  };

  // Status-based styling
  const getStatusStyles = (status: string) => {
    switch (status) {
      case 'verified':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'unverified':
        return 'bg-gray-100 text-gray-600 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  const badgeClasses = `
    inline-flex items-center gap-1 rounded-full border font-medium
    ${sizeClasses[size]}
    ${getStatusStyles(status)}
    ${onClick ? 'cursor-pointer hover:opacity-80' : ''}
  `.trim();

  return (
    <div 
      className={badgeClasses}
      onClick={onClick}
      title={showDetails ? undefined : message}
    >
      <span>{icon}</span>
      {showDetails ? (
        <span>{message}</span>
      ) : (
        <span>
          {status === 'verified' && 'Verified'}
          {status === 'failed' && 'Failed'}
          {status === 'pending' && 'Pending'}
          {status === 'unverified' && 'Self-reported'}
        </span>
      )}
    </div>
  );
};

// Detailed verification info component
interface VerificationDetailsProps {
  fileObject: FileObject;
}

export const VerificationDetails: React.FC<VerificationDetailsProps> = ({ fileObject }) => {
  const verification = fileObject.blockchainVerification;
  
  if (!verification) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg">
        <h4 className="font-medium text-gray-900 mb-2">No Blockchain Verification</h4>
        <p className="text-sm text-gray-600">
          {fileObject.isProviderRecord 
            ? 'This provider record should have blockchain verification but none was found.'
            : 'This self-reported record does not require blockchain verification.'
          }
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-gray-50 rounded-lg space-y-3">
      <h4 className="font-medium text-gray-900">Blockchain Verification Details</h4>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
        <div>
          <span className="font-medium text-gray-700">Status:</span>
          <div className="mt-1">
            <VerificationBadge fileObject={fileObject} showDetails />
          </div>
        </div>
        
        <div>
          <span className="font-medium text-gray-700">Network:</span>
          <p className="text-gray-600 mt-1">{verification.blockchainNetwork}</p>
        </div>
        
        <div>
          <span className="font-medium text-gray-700">Transaction ID:</span>
          <p className="text-gray-600 mt-1 font-mono text-xs break-all">
            {verification.blockchainTxId}
          </p>
        </div>
        
        <div>
          <span className="font-medium text-gray-700">Recorded:</span>
          <p className="text-gray-600 mt-1">
            {new Date(verification.timestamp).toLocaleString()}
          </p>
        </div>
        
        {verification.signerId && (
          <div>
            <span className="font-medium text-gray-700">Signed by:</span>
            <p className="text-gray-600 mt-1">{verification.signerId}</p>
          </div>
        )}
        
        <div>
          <span className="font-medium text-gray-700">Record Hash:</span>
          <p className="text-gray-600 mt-1 font-mono text-xs break-all">
            {verification.recordHash}
          </p>
        </div>
      </div>
      
      {fileObject.isProviderRecord && (
        <div className="pt-2 border-t border-gray-200">
          <p className="text-xs text-gray-500">
            This provider record is cryptographically verified and cannot be tampered with.
            Any changes would invalidate the blockchain verification.
          </p>
        </div>
      )}
    </div>
  );
};
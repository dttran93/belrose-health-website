import React from 'react';
import HashGeneratorTest from '@/features/BlockchainVerification/component/HashGeneratorTest';

const Verification: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="container mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Blockchain Verification Testing</h1>
          <p className="text-gray-600 mt-2">Test and validate your hash generation functionality</p>
        </div>
        <HashGeneratorTest />
      </div>
    </div>
  );
};

export default Verification;
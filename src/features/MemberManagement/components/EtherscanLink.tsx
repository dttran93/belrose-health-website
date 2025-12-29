// src/features/MemberManagement/components/EtherscanLink.tsx

import React from 'react';
import { ExternalLink } from 'lucide-react';
import { ETHERSCAN_BASE_URL } from '../lib/constants';
import { truncateHash } from '../lib/utils';

interface EtherscanLinkProps {
  txHash?: string;
  type?: 'tx' | 'address' | 'block';
  showIcon?: boolean;
  className?: string;
}

/**
 * Link to Etherscan (Sepolia) for a transaction, address, or block
 */
export const EtherscanLink: React.FC<EtherscanLinkProps> = ({
  txHash,
  type = 'tx',
  showIcon = true,
  className = '',
}) => {
  if (!txHash) {
    return <span className="text-gray-400 text-sm">—</span>;
  }

  const url = `${ETHERSCAN_BASE_URL}/${type}/${txHash}`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1 font-mono text-sm text-blue-600 hover:text-blue-800 hover:underline ${className}`}
      title={`View on Etherscan: ${txHash}`}
    >
      {truncateHash(txHash, 6, 4)}
      {showIcon && <ExternalLink className="w-3 h-3" />}
    </a>
  );
};

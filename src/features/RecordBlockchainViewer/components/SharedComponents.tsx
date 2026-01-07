// src/features/HealthRecordViewer/components/SharedComponents.tsx

import React from 'react';
import { AlertCircle, Loader2, FileText } from 'lucide-react';

// ===============================================================
// SEARCH INPUT
// ===============================================================

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChange,
  placeholder = 'Search...',
}) => {
  return (
    <input
      type="text"
      placeholder={placeholder}
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full px-4 py-2 bg-background border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
    />
  );
};

// ===============================================================
// LOADING STATE
// ===============================================================

interface LoadingStateProps {
  message?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading data from blockchain...',
}) => (
  <div className="flex items-center justify-center py-16">
    <div className="text-center">
      <Loader2 className="w-10 h-10 animate-spin text-blue-500 mx-auto mb-4" />
      <p className="text-gray-500">{message}</p>
    </div>
  </div>
);

// ===============================================================
// EMPTY STATE
// ===============================================================

interface EmptyStateProps {
  hasFilters: boolean;
  entityName?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ hasFilters, entityName = 'items' }) => (
  <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
    <FileText className="w-16 h-16 mx-auto text-gray-300 mb-4" />
    <p className="text-gray-500 text-lg">
      {hasFilters ? `No ${entityName} match your search` : `No ${entityName} found`}
    </p>
  </div>
);

// ===============================================================
// ERROR ALERT
// ===============================================================

interface ErrorAlertProps {
  message: string;
  details?: string;
}

export const ErrorAlert: React.FC<ErrorAlertProps> = ({ message, details }) => (
  <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start gap-3">
    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
    <div>
      <p className="font-medium text-red-800">Failed to load data</p>
      <p className="text-sm text-red-600 mt-1">{message}</p>
      {details && <p className="text-xs text-red-500 mt-2">{details}</p>}
    </div>
  </div>
);

// ===============================================================
// STATUS BADGE
// ===============================================================

interface StatusBadgeProps {
  isActive: boolean;
  activeLabel?: string;
  inactiveLabel?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  isActive,
  activeLabel = 'Active',
  inactiveLabel = 'Inactive',
}) => (
  <span
    className={`text-xs px-2 py-1 rounded-full ${
      isActive ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'
    }`}
  >
    {isActive ? activeLabel : inactiveLabel}
  </span>
);

// ===============================================================
// HASH DISPLAY WITH COPY
// ===============================================================

interface HashDisplayProps {
  hash: string;
  truncateStart?: number;
  truncateEnd?: number;
  className?: string;
}

export const HashDisplay: React.FC<HashDisplayProps> = ({
  hash,
  truncateStart = 8,
  truncateEnd = 6,
  className = '',
}) => {
  const [copied, setCopied] = React.useState(false);

  const displayHash =
    hash.length > truncateStart + truncateEnd
      ? `${hash.slice(0, truncateStart)}...${hash.slice(-truncateEnd)}`
      : hash;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(hash);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Silently fail
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={`font-mono text-sm hover:bg-gray-100 px-1 py-0.5 rounded transition-colors ${className}`}
      title={copied ? 'Copied!' : `Click to copy: ${hash}`}
    >
      {displayHash}
      {copied && <span className="ml-1 text-green-600 text-xs">✓</span>}
    </button>
  );
};

// ===============================================================
// TABLE WRAPPER
// ===============================================================

interface TableWrapperProps {
  children: React.ReactNode;
}

export const TableWrapper: React.FC<TableWrapperProps> = ({ children }) => (
  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
    <div className="overflow-x-auto">{children}</div>
  </div>
);

// ===============================================================
// TABLE HEADER
// ===============================================================

interface TableHeaderProps {
  columns: string[];
}

export const TableHeader: React.FC<TableHeaderProps> = ({ columns }) => (
  <thead className="bg-gray-50 border-b border-gray-200">
    <tr>
      {columns.map((col, idx) => (
        <th
          key={idx}
          className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider"
        >
          {col}
        </th>
      ))}
    </tr>
  </thead>
);

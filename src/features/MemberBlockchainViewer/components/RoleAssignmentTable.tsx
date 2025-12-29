// src/features/MemberManagement/components/RoleAssignmentsTable.tsx

import React from 'react';
import { User, FileText } from 'lucide-react';
import type { RoleAssignment } from '@/features/MemberBlockchainViewer/lib/types';
import {
  truncateHash,
  copyToClipboard,
  getRoleInfo,
  capitalizeFirst,
} from '@/features/MemberBlockchainViewer/lib/utils';
import { EtherscanLink } from './EtherscanLink';

interface RoleAssignmentsTableProps {
  assignments: RoleAssignment[];
}

/**
 * Table displaying all role assignments across all records
 */
export const RoleAssignmentsTable: React.FC<RoleAssignmentsTableProps> = ({ assignments }) => {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Record ID
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                User
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Role
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Transaction
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {assignments.map((assignment, index) => (
              <RoleAssignmentRow
                key={`${assignment.recordId}-${assignment.userIdHash}-${index}`}
                assignment={assignment}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/**
 * Single row in the role assignments table
 */
const RoleAssignmentRow: React.FC<{ assignment: RoleAssignment }> = ({ assignment }) => {
  const roleInfo = getRoleInfo(assignment.role);

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      {/* Record ID */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-gray-400" />
          <button
            onClick={() => copyToClipboard(assignment.recordId)}
            className="font-mono text-sm text-gray-700 hover:text-blue-600"
            title="Click to copy"
          >
            {assignment.recordId}
          </button>
        </div>
      </td>

      {/* User */}
      <td className="px-4 py-3 text-left">
        {assignment.profile ? (
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-gray-400" />
              <span className="font-medium text-gray-900">{assignment.profile.displayName}</span>
            </div>
            <span className="text-xs text-gray-500 ml-6">{assignment.profile.email}</span>
          </div>
        ) : (
          <button
            onClick={() => copyToClipboard(assignment.userIdHash)}
            className="font-mono text-sm text-gray-700 hover:text-blue-600"
            title="Click to copy"
          >
            {truncateHash(assignment.userIdHash, 8, 4)}
          </button>
        )}
      </td>

      {/* Role */}
      <td className="px-4 py-3 text-left">
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${roleInfo.color}`}
        >
          {roleInfo.icon}
          {capitalizeFirst(assignment.role)}
        </span>
      </td>

      {/* Status */}
      <td className="px-4 py-3 text-left">
        <span
          className={`text-xs px-2 py-1 rounded-full ${
            assignment.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'
          }`}
        >
          {assignment.isActive ? 'Active' : 'Inactive'}
        </span>
      </td>

      {/* Transaction */}
      <td className="px-4 py-3 text-left">
        <EtherscanLink txHash={assignment.txHash} />
      </td>
    </tr>
  );
};

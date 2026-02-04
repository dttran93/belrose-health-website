// src/features/MemberBlockchainViewer/components/MemberBlockchainDashboard.tsx

import React from 'react';
import {
  RefreshCw,
  Users,
  Shield,
  CheckCircle,
  AlertCircle,
  Loader2,
  Crown,
  Eye,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { StatsCard } from '@/features/MemberBlockchainViewer/components/StatsCard';
import { UsersTable } from '@/features/MemberBlockchainViewer/components/UsersTable';
import { WalletsPanel } from '@/features/MemberBlockchainViewer/components/WalletsPanel';
import { RoleDetailsPanel } from '@/features/MemberBlockchainViewer/components/RoleDetailsPanel';
import { UserStatus } from '@/features/MemberBlockchainViewer/lib/types';
import { getStatusInfo } from '@/features/MemberBlockchainViewer/lib/utils';
import { useMemberDashboard } from '@/features/MemberBlockchainViewer/hooks/useMemberDashboards';
import { RoleAssignmentsTable } from '@/features/MemberBlockchainViewer/components/RoleAssignmentTable';
import { usePaymasterDeposit } from '@/features/MemberBlockchainViewer/hooks/usePaymasterDeposit';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

interface StatusFilterProps {
  currentFilter: 'all' | UserStatus;
  onFilterChange: (status: 'all' | UserStatus) => void;
  counts: Record<'all' | UserStatus, number>;
}

interface ErrorAlertProps {
  message: string;
  details?: string;
}

interface EmptyStateProps {
  hasFilters: boolean;
}

type RoleFilterValue = 'all' | 'owner' | 'administrator' | 'viewer';

interface RoleFilterProps {
  currentFilter: RoleFilterValue;
  onFilterChange: (role: RoleFilterValue) => void;
  counts?: {
    all: number;
    owner: number;
    administrator: number;
    viewer: number;
  };
}

/**
 * Filter buttons for role types
 */
export const RoleFilter: React.FC<RoleFilterProps> = ({
  currentFilter,
  onFilterChange,
  counts,
}) => {
  const filters: Array<{ value: RoleFilterValue; label: string; icon?: React.ReactNode }> = [
    { value: 'all', label: 'All' },
    { value: 'owner', label: 'Owner', icon: <Crown className="w-3 h-3" /> },
    { value: 'administrator', label: 'Admin', icon: <Shield className="w-3 h-3" /> },
    { value: 'viewer', label: 'Viewer', icon: <Eye className="w-3 h-3" /> },
  ];

  return (
    <div className="flex gap-2 flex-wrap">
      {filters.map(({ value, label, icon }) => {
        const isActive = currentFilter === value;
        const count = counts?.[value];

        return (
          <button
            key={value}
            onClick={() => onFilterChange(value)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              isActive ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {icon}
            {label}
            {count !== undefined && ` (${count})`}
          </button>
        );
      })}
    </div>
  );
};

/**
 * Empty state for when no users match filters or none exist
 */
export const EmptyState: React.FC<EmptyStateProps> = ({ hasFilters }) => (
  <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
    <Users className="w-16 h-16 mx-auto text-gray-300 mb-4" />
    <p className="text-gray-500 text-lg">
      {hasFilters ? 'No users match your filters' : 'No users registered yet'}
    </p>
  </div>
);

/**
 * Loading state while fetching users
 */
export const LoadingState: React.FC = () => (
  <div className="flex items-center justify-center py-16">
    <div className="text-center">
      <Loader2 className="w-10 h-10 animate-spin text-blue-500 mx-auto mb-4" />
      <p className="text-gray-500">Loading users from blockchain...</p>
    </div>
  </div>
);

/**
 * Error alert banner for displaying fetch errors
 */
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

/**
 * Filter buttons for user status
 *
 * Shows pill buttons for All, Verified, Active, Inactive with counts
 */
export const StatusFilter: React.FC<StatusFilterProps> = ({
  currentFilter,
  onFilterChange,
  counts,
}) => {
  const filters: Array<'all' | UserStatus> = [
    'all',
    UserStatus.Verified,
    UserStatus.Active,
    UserStatus.Inactive,
  ];

  return (
    <div className="flex gap-2 flex-wrap">
      {filters.map(status => {
        const label = status === 'all' ? 'All' : getStatusInfo(status).label;
        const count = counts[status];
        const isActive = currentFilter === status;

        return (
          <button
            key={status}
            onClick={() => onFilterChange(status)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              isActive ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {label} ({count})
          </button>
        );
      })}
    </div>
  );
};

/**
 * Search input field for filtering users
 */
export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChange,
  placeholder = 'Search by name, email, wallet address, or identity hash...',
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

/**
 * Admin Dashboard for viewing all registered members and their roles
 *
 * Features two views:
 * - Users view: List of all registered identities
 * - Roles view: List of all role assignments (click "Total Role Assignments" to switch)
 */
const MemberDashboard: React.FC = () => {
  const {
    // View
    currentView,
    setCurrentView,
    // Data
    stats,
    filteredUsers,
    filteredRoleAssignments,
    isLoading,
    isLoadingAssignments,
    error,
    // Filters
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    statusCounts,
    roleFilter,
    setRoleFilter,
    // Actions
    refresh,
    // Roles modal
    selectedUserForRoles,
    roles,
    isLoadingRoles,
    viewRoles,
    closeRolesModal,
    // Wallets modal
    selectedUserForWallets,
    viewWallets,
    closeWalletsModal,
  } = useMemberDashboard();

  const { deposit, isLoading: isLoadingDeposit } = usePaymasterDeposit(0.01);

  const hasFilters = searchQuery !== '' || statusFilter !== 'all' || roleFilter !== 'all';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">User & Role Registry</h1>
              <p className="text-gray-500 mt-1">
                View all registered identities, their wallets, and role assignments
              </p>
            </div>
            <Button onClick={refresh} disabled={isLoading} className="flex items-center gap-2">
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Error State */}
        {error && (
          <ErrorAlert
            message={error}
            details="Make sure the contract address is correct and you're connected to Sepolia."
          />
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <button
            onClick={() => setCurrentView('users')}
            className="h-full text-left transition-transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-xl"
          >
            <StatsCard
              title="Total Users (Identities)"
              value={stats.totalUsers}
              icon={<Users className="w-6 h-6 text-blue-600" />}
              color={`${currentView === 'users' ? 'ring-2 ring-blue-500' : ''} bg-blue-50 border-blue-200 text-blue-900`}
            />
          </button>

          <button
            onClick={() => setCurrentView('verified')}
            className="text-left transition-transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 rounded-xl"
          >
            <StatsCard
              title="Verified Users"
              value={statusCounts[UserStatus.Verified]}
              icon={<CheckCircle className="w-6 h-6 text-emerald-600" />}
              color={`${currentView === 'verified' ? 'ring-2 ring-emerald-500' : ''} bg-emerald-50 border-emerald-200 text-emerald-900`}
            />
          </button>

          <button
            onClick={() => setCurrentView('roles')}
            className="text-left transition-transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 rounded-xl"
          >
            <StatsCard
              title="Total Role Assignments"
              value={stats.totalRoles}
              icon={<Shield className="w-6 h-6 text-purple-600" />}
              color={`${currentView === 'roles' ? 'ring-2 ring-purple-500' : ''} bg-purple-50 border-purple-200 text-purple-900`}
            />
          </button>
          <div className="text-left">
            <StatsCard
              title="Paymaster Deposit"
              value={
                isLoadingDeposit
                  ? '...'
                  : `${parseFloat(deposit?.depositEth || '0').toFixed(4)} ETH`
              }
              icon={
                <Wallet
                  className={`w-6 h-6 ${deposit?.isLow ? 'text-red-600' : 'text-cyan-600'}`}
                />
              }
              color={
                deposit?.isLow
                  ? 'bg-red-50 border-red-200 text-red-900'
                  : 'bg-cyan-50 border-cyan-200 text-cyan-900'
              }
            />
            {deposit?.isLow && (
              <p className="text-xs text-red-600 mt-1 ml-1">⚠️ Low balance - needs funding</p>
            )}
          </div>
        </div>

        {/* View indicator */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm text-gray-500">Viewing:</span>
          <span className="text-sm font-medium text-gray-900">
            {currentView === 'users' || currentView === 'verified' ? 'Users' : 'Role Assignments'}
          </span>
        </div>

        {/* Filters - Different filters for each view */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <SearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder={
                  currentView === 'users'
                    ? 'Search by name, email, wallet, or identity hash...'
                    : 'Search by record ID, name, or email...'
                }
              />
            </div>
            {currentView === 'users' || currentView === 'verified' ? (
              <StatusFilter
                currentFilter={statusFilter}
                onFilterChange={setStatusFilter}
                counts={statusCounts}
              />
            ) : (
              <RoleFilter currentFilter={roleFilter} onFilterChange={setRoleFilter} />
            )}
          </div>
        </div>

        {/* Content - Switch based on view */}
        {currentView === 'users' || currentView === 'verified' ? (
          // Users View
          isLoading ? (
            <LoadingState />
          ) : filteredUsers.length === 0 ? (
            <EmptyState hasFilters={hasFilters} />
          ) : (
            <UsersTable users={filteredUsers} onViewRoles={viewRoles} onViewWallets={viewWallets} />
          )
        ) : // Role Assignments View
        isLoadingAssignments ? (
          <LoadingState />
        ) : filteredRoleAssignments.length === 0 ? (
          <EmptyState hasFilters={hasFilters} />
        ) : (
          <RoleAssignmentsTable assignments={filteredRoleAssignments} />
        )}
      </div>

      {/* Modals */}
      {selectedUserForRoles && (
        <RoleDetailsPanel
          user={selectedUserForRoles}
          roles={roles}
          isLoading={isLoadingRoles}
          onClose={closeRolesModal}
        />
      )}

      {selectedUserForWallets && (
        <WalletsPanel user={selectedUserForWallets} onClose={closeWalletsModal} />
      )}
    </div>
  );
};

export default MemberDashboard;

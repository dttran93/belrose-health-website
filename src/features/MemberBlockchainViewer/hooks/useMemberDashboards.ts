// src/features/MemberManagement/hooks/useMemberDashboard.ts

import { useState, useEffect, useCallback } from 'react';
import {
  getAllUsers,
  getStats,
  getUserRoles,
  getAllRoleAssignments,
} from '../services/memberRoleService';
import type { UserData, DashboardStats, RoleAssignment, UserStatus } from '../lib/types';

export type DashboardView = 'users' | 'verified' | 'roles';

interface UseMemberDashboardReturn {
  // View state
  currentView: DashboardView;
  setCurrentView: (view: DashboardView) => void;

  // Data
  users: UserData[];
  stats: DashboardStats;
  filteredUsers: UserData[];

  // Role assignments data (for roles view)
  allRoleAssignments: RoleAssignment[];
  filteredRoleAssignments: RoleAssignment[];
  isLoadingAssignments: boolean;

  // Loading/error state
  isLoading: boolean;
  error: string | null;

  // Filters
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  statusFilter: 'all' | UserStatus;
  setStatusFilter: (status: 'all' | UserStatus) => void;
  statusCounts: Record<'all' | UserStatus, number>;

  // Role filter (for roles view)
  roleFilter: 'all' | 'owner' | 'administrator' | 'viewer';
  setRoleFilter: (role: 'all' | 'owner' | 'administrator' | 'viewer') => void;

  // Actions
  refresh: () => Promise<void>;

  // Roles modal
  selectedUserForRoles: UserData | null;
  roles: RoleAssignment[];
  isLoadingRoles: boolean;
  viewRoles: (user: UserData) => Promise<void>;
  closeRolesModal: () => void;

  // Wallets modal
  selectedUserForWallets: UserData | null;
  viewWallets: (user: UserData) => void;
  closeWalletsModal: () => void;
}

/**
 * Combined hook for the Member Dashboard
 *
 * Handles:
 * - View toggling between users and role assignments
 * - Fetching users and stats from blockchain + Firebase
 * - Fetching all role assignments
 * - Search and status/role filtering
 * - Role details modal state + data fetching
 * - Wallet details modal state
 */
export function useMemberDashboard(): UseMemberDashboardReturn {
  // ============================================
  // View state
  // ============================================
  const [currentView, setCurrentView] = useState<DashboardView>('users');

  // ============================================
  // Main data state
  // ============================================
  const [users, setUsers] = useState<UserData[]>([]);
  const [stats, setStats] = useState<DashboardStats>({ totalUsers: 0, totalRoles: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ============================================
  // Role assignments state (for roles view)
  // ============================================
  const [allRoleAssignments, setAllRoleAssignments] = useState<RoleAssignment[]>([]);
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(false);
  const [hasLoadedAssignments, setHasLoadedAssignments] = useState(false);

  // ============================================
  // Filter state
  // ============================================
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | UserStatus>('all');
  const [roleFilter, setRoleFilter] = useState<'all' | 'owner' | 'administrator' | 'viewer'>('all');

  // ============================================
  // Roles modal state
  // ============================================
  const [selectedUserForRoles, setSelectedUserForRoles] = useState<UserData | null>(null);
  const [roles, setRoles] = useState<RoleAssignment[]>([]);
  const [isLoadingRoles, setIsLoadingRoles] = useState(false);

  // ============================================
  // Wallets modal state
  // ============================================
  const [selectedUserForWallets, setSelectedUserForWallets] = useState<UserData | null>(null);

  // ============================================
  // Data fetching - Users
  // ============================================

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [usersData, statsData] = await Promise.all([getAllUsers(), getStats()]);

      setUsers(usersData);
      setStats(statsData);
      console.log('✅ Users data loaded successfully');
    } catch (err: any) {
      console.error('❌ Failed to fetch users:', err);
      setError(err.message || 'Failed to fetch data from blockchain');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch on mount
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ============================================
  // Data fetching - Role Assignments (lazy load)
  // ============================================

  const fetchRoleAssignments = useCallback(async () => {
    if (hasLoadedAssignments || isLoadingAssignments) return;

    setIsLoadingAssignments(true);
    try {
      const assignments = await getAllRoleAssignments(users);
      setAllRoleAssignments(assignments);
      setHasLoadedAssignments(true);
      console.log('✅ Role assignments loaded successfully');
    } catch (err) {
      console.error('❌ Failed to fetch role assignments:', err);
    } finally {
      setIsLoadingAssignments(false);
    }
  }, [users, hasLoadedAssignments, isLoadingAssignments]);

  // Fetch role assignments when switching to roles view (lazy loading)
  useEffect(() => {
    if (currentView === 'roles' && users.length > 0 && !hasLoadedAssignments) {
      fetchRoleAssignments();
    }
  }, [currentView, users, hasLoadedAssignments, fetchRoleAssignments]);

  // ============================================
  // Filtering - Users
  // ============================================

  const filteredUsers = users.filter(user => {
    const matchesSearch =
      searchQuery === '' ||
      user.userIdHash.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.wallets.some(w => w.address.toLowerCase().includes(searchQuery.toLowerCase())) ||
      user.profile?.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.profile?.email.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const statusCounts = {
    all: users.length,
    0: users.filter(u => u.status === 0).length,
    1: users.filter(u => u.status === 1).length,
    2: users.filter(u => u.status === 2).length,
    3: users.filter(u => u.status === 3).length,
  } as Record<'all' | UserStatus, number>;

  // ============================================
  // Filtering - Role Assignments
  // ============================================

  const filteredRoleAssignments = allRoleAssignments.filter(assignment => {
    const matchesSearch =
      searchQuery === '' ||
      assignment.recordId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      assignment.userIdHash.toLowerCase().includes(searchQuery.toLowerCase()) ||
      assignment.profile?.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      assignment.profile?.email.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRole = roleFilter === 'all' || assignment.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  // ============================================
  // Roles modal actions
  // ============================================

  const viewRoles = useCallback(async (user: UserData) => {
    setSelectedUserForRoles(user);
    setIsLoadingRoles(true);
    setRoles([]);

    try {
      const userRoles = await getUserRoles(user.userIdHash, user.records);
      setRoles(userRoles);
    } catch (err) {
      console.error('Failed to fetch user roles:', err);
    } finally {
      setIsLoadingRoles(false);
    }
  }, []);

  const closeRolesModal = useCallback(() => {
    setSelectedUserForRoles(null);
    setRoles([]);
  }, []);

  // ============================================
  // Wallets modal actions
  // ============================================

  const viewWallets = useCallback((user: UserData) => {
    setSelectedUserForWallets(user);
  }, []);

  const closeWalletsModal = useCallback(() => {
    setSelectedUserForWallets(null);
  }, []);

  // ============================================
  // Refresh (resets everything)
  // ============================================

  const refresh = useCallback(async () => {
    setHasLoadedAssignments(false);
    setAllRoleAssignments([]);
    await fetchData();
  }, [fetchData]);

  // ============================================
  // Return
  // ============================================

  return {
    // View
    currentView,
    setCurrentView,

    // Data
    users,
    stats,
    filteredUsers,

    // Role assignments
    allRoleAssignments,
    filteredRoleAssignments,
    isLoadingAssignments,

    // Loading/error
    isLoading,
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
  };
}

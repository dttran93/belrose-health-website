// src/pages/BlockchainAdminDashboard.tsx
/**
 * Blockchain Admin Dashboard Page
 *
 * This page displays all registered members and their roles from the
 * MemberRoleManager smart contract. It's a read-only view for administrators
 * to monitor the system.
 *
 * Key Concepts:
 * - ethers.js: Library for interacting with Ethereum blockchain
 * - Contract ABI: The "interface" that tells JS how to call smart contract functions
 * - Provider: Connection to the blockchain (read-only)
 * - useState/useEffect: React hooks for state management and side effects
 */

import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import {
  Users,
  Shield,
  Eye,
  Crown,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

// ============================================================================
// CONTRACT CONFIGURATION
// ============================================================================

// Your deployed MemberRoleManager contract address
// TODO: Replace with your actual deployed contract address
const MEMBER_ROLE_MANAGER_ADDRESS = '0xD671B0cB1cB10330d9Ed05dC1D1F6E63802Cf4A9';

// Contract ABI - Only the functions we need for reading data
// This tells ethers.js how to interact with your smart contract
const MEMBER_ROLE_MANAGER_ABI = [
  // Member Registry Functions
  {
    inputs: [],
    name: 'getAllMembers',
    outputs: [{ internalType: 'address[]', name: '', type: 'address[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'user', type: 'address' }],
    name: 'getMember',
    outputs: [
      { internalType: 'bytes32', name: 'userIdHash', type: 'bytes32' },
      { internalType: 'uint8', name: 'status', type: 'uint8' },
      { internalType: 'uint256', name: 'joinedAt', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalMembers',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getTotalRoles',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Role Management Functions
  {
    inputs: [{ internalType: 'address', name: 'user', type: 'address' }],
    name: 'getRecordsByUser',
    outputs: [{ internalType: 'string[]', name: '', type: 'string[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'string', name: 'recordId', type: 'string' },
      { internalType: 'address', name: 'user', type: 'address' },
    ],
    name: 'getRoleDetails',
    outputs: [
      { internalType: 'string', name: 'role', type: 'string' },
      { internalType: 'uint256', name: 'grantedAt', type: 'uint256' },
      { internalType: 'uint256', name: 'lastModified', type: 'uint256' },
      { internalType: 'address', name: 'grantedBy', type: 'address' },
      { internalType: 'bool', name: 'isActive', type: 'bool' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'string', name: 'recordId', type: 'string' }],
    name: 'getRecordOwners',
    outputs: [{ internalType: 'address[]', name: '', type: 'address[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'string', name: 'recordId', type: 'string' }],
    name: 'getRecordAdmins',
    outputs: [{ internalType: 'address[]', name: '', type: 'address[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'string', name: 'recordId', type: 'string' }],
    name: 'getRecordViewers',
    outputs: [{ internalType: 'address[]', name: '', type: 'address[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'string', name: 'recordId', type: 'string' }],
    name: 'getRecordRoleStats',
    outputs: [
      { internalType: 'uint256', name: 'ownerCount', type: 'uint256' },
      { internalType: 'uint256', name: 'adminCount', type: 'uint256' },
      { internalType: 'uint256', name: 'viewerCount', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
];

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

// Maps to the MemberStatus enum in your smart contract
enum MemberStatus {
  Inactive = 0,
  Active = 1,
  Verified = 2,
}

// TypeScript interface for member data
interface MemberData {
  address: string;
  userIdHash: string;
  status: MemberStatus;
  joinedAt: Date;
  records: string[]; // Record IDs this member has roles on
}

// Interface for role assignment data
interface RoleAssignment {
  recordId: string;
  user: string;
  role: 'owner' | 'administrator' | 'viewer';
  grantedAt: Date;
  lastModified: Date;
  grantedBy: string;
  isActive: boolean;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format a date for display
 */
function formatDate(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Get status display info (label and color)
 */
function getStatusInfo(status: MemberStatus): {
  label: string;
  color: string;
  icon: React.ReactNode;
} {
  switch (status) {
    case MemberStatus.Verified:
      return {
        label: 'Verified',
        color: 'bg-emerald-100 text-emerald-700 border-emerald-200',
        icon: <CheckCircle className="w-3 h-3" />,
      };
    case MemberStatus.Active:
      return {
        label: 'Active',
        color: 'bg-blue-100 text-blue-700 border-blue-200',
        icon: <CheckCircle className="w-3 h-3" />,
      };
    case MemberStatus.Inactive:
      return {
        label: 'Inactive',
        color: 'bg-gray-100 text-gray-500 border-gray-200',
        icon: <XCircle className="w-3 h-3" />,
      };
    default:
      return {
        label: 'Unknown',
        color: 'bg-gray-100 text-gray-500 border-gray-200',
        icon: <AlertCircle className="w-3 h-3" />,
      };
  }
}

/**
 * Get role display info
 */
function getRoleInfo(role: string): { color: string; icon: React.ReactNode } {
  switch (role.toLowerCase()) {
    case 'owner':
      return {
        color: 'bg-amber-100 text-amber-700 border-amber-200',
        icon: <Crown className="w-3 h-3" />,
      };
    case 'administrator':
      return {
        color: 'bg-purple-100 text-purple-700 border-purple-200',
        icon: <Shield className="w-3 h-3" />,
      };
    case 'viewer':
      return {
        color: 'bg-sky-100 text-sky-700 border-sky-200',
        icon: <Eye className="w-3 h-3" />,
      };
    default:
      return {
        color: 'bg-gray-100 text-gray-500 border-gray-200',
        icon: <Users className="w-3 h-3" />,
      };
  }
}

// ============================================================================
// BLOCKCHAIN SERVICE
// ============================================================================

/**
 * Service class for reading data from the MemberRoleManager contract
 *
 * Note: This uses a read-only provider, so no wallet connection is needed.
 * For Sepolia testnet, we use a public RPC endpoint.
 */
/**
 * Type definition for our contract's methods
 *
 * This tells TypeScript exactly what methods exist on our contract
 * and what they return. Without this, TS doesn't know the contract
 * has methods like "getAllMembers" since it's loaded dynamically from the ABI.
 */
interface MemberRoleManagerContract {
  getAllMembers(): Promise<string[]>;
  getMember(user: string): Promise<[string, bigint, bigint]>;
  getRecordsByUser(user: string): Promise<string[]>;
  totalMembers(): Promise<bigint>;
  getTotalRoles(): Promise<bigint>;
  getRoleDetails(
    recordId: string,
    user: string
  ): Promise<[string, bigint, bigint, string, boolean]>;
  getRecordOwners(recordId: string): Promise<string[]>;
  getRecordAdmins(recordId: string): Promise<string[]>;
  getRecordViewers(recordId: string): Promise<string[]>;
  getRecordRoleStats(recordId: string): Promise<[bigint, bigint, bigint]>;
}

class MemberRoleService {
  private provider: ethers.JsonRpcProvider;
  private contract: MemberRoleManagerContract;

  constructor() {
    // Create a read-only provider for Sepolia testnet
    // You can also use: 'https://sepolia.infura.io/v3/YOUR_KEY'
    this.provider = new ethers.JsonRpcProvider('https://1rpc.io/sepolia');

    // Cast to our typed interface so TypeScript knows what methods exist
    this.contract = new ethers.Contract(
      MEMBER_ROLE_MANAGER_ADDRESS,
      MEMBER_ROLE_MANAGER_ABI,
      this.provider
    ) as unknown as MemberRoleManagerContract;
  }

  /**
   * Fetch all registered members with their details
   */
  async getAllMembers(): Promise<MemberData[]> {
    try {
      // Get array of all member addresses
      const memberAddresses = await this.contract.getAllMembers();
      console.log(`📋 Found ${memberAddresses.length} members`);

      // Fetch details for each member
      const members: MemberData[] = await Promise.all(
        memberAddresses.map(async address => {
          const [userIdHash, status, joinedAt] = await this.contract.getMember(address);
          const records = await this.contract.getRecordsByUser(address);

          return {
            address,
            userIdHash,
            status: Number(status) as MemberStatus,
            joinedAt: new Date(Number(joinedAt) * 1000), // Convert from Unix timestamp
            records,
          };
        })
      );

      return members;
    } catch (error) {
      console.error('❌ Failed to fetch members:', error);
      throw error;
    }
  }

  /**
   * Get total counts for the dashboard stats
   */
  async getStats(): Promise<{ totalMembers: number; totalRoles: number }> {
    const [totalMembers, totalRoles] = await Promise.all([
      this.contract.totalMembers(),
      this.contract.getTotalRoles(),
    ]);
    return {
      totalMembers: Number(totalMembers),
      totalRoles: Number(totalRoles),
    };
  }

  /**
   * Get role details for a specific user on a specific record
   */
  async getRoleDetails(recordId: string, userAddress: string): Promise<RoleAssignment | null> {
    try {
      const [role, grantedAt, lastModified, grantedBy, isActive] =
        await this.contract.getRoleDetails(recordId, userAddress);

      if (!isActive) return null;

      return {
        recordId,
        user: userAddress,
        role: role as 'owner' | 'administrator' | 'viewer',
        grantedAt: new Date(Number(grantedAt) * 1000),
        lastModified: new Date(Number(lastModified) * 1000),
        grantedBy,
        isActive,
      };
    } catch (error) {
      console.error('Failed to get role details:', error);
      return null;
    }
  }
}

// ============================================================================
// COMPONENT: Stats Card
// ============================================================================

interface StatsCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}

const StatsCard: React.FC<StatsCardProps> = ({ title, value, icon, color }) => (
  <div className={`rounded-xl p-5 ${color} border shadow-sm`}>
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium opacity-80">{title}</p>
        <p className="text-3xl font-bold mt-1">{value}</p>
      </div>
      <div className="p-3 rounded-full bg-white/50">{icon}</div>
    </div>
  </div>
);

// ============================================================================
// COMPONENT: Members Table
// ============================================================================

interface MembersTableProps {
  members: MemberData[];
  onViewRoles: (member: MemberData) => void;
}

const MembersTable: React.FC<MembersTableProps> = ({ members, onViewRoles }) => {
  // Copy to clipboard helper
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Wallet Address
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                User ID Hash
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Joined
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Records
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {members.map(member => {
              const statusInfo = getStatusInfo(member.status);
              return (
                <tr key={member.address} className="hover:bg-gray-50 transition-colors">
                  {/* Wallet Address */}
                  <td className="px-4 py-3">
                    <button
                      onClick={() => copyToClipboard(member.address)}
                      className="font-mono text-sm text-gray-700 hover:text-blue-600 transition-colors text-left"
                      title="Click to copy"
                    >
                      {member.address}
                    </button>
                  </td>

                  {/* User ID Hash */}
                  <td className="px-4 py-3">
                    <button
                      onClick={() => copyToClipboard(member.userIdHash)}
                      className="font-mono text-sm text-gray-500 hover:text-blue-600 transition-colors text-left"
                      title="Click to copy"
                    >
                      {member.userIdHash}
                    </button>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${statusInfo.color}`}
                    >
                      {statusInfo.icon}
                      {statusInfo.label}
                    </span>
                  </td>

                  {/* Joined Date */}
                  <td className="px-4 py-3 text-sm text-gray-600">{formatDate(member.joinedAt)}</td>

                  {/* Records Count */}
                  <td className="px-4 py-3 text-sm text-gray-600">{member.records.length}</td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onViewRoles(member)}
                      className="text-xs"
                      disabled={member.records.length === 0}
                    >
                      <Eye className="w-3 h-3 mr-1" />
                      View Roles
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ============================================================================
// COMPONENT: Role Details Modal/Panel
// ============================================================================

interface RoleDetailsPanelProps {
  member: MemberData;
  roles: RoleAssignment[];
  isLoading: boolean;
  onClose: () => void;
}

const RoleDetailsPanel: React.FC<RoleDetailsPanelProps> = ({
  member,
  roles,
  isLoading,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Role Assignments</h3>
              <p className="text-sm text-gray-500 font-mono">{member.address}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-200 rounded-full transition-colors"
            >
              <XCircle className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : roles.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No active roles found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Record ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Granted At
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Granted By
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {roles.map((role, index) => {
                    const roleInfo = getRoleInfo(role.role);
                    return (
                      <tr key={`${role.recordId}-${index}`} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${roleInfo.color}`}
                          >
                            {roleInfo.icon}
                            {role.role.charAt(0).toUpperCase() + role.role.slice(1)}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-sm text-gray-700">
                          {role.recordId}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {formatDate(role.grantedAt)}
                        </td>
                        <td className="px-4 py-3 font-mono text-sm text-gray-500">
                          {role.grantedBy}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT: Admin Dashboard
// ============================================================================

const BlockchainAdminDashboard: React.FC = () => {
  // State for storing fetched data
  const [members, setMembers] = useState<MemberData[]>([]);
  const [stats, setStats] = useState({ totalMembers: 0, totalRoles: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State for the role details panel
  const [selectedMember, setSelectedMember] = useState<MemberData | null>(null);
  const [memberRoles, setMemberRoles] = useState<RoleAssignment[]>([]);
  const [isLoadingRoles, setIsLoadingRoles] = useState(false);

  // Filter state
  const [statusFilter, setStatusFilter] = useState<'all' | MemberStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Create service instance
  const service = new MemberRoleService();

  /**
   * Fetch all data from the blockchain
   */
  const fetchData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [membersData, statsData] = await Promise.all([
        service.getAllMembers(),
        service.getStats(),
      ]);
      setMembers(membersData);
      setStats(statsData);
      console.log('✅ Data loaded successfully');
    } catch (err: any) {
      console.error('❌ Failed to fetch data:', err);
      setError(err.message || 'Failed to fetch data from blockchain');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Fetch role details for a specific member
   */
  const fetchMemberRoles = async (member: MemberData) => {
    setSelectedMember(member);
    setIsLoadingRoles(true);
    setMemberRoles([]);

    try {
      const roles: RoleAssignment[] = [];
      for (const recordId of member.records) {
        const roleDetails = await service.getRoleDetails(recordId, member.address);
        if (roleDetails) {
          roles.push(roleDetails);
        }
      }
      setMemberRoles(roles);
    } catch (err) {
      console.error('Failed to fetch roles:', err);
    } finally {
      setIsLoadingRoles(false);
    }
  };

  // Load data on component mount
  useEffect(() => {
    fetchData();
  }, []);

  // Filter members based on search and status
  const filteredMembers = members.filter(member => {
    const matchesSearch =
      searchQuery === '' ||
      member.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.userIdHash.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || member.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Calculate status counts for the filter badges
  const statusCounts = {
    all: members.length,
    [MemberStatus.Verified]: members.filter(m => m.status === MemberStatus.Verified).length,
    [MemberStatus.Active]: members.filter(m => m.status === MemberStatus.Active).length,
    [MemberStatus.Inactive]: members.filter(m => m.status === MemberStatus.Inactive).length,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Member & Role Registry</h1>
              <p className="text-gray-500 mt-1">
                View all registered members and their role assignments
              </p>
            </div>
            <Button onClick={fetchData} disabled={isLoading} className="flex items-center gap-2">
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-red-800">Failed to load data</p>
              <p className="text-sm text-red-600 mt-1">{error}</p>
              <p className="text-xs text-red-500 mt-2">
                Make sure the contract address is correct and you're connected to Sepolia.
              </p>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <StatsCard
            title="Total Members"
            value={stats.totalMembers}
            icon={<Users className="w-6 h-6 text-blue-600" />}
            color="bg-blue-50 border-blue-200 text-blue-900"
          />
          <StatsCard
            title="Total Role Assignments"
            value={stats.totalRoles}
            icon={<Shield className="w-6 h-6 text-purple-600" />}
            color="bg-purple-50 border-purple-200 text-purple-900"
          />
          <StatsCard
            title="Verified Members"
            value={statusCounts[MemberStatus.Verified]}
            icon={<CheckCircle className="w-6 h-6 text-emerald-600" />}
            color="bg-emerald-50 border-emerald-200 text-emerald-900"
          />
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search by address or ID hash..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Status Filter */}
            <div className="flex gap-2 flex-wrap">
              {(
                ['all', MemberStatus.Verified, MemberStatus.Active, MemberStatus.Inactive] as const
              ).map(status => {
                const label =
                  status === 'all' ? 'All' : getStatusInfo(status as MemberStatus).label;
                const count = statusCounts[status];
                const isActive = statusFilter === status;

                return (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {label} ({count})
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Members Table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <Loader2 className="w-10 h-10 animate-spin text-blue-500 mx-auto mb-4" />
              <p className="text-gray-500">Loading members from blockchain...</p>
            </div>
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
            <Users className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 text-lg">
              {searchQuery || statusFilter !== 'all'
                ? 'No members match your filters'
                : 'No members registered yet'}
            </p>
          </div>
        ) : (
          <MembersTable members={filteredMembers} onViewRoles={fetchMemberRoles} />
        )}
      </div>

      {/* Role Details Modal */}
      {selectedMember && (
        <RoleDetailsPanel
          member={selectedMember}
          roles={memberRoles}
          isLoading={isLoadingRoles}
          onClose={() => {
            setSelectedMember(null);
            setMemberRoles([]);
          }}
        />
      )}
    </div>
  );
};

export default BlockchainAdminDashboard;

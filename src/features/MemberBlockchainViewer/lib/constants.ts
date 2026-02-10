// src/features/MemberManagement/constants.ts

/**
 * MemberRoleManager Contract Configuration
 */

export const MEMBER_ROLE_MANAGER_ADDRESS = '0xC31477f563dC8f7529Ba6AE7E410ABdB84C27d7C';

export const SEPOLIA_RPC_URL = 'https://ethereum-sepolia.publicnode.com';
export const ETHERSCAN_BASE_URL = 'https://sepolia.etherscan.io';
export const DEPLOYMENT_BLOCK = 10190794;

/**
 * Contract ABI - Only the view functions needed for the admin dashboard
 *
 * Note: This is a minimal ABI containing only the functions we use.
 * The full contract has additional write functions for role management.
 */
export const MEMBER_ROLE_MANAGER_ABI = [
  // User/Identity Functions
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'wallet', type: 'address' },
      { indexed: true, internalType: 'bytes32', name: 'userIdHash', type: 'bytes32' },
      { indexed: false, internalType: 'uint256', name: 'timestamp', type: 'uint256' },
    ],
    name: 'MemberRegistered',
    type: 'event',
  },
  {
    inputs: [],
    name: 'getAllUsers',
    outputs: [{ internalType: 'bytes32[]', name: '', type: 'bytes32[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalUsers',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'bytes32', name: 'userIdHash', type: 'bytes32' }],
    name: 'userStatus',
    outputs: [{ internalType: 'uint8', name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'bytes32', name: 'userIdHash', type: 'bytes32' }],
    name: 'getWalletsForUser',
    outputs: [{ internalType: 'address[]', name: '', type: 'address[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'wallet', type: 'address' }],
    name: 'wallets',
    outputs: [
      { internalType: 'bytes32', name: 'userIdHash', type: 'bytes32' },
      { internalType: 'bool', name: 'isWalletActive', type: 'bool' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  // Role Functions
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'string', name: 'recordId', type: 'string' },
      { indexed: true, internalType: 'bytes32', name: 'targetIdHash', type: 'bytes32' },
      { indexed: false, internalType: 'string', name: 'role', type: 'string' },
      { indexed: true, internalType: 'bytes32', name: 'userIdHash', type: 'bytes32' },
      { indexed: false, internalType: 'uint256', name: 'timestamp', type: 'uint256' },
    ],
    name: 'RoleGranted',
    type: 'event',
  },
  {
    inputs: [],
    name: 'getTotalRoles',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'bytes32', name: 'userIdHash', type: 'bytes32' }],
    name: 'getRecordsByUser',
    outputs: [{ internalType: 'string[]', name: '', type: 'string[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'string', name: 'recordId', type: 'string' },
      { internalType: 'bytes32', name: 'userIdHash', type: 'bytes32' },
    ],
    name: 'getRoleDetailsByUser',
    outputs: [
      { internalType: 'string', name: 'role', type: 'string' },
      { internalType: 'bool', name: 'isActive', type: 'bool' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'string', name: 'recordId', type: 'string' }],
    name: 'getRecordOwners',
    outputs: [{ internalType: 'bytes32[]', name: '', type: 'bytes32[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'string', name: 'recordId', type: 'string' }],
    name: 'getRecordAdmins',
    outputs: [{ internalType: 'bytes32[]', name: '', type: 'bytes32[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'string', name: 'recordId', type: 'string' }],
    name: 'getRecordViewers',
    outputs: [{ internalType: 'bytes32[]', name: '', type: 'bytes32[]' }],
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
] as const;

// src/features/MemberManagement/types.ts

import { ethers } from 'ethers';

/**
 * Member Management Types
 *
 * These types mirror the on-chain MemberRoleManager contract structure
 * combined with Firebase user profile data.
 */

// ============================================================================
// ENUMS
// ============================================================================

/**
 * Maps to the MemberStatus enum in the smart contract
 * Note: Order matters! Must match contract exactly.
 */
export enum MemberStatus {
  NotRegistered = 0,
  Inactive = 1,
  Active = 2,
  Verified = 3,
  VerifiedProvider = 4,
  Guest = 5,
}

// ============================================================================
// BLOCKCHAIN TYPES
// ============================================================================

export interface WalletInfo {
  address: string;
  isActive: boolean;
}

export interface RoleAssignment {
  recordId: string;
  userIdHash: string;
  role: 'owner' | 'administrator' | 'viewer';
  isActive: boolean;
  profile?: UserProfile; // Adds the Firebase profile to display name/email
  txHash?: string;
}

// ============================================================================
// FIREBASE TYPES
// ============================================================================

/**
 * Firebase UserProfile structure (matching Firestore schema)
 */
export interface FirebaseUserProfile {
  uid: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  emailVerified?: boolean;
  identityVerified?: boolean;
  onChainIdentity?: {
    userIdHash: string;
    status: string;
    linkedWallets?: Array<{
      address: string;
      isWalletActive: boolean;
      type: string;
    }>;
  };
}

/**
 * Simplified profile data extracted from Firebase
 */
export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  emailVerified: boolean;
  identityVerified: boolean;
}

// ============================================================================
// COMBINED TYPES
// ============================================================================

/**
 * Complete user data combining on-chain and Firebase data
 */
export interface UserData {
  userIdHash: string;
  status: MemberStatus;
  wallets: WalletInfo[];
  records: string[];
  profile?: UserProfile;
  registrationTxHash?: string;
  trusteeRelationships?: TrusteeRelationshipOnChain[];
}

/**
 * Dashboard statistics
 */
export interface DashboardStats {
  totalUsers: number;
  totalRoles: number;
}

// ============================================================================
// CONTRACT TYPES
// ============================================================================

/**
 * Type definition for the MemberRoleManager contract methods
 * This tells TypeScript what methods exist on the contract
 */
export interface MemberRoleManagerContract {
  // User/Identity functions
  getAllUsers(): Promise<string[]>;
  totalUsers(): Promise<bigint>;
  userStatus(userIdHash: string): Promise<bigint>;
  getWalletsForUser(userIdHash: string): Promise<string[]>;
  wallets(wallet: string): Promise<[string, boolean]>;

  // Role functions
  getTotalRoles(): Promise<bigint>;
  getRecordsByUser(userIdHash: string): Promise<string[]>;
  getRoleDetailsByUser(recordId: string, userIdHash: string): Promise<[string, boolean]>;
  getRecordOwners(recordId: string): Promise<string[]>;
  getRecordAdmins(recordId: string): Promise<string[]>;
  getRecordViewers(recordId: string): Promise<string[]>;
  getRecordRoleStats(recordId: string): Promise<[bigint, bigint, bigint]>;

  //Trustee functions
  getTrusteeRelationship(trustorIdHash: string, trusteeIdHash: string): Promise<[number, number]>;

  // Event filters
  filters: {
    MemberRegistered(wallet?: string | null, userIdHash?: string | null): any;
    RoleGranted(
      recordId?: string | null,
      targetIdHash?: string | null,
      userIdHash?: string | null
    ): any;
    TrusteeProposed(trustorIdHash?: string | null, trusteeIdHash?: string | null): any;
  };

  // Query filter method
  queryFilter(filter: any): Promise<ethers.EventLog[]>;
}

// ============================================================================
// TRUSTEE TYPES
// ============================================================================

export enum TrusteeLevel {
  Observer = 0,
  Custodian = 1,
  Controller = 2,
}

export enum TrusteeStatus {
  None = 0,
  Pending = 1,
  Active = 2,
  Revoked = 3,
}

export interface TrusteeRelationshipOnChain {
  trusteeIdHash: string; // the other party's identity hash
  status: TrusteeStatus;
  level: TrusteeLevel;
  txHash?: string; // from the TrusteeProposed/Accepted event
  // Populated from Firebase profile lookup (same pattern as RoleAssignment)
  profile?: UserProfile;
}

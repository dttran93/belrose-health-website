// src/features/MemberManagement/services/memberRoleService.ts

import { ethers } from 'ethers';
import {
  MEMBER_ROLE_MANAGER_ADDRESS,
  MEMBER_ROLE_MANAGER_ABI,
  SEPOLIA_RPC_URL,
  DEPLOYMENT_BLOCK,
} from '../lib/constants';
import type {
  MemberRoleManagerContract,
  UserData,
  UserStatus,
  WalletInfo,
  RoleAssignment,
  DashboardStats,
} from '../lib/types';
import { getProfilesByUserIdHashes, transformToUserProfile } from './userProfileService';

/**
 * Service for interacting with the MemberRoleManager smart contract
 *
 * This is a read-only service using a public RPC provider.
 * No wallet connection required.
 */

// Singleton provider and contract instances
let provider: ethers.JsonRpcProvider | null = null;
let contract: ethers.Contract | null = null;

/**
 * Get or create the provider instance
 */
function getProvider(): ethers.JsonRpcProvider {
  if (!provider) {
    provider = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL);
  }
  return provider;
}

/**
 * Get or create the contract instance
 */
function getContract(): MemberRoleManagerContract & ethers.Contract {
  if (!contract) {
    contract = new ethers.Contract(
      MEMBER_ROLE_MANAGER_ADDRESS,
      MEMBER_ROLE_MANAGER_ABI,
      getProvider()
    );
  }
  return contract as MemberRoleManagerContract & ethers.Contract;
}

/**
 * Query MemberRegistered events to get registration tx hashes
 * Returns a map of userIdHash -> txHash
 */
async function getMemberRegistrationTxHashes(): Promise<Map<string, string>> {
  const contract = getContract();
  const txHashMap = new Map<string, string>();

  try {
    const events = await queryFilterInChunks(
      contract,
      contract.filters.MemberRegistered(),
      DEPLOYMENT_BLOCK,
      'latest'
    );

    for (const event of events) {
      if (event instanceof ethers.EventLog) {
        // event.args contains the decoded event parameters
        const userIdHash = event.args?.[1]; // indexed: userIdHash is second param
        if (userIdHash) {
          txHashMap.set(userIdHash, event.transactionHash);
        }
      }
    }

    console.log(`📋 Found ${txHashMap.size} MemberRegistered events`);
  } catch (error) {
    console.error('Failed to query MemberRegistered events:', error);
  }

  return txHashMap;
}

/**
 * Query RoleGranted events to get role assignment tx hashes
 * Returns a map of "recordId:userIdHash" -> txHash
 */
async function getRoleGrantedTxHashes(): Promise<Map<string, string>> {
  const contract = getContract();
  const txHashMap = new Map<string, string>();

  try {
    const events = await queryFilterInChunks(
      contract,
      contract.filters.RoleGranted(),
      DEPLOYMENT_BLOCK,
      'latest'
    );

    for (const event of events) {
      // For indexed string (recordId), we get the hash, not the actual value
      // targetIdHash is the second indexed param
      if (event instanceof ethers.EventLog) {
        const targetIdHash = event.args?.[1];
        const recordIdHash = event.topics[1]; // This will be the hash of the string for indexed strings

        if (targetIdHash && recordIdHash) {
          // We'll need to match by targetIdHash and look up recordId differently
          // For now, store by targetIdHash and we'll match in getAllRoleAssignments
          const key = `${recordIdHash}:${targetIdHash}`;
          // Store the most recent tx for each user (could have multiple role grants)
          txHashMap.set(key, event.transactionHash);
        }
      }
    }

    console.log(`📋 Found ${events.length} RoleGranted events`);
  } catch (error) {
    console.error('Failed to query RoleGranted events:', error);
  }

  return txHashMap;
}

/**
 * Query RoleGranted events for a specific user to get all their role tx hashes
 * Returns a map of recordId -> txHash
 */
async function getRoleGrantedTxHashesForUser(userIdHash: string): Promise<Map<string, string>> {
  const contract = getContract();
  const txHashMap = new Map<string, string>();

  try {
    // Filter by targetIdHash (the user who received the role)

    const events = await queryFilterInChunks(
      contract,
      contract.filters.RoleGranted(null, userIdHash),
      DEPLOYMENT_BLOCK,
      'latest'
    );

    for (const event of events) {
      // Decode the non-indexed recordId from event data
      // The recordId is in the event topics as a keccak hash since it's indexed
      // We need to get it from the transaction or match differently

      // For indexed string parameters, Solidity stores keccak256(recordId) in topics
      // We can't decode it back, but we can match events by looking at all events
      // and matching the role details

      // Store tx hash - we'll match by position/order for now
      txHashMap.set(event.transactionHash, event.transactionHash);
    }

    console.log(`📋 Found ${events.length} RoleGranted events for user`);
  } catch (error) {
    console.error('Failed to query RoleGranted events for user:', error);
  }

  return txHashMap;
}

// ============================================
// Main Data Fetching
// ============================================

/**
 * Fetch all registered users with their on-chain data and Firebase profiles
 */
export async function getAllUsers(): Promise<UserData[]> {
  const contract = getContract();

  try {
    // Get all user identity hashes from blockchain
    const userIdHashes = await contract.getAllUsers();
    console.log(`📋 Found ${userIdHashes.length} users on-chain`);

    // Batch fetch all Firebase profiles and registration tx hashes in parallel
    const [profileMap, registrationTxMap] = await Promise.all([
      getProfilesByUserIdHashes(userIdHashes),
      getMemberRegistrationTxHashes(),
    ]);

    // Fetch on-chain details for each user
    const users: UserData[] = await Promise.all(
      userIdHashes.map(async userIdHash => {
        // Get status
        const status = await contract.userStatus(userIdHash);

        // Get wallets
        const walletAddresses = await contract.getWalletsForUser(userIdHash);
        const wallets: WalletInfo[] = await Promise.all(
          walletAddresses.map(async address => {
            const [, isWalletActive] = await contract.wallets(address);
            return { address, isActive: isWalletActive };
          })
        );

        // Get records
        const records = await contract.getRecordsByUser(userIdHash);

        // Get Firebase profile if exists
        const fbProfile = profileMap.get(userIdHash);
        const profile = fbProfile ? transformToUserProfile(fbProfile) : undefined;

        // Get registration tx hash
        const registrationTxHash = registrationTxMap.get(userIdHash);

        return {
          userIdHash,
          status: Number(status) as UserStatus,
          wallets,
          records,
          profile,
          registrationTxHash,
        };
      })
    );

    return users;
  } catch (error) {
    console.error('❌ Failed to fetch users:', error);
    throw error;
  }
}

/**
 * Fetch dashboard statistics
 */
export async function getStats(): Promise<DashboardStats> {
  const contract = getContract();

  const [totalUsers, totalRoles] = await Promise.all([
    contract.totalUsers(),
    contract.getTotalRoles(),
  ]);

  return {
    totalUsers: Number(totalUsers),
    totalRoles: Number(totalRoles),
  };
}

/**
 * Fetch role details for a specific user on a specific record
 */
export async function getRoleDetails(
  recordId: string,
  userIdHash: string
): Promise<RoleAssignment | null> {
  const contract = getContract();

  try {
    const [role, isActive] = await contract.getRoleDetailsByUser(recordId, userIdHash);

    if (!isActive || !role) return null;

    return {
      recordId,
      userIdHash,
      role: role as 'owner' | 'administrator' | 'viewer',
      isActive,
    };
  } catch (error) {
    console.error('Failed to get role details:', error);
    return null;
  }
}

/**
 * Fetch all roles for a specific user
 */
export async function getUserRoles(
  userIdHash: string,
  recordIds: string[]
): Promise<RoleAssignment[]> {
  const contract = getContract();
  const roles: RoleAssignment[] = [];

  // Query RoleGranted events for this user to get tx hashes
  try {
    const filter = contract.filters.RoleGranted(null, userIdHash);
    const events = await queryFilterInChunks(contract, filter, DEPLOYMENT_BLOCK, 'latest');

    // Create a map of recordId hash -> txHash
    // Since recordId is indexed, we get its keccak256 hash in topics[1]
    const txHashByRecordIdHash = new Map<string, string>();
    for (const event of events) {
      // topics[0] is event signature, topics[1] is recordId hash
      const recordIdHash = event.topics[1];
      if (!recordIdHash) {
        throw new Error('Missing Record ID Hash');
      }
      txHashByRecordIdHash.set(recordIdHash, event.transactionHash);
    }

    for (const recordId of recordIds) {
      const roleDetails = await getRoleDetails(recordId, userIdHash);
      if (roleDetails) {
        // Match tx hash by hashing the recordId
        const recordIdHash = ethers.id(recordId);
        const txHash = txHashByRecordIdHash.get(recordIdHash);

        roles.push({
          ...roleDetails,
          txHash,
        });
      }
    }
  } catch (error) {
    console.error('Failed to fetch user roles with tx hashes:', error);
    // Fallback: fetch roles without tx hashes
    for (const recordId of recordIds) {
      const roleDetails = await getRoleDetails(recordId, userIdHash);
      if (roleDetails) {
        roles.push(roleDetails);
      }
    }
  }

  return roles;
}

/**
 * Get role statistics for a specific record
 */
export async function getRecordRoleStats(recordId: string): Promise<{
  ownerCount: number;
  adminCount: number;
  viewerCount: number;
}> {
  const contract = getContract();

  const [ownerCount, adminCount, viewerCount] = await contract.getRecordRoleStats(recordId);

  return {
    ownerCount: Number(ownerCount),
    adminCount: Number(adminCount),
    viewerCount: Number(viewerCount),
  };
}

/**
 * Fetch all role assignments across all users
 * Used for the "Role Assignments" view in the dashboard
 */
export async function getAllRoleAssignments(users: UserData[]): Promise<RoleAssignment[]> {
  const contract = getContract();
  const assignments: RoleAssignment[] = [];

  try {
    // Query all RoleGranted events to get tx hashes
    const filter = contract.filters.RoleGranted();
    const events = await queryFilterInChunks(contract, filter, DEPLOYMENT_BLOCK, 'latest');

    // Create a map: keccak256(recordId) + userIdHash -> txHash
    const txHashMap = new Map<string, string>();
    for (const event of events) {
      if (event instanceof ethers.EventLog) {
        const recordIdHash = event.topics[1]; // indexed string becomes its hash
        const targetIdHash = event.args?.[1]; // second indexed param
        if (recordIdHash && targetIdHash) {
          const key = `${recordIdHash}:${targetIdHash}`;
          txHashMap.set(key, event.transactionHash);
        }
      }
    }

    // Iterate through all users and their records
    for (const user of users) {
      for (const recordId of user.records) {
        const roleDetails = await getRoleDetails(recordId, user.userIdHash);

        if (roleDetails) {
          // Look up tx hash
          const recordIdHash = ethers.id(recordId);
          const key = `${recordIdHash}:${user.userIdHash}`;
          const txHash = txHashMap.get(key);

          assignments.push({
            ...roleDetails,
            profile: user.profile,
            txHash,
          });
        }
      }
    }

    console.log(`📋 Found ${assignments.length} role assignments`);
  } catch (error) {
    console.error('Failed to fetch role assignments with tx hashes:', error);
    // Fallback without tx hashes
    for (const user of users) {
      for (const recordId of user.records) {
        const roleDetails = await getRoleDetails(recordId, user.userIdHash);
        if (roleDetails) {
          assignments.push({
            ...roleDetails,
            profile: user.profile,
          });
        }
      }
    }
  }

  return assignments;
}

/**
 * Helper to query events in chunks to bypass RPC limits (e.g., 10,000 blocks)
 */
async function queryFilterInChunks(
  contract: ethers.Contract,
  filter: ethers.DeferredTopicFilter,
  fromBlock: number,
  toBlock: number | string,
  chunkSize: number = 10000
): Promise<(ethers.EventLog | ethers.Log)[]> {
  const currentBlock =
    typeof toBlock === 'number'
      ? toBlock
      : (await contract.runner?.provider?.getBlockNumber()) || fromBlock + chunkSize;

  let allEvents: (ethers.EventLog | ethers.Log)[] = [];
  let start = fromBlock;

  while (start <= currentBlock) {
    const end = Math.min(start + chunkSize - 1, currentBlock);
    console.log(`🔍 Querying blocks ${start} to ${end}...`);

    const events = await contract.queryFilter(filter, start, end);
    allEvents = allEvents.concat(events);

    start += chunkSize;
  }

  return allEvents;
}

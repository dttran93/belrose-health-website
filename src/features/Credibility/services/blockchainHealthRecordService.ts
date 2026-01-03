// src/features/BlockchainVerification/services/healthRecordCoreService.ts
//
// Frontend service for HealthRecordCore smart contract.
// Uses PaymasterService for all write transactions (handles sponsored vs direct).
//
// KEY FEATURES:
// - Record anchoring (patients link themselves to health records)
// - Record verification (providers vouch for record accuracy)
// - Record disputes (flag inaccurate records)
// - Dispute reactions (support/oppose disputes)
// - Unaccepted update flags (admin-only, tracks refused record updates)
//
// Read operations: No wallet needed (uses public RPC)
// Write operations: Routes through PaymasterService

import { ethers, Contract } from 'ethers';
import { PaymasterService } from '@/features/BlockchainWallet/services/paymasterService';

// ============================================================================
// CONFIG
// ============================================================================

const HEALTH_RECORD_CORE_ADDRESS = '0xDC79F803594232421f49a29D9EcEbe78015d48e1';
const RPC_URL = 'https://1rpc.io/sepolia';

// ============================================================================
// ABI (only the functions we need)
// ============================================================================

const HEALTH_RECORD_CORE_ABI = [
  // ==================== RECORD ANCHORING - WRITE ====================
  {
    inputs: [
      { name: 'recordId', type: 'string' },
      { name: 'recordHash', type: 'string' },
    ],
    name: 'anchorRecord',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'recordId', type: 'string' }],
    name: 'unanchorRecord',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'recordId', type: 'string' }],
    name: 'reanchorRecord',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'recordId', type: 'string' },
      { name: 'newHash', type: 'string' },
    ],
    name: 'addRecordHash',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },

  // ==================== RECORD ANCHORING - VIEW ====================
  {
    inputs: [{ name: 'recordId', type: 'string' }],
    name: 'getRecordSubjects',
    outputs: [{ name: '', type: 'bytes32[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'userIdHash', type: 'bytes32' }],
    name: 'getSubjectMedicalHistory',
    outputs: [{ name: '', type: 'string[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'recordId', type: 'string' },
      { name: 'userIdHash', type: 'bytes32' },
    ],
    name: 'isSubject',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'recordId', type: 'string' },
      { name: 'userIdHash', type: 'bytes32' },
    ],
    name: 'isActiveSubject',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'recordId', type: 'string' }],
    name: 'getActiveRecordSubjects',
    outputs: [{ name: '', type: 'bytes32[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'recordId', type: 'string' }],
    name: 'getSubjectStats',
    outputs: [
      { name: 'total', type: 'uint256' },
      { name: 'active', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'recordId', type: 'string' }],
    name: 'getRecordVersionHistory',
    outputs: [{ name: '', type: 'string[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'recordHash', type: 'string' }],
    name: 'getRecordIdForHash',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'recordHash', type: 'string' }],
    name: 'doesHashExist',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'recordId', type: 'string' }],
    name: 'getVersionCount',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getTotalAnchoredRecords',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },

  // ==================== VERIFICATIONS - WRITE ====================
  {
    inputs: [
      { name: 'recordId', type: 'string' },
      { name: 'recordHash', type: 'string' },
      { name: 'level', type: 'uint8' },
    ],
    name: 'verifyRecord',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'recordHash', type: 'string' }],
    name: 'retractVerification',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'recordHash', type: 'string' },
      { name: 'newLevel', type: 'uint8' },
    ],
    name: 'modifyVerificationLevel',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },

  // ==================== VERIFICATIONS - VIEW ====================
  {
    inputs: [{ name: 'recordHash', type: 'string' }],
    name: 'getVerifications',
    outputs: [
      {
        components: [
          { name: 'verifierIdHash', type: 'bytes32' },
          { name: 'recordId', type: 'string' },
          { name: 'level', type: 'uint8' },
          { name: 'createdAt', type: 'uint256' },
          { name: 'isActive', type: 'bool' },
        ],
        name: '',
        type: 'tuple[]',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'recordHash', type: 'string' },
      { name: 'userIdHash', type: 'bytes32' },
    ],
    name: 'hasUserVerified',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'recordHash', type: 'string' },
      { name: 'userIdHash', type: 'bytes32' },
    ],
    name: 'getUserVerification',
    outputs: [
      { name: 'exists', type: 'bool' },
      { name: 'recordId', type: 'string' },
      { name: 'level', type: 'uint8' },
      { name: 'createdAt', type: 'uint256' },
      { name: 'isActive', type: 'bool' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'recordHash', type: 'string' }],
    name: 'getVerificationStats',
    outputs: [
      { name: 'total', type: 'uint256' },
      { name: 'active', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'recordHash', type: 'string' }],
    name: 'getVerificationStatsByLevel',
    outputs: [
      { name: 'total', type: 'uint256' },
      { name: 'active', type: 'uint256' },
      { name: 'provenanceCount', type: 'uint256' },
      { name: 'contentCount', type: 'uint256' },
      { name: 'fullCount', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'userIdHash', type: 'bytes32' }],
    name: 'getUserVerifications',
    outputs: [{ name: '', type: 'string[]' }],
    stateMutability: 'view',
    type: 'function',
  },

  // ==================== DISPUTES - WRITE ====================
  {
    inputs: [
      { name: 'recordId', type: 'string' },
      { name: 'recordHash', type: 'string' },
      { name: 'severity', type: 'uint8' },
      { name: 'culpability', type: 'uint8' },
      { name: 'notes', type: 'string' },
    ],
    name: 'disputeRecord',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'recordHash', type: 'string' }],
    name: 'retractDispute',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'recordHash', type: 'string' },
      { name: 'newSeverity', type: 'uint8' },
      { name: 'newCulpability', type: 'uint8' },
    ],
    name: 'modifyDispute',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },

  // ==================== DISPUTES - VIEW ====================
  {
    inputs: [{ name: 'recordHash', type: 'string' }],
    name: 'getDisputes',
    outputs: [
      {
        components: [
          { name: 'disputerIdHash', type: 'bytes32' },
          { name: 'recordId', type: 'string' },
          { name: 'severity', type: 'uint8' },
          { name: 'culpability', type: 'uint8' },
          { name: 'notes', type: 'string' },
          { name: 'createdAt', type: 'uint256' },
          { name: 'isActive', type: 'bool' },
        ],
        name: '',
        type: 'tuple[]',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'recordHash', type: 'string' },
      { name: 'userIdHash', type: 'bytes32' },
    ],
    name: 'hasUserDisputed',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'recordHash', type: 'string' },
      { name: 'userIdHash', type: 'bytes32' },
    ],
    name: 'getUserDispute',
    outputs: [
      { name: 'exists', type: 'bool' },
      { name: 'recordId', type: 'string' },
      { name: 'severity', type: 'uint8' },
      { name: 'culpability', type: 'uint8' },
      { name: 'notes', type: 'string' },
      { name: 'createdAt', type: 'uint256' },
      { name: 'isActive', type: 'bool' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'recordHash', type: 'string' }],
    name: 'getDisputeStats',
    outputs: [
      { name: 'total', type: 'uint256' },
      { name: 'active', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'recordHash', type: 'string' }],
    name: 'getDisputeStatsBySeverity',
    outputs: [
      { name: 'total', type: 'uint256' },
      { name: 'active', type: 'uint256' },
      { name: 'negligibleCount', type: 'uint256' },
      { name: 'moderateCount', type: 'uint256' },
      { name: 'majorCount', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'userIdHash', type: 'bytes32' }],
    name: 'getUserDisputes',
    outputs: [{ name: '', type: 'string[]' }],
    stateMutability: 'view',
    type: 'function',
  },

  // ==================== REACTIONS - WRITE ====================
  {
    inputs: [
      { name: 'recordHash', type: 'string' },
      { name: 'disputerIdHash', type: 'bytes32' },
      { name: 'supportsDispute', type: 'bool' },
    ],
    name: 'reactToDispute',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'recordHash', type: 'string' },
      { name: 'disputerIdHash', type: 'bytes32' },
    ],
    name: 'retractReaction',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'recordHash', type: 'string' },
      { name: 'disputerIdHash', type: 'bytes32' },
      { name: 'newSupport', type: 'bool' },
    ],
    name: 'modifyReaction',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },

  // ==================== REACTIONS - VIEW ====================
  {
    inputs: [
      { name: 'recordHash', type: 'string' },
      { name: 'disputerIdHash', type: 'bytes32' },
    ],
    name: 'getDisputeReactions',
    outputs: [
      {
        components: [
          { name: 'reactorIdHash', type: 'bytes32' },
          { name: 'supportsDispute', type: 'bool' },
          { name: 'timestamp', type: 'uint256' },
          { name: 'isActive', type: 'bool' },
        ],
        name: '',
        type: 'tuple[]',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'recordHash', type: 'string' },
      { name: 'disputerIdHash', type: 'bytes32' },
      { name: 'reactorIdHash', type: 'bytes32' },
    ],
    name: 'hasUserReacted',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'recordHash', type: 'string' },
      { name: 'disputerIdHash', type: 'bytes32' },
      { name: 'reactorIdHash', type: 'bytes32' },
    ],
    name: 'getUserReaction',
    outputs: [
      { name: 'exists', type: 'bool' },
      { name: 'supportsDispute', type: 'bool' },
      { name: 'timestamp', type: 'uint256' },
      { name: 'isActive', type: 'bool' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'recordHash', type: 'string' },
      { name: 'disputerIdHash', type: 'bytes32' },
    ],
    name: 'getReactionStats',
    outputs: [
      { name: 'totalReactions', type: 'uint256' },
      { name: 'activeSupports', type: 'uint256' },
      { name: 'activeOpposes', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },

  // ==================== UNACCEPTED UPDATE FLAGS - VIEW ====================
  {
    inputs: [{ name: 'subjectIdHash', type: 'bytes32' }],
    name: 'getUnacceptedUpdateFlags',
    outputs: [
      {
        components: [
          { name: 'recordId', type: 'string' },
          { name: 'noteHash', type: 'string' },
          { name: 'createdAt', type: 'uint256' },
          { name: 'resolution', type: 'uint8' },
          { name: 'resolvedAt', type: 'uint256' },
          { name: 'isActive', type: 'bool' },
        ],
        name: '',
        type: 'tuple[]',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'subjectIdHash', type: 'bytes32' }],
    name: 'getActiveUnacceptedFlagCount',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'subjectIdHash', type: 'bytes32' }],
    name: 'hasActiveUnacceptedFlags',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getTotalUnacceptedFlagStats',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },

  // ==================== SUMMARY VIEW FUNCTIONS ====================
  {
    inputs: [{ name: 'recordHash', type: 'string' }],
    name: 'getRecordHashReviewSummary',
    outputs: [
      { name: 'activeVerifications', type: 'uint256' },
      { name: 'activeDisputes', type: 'uint256' },
      { name: 'verificationCount', type: 'uint256' },
      { name: 'disputeCount', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'userIdHash', type: 'bytes32' }],
    name: 'getUserReviewHistory',
    outputs: [
      { name: 'userVerifications', type: 'uint256' },
      { name: 'userDisputes', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getTotalReviewStats',
    outputs: [
      { name: 'verificationCount', type: 'uint256' },
      { name: 'disputeCount', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
];

// ============================================================================
// TYPES
// ============================================================================

/** Verification level - how thoroughly the record was verified */
export enum VerificationLevel {
  None = 0,
  Provenance = 1, // Verified the source/origin
  Content = 2, // Verified the content accuracy
  Full = 3, // Full verification (provenance + content)
}

/** Dispute severity - how serious is the inaccuracy */
export enum DisputeSeverity {
  None = 0,
  Negligible = 1, // Minor issue, doesn't affect care
  Moderate = 2, // Could affect care decisions
  Major = 3, // Serious inaccuracy, dangerous
}

/** Dispute culpability - who/what is responsible */
export enum DisputeCulpability {
  None = 0,
  NoFault = 1, // Honest mistake, system glitch
  Systemic = 2, // Organizational/process failure
  Preventable = 3, // Should have been caught
  Reckless = 4, // Careless disregard
  Intentional = 5, // Deliberate falsification
}

/** Resolution type for unaccepted update flags */
export enum ResolutionType {
  None = 0,
  PatientAccepted = 1,
  DoctorWithdrew = 2,
  Arbitrated = 3,
  Expired = 4,
}

export interface Verification {
  verifierIdHash: string;
  recordId: string;
  level: VerificationLevel;
  createdAt: number;
  isActive: boolean;
}

export interface Dispute {
  disputerIdHash: string;
  recordId: string;
  severity: DisputeSeverity;
  culpability: DisputeCulpability;
  notes: string;
  createdAt: number;
  isActive: boolean;
}

export interface Reaction {
  reactorIdHash: string;
  supportsDispute: boolean;
  timestamp: number;
  isActive: boolean;
}

export interface UnacceptedUpdateFlag {
  recordId: string;
  noteHash: string;
  createdAt: number;
  resolution: ResolutionType;
  resolvedAt: number;
  isActive: boolean;
}

export interface SubjectStats {
  total: number;
  active: number;
}

export interface VerificationStats {
  total: number;
  active: number;
}

export interface VerificationStatsByLevel extends VerificationStats {
  provenanceCount: number;
  contentCount: number;
  fullCount: number;
}

export interface DisputeStats {
  total: number;
  active: number;
}

export interface DisputeStatsBySeverity extends DisputeStats {
  negligibleCount: number;
  moderateCount: number;
  majorCount: number;
}

export interface ReactionStats {
  totalReactions: number;
  activeSupports: number;
  activeOpposes: number;
}

export interface RecordReviewSummary {
  activeVerifications: number;
  activeDisputes: number;
  verificationCount: number;
  disputeCount: number;
}

export interface UserReviewHistory {
  userVerifications: number;
  userDisputes: number;
}

export interface TotalReviewStats {
  verificationCount: number;
  disputeCount: number;
}

export interface TransactionResult {
  txHash: string;
  blockNumber: number;
}

// ============================================================================
// SERVICE
// ============================================================================

export class blockchainHealthRecordService {
  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  /** Get a read-only contract instance (no wallet needed) */
  private static getReadOnlyContract(): Contract {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    return new ethers.Contract(HEALTH_RECORD_CORE_ADDRESS, HEALTH_RECORD_CORE_ABI, provider);
  }

  /** Encode function call data for a write transaction */
  private static encodeFunctionData(functionName: string, args: unknown[]): `0x${string}` {
    const iface = new ethers.Interface(HEALTH_RECORD_CORE_ABI);
    return iface.encodeFunctionData(functionName, args) as `0x${string}`;
  }

  /** Execute a write transaction via PaymasterService */
  private static async executeWrite(
    functionName: string,
    args: unknown[]
  ): Promise<TransactionResult> {
    const data = this.encodeFunctionData(functionName, args);

    const txHash = await PaymasterService.sendTransaction({
      to: HEALTH_RECORD_CORE_ADDRESS as `0x${string}`,
      data,
    });

    return { txHash, blockNumber: 0 };
  }

  // ==========================================================================
  // RECORD ANCHORING - WRITE FUNCTIONS
  // ==========================================================================

  /**
   * Anchor yourself as a subject to a record with a hash.
   * First subject establishes the initial hash; subsequent subjects confirm it.
   */
  static async anchorRecord(recordId: string, recordHash: string): Promise<TransactionResult> {
    console.log('⛓️ Anchoring record...', {
      recordId,
      recordHash: recordHash.slice(0, 12) + '...',
    });
    const result = await this.executeWrite('anchorRecord', [recordId, recordHash]);
    console.log('✅ Record anchored:', result.txHash);
    return result;
  }

  /** Deactivate your subject link (soft delete) */
  static async unanchorRecord(recordId: string): Promise<TransactionResult> {
    console.log('⛓️ Unanchoring record...', { recordId });
    const result = await this.executeWrite('unanchorRecord', [recordId]);
    console.log('✅ Record unanchored:', result.txHash);
    return result;
  }

  /** Reactivate a previously unanchored subject link */
  static async reanchorRecord(recordId: string): Promise<TransactionResult> {
    console.log('⛓️ Reanchoring record...', { recordId });
    const result = await this.executeWrite('reanchorRecord', [recordId]);
    console.log('✅ Record reanchored:', result.txHash);
    return result;
  }

  /** Add a new hash version to an existing record (owner/admin only) */
  static async addRecordHash(recordId: string, newHash: string): Promise<TransactionResult> {
    console.log('⛓️ Adding record hash...', { recordId, newHash: newHash.slice(0, 12) + '...' });
    const result = await this.executeWrite('addRecordHash', [recordId, newHash]);
    console.log('✅ Hash added:', result.txHash);
    return result;
  }

  // ==========================================================================
  // RECORD ANCHORING - VIEW FUNCTIONS
  // ==========================================================================

  /** Get all subjects (patients) of a record */
  static async getRecordSubjects(recordId: string): Promise<string[]> {
    try {
      const contract = this.getReadOnlyContract();
      const fn = contract.getFunction('getRecordSubjects');
      return await fn(recordId);
    } catch (error) {
      console.error('Error getting record subjects:', error);
      return [];
    }
  }

  /** Get all records where a user is the subject (medical history) */
  static async getSubjectMedicalHistory(userIdHash: string): Promise<string[]> {
    try {
      const contract = this.getReadOnlyContract();
      const fn = contract.getFunction('getSubjectMedicalHistory');
      return await fn(userIdHash);
    } catch (error) {
      console.error('Error getting subject medical history:', error);
      return [];
    }
  }

  /** Check if a user is a subject of a record */
  static async isSubject(recordId: string, userIdHash: string): Promise<boolean> {
    try {
      const contract = this.getReadOnlyContract();
      const fn = contract.getFunction('isSubject');
      return await fn(recordId, userIdHash);
    } catch (error) {
      console.error('Error checking if subject:', error);
      return false;
    }
  }

  /** Check if a user is an ACTIVE subject of a record */
  static async isActiveSubject(recordId: string, userIdHash: string): Promise<boolean> {
    try {
      const contract = this.getReadOnlyContract();
      const fn = contract.getFunction('isActiveSubject');
      return await fn(recordId, userIdHash);
    } catch (error) {
      console.error('Error checking if active subject:', error);
      return false;
    }
  }

  /** Get only active subjects for a record */
  static async getActiveRecordSubjects(recordId: string): Promise<string[]> {
    try {
      const contract = this.getReadOnlyContract();
      const fn = contract.getFunction('getActiveRecordSubjects');
      return await fn(recordId);
    } catch (error) {
      console.error('Error getting active record subjects:', error);
      return [];
    }
  }

  /** Get subject stats (total and active) for a record */
  static async getSubjectStats(recordId: string): Promise<SubjectStats> {
    try {
      const contract = this.getReadOnlyContract();
      const fn = contract.getFunction('getSubjectStats');
      const result = await fn(recordId);
      return {
        total: Number(result[0]),
        active: Number(result[1]),
      };
    } catch (error) {
      console.error('Error getting subject stats:', error);
      return { total: 0, active: 0 };
    }
  }

  /** Get all hash versions for a record */
  static async getRecordVersionHistory(recordId: string): Promise<string[]> {
    try {
      const contract = this.getReadOnlyContract();
      const fn = contract.getFunction('getRecordVersionHistory');
      return await fn(recordId);
    } catch (error) {
      console.error('Error getting record version history:', error);
      return [];
    }
  }

  /** Get the recordId that a hash belongs to */
  static async getRecordIdForHash(recordHash: string): Promise<string> {
    try {
      const contract = this.getReadOnlyContract();
      const fn = contract.getFunction('getRecordIdForHash');
      return await fn(recordHash);
    } catch (error) {
      console.error('Error getting record ID for hash:', error);
      return '';
    }
  }

  /** Check if a hash exists in the system */
  static async doesHashExist(recordHash: string): Promise<boolean> {
    try {
      const contract = this.getReadOnlyContract();
      const fn = contract.getFunction('doesHashExist');
      return await fn(recordHash);
    } catch (error) {
      console.error('Error checking if hash exists:', error);
      return false;
    }
  }

  /** Get the number of versions for a record */
  static async getVersionCount(recordId: string): Promise<number> {
    try {
      const contract = this.getReadOnlyContract();
      const fn = contract.getFunction('getVersionCount');
      const count = await fn(recordId);
      return Number(count);
    } catch (error) {
      console.error('Error getting version count:', error);
      return 0;
    }
  }

  /** Get total number of anchored records in the system */
  static async getTotalAnchoredRecords(): Promise<number> {
    try {
      const contract = this.getReadOnlyContract();
      const fn = contract.getFunction('getTotalAnchoredRecords');
      const total = await fn();
      return Number(total);
    } catch (error) {
      console.error('Error getting total anchored records:', error);
      return 0;
    }
  }

  // ==========================================================================
  // VERIFICATIONS - WRITE FUNCTIONS
  // ==========================================================================

  /**
   * Verify a record hash (vouch for its accuracy)
   * @param level 1=Provenance, 2=Content, 3=Full
   */
  static async verifyRecord(
    recordId: string,
    recordHash: string,
    level: VerificationLevel
  ): Promise<TransactionResult> {
    console.log('✅ Verifying record...', { recordId, level });
    const result = await this.executeWrite('verifyRecord', [recordId, recordHash, level]);
    console.log('✅ Record verified:', result.txHash);
    return result;
  }

  /** Retract your verification */
  static async retractVerification(recordHash: string): Promise<TransactionResult> {
    console.log('↩️ Retracting verification...', { recordHash: recordHash.slice(0, 12) + '...' });
    const result = await this.executeWrite('retractVerification', [recordHash]);
    console.log('✅ Verification retracted:', result.txHash);
    return result;
  }

  /** Modify your verification level */
  static async modifyVerificationLevel(
    recordHash: string,
    newLevel: VerificationLevel
  ): Promise<TransactionResult> {
    console.log('✏️ Modifying verification level...', { newLevel });
    const result = await this.executeWrite('modifyVerificationLevel', [recordHash, newLevel]);
    console.log('✅ Verification level modified:', result.txHash);
    return result;
  }

  // ==========================================================================
  // VERIFICATIONS - VIEW FUNCTIONS
  // ==========================================================================

  /** Get all verifications for a record hash */
  static async getVerifications(recordHash: string): Promise<Verification[]> {
    try {
      const contract = this.getReadOnlyContract();
      const fn = contract.getFunction('getVerifications');
      const raw = await fn(recordHash);

      return raw.map((v: any) => ({
        verifierIdHash: v.verifierIdHash,
        recordId: v.recordId,
        level: Number(v.level) as VerificationLevel,
        createdAt: Number(v.createdAt),
        isActive: v.isActive,
      }));
    } catch (error) {
      console.error('Error getting verifications:', error);
      return [];
    }
  }

  /** Check if a user has verified a record hash */
  static async hasUserVerified(recordHash: string, userIdHash: string): Promise<boolean> {
    try {
      const contract = this.getReadOnlyContract();
      const fn = contract.getFunction('hasUserVerified');
      return await fn(recordHash, userIdHash);
    } catch (error) {
      console.error('Error checking if user verified:', error);
      return false;
    }
  }

  /** Get a specific user's verification for a hash */
  static async getUserVerification(
    recordHash: string,
    userIdHash: string
  ): Promise<{
    exists: boolean;
    recordId: string;
    level: VerificationLevel;
    createdAt: number;
    isActive: boolean;
  }> {
    try {
      const contract = this.getReadOnlyContract();
      const fn = contract.getFunction('getUserVerification');
      const result = await fn(recordHash, userIdHash);

      return {
        exists: result[0],
        recordId: result[1],
        level: Number(result[2]) as VerificationLevel,
        createdAt: Number(result[3]),
        isActive: result[4],
      };
    } catch (error) {
      console.error('Error getting user verification:', error);
      return {
        exists: false,
        recordId: '',
        level: VerificationLevel.None,
        createdAt: 0,
        isActive: false,
      };
    }
  }

  /** Get verification stats for a record hash */
  static async getVerificationStats(recordHash: string): Promise<VerificationStats> {
    try {
      const contract = this.getReadOnlyContract();
      const fn = contract.getFunction('getVerificationStats');
      const result = await fn(recordHash);
      return {
        total: Number(result[0]),
        active: Number(result[1]),
      };
    } catch (error) {
      console.error('Error getting verification stats:', error);
      return { total: 0, active: 0 };
    }
  }

  /** Get verification stats by level for a record hash */
  static async getVerificationStatsByLevel(recordHash: string): Promise<VerificationStatsByLevel> {
    try {
      const contract = this.getReadOnlyContract();
      const fn = contract.getFunction('getVerificationStatsByLevel');
      const result = await fn(recordHash);

      return {
        total: Number(result[0]),
        active: Number(result[1]),
        provenanceCount: Number(result[2]),
        contentCount: Number(result[3]),
        fullCount: Number(result[4]),
      };
    } catch (error) {
      console.error('Error getting verification stats by level:', error);
      return { total: 0, active: 0, provenanceCount: 0, contentCount: 0, fullCount: 0 };
    }
  }

  /** Get all hashes a user has verified */
  static async getUserVerifications(userIdHash: string): Promise<string[]> {
    try {
      const contract = this.getReadOnlyContract();
      const fn = contract.getFunction('getUserVerifications');
      return await fn(userIdHash);
    } catch (error) {
      console.error('Error getting user verifications:', error);
      return [];
    }
  }

  // ==========================================================================
  // DISPUTES - WRITE FUNCTIONS
  // ==========================================================================

  /** Dispute a record hash (flag it as inaccurate) */
  static async disputeRecord(
    recordId: string,
    recordHash: string,
    severity: DisputeSeverity,
    culpability: DisputeCulpability,
    notes: string
  ): Promise<TransactionResult> {
    console.log('⚠️ Disputing record...', { recordId, severity, culpability });
    const result = await this.executeWrite('disputeRecord', [
      recordId,
      recordHash,
      severity,
      culpability,
      notes,
    ]);
    console.log('✅ Record disputed:', result.txHash);
    return result;
  }

  /** Retract your dispute */
  static async retractDispute(recordHash: string): Promise<TransactionResult> {
    console.log('↩️ Retracting dispute...');
    const result = await this.executeWrite('retractDispute', [recordHash]);
    console.log('✅ Dispute retracted:', result.txHash);
    return result;
  }

  /** Modify your dispute's severity and culpability */
  static async modifyDispute(
    recordHash: string,
    newSeverity: DisputeSeverity,
    newCulpability: DisputeCulpability
  ): Promise<TransactionResult> {
    console.log('✏️ Modifying dispute...', { newSeverity, newCulpability });
    const result = await this.executeWrite('modifyDispute', [
      recordHash,
      newSeverity,
      newCulpability,
    ]);
    console.log('✅ Dispute modified:', result.txHash);
    return result;
  }

  // ==========================================================================
  // DISPUTES - VIEW FUNCTIONS
  // ==========================================================================

  /** Get all disputes for a record hash */
  static async getDisputes(recordHash: string): Promise<Dispute[]> {
    try {
      const contract = this.getReadOnlyContract();
      const fn = contract.getFunction('getDisputes');
      const raw = await fn(recordHash);

      return raw.map((d: any) => ({
        disputerIdHash: d.disputerIdHash,
        recordId: d.recordId,
        severity: Number(d.severity) as DisputeSeverity,
        culpability: Number(d.culpability) as DisputeCulpability,
        notes: d.notes,
        createdAt: Number(d.createdAt),
        isActive: d.isActive,
      }));
    } catch (error) {
      console.error('Error getting disputes:', error);
      return [];
    }
  }

  /** Check if a user has disputed a record hash */
  static async hasUserDisputed(recordHash: string, userIdHash: string): Promise<boolean> {
    try {
      const contract = this.getReadOnlyContract();
      const fn = contract.getFunction('hasUserDisputed');
      return await fn(recordHash, userIdHash);
    } catch (error) {
      console.error('Error checking if user disputed:', error);
      return false;
    }
  }

  /** Get a specific user's dispute for a hash */
  static async getUserDispute(
    recordHash: string,
    userIdHash: string
  ): Promise<{
    exists: boolean;
    recordId: string;
    severity: DisputeSeverity;
    culpability: DisputeCulpability;
    notes: string;
    createdAt: number;
    isActive: boolean;
  }> {
    try {
      const contract = this.getReadOnlyContract();
      const fn = contract.getFunction('getUserDispute');
      const result = await fn(recordHash, userIdHash);

      return {
        exists: result[0],
        recordId: result[1],
        severity: Number(result[2]) as DisputeSeverity,
        culpability: Number(result[3]) as DisputeCulpability,
        notes: result[4],
        createdAt: Number(result[5]),
        isActive: result[6],
      };
    } catch (error) {
      console.error('Error getting user dispute:', error);
      return {
        exists: false,
        recordId: '',
        severity: DisputeSeverity.None,
        culpability: DisputeCulpability.None,
        notes: '',
        createdAt: 0,
        isActive: false,
      };
    }
  }

  /** Get dispute stats for a record hash */
  static async getDisputeStats(recordHash: string): Promise<DisputeStats> {
    try {
      const contract = this.getReadOnlyContract();
      const fn = contract.getFunction('getDisputeStats');
      const result = await fn(recordHash);
      return {
        total: Number(result[0]),
        active: Number(result[1]),
      };
    } catch (error) {
      console.error('Error getting dispute stats:', error);
      return { total: 0, active: 0 };
    }
  }

  /** Get dispute stats by severity for a record hash */
  static async getDisputeStatsBySeverity(recordHash: string): Promise<DisputeStatsBySeverity> {
    try {
      const contract = this.getReadOnlyContract();
      const fn = contract.getFunction('getDisputeStatsBySeverity');
      const result = await fn(recordHash);

      return {
        total: Number(result[0]),
        active: Number(result[1]),
        negligibleCount: Number(result[2]),
        moderateCount: Number(result[3]),
        majorCount: Number(result[4]),
      };
    } catch (error) {
      console.error('Error getting dispute stats by severity:', error);
      return { total: 0, active: 0, negligibleCount: 0, moderateCount: 0, majorCount: 0 };
    }
  }

  /** Get all hashes a user has disputed */
  static async getUserDisputes(userIdHash: string): Promise<string[]> {
    try {
      const contract = this.getReadOnlyContract();
      const fn = contract.getFunction('getUserDisputes');
      return await fn(userIdHash);
    } catch (error) {
      console.error('Error getting user disputes:', error);
      return [];
    }
  }

  // ==========================================================================
  // REACTIONS - WRITE FUNCTIONS
  // ==========================================================================

  /** React to a dispute (support or oppose) */
  static async reactToDispute(
    recordHash: string,
    disputerIdHash: string,
    supportsDispute: boolean
  ): Promise<TransactionResult> {
    console.log('👍 Reacting to dispute...', { supportsDispute });
    const result = await this.executeWrite('reactToDispute', [
      recordHash,
      disputerIdHash,
      supportsDispute,
    ]);
    console.log('✅ Reaction submitted:', result.txHash);
    return result;
  }

  /** Retract your reaction to a dispute */
  static async retractReaction(
    recordHash: string,
    disputerIdHash: string
  ): Promise<TransactionResult> {
    console.log('↩️ Retracting reaction...');
    const result = await this.executeWrite('retractReaction', [recordHash, disputerIdHash]);
    console.log('✅ Reaction retracted:', result.txHash);
    return result;
  }

  /** Modify your reaction to a dispute */
  static async modifyReaction(
    recordHash: string,
    disputerIdHash: string,
    newSupport: boolean
  ): Promise<TransactionResult> {
    console.log('✏️ Modifying reaction...', { newSupport });
    const result = await this.executeWrite('modifyReaction', [
      recordHash,
      disputerIdHash,
      newSupport,
    ]);
    console.log('✅ Reaction modified:', result.txHash);
    return result;
  }

  // ==========================================================================
  // REACTIONS - VIEW FUNCTIONS
  // ==========================================================================

  /** Get all reactions to a specific dispute */
  static async getDisputeReactions(
    recordHash: string,
    disputerIdHash: string
  ): Promise<Reaction[]> {
    try {
      const contract = this.getReadOnlyContract();
      const fn = contract.getFunction('getDisputeReactions');
      const raw = await fn(recordHash, disputerIdHash);

      return raw.map((r: any) => ({
        reactorIdHash: r.reactorIdHash,
        supportsDispute: r.supportsDispute,
        timestamp: Number(r.timestamp),
        isActive: r.isActive,
      }));
    } catch (error) {
      console.error('Error getting dispute reactions:', error);
      return [];
    }
  }

  /** Check if a user has reacted to a specific dispute */
  static async hasUserReacted(
    recordHash: string,
    disputerIdHash: string,
    reactorIdHash: string
  ): Promise<boolean> {
    try {
      const contract = this.getReadOnlyContract();
      const fn = contract.getFunction('hasUserReacted');
      return await fn(recordHash, disputerIdHash, reactorIdHash);
    } catch (error) {
      console.error('Error checking if user reacted:', error);
      return false;
    }
  }

  /** Get a specific user's reaction to a dispute */
  static async getUserReaction(
    recordHash: string,
    disputerIdHash: string,
    reactorIdHash: string
  ): Promise<{
    exists: boolean;
    supportsDispute: boolean;
    timestamp: number;
    isActive: boolean;
  }> {
    try {
      const contract = this.getReadOnlyContract();
      const fn = contract.getFunction('getUserReaction');
      const result = await fn(recordHash, disputerIdHash, reactorIdHash);

      return {
        exists: result[0],
        supportsDispute: result[1],
        timestamp: Number(result[2]),
        isActive: result[3],
      };
    } catch (error) {
      console.error('Error getting user reaction:', error);
      return { exists: false, supportsDispute: false, timestamp: 0, isActive: false };
    }
  }

  /** Get reaction stats for a dispute */
  static async getReactionStats(
    recordHash: string,
    disputerIdHash: string
  ): Promise<ReactionStats> {
    try {
      const contract = this.getReadOnlyContract();
      const fn = contract.getFunction('getReactionStats');
      const result = await fn(recordHash, disputerIdHash);

      return {
        totalReactions: Number(result[0]),
        activeSupports: Number(result[1]),
        activeOpposes: Number(result[2]),
      };
    } catch (error) {
      console.error('Error getting reaction stats:', error);
      return { totalReactions: 0, activeSupports: 0, activeOpposes: 0 };
    }
  }

  // ==========================================================================
  // UNACCEPTED UPDATE FLAGS - VIEW FUNCTIONS
  // Note: Write functions (flagUnacceptedUpdate, resolveUnacceptedUpdate)
  // are admin-only and handled by Cloud Functions
  // ==========================================================================

  /** Get all flags for a subject */
  static async getUnacceptedUpdateFlags(subjectIdHash: string): Promise<UnacceptedUpdateFlag[]> {
    try {
      const contract = this.getReadOnlyContract();
      const fn = contract.getFunction('getUnacceptedUpdateFlags');
      const raw = await fn(subjectIdHash);

      return raw.map((f: any) => ({
        recordId: f.recordId,
        noteHash: f.noteHash,
        createdAt: Number(f.createdAt),
        resolution: Number(f.resolution) as ResolutionType,
        resolvedAt: Number(f.resolvedAt),
        isActive: f.isActive,
      }));
    } catch (error) {
      console.error('Error getting unaccepted update flags:', error);
      return [];
    }
  }

  /** Get count of active (unresolved) flags for a subject */
  static async getActiveUnacceptedFlagCount(subjectIdHash: string): Promise<number> {
    try {
      const contract = this.getReadOnlyContract();
      const fn = contract.getFunction('getActiveUnacceptedFlagCount');
      const count = await fn(subjectIdHash);
      return Number(count);
    } catch (error) {
      console.error('Error getting active unaccepted flag count:', error);
      return 0;
    }
  }

  /** Check if a subject has any active flags */
  static async hasActiveUnacceptedFlags(subjectIdHash: string): Promise<boolean> {
    try {
      const contract = this.getReadOnlyContract();
      const fn = contract.getFunction('hasActiveUnacceptedFlags');
      return await fn(subjectIdHash);
    } catch (error) {
      console.error('Error checking if has active unaccepted flags:', error);
      return false;
    }
  }

  /** Get total flag stats */
  static async getTotalUnacceptedFlagStats(): Promise<number> {
    try {
      const contract = this.getReadOnlyContract();
      const fn = contract.getFunction('getTotalUnacceptedFlagStats');
      const total = await fn();
      return Number(total);
    } catch (error) {
      console.error('Error getting total unaccepted flag stats:', error);
      return 0;
    }
  }

  // ==========================================================================
  // SUMMARY VIEW FUNCTIONS
  // ==========================================================================

  /** Get complete review summary for a record hash */
  static async getRecordHashReviewSummary(recordHash: string): Promise<RecordReviewSummary> {
    try {
      const contract = this.getReadOnlyContract();
      const fn = contract.getFunction('getRecordHashReviewSummary');
      const result = await fn(recordHash);

      return {
        activeVerifications: Number(result[0]),
        activeDisputes: Number(result[1]),
        verificationCount: Number(result[2]),
        disputeCount: Number(result[3]),
      };
    } catch (error) {
      console.error('Error getting record hash review summary:', error);
      return { activeVerifications: 0, activeDisputes: 0, verificationCount: 0, disputeCount: 0 };
    }
  }

  /** Get a user's complete review history */
  static async getUserReviewHistory(userIdHash: string): Promise<UserReviewHistory> {
    try {
      const contract = this.getReadOnlyContract();
      const fn = contract.getFunction('getUserReviewHistory');
      const result = await fn(userIdHash);

      return {
        userVerifications: Number(result[0]),
        userDisputes: Number(result[1]),
      };
    } catch (error) {
      console.error('Error getting user review history:', error);
      return { userVerifications: 0, userDisputes: 0 };
    }
  }

  /** Get total review counts across all records */
  static async getTotalReviewStats(): Promise<TotalReviewStats> {
    try {
      const contract = this.getReadOnlyContract();
      const fn = contract.getFunction('getTotalReviewStats');
      const result = await fn();

      return {
        verificationCount: Number(result[0]),
        disputeCount: Number(result[1]),
      };
    } catch (error) {
      console.error('Error getting total review stats:', error);
      return { verificationCount: 0, disputeCount: 0 };
    }
  }

  // ==========================================================================
  // UTILITY
  // ==========================================================================

  /** Get the contract address (useful for debugging/display) */
  static getContractAddress(): string {
    return HEALTH_RECORD_CORE_ADDRESS;
  }
}

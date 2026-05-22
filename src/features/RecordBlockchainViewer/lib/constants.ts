// src/features/HealthRecordViewer/lib/constants.ts

import { HEALTH_RECORD_CORE, NETWORK } from '@/config/blockchainAddresses';

/**
 * HealthRecordCore Contract Configuration
 */

export const HEALTH_RECORD_CORE_ADDRESS = HEALTH_RECORD_CORE.proxy;
export const RPC_URL = NETWORK.rpcUrl;
export const RPC_URL_FALLBACK = NETWORK.rpcUrlFallback;
export const DEPLOYMENT_BLOCK = HEALTH_RECORD_CORE.deploymentBlock;

/**
 * Contract ABI - View functions and events needed for the admin dashboard
 *
 * This is a minimal ABI containing only the functions we use for reading data.
 * The full contract has additional write functions.
 */
export const HEALTH_RECORD_CORE_ABI = [
  // ===============================================================
  // EVENTS
  // ===============================================================

  // Record Anchoring Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'bytes32', name: 'recordIdHash', type: 'bytes32' },
      { indexed: true, internalType: 'bytes32', name: 'recordHash', type: 'bytes32' },
      { indexed: true, internalType: 'bytes32', name: 'subjectIdHash', type: 'bytes32' },
      { indexed: false, internalType: 'uint256', name: 'timestamp', type: 'uint256' },
    ],
    name: 'RecordAnchored',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'bytes32', name: 'recordIdHash', type: 'bytes32' },
      { indexed: true, internalType: 'bytes32', name: 'subjectIdHash', type: 'bytes32' },
      { indexed: false, internalType: 'uint256', name: 'timestamp', type: 'uint256' },
    ],
    name: 'RecordUnanchored',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'bytes32', name: 'recordIdHash', type: 'bytes32' },
      { indexed: true, internalType: 'bytes32', name: 'subjectIdHash', type: 'bytes32' },
      { indexed: false, internalType: 'uint256', name: 'timestamp', type: 'uint256' },
    ],
    name: 'RecordReanchored',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'bytes32', name: 'recordIdHash', type: 'bytes32' },
      { indexed: true, internalType: 'bytes32', name: 'newHash', type: 'bytes32' },
      { indexed: false, internalType: 'bytes32', name: 'addedBy', type: 'bytes32' },
      { indexed: false, internalType: 'uint256', name: 'timestamp', type: 'uint256' },
    ],
    name: 'RecordHashAdded',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'bytes32', name: 'recordIdHash', type: 'bytes32' },
      { indexed: true, internalType: 'bytes32', name: 'recordHash', type: 'bytes32' },
      { indexed: false, internalType: 'uint256', name: 'timestamp', type: 'uint256' },
    ],
    name: 'RecordHashRetracted',
    type: 'event',
  },

  // Verification Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'bytes32', name: 'recordHash', type: 'bytes32' },
      { indexed: true, internalType: 'bytes32', name: 'recordIdHash', type: 'bytes32' },
      { indexed: true, internalType: 'bytes32', name: 'verifierIdHash', type: 'bytes32' },
      {
        indexed: false,
        internalType: 'enum HealthRecordCore.VerificationLevel',
        name: 'level',
        type: 'uint8',
      },
      { indexed: false, internalType: 'uint256', name: 'timestamp', type: 'uint256' },
    ],
    name: 'RecordVerified',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'bytes32', name: 'recordHash', type: 'bytes32' },
      { indexed: true, internalType: 'bytes32', name: 'verifierIdHash', type: 'bytes32' },
      { indexed: false, internalType: 'uint256', name: 'timestamp', type: 'uint256' },
    ],
    name: 'VerificationRetracted',
    type: 'event',
  },

  // Dispute Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'bytes32', name: 'recordHash', type: 'bytes32' },
      { indexed: true, internalType: 'bytes32', name: 'recordIdHash', type: 'bytes32' },
      { indexed: true, internalType: 'bytes32', name: 'disputerIdHash', type: 'bytes32' },
      {
        indexed: false,
        internalType: 'enum HealthRecordCore.DisputeSeverity',
        name: 'severity',
        type: 'uint8',
      },
      {
        indexed: false,
        internalType: 'enum HealthRecordCore.DisputeCulpability',
        name: 'culpability',
        type: 'uint8',
      },
      { indexed: false, internalType: 'uint256', name: 'timestamp', type: 'uint256' },
    ],
    name: 'RecordDisputed',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'bytes32', name: 'recordHash', type: 'bytes32' },
      { indexed: true, internalType: 'bytes32', name: 'disputerIdHash', type: 'bytes32' },
      { indexed: false, internalType: 'uint256', name: 'timestamp', type: 'uint256' },
    ],
    name: 'DisputeRetracted',
    type: 'event',
  },

  // Unaccepted Update Flag Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'bytes32', name: 'subjectIdHash', type: 'bytes32' },
      { indexed: true, internalType: 'bytes32', name: 'recordIdHash', type: 'bytes32' },
      { indexed: true, internalType: 'bytes32', name: 'reporterIdHash', type: 'bytes32' },
      { indexed: false, internalType: 'bytes32', name: 'recordHash', type: 'bytes32' },
      { indexed: false, internalType: 'uint256', name: 'timestamp', type: 'uint256' },
    ],
    name: 'UnacceptedUpdateFlagged',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'bytes32', name: 'subjectIdHash', type: 'bytes32' },
      { indexed: true, internalType: 'bytes32', name: 'recordIdHash', type: 'bytes32' },
      { indexed: true, internalType: 'bytes32', name: 'reporterIdHash', type: 'bytes32' },
      { indexed: false, internalType: 'uint256', name: 'timestamp', type: 'uint256' },
    ],
    name: 'UnacceptedUpdateFlagRevoked',
    type: 'event',
  },

  // ===============================================================
  // VIEW FUNCTIONS - STATS
  // ===============================================================

  {
    inputs: [],
    name: 'getTotalAnchoredRecords',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalVerifications',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalDisputes',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalUnacceptedFlags',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },

  // ===============================================================
  // VIEW FUNCTIONS - RECORD ANCHORING
  // ===============================================================

  {
    inputs: [{ internalType: 'bytes32', name: 'recordIdHash', type: 'bytes32' }],
    name: 'getRecordSubjects',
    outputs: [{ internalType: 'bytes32[]', name: '', type: 'bytes32[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'bytes32', name: 'userIdHash', type: 'bytes32' }],
    name: 'getSubjectMedicalHistory',
    outputs: [{ internalType: 'bytes32[]', name: '', type: 'bytes32[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'bytes32', name: 'recordIdHash', type: 'bytes32' },
      { internalType: 'bytes32', name: 'userIdHash', type: 'bytes32' },
    ],
    name: 'isSubject',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'bytes32', name: 'recordIdHash', type: 'bytes32' },
      { internalType: 'bytes32', name: 'userIdHash', type: 'bytes32' },
    ],
    name: 'isActiveSubject',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'bytes32', name: 'recordIdHash', type: 'bytes32' }],
    name: 'getActiveRecordSubjects',
    outputs: [{ internalType: 'bytes32[]', name: '', type: 'bytes32[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'bytes32', name: 'recordIdHash', type: 'bytes32' }],
    name: 'getSubjectStats',
    outputs: [
      { internalType: 'uint256', name: 'total', type: 'uint256' },
      { internalType: 'uint256', name: 'active', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'bytes32', name: 'recordIdHash', type: 'bytes32' }],
    name: 'getRecordVersionHistory',
    outputs: [{ internalType: 'bytes32[]', name: '', type: 'bytes32[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'bytes32', name: 'recordHash', type: 'bytes32' }],
    name: 'getRecordIdForHash',
    outputs: [{ internalType: 'bytes32', name: '', type: 'bytes32' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'bytes32', name: 'recordHash', type: 'bytes32' }],
    name: 'doesHashExist',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'bytes32', name: 'recordIdHash', type: 'bytes32' }],
    name: 'getVersionCount',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },

  // ===============================================================
  // VIEW FUNCTIONS - VERIFICATIONS
  // ===============================================================

  {
    inputs: [{ internalType: 'bytes32', name: 'recordHash', type: 'bytes32' }],
    name: 'getVerifications',
    outputs: [
      {
        components: [
          { internalType: 'bytes32', name: 'verifierIdHash', type: 'bytes32' },
          { internalType: 'bytes32', name: 'recordIdHash', type: 'bytes32' },
          { internalType: 'enum HealthRecordCore.VerificationLevel', name: 'level', type: 'uint8' },
          { internalType: 'uint256', name: 'createdAt', type: 'uint256' },
          { internalType: 'bool', name: 'isActive', type: 'bool' },
        ],
        internalType: 'struct HealthRecordCore.Verification[]',
        name: '',
        type: 'tuple[]',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'bytes32', name: 'recordHash', type: 'bytes32' },
      { internalType: 'bytes32', name: 'userIdHash', type: 'bytes32' },
    ],
    name: 'hasUserVerified',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'bytes32', name: 'recordHash', type: 'bytes32' },
      { internalType: 'bytes32', name: 'userIdHash', type: 'bytes32' },
    ],
    name: 'getUserVerification',
    outputs: [
      { internalType: 'bool', name: 'exists', type: 'bool' },
      { internalType: 'bytes32', name: 'recordIdHash', type: 'bytes32' },
      { internalType: 'enum HealthRecordCore.VerificationLevel', name: 'level', type: 'uint8' },
      { internalType: 'uint256', name: 'createdAt', type: 'uint256' },
      { internalType: 'bool', name: 'isActive', type: 'bool' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'bytes32', name: 'recordHash', type: 'bytes32' }],
    name: 'getVerificationStats',
    outputs: [
      { internalType: 'uint256', name: 'total', type: 'uint256' },
      { internalType: 'uint256', name: 'active', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'bytes32', name: 'userIdHash', type: 'bytes32' }],
    name: 'getUserVerifications',
    outputs: [{ internalType: 'bytes32[]', name: '', type: 'bytes32[]' }],
    stateMutability: 'view',
    type: 'function',
  },

  // ===============================================================
  // VIEW FUNCTIONS - DISPUTES
  // ===============================================================

  {
    inputs: [{ internalType: 'bytes32', name: 'recordHash', type: 'bytes32' }],
    name: 'getDisputes',
    outputs: [
      {
        components: [
          { internalType: 'bytes32', name: 'disputerIdHash', type: 'bytes32' },
          { internalType: 'bytes32', name: 'recordIdHash', type: 'bytes32' },
          {
            internalType: 'enum HealthRecordCore.DisputeSeverity',
            name: 'severity',
            type: 'uint8',
          },
          {
            internalType: 'enum HealthRecordCore.DisputeCulpability',
            name: 'culpability',
            type: 'uint8',
          },
          { internalType: 'string', name: 'notes', type: 'string' },
          { internalType: 'uint256', name: 'createdAt', type: 'uint256' },
          { internalType: 'bool', name: 'isActive', type: 'bool' },
        ],
        internalType: 'struct HealthRecordCore.Dispute[]',
        name: '',
        type: 'tuple[]',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'bytes32', name: 'recordHash', type: 'bytes32' },
      { internalType: 'bytes32', name: 'userIdHash', type: 'bytes32' },
    ],
    name: 'hasUserDisputed',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'bytes32', name: 'recordHash', type: 'bytes32' },
      { internalType: 'bytes32', name: 'userIdHash', type: 'bytes32' },
    ],
    name: 'getUserDispute',
    outputs: [
      { internalType: 'bool', name: 'exists', type: 'bool' },
      { internalType: 'bytes32', name: 'recordIdHash', type: 'bytes32' },
      { internalType: 'enum HealthRecordCore.DisputeSeverity', name: 'severity', type: 'uint8' },
      {
        internalType: 'enum HealthRecordCore.DisputeCulpability',
        name: 'culpability',
        type: 'uint8',
      },
      { internalType: 'string', name: 'notes', type: 'string' },
      { internalType: 'uint256', name: 'createdAt', type: 'uint256' },
      { internalType: 'bool', name: 'isActive', type: 'bool' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'bytes32', name: 'recordHash', type: 'bytes32' }],
    name: 'getDisputeStats',
    outputs: [
      { internalType: 'uint256', name: 'total', type: 'uint256' },
      { internalType: 'uint256', name: 'active', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'bytes32', name: 'userIdHash', type: 'bytes32' }],
    name: 'getUserDisputes',
    outputs: [{ internalType: 'bytes32[]', name: '', type: 'bytes32[]' }],
    stateMutability: 'view',
    type: 'function',
  },

  // ===============================================================
  // VIEW FUNCTIONS - UNACCEPTED FLAGS
  // ===============================================================

  {
    inputs: [{ internalType: 'bytes32', name: 'subjectIdHash', type: 'bytes32' }],
    name: 'getUnacceptedFlags',
    outputs: [
      {
        components: [
          { internalType: 'bytes32', name: 'recordIdHash', type: 'bytes32' },
          { internalType: 'bytes32', name: 'reporterIdHash', type: 'bytes32' },
          { internalType: 'bytes32', name: 'recordHash', type: 'bytes32' },
          { internalType: 'uint256', name: 'createdAt', type: 'uint256' },
          { internalType: 'bool', name: 'isActive', type: 'bool' },
        ],
        internalType: 'struct HealthRecordCore.UnacceptedFlag[]',
        name: '',
        type: 'tuple[]',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'bytes32', name: 'subjectIdHash', type: 'bytes32' },
      { internalType: 'bytes32', name: 'recordIdHash', type: 'bytes32' },
    ],
    name: 'getUnacceptedFlag',
    outputs: [
      { internalType: 'bool', name: 'exists', type: 'bool' },
      { internalType: 'bool', name: 'isActive', type: 'bool' },
      { internalType: 'bytes32', name: 'reporterIdHash', type: 'bytes32' },
      { internalType: 'bytes32', name: 'recordHash', type: 'bytes32' },
      { internalType: 'uint256', name: 'createdAt', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'bytes32', name: 'subjectIdHash', type: 'bytes32' }],
    name: 'getActiveUnacceptedFlagCount',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'bytes32', name: 'subjectIdHash', type: 'bytes32' }],
    name: 'hasActiveUnacceptedFlags',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
];

// src/features/HealthRecordViewer/lib/constants.ts

/**
 * HealthRecordCore Contract Configuration
 */

// TODO: Update with your deployed contract address
export const HEALTH_RECORD_CORE_ADDRESS = '0xDC79F803594232421f49a29D9EcEbe78015d48e1';

export const SEPOLIA_RPC_URL = 'https://1rpc.io/sepolia';
export const ETHERSCAN_BASE_URL = 'https://sepolia.etherscan.io';
export const DEPLOYMENT_BLOCK = 9967778;

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
      { indexed: true, internalType: 'string', name: 'recordId', type: 'string' },
      { indexed: true, internalType: 'string', name: 'recordHash', type: 'string' },
      { indexed: true, internalType: 'bytes32', name: 'subjectIdHash', type: 'bytes32' },
      { indexed: false, internalType: 'uint256', name: 'timestamp', type: 'uint256' },
    ],
    name: 'RecordAnchored',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'string', name: 'recordId', type: 'string' },
      { indexed: true, internalType: 'bytes32', name: 'subjectIdHash', type: 'bytes32' },
      { indexed: false, internalType: 'uint256', name: 'timestamp', type: 'uint256' },
    ],
    name: 'RecordUnanchored',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'string', name: 'recordId', type: 'string' },
      { indexed: true, internalType: 'bytes32', name: 'subjectIdHash', type: 'bytes32' },
      { indexed: false, internalType: 'uint256', name: 'timestamp', type: 'uint256' },
    ],
    name: 'RecordReanchored',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'string', name: 'recordId', type: 'string' },
      { indexed: true, internalType: 'string', name: 'newHash', type: 'string' },
      { indexed: false, internalType: 'bytes32', name: 'addedBy', type: 'bytes32' },
      { indexed: false, internalType: 'uint256', name: 'timestamp', type: 'uint256' },
    ],
    name: 'RecordHashAdded',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'string', name: 'recordId', type: 'string' },
      { indexed: true, internalType: 'string', name: 'recordHash', type: 'string' },
      { indexed: false, internalType: 'uint256', name: 'timestamp', type: 'uint256' },
    ],
    name: 'RecordHashRetracted',
    type: 'event',
  },

  // Verification Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'string', name: 'recordHash', type: 'string' },
      { indexed: true, internalType: 'string', name: 'recordId', type: 'string' },
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
      { indexed: true, internalType: 'string', name: 'recordHash', type: 'string' },
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
      { indexed: true, internalType: 'string', name: 'recordHash', type: 'string' },
      { indexed: true, internalType: 'string', name: 'recordId', type: 'string' },
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
      { indexed: true, internalType: 'string', name: 'recordHash', type: 'string' },
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
      { indexed: true, internalType: 'string', name: 'recordId', type: 'string' },
      { indexed: true, internalType: 'string', name: 'noteHash', type: 'string' },
      { indexed: false, internalType: 'uint256', name: 'flagIndex', type: 'uint256' },
      { indexed: false, internalType: 'uint256', name: 'timestamp', type: 'uint256' },
    ],
    name: 'UnacceptedUpdateFlagged',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'bytes32', name: 'subjectIdHash', type: 'bytes32' },
      { indexed: true, internalType: 'uint256', name: 'flagIndex', type: 'uint256' },
      {
        indexed: false,
        internalType: 'enum HealthRecordCore.ResolutionType',
        name: 'resolution',
        type: 'uint8',
      },
      { indexed: false, internalType: 'uint256', name: 'timestamp', type: 'uint256' },
    ],
    name: 'UnacceptedUpdateResolved',
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
    inputs: [{ internalType: 'string', name: 'recordId', type: 'string' }],
    name: 'getRecordSubjects',
    outputs: [{ internalType: 'bytes32[]', name: '', type: 'bytes32[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'bytes32', name: 'userIdHash', type: 'bytes32' }],
    name: 'getSubjectMedicalHistory',
    outputs: [{ internalType: 'string[]', name: '', type: 'string[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'string', name: 'recordId', type: 'string' },
      { internalType: 'bytes32', name: 'userIdHash', type: 'bytes32' },
    ],
    name: 'isSubject',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'string', name: 'recordId', type: 'string' },
      { internalType: 'bytes32', name: 'userIdHash', type: 'bytes32' },
    ],
    name: 'isActiveSubject',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'string', name: 'recordId', type: 'string' }],
    name: 'getActiveRecordSubjects',
    outputs: [{ internalType: 'bytes32[]', name: '', type: 'bytes32[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'string', name: 'recordId', type: 'string' }],
    name: 'getSubjectStats',
    outputs: [
      { internalType: 'uint256', name: 'total', type: 'uint256' },
      { internalType: 'uint256', name: 'active', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'string', name: 'recordId', type: 'string' }],
    name: 'getRecordVersionHistory',
    outputs: [{ internalType: 'string[]', name: '', type: 'string[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'string', name: 'recordHash', type: 'string' }],
    name: 'getRecordIdForHash',
    outputs: [{ internalType: 'string', name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'string', name: 'recordHash', type: 'string' }],
    name: 'doesHashExist',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'string', name: 'recordId', type: 'string' }],
    name: 'getVersionCount',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },

  // ===============================================================
  // VIEW FUNCTIONS - VERIFICATIONS
  // ===============================================================

  {
    inputs: [{ internalType: 'string', name: 'recordHash', type: 'string' }],
    name: 'getVerifications',
    outputs: [
      {
        components: [
          { internalType: 'bytes32', name: 'verifierIdHash', type: 'bytes32' },
          { internalType: 'string', name: 'recordId', type: 'string' },
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
      { internalType: 'string', name: 'recordHash', type: 'string' },
      { internalType: 'bytes32', name: 'userIdHash', type: 'bytes32' },
    ],
    name: 'hasUserVerified',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'string', name: 'recordHash', type: 'string' },
      { internalType: 'bytes32', name: 'userIdHash', type: 'bytes32' },
    ],
    name: 'getUserVerification',
    outputs: [
      { internalType: 'bool', name: 'exists', type: 'bool' },
      { internalType: 'string', name: 'recordId', type: 'string' },
      { internalType: 'enum HealthRecordCore.VerificationLevel', name: 'level', type: 'uint8' },
      { internalType: 'uint256', name: 'createdAt', type: 'uint256' },
      { internalType: 'bool', name: 'isActive', type: 'bool' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'string', name: 'recordHash', type: 'string' }],
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
    outputs: [{ internalType: 'string[]', name: '', type: 'string[]' }],
    stateMutability: 'view',
    type: 'function',
  },

  // ===============================================================
  // VIEW FUNCTIONS - DISPUTES
  // ===============================================================

  {
    inputs: [{ internalType: 'string', name: 'recordHash', type: 'string' }],
    name: 'getDisputes',
    outputs: [
      {
        components: [
          { internalType: 'bytes32', name: 'disputerIdHash', type: 'bytes32' },
          { internalType: 'string', name: 'recordId', type: 'string' },
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
      { internalType: 'string', name: 'recordHash', type: 'string' },
      { internalType: 'bytes32', name: 'userIdHash', type: 'bytes32' },
    ],
    name: 'hasUserDisputed',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'string', name: 'recordHash', type: 'string' },
      { internalType: 'bytes32', name: 'userIdHash', type: 'bytes32' },
    ],
    name: 'getUserDispute',
    outputs: [
      { internalType: 'bool', name: 'exists', type: 'bool' },
      { internalType: 'string', name: 'recordId', type: 'string' },
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
    inputs: [{ internalType: 'string', name: 'recordHash', type: 'string' }],
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
    outputs: [{ internalType: 'string[]', name: '', type: 'string[]' }],
    stateMutability: 'view',
    type: 'function',
  },

  // ===============================================================
  // VIEW FUNCTIONS - REACTIONS
  // ===============================================================

  {
    inputs: [
      { internalType: 'string', name: 'recordHash', type: 'string' },
      { internalType: 'bytes32', name: 'disputerIdHash', type: 'bytes32' },
    ],
    name: 'getDisputeReactions',
    outputs: [
      {
        components: [
          { internalType: 'bytes32', name: 'reactorIdHash', type: 'bytes32' },
          { internalType: 'bool', name: 'supportsDispute', type: 'bool' },
          { internalType: 'uint256', name: 'timestamp', type: 'uint256' },
          { internalType: 'bool', name: 'isActive', type: 'bool' },
        ],
        internalType: 'struct HealthRecordCore.Reaction[]',
        name: '',
        type: 'tuple[]',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'string', name: 'recordHash', type: 'string' },
      { internalType: 'bytes32', name: 'disputerIdHash', type: 'bytes32' },
    ],
    name: 'getReactionStats',
    outputs: [
      { internalType: 'uint256', name: 'totalReactions', type: 'uint256' },
      { internalType: 'uint256', name: 'activeSupports', type: 'uint256' },
      { internalType: 'uint256', name: 'activeOpposes', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },

  // ===============================================================
  // VIEW FUNCTIONS - UNACCEPTED FLAGS
  // ===============================================================

  {
    inputs: [{ internalType: 'bytes32', name: 'subjectIdHash', type: 'bytes32' }],
    name: 'getUnacceptedUpdateFlags',
    outputs: [
      {
        components: [
          { internalType: 'string', name: 'recordId', type: 'string' },
          { internalType: 'string', name: 'noteHash', type: 'string' },
          { internalType: 'uint256', name: 'createdAt', type: 'uint256' },
          {
            internalType: 'enum HealthRecordCore.ResolutionType',
            name: 'resolution',
            type: 'uint8',
          },
          { internalType: 'uint256', name: 'resolvedAt', type: 'uint256' },
          { internalType: 'bool', name: 'isActive', type: 'bool' },
        ],
        internalType: 'struct HealthRecordCore.UnacceptedUpdateFlag[]',
        name: '',
        type: 'tuple[]',
      },
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
    inputs: [
      { internalType: 'bytes32', name: 'subjectIdHash', type: 'bytes32' },
      { internalType: 'uint256', name: 'flagIndex', type: 'uint256' },
    ],
    name: 'getUnacceptedUpdateFlag',
    outputs: [
      { internalType: 'string', name: 'recordId', type: 'string' },
      { internalType: 'string', name: 'noteHash', type: 'string' },
      { internalType: 'uint256', name: 'createdAt', type: 'uint256' },
      { internalType: 'enum HealthRecordCore.ResolutionType', name: 'resolution', type: 'uint8' },
      { internalType: 'uint256', name: 'resolvedAt', type: 'uint256' },
      { internalType: 'bool', name: 'isActive', type: 'bool' },
    ],
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

  // ===============================================================
  // VIEW FUNCTIONS - SUMMARY
  // ===============================================================

  {
    inputs: [{ internalType: 'string', name: 'recordHash', type: 'string' }],
    name: 'getRecordHashReviewSummary',
    outputs: [
      { internalType: 'uint256', name: 'activeVerifications', type: 'uint256' },
      { internalType: 'uint256', name: 'activeDisputes', type: 'uint256' },
      { internalType: 'uint256', name: 'verificationCount', type: 'uint256' },
      { internalType: 'uint256', name: 'disputeCount', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'bytes32', name: 'userIdHash', type: 'bytes32' }],
    name: 'getUserReviewHistory',
    outputs: [
      { internalType: 'uint256', name: 'userVerifications', type: 'uint256' },
      { internalType: 'uint256', name: 'userDisputes', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getTotalReviewStats',
    outputs: [
      { internalType: 'uint256', name: 'verificationCount', type: 'uint256' },
      { internalType: 'uint256', name: 'disputeCount', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
];

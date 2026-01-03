// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title MemberRoleManagerInterface
 * @dev Interface for HealthRecordCore to reference
 */
interface MemberRoleManagerInterface {
  function isActiveMember(address wallet) external view returns (bool);

  function isVerifiedMember(address wallet) external view returns (bool);

  function hasActiveRole(string memory recordId, address wallet) external view returns (bool);

  function hasRole(
    string memory recordId,
    address wallet,
    string memory role
  ) external view returns (bool);

  function isOwnerOrAdmin(string memory recordId, address wallet) external view returns (bool);

  function getUserForWallet(address wallet) external view returns (bytes32);
}

/**
 * @title HealthRecordCore
 * @dev Handles record anchoring and record reviews
 * References MemberRoleManager for membership and role checks
 */
contract HealthRecordCore {
  // ===============================================================
  // CONTRACT SETUP
  // ===============================================================

  MemberRoleManagerInterface public memberRoleManager;

  address public admin;
  event AdminTransferred(address indexed oldAdmin, address indexed newAdmin, uint256 timestamp);

  //As in only the Admin wallet can do this function. Don't confuse with Admin role for users below
  modifier onlyAdmin() {
    require(msg.sender == admin, 'Only admin');
    _;
  }

  modifier onlyActiveMember() {
    require(memberRoleManager.isActiveMember(msg.sender), 'Not an active member');
    _;
  }

  modifier onlyVerifiedMember() {
    require(memberRoleManager.isVerifiedMember(msg.sender), 'Not a verified member');
    _;
  }

  modifier onlyRecordParticipant(string memory recordId) {
    require(memberRoleManager.hasActiveRole(recordId, msg.sender), 'No access to this record');
    _;
  }

  modifier onlyOwnerOrAdmin(string memory recordId) {
    require(memberRoleManager.isOwnerOrAdmin(recordId, msg.sender), 'Only owner or admin');
    _;
  }

  modifier onlyOwner(string memory recordId) {
    require(memberRoleManager.hasRole(recordId, msg.sender, 'owner'), 'Only owner');
    _;
  }

  constructor(address _memberRoleManager) {
    require(_memberRoleManager != address(0), 'Invalid MemberRoleManager address');
    memberRoleManager = MemberRoleManagerInterface(_memberRoleManager);
    admin = msg.sender;
  }

  function transferAdmin(address newAdmin) external onlyAdmin {
    require(newAdmin != address(0), 'Invalid address');
    emit AdminTransferred(admin, newAdmin, block.timestamp);
    admin = newAdmin;
  }

  /**
   * @notice Update the MemberRoleManager reference (in case of upgrade)
   */
  function setMemberRoleManager(address _memberRoleManager) external onlyAdmin {
    require(_memberRoleManager != address(0), 'Invalid address');
    memberRoleManager = MemberRoleManagerInterface(_memberRoleManager);
  }

  // ===============================================================
  // RECORD ANCHORING
  // ===============================================================

  // =================== RECORD ANCHORING - EVENTS ===================

  event RecordAnchored(
    string indexed recordId,
    string indexed recordHash,
    bytes32 indexed subjectIdHash,
    uint256 timestamp
  );

  event RecordUnanchored(string indexed recordId, bytes32 indexed subjectIdHash, uint256 timestamp);

  event RecordReanchored(string indexed recordId, bytes32 indexed subjectIdHash, uint256 timestamp);

  event RecordHashAdded(
    string indexed recordId,
    string indexed newHash,
    bytes32 addedBy,
    uint256 timestamp
  );

  event RecordHashRetracted(string indexed recordId, string indexed recordHash, uint256 timestamp);

  // =================== RECORD ANCHORING - STORAGE ===================

  //recordId => list of subject userIdHashes (who is this record about)
  mapping(string => bytes32[]) public recordSubjects;

  // recordId => subjectIdHash => bool (quick lookup: is this user a subject?)
  mapping(string => mapping(bytes32 => bool)) public isSubjectOfRecord;

  // userIdHash => list of recordIds (user's complete medical history)
  mapping(bytes32 => string[]) public subjectMedicalHistory;

  // recordId => subjectIdHash => bool (is this subject link active?)
  mapping(string => mapping(bytes32 => bool)) public isSubjectActive;

  //recordHash => recordId (each hash belongs to exactly one record)
  mapping(string => string) public recordIdForHash;

  //recordId => list of hashes (versionhistory)
  mapping(string => string[]) public recordVersionHistory;

  // recordHash => bool (is this hash actively attached to a record)
  mapping(string => bool) public isHashActive; //soft-delete toggle

  uint256 public totalAnchoredRecords;

  // =================== RECORD ANCHORING - FUNCTIONS ===================

  /**
   * @notice Subject anchors themselves to a record with a hash
   * @dev First subject establishes initial hash; subsequent subjects confirm it
   * @param recordId The record ID
   * @param recordHash The content hash (must match current if not first subject)
   */
  function anchorRecord(
    string memory recordId,
    string memory recordHash
  ) external onlyActiveMember onlyRecordParticipant(recordId) {
    require(bytes(recordId).length > 0, 'Record ID cannot be empty');
    require(bytes(recordHash).length > 0, 'Record hash cannot be empty');
    require(bytes(recordIdForHash[recordHash]).length == 0, 'Hash already in use');

    //Caller is the Subject
    bytes32 subjectIdHash = memberRoleManager.getUserForWallet(msg.sender);
    require(subjectIdHash != bytes32(0), 'Wallet not registered');

    // Check not already anchored
    require(!isSubjectOfRecord[recordId][subjectIdHash], 'Record already anchored to this subject');

    //Check if this is the first subject, if yes, initialize hash as well
    bool isFirstSubject = recordSubjects[recordId].length == 0;

    if (isFirstSubject) {
      require(!isHashActive[recordHash], 'Hash already used');

      recordIdForHash[recordHash] = recordId;
      recordVersionHistory[recordId].push(recordHash);
      isHashActive[recordHash] = true;
    }

    recordSubjects[recordId].push(subjectIdHash);
    isSubjectOfRecord[recordId][subjectIdHash] = true;
    isSubjectActive[recordId][subjectIdHash] = true;
    subjectMedicalHistory[subjectIdHash].push(recordId);

    totalAnchoredRecords++;

    emit RecordAnchored(recordId, recordHash, subjectIdHash, block.timestamp);
  }

  /**
   * @notice Deactivate a subject link (soft delete)
   * @param recordId The record ID
   */
  function unanchorRecord(
    string memory recordId
  ) external onlyActiveMember onlyRecordParticipant(recordId) {
    bytes32 subjectIdHash = memberRoleManager.getUserForWallet(msg.sender);
    require(subjectIdHash != bytes32(0), 'Wallet not registered');
    require(isSubjectOfRecord[recordId][subjectIdHash], 'Not a subject of this record');
    require(isSubjectActive[recordId][subjectIdHash], 'Already unanchored');

    isSubjectActive[recordId][subjectIdHash] = false;
    //Don't remove from subjectMedicalHistory to preserve audit trail

    emit RecordUnanchored(recordId, subjectIdHash, block.timestamp);
  }

  /**
   * @notice Reactivate a previously unanchored subject link
   * @param recordId The record ID
   */
  function reanchorRecord(
    string memory recordId
  ) external onlyActiveMember onlyRecordParticipant(recordId) {
    bytes32 subjectIdHash = memberRoleManager.getUserForWallet(msg.sender);
    require(subjectIdHash != bytes32(0), 'Wallet not registered');
    require(isSubjectOfRecord[recordId][subjectIdHash], 'Was never a subject');
    require(!isSubjectActive[recordId][subjectIdHash], 'Already active');

    isSubjectActive[recordId][subjectIdHash] = true;

    emit RecordReanchored(recordId, subjectIdHash, block.timestamp);
  }

  /**
   * @notice Add a new hash version to an existing record
   * @dev Only owner/admin can add new versions
   * @param recordId The record ID
   * @param newHash The new content hash
   */
  function addRecordHash(
    string memory recordId,
    string memory newHash
  ) external onlyActiveMember onlyOwnerOrAdmin(recordId) {
    require(bytes(recordIdForHash[newHash]).length == 0, 'Hash already bound to a record');
    require(bytes(newHash).length > 0, 'Hash cannot be empty');
    require(recordSubjects[recordId].length > 0, 'Record not anchored');

    bytes32 userIdHash = memberRoleManager.getUserForWallet(msg.sender);

    recordIdForHash[newHash] = recordId;
    recordVersionHistory[recordId].push(newHash);
    isHashActive[newHash] = true;

    emit RecordHashAdded(recordId, newHash, userIdHash, block.timestamp);
  }

  /**
   * @notice Retract a specific version of a record (e.g., if uploaded in error)
   * @dev Prevents retraction if it is the only active hash remaining
   */
  function retractRecordHash(
    string memory recordId,
    string memory recordHash
  ) external onlyActiveMember onlyOwnerOrAdmin(recordId) {
    // Ensure this hash actually belongs to this recordId
    require(
      keccak256(bytes(recordIdForHash[recordHash])) == keccak256(bytes(recordId)),
      'Hash-Record mismatch'
    );
    require(isHashActive[recordHash], 'Already retracted');

    // Ensure there is at least one hash remaining to be associated with the recordId
    uint256 activeCount = 0;
    string[] memory history = recordVersionHistory[recordId];

    for (uint256 i = 0; i < history.length; i++) {
      if (isHashActive[history[i]]) {
        activeCount++;
      }
    }

    require(activeCount > 1, 'Cannot retract the last active version of a record');

    isHashActive[recordHash] = false;
    delete recordIdForHash[recordHash];
    //Don't remove from recordVersionHistory to preserve audit trail

    emit RecordHashRetracted(recordId, recordHash, block.timestamp);
  }

  // =================== RECORD ANCHORING - VIEW FUNCTIONS ===================

  /**
   * @notice Get the subject (patient) of a record
   */
  function getRecordSubjects(string memory recordId) external view returns (bytes32[] memory) {
    return recordSubjects[recordId];
  }

  /**
   * @notice Get all records where an address is the subject
   */
  function getSubjectMedicalHistory(bytes32 userIdHash) external view returns (string[] memory) {
    return subjectMedicalHistory[userIdHash];
  }

  /**
   * @notice Check if an address is the subject of a record
   */
  function isSubject(string memory recordId, bytes32 userIdHash) external view returns (bool) {
    return isSubjectOfRecord[recordId][userIdHash];
  }

  /**
   * @notice Check if user is an ACTIVE subject of a record
   */
  function isActiveSubject(
    string memory recordId,
    bytes32 userIdHash
  ) external view returns (bool) {
    return isSubjectOfRecord[recordId][userIdHash] && isSubjectActive[recordId][userIdHash];
  }

  /**
   * @notice Get only active subjects for a record
   */
  function getActiveRecordSubjects(
    string memory recordId
  ) external view returns (bytes32[] memory) {
    bytes32[] memory allSubjects = recordSubjects[recordId];

    // Count active first
    uint256 activeCount = 0;
    for (uint256 i = 0; i < allSubjects.length; i++) {
      if (isSubjectActive[recordId][allSubjects[i]]) {
        activeCount++;
      }
    }

    // Build result
    bytes32[] memory result = new bytes32[](activeCount);
    uint256 idx = 0;
    for (uint256 i = 0; i < allSubjects.length; i++) {
      if (isSubjectActive[recordId][allSubjects[i]]) {
        result[idx++] = allSubjects[i];
      }
    }

    return result;
  }

  /**
   * @notice Get subject stats for a record
   */
  function getSubjectStats(
    string memory recordId
  ) external view returns (uint256 total, uint256 active) {
    bytes32[] memory allSubjects = recordSubjects[recordId];
    total = allSubjects.length;

    for (uint256 i = 0; i < allSubjects.length; i++) {
      if (isSubjectActive[recordId][allSubjects[i]]) {
        active++;
      }
    }

    return (total, active);
  }

  /**
   * @notice Get all hashes (Version history) for a record
   */
  function getRecordVersionHistory(string memory recordId) external view returns (string[] memory) {
    return recordVersionHistory[recordId];
  }

  /**
   * @notice Get the recordId that a hash belongs to
   */
  function getRecordIdForHash(string memory recordHash) external view returns (string memory) {
    require(isHashActive[recordHash], 'Hash does not exist');
    return recordIdForHash[recordHash];
  }

  /**
   * @notice Check if a hash exists
   */
  function doesHashExist(string memory recordHash) external view returns (bool) {
    return isHashActive[recordHash];
  }

  /**
   * @notice Get the number of versions for a record
   */
  function getVersionCount(string memory recordId) external view returns (uint256) {
    return recordVersionHistory[recordId].length;
  }

  /**
   * @notice Get total number of anchored records
   */
  function getTotalAnchoredRecords() external view returns (uint256) {
    return totalAnchoredRecords;
  }

  // ===============================================================
  // RECORD REVIEWS
  // ===============================================================

  // =================== RECORD REVIEWS - EVENTS ===================

  event RecordVerified(
    string indexed recordHash,
    string indexed recordId,
    bytes32 indexed verifierIdHash,
    VerificationLevel level,
    uint256 timestamp
  );

  event VerificationRetracted(
    string indexed recordHash,
    bytes32 indexed verifierIdHash,
    uint256 timestamp
  );

  event VerificationLevelModified(
    string indexed recordHash,
    bytes32 indexed verifierIdHash,
    VerificationLevel oldLevel,
    VerificationLevel newLevel,
    uint256 timestamp
  );

  event RecordDisputed(
    string indexed recordHash,
    string indexed recordId,
    bytes32 indexed disputerIdHash,
    DisputeSeverity severity,
    DisputeCulpability culpability,
    uint256 timestamp
  );

  event DisputeRetracted(
    string indexed recordHash,
    bytes32 indexed disputerIdHash,
    uint256 timestamp
  );

  event DisputeModification(
    string indexed recordHash,
    bytes32 indexed disputerIdHash,
    DisputeSeverity oldSeverity,
    DisputeSeverity newSeverity,
    DisputeCulpability oldCulpability,
    DisputeCulpability newCulpability,
    uint256 timestamp
  );

  event DisputeReaction(
    string indexed recordHash,
    bytes32 indexed reactorIdHash,
    bytes32 indexed disputerIdHash,
    bool supportsDispute,
    uint256 timestamp
  );

  event ReactionRetracted(
    string indexed recordHash,
    bytes32 indexed reactorIdHash,
    bytes32 indexed disputerIdHash,
    uint256 timestamp
  );

  event ReactionModified(
    string indexed recordHash,
    bytes32 indexed reactorIdHash,
    bytes32 indexed disputerIdHash,
    bool oldSupport,
    bool newSupport,
    uint256 timestamp
  );

  event UnacceptedUpdateFlagged(
    bytes32 indexed subjectIdHash,
    string indexed recordId,
    string indexed noteHash,
    uint256 flagIndex,
    uint256 timestamp
  );

  event UnacceptedUpdateResolved(
    bytes32 indexed subjectIdHash,
    uint256 indexed flagIndex,
    ResolutionType resolution,
    uint256 timestamp
  );

  // =================== RECORD REVIEWS - ENUMS ===================

  enum VerificationLevel {
    None, //For returning missing
    Provenance,
    Content,
    Full
  }

  enum DisputeSeverity {
    None, //For returning missing
    Negligible,
    Moderate,
    Major
  }

  enum DisputeCulpability {
    None, //For returning missing
    NoFault,
    Systemic,
    Preventable,
    Reckless,
    Intentional
  }

  enum ResolutionType {
    None, // 0 - Unresolved
    PatientAccepted, // 1 - Patient eventually accepted the update
    DoctorWithdrew, // 2 - Doctor withdrew the proposed update
    Arbitrated, // 3 - Belrose made a decision
    Expired // 4 - No resolution after time limit
  }

  // =================== RECORD REVIEWS - STRUCTURES ===================

  struct Verification {
    bytes32 verifierIdHash;
    string recordId;
    VerificationLevel level;
    uint256 createdAt;
    bool isActive;
  }

  struct Dispute {
    bytes32 disputerIdHash;
    string recordId;
    DisputeSeverity severity;
    DisputeCulpability culpability;
    string notes;
    uint256 createdAt;
    bool isActive;
  }

  struct Reaction {
    bytes32 reactorIdHash;
    bool supportsDispute;
    uint256 timestamp;
    bool isActive;
  }

  struct UnacceptedUpdateFlag {
    string recordId;
    string noteHash;
    uint256 createdAt;
    ResolutionType resolution;
    uint256 resolvedAt;
    bool isActive;
  }

  // =================== RECORD REVIEWS - STORAGE ===================

  // Verifications
  mapping(string => Verification[]) public verifications;
  mapping(string => mapping(bytes32 => bool)) public currentlyVerified;
  mapping(string => mapping(bytes32 => uint256)) public verificationIndex;

  // Disputes
  mapping(string => Dispute[]) public disputes;
  mapping(string => mapping(bytes32 => bool)) public currentlyDisputed;
  mapping(string => mapping(bytes32 => uint256)) public disputeIndex;

  // Reactions to disputes
  mapping(string => mapping(bytes32 => Reaction[])) public disputeReactions;
  mapping(string => mapping(bytes32 => mapping(bytes32 => bool))) public currentlyReacted;
  mapping(string => mapping(bytes32 => mapping(bytes32 => uint256))) public reactionIndex;

  //Unaccepted Update Flags
  mapping(bytes32 => UnacceptedUpdateFlag[]) public unacceptedUpdateFlags;
  mapping(bytes32 => uint256) public activeUnacceptedFlagCount;

  // User history
  mapping(bytes32 => string[]) public verificationsByUser;
  mapping(bytes32 => string[]) public disputesByUser;

  uint256 public totalVerifications;
  uint256 public totalDisputes;
  uint256 public totalUnacceptedFlags;

  // =================== RECORD REVIEWS - FUNCTIONS ===================

  // ------------------- VERIFICATIONS -------------------

  /**
   * @notice Verify a record hash (vouch for its accuracy)
   * @param recordId The recordId this hash is claimed to be for
   * @param recordHash The hash being verified
   */
  function verifyRecord(
    string memory recordId,
    string memory recordHash,
    uint8 level
  ) external onlyActiveMember onlyRecordParticipant(recordId) {
    require(bytes(recordId).length > 0, 'Record ID cannot be empty');
    require(bytes(recordHash).length > 0, 'Record hash cannot be empty');
    require(level >= 1 && level <= 3, 'Level must be 1-3');

    bytes32 verifierIdHash = memberRoleManager.getUserForWallet(msg.sender);
    require(verifierIdHash != bytes32(0), 'Wallet not registered');
    require(!currentlyVerified[recordHash][verifierIdHash], 'Already verified this hash');

    uint256 newIndex = verifications[recordHash].length;

    verifications[recordHash].push(
      Verification({
        verifierIdHash: verifierIdHash,
        recordId: recordId,
        level: VerificationLevel(level),
        createdAt: block.timestamp,
        isActive: true
      })
    );

    currentlyVerified[recordHash][verifierIdHash] = true;
    verificationIndex[recordHash][verifierIdHash] = newIndex;
    verificationsByUser[verifierIdHash].push(recordHash);
    totalVerifications++;

    emit RecordVerified(
      recordHash,
      recordId,
      verifierIdHash,
      VerificationLevel(level),
      block.timestamp
    );
  }

  /**
   * @notice Retract your verification
   * @param recordHash The hash you verified
   */
  function retractVerification(string memory recordHash) external {
    bytes32 verifierIdHash = memberRoleManager.getUserForWallet(msg.sender);
    require(verifierIdHash != bytes32(0), 'Wallet not registered');
    require(currentlyVerified[recordHash][verifierIdHash], 'No verification to retract');

    uint256 idx = verificationIndex[recordHash][verifierIdHash];
    require(verifications[recordHash][idx].isActive, 'Already retracted');

    // 1. Kill the active flag in the historical array
    verifications[recordHash][idx].isActive = false;
    // 2. Reset mapping to reflect current verification state
    currentlyVerified[recordHash][verifierIdHash] = false;

    emit VerificationRetracted(recordHash, verifierIdHash, block.timestamp);
  }

  /**
   * @notice Modify your verification level
   * @param recordHash The hash you verified
   * @param newLevel New level (1-3)
   */
  function modifyVerificationLevel(string memory recordHash, uint8 newLevel) external {
    require(newLevel >= 1 && newLevel <= 3, 'Level must be 1-3');

    bytes32 verifierIdHash = memberRoleManager.getUserForWallet(msg.sender);
    require(verifierIdHash != bytes32(0), 'Wallet not registered');
    require(currentlyVerified[recordHash][verifierIdHash], 'No verification to modify');

    uint256 idx = verificationIndex[recordHash][verifierIdHash];
    Verification storage verification = verifications[recordHash][idx];
    require(verification.isActive, 'Verification has been retracted');

    VerificationLevel oldLevel = verification.level;
    require(oldLevel != VerificationLevel(newLevel), 'Already this level');

    verification.level = VerificationLevel(newLevel);

    emit VerificationLevelModified(
      recordHash,
      verifierIdHash,
      oldLevel,
      VerificationLevel(newLevel),
      block.timestamp
    );
  }

  // ------------------- DISPUTES -------------------

  /**
   * @notice Dispute a record hash (flag it as inaccurate)
   * @param recordId The record this hash is claimed to be for
   * @param recordHash The hash being disputed
   * @param severity 1=Negligible, 2=Moderate, 3=Major
   * @param culpability 1=NoFault, 2=Systemic, 3=Preventable, 4=Reckless, 5=Intentional
   * @param notes Off-chain reference for detailed reasoning (IPFS hash, etc.)
   */
  function disputeRecord(
    string memory recordId,
    string memory recordHash,
    uint8 severity,
    uint8 culpability,
    string memory notes
  ) external onlyActiveMember onlyRecordParticipant(recordId) {
    require(bytes(recordId).length > 0, 'Record ID cannot be empty');
    require(bytes(recordHash).length > 0, 'Record hash cannot be empty');
    require(severity >= 1 && severity <= 3, 'Severity must be 1-3');
    require(culpability >= 1 && culpability <= 5, 'Culpability must be 1-5');

    bytes32 disputerIdHash = memberRoleManager.getUserForWallet(msg.sender);
    require(disputerIdHash != bytes32(0), 'Wallet not registered');
    require(!currentlyDisputed[recordHash][disputerIdHash], 'Already disputed this hash');

    uint256 newIndex = disputes[recordHash].length;

    disputes[recordHash].push(
      Dispute({
        disputerIdHash: disputerIdHash,
        recordId: recordId,
        severity: DisputeSeverity(severity),
        culpability: DisputeCulpability(culpability),
        notes: notes,
        createdAt: block.timestamp,
        isActive: true
      })
    );

    currentlyDisputed[recordHash][disputerIdHash] = true;
    disputeIndex[recordHash][disputerIdHash] = newIndex;
    disputesByUser[disputerIdHash].push(recordHash);
    totalDisputes++;

    emit RecordDisputed(
      recordHash,
      recordId,
      disputerIdHash,
      DisputeSeverity(severity),
      DisputeCulpability(culpability),
      block.timestamp
    );
  }

  /**
   * @notice Retract your dispute
   * @param recordHash The hash you disputed
   */
  function retractDispute(string memory recordHash) external {
    bytes32 disputerIdHash = memberRoleManager.getUserForWallet(msg.sender);
    require(disputerIdHash != bytes32(0), 'Wallet not registered');
    require(currentlyDisputed[recordHash][disputerIdHash], 'No dispute to retract');

    uint256 idx = disputeIndex[recordHash][disputerIdHash];
    require(disputes[recordHash][idx].isActive, 'Already retracted');

    disputes[recordHash][idx].isActive = false;
    currentlyDisputed[recordHash][disputerIdHash] = false;

    emit DisputeRetracted(recordHash, disputerIdHash, block.timestamp);
  }

  /**
   * @notice Modify your dispute's severity and culpability
   * @param recordHash The hash you disputed
   * @param newSeverity New severity (1-3)
   * @param newCulpability New culpability (1-5)
   */
  function modifyDispute(
    string memory recordHash,
    uint8 newSeverity,
    uint8 newCulpability
  ) external {
    require(newSeverity >= 1 && newSeverity <= 3, 'Severity must be 1-3');
    require(newCulpability >= 1 && newCulpability <= 5, 'Culpability must be 1-5');

    bytes32 disputerIdHash = memberRoleManager.getUserForWallet(msg.sender);
    require(disputerIdHash != bytes32(0), 'Wallet not registered');
    require(currentlyDisputed[recordHash][disputerIdHash], 'No dispute to modify');

    uint256 idx = disputeIndex[recordHash][disputerIdHash];
    Dispute storage dispute = disputes[recordHash][idx];
    require(dispute.isActive, 'Dispute has been retracted');

    DisputeSeverity oldSeverity = dispute.severity;
    DisputeCulpability oldCulpability = dispute.culpability;

    dispute.severity = DisputeSeverity(newSeverity);
    dispute.culpability = DisputeCulpability(newCulpability);

    emit DisputeModification(
      recordHash,
      disputerIdHash,
      oldSeverity,
      dispute.severity,
      oldCulpability,
      dispute.culpability,
      block.timestamp
    );
  }

  // ------------------- REACTIONS -------------------

  /**
   * @notice React to a dispute (support or oppose)
   * @param recordHash The hash with the dispute
   * @param disputerIdHash The user whose dispute you're reacting to
   * @param supportsDispute True = agree, False = disagree
   */
  function reactToDispute(
    string memory recordHash,
    bytes32 disputerIdHash,
    bool supportsDispute
  ) external onlyActiveMember {
    require(currentlyDisputed[recordHash][disputerIdHash], 'No dispute from this user');

    uint256 idx = disputeIndex[recordHash][disputerIdHash];
    string memory recordId = disputes[recordHash][idx].recordId;
    require(memberRoleManager.hasActiveRole(recordId, msg.sender), 'No access to this record');

    bytes32 reactorIdHash = memberRoleManager.getUserForWallet(msg.sender);
    require(reactorIdHash != bytes32(0), 'Wallet not registered');
    require(reactorIdHash != disputerIdHash, 'Cannot react to your own dispute');
    require(!currentlyReacted[recordHash][disputerIdHash][reactorIdHash], 'Already reacted');
    require(disputes[recordHash][idx].isActive, 'Dispute has been retracted');

    uint256 newReactionIndex = disputeReactions[recordHash][disputerIdHash].length;

    disputeReactions[recordHash][disputerIdHash].push(
      Reaction({
        reactorIdHash: reactorIdHash,
        supportsDispute: supportsDispute,
        timestamp: block.timestamp,
        isActive: true
      })
    );

    currentlyReacted[recordHash][disputerIdHash][reactorIdHash] = true;
    reactionIndex[recordHash][disputerIdHash][reactorIdHash] = newReactionIndex;

    emit DisputeReaction(
      recordHash,
      reactorIdHash,
      disputerIdHash,
      supportsDispute,
      block.timestamp
    );
  }

  /**
   * @notice Retract your reaction to a dispute
   * @param recordHash The hash with the dispute
   * @param disputerIdHash The user whose dispute you reacted to
   */
  function retractReaction(string memory recordHash, bytes32 disputerIdHash) external {
    bytes32 reactorIdHash = memberRoleManager.getUserForWallet(msg.sender);
    require(reactorIdHash != bytes32(0), 'Wallet not registered');
    require(currentlyReacted[recordHash][disputerIdHash][reactorIdHash], 'No reaction to retract');

    uint256 idx = reactionIndex[recordHash][disputerIdHash][reactorIdHash];
    require(disputeReactions[recordHash][disputerIdHash][idx].isActive, 'Already retracted');

    disputeReactions[recordHash][disputerIdHash][idx].isActive = false;
    currentlyReacted[recordHash][disputerIdHash][reactorIdHash] = false;

    emit ReactionRetracted(recordHash, reactorIdHash, disputerIdHash, block.timestamp);
  }

  /**
   * @notice Modify your reaction to a dispute
   * @param recordHash The hash with the dispute
   * @param disputerIdHash The user whose dispute you reacted to
   * @param newSupport New support value (true = support, false = oppose)
   */
  function modifyReaction(
    string memory recordHash,
    bytes32 disputerIdHash,
    bool newSupport
  ) external {
    bytes32 reactorIdHash = memberRoleManager.getUserForWallet(msg.sender);
    require(reactorIdHash != bytes32(0), 'Wallet not registered');
    require(currentlyReacted[recordHash][disputerIdHash][reactorIdHash], 'No reaction to modify');

    uint256 idx = reactionIndex[recordHash][disputerIdHash][reactorIdHash];
    Reaction storage reaction = disputeReactions[recordHash][disputerIdHash][idx];
    require(reaction.isActive, 'Reaction has been retracted');

    bool oldSupport = reaction.supportsDispute;
    require(oldSupport != newSupport, 'Already this value');

    reaction.supportsDispute = newSupport;
    reaction.timestamp = block.timestamp; // Update timestamp on modification

    emit ReactionModified(
      recordHash,
      reactorIdHash,
      disputerIdHash,
      oldSupport,
      newSupport,
      block.timestamp
    );
  }

  // ------------------- UNACCEPTED UPDATE FLAGS -------------------

  /**
   * @notice Flag that an unaccepted update exists for a record or user
   * @dev Only admin can call this to protect privacy
   * @param subjectIdHash The subject this flag is about
   * @param recordId The record ID, optional if there's no recordID associated to patient yet
   * @param noteHash Hash of encrypted details stored off-chain
   */
  function flagUnacceptedUpdate(
    bytes32 subjectIdHash,
    string memory recordId,
    string memory noteHash
  ) external onlyAdmin {
    require(subjectIdHash != bytes32(0), 'Subject ID hash cannot be empty');
    require(bytes(noteHash).length > 0, 'Note hash cannot be empty');

    uint256 flagIndex = unacceptedUpdateFlags[subjectIdHash].length;

    unacceptedUpdateFlags[subjectIdHash].push(
      UnacceptedUpdateFlag({
        recordId: recordId,
        noteHash: noteHash,
        createdAt: block.timestamp,
        resolution: ResolutionType.None,
        resolvedAt: 0,
        isActive: true
      })
    );

    activeUnacceptedFlagCount[subjectIdHash]++;
    totalUnacceptedFlags++;

    emit UnacceptedUpdateFlagged(subjectIdHash, recordId, noteHash, flagIndex, block.timestamp);
  }

  /**
   * @notice Resolve an unaccepted update flag
   * @dev Only admin can call this
   * @param subjectIdHash the subject this flag is about
   * @param flagIndex The index of the flag to resolve
   * @param resolution The resolution type
   */
  function resolveUnacceptedUpdate(
    bytes32 subjectIdHash,
    uint256 flagIndex,
    ResolutionType resolution
  ) external onlyAdmin {
    require(flagIndex < unacceptedUpdateFlags[subjectIdHash].length, 'Flag does not exist');
    require(resolution != ResolutionType.None, 'Must provide resolution type');

    UnacceptedUpdateFlag storage flag = unacceptedUpdateFlags[subjectIdHash][flagIndex];
    require(flag.isActive, 'Flag already resolved');

    flag.resolution = resolution;
    flag.resolvedAt = block.timestamp;
    flag.isActive = false;

    activeUnacceptedFlagCount[subjectIdHash]--;

    emit UnacceptedUpdateResolved(subjectIdHash, flagIndex, resolution, block.timestamp);
  }

  // =================== RECORD REVIEWS - VIEW FUNCTIONS ===================

  // ------------------- VERIFICATION VIEWS -------------------

  /**
   * @notice Get all verifications for a record hash
   */
  function getVerifications(
    string memory recordHash
  ) external view returns (Verification[] memory) {
    return verifications[recordHash];
  }

  /**
   * @notice Check if a user has verified a record hash
   */
  function hasUserVerified(
    string memory recordHash,
    bytes32 userIdHash
  ) external view returns (bool) {
    return currentlyVerified[recordHash][userIdHash];
  }

  /**
   * @notice Get a specific user's verification for a hash
   */
  function getUserVerification(
    string memory recordHash,
    bytes32 userIdHash
  )
    external
    view
    returns (
      bool exists,
      string memory recordId,
      VerificationLevel level,
      uint256 createdAt,
      bool isActive
    )
  {
    if (!currentlyVerified[recordHash][userIdHash]) {
      return (false, '', VerificationLevel.None, 0, false);
    }

    uint256 idx = verificationIndex[recordHash][userIdHash];
    Verification memory v = verifications[recordHash][idx];

    return (true, v.recordId, v.level, v.createdAt, v.isActive);
  }

  /**
   * @notice Get verification stats for a record hash
   */
  function getVerificationStats(
    string memory recordHash
  ) external view returns (uint256 total, uint256 active) {
    Verification[] memory vers = verifications[recordHash];
    total = vers.length;

    for (uint256 i = 0; i < vers.length; i++) {
      if (vers[i].isActive) {
        active++;
      }
    }

    return (total, active);
  }

  /**
   * @notice Get verification stats by level for a record hash
   */
  function getVerificationStatsByLevel(
    string memory recordHash
  )
    external
    view
    returns (
      uint256 total,
      uint256 active,
      uint256 provenanceCount,
      uint256 contentCount,
      uint256 fullCount
    )
  {
    Verification[] memory vers = verifications[recordHash];
    total = vers.length;

    for (uint256 i = 0; i < vers.length; i++) {
      if (vers[i].isActive) {
        active++;

        if (vers[i].level == VerificationLevel.Provenance) {
          provenanceCount++;
        } else if (vers[i].level == VerificationLevel.Content) {
          contentCount++;
        } else if (vers[i].level == VerificationLevel.Full) {
          fullCount++;
        }
      }
    }

    return (total, active, provenanceCount, contentCount, fullCount);
  }

  /**
   * @notice Get all hashes a user has verified
   */
  function getUserVerifications(bytes32 userIdHash) external view returns (string[] memory) {
    return verificationsByUser[userIdHash];
  }

  // ------------------- DISPUTE VIEWS -------------------

  /**
   * @notice Get all disputes for a record hash
   */
  function getDisputes(string memory recordHash) external view returns (Dispute[] memory) {
    return disputes[recordHash];
  }

  /**
   * @notice Check if a user has disputed a record hash
   */
  function hasUserDisputed(
    string memory recordHash,
    bytes32 userIdHash
  ) external view returns (bool) {
    return currentlyDisputed[recordHash][userIdHash];
  }

  /**
   * @notice Get a specific user's dispute for a hash
   */
  function getUserDispute(
    string memory recordHash,
    bytes32 userIdHash
  )
    external
    view
    returns (
      bool exists,
      string memory recordId,
      DisputeSeverity severity,
      DisputeCulpability culpability,
      string memory notes,
      uint256 createdAt,
      bool isActive
    )
  {
    if (!currentlyDisputed[recordHash][userIdHash]) {
      return (false, '', DisputeSeverity.None, DisputeCulpability.None, '', 0, false);
    }

    uint256 idx = disputeIndex[recordHash][userIdHash];
    Dispute memory d = disputes[recordHash][idx];

    return (true, d.recordId, d.severity, d.culpability, d.notes, d.createdAt, d.isActive);
  }

  /**
   * @notice Get dispute stats for a record hash
   */
  function getDisputeStats(
    string memory recordHash
  ) external view returns (uint256 total, uint256 active) {
    Dispute[] memory disps = disputes[recordHash];
    total = disps.length;

    for (uint256 i = 0; i < disps.length; i++) {
      if (disps[i].isActive) {
        active++;
      }
    }

    return (total, active);
  }

  /**
   * @notice Get dispute stats by severity for a record hash
   */
  function getDisputeStatsBySeverity(
    string memory recordHash
  )
    external
    view
    returns (
      uint256 total,
      uint256 active,
      uint256 negligibleCount,
      uint256 moderateCount,
      uint256 majorCount
    )
  {
    Dispute[] memory disps = disputes[recordHash];
    total = disps.length;

    for (uint256 i = 0; i < disps.length; i++) {
      if (disps[i].isActive) {
        active++;

        if (disps[i].severity == DisputeSeverity.Negligible) {
          negligibleCount++;
        } else if (disps[i].severity == DisputeSeverity.Moderate) {
          moderateCount++;
        } else if (disps[i].severity == DisputeSeverity.Major) {
          majorCount++;
        }
      }
    }

    return (total, active, negligibleCount, moderateCount, majorCount);
  }

  /**
   * @notice Get all hashes a user has disputed
   */
  function getUserDisputes(bytes32 userIdHash) external view returns (string[] memory) {
    return disputesByUser[userIdHash];
  }

  // ------------------- REACTION VIEWS -------------------

  /**
   * @notice Get all reactions to a specific dispute
   */
  function getDisputeReactions(
    string memory recordHash,
    bytes32 disputerIdHash
  ) external view returns (Reaction[] memory) {
    return disputeReactions[recordHash][disputerIdHash];
  }

  /**
   * @notice Check if a user has reacted to a specific dispute
   */
  function hasUserReacted(
    string memory recordHash,
    bytes32 disputerIdHash,
    bytes32 reactorIdHash
  ) external view returns (bool) {
    return currentlyReacted[recordHash][disputerIdHash][reactorIdHash];
  }

  /**
   * @notice Get a specific user's reaction to a dispute
   */
  function getUserReaction(
    string memory recordHash,
    bytes32 disputerIdHash,
    bytes32 reactorIdHash
  ) external view returns (bool exists, bool supportsDispute, uint256 timestamp, bool isActive) {
    if (!currentlyReacted[recordHash][disputerIdHash][reactorIdHash]) {
      return (false, false, 0, false);
    }

    uint256 idx = reactionIndex[recordHash][disputerIdHash][reactorIdHash];
    Reaction memory r = disputeReactions[recordHash][disputerIdHash][idx];

    return (true, r.supportsDispute, r.timestamp, r.isActive);
  }

  /**
   * @notice Get reaction stats for a dispute (supports vs opposes)
   */
  function getReactionStats(
    string memory recordHash,
    bytes32 disputerIdHash
  ) external view returns (uint256 totalReactions, uint256 activeSupports, uint256 activeOpposes) {
    Reaction[] memory reactions = disputeReactions[recordHash][disputerIdHash];
    totalReactions = reactions.length;

    for (uint256 i = 0; i < reactions.length; i++) {
      if (reactions[i].isActive) {
        if (reactions[i].supportsDispute) {
          activeSupports++;
        } else {
          activeOpposes++;
        }
      }
    }

    return (totalReactions, activeSupports, activeOpposes);
  }

  // ------------------- UNACCEPTED UPDATE FLAGS VIEW -------------------

  /**
   * @notice Get all flags for a subject
   */
  function getUnacceptedUpdateFlags(
    bytes32 subjectIdHash
  ) external view returns (UnacceptedUpdateFlag[] memory) {
    return unacceptedUpdateFlags[subjectIdHash];
  }

  /**
   * @notice Get count of active (unresolved) flags for a subject
   */
  function getActiveUnacceptedFlagCount(bytes32 subjectIdHash) external view returns (uint256) {
    return activeUnacceptedFlagCount[subjectIdHash];
  }

  /**
   * @notice Get a specific flag
   */
  function getUnacceptedUpdateFlag(
    bytes32 subjectIdHash,
    uint256 flagIndex
  )
    external
    view
    returns (
      string memory recordId,
      string memory noteHash,
      uint256 createdAt,
      ResolutionType resolution,
      uint256 resolvedAt,
      bool isActive
    )
  {
    require(flagIndex < unacceptedUpdateFlags[subjectIdHash].length, 'Flag does not exist');

    UnacceptedUpdateFlag memory flag = unacceptedUpdateFlags[subjectIdHash][flagIndex];
    return (
      flag.recordId,
      flag.noteHash,
      flag.createdAt,
      flag.resolution,
      flag.resolvedAt,
      flag.isActive
    );
  }

  /**
   * @notice Check if a subject has any active flags
   */
  function hasActiveUnacceptedFlags(bytes32 subjectIdHash) external view returns (bool) {
    return activeUnacceptedFlagCount[subjectIdHash] > 0;
  }

  /**
   * @notice Get total flag stats
   */
  function getTotalUnacceptedFlagStats() external view returns (uint256) {
    return totalUnacceptedFlags;
  }

  // ------------------- COMBINED / SUMMARY VIEWS -------------------

  /**
   * @notice Get complete review summary for a record hash
   */
  function getRecordHashReviewSummary(
    string memory recordHash
  )
    external
    view
    returns (
      uint256 activeVerifications,
      uint256 activeDisputes,
      uint256 verificationCount,
      uint256 disputeCount
    )
  {
    Verification[] memory vers = verifications[recordHash];
    Dispute[] memory disps = disputes[recordHash];

    verificationCount = vers.length;
    disputeCount = disps.length;

    for (uint256 i = 0; i < vers.length; i++) {
      if (vers[i].isActive) {
        activeVerifications++;
      }
    }

    for (uint256 i = 0; i < disps.length; i++) {
      if (disps[i].isActive) {
        activeDisputes++;
      }
    }

    return (activeVerifications, activeDisputes, verificationCount, disputeCount);
  }

  /**
   * @notice Get a user's complete review history
   */
  function getUserReviewHistory(
    bytes32 userIdHash
  ) external view returns (uint256 userVerifications, uint256 userDisputes) {
    return (verificationsByUser[userIdHash].length, disputesByUser[userIdHash].length);
  }

  /**
   * @notice Get total review counts across all records
   */
  function getTotalReviewStats()
    external
    view
    returns (uint256 verificationCount, uint256 disputeCount)
  {
    return (totalVerifications, totalDisputes);
  }
}

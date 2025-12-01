// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import './MemberRoleManager.sol';

/**
 * @title HealthRecordCore
 * @dev Handles access permissions, record anchoring, and record reviews
 * References MemberRoleManager for membership and role checks
 */
contract HealthRecordCore {
  // ===============================================================
  // CONTRACT SETUP
  // ===============================================================

  MemberRoleManagerInterface public memberRoleManager;
  address public admin;

  event AdminTransferred(address indexed oldAdmin, address indexed newAdmin, uint256 timestamp);

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
  // ACCESS PERMISSIONS
  // ===============================================================

  // =================== ACCESS PERMISSIONS - EVENTS ===================

  event AccessGranted(
    string indexed permissionHash,
    address indexed sharer,
    address indexed receiver,
    string recordId,
    uint256 timestamp
  );

  event AccessRevoked(
    string indexed permissionHash,
    address indexed sharer,
    address indexed receiver,
    string recordId,
    uint256 timestamp
  );

  // =================== ACCESS PERMISSIONS - STRUCTURE ===================

  struct AccessPermission {
    string permissionHash;
    address sharer;
    address receiver;
    string recordId;
    uint256 grantedAt;
    uint256 revokedAt;
    bool isActive;
    bool exists;
  }

  // =================== ACCESS PERMISSIONS - STORAGE ===================

  mapping(string => AccessPermission) public accessPermissions;
  mapping(address => string[]) public permissionsBySharer;
  mapping(address => string[]) public permissionsByReceiver;
  uint256 public totalPermissions;

  // =================== ACCESS PERMISSIONS - FUNCTIONS ===================

  /**
   * @notice Grant access to a record
   * @param permissionHash Hash of the permission details (from frontend)
   * @param recordId The internal record ID
   * @param receiver Address of the person receiving access
   */
  function grantAccess(
    string memory permissionHash,
    string memory recordId,
    address receiver
  ) external onlyActiveMember onlyRecordParticipant(recordId) {
    require(bytes(permissionHash).length > 0, 'Permission hash cannot be empty');
    require(bytes(recordId).length > 0, 'Record ID cannot be empty');
    require(receiver != address(0), 'Receiver address cannot be zero');
    require(receiver != msg.sender, 'Cannot share with yourself');
    require(!accessPermissions[permissionHash].exists, 'Permission already exists');

    accessPermissions[permissionHash] = AccessPermission({
      permissionHash: permissionHash,
      sharer: msg.sender,
      receiver: receiver,
      recordId: recordId,
      grantedAt: block.timestamp,
      revokedAt: 0,
      isActive: true,
      exists: true
    });

    permissionsBySharer[msg.sender].push(permissionHash);
    permissionsByReceiver[receiver].push(permissionHash);
    totalPermissions++;

    emit AccessGranted(permissionHash, msg.sender, receiver, recordId, block.timestamp);
  }

  /**
   * @notice Revoke access to a record
   * @param permissionHash The permission hash to revoke
   */
  function revokeAccess(string memory permissionHash) external {
    require(accessPermissions[permissionHash].exists, 'Permission does not exist');
    require(accessPermissions[permissionHash].isActive, 'Already revoked');
    require(accessPermissions[permissionHash].sharer == msg.sender, 'Only the sharer can revoke');

    accessPermissions[permissionHash].isActive = false;
    accessPermissions[permissionHash].revokedAt = block.timestamp;

    emit AccessRevoked(
      permissionHash,
      msg.sender,
      accessPermissions[permissionHash].receiver,
      accessPermissions[permissionHash].recordId,
      block.timestamp
    );
  }

  /**
   * @notice Check if access is currently active
   */
  function checkAccess(
    string memory permissionHash
  )
    external
    view
    returns (
      bool isActive,
      address sharer,
      address receiver,
      string memory recordId,
      uint256 grantedAt,
      uint256 revokedAt
    )
  {
    AccessPermission memory permission = accessPermissions[permissionHash];
    return (
      permission.isActive,
      permission.sharer,
      permission.receiver,
      permission.recordId,
      permission.grantedAt,
      permission.revokedAt
    );
  }

  /**
   * @notice Get all permissions granted by a sharer
   */
  function getPermissionsBySharer(address sharer) external view returns (string[] memory) {
    return permissionsBySharer[sharer];
  }

  /**
   * @notice Get all permissions for a receiver
   */
  function getPermissionsByReceiver(address receiver) external view returns (string[] memory) {
    return permissionsByReceiver[receiver];
  }

  /**
   * @notice Get total number of permissions
   */
  function getTotalPermissions() external view returns (uint256) {
    return totalPermissions;
  }

  /**
   * @notice Get permission statistics for a sharer
   */
  function getSharerStats(address sharer) external view returns (uint256 total, uint256 active) {
    string[] memory sharerPermissions = permissionsBySharer[sharer];
    total = sharerPermissions.length;
    active = 0;

    for (uint256 i = 0; i < sharerPermissions.length; i++) {
      if (accessPermissions[sharerPermissions[i]].isActive) {
        active++;
      }
    }

    return (total, active);
  }

  // ===============================================================
  // RECORD ANCHORING
  // ===============================================================

  // =================== RECORD ANCHORING - EVENTS ===================

  event RecordAnchored(
    string indexed recordId,
    string indexed recordHash,
    address indexed subject,
    address createdBy,
    uint256 timestamp
  );

  // =================== RECORD ANCHORING - STRUCTURE ===================

  struct AnchoredRecord {
    string recordHash;
    string recordId;
    address subject; // Who this record is ABOUT (the patient)
    uint256 createdAt;
    address createdBy;
    bool exists;
  }

  // =================== RECORD ANCHORING - STORAGE ===================

  mapping(string => AnchoredRecord) public anchoredRecords;
  mapping(address => string[]) public recordsAboutSubject;
  mapping(string => string[]) public recordHashesByRecordId;
  uint256 public totalAnchoredRecords;

  // =================== RECORD ANCHORING - FUNCTIONS ===================

  /**
   * @notice Anchor a record hash with its metadata
   * @param recordHash SHA-256 hash of the record contents
   * @param recordId Your internal record ID
   * @param subject The patient/person this record is about
   */
  function anchorRecord(
    string memory recordHash,
    string memory recordId,
    address subject
  ) external onlyVerifiedMember onlyRecordParticipant(recordId) {
    require(bytes(recordHash).length > 0, 'Hash cannot be empty');
    require(bytes(recordId).length > 0, 'Record ID cannot be empty');
    require(subject != address(0), 'Subject cannot be zero address');
    require(!anchoredRecords[recordHash].exists, 'Hash already anchored');

    anchoredRecords[recordHash] = AnchoredRecord({
      recordHash: recordHash,
      recordId: recordId,
      subject: subject,
      createdAt: block.timestamp,
      createdBy: msg.sender,
      exists: true
    });

    recordsAboutSubject[subject].push(recordHash);
    recordHashesByRecordId[recordId].push(recordHash);
    totalAnchoredRecords++;

    emit RecordAnchored(recordHash, recordId, subject, msg.sender, block.timestamp);
  }

  /**
   * @notice Get record metadata
   */
  function getAnchoredRecord(
    string memory recordHash
  )
    external
    view
    returns (
      string memory recordId,
      address subject,
      uint256 createdAt,
      address createdBy,
      bool exists
    )
  {
    AnchoredRecord memory record = anchoredRecords[recordHash];
    return (record.recordId, record.subject, record.createdAt, record.createdBy, record.exists);
  }

  /**
   * @notice Get the subject (patient) of a record
   */
  function getRecordSubject(string memory recordHash) external view returns (address) {
    require(anchoredRecords[recordHash].exists, 'Record does not exist');
    return anchoredRecords[recordHash].subject;
  }

  /**
   * @notice Get all records where an address is the subject
   */
  function getRecordsAboutSubject(address subject) external view returns (string[] memory) {
    return recordsAboutSubject[subject];
  }

  /**
   * @notice Get all versions of a record
   */
  function getHashesByRecordId(string memory recordId) external view returns (string[] memory) {
    return recordHashesByRecordId[recordId];
  }

  /**
   * @notice Check if an address is the subject of a record
   */
  function isSubject(string memory recordHash, address user) external view returns (bool) {
    return anchoredRecords[recordHash].subject == user;
  }

  // ===============================================================
  // RECORD REVIEWS
  // ===============================================================

  // =================== RECORD REVIEWS - EVENTS ===================

  event RecordReviewed(
    string indexed recordId,
    string indexed recordHash,
    address indexed reviewer,
    ReviewType reviewType,
    DisputeSeverity severity,
    DisputeCulpability culpability,
    uint256 timestamp
  );

  event ReviewRetracted(
    string indexed recordHash,
    address indexed reviewer,
    ReviewType reviewType,
    uint256 timestamp
  );

  event DisputeReaction(
    string indexed recordHash,
    address indexed reactor,
    address indexed reviewer,
    bool supportsDispute,
    uint256 timestamp
  );

  event DisputeModification(
    string indexed recordHash,
    address indexed reviewer,
    DisputeSeverity oldSeverity,
    DisputeSeverity newSeverity,
    DisputeCulpability oldCulpability,
    DisputeCulpability newCulpability,
    uint256 timestamp
  );

  // =================== RECORD REVIEWS - ENUMS ===================

  enum ReviewType {
    Verification,
    Dispute
  }

  enum DisputeSeverity {
    None,
    Negligible,
    Moderate,
    Major
  }

  enum DisputeCulpability {
    None,
    NoFault,
    Systemic,
    Preventable,
    Reckless,
    Intentional
  }

  // =================== RECORD REVIEWS - STRUCTURES ===================

  struct Review {
    address reviewer;
    ReviewType reviewType;
    DisputeSeverity severity;
    DisputeCulpability culpability;
    uint256 timestamp;
    string notes;
    bool isActive;
  }

  struct Reaction {
    address reactor;
    bool supportsDispute;
    uint256 timestamp;
  }

  // =================== RECORD REVIEWS - STORAGE ===================

  mapping(string => Review[]) public recordReviews;
  mapping(string => mapping(address => bool)) public hasReviewed;
  mapping(string => mapping(address => uint256)) public userReviewIndex;
  mapping(string => mapping(address => Reaction[])) public disputeReactions;
  mapping(string => mapping(address => mapping(address => bool))) public hasReactedToDispute;
  mapping(address => string[]) public verificationsByUser;
  mapping(address => string[]) public disputesByUser;
  uint256 public totalReviews;

  // =================== RECORD REVIEWS - INTERNAL FUNCTIONS ===================

  /**
   * @dev Internal function to handle both verifications and disputes
   */
  function _reviewRecord(
    string memory recordHash,
    string memory notes,
    ReviewType reviewType,
    DisputeSeverity severity,
    DisputeCulpability culpability
  ) internal {
    require(anchoredRecords[recordHash].exists, 'Record not anchored');
    string memory recordId = anchoredRecords[recordHash].recordId;

    // Must have a role on this record
    require(memberRoleManager.hasActiveRole(recordId, msg.sender), 'No access to this record');

    // One review per user per hash
    require(!hasReviewed[recordHash][msg.sender], 'Already reviewed this record');

    uint256 newIndex = recordReviews[recordHash].length;

    recordReviews[recordHash].push(
      Review({
        reviewer: msg.sender,
        reviewType: reviewType,
        severity: severity,
        culpability: culpability,
        timestamp: block.timestamp,
        notes: notes,
        isActive: true
      })
    );

    hasReviewed[recordHash][msg.sender] = true;
    userReviewIndex[recordHash][msg.sender] = newIndex;
    totalReviews++;

    emit RecordReviewed(
      recordHash,
      recordId,
      msg.sender,
      reviewType,
      severity,
      culpability,
      block.timestamp
    );
  }

  // =================== RECORD REVIEWS - EXTERNAL FUNCTIONS ===================

  /**
   * @notice Verify a record (attest that it's accurate)
   * @param recordHash The hash being verified
   * @param notes Optional hash of detailed notes (stored off-chain)
   */
  function verifyRecord(string memory recordHash, string memory notes) external onlyVerifiedMember {
    _reviewRecord(
      recordHash,
      notes,
      ReviewType.Verification,
      DisputeSeverity.None,
      DisputeCulpability.None
    );
    verificationsByUser[msg.sender].push(recordHash);
  }

  /**
   * @notice Dispute a record (claim it's inaccurate/tampered)
   * @param recordHash The hash being disputed
   * @param severity 1=Negligible, 2=Moderate, 3=Major
   * @param culpability 1=NoFault, 2=Systemic, 3=Preventable, 4=Reckless, 5=Intentional
   * @param notes Optional hash of detailed reasoning (stored off-chain)
   */
  function disputeRecord(
    string memory recordHash,
    uint8 severity,
    uint8 culpability,
    string memory notes
  ) external onlyVerifiedMember {
    require(severity >= 1 && severity <= 3, 'Severity must be 1-3');
    require(culpability >= 1 && culpability <= 5, 'Culpability must be 1-5');

    _reviewRecord(
      recordHash,
      notes,
      ReviewType.Dispute,
      DisputeSeverity(severity),
      DisputeCulpability(culpability)
    );
    disputesByUser[msg.sender].push(recordHash);
  }

  /**
   * @notice Retract your review (verification or dispute)
   * @param recordHash The hash you reviewed
   */
  function retractReview(string memory recordHash) external {
    require(hasReviewed[recordHash][msg.sender], 'No review to retract');

    uint256 index = userReviewIndex[recordHash][msg.sender];
    Review storage review = recordReviews[recordHash][index];

    require(review.isActive, 'Already retracted');

    review.isActive = false;
    hasReviewed[recordHash][msg.sender] = false;

    emit ReviewRetracted(recordHash, msg.sender, review.reviewType, block.timestamp);
  }

  /**
   * @notice Modify severity and culpability on an active dispute
   * @param recordHash The hash of the record with the dispute
   * @param newSeverity The new severity score (1-3)
   * @param newCulpability The new culpability score (1-5)
   */
  function modifyDispute(
    string memory recordHash,
    uint8 newSeverity,
    uint8 newCulpability
  ) external {
    require(anchoredRecords[recordHash].exists, 'Record not anchored');
    require(hasReviewed[recordHash][msg.sender], 'User has no review on this record');
    require(newSeverity >= 1 && newSeverity <= 3, 'Severity must be 1-3');
    require(newCulpability >= 1 && newCulpability <= 5, 'Culpability must be 1-5');

    uint256 index = userReviewIndex[recordHash][msg.sender];
    Review storage review = recordReviews[recordHash][index];

    require(review.isActive, 'Dispute has been retracted');
    require(review.reviewType == ReviewType.Dispute, 'Review is not a dispute');

    DisputeSeverity oldSeverity = review.severity;
    DisputeCulpability oldCulpability = review.culpability;

    review.severity = DisputeSeverity(newSeverity);
    review.culpability = DisputeCulpability(newCulpability);

    emit DisputeModification(
      recordHash,
      msg.sender,
      oldSeverity,
      review.severity,
      oldCulpability,
      review.culpability,
      block.timestamp
    );
  }

  /**
   * @notice React to a dispute (thumbs up or thumbs down)
   * @param recordHash The record hash with the dispute
   * @param disputer The address who created the dispute
   * @param supportsDispute True = agree with dispute, False = disagree
   */
  function reactToDispute(
    string memory recordHash,
    address disputer,
    bool supportsDispute
  ) external onlyActiveMember {
    require(anchoredRecords[recordHash].exists, 'Record not anchored');
    require(hasReviewed[recordHash][disputer], 'No dispute from this address');

    uint256 disputeIndex = userReviewIndex[recordHash][disputer];
    Review memory review = recordReviews[recordHash][disputeIndex];
    require(review.reviewType == ReviewType.Dispute, 'Not a dispute');
    require(review.isActive, 'Dispute has been retracted');

    string memory recordId = anchoredRecords[recordHash].recordId;
    require(memberRoleManager.hasActiveRole(recordId, msg.sender), 'No access to this record');

    require(msg.sender != disputer, 'Cannot react to your own dispute');
    require(
      !hasReactedToDispute[recordHash][disputer][msg.sender],
      'Already reacted to this dispute'
    );

    disputeReactions[recordHash][disputer].push(
      Reaction({
        reactor: msg.sender,
        supportsDispute: supportsDispute,
        timestamp: block.timestamp
      })
    );

    hasReactedToDispute[recordHash][disputer][msg.sender] = true;

    emit DisputeReaction(recordHash, msg.sender, disputer, supportsDispute, block.timestamp);
  }

  // =================== RECORD REVIEWS - VIEW FUNCTIONS ===================

  /**
   * @notice Get all reviews for a record hash
   */
  function getReviews(string memory recordHash) external view returns (Review[] memory) {
    return recordReviews[recordHash];
  }

  /**
   * @notice Get review counts for a record hash
   */
  function getReviewStats(
    string memory recordHash
  )
    external
    view
    returns (uint256 activeVerifications, uint256 activeDisputes, uint256 retractedCount)
  {
    Review[] memory reviews = recordReviews[recordHash];

    for (uint256 i = 0; i < reviews.length; i++) {
      if (reviews[i].isActive) {
        if (reviews[i].reviewType == ReviewType.Verification) {
          activeVerifications++;
        } else {
          activeDisputes++;
        }
      } else {
        retractedCount++;
      }
    }

    return (activeVerifications, activeDisputes, retractedCount);
  }

  /**
   * @notice Get a user's review on a record hash
   */
  function getUserReview(
    string memory recordHash,
    address user
  )
    external
    view
    returns (
      bool exists,
      ReviewType reviewType,
      uint256 timestamp,
      string memory notes,
      bool isActive
    )
  {
    if (!hasReviewed[recordHash][user]) {
      return (false, ReviewType.Verification, 0, '', false);
    }

    uint256 index = userReviewIndex[recordHash][user];
    Review memory review = recordReviews[recordHash][index];

    return (true, review.reviewType, review.timestamp, review.notes, review.isActive);
  }

  /**
   * @notice Get reactions to a specific dispute
   */
  function getDisputeReactions(
    string memory recordHash,
    address disputer
  ) external view returns (Reaction[] memory) {
    return disputeReactions[recordHash][disputer];
  }

  /**
   * @notice Get reaction counts for a dispute
   */
  function getDisputeReactionStats(
    string memory recordHash,
    address disputer
  ) external view returns (uint256 supportsCount, uint256 opposesCount) {
    Reaction[] memory reactions = disputeReactions[recordHash][disputer];

    for (uint256 i = 0; i < reactions.length; i++) {
      if (reactions[i].supportsDispute) {
        supportsCount++;
      } else {
        opposesCount++;
      }
    }

    return (supportsCount, opposesCount);
  }

  /**
   * @notice Get user's review history
   */
  function getUserReviewHistory(
    address user
  ) external view returns (uint256 totalVerifications, uint256 totalDisputes) {
    return (verificationsByUser[user].length, disputesByUser[user].length);
  }

  /**
   * @notice Get all record hashes a user has verified
   */
  function getUserVerifications(address user) external view returns (string[] memory) {
    return verificationsByUser[user];
  }

  /**
   * @notice Get all record hashes a user has disputed
   */
  function getUserDisputes(address user) external view returns (string[] memory) {
    return disputesByUser[user];
  }

  /**
   * @notice Get total counts
   */
  function getTotalStats()
    external
    view
    returns (uint256 totalAnchored, uint256 totalReviewCount, uint256 totalPermissionCount)
  {
    return (totalAnchoredRecords, totalReviews, totalPermissions);
  }
}

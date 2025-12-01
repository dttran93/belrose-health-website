// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title MemberRoleManagerInterface
 * @dev Interface for HealthRecordCore to reference
 */
interface MemberRoleManagerInterface {
  function isActiveMember(address user) external view returns (bool);

  function isVerifiedMember(address user) external view returns (bool);

  function hasActiveRole(string memory recordId, address user) external view returns (bool);

  function hasRole(
    string memory recordId,
    address user,
    string memory role
  ) external view returns (bool);

  function isOwnerOrAdmin(string memory recordId, address user) external view returns (bool);
}

/**
 * @title MemberRoleManager
 * @dev Manages member registration and role-based access control for the Belrose Health system
 */
contract MemberRoleManager is MemberRoleManagerInterface {
  // ===============================================================
  // ADMIN MANAGEMENT
  // ===============================================================

  address public admin;

  event AdminTransferred(address indexed oldAdmin, address indexed newAdmin, uint256 timestamp);

  modifier onlyAdmin() {
    require(msg.sender == admin, 'Only admin');
    _;
  }

  modifier onlyActiveMember() {
    require(
      members[msg.sender].status != MemberStatus.Inactive && members[msg.sender].joinedAt != 0,
      'Not an active member'
    );
    _;
  }

  modifier onlyVerifiedMember() {
    require(members[msg.sender].status == MemberStatus.Verified, 'Not a verified member');
    _;
  }

  constructor() {
    admin = msg.sender;
  }

  function transferAdmin(address newAdmin) external onlyAdmin {
    require(newAdmin != address(0), 'Invalid address');
    emit AdminTransferred(admin, newAdmin, block.timestamp);
    admin = newAdmin;
  }

  // ===============================================================
  // MEMBER REGISTRY
  // ===============================================================

  // =================== MEMBER REGISTRY - ENUMS ===================

  enum MemberStatus {
    Inactive, // 0 - Cannot transact (banned/removed)
    Active, // 1 - Default Status
    Verified // 2 - User has verified their identity and email
  }

  // =================== MEMBER REGISTRY - EVENTS ===================

  event MemberRegistered(address indexed userWallet, bytes32 indexed userIdHash, uint256 timestamp);

  event MemberStatusChanged(
    address indexed userWallet,
    MemberStatus oldStatus,
    MemberStatus newStatus,
    address indexed changedBy,
    uint256 timestamp
  );

  // =================== MEMBER REGISTRY - STRUCTURE ===================

  struct Member {
    address userWallet;
    bytes32 userIdHash;
    MemberStatus status;
    uint256 joinedAt;
  }

  // =================== MEMBER REGISTRY - STORAGE ===================

  mapping(address => Member) public members;
  mapping(bytes32 => address) public userIdHashToAddress;
  uint256 public totalMembers;

  // =================== MEMBER REGISTRY - FUNCTIONS ===================

  /**
   * @notice Register a new member (can only be called by Belrose Admin)
   * @param userWallet The user's wallet address
   * @param userIdHash Hash of their off-chain user ID
   */
  function addMember(address userWallet, bytes32 userIdHash) external onlyAdmin {
    require(userWallet != address(0), 'Invalid wallet address');
    require(members[userWallet].joinedAt == 0, 'Already a member');
    require(userIdHashToAddress[userIdHash] == address(0), 'User ID already registered');

    members[userWallet] = Member({
      userWallet: userWallet,
      userIdHash: userIdHash,
      status: MemberStatus.Active,
      joinedAt: block.timestamp
    });

    userIdHashToAddress[userIdHash] = userWallet;
    totalMembers++;

    emit MemberRegistered(userWallet, userIdHash, block.timestamp);
  }

  /**
   * @notice Change a member's status
   * @param userWallet The member's wallet
   * @param newStatus The new status
   */
  function setMemberStatus(address userWallet, MemberStatus newStatus) external onlyAdmin {
    require(members[userWallet].joinedAt != 0, 'Not a member');

    MemberStatus oldStatus = members[userWallet].status;
    require(oldStatus != newStatus, 'Already this status');

    members[userWallet].status = newStatus;

    emit MemberStatusChanged(userWallet, oldStatus, newStatus, msg.sender, block.timestamp);
  }

  /**
   * @notice Check if address is active (not inactive and is a member)
   */
  function isActiveMember(address user) external view override returns (bool) {
    return members[user].status != MemberStatus.Inactive && members[user].joinedAt != 0;
  }

  /**
   * @notice Check if address is verified
   */
  function isVerifiedMember(address user) external view override returns (bool) {
    return members[user].status == MemberStatus.Verified;
  }

  /**
   * @notice Get member details
   */
  function getMember(
    address user
  ) external view returns (bytes32 userIdHash, MemberStatus status, uint256 joinedAt) {
    Member memory m = members[user];
    return (m.userIdHash, m.status, m.joinedAt);
  }

  /**
   * @notice Lookup wallet by user ID hash
   */
  function getWalletByUserIdHash(bytes32 userIdHash) external view returns (address) {
    return userIdHashToAddress[userIdHash];
  }

  // ===============================================================
  // ROLE MANAGEMENT
  // ===============================================================

  // =================== ROLE MANAGEMENT - EVENTS ===================

  event RoleGranted(
    string indexed recordId,
    address indexed user,
    string role,
    address indexed grantedBy,
    uint256 timestamp
  );

  event RoleChanged(
    string indexed recordId,
    address indexed user,
    string oldRole,
    string newRole,
    address indexed changedBy,
    uint256 timestamp
  );

  event RoleRevoked(
    string indexed recordId,
    address indexed user,
    string role,
    address indexed revokedBy,
    uint256 timestamp
  );

  event OwnerVoluntarilyLeft(string indexed recordId, address indexed owner, uint256 timestamp);

  // =================== ROLE MANAGEMENT - STRUCTURE ===================

  struct RecordRole {
    string recordId;
    address user;
    string role; // "owner", "administrator", "viewer"
    uint256 grantedAt;
    uint256 lastModified;
    address grantedBy;
    bool isActive;
  }

  // =================== ROLE MANAGEMENT - STORAGE ===================

  mapping(bytes32 => RecordRole) public recordRoles;
  mapping(string => address[]) public ownersByRecord;
  mapping(string => address[]) public adminsByRecord;
  mapping(string => address[]) public viewersByRecord;
  mapping(address => string[]) public recordsByUser;
  uint256 public totalRoles;

  // =================== ROLE MANAGEMENT - INTERNAL HELPERS ===================

  function _grantRoleInternal(
    string memory recordId,
    address user,
    string memory role,
    address grantedBy
  ) internal {
    bytes32 roleKey = keccak256(abi.encodePacked(recordId, user));
    bool alreadyHasRole = recordRoles[roleKey].isActive;

    recordRoles[roleKey] = RecordRole({
      recordId: recordId,
      user: user,
      role: role,
      grantedAt: alreadyHasRole ? recordRoles[roleKey].grantedAt : block.timestamp,
      lastModified: block.timestamp,
      grantedBy: grantedBy,
      isActive: true
    });

    if (!alreadyHasRole) {
      _addToRoleArray(recordId, user, role);
      recordsByUser[user].push(recordId);
      totalRoles++;
    }

    emit RoleGranted(recordId, user, role, grantedBy, block.timestamp);
  }

  function _addToRoleArray(string memory recordId, address user, string memory role) internal {
    bytes32 roleHash = keccak256(bytes(role));

    if (roleHash == keccak256(bytes('owner'))) {
      ownersByRecord[recordId].push(user);
    } else if (roleHash == keccak256(bytes('administrator'))) {
      adminsByRecord[recordId].push(user);
    } else if (roleHash == keccak256(bytes('viewer'))) {
      viewersByRecord[recordId].push(user);
    }
  }

  function _removeFromRoleArray(string memory recordId, address user, string memory role) internal {
    bytes32 roleHash = keccak256(bytes(role));

    if (roleHash == keccak256(bytes('owner'))) {
      _removeFromAddressArray(ownersByRecord[recordId], user);
    } else if (roleHash == keccak256(bytes('administrator'))) {
      _removeFromAddressArray(adminsByRecord[recordId], user);
    } else if (roleHash == keccak256(bytes('viewer'))) {
      _removeFromAddressArray(viewersByRecord[recordId], user);
    }
  }

  function _removeFromAddressArray(address[] storage array, address toRemove) internal {
    for (uint256 i = 0; i < array.length; i++) {
      if (array[i] == toRemove) {
        array[i] = array[array.length - 1];
        array.pop();
        break;
      }
    }
  }

  function _hasRole(
    string memory recordId,
    address user,
    string memory role
  ) internal view returns (bool) {
    bytes32 roleKey = keccak256(abi.encodePacked(recordId, user));
    RecordRole memory userRole = recordRoles[roleKey];
    return userRole.isActive && keccak256(bytes(userRole.role)) == keccak256(bytes(role));
  }

  function _isOwnerOrAdmin(string memory recordId, address user) internal view returns (bool) {
    return _hasRole(recordId, user, 'owner') || _hasRole(recordId, user, 'administrator');
  }

  function _hasActiveRole(string memory recordId, address user) internal view returns (bool) {
    bytes32 roleKey = keccak256(abi.encodePacked(recordId, user));
    return recordRoles[roleKey].isActive;
  }

  // =================== ROLE MANAGEMENT - EXTERNAL FUNCTIONS ===================

  /**
   * @notice Admin establishes first administrator on a new record
   * @param recordId The record ID
   * @param firstAdmin The address to make first administrator
   */
  function initializeRecordRole(string memory recordId, address firstAdmin) external onlyAdmin {
    require(bytes(recordId).length > 0, 'Record ID cannot be empty');
    require(firstAdmin != address(0), 'Invalid address');
    require(
      members[firstAdmin].status != MemberStatus.Inactive && members[firstAdmin].joinedAt != 0,
      'Must be an active member'
    );
    require(
      ownersByRecord[recordId].length == 0 && adminsByRecord[recordId].length == 0,
      'Record already initialized'
    );

    _grantRoleInternal(recordId, firstAdmin, 'administrator', msg.sender);
  }

  /**
   * @notice Grant a role to a user for a specific record
   * @param recordId The record ID
   * @param user The address to grant the role to
   * @param role The role to grant ("owner", "administrator", "viewer")
   */
  function grantRole(
    string memory recordId,
    address user,
    string memory role
  ) external onlyActiveMember {
    require(bytes(recordId).length > 0, 'Record ID cannot be empty');
    require(user != address(0), 'User address cannot be zero');

    bytes32 roleHash = keccak256(bytes(role));
    require(
      roleHash == keccak256(bytes('owner')) ||
        roleHash == keccak256(bytes('administrator')) ||
        roleHash == keccak256(bytes('viewer')),
      'Invalid role. Must be: owner, administrator, or viewer'
    );

    bytes32 callerRoleKey = keccak256(abi.encodePacked(recordId, msg.sender));
    require(recordRoles[callerRoleKey].isActive, 'You have no role for this record');

    bool ownerExists = ownersByRecord[recordId].length > 0;
    bool callerIsOwner = _hasRole(recordId, msg.sender, 'owner');
    bool callerIsAdmin = _hasRole(recordId, msg.sender, 'administrator');

    if (roleHash == keccak256(bytes('owner'))) {
      if (ownerExists) {
        require(callerIsOwner, 'Only owners can grant owner role');
      } else {
        require(callerIsAdmin, 'Only administrators can grant first owner');
      }
    } else if (roleHash == keccak256(bytes('administrator'))) {
      require(
        callerIsOwner || callerIsAdmin,
        'Only owners and administrators can grant administrator role'
      );
    } else if (roleHash == keccak256(bytes('viewer'))) {
      require(
        callerIsOwner || callerIsAdmin,
        'Only owners and administrators can grant viewer role'
      );
    }

    bytes32 targetRoleKey = keccak256(abi.encodePacked(recordId, user));
    require(
      !recordRoles[targetRoleKey].isActive,
      'User already has a role. Use changeRole() instead'
    );

    _grantRoleInternal(recordId, user, role, msg.sender);
  }

  /**
   * @notice Change a user's existing role to a different role
   * @param recordId The record ID
   * @param user The address whose role is being changed
   * @param newRole The new role ("owner", "administrator", "viewer")
   */
  function changeRole(
    string memory recordId,
    address user,
    string memory newRole
  ) external onlyActiveMember {
    require(bytes(recordId).length > 0, 'Record ID cannot be empty');
    require(user != address(0), 'User address cannot be zero');

    bytes32 newRoleHash = keccak256(bytes(newRole));
    require(
      newRoleHash == keccak256(bytes('owner')) ||
        newRoleHash == keccak256(bytes('administrator')) ||
        newRoleHash == keccak256(bytes('viewer')),
      'Invalid role. Must be: owner, administrator, or viewer'
    );

    bytes32 targetRoleKey = keccak256(abi.encodePacked(recordId, user));
    RecordRole memory currentRole = recordRoles[targetRoleKey];
    require(currentRole.isActive, 'User does not have an active role');

    string memory oldRole = currentRole.role;
    bytes32 oldRoleHash = keccak256(bytes(oldRole));

    require(oldRoleHash != newRoleHash, 'User already has this role');
    require(
      oldRoleHash != keccak256(bytes('owner')),
      'Owners cannot be demoted. Owner must voluntarily remove themselves.'
    );

    bool ownerExists = ownersByRecord[recordId].length > 0;
    bool callerIsOwner = _hasRole(recordId, msg.sender, 'owner');
    bool callerIsAdmin = _hasRole(recordId, msg.sender, 'administrator');
    bool callerIsTarget = msg.sender == user;

    if (newRoleHash == keccak256(bytes('owner'))) {
      if (ownerExists) {
        require(callerIsOwner, 'Only owners can promote to owner');
      } else {
        require(callerIsAdmin, 'Only administrators can promote first owner');
      }
    } else if (newRoleHash == keccak256(bytes('administrator'))) {
      require(
        callerIsOwner || callerIsAdmin,
        'Only owners and administrators can promote to administrator'
      );
    } else if (newRoleHash == keccak256(bytes('viewer'))) {
      if (ownerExists) {
        require(
          callerIsOwner || (callerIsAdmin && callerIsTarget),
          'Only owners can demote others. Administrators can only demote themselves.'
        );
      } else {
        require(callerIsAdmin, 'Only administrators can demote to viewer');
      }
    }

    if (
      oldRoleHash == keccak256(bytes('administrator')) && newRoleHash == keccak256(bytes('viewer'))
    ) {
      if (!ownerExists) {
        require(
          adminsByRecord[recordId].length > 1,
          'Cannot demote the last administrator when no owner exists'
        );
      }
    }

    _removeFromRoleArray(recordId, user, oldRole);
    _addToRoleArray(recordId, user, newRole);

    recordRoles[targetRoleKey].role = newRole;
    recordRoles[targetRoleKey].lastModified = block.timestamp;

    emit RoleChanged(recordId, user, oldRole, newRole, msg.sender, block.timestamp);
  }

  /**
   * @notice Allows an owner to voluntarily give up their ownership
   * @param recordId The record ID
   */
  function voluntarilyRemoveOwnOwnership(string memory recordId) external {
    require(bytes(recordId).length > 0, 'Record ID cannot be empty');
    require(_hasRole(recordId, msg.sender, 'owner'), 'You are not an owner of this record');

    bool hasOtherOwners = ownersByRecord[recordId].length > 1;
    bool hasAdmins = adminsByRecord[recordId].length > 0;

    require(
      hasOtherOwners || hasAdmins,
      'Cannot remove yourself as last owner with no administrators'
    );

    bytes32 roleKey = keccak256(abi.encodePacked(recordId, msg.sender));
    _removeFromRoleArray(recordId, msg.sender, 'owner');

    recordRoles[roleKey].isActive = false;
    recordRoles[roleKey].lastModified = block.timestamp;

    emit OwnerVoluntarilyLeft(recordId, msg.sender, block.timestamp);
  }

  /**
   * @notice Revoke a user's role entirely
   * @param recordId The record ID
   * @param user The address whose role is being revoked
   */
  function revokeRole(string memory recordId, address user) external {
    require(bytes(recordId).length > 0, 'Record ID cannot be empty');
    require(user != address(0), 'User address cannot be zero');

    bytes32 targetRoleKey = keccak256(abi.encodePacked(recordId, user));
    RecordRole memory currentRole = recordRoles[targetRoleKey];
    require(currentRole.isActive, 'User does not have an active role');

    string memory role = currentRole.role;
    bytes32 roleHash = keccak256(bytes(role));

    require(
      roleHash != keccak256(bytes('owner')),
      'Owners cannot be revoked. Owner must use voluntarilyRemoveOwnOwnership().'
    );

    bool isSelfRevoke = msg.sender == user;

    if (!isSelfRevoke) {
      require(
        _isOwnerOrAdmin(recordId, msg.sender),
        'Only owners and administrators can revoke roles'
      );

      bool callerIsOwner = _hasRole(recordId, msg.sender, 'owner');

      if (!callerIsOwner) {
        bool targetIsAdmin = roleHash == keccak256(bytes('administrator'));

        if (targetIsAdmin) {
          bool ownerExists = ownersByRecord[recordId].length > 0;
          require(!ownerExists, 'Only owners can revoke administrators');
        }
      }
    }

    if (roleHash == keccak256(bytes('administrator'))) {
      bool hasOtherAdmins = adminsByRecord[recordId].length > 1;
      bool ownerExists = ownersByRecord[recordId].length > 0;

      require(
        hasOtherAdmins || ownerExists,
        'Cannot revoke last administrator without an owner present'
      );
    }

    _removeFromRoleArray(recordId, user, role);

    recordRoles[targetRoleKey].isActive = false;
    recordRoles[targetRoleKey].lastModified = block.timestamp;

    emit RoleRevoked(recordId, user, role, msg.sender, block.timestamp);
  }

  // =================== ROLE MANAGEMENT - VIEW FUNCTIONS (Interface) ===================

  /**
   * @notice Check if user has any active role on a record
   */
  function hasActiveRole(
    string memory recordId,
    address user
  ) external view override returns (bool) {
    return _hasActiveRole(recordId, user);
  }

  /**
   * @notice Check if a user has a specific role
   */
  function hasRole(
    string memory recordId,
    address user,
    string memory role
  ) external view override returns (bool) {
    return _hasRole(recordId, user, role);
  }

  /**
   * @notice Check if user is owner or administrator
   */
  function isOwnerOrAdmin(
    string memory recordId,
    address user
  ) external view override returns (bool) {
    return _isOwnerOrAdmin(recordId, user);
  }

  // =================== ROLE MANAGEMENT - VIEW FUNCTIONS (Additional) ===================

  /**
   * @notice Get full role details
   */
  function getRoleDetails(
    string memory recordId,
    address user
  )
    external
    view
    returns (
      string memory role,
      uint256 grantedAt,
      uint256 lastModified,
      address grantedBy,
      bool isActive
    )
  {
    bytes32 roleKey = keccak256(abi.encodePacked(recordId, user));
    RecordRole memory userRole = recordRoles[roleKey];
    return (
      userRole.role,
      userRole.grantedAt,
      userRole.lastModified,
      userRole.grantedBy,
      userRole.isActive
    );
  }

  /**
   * @notice Get all owners of a record
   */
  function getRecordOwners(string memory recordId) external view returns (address[] memory) {
    return ownersByRecord[recordId];
  }

  /**
   * @notice Get all administrators of a record
   */
  function getRecordAdmins(string memory recordId) external view returns (address[] memory) {
    return adminsByRecord[recordId];
  }

  /**
   * @notice Get all viewers of a record
   */
  function getRecordViewers(string memory recordId) external view returns (address[] memory) {
    return viewersByRecord[recordId];
  }

  /**
   * @notice Get all records where a user has any role
   */
  function getRecordsByUser(address user) external view returns (string[] memory) {
    return recordsByUser[user];
  }

  /**
   * @notice Get role statistics for a record
   */
  function getRecordRoleStats(
    string memory recordId
  ) external view returns (uint256 ownerCount, uint256 adminCount, uint256 viewerCount) {
    return (
      ownersByRecord[recordId].length,
      adminsByRecord[recordId].length,
      viewersByRecord[recordId].length
    );
  }

  /**
   * @notice Get total number of roles across all records
   */
  function getTotalRoles() external view returns (uint256) {
    return totalRoles;
  }
}

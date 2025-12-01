// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title HealthRecordVerification
 * @dev Store and verify medical record hashes on blockchain with medical attestation
 * Part 1: Member Registry
 * Part 2: Role Management
 * Part 3: Access Permission
 * Part 4: Record Initiatlization - Commitment and Anchoring
 * Part 5: Record Reviews - Verification and Disputes
 */
contract HealthRecordVerification {
  // ===============================================================
  // MEMBER REGISTRY
  // ===============================================================

  // =================== ADMIN MANAGEMENT ===================
  address public admin;

  event AdminTransferred(address indexed oldAdmin, address indexed newAdmin, uint256 timestamp);

  modifier onlyAdmin() {
    require(msg.sender == admin, 'Only admin');
    _;
  }

  modifier onlyActiveMember() {
    //Note this only checks for NOT inactive so it captures both verified and active members
    require(members[msg.sender].status != MemberStatus.Inactive, 'Not an active member');
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

  // =================== MEMBER REGISTRY - ENUMS ===================

  enum MemberStatus {
    Inactive, // 0 - Cannot transact (banned/removed)
    Active, // 1 - Default Status
    Verified // 2 - User has verified their identity and email
  }

  // =================== MEMBER REGISTRY - EVENTS ===================

  event MemberRegistered(
    address indexed userWalletAddress,
    bytes32 indexed userIdHash,
    uint256 timestamp
  );

  event MemberStatusChanged(
    address indexed userAddress,
    MemberStatus oldStatus,
    MemberStatus newStatus,
    address indexed changedBy,
    uint256 timestamp
  );

  // =================== MEMBER REGISTRY - STRUCTURE ===================

  struct Member {
    address userWalletAddress;
    bytes32 userIdhash;
    MemberStatus status;
    uint256 joinedAt;
  }

  // =================== MEMBER REGISTRY - STORAGE ===================

  mapping(address => Member) public members;
  mapping(bytes32 => address) public userIdHashToAddress;
  uint256 public totalMembers;

  // =================== MEMBER REGISTRY - FUNCTIONS ===================

  /**
   * @notice Register a new member (called by Belrose backend)
   * @param userWallet The user's wallet address
   * @param userIdHash Hash of their off-chain user ID
   */
  function addMember(address userWallet, bytes32 userIdHash) external onlyAdmin {
    require(userWallet != address(0), 'Invalid wallet address');
    require(members[userWallet].joinedAt == 0, 'Already a member');
    require(userIdHashToAddress[userIdHash] == address(0), 'User ID already registered');

    members[userWallet] = Member({
      userWalletAddress: userWallet,
      userIdhash: userIdHash,
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
   * @notice Check if address is active member
   */
  function isActiveMember(address user) public view returns (bool) {
    return members[user].status == MemberStatus.Active;
  }

  /**
   * @notice Get member details
   */
  function getMember(
    address user
  ) external view returns (bytes32 userIdHash, MemberStatus status, uint256 joinedAt) {
    Member memory m = members[user];
    return (m.userIdhash, m.status, m.joinedAt);
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
  // The shape of a user's role for a specific record
  struct RecordRole {
    string recordId; // Which record this role is for
    address user; // Who has this role
    string role; // "owner", "administrator", "viewer"
    uint256 grantedAt; // When the access was first granted
    uint256 lastModified; // When it was last changed
    address grantedBy; // Who granted this role
    bool isActive; // Is this role currently active?
  }

  // =================== ROLE MANAGEMENT - STORAGE/MAPPING ===================
  // Primary storage: hash(recordId + user) -> role details
  mapping(bytes32 => RecordRole) public recordRoles;

  // Index arrays for lookups - "who has roles on this record?"
  mapping(string => address[]) public ownersByRecord;
  mapping(string => address[]) public adminsByRecord;
  mapping(string => address[]) public viewersByRecord;

  // Reverse lookup - "what records does this user have roles on?"
  mapping(address => string[]) public recordsByUser;

  // Counter
  uint256 public totalRoles;

  // =================== ROLE MANAGEMENT - FUNCTIONS ===================
  // ========== ROLE MANAGEMENT FUNCTIONS - INTERNAL ROLE MANAGEMENT HELPERS ==========

  /**
   * @dev Internal function to grant a role - called by other functions.
   * Exclusively for someone NEW to the record. If it's an upgrade/downgrade, we will use changeRole below
   * @param recordId The record this role is for
   * @param user Who is receiving the role
   * @param role The role to grant ("owner", "administrator", "viewer")
   * @param grantedBy Who is granting this role
   */
  function _grantRoleInternal(
    string memory recordId,
    address user,
    string memory role,
    address grantedBy
  ) internal {
    // Create the unique key for this recordId + user combination
    bytes32 roleKey = keccak256(abi.encodePacked(recordId, user));

    // Check if they already have any role on this record
    bool alreadyHasRole = recordRoles[roleKey].isActive;

    // Store the role data
    recordRoles[roleKey] = RecordRole({
      recordId: recordId,
      user: user,
      role: role,
      grantedAt: alreadyHasRole ? recordRoles[roleKey].grantedAt : block.timestamp,
      lastModified: block.timestamp,
      grantedBy: grantedBy,
      isActive: true
    });

    // Add to the appropriate lookup array (if new)
    if (!alreadyHasRole) {
      _addToRoleArray(recordId, user, role);
      recordsByUser[user].push(recordId);
      totalRoles++;
    }

    emit RoleGranted(recordId, user, role, grantedBy, block.timestamp);
  }

  /**
   * @dev Add user to the correct role array
   */
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

  /**
   * @dev Remove user from the appropriate role array
   * Uses removeFromAddressArray function below
   */
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

  /**
   * @dev Remove an address from an array using swap-and-pop
   * This is O(n) but more gas efficient than shifting all elements
   */
  function _removeFromAddressArray(address[] storage array, address toRemove) internal {
    for (uint256 i = 0; i < array.length; i++) {
      if (array[i] == toRemove) {
        // Swap with last element
        array[i] = array[array.length - 1];
        // Remove last element
        array.pop();
        break;
      }
    }
  }

  /**
   * @dev Check if a user has a specific role
   */
  function _hasRole(
    string memory recordId,
    address user,
    string memory role
  ) internal view returns (bool) {
    bytes32 roleKey = keccak256(abi.encodePacked(recordId, user));
    RecordRole memory userRole = recordRoles[roleKey];

    return userRole.isActive && keccak256(bytes(userRole.role)) == keccak256(bytes(role));
  }

  /**
   * @dev Check if user has owner OR admin role
   */
  function _isOwnerOrAdmin(string memory recordId, address user) internal view returns (bool) {
    return _hasRole(recordId, user, 'owner') || _hasRole(recordId, user, 'administrator');
  }

  // ========== ROLE MANAGEMENT FUNCTIONS - EXTERNAL ROLE MANAGEMENT FUNCTIONS ==========

  /**
   * @notice Admin establishes first administrator on a new record
   * @dev Must be called before anyone can use grantRole on this record
   * @param recordId The record ID
   * @param firstAdmin The address to make first administrator
   */
  function initializeRecordRole(string memory recordId, address firstAdmin) external onlyAdmin {
    require(bytes(recordId).length > 0, 'Record ID cannot be empty');
    require(firstAdmin != address(0), 'Invalid address');
    require(isActiveMember(firstAdmin), 'Must be an active member');

    // Ensure record hasn't been initialized yet
    require(
      ownersByRecord[recordId].length == 0 && adminsByRecord[recordId].length == 0,
      'Record already initialized'
    );

    _grantRoleInternal(recordId, firstAdmin, 'administrator', msg.sender);
  }

  /**
   * @notice Grant a role to a user for a specific record for the first time
   * Not used for changing a role, only used if the user has not had a role in this record before
   * @param recordId The record ID
   * @param user The address to grant the role to
   * @param role The role to grant ("owner", "administrator", "viewer")
   */
  function grantRole(
    string memory recordId,
    address user,
    string memory role
  ) external onlyActiveMember {
    // Validation
    require(bytes(recordId).length > 0, 'Record ID cannot be empty');
    require(user != address(0), 'User address cannot be zero');

    // Validate role string
    bytes32 roleHash = keccak256(bytes(role));
    require(
      roleHash == keccak256(bytes('owner')) ||
        roleHash == keccak256(bytes('administrator')) ||
        roleHash == keccak256(bytes('viewer')),
      'Invalid role. Must be: owner, administrator, or viewer'
    );

    // Check if the caller has a role, if not throw error
    bytes32 callerRoleKey = keccak256(abi.encodePacked(recordId, msg.sender));
    RecordRole memory callerRole = recordRoles[callerRoleKey];
    require(callerRole.isActive, 'You have no role for this record');

    // Check to see if there's an owner. Check to see if caller is owner or admin
    bool ownerExists = ownersByRecord[recordId].length > 0;
    bool callerIsOwner = _hasRole(recordId, msg.sender, 'owner');
    bool callerIsAdmin = _hasRole(recordId, msg.sender, 'administrator');

    // Enforce access permissions hierarchy
    if (roleHash == keccak256(bytes('owner'))) {
      // Owner role: If there's an owner set (ownerExists), then only owner can grant, otherwise admins can gran the first owner
      if (ownerExists) {
        require(callerIsOwner, 'Only owners can grant owner role');
      } else {
        require(callerIsAdmin, 'Only administrators can grant first owner');
      }
    } else if (roleHash == keccak256(bytes('administrator'))) {
      // Admin role: owner OR admin can grant
      require(
        callerIsOwner || callerIsAdmin,
        'Only owners and administrators can grant administrator role'
      );
    } else if (roleHash == keccak256(bytes('viewer'))) {
      // Viewer role: owner OR admin can grant
      require(
        callerIsOwner || callerIsAdmin,
        'Only owners and administrators can grant viewer role'
      );
    }

    // Check if user already has a role - if so, this should be changeRole
    bytes32 targetRoleKey = keccak256(abi.encodePacked(recordId, user));
    require(
      !recordRoles[targetRoleKey].isActive,
      'User already has a role. Use changeRole() instead'
    );

    // All checks passed - grant the role
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
    // Validation
    require(bytes(recordId).length > 0, 'Record ID cannot be empty');
    require(user != address(0), 'User address cannot be zero');

    // Validate new role string
    bytes32 newRoleHash = keccak256(bytes(newRole));
    require(
      newRoleHash == keccak256(bytes('owner')) ||
        newRoleHash == keccak256(bytes('administrator')) ||
        newRoleHash == keccak256(bytes('viewer')),
      'Invalid role. Must be: owner, administrator, or viewer'
    );

    // Get the user's current role
    bytes32 targetRoleKey = keccak256(abi.encodePacked(recordId, user));
    RecordRole memory currentRole = recordRoles[targetRoleKey];
    require(currentRole.isActive, 'User does not have an active role');

    string memory oldRole = currentRole.role;
    bytes32 oldRoleHash = keccak256(bytes(oldRole));

    // Can't change to the same role
    require(oldRoleHash != newRoleHash, 'User already has this role');

    // Cannot demote owner
    require(
      oldRoleHash != keccak256(bytes('owner')),
      'Owners cannot be demoted. Owner must voluntarily remove themselves.'
    );

    // Access Control Heirarchy, governs what roles can change what roles

    bool ownerExists = ownersByRecord[recordId].length > 0;
    bool callerIsOwner = _hasRole(recordId, msg.sender, 'owner');
    bool callerIsAdmin = _hasRole(recordId, msg.sender, 'administrator');
    bool callerIsTarget = msg.sender == user;

    // Promoting TO owner
    if (newRoleHash == keccak256(bytes('owner'))) {
      if (ownerExists) {
        require(callerIsOwner, 'Only owners can promote to owner');
      } else {
        require(callerIsAdmin, 'Only administrators can promote first owner');
      }
    }
    // Promoting TO admin (from viewer)
    else if (newRoleHash == keccak256(bytes('administrator'))) {
      require(
        callerIsOwner || callerIsAdmin,
        'Only owners and administrators can promote to administrator'
      );
    }
    // Demoting TO viewer (from admin)
    else if (newRoleHash == keccak256(bytes('viewer'))) {
      if (ownerExists) {
        // Owner can demote anyone, admin can only demote themselves
        require(
          callerIsOwner || (callerIsAdmin && callerIsTarget),
          'Only owners can demote others. Administrators can only demote themselves.'
        );
      } else {
        // No owner - admin can demote anyone
        require(callerIsAdmin, 'Only administrators can demote to viewer');
      }
    }

    // Prevent removing the last admin when no owner exists. Must always be an owner or an admin
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

    // Storage update
    _removeFromRoleArray(recordId, user, oldRole);
    _addToRoleArray(recordId, user, newRole);

    recordRoles[targetRoleKey].role = newRole;
    recordRoles[targetRoleKey].lastModified = block.timestamp;

    emit RoleChanged(recordId, user, oldRole, newRole, msg.sender, block.timestamp);
  }

  /**
   * @notice Allows an owner to voluntarily give up their ownership
   * @param recordId The record ID
   * @dev Owners can never be removed by others, only by themselves
   */
  function voluntarilyRemoveOwnOwnership(string memory recordId) external {
    require(bytes(recordId).length > 0, 'Record ID cannot be empty');

    // Must be an owner
    require(_hasRole(recordId, msg.sender, 'owner'), 'You are not an owner of this record');

    // Can't remove if you're the last owner AND there are no admins
    bool hasOtherOwners = ownersByRecord[recordId].length > 1;
    bool hasAdmins = adminsByRecord[recordId].length > 0;

    require(
      hasOtherOwners || hasAdmins,
      'Cannot remove yourself as last owner with no administrators'
    );

    // Update Storage
    bytes32 roleKey = keccak256(abi.encodePacked(recordId, msg.sender));

    _removeFromRoleArray(recordId, msg.sender, 'owner');

    recordRoles[roleKey].isActive = false;
    recordRoles[roleKey].lastModified = block.timestamp;

    emit OwnerVoluntarilyLeft(recordId, msg.sender, block.timestamp);
  }

  /**
   * @notice Revoke a user's role entirely (remove all access)
   * @param recordId The record ID
   * @param user The address whose role is being revoked
   */
  function revokeRole(string memory recordId, address user) external {
    // Validation
    require(bytes(recordId).length > 0, 'Record ID cannot be empty');
    require(user != address(0), 'User address cannot be zero');

    // Get the user's current role first
    bytes32 targetRoleKey = keccak256(abi.encodePacked(recordId, user));
    RecordRole memory currentRole = recordRoles[targetRoleKey];
    require(currentRole.isActive, 'User does not have an active role');

    string memory role = currentRole.role;
    bytes32 roleHash = keccak256(bytes(role));

    // Owner can't be revoked
    require(
      roleHash != keccak256(bytes('owner')),
      'Owners cannot be revoked. Owner must use voluntarilyRemoveOwnOwnership().'
    );

    // Check for Self-Revocation, if yes, then that's ok!
    bool isSelfRevoke = msg.sender == user;

    // If not self-revocation, check if permissions are ok
    if (!isSelfRevoke) {
      // First check: Must be owner or admin to revoke anyone
      require(
        _isOwnerOrAdmin(recordId, msg.sender),
        'Only owners and administrators can revoke roles'
      );

      // Second check: Differentiate if caller is Owner or Admin
      bool callerIsOwner = _hasRole(recordId, msg.sender, 'owner');

      if (!callerIsOwner) {
        // Caller is admin (we know because they passed _isOwnerOrAdmin)
        // Now we must check if they're targeting another admin.
        // If yes, need to make sure theres no owner because only owners can remove other admins
        // If they're self-targetting, we already pass above
        bool targetIsAdmin = roleHash == keccak256(bytes('administrator'));

        if (targetIsAdmin) {
          // Admin revoking another admin - only allowed if no owner exists
          bool ownerExists = ownersByRecord[recordId].length > 0;
          require(!ownerExists, 'Only owners can revoke administrators');
        }
        // If target is viewer, admin can revoke - no extra check needed
      }
      // If caller is owner, they can revoke anyone - no extra check needed
    }

    // Safety check, make sure there's at leat 1 admin or owner
    if (roleHash == keccak256(bytes('administrator'))) {
      bool hasOtherAdmins = adminsByRecord[recordId].length > 1;
      bool ownerExists = ownersByRecord[recordId].length > 0;

      require(
        hasOtherAdmins || ownerExists,
        'Cannot revoke last administrator without an owner present'
      );
    }

    // Update storage
    _removeFromRoleArray(recordId, user, role);

    recordRoles[targetRoleKey].isActive = false;
    recordRoles[targetRoleKey].lastModified = block.timestamp;

    emit RoleRevoked(recordId, user, role, msg.sender, block.timestamp);
  }

  // ========== ROLE MANAGEMENT FUNCTIONS - VIEW FUNCTIONS ==========

  /**
   * @notice Get full role details (for audit/verification UI)
   * @param recordId The record ID
   * @param user The address to check
   * @return role The role string
   * @return grantedAt When the access was first granted
   * @return lastModified When the role was last modified
   * @return grantedBy Who granted the role
   * @return isActive Whether the role is currently active
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
   * @param recordId The record ID
   * @return Array of owner addresses
   */
  function getRecordOwners(string memory recordId) external view returns (address[] memory) {
    return ownersByRecord[recordId];
  }

  /**
   * @notice Get all administrators of a record
   * @param recordId The record ID
   * @return Array of administrator addresses
   */
  function getRecordAdmins(string memory recordId) external view returns (address[] memory) {
    return adminsByRecord[recordId];
  }

  /**
   * @notice Get all viewers of a record
   * @param recordId The record ID
   * @return Array of viewer addresses
   */
  function getRecordViewers(string memory recordId) external view returns (address[] memory) {
    return viewersByRecord[recordId];
  }

  /**
   * @notice Get all records where a user has any role
   * @param user The user's address
   * @return Array of record IDs
   */
  function getRecordsByUser(address user) external view returns (string[] memory) {
    return recordsByUser[user];
  }

  /**
   * @notice Check if a user has a specific role (convenience function)
   * @param recordId The record ID
   * @param user The address to check
   * @param role The role to check for
   * @return hasRole True if user has this exact role and it's active
   */
  function hasRole(
    string memory recordId,
    address user,
    string memory role
  ) external view returns (bool) {
    return _hasRole(recordId, user, role);
  }

  /**
   * @notice Check if user is owner or administrator (can manage record)
   * @param recordId The record ID
   * @param user The address to check
   * @return canManage True if user can manage this record
   */
  function isOwnerOrAdmin(string memory recordId, address user) external view returns (bool) {
    return _isOwnerOrAdmin(recordId, user);
  }

  /**
   * @notice Get role statistics for a record
   * @param recordId The record ID
   * @return ownerCount Number of owners
   * @return adminCount Number of administrators
   * @return viewerCount Number of viewers
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
   * @return Total role count
   */
  function getTotalRoles() external view returns (uint256) {
    return totalRoles;
  }

  // ===============================================================
  // ACCESS PERMISSIONS
  // ===============================================================

  // ========== ACCESS PERMISSIONS - EVENTS ==========
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

  // ========== ACCESS PERMISSION - STRUCTURE ==========
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

  // ========== ACCESS PERMISSION - STORAGE/MAPPING ==========
  mapping(string => AccessPermission) public accessPermissions;
  mapping(address => string[]) public permissionsBySharer;
  mapping(address => string[]) public permissionsByReceiver;
  uint256 public totalPermissions;

  // ========== ACCESS PERMISSION - FUNCTIONS ==========

  /**
   * Grant access to a record
   * @param permissionHash Hash of the permission details (from frontend)
   * @param recordId The internal record ID
   * @param receiver Address of the person receiving access
   */
  function grantAccess(
    string memory permissionHash,
    string memory recordId,
    address receiver
  ) external {
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
   * Revoke access to a record
   * @param permissionHash The permission hash to revoke
   */
  function revokeAccess(string memory permissionHash) external {
    require(accessPermissions[permissionHash].exists, 'Permission does not exist');
    require(accessPermissions[permissionHash].isActive, 'Already revoked');

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
   * Check if access is currently active
   * @param permissionHash The permission hash to check
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
   * Get all permissions granted by an sharer
   */
  function getPermissionsBySharer(address sharer) external view returns (string[] memory) {
    return permissionsBySharer[sharer];
  }

  /**
   * Get all permissions for a receiver
   */
  function getPermissionsByReceiver(address receiver) external view returns (string[] memory) {
    return permissionsByReceiver[receiver];
  }

  /**
   * Get total number of permissions (active and revoked)
   */
  function getTotalPermissions() external view returns (uint256) {
    return totalPermissions;
  }

  /**
   * Get permission statistics for an sharer
   * @param sharer The sharer's address
   * @return total Total permissions granted
   * @return active How many are still active
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
  // RECORD INITIALIZATION
  // ===============================================================

  // =================== RECORD INITIALIZATION - EVENTS ===================
  event RecordAnchored(
    string indexed recordId,
    string indexed recordHash,
    address indexed subject,
    address createdBy,
    uint256 timestamp
  );

  // =================== RECORD INITIALIZATION - ENUMS ===================

  enum RecordStatus {
    Pending,
    Accepted,
    Unacknowledged,
    Rejected
  }

  // =================== RECORD INITIALIZATION - STRUCTURES ===================
  struct AnchoredRecord {
    string recordHash;
    string recordId;
    address subject; // Who this record is ABOUT (the patient)
    uint256 createdAt;
    address createdBy;
    bool exists;
  }

  // =================== RECORD INITIALIZATION - STORAGE/MAPPING ===================

  // Record metadata: recordId -> metadata
  mapping(string => AnchoredRecord) public anchoredRecords;

  // Reverse lookup: subject address -> array of recordIds about them
  mapping(address => string[]) public recordsAboutSubject;
  mapping(string => string[]) public recordHashesByRecordId;

  // Counters
  uint256 public totalAnchoredRecords;

  // ========== RECORD INITIALIZATION FUNCTIONS ==========

  /**
   * @notice Healthcare provider proposes a record
   * @dev This must happen before anchoring to give the patient an opportunity to accept or reject
   * @param subject The patient/person this record is about
   * @param commitmentId unique ID for proposal
   * @param recordHashCommitment //keccak256(recordHash + recordId + salt)
   */

  /**
   * @notice Anchor a record hash with its metadata
   * @dev This must happen before any reviews
   * @param recordHash SHA-256 hash of the record contents
   * @param recordId Your internal record ID
   * @param subject The patient/person this record is about
   */
  function anchorRecord(
    string memory recordHash,
    string memory recordId,
    address subject
  ) external {
    require(bytes(recordHash).length > 0, 'Hash cannot be empty');
    require(bytes(recordId).length > 0, 'Record ID cannot be empty');
    require(subject != address(0), 'Subject cannot be zero address');
    require(!anchoredRecords[recordHash].exists, 'Hash already anchored');

    // Must have a role on this record to anchor it
    bytes32 roleKey = keccak256(abi.encodePacked(recordId, msg.sender));
    require(recordRoles[roleKey].isActive, 'No access to this record');

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
  // RECORD REVIEW - VERIFICATION AND DISPUTES
  // ===============================================================

  // =================== RECORD REVIEW - EVENTS ===================
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

  // =================== RECORD REVIEW - ENUMS ===================
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

  // =================== RECORD REVIEW - STRUCTURES ===================

  struct Review {
    address reviewer;
    ReviewType reviewType;
    DisputeSeverity severity;
    DisputeCulpability culpability;
    uint256 timestamp;
    string notes; // Hash of detailed reasoning (stored off-chain)
    bool isActive;
  }

  struct Reaction {
    address reactor;
    bool supportsDispute; // true = thumbs up, false = thumbs down
    uint256 timestamp;
  }

  // =================== RECORD REVIEW - STORAGE/MAPPING ===================

  // Reviews: recordHash -> array of record Reviews
  mapping(string => Review[]) public recordReviews;

  // Has user reviewed to this hash: recordHash -> user -> hasReviewed
  mapping(string => mapping(address => bool)) public hasReviewed;

  // User's review index: recordHash -> user -> index in array. Needed for finding review quickly,
  //otherwise you'll have to loop through the entire thing when retracting
  mapping(string => mapping(address => uint256)) public userReviewIndex;

  // Review reactions: recordHash -> reviewer address -> array of reactions
  mapping(string => mapping(address => Reaction[])) public disputeReactions;

  // Has user reacted to this dispute: recordHash -> disputer -> reactor -> hasReacted
  // For enforcing one reaction per user per dispute
  mapping(string => mapping(address => mapping(address => bool))) public hasReactedToDispute;

  // Reverse lookups for credibility scoring
  mapping(address => string[]) public verificationsByUser;
  mapping(address => string[]) public disputesByUser;

  // Counters
  uint256 public totalReviews;

  // ========== REVIEW REVIEW FUNCTIONS ==========

  /**
   * @notice Verify a record (attest that it's accurate)
   * @param recordHash The hash being verified
   * @param notes Optional hash of detailed notes (stored off-chain)
   */
  function verifyRecord(string memory recordHash, string memory notes) external {
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
   * @param severity Measures the potential impact of the mistake 1=Neglibile 2= Moderate 3=Major
   * @param culpability Measures reasons for failure 1=NoFault, 2=Systemic 3=Preventable 4=Reckless 5=Intentional
   * @param notes Optional hash of detailed reasoning (stored off-chain)
   */
  function disputeRecord(
    string memory recordHash,
    uint8 severity,
    uint8 culpability,
    string memory notes
  ) external {
    require(severity >= 1 && severity <= 5, 'Severity must be 1-5');
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
    bytes32 roleKey = keccak256(abi.encodePacked(recordId, msg.sender));
    require(recordRoles[roleKey].isActive, 'No access to this record');

    // One attestation per user per hash
    require(!hasReviewed[recordHash][msg.sender], 'Already reviewed this record');

    // Store attestation
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

  /**
   * @notice Retract your attestation (verification or dispute)
   * @dev Once retracted, you cannot re-attest
   * @param recordHash The hash you attested to
   */
  function retractReview(string memory recordHash) external {
    require(hasReviewed[recordHash][msg.sender], 'No review to retract');

    uint256 index = userReviewIndex[recordHash][msg.sender];
    Review storage review = recordReviews[recordHash][index];

    require(review.isActive, 'Already retracted');

    review.isActive = false;

    //Allow them to review again
    hasReviewed[recordHash][msg.sender] = false;

    emit ReviewRetracted(recordHash, msg.sender, review.reviewType, block.timestamp);
  }

  /**
   * @notice Allows a user to change the severity and/or culpability scores on their active dispute.
   * @param recordHash The hash of the record with the dispute.
   * @param newSeverity The new severity score (1-5).
   * @param newCulpability The new culpability score (1-5).
   */
  function modifyDispute(
    string memory recordHash,
    uint8 newSeverity,
    uint8 newCulpability
  ) external {
    // 1. Basic Checks
    require(anchoredRecords[recordHash].exists, 'Record not anchored');
    require(hasReviewed[recordHash][msg.sender], 'User has no review on this record');
    // Severity: 1(Negligible) to 5(Catastrophic). 0 is None.
    require(newSeverity >= 1 && newSeverity <= 3, 'Severity must be 1-3');
    // Culpability: 1(NoFault) to 5(Intentional). 0 is None.
    require(newCulpability >= 1 && newCulpability <= 5, 'Culpability must be 1-5');

    // 2. Locate Review
    uint256 index = userReviewIndex[recordHash][msg.sender];
    Review storage review = recordReviews[recordHash][index];

    // 3. Verify it's an active dispute
    require(review.isActive, 'Dispute has been retracted');
    require(review.reviewType == ReviewType.Dispute, 'Review is not a dispute');

    // Store old values for the event
    DisputeSeverity oldSeverity = review.severity;
    DisputeCulpability oldCulpability = review.culpability;

    // 4. Update the scores
    review.severity = DisputeSeverity(newSeverity);
    review.culpability = DisputeCulpability(newCulpability);

    // 5. Emit Event for Transparency
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

  // ========== RECORD REVIEW - DISPUTE REACTION FUNCTIONS ==========

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
  ) external {
    require(anchoredRecords[recordHash].exists, 'Record not anchored');
    require(hasReviewed[recordHash][disputer], 'No dispute from this address');

    // Verify it's actually a dispute
    uint256 disputeIndex = userReviewIndex[recordHash][disputer];
    Review memory review = recordReviews[recordHash][disputeIndex];
    require(review.reviewType == ReviewType.Dispute, 'Not a dispute');
    require(review.isActive, 'Dispute has been retracted');

    // Must have access to the record
    string memory recordId = anchoredRecords[recordHash].recordId;
    bytes32 roleKey = keccak256(abi.encodePacked(recordId, msg.sender));
    require(recordRoles[roleKey].isActive, 'No access to this record');

    // Can't react to your own dispute
    require(msg.sender != disputer, 'Cannot react to your own dispute');

    // One reaction per user per dispute
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

  // ========== RECORD REVIEW VIEW FUNCTIONS ==========
  /**
   * @notice Get all Reviews for a record hash
   */
  function getReviews(string memory recordHash) external view returns (Review[] memory) {
    return recordReviews[recordHash];
  }

  /**
   * @notice Get attestation counts for a record hash
   */
  function getReviewStats(
    string memory recordHash
  )
    external
    view
    returns (uint256 activeVerifications, uint256 activeDisputes, uint256 retractedCount)
  {
    Review[] memory review = recordReviews[recordHash];

    for (uint256 i = 0; i < review.length; i++) {
      if (review[i].isActive) {
        if (review[i].reviewType == ReviewType.Verification) {
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
   * @notice Get a user's attestation on a record hash
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
   * @notice Get user's attestation history (for credibility scoring)
   */
  function getUserAttestationHistory(
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
  function getTotalStats() external view returns (uint256 totalAnchored, uint256 totalReviewCount) {
    return (totalAnchoredRecords, totalReviews);
  }
}

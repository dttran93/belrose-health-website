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
}

/**
 * @title MemberRoleManager
 * @dev Manages multi-wallet member registration and role-based access control.
 *
 * KEY ARCHITECTURE:
 * - Members are registered by WALLET ADDRESS
 * - Each wallet is linked to an IDENTITY (userIdHash)
 * - One identity can have MULTIPLE wallets (EOA, Smart Account, etc.)
 * - Roles are assigned to IDENTITIES, not wallets
 * - Any wallet linked to an identity can exercise that identity's roles
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
    require(_isActiveMember(msg.sender), 'Not an active member');
    _;
  }

  modifier onlyVerifiedMember() {
    require(_isVerifiedMember(msg.sender), 'Not a verified member');
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
    NotRegistered, // 0 - Default/uninitialized
    Inactive, // 1 - Cannot transact (banned/removed)
    Active, // 2 - Default for new members
    Verified // 3 - User has verified their identity and email
  }

  // =================== MEMBER REGISTRY - EVENTS ===================

  event MemberRegistered(address indexed wallet, bytes32 indexed userIdHash, uint256 timestamp);

  event WalletLinked(address indexed wallet, bytes32 indexed userIdHash, uint256 timestamp);

  event MemberStatusChanged(
    bytes32 indexed userIdHash,
    MemberStatus oldStatus,
    MemberStatus newStatus,
    address indexed changedBy,
    uint256 timestamp
  );

  // =================== MEMBER REGISTRY - STRUCTURE ===================

  // Wallet's Member info - maps a wallet to its identity (userIdHash)
  struct UserInfo {
    bytes32 userIdHash; // The identity this wallet belongs to
    bool isWalletActive; // Whether this wallet can be used
  }

  // =================== MEMBER REGISTRY - STORAGE ===================

  // Map address to UserIdHash and status (whether wallet is active or not)
  mapping(address => UserInfo) public wallets;

  // map userIdHash with memberStatus
  mapping(bytes32 => MemberStatus) public userStatus;

  // Identity (userIdHash) => list of wallet addresses
  mapping(bytes32 => address[]) public userWallets;

  // For enumeration
  bytes32[] public userList;
  uint256 public totalUsers;

  // =================== MEMBER REGISTRY - FUNCTIONS ===================

  /**
   * @notice Register a new wallet for an identity (can only be called by Admin)
   * @dev If this is the first wallet for this userIdHash, creates the identity
   * @param wallet The wallet address to register
   * @param userIdHash Hash of their off-chain user ID
   */
  function addMember(address wallet, bytes32 userIdHash) external onlyAdmin {
    require(wallet != address(0), 'Invalid wallet address');
    require(userIdHash != bytes32(0), 'Invalid user ID hash');
    require(wallets[wallet].userIdHash == bytes32(0), 'Wallet already registered');

    // Link wallet to user
    wallets[wallet] = UserInfo({ userIdHash: userIdHash, isWalletActive: true });

    // Add to user's's wallet list
    userWallets[userIdHash].push(wallet);

    // If new user, initialize active status
    if (userStatus[userIdHash] == MemberStatus.NotRegistered) {
      userStatus[userIdHash] = MemberStatus.Active;
      userList.push(userIdHash);
      totalUsers++;

      emit MemberRegistered(wallet, userIdHash, block.timestamp);
    } else {
      emit WalletLinked(wallet, userIdHash, block.timestamp);
    }
  }

  /**
   * @notice Change an identity's status (affects all their wallets)
   * @param userIdHash The identity to update
   * @param newStatus The new status
   */
  function setUserStatus(bytes32 userIdHash, MemberStatus newStatus) external onlyAdmin {
    require(userStatus[userIdHash] != MemberStatus.NotRegistered, 'User not registered');

    MemberStatus oldStatus = userStatus[userIdHash];
    require(oldStatus != newStatus, 'Already this status');

    userStatus[userIdHash] = newStatus;

    emit MemberStatusChanged(userIdHash, oldStatus, newStatus, msg.sender, block.timestamp);
  }

  /**
   * @notice Deactivate a specific wallet (not the whole user)
   * @param wallet The wallet to deactivate
   */
  function deactivateWallet(address wallet) external onlyAdmin {
    require(wallets[wallet].userIdHash != bytes32(0), 'Wallet not registered');
    require(wallets[wallet].isWalletActive, 'Wallet already inactive');

    wallets[wallet].isWalletActive = false;
  }

  /**
   * @notice Reactivate a specific wallet
   * @param wallet The wallet to reactivate
   */
  function reactivateWallet(address wallet) external onlyAdmin {
    require(wallets[wallet].userIdHash != bytes32(0), 'Wallet not registered');
    require(!wallets[wallet].isWalletActive, 'Wallet already active');

    wallets[wallet].isWalletActive = true;
  }

  // =================== MEMBER REGISTRY - VIEW FUNCTIONS ===================

  /**
   * @notice Check if wallet belongs to an active member
   */
  function isActiveMember(address wallet) external view override returns (bool) {
    return _isActiveMember(wallet);
  }

  function _isActiveMember(address wallet) internal view returns (bool) {
    bytes32 userIdHash = wallets[wallet].userIdHash;
    if (userIdHash == bytes32(0) || !wallets[wallet].isWalletActive) return false;

    MemberStatus status = userStatus[userIdHash];
    return status != MemberStatus.Inactive && status != MemberStatus.NotRegistered;
  }

  /**
   * @notice Check if wallet belongs to a verified member
   */
  function isVerifiedMember(address wallet) external view override returns (bool) {
    return _isVerifiedMember(wallet);
  }

  function _isVerifiedMember(address wallet) internal view returns (bool) {
    bytes32 userIdHash = wallets[wallet].userIdHash;
    if (userIdHash == bytes32(0) || !wallets[wallet].isWalletActive) return false;

    return userStatus[userIdHash] == MemberStatus.Verified;
  }

  /**
   * @notice Get the identity (userIdHash) for a wallet
   */
  function getUserForWallet(address wallet) external view returns (bytes32) {
    return wallets[wallet].userIdHash;
  }

  /**
   * @notice Get all wallets for an identity
   */
  function getWalletsForUser(bytes32 userIdHash) external view returns (address[] memory) {
    return userWallets[userIdHash];
  }

  /**
   * @notice Get user status (not registered, inactive, active, verified)
   */
  function getUserStatus(bytes32 userIdHash) external view returns (MemberStatus status) {
    return userStatus[userIdHash];
  }

  /**
   * @notice Get all Users
   */
  function getAllUsers() external view returns (bytes32[] memory) {
    return userList;
  }

  /**
   * @notice Get total number of identities
   */
  function getTotalUsers() external view returns (uint256) {
    return totalUsers;
  }

  // ===============================================================
  // ROLE MANAGEMENT
  // ===============================================================

  // =================== ROLE MANAGEMENT - EVENTS ===================

  event RoleGranted(
    string indexed recordId,
    bytes32 indexed targetIdHash,
    string role,
    bytes32 indexed userIdHash,
    uint256 timestamp
  );

  event RoleChanged(
    string indexed recordId,
    bytes32 indexed targetIdHash,
    string oldRole,
    string newRole,
    bytes32 indexed userIdHash,
    uint256 timestamp
  );

  event RoleRevoked(
    string indexed recordId,
    bytes32 indexed targetIdHash,
    string role,
    bytes32 indexed userIdHash,
    uint256 timestamp
  );

  event OwnershipVoluntarilyLeft(
    string indexed recordId,
    bytes32 indexed userIdHash,
    uint256 timestamp
  );

  // =================== ROLE MANAGEMENT - STRUCTURE ===================

  struct RecordRole {
    string role; // "owner", "administrator", "viewer"
    bool isActive;
  }

  // =================== ROLE MANAGEMENT - STORAGE ===================

  // hash of recordId and userIdHash => RecordRole
  mapping(bytes32 => RecordRole) public recordRoles;

  // recordId => list of identity hashes with each role type
  mapping(string => bytes32[]) public ownersByRecord;
  mapping(string => bytes32[]) public adminsByRecord;
  mapping(string => bytes32[]) public viewersByRecord;

  // userIdHash => list of recordIds where they have a role
  mapping(bytes32 => string[]) public recordsByUser;

  uint256 public totalRoles;

  // =================== ROLE MANAGEMENT - INTERNAL HELPERS ===================

  /**
   * @dev Get the role key for a (recordId, userIdHash) pair
   */
  function _getRoleKey(string memory recordId, bytes32 userIdHash) internal pure returns (bytes32) {
    return keccak256(abi.encodePacked(recordId, userIdHash));
  }

  /**
   * @dev Get caller's identity hash
   */
  function _getCallerIdHash() internal view returns (bytes32) {
    return wallets[msg.sender].userIdHash;
  }

  /**
   * @dev Makes sure the role is a valid role
   */
  function _isValidRole(string memory role) internal pure returns (bool) {
    bytes32 h = keccak256(bytes(role));
    return (h == keccak256(bytes('owner')) ||
      h == keccak256(bytes('administrator')) ||
      h == keccak256(bytes('viewer')));
  }

  function _grantRoleInternal(
    string memory recordId,
    bytes32 targetIdHash,
    string memory role,
    bytes32 userIdHash
  ) internal {
    bytes32 roleKey = _getRoleKey(recordId, targetIdHash);

    RecordRole storage currentEntry = recordRoles[roleKey];
    string memory oldRole = currentEntry.role;
    bool hasExistingEntry = bytes(oldRole).length > 0;
    bool isCurrentlyActive = currentEntry.isActive;

    recordRoles[roleKey] = RecordRole({ role: role, isActive: true });

    if (!isCurrentlyActive) {
      _addToRoleArray(recordId, targetIdHash, role);

      if (!hasExistingEntry) {
        recordsByUser[targetIdHash].push(recordId);
        totalRoles++;
      }
      emit RoleGranted(recordId, targetIdHash, role, userIdHash, block.timestamp);
    } else {
      if (keccak256(bytes(oldRole)) != keccak256(bytes(role))) {
        _removeFromRoleArray(recordId, targetIdHash, oldRole);
        _addToRoleArray(recordId, targetIdHash, role);
      }
    }
  }

  function _addToRoleArray(
    string memory recordId,
    bytes32 userIdHash,
    string memory role
  ) internal {
    bytes32 roleHash = keccak256(bytes(role));

    if (roleHash == keccak256(bytes('owner'))) {
      ownersByRecord[recordId].push(userIdHash);
    } else if (roleHash == keccak256(bytes('administrator'))) {
      adminsByRecord[recordId].push(userIdHash);
    } else if (roleHash == keccak256(bytes('viewer'))) {
      viewersByRecord[recordId].push(userIdHash);
    }
  }

  function _removeFromRoleArray(
    string memory recordId,
    bytes32 userIdHash,
    string memory role
  ) internal {
    bytes32 roleHash = keccak256(bytes(role));

    if (roleHash == keccak256(bytes('owner'))) {
      _removeFromBytes32Array(ownersByRecord[recordId], userIdHash);
    } else if (roleHash == keccak256(bytes('administrator'))) {
      _removeFromBytes32Array(adminsByRecord[recordId], userIdHash);
    } else if (roleHash == keccak256(bytes('viewer'))) {
      _removeFromBytes32Array(viewersByRecord[recordId], userIdHash);
    }
  }

  function _removeFromBytes32Array(bytes32[] storage array, bytes32 toRemove) internal {
    for (uint256 i = 0; i < array.length; i++) {
      if (array[i] == toRemove) {
        array[i] = array[array.length - 1];
        array.pop();
        break;
      }
    }
  }

  function _hasActiveRole(string memory recordId, bytes32 userIdHash) internal view returns (bool) {
    bytes32 roleKey = _getRoleKey(recordId, userIdHash);
    return recordRoles[roleKey].isActive;
  }

  function _hasRole(
    string memory recordId,
    bytes32 userIdHash,
    string memory role
  ) internal view returns (bool) {
    bytes32 roleKey = _getRoleKey(recordId, userIdHash);
    RecordRole memory r = recordRoles[roleKey];
    return r.isActive && keccak256(bytes(r.role)) == keccak256(bytes(role));
  }

  function _isOwnerOrAdmin(
    string memory recordId,
    bytes32 userIdHash
  ) internal view returns (bool) {
    return
      _hasRole(recordId, userIdHash, 'owner') || _hasRole(recordId, userIdHash, 'administrator');
  }

  // =================== ROLE MANAGEMENT - EXTERNAL FUNCTIONS ===================

  /**
   * @notice Admin establishes first role (administrator or owner) on a new record
   * @param recordId The record ID
   * @param targetWallet A wallet address belonging to the user to assign the role to
   * @param role The role to assign ("administrator" or "owner")
   */
  function initializeRecordRole(
    string memory recordId,
    address targetWallet,
    string memory role
  ) external onlyAdmin {
    require(bytes(recordId).length > 0, 'Record ID cannot be empty');
    require(targetWallet != address(0), 'Invalid wallet address');
    require(_isValidRole(role), 'Invalid role string');

    // Get the identity for this wallet
    bytes32 targetIdHash = wallets[targetWallet].userIdHash;
    require(targetIdHash != bytes32(0), 'Wallet not registered');
    require(_isActiveMember(targetWallet), 'Must be an active member');

    require(
      ownersByRecord[recordId].length == 0 && adminsByRecord[recordId].length == 0,
      'Record already initialized'
    );

    _grantRoleInternal(recordId, targetIdHash, role, bytes32(0)); // bytes32(0) = admin
  }

  /**
   * @notice Grant a role to a user for a specific record
   * @param recordId The record ID
   * @param targetWallet A wallet address belonging to the target user
   * @param role The role to grant ("owner", "administrator", "viewer")
   */
  function grantRole(
    string memory recordId,
    address targetWallet,
    string memory role
  ) external onlyActiveMember {
    require(bytes(recordId).length > 0, 'Record ID cannot be empty');
    require(targetWallet != address(0), 'Wallet address cannot be zero');
    require(_isValidRole(role), 'Invalid role string');

    // Get identities
    bytes32 userIdHash = _getCallerIdHash();
    bytes32 targetIdHash = wallets[targetWallet].userIdHash;
    require(targetIdHash != bytes32(0), 'Target wallet not registered');

    bytes32 roleHash = keccak256(bytes(role));

    require(_hasActiveRole(recordId, userIdHash), 'You have no role for this record');

    bool ownerExists = ownersByRecord[recordId].length > 0;
    bool userIsOwner = _hasRole(recordId, userIdHash, 'owner');
    bool userIsAdmin = _hasRole(recordId, userIdHash, 'administrator');

    if (roleHash == keccak256(bytes('owner'))) {
      if (ownerExists) {
        require(userIsOwner, 'Only owners can grant owner role');
      } else {
        require(userIsAdmin, 'Only administrators can grant first owner');
      }
    } else if (roleHash == keccak256(bytes('administrator'))) {
      require(
        userIsOwner || userIsAdmin,
        'Only owners and administrators can grant administrator role'
      );
    } else if (roleHash == keccak256(bytes('viewer'))) {
      require(userIsOwner || userIsAdmin, 'Only owners and administrators can grant viewer role');
    }

    require(
      !_hasActiveRole(recordId, targetIdHash),
      'Target already has a role. Use changeRole() instead'
    );

    _grantRoleInternal(recordId, targetIdHash, role, userIdHash);
  }

  /**
   * @notice Change a user's existing role to a different role
   * @param recordId The record ID
   * @param targetWallet A wallet address belonging to the target user
   * @param newRole The new role ("owner", "administrator", "viewer")
   */
  function changeRole(
    string memory recordId,
    address targetWallet,
    string memory newRole
  ) external onlyActiveMember {
    require(bytes(recordId).length > 0, 'Record ID cannot be empty');
    require(targetWallet != address(0), 'Wallet address cannot be zero');
    require(_isValidRole(newRole), 'Invalid role string');

    bytes32 userIdHash = _getCallerIdHash();
    bytes32 targetIdHash = wallets[targetWallet].userIdHash;
    require(targetIdHash != bytes32(0), 'Target wallet not registered');

    bytes32 newRoleHash = keccak256(bytes(newRole));

    bytes32 targetRoleKey = _getRoleKey(recordId, targetIdHash);
    require(recordRoles[targetRoleKey].isActive, 'Target does not have an active role');

    string memory oldRole = recordRoles[targetRoleKey].role;
    bytes32 oldRoleHash = keccak256(bytes(oldRole));

    require(oldRoleHash != newRoleHash, 'Target already has this role');
    require(
      oldRoleHash != keccak256(bytes('owner')),
      'Owners cannot be demoted. Owner must voluntarily remove themselves.'
    );

    bool ownerExists = ownersByRecord[recordId].length > 0;
    bool userIsOwner = _hasRole(recordId, userIdHash, 'owner');
    bool userIsAdmin = _hasRole(recordId, userIdHash, 'administrator');
    bool userIsTarget = userIdHash == targetIdHash;

    if (newRoleHash == keccak256(bytes('owner'))) {
      if (ownerExists) {
        require(userIsOwner, 'Only owners can promote to owner');
      } else {
        require(userIsAdmin, 'Only administrators can promote first owner');
      }
    } else if (newRoleHash == keccak256(bytes('administrator'))) {
      require(
        userIsOwner || userIsAdmin,
        'Only owners and administrators can promote to administrator'
      );
    } else if (newRoleHash == keccak256(bytes('viewer'))) {
      if (ownerExists) {
        require(
          userIsOwner || (userIsAdmin && userIsTarget),
          'Only owners can demote others. Administrators can only demote themselves.'
        );
      } else {
        require(userIsAdmin, 'Only administrators can demote to viewer');
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

    _grantRoleInternal(recordId, targetIdHash, newRole, userIdHash);

    emit RoleChanged(recordId, targetIdHash, oldRole, newRole, userIdHash, block.timestamp);
  }

  /**
   * @notice Allows an owner to voluntarily give up their ownership
   * @param recordId The record ID
   */
  function voluntarilyLeaveOwnership(string memory recordId) external {
    require(bytes(recordId).length > 0, 'Record ID cannot be empty');

    bytes32 userIdHash = _getCallerIdHash();
    require(_hasRole(recordId, userIdHash, 'owner'), 'You are not an owner of this record');

    bool hasOtherOwners = ownersByRecord[recordId].length > 1;
    bool hasAdmins = adminsByRecord[recordId].length > 0;

    require(hasOtherOwners || hasAdmins, 'Cannot leave as last owner with no administrators');

    bytes32 roleKey = _getRoleKey(recordId, userIdHash);
    _removeFromRoleArray(recordId, userIdHash, 'owner');

    recordRoles[roleKey].isActive = false;

    emit OwnershipVoluntarilyLeft(recordId, userIdHash, block.timestamp);
  }

  /**
   * @notice Revoke a user's role entirely
   * @param recordId The record ID
   * @param targetWallet A wallet address belonging to the target user
   */
  function revokeRole(string memory recordId, address targetWallet) external {
    require(bytes(recordId).length > 0, 'Record ID cannot be empty');
    require(targetWallet != address(0), 'Wallet address cannot be zero');

    bytes32 userIdHash = _getCallerIdHash();
    bytes32 targetIdHash = wallets[targetWallet].userIdHash;
    require(targetIdHash != bytes32(0), 'Target wallet not registered');

    bytes32 targetRoleKey = _getRoleKey(recordId, targetIdHash);
    require(recordRoles[targetRoleKey].isActive, 'Target does not have an active role');

    string memory role = recordRoles[targetRoleKey].role;
    bytes32 roleHash = keccak256(bytes(role));

    require(
      roleHash != keccak256(bytes('owner')),
      'Owners cannot be revoked. Owner must use voluntarilyLeaveOwnership().'
    );

    bool isSelfRevoke = userIdHash == targetIdHash;

    if (!isSelfRevoke) {
      require(
        _isOwnerOrAdmin(recordId, userIdHash),
        'Only owners and administrators can revoke roles'
      );

      bool userIsOwner = _hasRole(recordId, userIdHash, 'owner');

      if (!userIsOwner) {
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

    _removeFromRoleArray(recordId, targetIdHash, role);

    recordRoles[targetRoleKey].isActive = false;

    emit RoleRevoked(recordId, targetIdHash, role, userIdHash, block.timestamp);
  }

  // =================== ROLE MANAGEMENT - VIEW FUNCTIONS ===================

  /**
   * @notice Check if wallet's identity has any active role on a record
   */
  function hasActiveRole(
    string memory recordId,
    address wallet
  ) external view override returns (bool) {
    bytes32 userIdHash = wallets[wallet].userIdHash;
    if (userIdHash == bytes32(0)) return false;
    return _hasActiveRole(recordId, userIdHash);
  }

  /**
   * @notice Check if wallet's identity has a specific role
   */
  function hasRole(
    string memory recordId,
    address wallet,
    string memory role
  ) external view override returns (bool) {
    bytes32 userIdHash = wallets[wallet].userIdHash;
    if (userIdHash == bytes32(0)) return false;
    return _hasRole(recordId, userIdHash, role);
  }

  /**
   * @notice Check if wallet's identity is owner or administrator
   */
  function isOwnerOrAdmin(
    string memory recordId,
    address wallet
  ) external view override returns (bool) {
    bytes32 userIdHash = wallets[wallet].userIdHash;
    if (userIdHash == bytes32(0)) return false;
    return _isOwnerOrAdmin(recordId, userIdHash);
  }

  /**
   * @notice Get full role details by wallet
   */
  function getRoleDetails(
    string memory recordId,
    address wallet
  ) external view returns (string memory role, bool isActive) {
    bytes32 userIdHash = wallets[wallet].userIdHash;
    if (userIdHash == bytes32(0)) {
      return ('', false);
    }
    bytes32 roleKey = _getRoleKey(recordId, userIdHash);
    RecordRole memory r = recordRoles[roleKey];
    return (r.role, r.isActive);
  }

  /**
   * @notice Get full role details by identity
   */
  function getRoleDetailsByUser(
    string memory recordId,
    bytes32 userIdHash
  ) external view returns (string memory role, bool isActive) {
    bytes32 roleKey = _getRoleKey(recordId, userIdHash);
    RecordRole memory r = recordRoles[roleKey];
    return (r.role, r.isActive);
  }

  /**
   * @notice Get all owner identities of a record
   */
  function getRecordOwners(string memory recordId) external view returns (bytes32[] memory) {
    return ownersByRecord[recordId];
  }

  /**
   * @notice Get all admin identities of a record
   */
  function getRecordAdmins(string memory recordId) external view returns (bytes32[] memory) {
    return adminsByRecord[recordId];
  }

  /**
   * @notice Get all viewer identities of a record
   */
  function getRecordViewers(string memory recordId) external view returns (bytes32[] memory) {
    return viewersByRecord[recordId];
  }

  /**
   * @notice Get all records where a user has any role
   */
  function getRecordsByUser(bytes32 userIdHash) external view returns (string[] memory) {
    return recordsByUser[userIdHash];
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

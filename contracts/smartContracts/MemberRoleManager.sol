// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title MemberRoleManagerInterface
 * @dev Interface for HealthRecordCore to reference
 */
interface MemberRoleManagerInterface {
  function isActiveMember(address wallet) external view returns (bool);

  function isVerifiedMember(address wallet) external view returns (bool);

  function isVerifiedProvider(address wallet) external view returns (bool);

  function hasActiveRole(string memory recordId, address wallet) external view returns (bool);

  function hasRole(
    string memory recordId,
    address wallet,
    string memory role
  ) external view returns (bool);

  function isOwnerOrAdmin(string memory recordId, address wallet) external view returns (bool);

  function getUserForWallet(address wallet) external view returns (bytes32);

  function isControllerOf(
    bytes32 trustorIdHash,
    bytes32 controllerIdHash
  ) external view returns (bool);
}

/**
 * @title HealthRecordCoreInterface
 * @dev Interface for MemberRoleManager to check subject status
 */
interface HealthRecordCoreInterface {
  function isActiveSubject(string memory recordId, bytes32 userIdHash) external view returns (bool);
}

/**
 * @title MemberRoleManager
 * @dev Manages multi-wallet member registration and role-based access control.
 * @dev Upgradeable version using uups proxy pattern
 *
 * KEY ARCHITECTURE:
 * - Members are registered by WALLET ADDRESS
 * - Each wallet is linked to an IDENTITY (userIdHash)
 * - One identity can have MULTIPLE wallets (EOA, Smart Account, etc.)
 * - Roles are assigned to IDENTITIES, not wallets
 * - Any wallet linked to an identity can exercise that identity's roles
 */
contract MemberRoleManager is Initializable, UUPSUpgradeable, MemberRoleManagerInterface {
  // ===============================================================
  // ADMIN MANAGEMENT
  // ===============================================================
  address public admin;

  event AdminTransferred(address indexed oldAdmin, address indexed newAdmin, uint256 timestamp);

  modifier onlyAdmin() {
    require(msg.sender == admin, "Only admin");
    _;
  }

  modifier onlyActiveMember() {
    require(_isActiveMember(msg.sender), "Not an active member");
    _;
  }

  modifier onlyVerifiedMember() {
    require(_isVerifiedMember(msg.sender), "Not a verified member");
    _;
  }

  modifier onlyVerifiedProvider() {
    require(_isVerifiedProvider(msg.sender), "Not a verified provider");
    _;
  }

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  /**
   * @notice Initialize the contract (replaces constructor)
   * @dev Can only be called once during proxy deployment
   */
  function initialize() public initializer {
    admin = msg.sender;
  }

  /**
   * @notice Authorize contract upgrades
   * @dev Only admin can upgrade the contract
   */
  function _authorizeUpgrade(address newImplementation) internal override onlyAdmin {}

  function transferAdmin(address newAdmin) external onlyAdmin {
    require(newAdmin != address(0), "Invalid address");
    emit AdminTransferred(admin, newAdmin, block.timestamp);
    admin = newAdmin;
  }

  /**
   * @notice Update the HealthRecordCore reference
   * @dev Only admin can update this
   * @param _healthRecordCore Address of the HealthRecordCore contract
   */
  function setHealthRecordCore(address _healthRecordCore) external onlyAdmin {
    require(_healthRecordCore != address(0), "Invalid address");
    healthRecordCore = HealthRecordCoreInterface(_healthRecordCore);
    emit HealthRecordCoreUpdated(_healthRecordCore, block.timestamp);
  }

  // ===============================================================
  // MEMBER REGISTRY
  // ===============================================================

  // =================== MEMBER REGISTRY - ENUMS ===================

  enum MemberStatus {
    NotRegistered, // 0 - Default/uninitialized
    Inactive, // 1 - Cannot transact (banned/removed)
    Active, // 2 - Default for new members
    Verified, // 3 - User has verified their identity and email
    VerifiedProvider, // 4 - User is a verified healthcare provider
    Guest //5 - User is a guest with limited access, linked to a verified member
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
    require(wallet != address(0), "Invalid wallet address");
    require(userIdHash != bytes32(0), "Invalid user ID hash");
    require(wallets[wallet].userIdHash == bytes32(0), "Wallet already registered");

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
    require(userStatus[userIdHash] != MemberStatus.NotRegistered, "User not registered");

    MemberStatus oldStatus = userStatus[userIdHash];
    require(oldStatus != newStatus, "Already this status");

    userStatus[userIdHash] = newStatus;

    emit MemberStatusChanged(userIdHash, oldStatus, newStatus, msg.sender, block.timestamp);
  }

  /**
   * @notice Deactivate a specific wallet (not the whole user)
   * @param wallet The wallet to deactivate
   */
  function deactivateWallet(address wallet) external onlyAdmin {
    require(wallets[wallet].userIdHash != bytes32(0), "Wallet not registered");
    require(wallets[wallet].isWalletActive, "Wallet already inactive");

    wallets[wallet].isWalletActive = false;
  }

  /**
   * @notice Reactivate a specific wallet
   * @param wallet The wallet to reactivate
   */
  function reactivateWallet(address wallet) external onlyAdmin {
    require(wallets[wallet].userIdHash != bytes32(0), "Wallet not registered");
    require(!wallets[wallet].isWalletActive, "Wallet already active");

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
    return
      status == MemberStatus.Active ||
      status == MemberStatus.Verified ||
      status == MemberStatus.VerifiedProvider;
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
   * @notice Check if wallet belongs to a verified healthcare provider
   */
  function isVerifiedProvider(address wallet) external view override returns (bool) {
    return _isVerifiedProvider(wallet);
  }

  function _isVerifiedProvider(address wallet) internal view returns (bool) {
    bytes32 userIdHash = wallets[wallet].userIdHash;
    if (userIdHash == bytes32(0) || !wallets[wallet].isWalletActive) return false;

    return userStatus[userIdHash] == MemberStatus.VerifiedProvider;
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

  event HealthRecordCoreUpdated(address indexed newAddress, uint256 timestamp);

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

  HealthRecordCoreInterface public healthRecordCore;
  mapping(bytes32 => bytes32) public roleGrantedBy;

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
    return (h == keccak256(bytes("owner")) ||
      h == keccak256(bytes("administrator")) ||
      h == keccak256(bytes("viewer")));
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
    roleGrantedBy[roleKey] = userIdHash;

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

    if (roleHash == keccak256(bytes("owner"))) {
      ownersByRecord[recordId].push(userIdHash);
    } else if (roleHash == keccak256(bytes("administrator"))) {
      adminsByRecord[recordId].push(userIdHash);
    } else if (roleHash == keccak256(bytes("viewer"))) {
      viewersByRecord[recordId].push(userIdHash);
    }
  }

  function _removeFromRoleArray(
    string memory recordId,
    bytes32 userIdHash,
    string memory role
  ) internal {
    bytes32 roleHash = keccak256(bytes(role));

    if (roleHash == keccak256(bytes("owner"))) {
      _removeFromBytes32Array(ownersByRecord[recordId], userIdHash);
    } else if (roleHash == keccak256(bytes("administrator"))) {
      _removeFromBytes32Array(adminsByRecord[recordId], userIdHash);
    } else if (roleHash == keccak256(bytes("viewer"))) {
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
      _hasRole(recordId, userIdHash, "owner") || _hasRole(recordId, userIdHash, "administrator");
  }

  /**
   * @dev Check if user is an active subject via HealthRecordCore
   * @dev Returns false if healthRecordCore is not set
   */
  function _isActiveSubject(
    string memory recordId,
    bytes32 userIdHash
  ) internal view returns (bool) {
    if (address(healthRecordCore) == address(0)) return false;
    return healthRecordCore.isActiveSubject(recordId, userIdHash);
  }

  /**
   * @dev Get user's current role (returns empty string if no role)
   */
  function _getUserRole(
    string memory recordId,
    bytes32 userIdHash
  ) internal view returns (string memory) {
    bytes32 roleKey = _getRoleKey(recordId, userIdHash);
    RecordRole memory r = recordRoles[roleKey];
    return r.isActive ? r.role : "";
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
    require(bytes(recordId).length > 0, "Record ID cannot be empty");
    require(targetWallet != address(0), "Invalid wallet address");
    require(_isValidRole(role), "Invalid role string");

    // Get the identity for this wallet
    bytes32 targetIdHash = wallets[targetWallet].userIdHash;
    require(targetIdHash != bytes32(0), "Wallet not registered");
    require(_isActiveMember(targetWallet), "Must be an active member");

    require(
      ownersByRecord[recordId].length == 0 && adminsByRecord[recordId].length == 0,
      "Record already initialized"
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
    require(bytes(recordId).length > 0, "Record ID cannot be empty");
    require(targetWallet != address(0), "Wallet address cannot be zero");
    require(_isValidRole(role), "Invalid role string");

    // Get identities
    bytes32 userIdHash = _getCallerIdHash();
    bytes32 targetIdHash = wallets[targetWallet].userIdHash;
    require(targetIdHash != bytes32(0), "Target wallet not registered");

    bytes32 roleHash = keccak256(bytes(role));

    require(_hasActiveRole(recordId, userIdHash), "You have no role for this record");

    bool ownerExists = ownersByRecord[recordId].length > 0;
    bool userIsOwner = _hasRole(recordId, userIdHash, "owner");
    bool userIsAdmin = _hasRole(recordId, userIdHash, "administrator");
    bool userIsSubject = _isActiveSubject(recordId, userIdHash);

    if (roleHash == keccak256(bytes("owner"))) {
      if (ownerExists) {
        require(userIsOwner, "Only owners can grant owner role");
      } else {
        require(userIsAdmin, "Only administrators can grant first owner");
      }
    } else if (roleHash == keccak256(bytes("administrator"))) {
      require(
        userIsOwner || userIsAdmin,
        "Only owners and administrators can grant administrator role"
      );
    } else if (roleHash == keccak256(bytes("viewer"))) {
      require(
        userIsOwner || userIsAdmin || userIsSubject,
        "Only owners, administrators, or subjects can grant viewer role"
      );

      if (userIsSubject && !userIsOwner && !userIsAdmin) {
        string memory userRole = _getUserRole(recordId, userIdHash);
        require(
          bytes(userRole).length > 0,
          "Subject must have an active role to grant viewer permissions"
        );
      }
    }

    require(
      !_hasActiveRole(recordId, targetIdHash),
      "Target already has a role. Use changeRole() instead"
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
    require(bytes(recordId).length > 0, "Record ID cannot be empty");
    require(targetWallet != address(0), "Wallet address cannot be zero");
    require(_isValidRole(newRole), "Invalid role string");

    bytes32 userIdHash = _getCallerIdHash();
    bytes32 targetIdHash = wallets[targetWallet].userIdHash;
    require(targetIdHash != bytes32(0), "Target wallet not registered");

    bytes32 newRoleHash = keccak256(bytes(newRole));

    bytes32 targetRoleKey = _getRoleKey(recordId, targetIdHash);
    require(recordRoles[targetRoleKey].isActive, "Target does not have an active role");

    string memory oldRole = recordRoles[targetRoleKey].role;
    bytes32 oldRoleHash = keccak256(bytes(oldRole));

    require(oldRoleHash != newRoleHash, "Target already has this role");
    require(
      oldRoleHash != keccak256(bytes("owner")),
      "Owners cannot be demoted. Owner must voluntarily remove themselves."
    );

    bool ownerExists = ownersByRecord[recordId].length > 0;
    bool userIsOwner = _hasRole(recordId, userIdHash, "owner");
    bool userIsAdmin = _hasRole(recordId, userIdHash, "administrator");
    bool userIsTarget = userIdHash == targetIdHash;

    if (newRoleHash == keccak256(bytes("owner"))) {
      if (ownerExists) {
        require(userIsOwner, "Only owners can promote to owner");
      } else {
        require(userIsAdmin, "Only administrators can promote first owner");
      }
    } else if (newRoleHash == keccak256(bytes("administrator"))) {
      require(
        userIsOwner || userIsAdmin,
        "Only owners and administrators can promote to administrator"
      );
    } else if (newRoleHash == keccak256(bytes("viewer"))) {
      if (ownerExists) {
        require(
          userIsOwner || (userIsAdmin && userIsTarget),
          "Only owners can demote others. Administrators can only demote themselves."
        );
      } else {
        require(userIsAdmin, "Only administrators can demote to viewer");
      }
    }

    if (
      oldRoleHash == keccak256(bytes("administrator")) && newRoleHash == keccak256(bytes("viewer"))
    ) {
      if (!ownerExists) {
        require(
          adminsByRecord[recordId].length > 1,
          "Cannot demote the last administrator when no owner exists"
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
    require(bytes(recordId).length > 0, "Record ID cannot be empty");

    bytes32 userIdHash = _getCallerIdHash();
    require(_hasRole(recordId, userIdHash, "owner"), "You are not an owner of this record");

    bool hasOtherOwners = ownersByRecord[recordId].length > 1;
    bool hasAdmins = adminsByRecord[recordId].length > 0;

    require(hasOtherOwners || hasAdmins, "Cannot leave as last owner with no administrators");

    bytes32 roleKey = _getRoleKey(recordId, userIdHash);
    _removeFromRoleArray(recordId, userIdHash, "owner");

    recordRoles[roleKey].isActive = false;
    delete roleGrantedBy[roleKey];

    emit OwnershipVoluntarilyLeft(recordId, userIdHash, block.timestamp);
  }

  /**
   * @notice Revoke a user's role entirely
   * @param recordId The record ID
   * @param targetWallet A wallet address belonging to the target user
   */
  function revokeRole(string memory recordId, address targetWallet) external {
    require(bytes(recordId).length > 0, "Record ID cannot be empty");
    require(targetWallet != address(0), "Wallet address cannot be zero");

    bytes32 userIdHash = _getCallerIdHash();
    bytes32 targetIdHash = wallets[targetWallet].userIdHash;
    require(targetIdHash != bytes32(0), "Target wallet not registered");

    bytes32 targetRoleKey = _getRoleKey(recordId, targetIdHash);
    require(recordRoles[targetRoleKey].isActive, "Target does not have an active role");

    string memory role = recordRoles[targetRoleKey].role;
    bytes32 roleHash = keccak256(bytes(role));

    require(
      roleHash != keccak256(bytes("owner")),
      "Owners cannot be revoked. Owner must use voluntarilyLeaveOwnership()."
    );

    bool isSelfRevoke = userIdHash == targetIdHash;

    if (!isSelfRevoke) {
      bool userIsOwner = _hasRole(recordId, userIdHash, "owner");
      bool userIsAdmin = _hasRole(recordId, userIdHash, "administrator");
      bytes32 grantedBy = roleGrantedBy[targetRoleKey];
      bool userGrantedThisRole = (grantedBy == userIdHash);

      if (roleHash == keccak256(bytes("viewer"))) {
        require(
          userIsOwner || userIsAdmin || userGrantedThisRole,
          "Only owners, administrators, or the granter can revoke viewers"
        );
      } else {
        require(userIsOwner || userIsAdmin, "Only owners and administrators can revoke roles");

        if (!userIsOwner) {
          bool targetIsAdmin = roleHash == keccak256(bytes("administrator"));

          if (targetIsAdmin) {
            bool ownerExists = ownersByRecord[recordId].length > 0;
            require(!ownerExists, "Only owners can revoke administrators");
          }
        }
      }
    }

    if (roleHash == keccak256(bytes("administrator"))) {
      bool hasOtherAdmins = adminsByRecord[recordId].length > 1;
      bool ownerExists = ownersByRecord[recordId].length > 0;

      require(
        hasOtherAdmins || ownerExists,
        "Cannot revoke last administrator without an owner present"
      );
    }

    _removeFromRoleArray(recordId, targetIdHash, role);
    recordRoles[targetRoleKey].isActive = false;
    delete roleGrantedBy[targetRoleKey];

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
      return ("", false);
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

  /**
   * @notice Check if a user is an active subject of a record
   * @dev This is a convenience function that calls HealthRecordCore
   */
  function isActiveSubject(
    string memory recordId,
    bytes32 userIdHash
  ) external view returns (bool) {
    return _isActiveSubject(recordId, userIdHash);
  }

  /**
   * @notice Get the HealthRecordCore address
   */
  function getHealthRecordCore() external view returns (address) {
    return address(healthRecordCore);
  }

  /**
   * @notice Get who granted a specific role
   */
  function getRoleGranter(
    string memory recordId,
    bytes32 userIdHash
  ) external view returns (bytes32) {
    bytes32 roleKey = _getRoleKey(recordId, userIdHash);
    return roleGrantedBy[roleKey];
  }

  // ===============================================================
  // TRUSTEE RELATIONSHIPS
  // ===============================================================

  // =================== TRUSTEE - ENUMS ===================

  enum TrusteeLevel {
    Observer, // 0 - Read only, always gets viewer role
    Custodian, // 1 - Mirrors trustor role, capped at administrator
    Controller // 2 - Mirrors trustor role fully, including owner
  }

  enum TrusteeStatus {
    None, // 0 - Default/non-existent
    Pending, // 1 - Trustor proposed, awaiting trustee acceptance
    Active, // 2 - Trustee accepted, relationship is live
    Revoked // 3 - Either party ended the relationship
  }

  // =================== TRUSTEE - STORAGE ===================

  struct TrusteeRelationship {
    TrusteeStatus status;
    TrusteeLevel level;
  }

  // trustorIdHash => trusteeIdHash => TrusteeRelationship
  mapping(bytes32 => mapping(bytes32 => TrusteeRelationship)) public trusteeRelationships;

  //==================== TRUSTEE - EVENTS ====================
  event TrusteeProposed(
    bytes32 indexed trustorIdHash,
    bytes32 indexed trusteeIdHash,
    TrusteeLevel level,
    uint256 timestamp
  );
  event TrusteeAccepted(
    bytes32 indexed trustorIdHash,
    bytes32 indexed trusteeIdHash,
    TrusteeLevel level,
    uint256 timestamp
  );
  event TrusteeRevoked(
    bytes32 indexed trustorIdHash,
    bytes32 indexed trusteeIdHash,
    bytes32 indexed revokedBy,
    uint256 timestamp
  );
  event TrusteeLevelUpdated(
    bytes32 indexed trustorIdHash,
    bytes32 indexed trusteeIdHash,
    TrusteeLevel oldLevel,
    TrusteeLevel newLevel,
    uint256 timestamp
  );

  // =================== TRUSTEE - FUNCTIONS ===================

  /**
   * @notice Trustor proposes a trustee relationship (Step 1)
   * @param trusteeIdHash The identity hash of the proposed trustee
   * @param level The trust level (0=Observer, 1=Custodian, 2=Controller)
   */
  function proposeTrustee(bytes32 trusteeIdHash, TrusteeLevel level) external onlyActiveMember {
    bytes32 trustorIdHash = _getCallerIdHash();
    require(trusteeIdHash != bytes32(0), "Invalid trustee");
    require(trustorIdHash != trusteeIdHash, "Cannot appoint yourself");
    require(userStatus[trusteeIdHash] != MemberStatus.NotRegistered, "Trustee not registered");

    TrusteeStatus currentStatus = trusteeRelationships[trustorIdHash][trusteeIdHash].status;
    require(
      currentStatus == TrusteeStatus.None || currentStatus == TrusteeStatus.Revoked,
      "Proposal already exists"
    );

    trusteeRelationships[trustorIdHash][trusteeIdHash] = TrusteeRelationship({
      status: TrusteeStatus.Pending,
      level: level
    });

    emit TrusteeProposed(trustorIdHash, trusteeIdHash, level, block.timestamp);
  }

  /**
   * @notice Trustee accepts a pending proposal (Step 2)
   * @param trustorIdHash The identity hash of the trustor who proposed
   */
  function acceptTrustee(bytes32 trustorIdHash) external onlyActiveMember {
    bytes32 trusteeIdHash = _getCallerIdHash();
    TrusteeRelationship storage r = trusteeRelationships[trustorIdHash][trusteeIdHash];

    require(r.status == TrusteeStatus.Pending, "No pending proposal");

    r.status = TrusteeStatus.Active;

    emit TrusteeAccepted(trustorIdHash, trusteeIdHash, r.level, block.timestamp);
  }

  /**
   * @notice Revoke a trustee relationship — callable by either party
   * @param trustorIdHash The trustor's identity hash
   * @param trusteeIdHash The trustee's identity hash
   */
  function revokeTrustee(bytes32 trustorIdHash, bytes32 trusteeIdHash) external onlyActiveMember {
    bytes32 callerIdHash = _getCallerIdHash();
    require(
      callerIdHash == trustorIdHash || callerIdHash == trusteeIdHash,
      "Not a party to this relationship"
    );

    TrusteeStatus currentStatus = trusteeRelationships[trustorIdHash][trusteeIdHash].status;
    require(
      currentStatus == TrusteeStatus.Active || currentStatus == TrusteeStatus.Pending,
      "No active or pending relationship"
    );

    trusteeRelationships[trustorIdHash][trusteeIdHash].status = TrusteeStatus.Revoked;

    emit TrusteeRevoked(trustorIdHash, trusteeIdHash, callerIdHash, block.timestamp);
  }

  /**
   * @notice Trustor updates the trust level of an active relationship
   * @dev Only callable by the trustor — no re-acceptance required
   * @param trusteeIdHash The identity hash of the trustee
   * @param newLevel The new trust level
   */
  function updateTrusteeLevel(
    bytes32 trusteeIdHash,
    TrusteeLevel newLevel
  ) external onlyActiveMember {
    bytes32 trustorIdHash = _getCallerIdHash();
    TrusteeRelationship storage r = trusteeRelationships[trustorIdHash][trusteeIdHash];

    require(r.status == TrusteeStatus.Active, "No active trustee relationship");
    require(r.level != newLevel, "Already this trust level");

    TrusteeLevel oldLevel = r.level;
    r.level = newLevel;

    emit TrusteeLevelUpdated(trustorIdHash, trusteeIdHash, oldLevel, newLevel, block.timestamp);
  }

  // =================== TRUSTEE - ROLE GRANT HELPERS ===================

  /**
   * @dev Resolves what role a trustee should get on a record based on their level
   *   Observer  → always viewer
   *   Custodian → mirrors trustor, capped at administrator
   *   Controller → mirrors trustor exactly (including owner)
   */
  function _resolveTrusteeRole(
    string memory recordId,
    bytes32 trustorIdHash,
    TrusteeLevel level
  ) internal view returns (string memory) {
    if (level == TrusteeLevel.Observer) {
      return "viewer";
    }

    string memory trustorRole = _getUserRole(recordId, trustorIdHash);

    if (level == TrusteeLevel.Custodian) {
      if (keccak256(bytes(trustorRole)) == keccak256(bytes("owner"))) {
        return "administrator";
      }
      return trustorRole;
    }

    // Controller — full mirror including owner
    return trustorRole;
  }

  /**
   * @dev Internal batch grant — caller is responsible for permission checks before invoking
   * @param recordIds Array of record IDs
   * @param targetIdHash The identity to grant roles to
   * @param roles Array of roles — must match recordIds length
   * @param granterIdHash The identity granting the roles (for audit trail)
   */
  function _grantRoleBatchInternal(
    string[] memory recordIds,
    bytes32 targetIdHash,
    string[] memory roles,
    bytes32 granterIdHash
  ) internal {
    for (uint256 i = 0; i < recordIds.length; i++) {
      if (!_isValidRole(roles[i])) continue;
      if (!_hasActiveRole(recordIds[i], granterIdHash)) continue; // granter must have role
      if (_hasActiveRole(recordIds[i], targetIdHash)) continue; // skip if already has role
      _grantRoleInternal(recordIds[i], targetIdHash, roles[i], granterIdHash);
    }
  }

  /**
   * @notice General purpose batch role grant — caller grants target a role on multiple records
   * @param recordIds Array of record IDs
   * @param targetWallet The identity to grant roles to
   * @param roles Array of roles — must match recordIds length
   */
  function grantRoleBatch(
    string[] memory recordIds,
    address targetWallet,
    string[] memory roles
  ) external onlyActiveMember {
    require(recordIds.length == roles.length, "Array length mismatch");
    bytes32 userIdHash = _getCallerIdHash();
    bytes32 targetIdHash = wallets[targetWallet].userIdHash;
    require(targetIdHash != bytes32(0), "Target wallet not registered");
    _grantRoleBatchInternal(recordIds, targetIdHash, roles, userIdHash);
  }

  /**
   * @notice Trustee grants themselves access to multiple records in one transaction
   * @param recordIds Array of record IDs
   * @param trustorIdHash The identity hash of the trustor
   */
  function grantRoleAsTrusteeBatch(
    string[] memory recordIds,
    bytes32 trustorIdHash
  ) external onlyActiveMember {
    bytes32 trusteeIdHash = _getCallerIdHash();
    TrusteeRelationship memory r = trusteeRelationships[trustorIdHash][trusteeIdHash];
    require(r.status == TrusteeStatus.Active, "No active trustee relationship");

    string[] memory roles = new string[](recordIds.length);
    for (uint256 i = 0; i < recordIds.length; i++) {
      roles[i] = _resolveTrusteeRole(recordIds[i], trustorIdHash, r.level);
    }

    // granter is trustorIdHash since permission flows from trustor's role on each record
    _grantRoleBatchInternal(recordIds, trusteeIdHash, roles, trustorIdHash);
  }

  /**
   * @notice Batch change a target's role across multiple records
   * @param recordIds Array of record IDs
   * @param targetWallet The identity whose role is being changed
   * @param newRoles Array of new roles — must match recordIds length
   */
  function changeRoleBatch(
    string[] memory recordIds,
    address targetWallet,
    string[] memory newRoles
  ) external onlyActiveMember {
    require(recordIds.length == newRoles.length, "Array length mismatch");
    bytes32 userIdHash = _getCallerIdHash();
    bytes32 targetIdHash = wallets[targetWallet].userIdHash;
    require(targetIdHash != bytes32(0), "Target wallet not registered");

    for (uint256 i = 0; i < recordIds.length; i++) {
      if (!_isValidRole(newRoles[i])) continue;
      if (!_hasActiveRole(recordIds[i], userIdHash)) continue; // caller must have role
      if (!_hasActiveRole(recordIds[i], targetIdHash)) continue; // target must have role to change
      bytes32 targetRoleKey = _getRoleKey(recordIds[i], targetIdHash);
      string memory oldRole = recordRoles[targetRoleKey].role;

      _grantRoleInternal(recordIds[i], targetIdHash, newRoles[i], userIdHash);
      emit RoleChanged(
        recordIds[i],
        targetIdHash,
        oldRole,
        newRoles[i],
        userIdHash,
        block.timestamp
      );
    }
  }

  /**
   * @notice Batch revoke a target's role across multiple records
   * @param recordIds Array of record IDs
   * @param targetWallet A wallet belonging to the target identity
   */
  function revokeRoleBatch(
    string[] memory recordIds,
    address targetWallet
  ) external onlyActiveMember {
    require(targetWallet != address(0), "Invalid wallet");
    bytes32 userIdHash = _getCallerIdHash();
    bytes32 targetIdHash = wallets[targetWallet].userIdHash;
    require(targetIdHash != bytes32(0), "Target wallet not registered");

    for (uint256 i = 0; i < recordIds.length; i++) {
      if (!_hasActiveRole(recordIds[i], targetIdHash)) continue;
      if (!_hasActiveRole(recordIds[i], userIdHash)) continue;

      bytes32 targetRoleKey = _getRoleKey(recordIds[i], targetIdHash);
      string memory role = recordRoles[targetRoleKey].role;
      bytes32 roleHash = keccak256(bytes(role));

      // Never revoke owners in batch — only an owner can revoke themselves
      if (roleHash == keccak256(bytes("owner"))) continue;

      _removeFromRoleArray(recordIds[i], targetIdHash, role);
      recordRoles[targetRoleKey].isActive = false;
      delete roleGrantedBy[targetRoleKey];

      emit RoleRevoked(recordIds[i], targetIdHash, role, userIdHash, block.timestamp);
    }
  }

  // =================== TRUSTEE - VIEW FUNCTIONS ===================

  /**
   * @notice Check if a controller relationship is active
   * @dev Kept for HealthRecordCore._resolveSubject compatibility — checks Controller level
   */
  function isControllerOf(
    bytes32 trustorIdHash,
    bytes32 trusteeIdHash
  ) external view override returns (bool) {
    TrusteeRelationship memory r = trusteeRelationships[trustorIdHash][trusteeIdHash];
    return r.status == TrusteeStatus.Active && r.level == TrusteeLevel.Controller;
  }

  /**
   * @notice Get the full trustee relationship
   */
  function getTrusteeRelationship(
    bytes32 trustorIdHash,
    bytes32 trusteeIdHash
  ) external view returns (TrusteeStatus status, TrusteeLevel level) {
    TrusteeRelationship memory r = trusteeRelationships[trustorIdHash][trusteeIdHash];
    return (r.status, r.level);
  }

  // ===============================================================
  // GUEST ACCESS
  // ===============================================================

  // =================== GUEST ACCESS - STRUCTS & EVENTS ===================

  struct GuestAccess {
    uint256 grantedAt;
    uint256 expiresAt;
    bytes32 grantedByIdHash;
    bytes32 guestEmailHash;
  }

  event GuestAccessGranted(
    string indexed recordId,
    bytes32 indexed grantedByIdHash,
    bytes32 indexed guestIdHash,
    bytes32 guestEmailHash,
    uint256 expiresAt,
    uint256 timestamp
  );

  event GuestAccessRevoked(
    string indexed recordId,
    bytes32 indexed revokedByIdHash,
    bytes32 indexed guestIdHash,
    uint256 timestamp
  );

  // =================== GUEST ACCESS - STORAGE ===================

  // recordId => guestIdHash => GuestAccess
  mapping(string => mapping(bytes32 => GuestAccess)) public guestAccessByRecord;

  // =================== GUEST ACCESS - FUNCTIONS ===================

  /**
   * @notice Grant a guest temporary viewer access to one or more records.
   * @param recordIds      One or more record IDs to grant access to
   * @param guestWallet    Deterministic placeholder address derived from guest UID
   * @param guestIdHash    keccak256 hash of the guest's Firebase UID
   * @param guestEmailHash keccak256 of guest email — pseudonymous audit trail
   * @param durationSeconds How long access lasts (e.g. 7 days = 604800)
   */
  function grantGuestAccess(
    string[] memory recordIds,
    address guestWallet,
    bytes32 guestIdHash,
    bytes32 guestEmailHash,
    uint256 durationSeconds
  ) external onlyActiveMember {
    bytes32 callerIdHash = _getCallerIdHash();
    require(recordIds.length > 0, "No records provided");
    require(guestWallet != address(0), "Invalid guest wallet");
    require(guestIdHash != bytes32(0), "Invalid guest ID");
    require(durationSeconds > 0, "Duration must be positive");

    // Register guest wallet once outside the loop
    if (wallets[guestWallet].userIdHash == bytes32(0)) {
      wallets[guestWallet] = UserInfo({ userIdHash: guestIdHash, isWalletActive: true });
      userWallets[guestIdHash].push(guestWallet);
      userStatus[guestIdHash] = MemberStatus.Guest;
      userList.push(guestIdHash);
      totalUsers++;
    }

    uint256 expiresAt = block.timestamp + durationSeconds;

    for (uint256 i = 0; i < recordIds.length; i++) {
      string memory recordId = recordIds[i];

      // Skip records where caller has no role — don't revert the whole tx
      if (!_hasActiveRole(recordId, callerIdHash)) continue;

      if (!_hasActiveRole(recordId, guestIdHash)) {
        _grantRoleInternal(recordId, guestIdHash, "viewer", callerIdHash);
      }

      guestAccessByRecord[recordId][guestIdHash] = GuestAccess({
        grantedAt: block.timestamp,
        expiresAt: expiresAt,
        grantedByIdHash: callerIdHash,
        guestEmailHash: guestEmailHash
      });

      emit GuestAccessGranted(
        recordId,
        callerIdHash,
        guestIdHash,
        guestEmailHash,
        expiresAt,
        block.timestamp
      );
    }
  }

  /**
   * @notice Revoke a guest's access to one or more records.
   * Can be called by either the granter or any owner/admin of the record
   * @param recordIds   One or more record IDs to revoke access from
   * @param guestIdHash The guest's identity hash
   */
  function revokeGuestAccess(
    string[] memory recordIds,
    bytes32 guestIdHash
  ) external onlyActiveMember {
    bytes32 callerIdHash = _getCallerIdHash();
    require(recordIds.length > 0, "No records provided");

    for (uint256 i = 0; i < recordIds.length; i++) {
      string memory recordId = recordIds[i];

      GuestAccess memory access = guestAccessByRecord[recordId][guestIdHash];

      if (access.grantedAt == 0) continue;

      bool isGranter = callerIdHash == access.grantedByIdHash;
      bool callerIsOwnerOrAdmin = _isOwnerOrAdmin(recordId, callerIdHash);

      if (!isGranter && !callerIsOwnerOrAdmin) continue;

      // Remove role from role infrastructure
      bytes32 roleKey = _getRoleKey(recordId, guestIdHash);
      if (recordRoles[roleKey].isActive) {
        _removeFromRoleArray(recordId, guestIdHash, "viewer");
        recordRoles[roleKey].isActive = false;
        delete roleGrantedBy[roleKey];
      }

      emit GuestAccessRevoked(recordId, callerIdHash, guestIdHash, block.timestamp);
    }
  }

  // =================== GUEST ACCESS - VIEW FUNCTIONS ===================

  /**
   * @notice Check if a guest has active, non-expired access to a record
   */
  function hasActiveGuestAccess(
    string memory recordId,
    bytes32 guestIdHash
  ) external view returns (bool) {
    GuestAccess memory access = guestAccessByRecord[recordId][guestIdHash];
    return access.grantedAt > 0 && block.timestamp <= access.expiresAt;
  }

  /**
   * @notice Get full guest access details for a record
   */
  function getGuestAccess(
    string memory recordId,
    bytes32 guestIdHash
  )
    external
    view
    returns (uint256 grantedAt, uint256 expiresAt, bytes32 grantedByIdHash, bytes32 guestEmailHash)
  {
    GuestAccess memory access = guestAccessByRecord[recordId][guestIdHash];
    return (access.grantedAt, access.expiresAt, access.grantedByIdHash, access.guestEmailHash);
  }
}

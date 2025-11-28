// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title HealthRecordVerification
 * @dev Store and verify medical record hashes on blockchain with medical attestation
 * Has 3 parts at the moment:
 * Part 1: Role Management
 * Part 2: Access Permission
 * Part 3: Record Verification
 * Part 4: Record Dispute
 */
contract HealthRecordVerification {
  // ===============================================================
  // ROLE MANAGEMENT
  // ===============================================================

  // =================== ROLE MANAGEMENT - EVENTS ===================
  event RoleGranted(
    string indexed recordId, // Which record
    address indexed user, // Who received the role
    string role, // What role they got
    address indexed grantedBy, //Who granted this role
    uint256 timestamp
  );

  event RoleChanged(
    string indexed recordId,
    address indexed user,
    string oldRole, // What they had before
    string newRole, //What they have now
    address indexed changedBy,
    uint256 timestamp
  );

  event RoleRevoked(
    string indexed recordId,
    address indexed user,
    string role, // What role was removed
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
   * @notice Grant a role to a user for a specific record for the first time
   * Not used for changing a role, only used if the user has not had a role in this record before
   * @param recordId The record ID
   * @param user The address to grant the role to
   * @param role The role to grant ("owner", "administrator", "viewer")
   */
  function grantRole(string memory recordId, address user, string memory role) external {
    // Validation
    require(bytes(recordId).length > 0, 'Record ID cannot be empty');
    require(user != address(0), 'User address cannot be zero');
    require(user != msg.sender, 'Cannot grant role to yourself');

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
  function changeRole(string memory recordId, address user, string memory newRole) external {
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
  // RECORD VERIFICATION
  // ===============================================================

  // ========== RECORD VERIFICATION - EVENTS ==========
  event RecordStored(
    string indexed recordHash,
    address indexed patient,
    address indexed submitter,
    uint256 timestamp,
    string recordId
  );

  // Event when a record gets medical verification
  event Verification(string indexed recordHash, address indexed verifier, uint256 timestamp);

  /// ========== RECORD VERIFICATION - STRUCTURE ==========
  struct RecordVerification {
    string recordHash; // SHA-256 hash of medical data
    address patient; // Patient this record belongs to
    address submitter; // Who actually submitted it (could be patient, provider, etc.)
    address verifier; // person who attests to this record
    uint256 timestamp; // When it was submitted
    string recordId; // Your app's internal record ID
    bool exists; // Whether this record exists
    bool isVerified; // Whether a verifier has attested to it
  }

  // ========== RECORD VERIFICATION - STORAGE/MAPPING ==========
  mapping(string => RecordVerification) public recordVerifications;
  string[] public allRecordHashes; // Array of all hashes (for counting/listing)
  uint256 public totalRecords; // Total count
  mapping(address => string[]) public recordsByPatient; // Records by patient address
  mapping(address => string[]) public recordsByVerifier; // Records by medical verifier

  // ========== RECORD VERIFICATION - FUNCTIONS ==========
  /**
   * Store a medical record hash on the blockchain
   * @param recordHash SHA-256 hash of the medical record
   * @param recordId Your internal record ID (like "patient-123-visit-456")
   * @param patientAddress The patient this record belongs to
   */
  function storeRecordHash(
    string memory recordHash,
    string memory recordId,
    address patientAddress
  ) external {
    // Validation
    require(bytes(recordHash).length > 0, 'Hash cannot be empty');
    require(bytes(recordId).length > 0, 'Record ID cannot be empty');
    require(patientAddress != address(0), 'Patient address cannot be zero');
    require(!recordVerifications[recordHash].exists, 'Hash already exists');

    // Store the record
    recordVerifications[recordHash] = RecordVerification({
      recordHash: recordHash,
      patient: patientAddress,
      submitter: msg.sender, // Who called this function
      verifier: address(0), // No verifier yet
      timestamp: block.timestamp,
      recordId: recordId,
      exists: true,
      isVerified: false // Not verified yet
    });

    // Add to our lists
    allRecordHashes.push(recordHash);
    recordsByPatient[patientAddress].push(recordHash);
    totalRecords++;

    // Emit event
    emit RecordStored(recordHash, patientAddress, msg.sender, block.timestamp, recordId);
  }

  /**
   * Allow a medical verifier to attest to a record
   * @param recordHash The hash of the record to verify
   */
  function verifyMedicalRecord(string memory recordHash) external {
    require(recordVerifications[recordHash].exists, 'Record does not exist');
    require(!recordVerifications[recordHash].isVerified, 'Already verified');
    require(msg.sender != address(0), 'Invalid verifier address');

    // Update the record
    recordVerifications[recordHash].verifier = msg.sender;
    recordVerifications[recordHash].isVerified = true;

    // Add to verifier's list
    recordsByVerifier[msg.sender].push(recordHash);

    // Emit event
    emit Verification(recordHash, msg.sender, block.timestamp);
  }

  /**
   * Check if a record hash exists and get its info
   * @param recordHash The hash to look up
   * @return exists Whether it exists
   * @return patient Who the record belongs to
   * @return submitter Who submitted it
   * @return medicalVerifier Who verified it (address(0) if not verified)
   * @return timestamp When it was submitted
   * @return recordId The internal record ID
   * @return isVerified Whether it's been medically verified
   */
  function verifyRecordExists(
    string memory recordHash
  )
    external
    view
    returns (
      bool exists,
      address patient,
      address submitter,
      address medicalVerifier,
      uint256 timestamp,
      string memory recordId,
      bool isVerified
    )
  {
    RecordVerification memory record = recordVerifications[recordHash];
    return (
      record.exists,
      record.patient,
      record.submitter,
      record.verifier,
      record.timestamp,
      record.recordId,
      record.isVerified
    );
  }

  /**
   * Get all records for a specific patient
   * @param patientAddress The patient's address
   * @return Array of record hashes
   */
  function getPatientRecords(address patientAddress) external view returns (string[] memory) {
    return recordsByPatient[patientAddress];
  }

  /**
   * Get all records verified by a specific medical provider
   * @param verifierAddress The verifier's address
   * @return Array of record hashes
   */
  function getVerifierRecords(address verifierAddress) external view returns (string[] memory) {
    return recordsByVerifier[verifierAddress];
  }

  /**
   * Get total number of records
   */
  function getTotalRecords() external view returns (uint256) {
    return totalRecords;
  }

  /**
   * Get a record hash by its index in the array
   */
  function getRecordByIndex(uint256 index) external view returns (string memory) {
    require(index < allRecordHashes.length, 'Index out of bounds');
    return allRecordHashes[index];
  }

  /**
   * Get verification statistics for a patient
   * @param patientAddress The patient's address
   * @return total Total records for this patient
   * @return verified How many are medically verified
   */
  function getPatientStats(
    address patientAddress
  ) external view returns (uint256 total, uint256 verified) {
    string[] memory patientRecords = recordsByPatient[patientAddress];
    total = patientRecords.length;
    verified = 0;

    for (uint256 i = 0; i < patientRecords.length; i++) {
      if (recordVerifications[patientRecords[i]].isVerified) {
        verified++;
      }
    }

    return (total, verified);
  }

  // ===============================================================
  // RECORD DISPUTE
  // ===============================================================
}

# MemberRoleManager Contract

## Why this Contract Exists

MemberRoleManager.sol is one of two core smart contracts in the Belrose Health system. It manages user identities, wallet registration, and role-based access control for health records.

The Member Registry serves two critical purposes in the Belrose system:

### 1. Creates a Trustless, Publicly Verifiable Backend

Although Belrose's databases run in Firebase on our servers, every member registration and record permission change is posted on the blockchain. This creates a democratized, decentralized, trustless system for managing health records.

**Key benefits:**

- **Non-repudiation:** Users cannot accuse Belrose of fraudulently sharing their records because their cryptographic wallet must sign every permission change
- **Verifiable consistency:** Users can verify that Firebase permissions match the blockchain permissions
- **Transparency:** All access grants/revocations are publicly auditable with the userIdHashes
- **Trust minimization:** Users don't have to trust Belrose's servers alone—the blockchain provides independent verification

### 2. Enables the Record Credibility System

In order to achieve our goal of patient sovereignty over health data, records need to be reliable to third parties (doctors, insurance companies, governments etc.), this requires an evaluation of the credibility of the records in the system.

**The registry is what makes this possible:**

- Our solution to creating a decentralized record credibility system is to have healthcare providers post verifications or disputes of record hashes to the blockchain (see HealthRecordCore contract)
- This requires that we know who is allowed to access a record, otherwise any random person could call the smart contract's functions
- Member registry and permissions on chain allow all to know that user is not just a verified Belrose user, but also that the user has access to the record they verified or disputed

## Core Concepts

### Architecture: One person = one identity on member registry, but multiple wallets

- Every user who registers with Belrose has a unique **userIdHash** (created from the Keccak hash of their firebase userID) and is stored in the member registry
- One identity can link to **multiple** wallet addresses.
  - Most common: EOA wallet from registration + smart wallet for gasless transactions
  - Also allows for a user to use any wallet they want
- Roles are assigned to the **identity** not individual wallets
- Any wallet linked to an identity can exercise that identity's permissions

### Member Registry Status Levels

| Status               | Value | Description         | Can Do                |
| -------------------- | ----- | ------------------- | --------------------- |
| **NotRegistered**    | 0     | Default state       | Nothing               |
| **Inactive**         | 1     | Banned/removed      | Cannot transact       |
| **Active**           | 2     | Standard user       | Basic operations      |
| **Verified**         | 3     | Identity verified   | Advanced features     |
| **VerifiedProvider** | 4     | Healthcare provider | Professional features |

### Role Types

Three types of roles for record access:

| Role              | Permissions                 | Can Grant Roles To |
| ----------------- | --------------------------- | ------------------ |
| **Owner**         | Full control of record      | Anyone             |
| **Administrator** | Manage record, invite users | Admins, Viewers    |
| **Viewer**        | Read-only access            | No one             |

## Common Operations

### 1. Register a New User Wallet

**What it does:** Links a wallet address to a user identity

**Backend code example:**

```typescript
// In your Cloud Function
const userIdHash = ethers.id(userId); // Convert Firebase UID to hash
const tx = await contract.addMember(walletAddress, userIdHash);
await tx.wait();
```

**Contract function:**

```solidity
function addMember(address wallet, bytes32 userIdHash) external onlyAdmin
```

**Requirements:**

- Only admin can call this
- Wallet can't already be registered
- If first wallet for this user: creates new identity with "Active" status
- If user exists: adds wallet to their identity
- Wallets can also be deactivated or reactivated with the deactivateWallet/reactivateWallet functions

### 2. Check if Someone Can Access a Record

**Frontend code example:**

```typescript
const hasAccess = await memberRoleManager.hasActiveRole(recordId, userWallet);

if (hasAccess) {
  // Show record
} else {
  // Show "Access Denied"
}
```

**What it checks:**

- Does this wallet belong to a registered user?
- Is that user's identity active (not banned)?
- Does that identity have any role on this record?

### 3. Grant a Role to Someone

**What it does:** Give someone access to a record

**Backend code example:**

```typescript
const tx = await contract.grantRole(
  recordId,
  targetWalletAddress,
  'viewer' // or 'administrator' or 'owner'
);
await tx.wait();
```

**Requirements:**

- Caller must have an active role on the record
- Target user must be registered and active
- Permission rules apply (see Business Rules below)

### 4. Change Someone's Role

**Example:** Promote a viewer to administrator

```typescript
const tx = await contract.changeRole(recordId, userWallet, 'administrator');
await tx.wait();
```

**Important:** Owners cannot be demoted. They must use `voluntarilyLeaveOwnership()` instead.

### 5. Remove Someone's Access

```typescript
const tx = await contract.revokeRole(recordId, userWallet);
await tx.wait();
```

**Note:** You cannot revoke an owner. Owners must remove themselves.

## Business Rules (Enforced by Contract)

### Role Granting Rules

**To grant "owner" role:**

- If an owner exists → only existing owners can grant owner
- If no owner exists → administrators can grant first owner

**To grant "administrator" or "viewer" role:**

- Only owners and administrators can grant admin or viewer role
- New users also default to administrator role

### Role Change Rules

**Demotions:**

- Owners cannot be demoted (must voluntarily leave)
- If owner exists → only owners can demote others
  - Administrators can only demote themselves
- If there is no owner, administrators can demote other administrators
- There must always be either an administrator or owner on every record

## View Functions (Read-Only Queries)

### Check Access

```typescript
// Does this wallet have ANY role on this record?
const hasRole = await contract.hasActiveRole(recordId, walletAddress);

// Does this wallet have a specific role?
const isOwner = await contract.hasRole(recordId, walletAddress, 'owner');

// Is this wallet an owner OR admin?
const canManage = await contract.isOwnerOrAdmin(recordId, walletAddress);
```

### Get Role Details

```typescript
// Get someone's full role info
const [role, isActive] = await contract.getRoleDetails(recordId, walletAddress);

console.log(`Role: ${role}, Active: ${isActive}`);
// Example output: "Role: administrator, Active: true"
```

### List All People with Access

```typescript
// Get all owner identities for a record
const ownerHashes = await contract.getRecordOwners(recordId);

// Get all admin identities
const adminHashes = await contract.getRecordAdmins(recordId);

// Get all viewer identities
const viewerHashes = await contract.getRecordViewers(recordId);
```

**Note:** These return userIdHashes. You'll need to look up user info in Firebase.

### Get User's Records

```typescript
// Get all records where a user has any role
const userIdHash = ethers.id(userId);
const recordIds = await contract.getRecordsByUser(userIdHash);
```

### Statistics

```typescript
// How many people have each role type?
const [ownerCount, adminCount, viewerCount] = await contract.getRecordRoleStats(recordId);

// Total unique users in the system
const totalUsers = await contract.getTotalUsers();

// Total role assignments across all records
const totalRoles = await contract.getTotalRoles();
```

## Integration with Firebase

### Converting Between IDs

```typescript
// Firebase UID → Blockchain userIdHash
const userIdHash = ethers.id(firebaseUserId);

// Wallet Address → userIdHash
const userIdHash = await contract.getUserForWallet(walletAddress);

// userIdHash → All wallets for that user
const wallets = await contract.getWalletsForUser(userIdHash);
```

## Next Steps

- See **HealthRecordCore.md** for record anchoring and verification

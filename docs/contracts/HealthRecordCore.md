# HealthRecordCore Contract

## Why this Contract Exists

HealthRecordCore.sol is the second core smart contract in the Belrose Health system. It handles record anchoring, versioning, and the credibility system. In order to achieve our goal of patient sovereignty over health data, records need to be reliable to third parties (doctors, insurance companies, governments etc.), this requires an evaluation of the credibility of the records in the system.

HealthRecordCore enables the system by:

### 1. Record Anchoring - Immutable Proof of Record Versions

- Each user anchors themselves to a recordIdHash. This recordIdHash lists 1 or more record hashes (SHA-256 hash)
- Each of these hashes represents a different version of the record in question
- If a user tampers with their record, the hashes will no longer match up and a future viewer of the record knows to be cautious with the information
- Because the record anchoring is publicly available on chain, the user has complete autonomy over where their record is stored, enabling true sovereignty while allowing the record to be useful to third parties

### 2. Verification System - Building Record Credibility

- Record anchoring can determine a record has not been tampered with, but if the underlying record is unreliable, then it doesn't matter. That is why a record credibility system is needed.
- Without a second or third party attesting to the credibility of record content, recordHashes are merely self-reported health data posted on a blockchain; no more reliable than a patient simply saying "this is true."
- The ultimate goal of the record credibility system is to calculate a credibility score. The primary inputs to this calculation will be verifications and disputes.

**Verifications:**

| Verification   | Level | Description                                                                                  |
| -------------- | ----- | -------------------------------------------------------------------------------------------- |
| **Provenance** | 1     | "I confirm this came from the stated source"                                                 |
| **Content**    | 2     | "I reviewed the content and agree with it even if I was not part of the original evaluation" |
| **Full**       | 3     | "I verify both the source and content completely"                                            |

**Disputes:**

**Dispute severity levels:**

| Dispute Severity | Value | Description                                                                 |
| ---------------- | ----- | --------------------------------------------------------------------------- |
| **Negligible**   | 1     | Minor issue, serious enough to be noted, but unlikely to affect future care |
| **Moderate**     | 2     | Notable error, likely this error affects future care decisions              |
| **Major**        | 3     | Serious issue, overwhelmingly likely to impact patient safety               |

**Dispute culpability levels:**

| Dispute Culpability | Value | Description                       |
| ------------------- | ----- | --------------------------------- |
| **Unknown**         | 0     | Unknown why this mistake occurred |
| **No Fault**        | 1     | Honest mistake, unavoidable       |
| **Systemic**        | 2     | Process/system failure            |
| **Preventable**     | 3     | Should have been caught           |
| **Reckless**        | 4     | Careless disregard for accuracy   |
| **Intentional**     | 5     | Deliberate falsification          |

Verifications and disputes are posted publicly on chain for all to view. The final credibility score calculation is done off chain and may incorporate other data points if relevant to the ultimate credibility of the record.

## Core Concepts

### Record Structure

Each on-chain record has:

- **recordIdHash:** `bytes32` identifier derived from the Firestore record ID
- **subjects:** The patient(s) this record is about (their userIdHashes)
- **versionHistory:** Array of all `recordHash` values (content fingerprints) over time
- **verifications:** Array of who verified each `recordHash`
- **disputes:** Array of who disputed each `recordHash`

### Subjects vs Participants

It is key to distinguish subjects and participants:

- **Subject:** The person the record is _about_ (the patient)
- **Participant:** Anyone with a role on the record (from MemberRoleManager)

### Controllers and Delegated Anchoring

A user with a Controller trustee relationship (see MemberRoleManager docs) can perform anchoring operations on behalf of their trustor. This is the key mechanism for managed care scenarios — e.g. a parent anchoring records on behalf of a child.

The `subjectIdHash` parameter on anchoring functions controls this:

- Pass `bytes32(0)` (or your own hash) → act as yourself (default behaviour)
- Pass a trustor's `userIdHash` → act on their behalf, if you are their active Controller

### There are two potential flows for anchoring/verification of a record

**1. User anchoring themselves to a record before a verification or dispute**

1. A user can proactively anchor themselves to a recordIdHash by setting themselves as the record's subject, along with a recordHash of the record content
2. A provider would then verify/dispute that recordHash. That hash was associated to the user during the anchoring process
3. Now we have a complete verification flow: User → recordIdHash → recordHash ← Verification

**2. A Record Participant verifies the record before the user anchors themselves as subject**

1. A provider creates a record and then verifies that record along with the intended recordIdHash
2. The provider sends the intended subject a request to set themselves as the subject of the record
3. If they confirm we have a complete verification flow: Provider's Verification → recordHash ← recordIdHash ← User
4. If the subject does **not** confirm, the provider then faces a choice to either drop the request or escalate it (see below)

**The Problem of Rejected Records**

1. The ethos of Belrose is patient sovereignty, however there are certainly situations where sovereignty must be balanced with accuracy and public safety. Imagine for example, a user suffering from opioid addiction, they may not want opioid addiction to appear on their record and could reject requests to anchor themselves as subject to a record that includes information on the treatment of their opioid addiction.
2. In the case where a patient does not accept a provider's request, a provider can drop the request if they feel it is not vital to the patient's medical history OR escalate it to Belrose.
3. If escalated, Belrose may flag the unaccepted update on chain via `flagUnacceptedUpdate`. The flag contains the target subject's `userIdHash`, the `recordIdHash`, the `reporterIdHash` (the provider), and a `recordContentHash`. Future providers can see that a flag exists for this subject without seeing the record contents. The full resolution flow is still under development.

#### Why flagUnacceptedUpdate is admin-only

For now, flagging unaccepted updates is reserved for the Belrose admin wallet. This is an intentional design choice because flagging unaccepted updates sits at an unresolved tension in law. GDPR gives people a right to erasure/to be forgotten. However, relevant case law (See YSL v. Surrey and Borders Partnership NHS Foundation Trust [2024], HIPAA 45 CFR § 164.526), has consistently established that that right is not absolute and exceptions can be made when it comes to public good. The ICO calls out specific exceptions to the right to erasure including "public health purposes."

Belrose's unaccepted update flag system is designed with this tension in mind. The system does not force the patient to anchor themselves as a subject nor does it reveal any sensitive information. But what it does create is a publicly verifiable signal that a provider believes this user's record may be incomplete. This is the current middle path designed to balance patient sovereignty and public good. Whether this satisfies legal requirements is an open question and will be approached with the utmost caution until authoritative guidance is available.

## Common Operations

### 1. Anchor a Record (Patient)

```typescript
// Anchor as yourself (most common case)
// recordIdHash = ethers.keccak256(ethers.toUtf8Bytes(firestoreRecordId))
// recordHash   = `0x${await RecordHashService.generateRecordHash(fileObject)}`
const tx = await healthRecordCore.anchorRecord(recordIdHash, recordHash, ethers.ZeroHash);

// Anchor on behalf of someone you are a Controller for
const tx = await healthRecordCore.anchorRecord(recordIdHash, recordHash, trustorUserIdHash);
await tx.wait();
```

**Requirements:**

- Caller must have an active role on the record (from MemberRoleManager)
- Subject can't already be anchored to this record
- If first subject: establishes the initial recordHash
- If additional subjects: they confirm the existing recordHash
- If acting as a Controller, the trustee relationship must be active

### 2. Add a New Record Hash (Provider)

**What it does:** Provider adds a new version of the record

```typescript
// Provider adds updated record hash
const tx = await healthRecordCore.addRecordHash(recordIdHash, newRecordHash);
await tx.wait();
```

**Use cases:**

- Record is edited and that edited version is the one verified by a provider

**Requirements:**

- Caller must be a participant on the record
- Hash can't already be used elsewhere

### 3. Verify a Record Hash

**What it does:** Healthcare provider vouches for a record's accuracy

```typescript
const tx = await healthRecordCore.verifyRecord(
  recordIdHash,
  recordHash,
  3 // Verification level: 1=Provenance, 2=Content, 3=Full
);
await tx.wait();
```

**Requirements:**

- Caller must be a participant on the record
- Can't verify the same hash twice
- Can't verify a hash you have disputed

### 4. Dispute a Record Hash

**What it does:** Flag an inaccuracy in a record

```typescript
const tx = await healthRecordCore.disputeRecord(
  recordIdHash,
  recordHash,
  2, // Severity: 1=Negligible, 2=Moderate, 3=Major
  3, // Culpability: 0=Unknown, 1=NoFault, 2=Systemic, 3=Preventable, 4=Reckless, 5=Intentional
  'ipfs://Qm...' // Off-chain notes (IPFS hash or similar)
);
await tx.wait();
```

**Requirements:**

- Caller must be a participant on the record
- Can't dispute the same hash twice
- Can't dispute a hash that you've verified

## Business Rules (Enforced by Contract)

### Record Anchoring Rules

- Patient must have a role on record before anchoring (prevents random people from anchoring themselves to a record that isn't theirs)
- Each patient can only anchor once per record (can unanchor/reanchor)
- First subject establishes the initial recordHash
- Cannot retract the last active hash from a record

### Verification Rules

- Can verify any active hash you have access to
- Can change your verification level later
- Can retract your verification
- You cannot both dispute and verify the same hash

### Dispute Rules

- Can dispute any hash you have access to
- Can modify severity/culpability later
- Can retract your dispute
- You cannot both dispute and verify the same hash

## View Functions (Read-Only Queries)

### Get a User's Medical History

```typescript
// Get ALL records (including unanchored) — returns bytes32[] of recordIdHashes
const allRecordIdHashes = await contract.getSubjectMedicalHistory(userIdHash);

// Client-side filter for only active records (no on-chain equivalent)
const activeRecordIdHashes =
  await blockchainHealthRecordService.getActiveSubjectMedicalHistory(userIdHash);

// Check if specific record is active
const isActive = await contract.isActiveSubject(recordIdHash, userIdHash);
```

**Important:** `subjectMedicalHistory` includes unanchored records for audit trail purposes. Use the service's `getActiveSubjectMedicalHistory()` to get only records the user currently considers part of their medical history — this fetches all and filters by `isActiveSubject` in parallel.

**Unanchoring vs Deleting:**

- **Unanchored:** Record still exists in history, but patient has "soft deleted" it from their active medical history
- Use case: legal/compliance to make sure the patient can't claim they never had access to record X
- Can be reanchored later with `reanchorRecord()`

### Get Record Info

```typescript
// Get all subjects (patients) of a record
const subjectHashes = await contract.getRecordSubjects(recordIdHash);

// Get only active subjects
const activeSubjects = await contract.getActiveRecordSubjects(recordIdHash);

// Get all versions (content hashes) of a record — returns bytes32[]
const recordHashes = await contract.getRecordVersionHistory(recordIdHash);

// Check if a content hash exists
const exists = await contract.doesHashExist(recordHash);

// Find which recordIdHash a content hash belongs to
const foundRecordIdHash = await contract.getRecordIdForHash(recordHash);
```

### Get Verification Info

```typescript
// Get all verifications for a content hash
const verifications = await contract.getVerifications(recordHash);

// Check if a user verified this hash
const hasVerified = await contract.hasUserVerified(recordHash, userIdHash);

// Get a specific user's verification details
const { exists, recordIdHash, level, createdAt, isActive } = await contract.getUserVerification(
  recordHash,
  userIdHash
);

// Get verification stats
const [total, active] = await contract.getVerificationStats(recordHash);

// Get all hashes a user has verified — returns bytes32[]
const verifiedHashes = await contract.getUserVerifications(userIdHash);
```

### Get Dispute Info

```typescript
// Get all disputes for a hash
const disputes = await contract.getDisputes(recordHash);

// Check if a user disputed this hash
const hasDisputed = await contract.hasUserDisputed(recordHash, userIdHash);

// Get a specific user's dispute details
const { exists, recordIdHash, severity, culpability, notes, createdAt, isActive } =
  await contract.getUserDispute(recordHash, userIdHash);

// Get dispute stats
const [total, active] = await contract.getDisputeStats(recordHash);

// Get all hashes a user has disputed — returns bytes32[]
const disputedHashes = await contract.getUserDisputes(userIdHash);
```

### Get Unaccepted Update Flags

```typescript
// Get all flags for a subject (includes revoked, for audit trail)
const flags = await contract.getUnacceptedFlags(subjectIdHash);
// Each flag: { recordIdHash, reporterIdHash, recordContentHash, createdAt, isActive }

// Get a specific flag for a (subject, record) pair
const { exists, isActive, reporterIdHash, recordContentHash, createdAt } =
  await contract.getUnacceptedFlag(subjectIdHash, recordIdHash);

// Get count of currently active flags for a subject
const count = await contract.getActiveUnacceptedFlagCount(subjectIdHash);

// Check if a subject has any active flags
const hasFlags = await contract.hasActiveUnacceptedFlags(subjectIdHash);
```

**Note:** `flagUnacceptedUpdate` and `revokeUnacceptedFlag` are admin-only and handled by Cloud Functions, not the frontend service.

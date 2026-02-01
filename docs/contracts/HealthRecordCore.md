# HealthRecordCore Contract

## Why this Contract Exists

HealthRecordCore.sol is the second core smart contract in the Belrose Health system. It handles record anchoring, versioning, and the credibility system. In order to achieve our goal of patient sovereignty over health data, records need to be reliable to third parties (doctors, insurance companies, governments etc.), this requires an evaluation of the credibility of the records in the system.

HealthRecordCore enables the system by:

### 1. Record Anchoring - Immutable Proof of Record Versions

- Each user anchors themselves to a recordId. This recordId lists 1 or more record hashes (SHA-256 hash)
- Each of these hashes represents a different version of the recordId in question
- If a user tampers with their record, the hashes will no longer match up and a future viewer of the record knows to be cautious with the information
- Because the record anchoring is publicly available on chain, the user has complete autonomy over where there record is stored, enabling true sovereignty while allowing the record to be useful to third parties

### 2. Verification System - Building Record Credibility

- Record anchoring can determine a record has not been tampered with, but if the underlying record is unreliable, then it doesn't matter. That is why a record credibility system is needed.
- Without a second or third party attesting to the credibility of record content, recordHashes are merely self-reported health data posted on a blockchain; no more reliable than a patient simply saying "this is true."
- The ultimate goal of the record credibility system is to calculate a credibility score. The primary inputs to this calculation will be verifications, disputes, and reactions to disputes

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

| Dispute Culpability | Value | Description                      |
| ------------------- | ----- | -------------------------------- |
| **Unknown**         | 0     | Unknown why this mistake occured |
| **No Fault**        | 1     | Honest mistake, unavoidable      |
| **Systemic**        | 2     | Process/system failure           |
| **Preventable**     | 3     | Should have been caught          |
| **Reckless**        | 2     | Careless disregard for accuracy  |
| **Intentional**     | 3     | Deliberate falsification         |

- **Reactions:** Allow other record participants to support or oppose a dispute

Verifications, Disputes, and Reactions form the core of the credibility system and are all posted publicly on chain for all to view. The actual final credibility score calculation is done off chain and may incorporate other data points if we feel they are relevant to the ultimate credibility of the record.

## Core Concepts

### Record Structure

Each on-chain record has:

- **recordId:** Unique identifier (e.g., "record_123")
- **subjects:** The patient(s) this record is about (their userIdHashes)
- **versionHistory:** Array of all verified record hashes over time
- **verifications:** Array of who verified each hash
- **disputes:** Array of who disputed each hash

### Subjects vs Participants

It is key to distinguish subjects and participants

- **Subject:** The person the record is _about_ (the patient)
- **Participant:** Anyone with a role on the record (from MemberRoleManager)

### There are two potential flows for anchoring/verification of a record

**1. User anchoring themselves to a record before a verification or dispute**

1. A user can proactively anchor themselves to a recordId by setting themselves as the record's subject which will include a hash of the record content
2. A provider would then verify/dispute that record hash. That hash was associated to the user during the anchoring process
3. Now we have a complete verification flow. User --> RecordId --> Record Hash <-- Verification

**2. A Record Participant verifies the record before the user anchors themselves as subject**

1. A provider creates a record and then verifies that record along with the intended recordId and subject
2. The subject then receives a request to set themselves as the subject of the record
3. If they confirm we have a complete verification Flow. Provider's Verification --> Record Hash <-- RecordId <-- User
4. If the subject does **not** confirm, the provider then faces a choice to either drop the request or escalate it (see below)

**The Problem of Rejected Records**

1. The ethos of Belrose is patient sovereignty, however there are certainly situations where sovereignty must be balanced with accuracy and public safety. Imagine for example, a user suffering from opioid addiction, they may not want opioid addiction to appear on their record and could reject requests to anchor themselves as subject to a record that includes information on the treatment of their opioid addiction
2. In the case where a patient does not accept a provider's request for the patient to anchor themselves as subject to a record, a provider can drop the request if they feel it is not vital to the patient's medical history OR escalate it to Belrose
3. If it is escalated, Belrose may flag the unaccepted update on chain. The flag would contain only the target subject's userIdHash as well as a recordId linked to a provider's verification. So although they would not know the record contents, Future providers would be able to determine that there may be information missing from the patient's record

## Common Operations

### 1. Anchor a Record (Patient)

**What it does:** Patient links themselves to a record with its hash

```typescript
// Patient anchors themselves to record
const tx = await healthRecordCore.anchorRecord(recordId, recordHash);
await tx.wait();
```

**Requirements:**

- Caller must have an active role on the record (from MemberRoleManager)
- Patient can't already be anchored to this record
- If first subject: establishes the initial hash
- If additional subjects: they confirm the existing hash

### 2. Add a New Record Hash (Provider)

**What it does:** Provider adds a new version of the record

```typescript
// Provider adds updated record hash
const tx = await healthRecordCore.addRecordHash(recordId, newHash);
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
  recordId,
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
  recordId,
  recordHash,
  2, // Severity: 1=Negligible, 2=Moderate, 3=Major
  3, // Culpability: 0=Unknown 1=NoFault, 2=Systemic, 3=Preventable, 4=Reckless, 5=Intentional
  'ipfs://Qm...' // Off-chain notes (IPFS hash)
);
await tx.wait();
```

**Requirements:**

- Caller must be a participant on the record
- Can't dispute the same hash twice
- Can't dispute a hash that you've verified

### 5. React to a Dispute

**What it does:** Support or oppose someone else's dispute

```typescript
const tx = await healthRecordCore.reactToDispute(
  recordHash,
  disputerIdHash, // The person whose dispute you're reacting to
  true // true = support, false = oppose
);
await tx.wait();
```

**Requirements:**

- Caller must be a participant on the record
- Can't react to your own dispute
- Can't react twice to same dispute

## Business Rules (Enforced by Contract)

### Record Anchoring Rules

- Patient must have a role on record before anchoring (prevents random people from anchoring themselves to a record that isn't their's)
- Each patient can only anchor once per record (can unanchor/reanchor)
- First subject establishes the initial hash
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
- Reactions only valid while dispute is active

## View Functions (Read-Only Queries)

### Get a User's Medical History

```typescript
// Get ALL records (including unanchored)
const allRecords = await contract.getSubjectMedicalHistory(userIdHash);

// Get only ACTIVE records (recommended for UI)
const activeRecords = await contract.getActiveSubjectMedicalHistory(userIdHash);

// Check if specific record is active
const isActive = await contract.isActiveSubject(recordId, userIdHash);
```

**Important:** `subjectMedicalHistory` includes unanchored records for audit trail purposes. Use `getActiveSubjectMedicalHistory()` to get only records the user currently considers part of their medical history.

**Unanchoring vs Deleting:**

- **Unanchored:** Record still exists in history, but patient has "soft deleted" it from their active medical history
- Use case: legal/compliance to make sure the patient can't claim they never had access to record X
- Can be reanchored later with `reanchorRecord()`

### Get Record Info

```typescript
// Get all subjects (patients) of a record
const subjectHashes = await contract.getRecordSubjects(recordId);

// Get only active subjects
const activeSubjects = await contract.getActiveRecordSubjects(recordId);

// Get all versions (hashes) of a record
const hashes = await contract.getRecordVersionHistory(recordId);

// Check if a hash exists
const exists = await contract.doesHashExist(recordHash);

// Find which record a hash belongs to
const recordId = await contract.getRecordIdForHash(recordHash);
```

### Get Verification Info

```typescript
// Get all verifications for a hash
const verifications = await contract.getVerifications(recordHash);

// Check if a user verified this hash
const hasVerified = await contract.hasUserVerified(recordHash, userIdHash);

// Get verification stats
const [total, active] = await contract.getVerificationStats(recordHash);

// Get detailed stats by level
const [total, active, provenanceCount, contentCount, fullCount] =
  await contract.getVerificationStatsByLevel(recordHash);
```

### Get Dispute Info

```typescript
// Get all disputes for a hash
const disputes = await contract.getDisputes(recordHash);

// Check if a user disputed this hash
const hasDisputed = await contract.hasUserDisputed(recordHash, userIdHash);

// Get dispute stats
const [total, active] = await contract.getDisputeStats(recordHash);

// Get reactions to a specific dispute
const reactions = await contract.getDisputeReactions(recordHash, disputerIdHash);

// Get reaction stats
const [totalReactions, supports, opposes] = await contract.getReactionStats(
  recordHash,
  disputerIdHash
);
```

### Get Combined Summary

```typescript
// Get complete credibility overview for a hash
const [activeVerifications, activeDisputes, verificationCount, disputeCount] =
  await contract.getRecordHashReviewSummary(recordHash);

console.log(`Credibility Score:
  ✓ ${activeVerifications} active verifications
  ✗ ${activeDisputes} active disputes
  Total history: ${verificationCount} verifications, ${disputeCount} disputes
`);
```

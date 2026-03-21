# Belrose Messaging: Signal Protocol

## Why Signal Protocol

The central thesis of Belrose Health is sovereignty and privacy. Belrose users exchange sensitive health information with providers, family members, and carers. A standard messaging system would store message content on Belrose's servers where it could be read by employees, exposed in a breach, or handed to third parties. Signal Protocol addresses this issue:

**End-to-end encryption** - message content is encrypted on the sender's device and can only be decrypted by the intended recipient. Belrose's servers store only ciphertext blobs. Even with full Firestore access, message content is unreadable.

**Forward secrecy** - each message uses a fresh derived key via the Double Ratchet. If an attacker compromises a message key today, they cannot decrypt past messages that used different keys.

This is particularly valuable against a number of attack vectors:

- man-in-the-middle attacks and network-level interception — although this is largely mitigated by TLS 1.3 and certificate transparency, this attack vector involves a server impersonating the intended target or having access to traffic between servers
- record now decrypt later - attacker stores cipher text today hoping to decrypt it after a future key compromise
- silent server compromise - where an attacker has persistent access to server infrastructure

Forward secrecy defeats all of the above by using ephemeral message keys that are discarded after use and cannot be reconstructed even with the permanent identity key. The Double Ratchet ensures that the blast radius of any compromised key is limited.

**The back up tradeoff:**

Belrose adds an encrypted message backup layer (`MessageBackupService`) because users cannot lose their entire conversation history with a provider when they clear their browser cache. This backup is encrypted with an HKDF-derived key from the user's masterkey and stored in Firestore.

Having a back-up transfers the record-now-decrypt-later attack vector from the Signal layer to the master key layer. For us, this is an acceptable trade off because:

1. We believe there is a high likelihood that users may need to access previous messages from providers. (e.g. messages between a doctor and their patient discussing acare plan).
2. The health records discussed or referenced in chats are already encrypted with AES-256-GCM independently of the messaging layer. Losing Signal's forward secrecy for message history doesn't meaningfully reduce the protection of the underlying health data — the records themselves remain fully protected.
3. Forward secrecy **still holds** against network-level attackers, man-in-the-middle attacks, and silent server compromises — the backup only affects at-rest message history, not the Signal transport layer.

## Key Concepts

**X3DH (Extended Triple Diffie-Hellman)** — the handshake used to establish a shared secret between two parties who haven't communicated before. It requires Alice to fetch Bob's public key bundle, perform four Diffie-Hellman operations, and derive a shared secret that Bob can reproduce independently when he receives Alice's first message. Neither party's private keys are ever transmitted.

**Double Ratchet** — once a session is established via X3DH, the Double Ratchet takes over. It combines a symmetric key ratchet (each message advances the chain key, deriving a fresh message key) with a Diffie-Hellman ratchet (every reply generates a new DH keypair, mixing in fresh entropy). The result: each message uses a unique key that cannot be derived from past or future keys.

**Key types:**

| Key                         | Lifetime                             | Private key                         | Public key                                                         |
| --------------------------- | ------------------------------------ | ----------------------------------- | ------------------------------------------------------------------ |
| Identity Key (IK)           | Permanent                            | IndexedDB only                      | Firestore (`signal/keyBundle`)                                     |
| Signed PreKey (SPK)         | Weeks–months, rotated periodically   | IndexedDB only                      | Firestore (`signal/keyBundle`)                                     |
| One-Time PreKey (OPK)       | Single use, consumed per new session | IndexedDB only                      | Firestore (`signal/keyBundle`) — atomically removed on consumption |
| Double Ratchet message keys | Per message                          | In-memory only, discarded after use | Never exist — symmetric, derived locally by both parties           |

---

## Registration: Generating the Key Bundle

During registration, `generateKeyBundle()` creates all three key types and saves private keys to IndexedDB via `BelroseSignalStore`. It returns a `PublicKeyBundle` containing only the public halves:

```typescript
{
  registrationId: number,       // Random ID identifying this device
  identityKey: ArrayBuffer,     // Long-term identity public key
  signedPreKey: {
    keyId: number,
    publicKey: ArrayBuffer,
    signature: ArrayBuffer,     // Signed by identity key — proves authenticity
  },
  oneTimePreKeys: Array<{       // 100 ephemeral keys generated at registration
    keyId: number,
    publicKey: ArrayBuffer,
  }>
}
```

`KeyBundleService.uploadKeyBundle` serialises all ArrayBuffers to base64 and writes them to Firestore at `/users/{userId}/signal/keyBundle`. This is the only time public keys are written in bulk — subsequent updates are surgical (SPK rotation, OPK replenishment).

**Important:** Signal keys are completely separate from the master key hierarchy. Private Signal keys live only in IndexedDB and cannot be recovered via the recovery key. If IndexedDB is cleared (browser reset, new device), Signal keys must be regenerated — message history from before the reset is permanently unrecoverable via Signal.

---

## Starting a Conversation: X3DH Key Agreement

When User A messages User B for the first time, A needs B's public key bundle to perform X3DH. Fetching it requires a Cloud Function rather than a direct Firestore read — here's why:

**The OPK race condition problem:** One-Time PreKeys must be consumed atomically.If two users fetch Bob's key bundle simultaneously from the client, they could both read the same OPK before either has a chance to remove it. That would give two separate sessions the same DH4 secret, undermining per-session uniqueness.

`getKeyBundle` Cloud Function solves this with a Firestore `runTransaction`:

```
1. Read OPK list inside transaction
2. Pop the last OPK from the array
3. Write the updated list back (without the consumed OPK)
4. Return the bundle including the consumed OPK
```

All steps happen atomically — Firestore retries automatically on contention. No two callers ever get the same OPK.

If the OPK list is exhausted, the function returns the bundle without a `preKey`. X3DH can proceed without an OPK (using only IK and SPK), but with slightly reduced security properties. This should be rare if OPK replenishment is working correctly.

The function only ever returns **public** key material. Calling it as an authenticated user is intentional by design — you need someone's public keys to message them, the same way you'd need someone's email address to email them.

---

## Sending and Receiving Messages

**Send flow:**

1. `sessionManager.encryptMessage()` calls `SessionCipher.encrypt()` on the plaintext using the Double Ratchet session state from IndexedDB
2. This produces an `EncryptedMessage` — either a `PreKeyWhisperMessage` (type 3, first message in a session, contains X3DH material) or a `WhisperMessage` (type 1, all subsequent messages)
3. `MessageService.sendMessage()` stores the ciphertext blob in Firestore at `/conversations/{conversationId}/messages/{messageId}` — it never sees plaintext
4. The conversation's `lastMessagePreview` is AES-GCM encrypted with the sender's master key before storage (so even the preview is opaque to Belrose)

**Receive flow:**

1. `MessageService.subscribeToMessages()` fires an `onSnapshot` listener when new messages arrive — delivers raw `StoredMessage` objects with encrypted bodies
2. `sessionManager.decryptMessage()` calls `SessionCipher.decrypt()`, which advances the Double Ratchet state and returns plaintext
3. Decrypted messages are passed to `MessageBackupService.saveBackup()` (see below) and rendered in the UI

**Conversation IDs** are deterministic: `[uidA, uidB].sort().join('_')`. This guarantees Alice and Bob always resolve to the same Firestore document regardless of who initiates — no lookup table needed.

---

## Message Backup: Solving the Forward Secrecy Tradeoff

Signal's forward secrecy means plaintext is never persisted by design. The Double Ratchet discards message keys after use. But for a healthcare app where patients need reliable access to conversations with providers, losing message history because a user cleared their browser cache is unacceptable.

`MessageBackupService` resolves this tradeoff:

**After each batch decrypt**, decrypted messages are encrypted with an HKDF-derived backup key and stored in Firestore at `/users/{userId}/messageBackups/{conversationId}`:

```typescript
// Derive a purpose-specific key from master key using HKDF
// Using a derived key rather than the master key directly limits blast radius —
// a backup key compromise doesn't expose health records or wallet keys
const backupKey = await deriveBackupKey(masterKey);

// Encrypt the message array as JSON
const { encrypted, iv } = await EncryptionService.encryptJSON(messages, backupKey);
```

The HKDF derivation uses a fixed salt `belrose-message-backup-salt-v1` and info string `message-backup-v1` — the backup key is deterministic from the master key
but distinct from it.

**On conversation mount**, `MessageBackupService.loadBackup()` is called before the Firestore `onSnapshot` fires, so history appears immediately rather than waiting for the live session to decrypt incoming messages.

**Security properties of backups:**

- Firestore stores only AES-GCM ciphertext — zero-knowledge for Belrose
- An attacker with Firestore access cannot read message history
- An attacker with both Firestore access AND the master key can read backed-up history, but cannot decrypt _future_ messages (forward secrecy still holds for new messages post-compromise)
- Failed decryptions (`[Unable to decrypt message]`) are never persisted to backup
- If the master key changes (password reset), old backups become unreadable — same behaviour as health records

---

## OPK Replenishment and SPK Rotation

**One-Time PreKey replenishment** is checked after each message send. `KeyBundleService.checkAndReplenishPreKeys` reads the current OPK count from
Firestore. If below `ONE_TIME_PREKEY_REPLENISH_THRESHOLD`, `generateAdditionalOneTimePreKeys` generates a new batch, saves private keys to IndexedDB, and appends public keys
to the Firestore bundle.

**Signed PreKey rotation** is handled separately via `rotateSignedPreKey`. The new SPK private key is saved to IndexedDB first, then `KeyBundleService.updateSignedPreKey` updates only the `signedPreKey` field in the Firestore bundle. The update is surgical — it doesn't touch OPKs or the identity key.

---

## Firestore Schema

```
/conversations/{conversationId}
  participants:          string[]     — Firebase Auth UIDs (plaintext)
  createdAt:             Timestamp
  lastMessageAt:         Timestamp    — for sorting (plaintext)
  lastMessagePreview:    string       — AES-GCM ciphertext (base64)
  lastMessagePreviewIV:  string       — base64 IV

  /messages/{messageId}
    senderId:            string       — Firebase Auth UID (plaintext)
    type:                1 | 3        — WhisperMessage or PreKeyWhisperMessage
    body:                string       — Signal ciphertext (base64, opaque)
    registrationId:      number       — sender's Signal registration ID
    sentAt:              Timestamp
    deliveredAt:         Timestamp | null
    readAt:              Timestamp | null

/users/{userId}/signal/keyBundle
  registrationId:        number
  identityKey:           string       — base64 public key
  signedPreKey:          { keyId, publicKey, signature }  — all base64
  oneTimePreKeys:        Array<{ keyId, publicKey }>       — all base64
  updatedAt:             Timestamp

/users/{userId}/messageBackups/{conversationId}
  data:                  string       — AES-GCM encrypted JSON (base64)
  iv:                    string       — base64 IV
  updatedAt:             Timestamp
```

---

## What Belrose Can and Cannot Read

| Data                          | Stored as                             | Belrose can read? |
| ----------------------------- | ------------------------------------- | ----------------- |
| Message content               | Signal ciphertext                     | No                |
| Conversation preview          | AES-GCM ciphertext                    | No                |
| Message backup history        | AES-GCM ciphertext (HKDF-derived key) | No                |
| Public key bundles            | Plaintext                             | Yes               |
| Sender identity (per message) | Plaintext UID                         | Yes               |
| Message timestamps            | Plaintext                             | Yes               |
| Delivery/read receipts        | Plaintext                             | Yes               |
| Private Signal keys           | IndexedDB only, never uploaded        | No                |

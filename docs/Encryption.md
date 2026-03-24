# Belrose Encryption Architecture

## Why Client-Side Encryption

The central promise of Belrose is data sovereignty - the idea that a person's health data belongs to them, not to the platform storing it. Client-side encryption is what makes this promise technically meaningful and not just marketing.

Most platforms encrypt data "at rest" on their servers, which means the platform holds the encryption keys and can read your data when they want, hand it over to anyone they want, expose it in a breach, or monetise it. Customers just have to hope those things do not happen.

Belrose takes a different approach: **encryption keys are derived from the user's password and never leave the device in unencrypted form**. The data that reaches our servers is already encrypted. We physically cannot read it. Even law enforcement with a warrant would be unable to read the records. The only people who can decrypt a Belrose record are people who hold an encryption key for it — and those keys are controlled entirely by the user.

This is not novel technology. WhatsApp, ProtonMail, and Signal all operate on the same principle. Belrose applies it to health data.

The practical consequence: if a user loses their password and their recovery key, their data is unrecoverable. This is the honest tradeoff of genuine data sovereignty. We're upfront about it during registration.

---

## Key Architecture Overview

Belrose uses a layered key hierarchy.

```
Password (user knows this)
    ↓ PBKDF2 derivation (100,000 iterations, SHA-256)
Key Encryption Key (KEK) — never stored, derived on demand
    ↓ AES-GCM decrypt
Master Key (AES-256) — stored encrypted in Firestore, lives in memory during session
    ↓ AES-GCM encrypt/decrypt
Record DEK (Data Encryption Key) — one per record, stored in wrappedKeys collection
    ↓ AES-GCM encrypt/decrypt
Record Content (FHIR data, extracted text, file content, etc.)
```

Additionally, each user has an RSA-2048 key pair used exclusively for passing AES-GCM encryption keys:

```
Master Key
    ↓ AES-GCM encrypt
RSA Private Key — stored encrypted in Firestore
RSA Public Key — stored plaintext in Firestore (intentionally public)
    ↓ RSA-OAEP wrap
Record DEK copy for a shared user — stored in wrappedKeys collection
```

Signal Protocol keys are completely separate from the record encryption hierarchy and aren't part of the master key chain:

```
Registration
    ↓ generateKeyBundle()
Identity Keypair       — long-term identity, private key in IndexedDB only
Signed Prekey          — medium-term, private key in IndexedDB only
100 One-Time Prekeys   — ephemeral, private keys in IndexedDB only
    ↓ public halves uploaded to Firestore as PublicKeyBundle
X3DH Key Agreement (on first message to another user)
    ↓ produces shared secret, never seen by server
Double Ratchet         — fresh derived key per message, forward secrecy
```

Refer to BelroseSignalProtocol for further discussion.

---

## Registration: Setting Up the Key Hierarchy

Everything in the encryption system is set up during registration in the `handleStepComplete` call in `RegistrationForm.tsx`. The steps in order:

**1. Generate master key**
A fresh 256-bit AES-GCM key is generated using `crypto.subtle.generateKey`. This is centerpiece of the user's encryption stack.

**2. Wrap master key with password**
`EncryptionKeyManager.wrapMasterKeyWithPassword` runs PBKDF2 with 100,000 iterations to derive a Key Encryption Key (KEK) from the user's password + a random 16-byte salt. The master key is then AES-GCM encrypted with the KEK. Three things are stored in Firestore under `users/{uid}/encryption`:

- `encryptedMasterKey` — the encrypted master key bytes (base64)
- `masterKeyIV` — the IV used for AES-GCM encryption (base64)
- `masterKeySalt` — the PBKDF2 salt (base64)

The KEK is never stored. It is re-derived on demand from the password each time the user logs in.

**3. Generate recovery key**
The master key is exported as raw bytes and converted to a BIP-39 24-word mnemonic (the same wordlist used by crypto wallets). This gives the user a human-readable backup. A SHA-256 hash of the recovery key is stored in Firestore so we can verify it without storing the key itself. The recovery key is shown to the user once and never stored anywhere on Belrose's servers.

**4. Generate RSA key pair**
A 2048-bit RSA-OAEP key pair is generated for record sharing. The public key is stored plaintext in Firestore. The private key is encrypted with the master key and stored in Firestore under `encryption.encryptedPrivateKey`. Only masterKey can decrypt.

**5. Store master key in session**
The unencrypted master key is placed in memory via `EncryptionKeyManager.setSessionKey` for use during the rest of the registration flow and the current session.

**6. Generate Signal Protocol Keys**
Signal protocol key bundle is also generated during the registration step. Refer to BelroseSignalProtocol documentation for further information.

---

## Login: Restoring the Session

On login, `EncryptionKeyManager.initializeSessionWithPassword` is called with the stored `encryptedMasterKey`, `masterKeyIV`, `masterKeySalt`, and the user's password. It re-derives the KEK using PBKDF2 with the stored salt, then AES-GCM decrypts the
master key. If the password is wrong, decryption fails and the session key is never set.

The master key lives in memory for the duration of the session. It is never written to disk, localStorage, or any persistent storage. The session times out after 30 minutes of inactivity (`SESSION_TIMEOUT_MS = 30 * 60 * 1000`).

**Recovery key login** follows the same flow but reconstructs the master key from the 24-word mnemonic using `bip39.mnemonicToEntropy`, bypassing the password derivation step entirely.

---

## Record Encryption

When a user creates or uploads a record, `EncryptionService.encryptCompleteRecord` is called. The process:

**1. Generate a record DEK**
Each record gets its own unique 256-bit AES-GCM key(`generateFileKey`). This means a compromised record key only exposes that one record, not the user's entire history.

**2. Encrypt record content**
All sensitive fields are encrypted individually with the DEK using AES-GCM:

- `fileName`
- `extractedText`
- `originalText`
- `contextText`
- `fhirData` (JSON, encrypted as a blob)
- `belroseFields` (JSON)
- `customData` (JSON)

Each field gets its own random IV. The encrypted bytes and IV are stored as base64 pairs in Firestore.

**3. Wrap the DEK with the master key**
The record DEK is encrypted with the user's master key using AES-GCM. This wrapped DEK is stored in the `wrappedKeys` Firestore collection under the document ID `{recordId}_{userId}`, with `isCreator: true`.

The wrappedKeys document structure:

```typescript
{
  recordId: string,
  userId: string,
  wrappedKey: string,      // base64 AES-encrypted DEK
  isCreator: boolean,      // true = AES wrapped, false = RSA wrapped
  isActive: boolean,       // false = access revoked
  createdAt: Date,
  grantedBy: string        // uid of granter (null for creator)
}
```

---

## Record Decryption

`RecordDecryptionService.getRecordKey` fetches the `wrappedKeys` document for the current user and record. There are two paths depending on `isCreator`:

**Creator path (AES):**

```
wrappedKey (base64) → AES-GCM decrypt with master key → raw DEK bytes → import as CryptoKey
```

**Shared user path (RSA):**

```
wrappedKey (base64) → RSA-OAEP unwrap with RSA private key → DEK as CryptoKey
```

To get the RSA private key for the shared path: fetch `encryptedPrivateKey` from Firestore, AES-GCM decrypt it with the master key, import as RSA CryptoKey.

Once the DEK is in hand, `EncryptionService.decryptCompleteRecord` decrypts each field using the field-specific IV stored alongside the ciphertext.

---

## Record Sharing

When a user grants someone access to a record (`SharingService.grantEncryptionAccess`):

1. Get the granter's master key from session
2. Call `RecordDecryptionService.getRecordKey` to decrypt the record DEK
3. Fetch the recipient's RSA public key from Firestore (stored plaintext at `users/{recipientUid}/encryption.publicKey`)
4. Call `SharingKeyManagementService.wrapKey` — RSA-OAEP wraps the DEK with the recipient's public key
5. Store a new `wrappedKeys` document for the recipient with `isCreator: false`

The recipient can now decrypt the DEK using their RSA private key (which only they can access, since it's encrypted with their master key). The granter never sees the recipient's private key; the recipient never sees the granter's master key. Neither party's root secret is exposed.

**Revoking access** is simple: set `isActive: false` on the recipient's `wrappedKeys` document. Their key is immediately invalidated — they can no longer call `getRecordKey` successfully.

---

## AI Chat Encryption

AI conversations are encrypted with the same key hierarchy as records, but using a dedicated key per chat rather than per record.

**Creating a chat** (`createEncryptedChat`):

1. Generate a fresh 256-bit AES-GCM chat key
2. Encrypt the chat title with the chat key
3. Store the chat key encrypted with the user's master key in `wrappedChatKeys/{chatId}_{userId}`

**Each message** is encrypted individually with the chat key. Title and message content are stored as `{ encrypted: base64, iv: base64 }` pairs in Firestore. Attachment filenames are also encrypted. Non-sensitive metadata (timestamps, message counts, MIME types, file sizes) is stored plaintext for efficient listing.

**Decryption** on load: fetch the wrapped chat key → AES-GCM decrypt with master key → decrypt each message/title with the chat key.

The AI itself receives decrypted content only within the context of a specific API call — the decryption happens client-side, the plaintext is sent to the AI API over TLS, and the response is re-encrypted before being stored. Belrose's servers never see the plaintext at rest.

### The AI Lab Exposure Problem

Client-side encryption protects data at rest in Belrose's infrastructure, but there is an inherent tension with AI features: to generate a response, the AI model must receive decrypted health data in plaintext. That plaintext travels to a third-party AI lab's servers — outside Belrose's zero-knowledge perimeter.

This is a known and acknowledged limitation. The risk depends entirely on what the AI lab does with the data once it receives it.

**Current position (Alpha):**

Most major AI APIs (Anthropic, OpenAI etc.) operate under API terms that distinguish between API usage and consumer product usage. API calls are generally not used to train models and are not retained beyond the immediate request by default. This is meaningfully different from consumer products like ChatGPT where data may be used for training. However, "generally not retained" is a contractual assurance from a third party, not a technical guarantee — Belrose cannot verify it independently.

**Step 1 — Zero-data-retention agreements:**

Before any production launch involving real patient data, Belrose will establish formal zero-data-retention (ZDR) agreements with AI providers. These are enterprise-tier contracts where the provider contractually commits to not logging, storing, or training on any data from Belrose's API calls. Anthropic, OpenAI, and other major providers offer these agreements at enterprise tier. This converts "generally not retained by policy" into a contractual obligation with legal recourse.

**Step 2 — Open-source models on Belrose-controlled infrastructure:**

The long-term target is to run open-source models (Llama, Mistral, or similar) on Belrose's own servers. This eliminates third-party exposure entirely — decrypted health data never leaves infrastructure under Belrose's direct control.

The tradeoff is operational cost and model capability versus frontier API models, but for health data at least the option of a privacy guarantee is worth it. This is the architecture that achieves true end-to-end zero-knowledge for AI features.

**Current user disclosure:**

Until ZDR agreements and self-hosted models are in place, users should be informed (at the point of using AI features) that health data shared in AI conversations is transmitted to a third-party AI provider under their API privacy terms. This is consistent with how the rest of the healthcare industry handles AI — but it should be an informed choice, not a hidden implementation detail.

| Stage            | Third-party exposure     | Contractual protection   |
| ---------------- | ------------------------ | ------------------------ |
| Alpha (current)  | AI lab API servers       | API terms only — no ZDR  |
| Pre-production   | AI lab API servers       | ZDR agreement in place   |
| Long-term target | None — self-hosted model | Full technical guarantee |

---

## Storage Encryption

Files uploaded to Firebase Storage (record attachments, images) are encrypted
client-side before upload. The encrypted bytes are stored in Storage; the IV is
either prepended to the file (first 12 bytes) or stored separately depending on
the context. The file is decrypted after download using the same record DEK used
for the text fields of that record.

This means Firebase Storage holds only ciphertext. Even with direct Storage access, the files are unreadable without the record DEK, which requires the user's master key to unwrap.

---

## What Belrose Can and Cannot See

| Data                                      | Stored as                               | Belrose can read? |
| ----------------------------------------- | --------------------------------------- | ----------------- |
| Record content (FHIR, text, files)        | AES-GCM ciphertext                      | No                |
| Record DEKs (wrappedKeys)                 | AES or RSA ciphertext                   | No                |
| Master key                                | AES-GCM ciphertext (KEK-wrapped)        | No                |
| RSA private key                           | AES-GCM ciphertext (master-key-wrapped) | No                |
| Signal private keys                       | IndexedDB only, never uploaded          | No                |
| AI chat messages                          | AES-GCM ciphertext                      | No                |
| Recovery key hash                         | SHA-256 hash                            | Hash only         |
| RSA public key                            | Plaintext                               | Yes               |
| Record metadata (timestamps, IDs)         | Plaintext                               | Yes               |
| Chat metadata (message count, timestamps) | Plaintext                               | Yes               |
| File metadata (MIME type, size)           | Plaintext                               | Yes               |
| User profile (name/email)                 | Plaintext                               | Yes               |
| Phone number (future 2FA)                 | Plaintext                               | Yes               |

**Why profile data is stored in plaintext:**

Name, email, and eventually phone number are stored unencrypted in the `users/{uid}` Firestore document. This is a deliberate and necessary exception to the zero-knowledge model for three reasons:

- **Identity verification** — verifying that a user is who they claim to be requires Belrose to be able to read and validate their identity information. A zero-knowledge system cannot verify an identity it cannot see.
- **Email delivery** — sending verification emails, notifications, and account recovery communications requires access to the user's email address.
- **Future 2FA** — phone-based two-factor authentication requires the server to be able to initiate an SMS or call to the registered number.

The boundary we are drawing is that: anything required to operate the account is plaintext; anything that is the health content of the account, records, AI Chats, messages, files, is encrypted.

---

## Encryption Primitives Reference

| Purpose                     | Algorithm                               | Key Size                   |
| --------------------------- | --------------------------------------- | -------------------------- |
| Record/file encryption      | AES-GCM                                 | 256-bit                    |
| Master key wrapping         | AES-GCM                                 | 256-bit                    |
| Password-to-KEK derivation  | PBKDF2 + SHA-256                        | 100,000 iterations         |
| Record sharing key wrapping | RSA-OAEP + SHA-256                      | 2048-bit                   |
| Recovery key encoding       | BIP-39 mnemonic                         | 24 words (256-bit entropy) |
| Recovery key verification   | SHA-256 hash                            | —                          |
| Messaging                   | Signal Protocol (X3DH + Double Ratchet) | —                          |

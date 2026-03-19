# Paymaster

## Why This Exists

Every write operation on the Ethereum blockchai nrequires the sender to pay "gas" - a fee for the computation. Without the paymaster, every user would need to have ETH in their wallet just to share a record or post a verification, creating a terrible UX and a significant barrier to adoption.

The Belrose Paymaster uses ERC-4337 Account Abstraction and Pimlico's bundler to allow Belrose to sponsor gas costs on behalf of users, making blockchain operations like sharing a record or anchoring a record (see HealthRecordCore and MemberRoleManager contracts) feel like a normal Web2 App.

## System Architecture

| Component          | File                                      | Responsibility                                         |
| ------------------ | ----------------------------------------- | ------------------------------------------------------ |
| Smart Contract     | `BelrosePaymaster.sol`                    | On-chain validation — is this sponsorship legitimate?  |
| Backend Function   | `paymaster.ts`                            | Server-side checks — has this user earned sponsorship? |
| Frontend Router    | `paymasterService.ts`                     | Routes transactions through the right path             |
| Deployment/Funding | `deployPaymaster.js` / `fundPaymaster.js` | Infrastructure — keeps ETH in the system               |

## Full Flow

### Step 1 - User triggers an on-chain action (Frontend)

User does something in the app that requires a blockchain write (e.g. sharing a record, posting a verification). Frontend goes through smartContract logic and then builds a 'UserOperation' — ERC-4337's equivalent of a transaction — but instead of signing it and paying gas directly, it first needs a sponsorship signature.

### Step 2 - Frontend Requests Sponsorship (Frontend --> Backend)

The frontend sends the `userOpHash` (a hash of the UserOperation) to the Firebase
backend function `signSponsorship` in `paymaster.ts`.

### Step 3 - Backend validates and signs (Backend)

The backend performs 5 checks before signing:

1. Is the user authenticated via Firebase?
2. Is their email verified?
3. Is the `userOpHash` a valid format?
4. Is the paymaster contract address correctly configured?
5. Have they exceeded their daily transaction limit? (stored in Firestore to limit daily cost exposure)

If all checks pass, the backend uses its private key to sign the `userOpHash` and
returns `paymasterAndData` — a hex string containing:

```
[paymaster contract address][validUntil][validAfter][ECDSA signature]
```

### Step 4 - Frontend builds the complete UserOperation (Frontend)

The front end now has everything it needs. It assembles the final `UserOperation` with the `paymasterAndData` from Step 3 and sends it to Pimlico (our bundler).

### Step 5 - Bundler submits to EntryPoint (Pimlico --> Ethereum)

Pimlico wraps the `UserOperation` in a standard Ethereum transaction and calls `handleOps` on the ERC-4337 EntryPoint contract (a contract deployed by the Ethereum Foundation at the same address on every chain).

### Step 6 - On-chain validation (EntryPoint --> BelrosePaymaster.sol)

The EntryPoint calls `validatePaymasterUserOp` on our paymaster contract. This is the final security check - the contract independently verifies the sponsorship is legitimate before allowing Belrose's deposited ETH to be used for gas.

### Step 7 - Transaction executes

The Entrypoint executes the user's operation and deducts gas from Belrose's deposit.

## Component Deep Dives

### BelrosePaymaster.sol

The smart contract is the on-chain gatekeeper. It's role is to make sure a compromised front/backend response doesn't get through.

**Key Variables:**

- `verifyingSigner` - The Belrose backend wallet address whose signatures the contract will accept. Only signatures from this wallet can authorize sponsorship.
- `maxCostPerUserOp` - A safety cap on how much ETH can be spent on a single operation. Prevents poorly optimized transactions from draining the deposit.
- `usedSignatures` - A mapping of signatures that have already been used. Prevents replay attacks.

**`validatePaymasterUserOp` — the main function:**

Called by the Entrypoint during the validation phase. It:

1. **Checks gas cost** rejects if over `maxCostPerUserOp`
2. **Extracts custom data** — parses `paymasterAndData` starting at byte 52
   (bytes 0–51 are the paymaster address and gas limits set by the EntryPoint
   standard). Extracts `validUntil`, `validAfter`, and the ECDSA signature.
3. **Handles the circular reference problem** — the UserOperation contains the
   signature, but the signature was computed over a hash of the UserOperation. To
   break this circularity, `getHashWithZeroSignature` replaces the real signature
   with 65 zero bytes before hashing, producing a stable hash both sides can agree on.
4. **Recovers the signer** — uses ECDSA `recover()` on the stable hash to determine
   which private key produced the signature. If it matches `verifyingSigner`, the
   sponsorship is approved.
5. **Returns validation data** — packages the time window (`validAfter`/`validUntil`)
   into the format the EntryPoint expects.

Note: Replaying a valid signature is effectively impossible, the signature is bound to the specific UserOperation hash including sender address, nonce, calldata, and gas params. Reconstructing this for an attacker is effectively impossible without breaking keccak256. Also 5-minute expiry window (see frontend paymasterService.ts --> getFinalPaymasterData, and backend paymaster.ts --> build signature) provides extra protection

**A note on ECDSA:**
ECDSA (Elliptic Curve Digital Signature Algorithm) is how Ethereum proves who signed
something. The math works like this:

- The signer uses their private key + a random value `k` to produce a signature `(r, s)`
- Anyone can take `(r, s)` + the original message hash and _recover_ the signer's
  public address — without ever seeing the private key
- If the recovered address matches `verifyingSigner`, the contract knows Belrose's
  backend approved this transaction

This is more secure and efficient than RSA for blockchain use: smaller key sizes,
faster signing, and native support in Ethereum's EVM.

---

### paymaster.ts (Backend Firebase Function)

The backend is the business logic layer - it enforces Belrose's sponsorship policy before the cryptographic signing happens.

**`signSponsorship` — the entry point:**

The function called by the frontend. Runs all the validation checks (auth, email, verification, rate limits) before delegating to `buildPaymasterAndData`.

**`buildPaymasterAndData` - the signing function:**

1. ** Clamp the time window server-side** - computes `safeValidUntil = Math.min(clientValidUntil, now+300)`. The purpose of this calculation is that even if a compromised frontend sends a far-future `validUntil`, the backend doesnot sign a window longer than 5 minutes. `validAfter` is client-provided and used as-is (always `0` in practice).
2. **Builds a message hash** using Keccak256 over: chain ID + paymaster contract address + userOpHash + safeValidUntil + validAfter. Binding to chain ID and contract address ensures the signature cannot be replayed on a different chain or a different paymaster contract.
3. **Signs the hash** with the backend private key using ECDSA, producing a 65-byte signature `(r,s,v)`.
4. **Returns both** `signature` and `safeValidUntil` so the caller has the exact value that was signed — not a locally recomputed approximation.

**Why `safeValidUntil` is returned alongside the signature:**

The backend clamps `validUntil` before signing. If the frontend were to use its own locally computed `validUntil` in the final `paymasterData`, there would be a risk of mismatch due to clock skew or the frontend using a different value entirely. Since the contract verifies the signature against whatever timestamps are in `paymasterData`, any mismatch causes rejection. Returning `safeValidUntil` from the backend makes it
the single source of truth end-to-end.

**`checkRateLimit` — rate limiting:**

Users get a limited number of sponsored transactions per day (currently 100, set high for dev — reduce before production). This function enforces that limit safely.

Why Firestore and not an in-memory variable? Three reasons:

- **Statelessness** — Cloud Functions are destroyed after each invocation. An in-memory counter would reset to zero every time.
- **Concurrent instances** — Under load, Google spins up multiple instances. Instance A and Instance B both serving the same user would each see a stale count.
- **Race conditions** — Two near-simultaneous requests could both read "9/10 used", both approve, and leave the user at 11/10. Firestore's `runTransaction` locks the document so the second request must wait for the first to commit before reading.

**Repeat request handling:**

The rate limiter tracks `lastUserOpHash`. If the same hash comes in twice (which happens because `getPaymasterStubData` and `getPaymasterData` both trigger backend calls during the two-phase flow), the second call is allowed through without incrementing the counter. One transaction = one charge against the daily limit.

---

### paymasterService.ts (Frontend) — The Transaction Router

`paymasterService.ts` is the single entry point for all blockchain write operations in the app. No feature service should ever call a contract directly — everything routes through here first.

**The Core Routing Decision**

1. The first, `sendTransaction` checks what kind of wallet the user has. If it's generated then Belrose pays gas. If not they pay it themselves Generated wallets are generated by Belrose's registration flow. They have no ETH of their own so need the sponsored path.

**The Sponsored Transaction Flow in Detail**

For generated wallets, `sendSponsoredTransaction` calls `createSmartAccountClient`, which builds a `smartAccountClient` from four pieces:

**1. The user's smart account (`simpleAccount`)**
Derived deterministically from the user's private key using `toSimpleSmartAccount`. This is an ERC-4337 contract wallet — Every new user has their smart account computed, saved to Firestore, and registered on-chain during registration via `SmartAccountService.ensureFullyInitialized()` — so by the time they ever trigger a transaction, the on-chain setup should already be done.

`PaymasterService` reconstructs the `simpleAccount` object fresh on every transaction regardless — not because it needs to register it again, but because `permissionless.js` needs the actual account object (not just the address string) to orchestrate the UserOperation.

**2. The public client**
A read-only viem client for reading chain state (nonces, gas prices etc.). Doesn't need any keys.

**3. The Pimlico bundler client**
Handles fee estimation (`estimateFeesPerGas`) and eventual submission. Pimlico is a third-party bundler service that receives UserOperations and submits them as real Ethereum transactions.

**4. The paymaster configuration — two callbacks**

```typescript
paymaster: {
  getPaymasterStubData: async (userOperation) => { ... },
  getPaymasterData:     async (userOperation) => { ... },
}
```

`getPaymasterStubData` is called first, for gas estimation. The bundler needs to simulate the transaction to estimate gas limits, but needs some paymasterData. We return a valid but fake signature - zerod-out bytes in the right shape. Backend not called yet.

`getPaymasterData` is called second, after gas is estimated, the bundler then asks for the real signature for broadcast. At this point we:

1. Computer the `userOpHash` using estimated gas values and a zeroed placeholder (same circular reference trick as contract)
2. Send the hash to the backend via `requestSponsorship`
3. Receive back `{signature, validUntil} ` - using the backend's confirmed `validUntil`, not the locally computed one
4. Bulid final `paymasterData` using `confirmedValidUntilHex` from the backend response

**The two-phase approach exists because of a chicken-and-egg problem:** you need
gas estimates to compute the hash, but you need the hash to get the signature, and
you need the signature to have a valid UserOperation. Stub data breaks the cycle.

**How Feature Services Use This**

Any feature that needs to write to the blockchain calls `PaymasterService.sendTransaction`
with a simple `{ to, data, value }` object.

Example from blockchainHealthRecordService.ts:

```typescript
  /** Execute a write transaction via PaymasterService */
  private static async executeWrite(
    functionName: string,
    args: unknown[]
  ): Promise<TransactionResult> {
    const data = this.encodeFunctionData(functionName, args);

    const txHash = await PaymasterService.sendTransaction({
      to: HEALTH_RECORD_CORE_ADDRESS as `0x${string}`,
      data,
    });

    return { txHash, blockNumber: 0 };
  }
```

The feature service is responsible for encoding the calldata (using viem's `encodeFunctionData`). PaymasterService is responsible for everything after that — routing, sponsorship, submission, and returning a transaction hash.

**What PaymasterService Does NOT Do**

- It doesn't know what contract function is being called
- It doesn't validate business logic (that's the contract's job)
- It doesn't retry failed transactions
- It doesn't wait for confirmation — it returns the hash as soon as the UserOperation is accepted by the bundler. The calling service is responsible for waiting and handling reverts if needed.

---

## Funding the Paymaster

The paymaster must maintain an ETH deposit with the EntryPoint to cover gas costs. This is separate from anyone's personal wallet — it's Belrose's operational balance.

**Initial deposit** — handled by `deployPaymaster.js` during contract deployment.

**Replenishing** — run when the balance gets low (visible as a warning in the Member Dashboard):

```bash
npx hardhat run scripts/fundPaymaster.js --network sepolia
```

The current deposit balance is monitored in the admin dashboard via the `usePaymasterDeposit` hook. A red warning appears when the balance drops below 0.01 ETH.

**Money flow:**

```
Belrose wallet (PRIVATE_KEY in .env)
    → deposits ETH into EntryPoint
        → EntryPoint deducts gas per sponsored UserOperation
```

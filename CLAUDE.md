# Belrose Health — Claude Code Context

## Project Overview

Belrose Health is a **decentralized, patient-controlled health records platform**. Patients can collect, standardize (FHIR), store with end-to-end encryption, and share their health data as desired. A credibility system involving record hashes, verifications, and disputes is stored on the Base blockchain. All health data is stored with end-to-end encryption. NEVER store plaintext health data.

Key concepts:

- **E2EE**: All records are encrypted client-side (AES + RSA key exchange) before touching Firebase
- **Blockchain verification**: Record hashes written to `HealthRecordCore.sol` on Base; Pimlico enables gasless transactions via Account Abstraction
- **FHIR**: Medical records are normalized to FHIR format
- **Permissions**: Granular, patient-controlled sharing with providers and trustees
- **AI**: Claude (Anthropic) and Gemini used for record analysis and chat

## Monorepo Structure

Three npm workspaces (`packages/*` in root `package.json`):

```
/src                    # React 19 frontend (Vite)
/functions              # Firebase Cloud Functions (Node 22, TypeScript)
/packages/shared        # Shared types/utils — used by both frontend and functions
/contracts              # Solidity smart contracts (Hardhat)
/docs                   # Project documentation
```

## Tech Stack

| Layer        | Technology                                                         |
| ------------ | ------------------------------------------------------------------ |
| Frontend     | React 19, Vite 6, TypeScript 5 (strict mode)                       |
| Routing      | React Router v7                                                    |
| Styling      | Tailwind CSS 3, Radix UI                                           |
| State        | TanStack React Query 5                                             |
| Backend      | Firebase (Auth, Firestore, Cloud Storage, Cloud Functions)         |
| Blockchain   | Solidity, Hardhat, Viem + Ethers.js, Pimlico (Account Abstraction) |
| Networks     | Base Sepolia (dev), Base mainnet (prod)                            |
| Encryption   | AES (records), RSA (key exchange) — all client-side                |
| AI           | Anthropic Claude, Google Gemini                                    |
| Payments     | Stripe                                                             |
| Docs/Medical | FHIR, PDF.js, Tesseract.js OCR                                     |
| Analytics    | Plausible (privacy-first)                                          |

## Key Commands

**Frontend (project root):**

```bash
npm run dev          # Vite dev server with hot reload
npm run build        # Production build
npm run type-check   # TypeScript type checking (primary correctness gate — no frontend test suite)
npm run lint         # ESLint
npm run preview      # Preview production build
```

**Firebase Functions (`cd functions`):**

```bash
npm run build        # Compile TypeScript
npm run serve        # Start Firebase emulators
npm run deploy       # Deploy to Firebase
```

## Smart Contract Deployment - CRITICAL RULES

HealthRecordCore and MemberRole Manager use UUPS upgradeable proxy pattern. Proxy addresses are permanent and what frontend/users interact with. NEVER do a fresh deploy of these contracts, it would always be done manually.

### Proxy Addresses (DO NOT CHANGE)

BaseSepolia - Test Net

- MEMBER_ROLE_MANAGER BaseSepolia TestNet proxy: '0x61CcF57C332D32c4d906ac64674BBA4E10CCB07B'
- HEALTH_RECORD_CORE BaseSepolia TestNet proxy: '0xE1012A0D698cced489C47189F9DC9372d6Fb104B'

Base Mainnet

- MEMBER_ROLE_MANAGER Base Mainnet proxy: To be deployed
- HEALTH_RECORD_CORE Base Mainnet proxy: To be deployed

### Single Source of Truth for Addresses

`packages/shared/src/blockchainAddresses.core.ts` is the canonical file for all proxy/implementation
addresses — it's dependency-free so it can be consumed outside the npm workspace. Two copies are
generated from it and must never be hand-edited directly:

- `functions/src/_shared/` — synced via `npm run copy-shared` in `/functions` (part of `npm run build`)
- `contracts/scripts/_shared/` — synced via `npm run copy-shared` in `/contracts` (compiles the core
  file standalone with `tsc` since `contracts/` has no dependency on viem/frontend tooling)

Hardhat scripts that reference proxy addresses (`upgradeHealthRecordCore.js`, `upgradeMemberRoleManager.js`,
`checkImpl.js`, `checkImplMRM.js`, `wireMRM.mjs`, `verifyUpgrade.js`, `deployMemberRoleManager.mjs`,
`addUser.cjs`) import from `./_shared/blockchainAddresses.core.js` instead of hardcoding addresses.
Run `npm run copy-shared` in `/contracts` after cloning or after editing `blockchainAddresses.core.ts`
so that generated folder stays current (it's gitignored).

### The Correct Flow for Upgradeable Smart Contract Changes

**Smart Contracts (`cd contracts`):**

```bash
# 1. Compile Solidity cleanly
npm run compile
# 2. Run Hardhat tests
npm run test
# 3. Sync shared addresses (only needed if blockchainAddresses.core.ts changed or _shared/ is missing)
npm run copy-shared
# 4. run upgrade script for HealthRecord Core or MemberRoleManager
npx hardhat run scripts/upgradeHealthRecordCore.js --network baseSepolia # if HealthRecordCore changed
npx hardhat run scripts/upgradeMemberRoleManager.js --network baseSepolia #if MemberRoleManager changed
# 5. Verify on Chain
npx hardhat verify --network baseSepolia ${newImplementationAddress}
```

#6. Update implementation addresses in the repo

- Update implementation addresses in packages/shared/src/blockchainAddresses.core.ts
- Re-run `npm run copy-shared` in `/contracts` (and `/functions`) so the generated copies match

NEVER

- run npm run deploy:base directly, always go through upgrades script. It will break frontend references
- Skip Sepolia before mainnet
- Fresh deploy contracts that have a proxy - always upgrade

## Firebase Emulators (local dev)

| Service         | Port |
| --------------- | ---- |
| Emulator UI     | 4000 |
| Firestore       | 8080 |
| Cloud Functions | 5001 |
| Auth            | 9099 |
| Storage         | 9199 |

## Frontend Architecture

**Feature-based structure** under `src/features/` — 25+ self-contained feature folders, each with its own components, hooks, and types. Key features: `Auth`, `AddRecord`, `Ai`, `BlockchainWallet`, `Encryption`, `Messaging`, `Permissions`, `HealthProfile`, `ViewEditRecord`, `Sharing`, `Trustee`, `RecordBlockchainViewer`.

**Path aliases** (configured in `tsconfig.json` and `vite.config.ts`):

- `@/*` → `src/*`
- `@belrose/shared` → `packages/shared/src`

**Context providers** (wrapping the app in `src/App.tsx`): `AuthProvider`, `EncryptionProvider`, `AIChatProvider`, `OnChainActivityTrayProvider`, `LayoutProvider`, `CitationsProvider`

**Key patterns:**

- `EncryptionGate` component — enforces E2EE setup before accessing protected features
- `ProtectedRoute` component — guards authenticated pages
- React Query (`queryClient`) — all async server state
- Toasts via Sonner

**Blockchain write dialogs** — Any operation that writes to the chain shows a modal to prime the user for extra latency. Two variants:

1. **Tray pattern** (preferred when possible): The dialog advances to a `submitted` phase that renders `OnChainSubmittedContent`, which dismisses itself and hands off to `OnChainActivityTray` (bottom-right corner) so the user can continue navigating. Used in `PermissionActionDialog`, `CredibilityActionDialog`, `SubjectActionDialog`.
2. **Blocking dialog** (when the user must act after the transaction): Keep the dialog open until the user completes the next step. Used in `RegistrationProgressDialog` (user must save the recovery phrase) and `CreateDependentProgressDialog` (same reason).

## Shared Package (`packages/shared`)

Shared TypeScript library consumed by both frontend and functions. Key modules:

- `blockchainAddresses.ts` — contract addresses by network
- `permissions.ts` — permission system types
- `recordRequest.ts` — record request types
- `convertToFHIR.ts` — FHIR conversion utilities
- `belroseFields.ts` — Belrose-specific FHIR field definitions
- `aiChat.ts`, `aiImageAnalysis.ts` — AI types

When editing shared package, run `npm run copy-shared` in `/functions` to sync changes to functions.

## Smart Contracts (`contracts/`)

- `HealthRecordCore.sol` — core record storage and hash verification
- `MemberRoleManager.sol` — role-based access control
- `BelrosePaymaster.sol` — gasless transactions (Account Abstraction)

Contract addresses live in `packages/shared/src/blockchainAddresses.ts`.

## Environment Variables

Secrets are in `.env.local` (gitignored — never commit). Contains: Firebase config, Pimlico API key, Alchemy RPC URL, Stripe keys, Anthropic API key. The `.claudeignore` also blocks `.env*` files from being read by Claude.

## Testing

- **Frontend**: No test suite. `npm run type-check` is the primary correctness gate.
- **Contracts**: Hardhat tests in `/test` — run with `npm run test` inside `/contracts`.
- **Functions**: No automated tests.

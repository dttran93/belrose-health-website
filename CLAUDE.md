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

**Smart Contracts (`cd contracts`):**

```bash
npm run compile          # Compile Solidity
npm run test             # Run Hardhat tests
npm run deploy:sepolia   # Deploy to Base Sepolia testnet
npm run deploy:base      # Deploy to Base mainnet
```

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

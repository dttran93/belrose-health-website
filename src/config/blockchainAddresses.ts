// src/config/blockchainAddresses.ts
//
// Single source of truth for all deployed contract and infrastructure addresses.
//
// IMPORTANT: When redeploying any contract, update the relevant address here.
// All services, hooks, and scripts should import from this file rather than
// hardcoding addresses locally.
//

import { BlockchainRef } from '@belrose/shared';
import { baseSepolia } from 'viem/chains';
const ALCHEMY_API_KEY = import.meta.env.VITE_ALCHEMY_API_KEY;

// ============================================================================
// NETWORK INFRASTRUCTURE
// ============================================================================

export const NETWORK = {
  chainId: 84532,
  name: 'base-sepolia',
  rpcUrl: `https://base-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
  rpcUrlFallback: 'https://sepolia.base.org',
  publicRpcUrl: 'https://sepolia.basescan.org/',
  chainViem: baseSepolia,
} as const;

// ============================================================================
// ERC-4337 ACCOUNT ABSTRACTION INFRASTRUCTURE
// ============================================================================

export const AA_INFRASTRUCTURE = {
  // Canonical ERC-4337 v0.7 EntryPoint (same address on all chains)
  entryPoint: '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
} as const;

// ============================================================================
// BELROSE PAYMASTER (BelrosePaymaster.sol)
// Not upgradeable — proxy/implementation distinction does not apply
// ============================================================================

export const PAYMASTER = {
  address: '0x02422f03EcD403E1a902101D60a0Dad5bB9E71a7',
} as const;

// ============================================================================
// MEMBER ROLE MANAGER (MemberRoleManager.sol)
// UUPS upgradeable proxy — always interact via proxy address
// ******MUST MANUALLY UPDATE IN functions/src/handlers/memberRegistry.ts IF EVER UPDATED******
// ============================================================================

export const MEMBER_ROLE_MANAGER = {
  proxy: '0xdF9583C25E234A34a1E47d9830722123CA228a1a',
  implementation: '0x4383C4e5EaCDE9F8cEc6c692f5d939BaaF6ff038',
  deploymentBlock: 41800192,
} as const;

// ============================================================================
// HEALTH RECORD CORE (HealthRecordCore.sol)
// UUPS upgradeable proxy — always interact via proxy address
// ============================================================================

export const HEALTH_RECORD_CORE = {
  proxy: '0x66A8b985C61205e63D7d7DEA72Dfa5849a3e66De',
  implementation: '0x89839E0c266045c9EA06FdA11152B48129e76Ef2',
  deploymentBlock: 41800191,
} as const;

// ============================================================================
// CONVENIENCE ALIASES
// For files that just need a single address with a simple import
// ============================================================================

export const CONTRACT_ADDRESSES = {
  paymaster: PAYMASTER.address,
  memberRoleManager: MEMBER_ROLE_MANAGER.proxy,
  healthRecordCore: HEALTH_RECORD_CORE.proxy,
  entryPoint: AA_INFRASTRUCTURE.entryPoint,
} as const;

// ============================================================================
// BLOCKCHAIN REF HELPERS
// ============================================================================

export function buildBlockchainRef(
  txHash: string,
  blockNumber: number,
  contractAddress: string
): BlockchainRef {
  return {
    txHash,
    chainId: NETWORK.chainId,
    blockNumber,
    contractAddress,
  };
}

// Pre-bound helpers for each contract — chainId is always pulled from NETWORK
export const buildMemberRegistryRef = (txHash: string, blockNumber: number) =>
  buildBlockchainRef(txHash, blockNumber, MEMBER_ROLE_MANAGER.proxy);

export const buildHealthRecordRef = (txHash: string, blockNumber: number) =>
  buildBlockchainRef(txHash, blockNumber, HEALTH_RECORD_CORE.proxy);

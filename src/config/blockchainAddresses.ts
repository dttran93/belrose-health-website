// src/config/blockchainAddresses.ts
//
// Single source of truth for all deployed contract and infrastructure addresses.
//
// IMPORTANT: When redeploying any contract, update the relevant address here.
// All services, hooks, and scripts should import from this file rather than
// hardcoding addresses locally.
//

// ============================================================================
// NETWORK INFRASTRUCTURE
// ============================================================================

export const NETWORK = {
  chainId: 11155111,
  name: 'sepolia',
  rpcUrl: 'https://ethereum-sepolia.publicnode.com',
  rpcUrlFallback: 'https://1rpc.io/sepolia',
  etherscanBaseUrl: 'https://sepolia.etherscan.io',
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
  address: '0x967e757609E1118E7164e51A204772a14804E253',
} as const;

// ============================================================================
// MEMBER ROLE MANAGER (MemberRoleManager.sol)
// UUPS upgradeable proxy — always interact via proxy address
// ******MUST MANUALLY UPDATE IN functions/src/handlers/memberRegistry.ts IF EVER UPDATED******
// ============================================================================

export const MEMBER_ROLE_MANAGER = {
  proxy: '0xC31477f563dC8f7529Ba6AE7E410ABdB84C27d7C',
  implementation: '0x936cf99beacc5ded69c6630a9d83142ec78332cf',
  deploymentBlock: 10190794,
} as const;

// ============================================================================
// HEALTH RECORD CORE (HealthRecordCore.sol)
// UUPS upgradeable proxy — always interact via proxy address
// ============================================================================

export const HEALTH_RECORD_CORE = {
  proxy: '0x97F9eD2af3f9a30Eac958D0994a0F131Eda11A57',
  implementation: '0x6D3bb289FdAC00d758311619EC034C7405666f63',
  deploymentBlock: 10190796,
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

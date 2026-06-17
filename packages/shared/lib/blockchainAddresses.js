// src/config/blockchainAddresses.ts
//
// Single source of truth for all deployed contract and infrastructure addresses.
//
// IMPORTANT: When redeploying any contract, update the relevant address here.
// All services, hooks, and scripts should import from this file rather than
// hardcoding addresses locally.
//
import { baseSepolia } from 'viem/chains';
// ============================================================================
// NETWORK INFRASTRUCTURE
// ============================================================================
export const NETWORK = {
    chainId: 84532,
    name: 'base-sepolia',
    rpcUrlFallback: 'https://base-sepolia-rpc.publicnode.com',
    explorerUrl: 'https://sepolia.basescan.org/',
    chainViem: baseSepolia,
};
//Has to be built in front/backend because it requires different apiKeys
export function buildRpcUrl(apiKey) {
    return `https://base-sepolia.g.alchemy.com/v2/${apiKey}`;
}
// ============================================================================
// ERC-4337 ACCOUNT ABSTRACTION INFRASTRUCTURE
// ============================================================================
export const AA_INFRASTRUCTURE = {
    // Canonical ERC-4337 v0.7 EntryPoint (same address on all chains)
    entryPoint: '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
};
// ============================================================================
// BELROSE PAYMASTER (BelrosePaymaster.sol)
// Not upgradeable — proxy/implementation distinction does not apply
// ============================================================================
export const PAYMASTER = {
    address: '0x02422f03EcD403E1a902101D60a0Dad5bB9E71a7',
    dailySponsorLimit: 100, // Max sponsored txs per user per day. Set high so we can test in dev. Change in future
};
export function buildBundlerURL(pimlicoApiKey) {
    return `https://api.pimlico.io/v2/${NETWORK.chainId}/rpc?apikey=${pimlicoApiKey}`;
}
// ============================================================================
// MEMBER ROLE MANAGER (MemberRoleManager.sol)
// UUPS upgradeable proxy — always interact via proxy address
// ============================================================================
export const MEMBER_ROLE_MANAGER = {
    proxy: '0xdF9583C25E234A34a1E47d9830722123CA228a1a',
    implementation: '0xf3e0c2229782c270fb829bc7fe4eef17acf51dbb',
    deploymentBlock: 41800192,
};
// ============================================================================
// HEALTH RECORD CORE (HealthRecordCore.sol)
// UUPS upgradeable proxy — always interact via proxy address
// ============================================================================
export const HEALTH_RECORD_CORE = {
    proxy: '0x66A8b985C61205e63D7d7DEA72Dfa5849a3e66De',
    implementation: '0x985559cb258591967312867b0a37a058f08e92bd',
    deploymentBlock: 41800191,
};
// ============================================================================
// CONVENIENCE ALIASES
// For files that just need a single address with a simple import
// ============================================================================
export const CONTRACT_ADDRESSES = {
    paymaster: PAYMASTER.address,
    memberRoleManager: MEMBER_ROLE_MANAGER.proxy,
    healthRecordCore: HEALTH_RECORD_CORE.proxy,
    entryPoint: AA_INFRASTRUCTURE.entryPoint,
};
export function buildBlockchainRef(txHash, blockNumber, contractAddress) {
    return {
        txHash,
        chainId: NETWORK.chainId,
        blockNumber,
        contractAddress,
    };
}
// Pre-bound helpers for each contract — chainId is always pulled from NETWORK
export const buildMemberRegistryRef = (txHash, blockNumber) => buildBlockchainRef(txHash, blockNumber, MEMBER_ROLE_MANAGER.proxy);
export const buildHealthRecordRef = (txHash, blockNumber) => buildBlockchainRef(txHash, blockNumber, HEALTH_RECORD_CORE.proxy);

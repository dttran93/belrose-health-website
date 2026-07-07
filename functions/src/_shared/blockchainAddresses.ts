// src/config/blockchainAddresses.ts
//
// Frontend/functions entry point — re-exports the dependency-free core
// (see blockchainAddresses.core.ts) and adds the viem chain object, which
// isn't available in non-Node workspaces like contracts/.
//
// IMPORTANT: When redeploying any contract, update the relevant address in
// blockchainAddresses.core.ts. All services, hooks, and scripts should import
// from this file rather than hardcoding addresses locally.
//

import { baseSepolia } from 'viem/chains';
import { NETWORK_CORE } from './blockchainAddresses.core';

export * from './blockchainAddresses.core';

export const NETWORK = {
  ...NETWORK_CORE,
  chainViem: baseSepolia,
} as const;

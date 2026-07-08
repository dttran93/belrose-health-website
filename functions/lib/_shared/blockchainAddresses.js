"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NETWORK = void 0;
const chains_1 = require("viem/chains");
const blockchainAddresses_core_1 = require("./blockchainAddresses.core");
__exportStar(require("./blockchainAddresses.core"), exports);
exports.NETWORK = {
    ...blockchainAddresses_core_1.NETWORK_CORE,
    chainViem: chains_1.baseSepolia,
};
//# sourceMappingURL=blockchainAddresses.js.map
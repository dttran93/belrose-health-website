"use strict";
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
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateWallet = generateWallet;
exports.encryptPrivateKey = encryptPrivateKey;
// functions/src/services/backendWalletService.ts
const ethers_1 = require("ethers");
const crypto = __importStar(require("crypto"));
/**
 * Generates a new Ethereum wallet
 */
function generateWallet() {
    const wallet = ethers_1.ethers.Wallet.createRandom();
    return {
        address: wallet.address,
        privateKey: wallet.privateKey,
        mnemonic: wallet.mnemonic?.phrase,
    };
}
/**
 * Encrypts a private key with user's encryption password
 * Uses AES-256-GCM encryption with PBKDF2 key derivation
 */
function encryptPrivateKey(privateKey, encryptionPassword) {
    const algorithm = 'aes-256-gcm';
    // Generate salt for key derivation
    const salt = crypto.randomBytes(32);
    // Derive key from password using PBKDF2 (matches frontend)
    const key = crypto.pbkdf2Sync(encryptionPassword, salt, 100000, 32, 'sha256');
    // Generate initialization vector
    const iv = crypto.randomBytes(16);
    // Encrypt
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(privateKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    // Get auth tag for verification
    const authTag = cipher.getAuthTag();
    return {
        encryptedKey: encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        salt: salt.toString('hex'),
    };
}
//# sourceMappingURL=backendWalletService.js.map
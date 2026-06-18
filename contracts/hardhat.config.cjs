require('@nomicfoundation/hardhat-toolbox');
require('@openzeppelin/hardhat-upgrades');
require('hardhat-contract-sizer');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
require('dotenv').config(); // also pick up local .env if present

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    compilers: [
      {
        version: '0.8.24',
        settings: {
          optimizer: { enabled: true, runs: 200 },
          viaIR: true,
          evmVersion: 'cancun',
        },
      },
    ],
  },
  paths: {
    sources: './smartContracts',
  },
  contractSizer: {
    alphaSort: true,
    runOnCompile: false,
    strict: false,
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    localhost: {
      url: 'http://127.0.0.1:8545',
    },
    // ── Testnets ──────────────────────────────────────────────────────────────
    sepolia: {
      url: 'https://1rpc.io/sepolia',
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 11155111,
    },
    baseSepolia: {
      url: process.env.VITE_ALCHEMY_API_KEY
        ? `https://base-sepolia.g.alchemy.com/v2/${process.env.VITE_ALCHEMY_API_KEY}`
        : 'https://sepolia.base.org',
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 84532,
      timeout: 120000,
    },
    // ── Mainnets ──────────────────────────────────────────────────────────────
    base: {
      url: 'https://mainnet.base.org',
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 8453,
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
    customChains: [
      {
        network: 'baseSepolia',
        chainId: 84532,
        urls: {
          apiURL: 'https://api-sepolia.basescan.org/api',
          browserURL: 'https://sepolia.basescan.org',
        },
      },
      {
        network: 'base',
        chainId: 8453,
        urls: {
          apiURL: 'https://api.basescan.org/api',
          browserURL: 'https://basescan.org',
        },
      },
    ],
  },
  sourcify: {
    enabled: false,
  },
  typechain: {
    outDir: '../packages/shared/src/typechain',
    target: 'ethers-v6',
    dontOverrideCompile: false, // toolbox sets this to true for .cjs config files — override it
  },
};

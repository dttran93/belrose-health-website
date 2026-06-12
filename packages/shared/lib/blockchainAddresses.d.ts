export declare const NETWORK: {
    readonly chainId: 84532;
    readonly name: "base-sepolia";
    readonly rpcUrlFallback: "https://sepolia.base.org";
    readonly explorerUrl: "https://sepolia.basescan.org/";
    readonly chainViem: {
        blockExplorers: {
            readonly default: {
                readonly name: "Basescan";
                readonly url: "https://sepolia.basescan.org";
                readonly apiUrl: "https://api-sepolia.basescan.org/api";
            };
        };
        blockTime: 2000;
        contracts: {
            readonly disputeGameFactory: {
                readonly 11155111: {
                    readonly address: "0xd6E6dBf4F7EA0ac412fD8b65ED297e64BB7a06E1";
                };
            };
            readonly l2OutputOracle: {
                readonly 11155111: {
                    readonly address: "0x84457ca9D0163FbC4bbfe4Dfbb20ba46e48DF254";
                };
            };
            readonly portal: {
                readonly 11155111: {
                    readonly address: "0x49f53e41452c74589e85ca1677426ba426459e85";
                    readonly blockCreated: 4446677;
                };
            };
            readonly l1StandardBridge: {
                readonly 11155111: {
                    readonly address: "0xfd0Bf71F60660E2f608ed56e1659C450eB113120";
                    readonly blockCreated: 4446677;
                };
            };
            readonly multicall3: {
                readonly address: "0xca11bde05977b3631167028862be2a173976ca11";
                readonly blockCreated: 1059647;
            };
            readonly gasPriceOracle: {
                readonly address: "0x420000000000000000000000000000000000000F";
            };
            readonly l1Block: {
                readonly address: "0x4200000000000000000000000000000000000015";
            };
            readonly l2CrossDomainMessenger: {
                readonly address: "0x4200000000000000000000000000000000000007";
            };
            readonly l2Erc721Bridge: {
                readonly address: "0x4200000000000000000000000000000000000014";
            };
            readonly l2StandardBridge: {
                readonly address: "0x4200000000000000000000000000000000000010";
            };
            readonly l2ToL1MessagePasser: {
                readonly address: "0x4200000000000000000000000000000000000016";
            };
        };
        ensTlds?: readonly string[] | undefined;
        id: 84532;
        name: "Base Sepolia";
        nativeCurrency: {
            readonly name: "Sepolia Ether";
            readonly symbol: "ETH";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://sepolia.base.org"];
            };
        };
        sourceId: 11155111;
        testnet: true;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: import("viem").ChainFees<undefined> | undefined;
        formatters: {
            readonly block: {
                exclude: [] | undefined;
                format: (args: import("viem/chains").OpStackRpcBlock, action?: string | undefined) => {
                    baseFeePerGas: bigint | null;
                    blobGasUsed: bigint;
                    difficulty: bigint;
                    excessBlobGas: bigint;
                    extraData: import("viem").Hex;
                    gasLimit: bigint;
                    gasUsed: bigint;
                    hash: `0x${string}` | null;
                    logsBloom: `0x${string}` | null;
                    miner: import("abitype").Address;
                    mixHash: import("viem").Hash;
                    nonce: `0x${string}` | null;
                    number: bigint | null;
                    parentBeaconBlockRoot?: `0x${string}` | undefined;
                    parentHash: import("viem").Hash;
                    receiptsRoot: import("viem").Hex;
                    sealFields: import("viem").Hex[];
                    sha3Uncles: import("viem").Hash;
                    size: bigint;
                    stateRoot: import("viem").Hash;
                    timestamp: bigint;
                    totalDifficulty: bigint | null;
                    transactions: `0x${string}`[] | import("viem/chains").OpStackTransaction<boolean>[];
                    transactionsRoot: import("viem").Hash;
                    uncles: import("viem").Hash[];
                    withdrawals?: import("viem").Withdrawal[] | undefined | undefined;
                    withdrawalsRoot?: `0x${string}` | undefined;
                } & {};
                type: "block";
            };
            readonly transaction: {
                exclude: [] | undefined;
                format: (args: import("viem/chains").OpStackRpcTransaction, action?: string | undefined) => ({
                    blockHash: `0x${string}` | null;
                    blockNumber: bigint | null;
                    blockTimestamp?: bigint | undefined;
                    from: import("abitype").Address;
                    gas: bigint;
                    hash: import("viem").Hash;
                    input: import("viem").Hex;
                    nonce: number;
                    r: import("viem").Hex;
                    s: import("viem").Hex;
                    to: import("abitype").Address | null;
                    transactionIndex: number | null;
                    typeHex: import("viem").Hex | null;
                    v: bigint;
                    value: bigint;
                    yParity: number;
                    gasPrice?: undefined | undefined;
                    maxFeePerBlobGas?: undefined | undefined;
                    maxFeePerGas: bigint;
                    maxPriorityFeePerGas: bigint;
                    isSystemTx?: boolean;
                    mint?: bigint | undefined | undefined;
                    sourceHash: import("viem").Hex;
                    type: "deposit";
                } | {
                    r: import("viem").Hex;
                    s: import("viem").Hex;
                    v: bigint;
                    to: import("abitype").Address | null;
                    from: import("abitype").Address;
                    gas: bigint;
                    nonce: number;
                    value: bigint;
                    blockHash: `0x${string}` | null;
                    blockNumber: bigint | null;
                    blockTimestamp?: bigint | undefined;
                    hash: import("viem").Hash;
                    input: import("viem").Hex;
                    transactionIndex: number | null;
                    typeHex: import("viem").Hex | null;
                    accessList?: undefined | undefined;
                    authorizationList?: undefined | undefined;
                    blobVersionedHashes?: undefined | undefined;
                    chainId?: number | undefined;
                    yParity?: undefined | undefined;
                    type: "legacy";
                    gasPrice: bigint;
                    maxFeePerBlobGas?: undefined | undefined;
                    maxFeePerGas?: undefined | undefined;
                    maxPriorityFeePerGas?: undefined | undefined;
                    isSystemTx?: undefined | undefined;
                    mint?: undefined | undefined;
                    sourceHash?: undefined | undefined;
                } | {
                    blockHash: `0x${string}` | null;
                    blockNumber: bigint | null;
                    blockTimestamp?: bigint | undefined;
                    from: import("abitype").Address;
                    gas: bigint;
                    hash: import("viem").Hash;
                    input: import("viem").Hex;
                    nonce: number;
                    r: import("viem").Hex;
                    s: import("viem").Hex;
                    to: import("abitype").Address | null;
                    transactionIndex: number | null;
                    typeHex: import("viem").Hex | null;
                    v: bigint;
                    value: bigint;
                    yParity: number;
                    accessList: import("viem").AccessList;
                    authorizationList?: undefined | undefined;
                    blobVersionedHashes?: undefined | undefined;
                    chainId: number;
                    type: "eip2930";
                    gasPrice: bigint;
                    maxFeePerBlobGas?: undefined | undefined;
                    maxFeePerGas?: undefined | undefined;
                    maxPriorityFeePerGas?: undefined | undefined;
                    isSystemTx?: undefined | undefined;
                    mint?: undefined | undefined;
                    sourceHash?: undefined | undefined;
                } | {
                    blockHash: `0x${string}` | null;
                    blockNumber: bigint | null;
                    blockTimestamp?: bigint | undefined;
                    from: import("abitype").Address;
                    gas: bigint;
                    hash: import("viem").Hash;
                    input: import("viem").Hex;
                    nonce: number;
                    r: import("viem").Hex;
                    s: import("viem").Hex;
                    to: import("abitype").Address | null;
                    transactionIndex: number | null;
                    typeHex: import("viem").Hex | null;
                    v: bigint;
                    value: bigint;
                    yParity: number;
                    accessList: import("viem").AccessList;
                    authorizationList?: undefined | undefined;
                    blobVersionedHashes?: undefined | undefined;
                    chainId: number;
                    type: "eip1559";
                    gasPrice?: undefined | undefined;
                    maxFeePerBlobGas?: undefined | undefined;
                    maxFeePerGas: bigint;
                    maxPriorityFeePerGas: bigint;
                    isSystemTx?: undefined | undefined;
                    mint?: undefined | undefined;
                    sourceHash?: undefined | undefined;
                } | {
                    blockHash: `0x${string}` | null;
                    blockNumber: bigint | null;
                    blockTimestamp?: bigint | undefined;
                    from: import("abitype").Address;
                    gas: bigint;
                    hash: import("viem").Hash;
                    input: import("viem").Hex;
                    nonce: number;
                    r: import("viem").Hex;
                    s: import("viem").Hex;
                    to: import("abitype").Address | null;
                    transactionIndex: number | null;
                    typeHex: import("viem").Hex | null;
                    v: bigint;
                    value: bigint;
                    yParity: number;
                    accessList: import("viem").AccessList;
                    authorizationList?: undefined | undefined;
                    blobVersionedHashes: readonly import("viem").Hex[];
                    chainId: number;
                    type: "eip4844";
                    gasPrice?: undefined | undefined;
                    maxFeePerBlobGas: bigint;
                    maxFeePerGas: bigint;
                    maxPriorityFeePerGas: bigint;
                    isSystemTx?: undefined | undefined;
                    mint?: undefined | undefined;
                    sourceHash?: undefined | undefined;
                } | {
                    blockHash: `0x${string}` | null;
                    blockNumber: bigint | null;
                    blockTimestamp?: bigint | undefined;
                    from: import("abitype").Address;
                    gas: bigint;
                    hash: import("viem").Hash;
                    input: import("viem").Hex;
                    nonce: number;
                    r: import("viem").Hex;
                    s: import("viem").Hex;
                    to: import("abitype").Address | null;
                    transactionIndex: number | null;
                    typeHex: import("viem").Hex | null;
                    v: bigint;
                    value: bigint;
                    yParity: number;
                    accessList: import("viem").AccessList;
                    authorizationList: import("viem").SignedAuthorizationList;
                    blobVersionedHashes?: undefined | undefined;
                    chainId: number;
                    type: "eip7702";
                    gasPrice?: undefined | undefined;
                    maxFeePerBlobGas?: undefined | undefined;
                    maxFeePerGas: bigint;
                    maxPriorityFeePerGas: bigint;
                    isSystemTx?: undefined | undefined;
                    mint?: undefined | undefined;
                    sourceHash?: undefined | undefined;
                }) & {};
                type: "transaction";
            };
            readonly transactionReceipt: {
                exclude: [] | undefined;
                format: (args: import("viem/chains").OpStackRpcTransactionReceipt, action?: string | undefined) => {
                    blobGasPrice?: bigint | undefined;
                    blobGasUsed?: bigint | undefined;
                    blockHash: import("viem").Hash;
                    blockNumber: bigint;
                    blockTimestamp?: bigint | undefined;
                    contractAddress: import("abitype").Address | null | undefined;
                    cumulativeGasUsed: bigint;
                    effectiveGasPrice: bigint;
                    from: import("abitype").Address;
                    gasUsed: bigint;
                    logs: import("viem").Log<bigint, number, false>[];
                    logsBloom: import("viem").Hex;
                    root?: `0x${string}` | undefined;
                    status: "success" | "reverted";
                    to: import("abitype").Address | null;
                    transactionHash: import("viem").Hash;
                    transactionIndex: number;
                    type: import("viem").TransactionType;
                    l1GasPrice: bigint | null;
                    l1GasUsed: bigint | null;
                    l1Fee: bigint | null;
                    l1FeeScalar: number | null;
                } & {};
                type: "transactionReceipt";
            };
        };
        prepareTransactionRequest?: ((args: import("viem").PrepareTransactionRequestParameters, options: {
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<import("viem").PrepareTransactionRequestParameters>) | [fn: ((args: import("viem").PrepareTransactionRequestParameters, options: {
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<import("viem").PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers: {
            readonly transaction: typeof import("viem/chains").serializeTransactionOpStack;
        };
        verifyHash?: ((client: import("viem").Client, parameters: import("viem").VerifyHashActionParameters) => Promise<import("viem").VerifyHashActionReturnType>) | undefined;
        readonly network: "base-sepolia";
    };
};
export declare function buildRpcUrl(apiKey: string): string;
export declare const AA_INFRASTRUCTURE: {
    readonly entryPoint: "0x0000000071727De22E5E9d8BAf0edAc6f37da032";
};
export declare const PAYMASTER: {
    readonly address: "0x02422f03EcD403E1a902101D60a0Dad5bB9E71a7";
    readonly dailySponsorLimit: 100;
};
export declare function buildBundlerURL(pimlicoApiKey: string): string;
export declare const MEMBER_ROLE_MANAGER: {
    readonly proxy: "0xdF9583C25E234A34a1E47d9830722123CA228a1a";
    readonly implementation: "0x97f9ed2af3f9a30eac958d0994a0f131eda11a57";
    readonly deploymentBlock: 41800192;
};
export declare const HEALTH_RECORD_CORE: {
    readonly proxy: "0x66A8b985C61205e63D7d7DEA72Dfa5849a3e66De";
    readonly implementation: "0x985559cb258591967312867b0a37a058f08e92bd";
    readonly deploymentBlock: 41800191;
};
export declare const CONTRACT_ADDRESSES: {
    readonly paymaster: "0x02422f03EcD403E1a902101D60a0Dad5bB9E71a7";
    readonly memberRoleManager: "0xdF9583C25E234A34a1E47d9830722123CA228a1a";
    readonly healthRecordCore: "0x66A8b985C61205e63D7d7DEA72Dfa5849a3e66De";
    readonly entryPoint: "0x0000000071727De22E5E9d8BAf0edAc6f37da032";
};
export interface BlockchainRef {
    txHash: string;
    chainId: number;
    blockNumber: number;
    contractAddress: string;
}
export declare function buildBlockchainRef(txHash: string, blockNumber: number, contractAddress: string): BlockchainRef;
export declare const buildMemberRegistryRef: (txHash: string, blockNumber: number) => BlockchainRef;
export declare const buildHealthRecordRef: (txHash: string, blockNumber: number) => BlockchainRef;
//# sourceMappingURL=blockchainAddresses.d.ts.map
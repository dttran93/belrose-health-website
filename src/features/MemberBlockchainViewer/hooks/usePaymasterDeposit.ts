// src/features/MemberBlockchainViewer/hooks/usePaymasterDeposit.ts

import { useState, useEffect, useCallback } from 'react';
import { createPublicClient, http, formatEther } from 'viem';
import { sepolia } from 'viem/chains';

// Your deployed paymaster address (same as in paymasterService.ts)
const PAYMASTER_ADDRESS = '0x967e757609E1118E7164e51A204772a14804E253';

// Minimal ABI - just the function we need
const PAYMASTER_ABI = [
  {
    inputs: [],
    name: 'getDeposit',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export interface PaymasterDepositData {
  depositWei: bigint; // Raw value in wei
  depositEth: string; // Formatted as ETH string
  isLow: boolean; // Warning flag if balance is low
}

export function usePaymasterDeposit(lowThresholdEth = 0.01) {
  const [deposit, setDeposit] = useState<PaymasterDepositData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDeposit = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const publicClient = createPublicClient({
        chain: sepolia,
        transport: http(),
      });

      const depositWei = await publicClient.readContract({
        address: PAYMASTER_ADDRESS,
        abi: PAYMASTER_ABI,
        functionName: 'getDeposit',
      });

      const depositEth = formatEther(depositWei);
      const isLow = parseFloat(depositEth) < lowThresholdEth;

      setDeposit({ depositWei, depositEth, isLow });
    } catch (err) {
      console.error('Failed to fetch paymaster deposit:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch deposit');
    } finally {
      setIsLoading(false);
    }
  }, [lowThresholdEth]);

  useEffect(() => {
    fetchDeposit();
  }, [fetchDeposit]);

  return { deposit, isLoading, error, refresh: fetchDeposit };
}

// src/features/BackendChainParity/lib/contracts.ts
//
// Shared read-only contract instances for parity integrity checks.
// One provider + one contract instance per contract type — no wallet required.

import { ethers } from 'ethers';
import {
  buildRpcUrl,
  HEALTH_RECORD_CORE,
  MEMBER_ROLE_MANAGER,
  HealthRecordCore__factory,
  MemberRoleManager__factory,
} from '@belrose/shared';
import type { HealthRecordCore, MemberRoleManager } from '@belrose/shared';
import { requireEnv } from '@/utils/utils';

const RPC_URL = buildRpcUrl(requireEnv('VITE_ALCHEMY_API_KEY'));

let provider: ethers.JsonRpcProvider | null = null;
let healthContract: HealthRecordCore | null = null;
let memberContract: MemberRoleManager | null = null;

function getProvider(): ethers.JsonRpcProvider {
  if (!provider) {
    provider = new ethers.JsonRpcProvider(RPC_URL);
  }
  return provider;
}

export function getHealthContract(): HealthRecordCore {
  if (!healthContract) {
    healthContract = new ethers.Contract(
      HEALTH_RECORD_CORE.proxy,
      HealthRecordCore__factory.abi,
      getProvider()
    ) as unknown as HealthRecordCore;
  }
  return healthContract;
}

export function getMemberContract(): MemberRoleManager {
  if (!memberContract) {
    memberContract = new ethers.Contract(
      MEMBER_ROLE_MANAGER.proxy,
      MemberRoleManager__factory.abi,
      getProvider()
    ) as unknown as MemberRoleManager;
  }
  return memberContract;
}

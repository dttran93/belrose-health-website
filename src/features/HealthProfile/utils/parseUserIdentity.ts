// src/features/HealthProfile/utils/parseUserIdentity.ts

import { FileObject } from '@/types/core';

export interface UserIdentity {
  // Header-level
  fullName?: string;
  dateOfBirth?: Date;
  gender?: string;
  city?: string;
  country?: string;

  // Extended
  address?: string;
  phone?: string;
  email?: string;
  maritalStatus?: string;
  languages?: string[];

  // Social determinants / extended context — free-form for now,
  // structured later once you have real data to design against
  occupation?: string;
  emergencyContact?: string;
}

export function parseIdentityFromRecord(record: FileObject): UserIdentity {
  const bundle = record.fhirData as any;

  // Find the Patient resource inside the bundle
  const patient = bundle?.entry?.find((e: any) => e.resource?.resourceType === 'Patient')?.resource;

  // Handle edge case: the record itself is a single Patient resource
  const p = patient ?? (bundle?.resourceType === 'Patient' ? bundle : null);

  if (!p) return {};

  const name = p.name?.[0];
  const fullName =
    name?.text ||
    [name?.prefix?.join(' '), name?.given?.join(' '), name?.family].filter(Boolean).join(' ') ||
    undefined;

  const dateOfBirth = p.birthDate ? new Date(p.birthDate) : undefined;
  const address = p.address?.[0];

  return {
    fullName,
    dateOfBirth,
    gender: p.gender ?? undefined,
    city: address?.city ?? undefined,
    country: address?.country ?? undefined,
    address: address?.text ?? address?.line?.join(', ') ?? undefined,
    phone: p.telecom?.find((t: any) => t.system === 'phone')?.value ?? undefined,
    email: p.telecom?.find((t: any) => t.system === 'email')?.value ?? undefined,
    maritalStatus: p.maritalStatus?.text ?? p.maritalStatus?.coding?.[0]?.display ?? undefined,
    languages:
      p.communication
        ?.map((c: any) => c.language?.text ?? c.language?.coding?.[0]?.display)
        .filter(Boolean) ?? undefined,
  };
}

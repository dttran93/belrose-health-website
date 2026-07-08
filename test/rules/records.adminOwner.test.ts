// test/rules/records.adminOwner.test.ts
//
// firestore.rules — records/{recordId} allow update — BRANCH 1 (admin/owner updating the record)

import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe } from 'vitest';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { adminOwnerCases } from './fixtures/recordPermissionMatrix';
import { runRecordUpdateCases } from './helpers/recordUpdateHarness';

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'belrose-rules-test-admin-owner',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(() => testEnv.cleanup());
beforeEach(() => testEnv.clearFirestore());

describe('firestore.rules — records/{recordId} — admin/owner branch', () => {
  runRecordUpdateCases(() => testEnv, adminOwnerCases);
});

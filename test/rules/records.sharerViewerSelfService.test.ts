// test/rules/records.sharerViewerSelfService.test.ts
//
// firestore.rules — records/{recordId} allow update — BRANCH 5 (sharer granting viewer),
// BRANCH 6 (viewer self-removal), BRANCH 6b (sharer self-removal).
//
// The last case here (sharer-demotes-self-to-viewer-denied) is a permanent regression test
// for a real bug found this session: PermissionsService.removeSharer's JS-level check allowed
// a plain sharer to demote themselves to viewer, but firestore.rules never permitted it —
// self-service can only fully leave a role, not renegotiate to a lesser tier.

import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe } from 'vitest';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { sharerViewerSelfServiceCases } from './fixtures/recordPermissionMatrix';
import { runRecordUpdateCases } from './helpers/recordUpdateHarness';

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'belrose-rules-test-sharer-viewer-self',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(() => testEnv.cleanup());
beforeEach(() => testEnv.clearFirestore());

describe('firestore.rules — records/{recordId} — sharer/viewer self-service', () => {
  runRecordUpdateCases(() => testEnv, sharerViewerSelfServiceCases);
});

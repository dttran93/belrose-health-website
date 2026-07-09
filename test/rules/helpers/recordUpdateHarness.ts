// test/rules/helpers/recordUpdateHarness.ts
//
// Shared runner for RecordPermissionCase fixtures: seeds `before` bypassing the rules
// (you can't write your test's starting state through the very rules you're testing),
// then attempts the `after` write as `callerId` and asserts allow/deny.

import { it } from 'vitest';
import { assertSucceeds, assertFails, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import type { RecordPermissionCase } from '../fixtures/recordPermissionMatrix';

export function runRecordUpdateCases(
  getTestEnv: () => RulesTestEnvironment,
  cases: RecordPermissionCase[]
) {
  cases.forEach(c => {
    it(`${c.name} -> ${c.expected}`, async () => {
      const testEnv = getTestEnv();

      await testEnv.withSecurityRulesDisabled(async ctx => {
        await ctx.firestore().doc(`records/${c.name}`).set(c.before);
      });

      const write = testEnv
        .authenticatedContext(c.callerId)
        .firestore()
        .doc(`records/${c.name}`)
        .update({ ...c.before, ...c.after });

      await (c.expected === 'allow' ? assertSucceeds(write) : assertFails(write));
    });
  });
}

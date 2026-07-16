// vitest.setup.ts
//
// Extends Vitest's `expect` with jest-dom's DOM-specific matchers (toBeInTheDocument,
// toBeDisabled, etc.) for component/hook tests. Loaded globally via vitest.config.ts's
// setupFiles — harmless for the existing node-environment service tests, since they never
// touch the DOM matchers this adds.
import '@testing-library/jest-dom/vitest';

// React Testing Library's auto-cleanup-after-each only self-registers when it detects a
// GLOBAL afterEach (i.e. test.globals: true in vitest.config.ts). This repo's tests import
// afterEach/describe/it explicitly per-file instead of relying on globals, so without this,
// render() output from one test silently piles up in the DOM for every later test in the
// same file — exactly what caused "multiple elements found" errors in the first component
// test written against this setup.
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});

// jsdom has no ResizeObserver — Radix's Popper (used by Tooltip/DropdownMenu/etc.) needs one to
// mount its content, even when position isn't asserted on.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// src/features/ViewEditRecord/components/View/__tests__/FHIRField.test.ts
//
// Tier 1 — getInputType is a pure value+label -> HTML input-type mapper (no rendering needed).
// Order matters here: strict regex checks run before the label-keyword date heuristic, which
// runs before the email/url/tel checks, so these tests also pin down that precedence.

import { describe, it, expect } from 'vitest';
import { getInputType } from '../FHIRField';

describe('getInputType', () => {
  it('maps booleans to checkbox', () => {
    expect(getInputType(true, 'Active')).toBe('checkbox');
    expect(getInputType(false, 'Active')).toBe('checkbox');
  });

  it('maps numbers to number', () => {
    expect(getInputType(42, 'Quantity')).toBe('number');
  });

  it('maps multi-line strings to textarea', () => {
    expect(getInputType('line one\nline two', 'Notes')).toBe('textarea');
  });

  it('maps strings over 100 chars to textarea', () => {
    expect(getInputType('x'.repeat(101), 'Description')).toBe('textarea');
  });

  it('maps a strict YYYY-MM-DD string to date, regardless of label', () => {
    expect(getInputType('2024-01-15', 'randomField')).toBe('date');
  });

  it('maps a strict ISO datetime string to datetime-local, regardless of label', () => {
    expect(getInputType('2024-01-15T10:30:00', 'randomField')).toBe('datetime-local');
  });

  it('uses the label as a date heuristic for non-strict but parseable date strings', () => {
    expect(getInputType('January 15, 2024', 'birthDate')).toBe('date');
    expect(getInputType('January 15, 2024', 'effectiveDate')).toBe('date');
  });

  it('picks datetime-local via the label heuristic when the parseable string contains a T', () => {
    expect(getInputType('2024-01-15T10:30:00.000Z', 'effectiveTime')).toBe('datetime-local');
  });

  it('does not apply the date heuristic when the label has no date-ish keyword', () => {
    expect(getInputType('January 15, 2024', 'randomField')).toBe('text');
  });

  it('does not apply the date heuristic when the string is not actually parseable as a date', () => {
    expect(getInputType('not a real date', 'birthDate')).toBe('text');
  });

  it('maps email-like strings to email', () => {
    expect(getInputType('patient@example.com', 'contact')).toBe('email');
  });

  it('maps http(s) URLs to url', () => {
    expect(getInputType('https://example.com/record/1', 'reference')).toBe('url');
    expect(getInputType('http://example.com', 'reference')).toBe('url');
  });

  it('maps phone-number-shaped strings to tel', () => {
    expect(getInputType('+1 (555) 123-4567', 'phone')).toBe('tel');
  });

  it('falls back to text for anything else', () => {
    expect(getInputType('Dr. Jane Smith', 'practitioner')).toBe('text');
  });

  it('treats a null/undefined value as an empty string, falling back to text', () => {
    expect(getInputType(null, 'anything')).toBe('text');
    expect(getInputType(undefined, 'anything')).toBe('text');
  });
});

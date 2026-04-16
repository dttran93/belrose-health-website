"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DENY_REASONS = void 0;
exports.DENY_REASONS = [
    { value: 'wrong_recipient', label: 'Wrong recipient — I am not the stated provider' },
    { value: 'never_held', label: 'Never saw this patient, never held these records' },
    {
        value: 'retention_lapsed',
        label: 'Records were held but are no longer accessible',
    },
    {
        value: 'cannot_identify',
        label: 'I cannot confirm the identity of the patient and am withholding records',
    },
    { value: 'other', label: 'Other' },
];

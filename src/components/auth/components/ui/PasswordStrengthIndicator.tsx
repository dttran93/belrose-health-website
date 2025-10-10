// src/components/PasswordStrengthIndicator.tsx
// Reusable password strength indicator component

import React from 'react';
import {
  getPasswordStrength,
  getPasswordStrengthColors,
  getPasswordRequirements,
} from '@/components/auth/utils/PasswordStrength';

interface PasswordStrengthIndicatorProps {
  password: string;
  showFeedback?: boolean;
  className?: string;
}

export const PasswordStrengthIndicator: React.FC<PasswordStrengthIndicatorProps> = ({
  password,
  showFeedback = true,
  className = '',
}) => {
  if (!password) return null;

  const strength = getPasswordStrength(password);
  const colors = getPasswordStrengthColors(strength.score);
  const requirements = getPasswordRequirements(password);

  const requirementItems = [
    { key: 'minLength', text: 'At least 8 characters', met: requirements.minLength },
    {
      key: 'recommendedLength',
      text: 'At least 12 characters (recommended)',
      met: requirements.recommendedLength,
    },
    { key: 'hasUppercase', text: 'One uppercase letter (A-Z)', met: requirements.hasUppercase },
    { key: 'hasLowercase', text: 'One lowercase letter (a-z)', met: requirements.hasLowercase },
    { key: 'hasNumber', text: 'One number (0-9)', met: requirements.hasNumber },
    { key: 'hasSymbol', text: 'One symbol (!@#$%^&*)', met: requirements.hasSymbol },
  ];

  return (
    <div className={`mt-2 ${className}`}>
      {/* Strength Bar */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-600">Password Strength:</span>
        <span className={`text-xs font-semibold ${colors.text}`}>{strength.label}</span>
      </div>

      <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
        <div
          className={`h-2 rounded-full transition-all duration-300 ${colors.bg}`}
          style={{ width: `${(strength.score / 5) * 100}%` }}
        />
      </div>

      {/* Requirements Checklist */}
      {showFeedback && (
        <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-xs font-medium text-gray-700 mb-2">Password requirements:</p>
          <ul className="space-y-1">
            {requirementItems.map(req => (
              <li key={req.key} className="flex items-center text-xs">
                <div
                  className={`w-2 h-2 rounded-full mr-2 flex-shrink-0 ${
                    req.met ? 'bg-green-500' : 'bg-gray-400'
                  }`}
                />
                <span
                  className={`transition-all ${
                    req.met ? 'text-green-700 line-through' : 'text-gray-700'
                  }`}
                >
                  {req.text}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default PasswordStrengthIndicator;

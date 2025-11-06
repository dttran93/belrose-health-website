import React from 'react';
import { cn } from '@/utils/utils'; // optional: use clsx/tailwind-merge helper if you have one

interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** The name of the field, used for form data binding */
  name?: string;
  /** The label text displayed above the input */
  label?: string;
  /** The left icon component (like <User />, <Mail />, <Lock />) */
  icon?: React.ReactNode;
  /** Optional error message to display under the input */
  error?: string;
}

/**
 * A reusable input field with consistent styling, icons, labels, and error handling.
 */
export const InputField: React.FC<InputFieldProps> = ({
  label,
  icon,
  error,
  className,
  type = 'text',
  name,
  ...props
}) => {
  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={name} className="block text-sm font-medium text-foreground mb-1">
          {label}
        </label>
      )}

      <div className="relative">
        {icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            {icon}
          </div>
        )}

        <input
          id={name}
          name={name}
          type={type}
          className={cn(
            'w-full py-3 border bg-background rounded-xl focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all placeholder-gray-400',
            icon ? 'pl-10 pr-4' : 'px-4',
            error ? 'border-red-500' : 'border-gray-300',
            className
          )}
          {...props}
        />
      </div>

      {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
    </div>
  );
};

export default InputField;

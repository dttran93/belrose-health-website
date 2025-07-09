import React from 'react';

export const FormField = ({ label, children, className = '' }) => (
    <div className={className}>
        <label className="block text-sm font-medium text-gray-700 mb-1">
            {label}
        </label>
        {children}
    </div>
);

export const InputField = ({ label, value, onChange, type = 'text', className = '', ...props }) => (
    <FormField label={label} className={className}>
        <input
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="bg-white w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-chart-1"
            {...props}
        />
    </FormField>
);

export const SelectField = ({ label, value, onChange, options, className = '', ...props }) => (
    <FormField label={label} className={className}>
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="bg-white w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-chart-1"
            {...props}
        >
            {options.map(option => (
                <option key={option.value} value={option.value}>
                    {option.label}
                </option>
            ))}
        </select>
    </FormField>
);

export const TextAreaField = ({ label, value, onChange, rows = 6, className = '', ...props }) => (
    <FormField label={label} className={className}>
        <textarea
            rows={rows}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="bg-white w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-chart-1"
            {...props}
        />
    </FormField>
);
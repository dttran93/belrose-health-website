import React from 'react';
import { Building } from 'lucide-react';
import { InputField } from './FormField';

export const ProviderInfoSection = ({ data, onChange }) => (
    <div className="bg-orange-50 p-4 rounded-lg">
        <h4 className="font-medium text-gray-900 mb-3 flex items-center">
            <Building className="w-4 h-4 mr-2" />
            Provider Information
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField
                label="Provider/Doctor"
                value={data.provider}
                onChange={(value) => onChange('provider', value)}
            />
            <InputField
                label="Institution/Hospital"
                value={data.institution}
                onChange={(value) => onChange('institution', value)}
            />
        </div>
    </div>
);
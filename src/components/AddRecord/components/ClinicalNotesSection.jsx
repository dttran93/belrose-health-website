import React from 'react';
import { Stethoscope } from 'lucide-react';
import { TextAreaField } from './FormField';

const ClinicalNotesSection = ({ data, onChange }) => (
    <div className="bg-purple-50 p-4 rounded-lg">
        <h4 className="font-medium text-gray-900 mb-3 flex items-center">
            <Stethoscope className="w-4 h-4 mr-2" />
            Clinical Information
        </h4>
        <TextAreaField
            label="Clinical Notes"
            value={data.clinicalNotes}
            onChange={(value) => onChange('clinicalNotes', value)}
            placeholder="Enter clinical observations, measurements, and notes..."
        />
    </div>
);

export default ClinicalNotesSection;
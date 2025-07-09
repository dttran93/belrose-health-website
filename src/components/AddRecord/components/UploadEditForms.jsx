import React from 'react';
import { FileText, Building, Stethoscope } from 'lucide-react';
import { InputField, SelectField, TextAreaField } from './ui/FormField';

const DOCUMENT_TYPE_OPTIONS = [
    { value: 'Medical Record', label: 'Medical Record' },
    { value: 'Lab Results', label: 'Lab Results' },
    { value: 'Prescription', label: 'Prescription' },
    { value: 'Vision Prescription', label: 'Vision Prescription' },
    { value: 'Medical Report', label: 'Medical Report' },
    { value: 'Imaging Report', label: 'Imaging Report' }
];

const UploadEditForms = ({ data, onChange }) => (
    <div className="space-y-6">
        <div className="bg-chart-3/50 p-4 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                <FileText className="w-4 h-4 mr-2" />
                Document Information
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InputField
                    label="Document Title"
                    value={data.documentTitle}
                    onChange={(value) => onChange('documentTitle', value)}
                />
                <SelectField
                    label="Document Type"
                    value={data.documentType}
                    onChange={(value) => onChange('documentType', value)}
                    options={DOCUMENT_TYPE_OPTIONS}
                />
                <InputField
                    label="Document Date"
                    type="date"
                    value={data.documentDate}
                    onChange={(value) => onChange('documentDate', value)}
                    className="md:col-span-1"
                />
            </div>
        </div>
        <div className="bg-chart-4/50 p-4 rounded-lg">
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
                     <InputField
                        label="Institution/Hospital Address"
                        value={data.institutionAddress}
                        onChange={(value) => onChange('institution', value)}
                    />
                </div>
            </div>
        <div className="bg-chart-5/50 p-4 rounded-lg">
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
    </div>
);

export default UploadEditForms;
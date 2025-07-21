import React, { useState } from 'react';
import { FileText, Upload, TestTube, Eye, AlertCircle } from 'lucide-react';

import DynamicFHIRForm from '@/features/AddRecord/components/DynamicFHIRForm';
import { TabNavigation } from '@/features/AddRecord/components/ui/TabNavigation';
import { Button } from '@/components/ui/Button';

// Predefined FHIR test documents (enhanced with more examples)
const SAMPLE_FHIR_DOCUMENTS = {
  visionPrescription: {
    name: "Vision Prescription (SpecSavers)",
    data: {
      resourceType: "Bundle",
      type: "collection",
      id: "prescription-bundle-1234",
      entry: [
        {
          fullUrl: "urn:uuid:patient-1234",
          resource: {
            resourceType: "Patient",
            id: "patient-1234",
            identifier: [{ system: "urn:identifier:mrn", value: "128513" }],
            name: [{ use: "official", prefix: ["Mr"], family: "Tran", given: ["Denis"] }],
            birthDate: "1993-11-23",
            gender: "male",
            address: [{
              use: "home",
              line: ["First flat floor, 199 Cromwell Road"],
              city: "London",
              postalCode: "SW5 0SE",
              country: "GB"
            }],
            telecom: [
              { system: "phone", value: "+44 7700 900123" },
              { system: "email", value: "denis.tran@email.com" }
            ]
          }
        },
        {
          fullUrl: "urn:uuid:vision-prescription-1234",
          resource: {
            resourceType: "VisionPrescription",
            id: "vision-prescription-1234",
            status: "active",
            created: "2025-02-23",
            patient: { reference: "urn:uuid:patient-1234" },
            identifier: [{ system: "urn:identifier:prescription", value: "TR:1040885" }],
            dateWritten: "2025-02-23",
            lensSpecification: [
              { eye: "right", sphere: -2.5, cylinder: -0.25, axis: 155 },
              { eye: "left", sphere: -2, cylinder: -0.25, axis: 20 }
            ]
          }
        },
        {
          fullUrl: "urn:uuid:encounter-1234",
          resource: {
            resourceType: "Encounter",
            id: "encounter-1234",
            status: "finished",
            class: { system: "http://terminology.hl7.org/CodeSystem/v3-ActCode", code: "AMB", display: "ambulatory" },
            subject: { reference: "urn:uuid:patient-1234" },
            period: { start: "2025-02-23", end: "2025-02-23" },
            serviceType: { coding: [{ system: "http://snomed.info/sct", code: "252736004", display: "Eye examination" }] }
          }
        }
      ]
    }
  },
  
  labResults: {
    name: "Comprehensive Lab Results",
    data: {
      resourceType: "Bundle",
      type: "collection",
      id: "lab-bundle-5678",
      entry: [
        {
          resource: {
            resourceType: "Patient",
            id: "patient-5678",
            name: [{ family: "Smith", given: ["John", "Michael"] }],
            birthDate: "1985-05-15",
            gender: "male",
            telecom: [{ system: "email", value: "john.smith@email.com" }]
          }
        },
        {
          resource: {
            resourceType: "Observation",
            id: "cholesterol-123",
            status: "final",
            code: { 
              coding: [{ system: "http://loinc.org", code: "2093-3", display: "Cholesterol [Mass/Volume] in Serum or Plasma" }],
              text: "Total Cholesterol" 
            },
            subject: { reference: "Patient/patient-5678" },
            valueQuantity: { value: 195, unit: "mg/dL", system: "http://unitsofmeasure.org" },
            effectiveDateTime: "2025-01-15T09:30:00Z",
            referenceRange: [{ low: { value: 150, unit: "mg/dL" }, high: { value: 200, unit: "mg/dL" } }]
          }
        },
        {
          resource: {
            resourceType: "Observation",
            id: "blood-pressure-456",
            status: "final",
            code: { 
              coding: [{ system: "http://loinc.org", code: "85354-9", display: "Blood pressure panel" }],
              text: "Blood Pressure" 
            },
            subject: { reference: "Patient/patient-5678" },
            component: [
              { 
                code: { coding: [{ system: "http://loinc.org", code: "8480-6", display: "Systolic blood pressure" }], text: "Systolic" }, 
                valueQuantity: { value: 120, unit: "mmHg", system: "http://unitsofmeasure.org" } 
              },
              { 
                code: { coding: [{ system: "http://loinc.org", code: "8462-4", display: "Diastolic blood pressure" }], text: "Diastolic" }, 
                valueQuantity: { value: 80, unit: "mmHg", system: "http://unitsofmeasure.org" } 
              }
            ],
            effectiveDateTime: "2025-01-15T09:30:00Z"
          }
        },
        {
          resource: {
            resourceType: "DiagnosticReport",
            id: "lab-report-789",
            status: "final",
            code: { 
              coding: [{ system: "http://loinc.org", code: "33747-0", display: "General chemistry panel" }],
              text: "Chemistry Panel" 
            },
            subject: { reference: "Patient/patient-5678" },
            effectiveDateTime: "2025-01-15T09:30:00Z",
            conclusion: "All values within normal limits. Continue current lifestyle modifications."
          }
        }
      ]
    }
  },

  medication: {
    name: "Medication Prescription",
    data: {
      resourceType: "Bundle",
      type: "collection",
      id: "med-bundle-9999",
      entry: [
        {
          resource: {
            resourceType: "Patient",
            id: "patient-9999",
            name: [{ family: "Johnson", given: ["Alice", "Marie"] }],
            birthDate: "1978-12-03",
            gender: "female"
          }
        },
        {
          resource: {
            resourceType: "MedicationStatement",
            id: "med-statement-123",
            status: "active",
            medicationCodeableConcept: {
              coding: [{ system: "http://www.nlm.nih.gov/research/umls/rxnorm", code: "314076", display: "Lisinopril 10 MG Oral Tablet" }],
              text: "Lisinopril 10mg"
            },
            subject: { reference: "Patient/patient-9999" },
            effectiveDateTime: "2025-01-01",
            dosage: [{ text: "Take once daily with food", timing: { repeat: { frequency: 1, period: 1, periodUnit: "d" } } }]
          }
        },
        {
          resource: {
            resourceType: "Practitioner",
            id: "practitioner-456",
            name: [{ family: "Williams", given: ["Dr.", "Sarah"] }],
            qualification: [{ 
              code: { text: "Doctor of Medicine" },
              issuer: { display: "London Medical Centre" }
            }]
          }
        }
      ]
    }
  },

  complexCase: {
    name: "Complex Medical Case",
    data: {
      resourceType: "Bundle",
      type: "collection",
      id: "complex-bundle-1111",
      entry: [
        {
          resource: {
            resourceType: "Patient",
            id: "patient-complex",
            name: [{ family: "Brown", given: ["Robert", "James"] }],
            birthDate: "1960-08-20",
            gender: "male",
            address: [{ line: ["123 Health St"], city: "Medical City", state: "MC", postalCode: "12345" }],
            telecom: [
              { system: "phone", value: "+1-555-0123" },
              { system: "email", value: "robert.brown@email.com" }
            ]
          }
        },
        {
          resource: {
            resourceType: "Condition",
            id: "diabetes-condition",
            clinicalStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-clinical", code: "active" }] },
            code: { 
              coding: [{ system: "http://snomed.info/sct", code: "44054006", display: "Type 2 diabetes mellitus" }],
              text: "Type 2 Diabetes"
            },
            subject: { reference: "Patient/patient-complex" },
            onsetDateTime: "2020-03-15"
          }
        },
        {
          resource: {
            resourceType: "AllergyIntolerance",
            id: "penicillin-allergy",
            clinicalStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical", code: "active" }] },
            code: { 
              coding: [{ system: "http://snomed.info/sct", code: "373270004", display: "Penicillin -class of antibiotic-" }],
              text: "Penicillin"
            },
            patient: { reference: "Patient/patient-complex" },
            criticality: "high",
            reaction: [{ description: "Severe rash and difficulty breathing" }]
          }
        }
      ]
    }
  }
};

const TABS = [
  { id: 'extracted', label: 'Extracted Text' },
  { id: 'fhir', label: 'FHIR Data' },
  { id: 'preview', label: 'Generated Form' }
];

// Main Mock Test Component
const MockFHIRFormTester = () => {
  const [selectedDocument, setSelectedDocument] = useState('');
  const [customFhir, setCustomFhir] = useState('');
  const [currentFhirData, setCurrentFhirData] = useState(null);
  const [parseError, setParseError] = useState('');
  const [activeTab, setActiveTab] = useState('preview');
  const [inputMethod, setInputMethod] = useState('samples');

  const handleSampleSelect = (sampleKey) => {
    setSelectedDocument(sampleKey);
    setCurrentFhirData(SAMPLE_FHIR_DOCUMENTS[sampleKey].data);
    setParseError('');
  };

  const handleCustomFhirSubmit = () => {
    try {
      const parsed = JSON.parse(customFhir);
      setCurrentFhirData(parsed);
      setParseError('');
      setSelectedDocument('');
    } catch (error) {
      setParseError(`JSON Parse Error: ${error.message}`);
      setCurrentFhirData(null);
    }
  };

  const mockOriginalFile = {
    name: 'Test Document.pdf',
    documentType: 'medical_record',
    extractedText: 'Sample extracted text from medical document...'
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">🧪 FHIR Form Schema Tester</h1>
        <p className="text-gray-600">Test your comprehensive FHIR form generation system</p>
      </div>

      {/* Input Section */}
      <div className="bg-white rounded-lg border shadow-sm">
        <div className="border-b">
          <nav className="flex space-x-8 px-6">
            <button
              onClick={() => setInputMethod('samples')}
              className={`py-3 px-1 border-b-2 font-medium text-sm ${
                inputMethod === 'samples' 
                  ? 'border-blue-500 text-blue-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <TestTube className="w-4 h-4 inline mr-2" />
              Sample Documents
            </button>
            <button
              onClick={() => setInputMethod('custom')}
              className={`py-3 px-1 border-b-2 font-medium text-sm ${
                inputMethod === 'custom' 
                  ? 'border-blue-500 text-blue-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Upload className="w-4 h-4 inline mr-2" />
              Custom FHIR
            </button>
          </nav>
        </div>

        <div className="p-6">
          {inputMethod === 'samples' && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">Choose a Sample FHIR Document</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(SAMPLE_FHIR_DOCUMENTS).map(([key, doc]) => (
                  <button
                    key={key}
                    onClick={() => handleSampleSelect(key)}
                    className={`p-4 border rounded-lg text-left hover:bg-gray-50 transition-colors ${
                      selectedDocument === key ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center mb-2">
                      <FileText className="w-5 h-5 text-blue-600 mr-2" />
                      <h4 className="font-medium text-gray-900">{doc.name}</h4>
                    </div>
                    <p className="text-sm text-gray-600">
                      {doc.data.entry?.length || 0} FHIR entries
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {doc.data.entry ? [...new Set(doc.data.entry.map(e => e.resource?.resourceType))].join(', ') : ''}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {inputMethod === 'custom' && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">Paste Custom FHIR JSON</h3>
              <textarea
                value={customFhir}
                onChange={(e) => setCustomFhir(e.target.value)}
                placeholder="Paste your FHIR Bundle JSON here..."
                className="w-full h-64 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              />
              {parseError && (
                <div className="text-red-600 text-sm bg-red-50 p-3 rounded border border-red-200">
                  {parseError}
                </div>
              )}
              <Button
                onClick={handleCustomFhirSubmit}
                disabled={!customFhir.trim()}
              >
                Parse & Test
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Results Section */}
      {currentFhirData && (
        <div className="bg-white rounded-lg border shadow-sm">
          {/* Tab Navigation */}
          <div className="border-b">
            <TabNavigation tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />
          </div>

          <div className="p-6">
            {activeTab === 'extracted' && (
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Extracted Text (Mock)</h4>
                <div className="bg-gray-50 p-4 rounded-lg border">
                  <pre className="whitespace-pre-wrap text-sm text-gray-700">
                    {mockOriginalFile.extractedText}
                  </pre>
                </div>
              </div>
            )}

            {activeTab === 'fhir' && (
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">FHIR Data</h4>
                <div className="bg-gray-50 p-4 rounded-lg border max-h-96 overflow-y-auto">
                  <pre className="text-xs text-gray-700">
                    {JSON.stringify(currentFhirData, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            {activeTab === 'preview' && (
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Generated Dynamic Form</h4>
                
                {/* Use your ACTUAL DynamicFHIRForm component */}
                <DynamicFHIRForm 
                  fhirData={currentFhirData} 
                  originalFile={mockOriginalFile}
                  onFormUpdate={(formData) => console.log('Form updated:', formData)}
                  onValidationChange={(validation) => console.log('Validation changed:', validation)}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {!currentFhirData && (
        <div className="text-center py-12 text-gray-500">
          <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p>Select a sample document or paste custom FHIR JSON to see the generated form</p>
        </div>
      )}
    </div>
  );
};

export default MockFHIRFormTester;
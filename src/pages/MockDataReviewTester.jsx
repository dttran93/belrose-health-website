import React, { useState } from 'react';
import { FileText, Upload, TestTube, Eye, AlertCircle, Database } from 'lucide-react';
import { TabNavigation } from '../features/AddRecord/components/ui/TabNavigation';
import { Button } from '../components/ui/Button';
import DataReviewSection from '../features/AddRecord/components/DataReviewSection';

// Predefined FHIR test documents
const SAMPLE_FHIR_DOCUMENTS = {
  visionPrescription: {
    name: "Vision Prescription (SpecSavers)",
    description: "Complete vision prescription with patient details and lens specifications",
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
    description: "Multiple lab observations with diagnostic report",
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
    description: "Active medication statement with practitioner details",
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
    description: "Multiple conditions, allergies, and comprehensive patient data",
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
  },

  emergencyVisit: {
    name: "Emergency Department Visit",
    description: "Emergency encounter with multiple observations and procedures",
    data: {
      resourceType: "Bundle",
      type: "collection",
      id: "emergency-bundle-2222",
      entry: [
        {
          resource: {
            resourceType: "Patient",
            id: "patient-emergency",
            name: [{ family: "Davis", given: ["Maria", "Elena"] }],
            birthDate: "1992-07-14",
            gender: "female",
            telecom: [{ system: "phone", value: "+1-555-9876" }]
          }
        },
        {
          resource: {
            resourceType: "Encounter",
            id: "emergency-encounter",
            status: "finished",
            class: { system: "http://terminology.hl7.org/CodeSystem/v3-ActCode", code: "EMER", display: "emergency" },
            subject: { reference: "Patient/patient-emergency" },
            period: { start: "2025-01-20T14:30:00Z", end: "2025-01-20T18:45:00Z" },
            reasonCode: [{ text: "Chest pain" }]
          }
        },
        {
          resource: {
            resourceType: "Observation",
            id: "heart-rate-emergency",
            status: "final",
            code: { 
              coding: [{ system: "http://loinc.org", code: "8867-4", display: "Heart rate" }],
              text: "Heart Rate" 
            },
            subject: { reference: "Patient/patient-emergency" },
            valueQuantity: { value: 98, unit: "bpm", system: "http://unitsofmeasure.org" },
            effectiveDateTime: "2025-01-20T14:45:00Z"
          }
        },
        {
          resource: {
            resourceType: "Procedure",
            id: "ecg-procedure",
            status: "completed",
            code: { 
              coding: [{ system: "http://snomed.info/sct", code: "29303009", display: "Electrocardiographic procedure" }],
              text: "ECG"
            },
            subject: { reference: "Patient/patient-emergency" },
            performedDateTime: "2025-01-20T15:00:00Z"
          }
        }
      ]
    }
  }
};

const TABS = [
  { id: 'extracted', label: 'Extracted Text' },
  { id: 'fhir', label: 'FHIR Data' },
  { id: 'review', label: 'Data Review Section' }
];

// Main Mock Test Component
const MockDataReviewTester = () => {
  const [selectedDocument, setSelectedDocument] = useState('');
  const [customFhir, setCustomFhir] = useState('');
  const [currentFhirData, setCurrentFhirData] = useState(null);
  const [parseError, setParseError] = useState('');
  const [activeTab, setActiveTab] = useState('review');
  const [inputMethod, setInputMethod] = useState('samples');
  const [validationState, setValidationState] = useState({});

  const handleSampleSelect = (sampleKey) => {
    setSelectedDocument(sampleKey);
    setCurrentFhirData(SAMPLE_FHIR_DOCUMENTS[sampleKey].data);
    setParseError('');
    setValidationState({});
  };

  const handleCustomFhirSubmit = () => {
    try {
      const parsed = JSON.parse(customFhir);
      setCurrentFhirData(parsed);
      setParseError('');
      setSelectedDocument('');
      setValidationState({});
    } catch (error) {
      setParseError(`JSON Parse Error: ${error.message}`);
      setCurrentFhirData(null);
    }
  };

  // Create mock processed file with proper structure for DataReviewSection
  // According to useDataReview hook, files need specific status and extractedText to be reviewable
  const mockProcessedFile = {
    id: 'test-file-1',
    name: selectedDocument ? `${SAMPLE_FHIR_DOCUMENTS[selectedDocument]?.name}.pdf` : 'Custom Document.pdf',
    documentType: 'medical_record',
    status: 'completed', // CRITICAL: Must be 'completed', 'medical_detected', or 'non_medical_detected'
    extractedText: `Sample extracted text from ${selectedDocument ? SAMPLE_FHIR_DOCUMENTS[selectedDocument]?.name : 'custom document'}...\n\nThis would contain the raw OCR text extracted from the original document before it was processed into FHIR format.\n\nPatient Information:\n- Name: ${currentFhirData?.entry?.[0]?.resource?.name?.[0]?.given?.join(' ') || 'Sample'} ${currentFhirData?.entry?.[0]?.resource?.name?.[0]?.family || 'Patient'}\n- Date of Birth: ${currentFhirData?.entry?.[0]?.resource?.birthDate || '1990-01-01'}\n- Gender: ${currentFhirData?.entry?.[0]?.resource?.gender || 'unknown'}\n\nMedical Information:\n${currentFhirData?.entry?.filter(e => e.resource?.resourceType !== 'Patient').map(e => `- ${e.resource?.resourceType}: ${e.resource?.id}`).join('\n') || '- Various medical resources detected'}`,
    wordCount: 150,
    file: {
      name: selectedDocument ? `${SAMPLE_FHIR_DOCUMENTS[selectedDocument]?.name}.pdf` : 'Custom Document.pdf',
      size: 1024576, // 1MB mock size
      type: 'application/pdf'
    }
  };

  // Handler functions for DataReviewSection callbacks
  const handleDataConfirmed = (fileId, exportData) => {
    console.log('Data confirmed for file:', fileId, exportData);
    alert(`Data confirmed for file: ${fileId}`);
  };

  const handleDataRejected = (fileId) => {
    console.log('Data rejected for file:', fileId);
    alert(`Data rejected for file: ${fileId}`);
  };

  const handleResetAll = () => {
    console.log('Reset all called');
    setCurrentFhirData(null);
    setSelectedDocument('');
    setValidationState({});
    setParseError('');
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">🔍 DataReviewSection Tester</h1>
        <p className="text-gray-600">Test your DataReviewSection component with various FHIR documents</p>
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                      <h4 className="font-medium text-gray-900 text-sm">{doc.name}</h4>
                    </div>
                    <p className="text-xs text-gray-600 mb-2">{doc.description}</p>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">
                        {doc.data.entry?.length || 0} entries
                      </span>
                      <span className="text-xs text-blue-600">
                        {doc.data.entry ? [...new Set(doc.data.entry.map(e => e.resource?.resourceType))].length : 0} types
                      </span>
                    </div>
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
                <div className="flex items-start space-x-2 text-red-600 text-sm bg-red-50 p-3 rounded border border-red-200">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{parseError}</span>
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
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-gray-900">Extracted Text (Mock)</h4>
                  <span className="text-sm text-gray-500">{mockProcessedFile.name}</span>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg border">
                  <pre className="whitespace-pre-wrap text-sm text-gray-700">
                    {mockProcessedFile.extractedText}
                  </pre>
                </div>
              </div>
            )}

            {activeTab === 'fhir' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-gray-900">FHIR Data Structure</h4>
                  <div className="flex space-x-4 text-sm text-gray-500">
                    <span>{currentFhirData.entry?.length || 0} entries</span>
                    <span>{currentFhirData.resourceType}</span>
                  </div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg border max-h-96 overflow-y-auto">
                  <pre className="text-xs text-gray-700">
                    {JSON.stringify(currentFhirData, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            {activeTab === 'review' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-gray-900">DataReviewSection Component</h4>
                  <div className="flex items-center space-x-2 text-sm">
                    <Eye className="w-4 h-4" />
                    <span className="text-gray-600">Live component test</span>
                  </div>
                </div>
                
                {/* Pass data to your actual DataReviewSection component with proper Map structure */}
                <DataReviewSection 
                  processedFiles={[mockProcessedFile]}
                  fhirData={new Map([[mockProcessedFile.id, currentFhirData]])}
                  onDataConfirmed={handleDataConfirmed}
                  onDataRejected={handleDataRejected}
                  onResetAll={handleResetAll}
                />

                {/* Display debug info */}
                <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <h5 className="font-medium text-gray-900 mb-2">Debug Information</h5>
                  <div className="text-xs text-gray-600 space-y-1">
                    <div><strong>File ID:</strong> {mockProcessedFile.id}</div>
                    <div><strong>File Name:</strong> {mockProcessedFile.name}</div>
                    <div><strong>File Status:</strong> {mockProcessedFile.status}</div>
                    <div><strong>Has Extracted Text:</strong> {!!mockProcessedFile.extractedText ? 'Yes' : 'No'}</div>
                    <div><strong>FHIR Entries:</strong> {currentFhirData.entry?.length || 0}</div>
                    <div><strong>Resource Types:</strong> {currentFhirData.entry ? [...new Set(currentFhirData.entry.map(e => e.resource?.resourceType))].join(', ') : 'None'}</div>
                    <div><strong>Map Structure:</strong> Map with key "{mockProcessedFile.id}" → FHIR data</div>
                    <div><strong>Reviewable Criteria:</strong> ✅ status='completed' + ✅ extractedText + ✅ fhirData.has(id)</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {!currentFhirData && (
        <div className="text-center py-12 text-gray-500">
          <Database className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p className="text-lg font-medium mb-2">Ready to Test DataReviewSection</p>
          <p>Select a sample document or paste custom FHIR JSON to begin testing</p>
        </div>
      )}
    </div>
  );
};

export default MockDataReviewTester;
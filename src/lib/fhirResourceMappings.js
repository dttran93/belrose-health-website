// src/utils/fhirResourceMappings.js

/**
 * Comprehensive FHIR Resource Field Mappings
 * This file contains definitive mappings for FHIR R4 resources and their field types
 */

export const FIELD_CATEGORIES = {
  DOCUMENT_INFO: 'Document Information',
  PATIENT_INFO: 'Patient Information',
  PROVIDER_INFO: 'Provider Information',
  CLINICAL_DATA: 'Clinical Notes/Observations'
};

export const FIELD_PRIORITY = {
  REQUIRED: 'required', //Always show, must be updated
  HIGH: 'high', //Always show, optional but important
  MEDIUM: 'medium', //Show by default, but can be collapsed
  LOW: 'low' //hidden by default, show on "expand"
};


export const FIELD_TYPES = {
  TEXT: 'text',
  NUMBER: 'number',
  DATE: 'date',
  DATETIME: 'datetime-local',
  SELECT: 'select',
  TEXTAREA: 'textarea',
  EMAIL: 'email',
  PHONE: 'tel',
  CHECKBOX: 'checkbox',
  URL: 'url'
}

// Base field configurations that are common across all documents
export const BASE_FIELD_CONFIGS = {
  // Document Information Fields
  documentTitle: {
    key: 'documentTitle',
    type: FIELD_TYPES.TEXT,
    label: 'Document Title',
    category: FIELD_CATEGORIES.DOCUMENT_INFO,
    priority: FIELD_PRIORITY.REQUIRED,
    required: true,
    placeholder: 'Enter document title',
    help: 'A descriptive title for this medical document'
  },
  
  documentType: {
    key: 'documentType',
    type: FIELD_TYPES.SELECT,
    label: 'Document Type',
    category: FIELD_CATEGORIES.DOCUMENT_INFO,
    priority: FIELD_PRIORITY.REQUIRED,
    required: true,
    options: [
      { value: 'prescription', label: 'Prescription' },
      { value: 'lab_result', label: 'Lab Result' },
      { value: 'medical_record', label: 'Medical Record' },
      { value: 'insurance_card', label: 'Insurance Card' },
      { value: 'visit_summary', label: 'Visit Summary' },
      { value: 'imaging_report', label: 'Imaging Report' },
      { value: 'discharge_summary', label: 'Discharge Summary' }
    ]
  },
  
  documentDate: {
    key: 'documentDate',
    type: FIELD_TYPES.DATE,
    label: 'Document Date',
    category: FIELD_CATEGORIES.DOCUMENT_INFO,
    priority: FIELD_PRIORITY.REQUIRED,
    required: true,
    help: 'Date this document was created or the visit occurred'
  },

  // Patient Information Fields
  patientFirstName: {
    key: 'patientFirstName',
    type: FIELD_TYPES.TEXT,
    label: 'First Name',
    category: FIELD_CATEGORIES.PATIENT_INFO,
    priority: FIELD_PRIORITY.REQUIRED,
    required: true,
    placeholder: 'First name',
    layout: {
      groupWith: 'patientLastName',
      width: '1/2'
    }
  },
  
  patientLastName: {
    key: 'patientLastName',
    type: FIELD_TYPES.TEXT,
    label: 'Last Name',
    category: FIELD_CATEGORIES.PATIENT_INFO,
    priority: FIELD_PRIORITY.REQUIRED,
    required: true,
    placeholder: 'Last name',
    layout: {
      groupWith: 'patientFirstName',
      width: '1/2'
    }
  },


  // Provider Information Fields
  providerFirstName: {
    key: 'providerFirstName',
    type: FIELD_TYPES.TEXT,
    label: 'Provider First Name',
    category: FIELD_CATEGORIES.PROVIDER_INFO,
    priority: FIELD_PRIORITY.HIGH,
    placeholder: 'First name',
    layout: {
      groupWith: 'providerLastName',
      width: '1/2'
    }
  },
  
  providerLastName: {
    key: 'providerLastName',
    type: FIELD_TYPES.TEXT,
    label: 'Provider Last Name',
    category: FIELD_CATEGORIES.PROVIDER_INFO,
    priority: FIELD_PRIORITY.HIGH,
    placeholder: 'Last name',
    layout: {
      groupWith: 'providerFirstName',
      width: '1/2'
    }
  },
}


// Comprehensive FHIR Resource Field Mappings
// Format: 'resourceType.fieldPath': { type, category, priority, label, placeholder, help, layout: {groupWith: 'partnerFieldKey' width:}}
export const FHIR_RESOURCE_FIELD_MAPPINGS = {
  
  // =========================
  // PATIENT RESOURCE FIELDS
  // =========================
  'Patient.id': { type: FIELD_TYPES.TEXT, readOnly: true },
  'Patient.identifier.value': { type: FIELD_TYPES.TEXT },
  'Patient.identifier.system': { type: FIELD_TYPES.URL, readOnly: true },
  'Patient.active': { type: FIELD_TYPES.CHECKBOX },
  
  // Patient name fields
  'Patient.name.given': { type: FIELD_TYPES.TEXT, category: FIELD_CATEGORIES.PATIENT_INFO, priority: FIELD_PRIORITY.REQUIRED, label: 'First Name', placeholder: 'Enter patient first name', help: "provide the patients' first or given name(s)", layout:'' },
  'Patient.name[].family': { type: FIELD_TYPES.TEXT, required: true },
  'Patient.name.prefix': { type: FIELD_TYPES.TEXT },
  'Patient.name.suffix': { type: FIELD_TYPES.TEXT },
  'Patient.name.use': { 
    type: FIELD_TYPES.SELECT, 
    options: [
      { value: 'usual', label: 'Usual' },
      { value: 'official', label: 'Official' },
      { value: 'temp', label: 'Temporary' },
      { value: 'nickname', label: 'Nickname' },
      { value: 'anonymous', label: 'Anonymous' },
      { value: 'old', label: 'Old' },
      { value: 'maiden', label: 'Maiden' }
    ]
  },
  
  // Patient contact fields (telecom)
  'Patient.telecom.value': { type: FIELD_TYPES.TEXT }, // Will be refined by system
  'Patient.telecom.system': { 
    type: FIELD_TYPES.SELECT,
    options: [
      { value: 'phone', label: 'Phone' },
      { value: 'fax', label: 'Fax' },
      { value: 'email', label: 'Email' },
      { value: 'pager', label: 'Pager' },
      { value: 'url', label: 'URL' },
      { value: 'sms', label: 'SMS' },
      { value: 'other', label: 'Other' }
    ]
  },
  'Patient.telecom.use': { 
    type: FIELD_TYPES.SELECT,
    options: [
      { value: 'home', label: 'Home' },
      { value: 'work', label: 'Work' },
      { value: 'temp', label: 'Temporary' },
      { value: 'old', label: 'Old' },
      { value: 'mobile', label: 'Mobile' }
    ]
  },
  
  // Patient demographics
  'Patient.gender': { 
    type: FIELD_TYPES.SELECT,
    options: [
      { value: 'male', label: 'Male' },
      { value: 'female', label: 'Female' },
      { value: 'other', label: 'Other' },
      { value: 'unknown', label: 'Unknown' }
    ]
  },
  'Patient.birthDate': { type: FIELD_TYPES.DATE, required: true },
  'Patient.deceasedBoolean': { type: FIELD_TYPES.CHECKBOX },
  'Patient.deceasedDateTime': { type: FIELD_TYPES.DATETIME },
  
  // Patient address fields
  'Patient.address.line': { type: FIELD_TYPES.TEXT },
  'Patient.address.city': { type: FIELD_TYPES.TEXT },
  'Patient.address.state': { type: FIELD_TYPES.TEXT },
  'Patient.address.postalCode': { type: FIELD_TYPES.TEXT },
  'Patient.address.country': { type: FIELD_TYPES.TEXT },
  'Patient.address.use': { 
    type: FIELD_TYPES.SELECT,
    options: [
      { value: 'home', label: 'Home' },
      { value: 'work', label: 'Work' },
      { value: 'temp', label: 'Temporary' },
      { value: 'old', label: 'Old' },
      { value: 'billing', label: 'Billing' }
    ]
  },
  
  // Patient marital status
  'Patient.maritalStatus.coding.code': { 
    type: FIELD_TYPES.SELECT,
    options: [
      { value: 'A', label: 'Annulled' },
      { value: 'D', label: 'Divorced' },
      { value: 'I', label: 'Interlocutory' },
      { value: 'L', label: 'Legally Separated' },
      { value: 'M', label: 'Married' },
      { value: 'P', label: 'Polygamous' },
      { value: 'S', label: 'Never Married' },
      { value: 'T', label: 'Domestic Partner' },
      { value: 'U', label: 'Unmarried' },
      { value: 'W', label: 'Widowed' }
    ]
  },
  
  // Patient multiple birth
  'Patient.multipleBirthBoolean': { type: FIELD_TYPES.CHECKBOX },
  'Patient.multipleBirthInteger': { type: FIELD_TYPES.NUMBER, min: 1 },
  
  // Patient contact person fields
  'Patient.contact.name.given': { type: FIELD_TYPES.TEXT },
  'Patient.contact.name.family': { type: FIELD_TYPES.TEXT },
  'Patient.contact.telecom.value': { type: FIELD_TYPES.TEXT },
  'Patient.contact.gender': { 
    type: FIELD_TYPES.SELECT,
    options: [
      { value: 'male', label: 'Male' },
      { value: 'female', label: 'Female' },
      { value: 'other', label: 'Other' },
      { value: 'unknown', label: 'Unknown' }
    ]
  },

  // =========================
  // OBSERVATION RESOURCE FIELDS
  // =========================
  'Observation.id': { type: FIELD_TYPES.TEXT, readOnly: true },
  'Observation.status': { 
    type: FIELD_TYPES.SELECT,
    options: [
      { value: 'registered', label: 'Registered' },
      { value: 'preliminary', label: 'Preliminary' },
      { value: 'final', label: 'Final' },
      { value: 'amended', label: 'Amended' },
      { value: 'corrected', label: 'Corrected' },
      { value: 'cancelled', label: 'Cancelled' },
      { value: 'entered-in-error', label: 'Entered in Error' },
      { value: 'unknown', label: 'Unknown' }
    ],
    required: true
  },
  
  // Observation code fields (usually read-only)
  'Observation.code.text': { type: FIELD_TYPES.TEXT, readOnly: true },
  'Observation.code.coding.code': { type: FIELD_TYPES.TEXT, readOnly: true },
  'Observation.code.coding.display': { type: FIELD_TYPES.TEXT, readOnly: true },
  'Observation.code.coding.system': { type: FIELD_TYPES.URL, readOnly: true },
  
  // Observation reference fields
  'Observation.subject.reference': { type: FIELD_TYPES.TEXT, readOnly: true },
  'Observation.encounter.reference': { type: FIELD_TYPES.TEXT, readOnly: true },
  
  // Observation timing
  'Observation.effectiveDateTime': { type: FIELD_TYPES.DATETIME },
  'Observation.effectiveDate': { type: FIELD_TYPES.DATE },
  'Observation.issued': { type: FIELD_TYPES.DATETIME, readOnly: true },
  
  // Observation performer
  'Observation.performer.display': { type: FIELD_TYPES.TEXT },
  'Observation.performer.reference': { type: FIELD_TYPES.TEXT, readOnly: true },
  
  // Observation values (different types)
  'Observation.valueQuantity.value': { type: FIELD_TYPES.NUMBER, step: 0.01 },
  'Observation.valueQuantity.unit': { type: FIELD_TYPES.TEXT, readOnly: true },
  'Observation.valueQuantity.system': { type: FIELD_TYPES.URL, readOnly: true },
  'Observation.valueQuantity.code': { type: FIELD_TYPES.TEXT, readOnly: true },
  'Observation.valueString': { type: FIELD_TYPES.TEXT },
  'Observation.valueBoolean': { type: FIELD_TYPES.CHECKBOX },
  'Observation.valueInteger': { type: FIELD_TYPES.NUMBER, step: 1 },
  'Observation.valueDateTime': { type: FIELD_TYPES.DATETIME },
  'Observation.valueTime': { type: FIELD_TYPES.TEXT },
  'Observation.valueCodeableConcept.coding.code': { type: FIELD_TYPES.SELECT },
  'Observation.valueCodeableConcept.text': { type: FIELD_TYPES.TEXT },
  
  // Observation components (for complex observations like blood pressure)
  'Observation.component.code.text': { type: FIELD_TYPES.TEXT, readOnly: true },
  'Observation.component.valueQuantity.value': { type: FIELD_TYPES.NUMBER, step: 0.01 },
  'Observation.component.valueQuantity.unit': { type: FIELD_TYPES.TEXT, readOnly: true },
  'Observation.component.valueString': { type: FIELD_TYPES.TEXT },
  'Observation.component.valueBoolean': { type: FIELD_TYPES.CHECKBOX },
  
  // Observation notes and interpretation
  'Observation.note.text': { type: FIELD_TYPES.TEXTAREA },
  'Observation.note.authorString': { type: FIELD_TYPES.TEXT },
  'Observation.note.time': { type: FIELD_TYPES.DATETIME },
  'Observation.interpretation.coding.code': { 
    type: FIELD_TYPES.SELECT,
    options: [
      { value: 'H', label: 'High' },
      { value: 'L', label: 'Low' },
      { value: 'N', label: 'Normal' },
      { value: 'A', label: 'Abnormal' },
      { value: 'U', label: 'Significantly Abnormal' },
      { value: 'D', label: 'Significantly Low' },
      { value: 'B', label: 'Better' },
      { value: 'W', label: 'Worse' }
    ]
  },

  // =========================
  // DOCUMENT REFERENCE FIELDS
  // =========================
  'DocumentReference.id': { type: FIELD_TYPES.TEXT, readOnly: true },
  'DocumentReference.status': { 
    type: FIELD_TYPES.SELECT,
    options: [
      { value: 'current', label: 'Current' },
      { value: 'superseded', label: 'Superseded' },
      { value: 'entered-in-error', label: 'Entered in Error' }
    ],
    required: true
  },
  'DocumentReference.docStatus': { 
    type: FIELD_TYPES.SELECT,
    options: [
      { value: 'preliminary', label: 'Preliminary' },
      { value: 'final', label: 'Final' },
      { value: 'amended', label: 'Amended' },
      { value: 'entered-in-error', label: 'Entered in Error' }
    ]
  },
  
  // Document type and category
  'DocumentReference.type.coding.code': { 
    type: FIELD_TYPES.SELECT,
    options: [
      { value: '11506-3', label: 'Progress Note' },
      { value: '18842-5', label: 'Discharge Summary' },
      { value: '11488-4', label: 'Consultation Note' },
      { value: '57133-1', label: 'Referral Note' },
      { value: '34109-9', label: 'Note' },
      { value: '18761-7', label: 'Provider-unspecified Procedure Note' },
      { value: '28570-0', label: 'Procedure Note' }
    ]
  },
  'DocumentReference.type.text': { type: FIELD_TYPES.TEXT },
  'DocumentReference.category.coding.code': { 
    type: FIELD_TYPES.SELECT,
    options: [
      { value: 'clinical-note', label: 'Clinical Note' },
      { value: 'discharge-summary', label: 'Discharge Summary' },
      { value: 'report', label: 'Report' },
      { value: 'summary', label: 'Summary' }
    ]
  },
  
  // Document references and metadata
  'DocumentReference.subject.reference': { type: FIELD_TYPES.TEXT, readOnly: true },
  'DocumentReference.date': { type: FIELD_TYPES.DATETIME },
  'DocumentReference.author.display': { type: FIELD_TYPES.TEXT },
  'DocumentReference.author.reference': { type: FIELD_TYPES.TEXT, readOnly: true },
  'DocumentReference.authenticator.display': { type: FIELD_TYPES.TEXT },
  'DocumentReference.custodian.display': { type: FIELD_TYPES.TEXT },
  'DocumentReference.description': { type: FIELD_TYPES.TEXT },
  
  // Security and content
  'DocumentReference.securityLabel.coding.code': { 
    type: FIELD_TYPES.SELECT,
    options: [
      { value: 'N', label: 'Normal' },
      { value: 'R', label: 'Restricted' },
      { value: 'V', label: 'Very Restricted' },
      { value: 'U', label: 'Unrestricted' }
    ]
  },
  'DocumentReference.content.attachment.contentType': { type: FIELD_TYPES.TEXT, readOnly: true },
  'DocumentReference.content.attachment.url': { type: FIELD_TYPES.URL, readOnly: true },
  'DocumentReference.content.attachment.size': { type: FIELD_TYPES.NUMBER, readOnly: true },
  'DocumentReference.content.attachment.title': { type: FIELD_TYPES.TEXT },

  // =========================
  // PRACTITIONER RESOURCE FIELDS
  // =========================
  'Practitioner.id': { type: FIELD_TYPES.TEXT, readOnly: true },
  'Practitioner.active': { type: FIELD_TYPES.CHECKBOX },
  'Practitioner.name.given': { type: FIELD_TYPES.TEXT },
  'Practitioner.name.family': { type: FIELD_TYPES.TEXT },
  'Practitioner.name.prefix': { type: FIELD_TYPES.TEXT },
  'Practitioner.name.suffix': { type: FIELD_TYPES.TEXT },
  'Practitioner.telecom.value': { type: FIELD_TYPES.TEXT },
  'Practitioner.telecom.system': { 
    type: FIELD_TYPES.SELECT,
    options: [
      { value: 'phone', label: 'Phone' },
      { value: 'fax', label: 'Fax' },
      { value: 'email', label: 'Email' },
      { value: 'pager', label: 'Pager' },
      { value: 'url', label: 'URL' }
    ]
  },
  'Practitioner.address.line': { type: FIELD_TYPES.TEXT },
  'Practitioner.address.city': { type: FIELD_TYPES.TEXT },
  'Practitioner.address.state': { type: FIELD_TYPES.TEXT },
  'Practitioner.address.postalCode': { type: FIELD_TYPES.TEXT },
  'Practitioner.address.country': { type: FIELD_TYPES.TEXT },
  'Practitioner.gender': { 
    type: FIELD_TYPES.SELECT,
    options: [
      { value: 'male', label: 'Male' },
      { value: 'female', label: 'Female' },
      { value: 'other', label: 'Other' },
      { value: 'unknown', label: 'Unknown' }
    ]
  },
  'Practitioner.birthDate': { type: FIELD_TYPES.DATE },

  // =========================
  // ORGANIZATION RESOURCE FIELDS
  // =========================
  'Organization.id': { type: FIELD_TYPES.TEXT, readOnly: true },
  'Organization.active': { type: FIELD_TYPES.CHECKBOX },
  'Organization.name': { type: FIELD_TYPES.TEXT, required: true },
  'Organization.alias': { type: FIELD_TYPES.TEXT },
  'Organization.telecom.value': { type: FIELD_TYPES.TEXT },
  'Organization.telecom.system': { 
    type: FIELD_TYPES.SELECT,
    options: [
      { value: 'phone', label: 'Phone' },
      { value: 'fax', label: 'Fax' },
      { value: 'email', label: 'Email' },
      { value: 'url', label: 'URL' }
    ]
  },
  'Organization.address.line': { type: FIELD_TYPES.TEXT },
  'Organization.address.city': { type: FIELD_TYPES.TEXT },
  'Organization.address.state': { type: FIELD_TYPES.TEXT },
  'Organization.address.postalCode': { type: FIELD_TYPES.TEXT },
  'Organization.address.country': { type: FIELD_TYPES.TEXT },

  // =========================
  // MEDICATION STATEMENT FIELDS
  // =========================
  'MedicationStatement.id': { type: FIELD_TYPES.TEXT, readOnly: true },
  'MedicationStatement.status': { 
    type: FIELD_TYPES.SELECT,
    options: [
      { value: 'active', label: 'Active' },
      { value: 'completed', label: 'Completed' },
      { value: 'entered-in-error', label: 'Entered in Error' },
      { value: 'intended', label: 'Intended' },
      { value: 'stopped', label: 'Stopped' },
      { value: 'on-hold', label: 'On Hold' },
      { value: 'unknown', label: 'Unknown' },
      { value: 'not-taken', label: 'Not Taken' }
    ],
    required: true
  },
  'MedicationStatement.medicationCodeableConcept.text': { type: FIELD_TYPES.TEXT },
  'MedicationStatement.effectiveDateTime': { type: FIELD_TYPES.DATETIME },
  'MedicationStatement.effectivePeriod.start': { type: FIELD_TYPES.DATETIME },
  'MedicationStatement.effectivePeriod.end': { type: FIELD_TYPES.DATETIME },
  'MedicationStatement.dosage.text': { type: FIELD_TYPES.TEXTAREA },
  'MedicationStatement.note.text': { type: FIELD_TYPES.TEXTAREA },

  // =========================
  // ALLERGY INTOLERANCE FIELDS
  // =========================
  'AllergyIntolerance.id': { type: FIELD_TYPES.TEXT, readOnly: true },
  'AllergyIntolerance.clinicalStatus.coding.code': { 
    type: FIELD_TYPES.SELECT,
    options: [
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Inactive' },
      { value: 'resolved', label: 'Resolved' }
    ]
  },
  'AllergyIntolerance.type': { 
    type: FIELD_TYPES.SELECT,
    options: [
      { value: 'allergy', label: 'Allergy' },
      { value: 'intolerance', label: 'Intolerance' }
    ]
  },
  'AllergyIntolerance.category': { 
    type: FIELD_TYPES.SELECT,
    options: [
      { value: 'food', label: 'Food' },
      { value: 'medication', label: 'Medication' },
      { value: 'environment', label: 'Environment' },
      { value: 'biologic', label: 'Biologic' }
    ]
  },
  'AllergyIntolerance.criticality': { 
    type: FIELD_TYPES.SELECT,
    options: [
      { value: 'low', label: 'Low Risk' },
      { value: 'high', label: 'High Risk' },
      { value: 'unable-to-assess', label: 'Unable to Assess' }
    ]
  },
  'AllergyIntolerance.code.text': { type: FIELD_TYPES.TEXT },
  'AllergyIntolerance.onsetDateTime': { type: FIELD_TYPES.DATETIME },
  'AllergyIntolerance.note.text': { type: FIELD_TYPES.TEXTAREA },
  'AllergyIntolerance.reaction.severity': { 
    type: FIELD_TYPES.SELECT,
    options: [
      { value: 'mild', label: 'Mild' },
      { value: 'moderate', label: 'Moderate' },
      { value: 'severe', label: 'Severe' }
    ]
  },

  'VisionPrescription.id': { 
  type: FIELD_TYPES.TEXT, 
  readOnly: true,
  label: 'Prescription ID'
},

'VisionPrescription.status': {
  type: FIELD_TYPES.SELECT,
  label: 'Prescription Status',
  options: [
    { value: 'active', label: 'Active' },
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'draft', label: 'Draft' },
    { value: 'entered-in-error', label: 'Entered in Error' }
  ]
},

'VisionPrescription.created': { 
  type: FIELD_TYPES.DATETIME,
  label: 'Created Date'
},

'VisionPrescription.dateWritten': { 
  type: FIELD_TYPES.DATE,
  label: 'Date Written'
},

'VisionPrescription.patient.reference': { 
  type: FIELD_TYPES.TEXT, 
  readOnly: true,
  label: 'Patient Reference'
},

'VisionPrescription.prescriber.reference': { 
  type: FIELD_TYPES.TEXT, 
  readOnly: true,
  label: 'Prescriber Reference'
},

// LENS SPECIFICATION FIELDS (with proper array notation)
'VisionPrescription.lensSpecification[].product': {
  type: FIELD_TYPES.SELECT,
  label: 'Product Type',
  options: [
    { value: 'lens', label: 'Lens' },
    { value: 'contact', label: 'Contact Lens' }
  ]
},

'VisionPrescription.lensSpecification[].eye': { 
  type: FIELD_TYPES.SELECT,
  label: 'Eye',
  options: [
    { value: 'right', label: 'Right Eye (OD)' },
    { value: 'left', label: 'Left Eye (OS)' }
  ]
},

'VisionPrescription.lensSpecification[].sphere': { 
  type: FIELD_TYPES.NUMBER, 
  label: 'Sphere (SPH)',
  step: 0.25,
  min: -20,
  max: 20,
  unit: 'D'
},

'VisionPrescription.lensSpecification[].cylinder': { 
  type: FIELD_TYPES.NUMBER, 
  label: 'Cylinder (CYL)',
  step: 0.25,
  min: -6,
  max: 6,
  unit: 'D'
},

'VisionPrescription.lensSpecification[].axis': { 
  type: FIELD_TYPES.NUMBER, 
  label: 'Axis',
  step: 1,
  min: 1,
  max: 180,
  unit: '°'
},

'VisionPrescription.lensSpecification[].add': { 
  type: FIELD_TYPES.NUMBER, 
  label: 'Add Power',
  step: 0.25,
  min: 0,
  max: 4,
  unit: 'D'
},

'VisionPrescription.lensSpecification[].prism[].amount': { 
  type: FIELD_TYPES.NUMBER, 
  label: 'Prism Amount',
  step: 0.25,
  min: 0,
  max: 10,
  unit: 'Δ'
},

'VisionPrescription.lensSpecification[].prism[].base': { 
  type: FIELD_TYPES.SELECT,
  label: 'Prism Base',
  options: [
    { value: 'up', label: 'Base Up' },
    { value: 'down', label: 'Base Down' },
    { value: 'in', label: 'Base In' },
    { value: 'out', label: 'Base Out' }
  ]
},

'VisionPrescription.lensSpecification[].power': { 
  type: FIELD_TYPES.NUMBER, 
  label: 'Power',
  step: 0.25,
  unit: 'D'
},

'VisionPrescription.lensSpecification[].backCurve': { 
  type: FIELD_TYPES.NUMBER, 
  label: 'Back Curve',
  step: 0.1,
  unit: 'mm'
},

'VisionPrescription.lensSpecification[].diameter': { 
  type: FIELD_TYPES.NUMBER, 
  label: 'Diameter',
  step: 0.1,
  unit: 'mm'
},

'VisionPrescription.lensSpecification[].duration.value': {
  type: FIELD_TYPES.NUMBER,
  label: 'Duration Value',
  step: 1,
  min: 1,
  max: 60
},

'VisionPrescription.lensSpecification[].duration.unit': {
  type: FIELD_TYPES.SELECT,
  label: 'Duration Unit',
  options: [
    { value: 'months', label: 'Months' },
    { value: 'years', label: 'Years' },
    { value: 'days', label: 'Days' },
    { value: 'weeks', label: 'Weeks' }
  ]
},

'VisionPrescription.lensSpecification[].color': { 
  type: FIELD_TYPES.TEXT,
  label: 'Lens Color'
},

'VisionPrescription.lensSpecification[].brand': { 
  type: FIELD_TYPES.TEXT,
  label: 'Brand'
},

'VisionPrescription.lensSpecification[].note[].text': { 
  type: FIELD_TYPES.TEXTAREA,
  label: 'Notes',
  rows: 3
},

  // =========================
  // ADD MORE RESOURCES HERE AS NEEDED
  // =========================
  // You can extend this mapping to cover all 157 FHIR resources
  // Common ones to add next:
  // - Condition
  // - Procedure  
  // - DiagnosticReport
  // - Immunization
  // - Encounter
  // - CarePlan
  // - Goal
  // etc.
};

// Get field configuration from mapping with enhanced lookup
export const getFieldConfigFromMapping = (resourceType, fieldPath, fhirValue) => {
  console.log(`🔍 Looking up mapping for: ${resourceType}.${fieldPath}`);
  
  // Try exact mapping first
  const exactKey = `${resourceType}.${fieldPath}`;
  let config = FHIR_RESOURCE_FIELD_MAPPINGS[exactKey];
  
  if (config) {
    console.log(`✅ Found exact mapping for ${exactKey}:`, config);
    return { ...config };
  }
  
  // Try with array notation normalized (e.g., lensSpecification[0].sphere -> lensSpecification[].sphere)
  const normalizedPath = fieldPath.replace(/\[\d+\]/g, '[]');
  const normalizedKey = `${resourceType}.${normalizedPath}`;
  config = FHIR_RESOURCE_FIELD_MAPPINGS[normalizedKey];
  
  if (config) {
    console.log(`✅ Found normalized mapping for ${normalizedKey}:`, config);
    return { ...config };
  }
  
  // Try partial matches for nested objects
  const pathParts = fieldPath.split('.');
  for (let i = pathParts.length; i > 0; i--) {
    const partialPath = pathParts.slice(0, i).join('.');
    const partialKey = `${resourceType}.${partialPath}`;
    const partialNormalizedKey = `${resourceType}.${partialPath.replace(/\[\d+\]/g, '[]')}`;
    
    if (FHIR_RESOURCE_FIELD_MAPPINGS[partialKey]) {
      console.log(`✅ Found partial mapping for ${partialKey}`);
      return { ...FHIR_RESOURCE_FIELD_MAPPINGS[partialKey] };
    }
    
    if (FHIR_RESOURCE_FIELD_MAPPINGS[partialNormalizedKey]) {
      console.log(`✅ Found partial normalized mapping for ${partialNormalizedKey}`);
      return { ...FHIR_RESOURCE_FIELD_MAPPINGS[partialNormalizedKey] };
    }
  }
  
  console.log(`❌ No mapping found for ${resourceType}.${fieldPath}`);
  return null;
};

// Extract options from FHIR coded values
const extractDynamicOptions = (fhirValue) => {
  if (fhirValue?.coding && Array.isArray(fhirValue.coding)) {
    return fhirValue.coding.map(coding => ({
      value: coding.code,
      label: coding.display || coding.code
    }));
  }
  return null;
};

// Enhance telecom fields based on system type
export const refineTelecomField = (baseConfig, system) => {
  if (system === 'email') {
    return { ...baseConfig, type: FIELD_TYPES.EMAIL };
  }
  if (system === 'phone' || system === 'sms') {
    return { ...baseConfig, type: FIELD_TYPES.PHONE };
  }
  if (system === 'url') {
    return { ...baseConfig, type: FIELD_TYPES.URL };
  }
  return baseConfig;
};

// Helper to check if a field path matches a mapping pattern
export const findMatchingPattern = (resourceType, fieldPath) => {
  const mappingKey = `${resourceType}.${fieldPath}`;
  
  if (FHIR_RESOURCE_FIELD_MAPPINGS[mappingKey]) {
    return mappingKey;
  }
  
  // Try pattern matching for arrays
  const patterns = Object.keys(FHIR_RESOURCE_FIELD_MAPPINGS).filter(key => 
    key.startsWith(`${resourceType}.`)
  );
  
  for (const pattern of patterns) {
    const patternPath = pattern.replace(`${resourceType}.`, '');
    const normalizedFieldPath = fieldPath.replace(/\.\d+\./g, '.').replace(/\.\d+$/, '');
    
    if (patternPath === normalizedFieldPath) {
      return pattern;
    }
  }
  
  return null;
};

// Get all supported resource types
export const getSupportedResourceTypes = () => {
  const resourceTypes = new Set();
  
  Object.keys(FHIR_RESOURCE_FIELD_MAPPINGS).forEach(key => {
    const resourceType = key.split('.')[0];
    resourceTypes.add(resourceType);
  });
  
  return Array.from(resourceTypes);
};

// Get all fields for a specific resource type
export const getFieldsForResourceType = (resourceType) => {
  return Object.keys(FHIR_RESOURCE_FIELD_MAPPINGS)
    .filter(key => key.startsWith(`${resourceType}.`))
    .map(key => ({
      path: key.replace(`${resourceType}.`, ''),
      config: FHIR_RESOURCE_FIELD_MAPPINGS[key]
    }));
};
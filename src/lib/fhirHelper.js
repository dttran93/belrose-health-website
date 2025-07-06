// utils/fhirHelpers.js
import { collection, doc, addDoc, getDoc, getDocs, setDoc, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/firebase/config';

// FHIR Resource Creators
export const createFHIRPatient = (userData) => ({
  resourceType: "Patient",
  id: userData.uid,
  identifier: [{
    system: "https://belrose-app.com/patient-id",
    value: userData.uid
  }],
  name: [{
    use: "official",
    family: userData.lastName || "",
    given: [userData.firstName || userData.displayName || ""]
  }],
  gender: userData.gender || "unknown",
  birthDate: userData.dateOfBirth || null,
  telecom: [{
    system: "email",
    value: userData.email,
    use: "home"
  }],
  active: true,
  meta: {
    lastUpdated: new Date().toISOString(),
    source: "belrose-app"
  }
});

export const createBloodPressureObservation = (systolic, diastolic, patientId, notes = "") => ({
  resourceType: "Observation",
  status: "final",
  category: [{
    coding: [{
      system: "http://terminology.hl7.org/CodeSystem/observation-category",
      code: "vital-signs",
      display: "Vital Signs"
    }]
  }],
  code: {
    coding: [{
      system: "http://loinc.org",
      code: "85354-9",
      display: "Blood pressure panel"
    }],
    text: "Blood Pressure"
  },
  subject: {
    reference: `Patient/${patientId}`
  },
  effectiveDateTime: new Date().toISOString(),
  component: [
    {
      code: {
        coding: [{
          system: "http://loinc.org",
          code: "8480-6",
          display: "Systolic blood pressure"
        }]
      },
      valueQuantity: {
        value: systolic,
        unit: "mmHg",
        system: "http://unitsofmeasure.org",
        code: "mm[Hg]"
      }
    },
    {
      code: {
        coding: [{
          system: "http://loinc.org",
          code: "8462-4",
          display: "Diastolic blood pressure"
        }]
      },
      valueQuantity: {
        value: diastolic,
        unit: "mmHg",
        system: "http://unitsofmeasure.org",
        code: "mm[Hg]"
      }
    }
  ],
  note: notes ? [{
    text: notes,
    time: new Date().toISOString()
  }] : undefined,
  meta: {
    lastUpdated: new Date().toISOString(),
    source: "belrose-app"
  }
});

export const createWeightObservation = (weight, patientId, notes = "") => ({
  resourceType: "Observation",
  status: "final",
  category: [{
    coding: [{
      system: "http://terminology.hl7.org/CodeSystem/observation-category",
      code: "vital-signs",
      display: "Vital Signs"
    }]
  }],
  code: {
    coding: [{
      system: "http://loinc.org",
      code: "29463-7",
      display: "Body weight"
    }],
    text: "Weight"
  },
  subject: {
    reference: `Patient/${patientId}`
  },
  effectiveDateTime: new Date().toISOString(),
  valueQuantity: {
    value: weight,
    unit: "kg",
    system: "http://unitsofmeasure.org",
    code: "kg"
  },
  note: notes ? [{
    text: notes,
    time: new Date().toISOString()
  }] : undefined,
  meta: {
    lastUpdated: new Date().toISOString(),
    source: "belrose-app"
  }
});

// Database Operations
export class FHIRDatabase {
  constructor(userId) {
    this.userId = userId;
    this.userPath = `users/${userId}`;
  }

  // Initialize patient record
  async initializePatient(userData) {
    const patient = createFHIRPatient(userData);
    const patientRef = doc(db, this.userPath, 'Patient', patient.id);
    await setDoc(patientRef, patient);
    return patient;
  }

  // Add observation (vital signs, measurements)
  async addObservation(observation) {
    const observationsRef = collection(db, this.userPath, 'Observation');
    const docRef = await addDoc(observationsRef, observation);
    return { id: docRef.id, ...observation };
  }

  // Get patient record
  async getPatient() {
    const patientRef = doc(db, this.userPath, 'Patient', this.userId);
    const patientDoc = await getDoc(patientRef);
    return patientDoc.exists() ? patientDoc.data() : null;
  }

  // Get observations by type
  async getObservationsByType(loincCode) {
    const observationsRef = collection(db, this.userPath, 'Observation');
    const q = query(
      observationsRef,
      where('code.coding.0.code', '==', loincCode),
      orderBy('effectiveDateTime', 'desc')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  }

  // Get recent vital signs
  async getRecentVitalSigns(limit = 10) {
    const observationsRef = collection(db, this.userPath, 'Observation');
    const q = query(
      observationsRef,
      where('category.0.coding.0.code', '==', 'vital-signs'),
      orderBy('effectiveDateTime', 'desc')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.slice(0, limit).map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  }
}

// Data Extraction Helpers (for UI)
export const extractBloodPressure = (observation) => {
  const systolic = observation.component?.find(c => 
    c.code.coding?.[0]?.code === "8480-6"
  )?.valueQuantity?.value;
  
  const diastolic = observation.component?.find(c => 
    c.code.coding?.[0]?.code === "8462-4"
  )?.valueQuantity?.value;
  
  return { 
    systolic, 
    diastolic, 
    date: observation.effectiveDateTime,
    notes: observation.note?.[0]?.text || ""
  };
};

export const extractWeight = (observation) => ({
  weight: observation.valueQuantity?.value,
  unit: observation.valueQuantity?.unit,
  date: observation.effectiveDateTime,
  notes: observation.note?.[0]?.text || ""
});

// LOINC Codes for common observations
export const LOINC_CODES = {
  BLOOD_PRESSURE: "85354-9",
  SYSTOLIC_BP: "8480-6",
  DIASTOLIC_BP: "8462-4",
  WEIGHT: "29463-7",
  HEIGHT: "8302-2",
  HEART_RATE: "8867-4",
  BODY_TEMPERATURE: "8310-5"
};
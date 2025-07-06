// hooks/useHealthData.js
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { 
  FHIRDatabase, 
  createBloodPressureObservation, 
  createWeightObservation,
  extractBloodPressure,
  extractWeight,
  LOINC_CODES
} from '@/lib/fhirHelper';
import { toast } from 'sonner';

export const useHealthData = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [patient, setPatient] = useState(null);
  const [recentVitals, setRecentVitals] = useState([]);
  const [fhirDb, setFhirDb] = useState(null);

  // Initialize FHIR database instance
  useEffect(() => {
    if (user?.uid) {
      const db = new FHIRDatabase(user.uid);
      setFhirDb(db);
      initializePatientIfNeeded(db);
    }
  }, [user?.uid]);

  // Initialize patient record if it doesn't exist
  const initializePatientIfNeeded = async (db) => {
    try {
      setLoading(true);
      let patientRecord = await db.getPatient();
      
      if (!patientRecord && user) {
        // Create patient record from user data
        patientRecord = await db.initializePatient({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || user.name,
          firstName: user.name?.split(' ')[0] || '',
          lastName: user.name?.split(' ')[1] || ''
        });
        toast.success('Health profile initialized');
      }
      
      setPatient(patientRecord);
      
      // Load recent vital signs
      if (patientRecord) {
        const vitals = await db.getRecentVitalSigns(5);
        setRecentVitals(vitals);
      }
    } catch (error) {
      console.error('Error initializing patient:', error);
      toast.error('Failed to initialize health profile');
    } finally {
      setLoading(false);
    }
  };

  // Add blood pressure reading
  const addBloodPressure = async (systolic, diastolic, notes = '') => {
    if (!fhirDb || !user?.uid) return;

    try {
      setLoading(true);
      const observation = createBloodPressureObservation(
        systolic, 
        diastolic, 
        user.uid, 
        notes
      );
      
      await fhirDb.addObservation(observation);
      
      // Refresh recent vitals
      const vitals = await fhirDb.getRecentVitalSigns(5);
      setRecentVitals(vitals);
      
      toast.success('Blood pressure recorded');
      return observation;
    } catch (error) {
      console.error('Error adding blood pressure:', error);
      toast.error('Failed to record blood pressure');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Add weight measurement
  const addWeight = async (weight, notes = '') => {
    if (!fhirDb || !user?.uid) return;

    try {
      setLoading(true);
      const observation = createWeightObservation(weight, user.uid, notes);
      
      await fhirDb.addObservation(observation);
      
      // Refresh recent vitals
      const vitals = await fhirDb.getRecentVitalSigns(5);
      setRecentVitals(vitals);
      
      toast.success('Weight recorded');
      return observation;
    } catch (error) {
      console.error('Error adding weight:', error);
      toast.error('Failed to record weight');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Get blood pressure history
  const getBloodPressureHistory = async () => {
    if (!fhirDb) return [];

    try {
      const observations = await fhirDb.getObservationsByType(LOINC_CODES.BLOOD_PRESSURE);
      return observations.map(obs => ({
        id: obs.id,
        ...extractBloodPressure(obs)
      }));
    } catch (error) {
      console.error('Error fetching blood pressure history:', error);
      return [];
    }
  };

  // Get weight history
  const getWeightHistory = async () => {
    if (!fhirDb) return [];

    try {
      const observations = await fhirDb.getObservationsByType(LOINC_CODES.WEIGHT);
      return observations.map(obs => ({
        id: obs.id,
        ...extractWeight(obs)
      }));
    } catch (error) {
      console.error('Error fetching weight history:', error);
      return [];
    }
  };

  // Refresh all data
  const refreshData = async () => {
    if (!fhirDb) return;

    try {
      setLoading(true);
      const vitals = await fhirDb.getRecentVitalSigns(5);
      setRecentVitals(vitals);
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setLoading(false);
    }
  };

  return {
    // Data
    patient,
    recentVitals,
    loading,

    // Actions
    addBloodPressure,
    addWeight,
    getBloodPressureHistory,
    getWeightHistory,
    refreshData,

    // Utils
    isInitialized: !!patient
  };
};
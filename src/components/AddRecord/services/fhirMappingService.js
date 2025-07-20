// src/services/fhirMappingService.js (Simplified Version)

import { 
  getFirestore, 
  collection, 
  query, 
  where, 
  getDocs, 
  orderBy,
  addDoc,
  doc,
  setDoc 
} from 'firebase/firestore';

const db = getFirestore();

export class FhirMappingService {
  
  // ✅ SIMPLIFIED - No type conversion needed anymore!
  static formatMapping(doc) {
    const data = doc.data();
    return {
      id: doc.id,
      ...data
    };
  }
  
  // Get all mappings for a specific resource type
  static async getMappingsForResource(resourceType) {
    try {
      console.log(`🔍 Fetching mappings for ${resourceType} from Firestore...`);
      
      const mappingsRef = collection(db, 'fhirMappings');
      const q = query(
        mappingsRef, 
        where('resourceType', '==', resourceType),
        orderBy('priority', 'asc')
      );
      
      const querySnapshot = await getDocs(q);
      const mappings = [];
      
      querySnapshot.forEach((doc) => {
        mappings.push(this.formatMapping(doc));
      });
      
      console.log(`✅ Fetched ${mappings.length} mappings for ${resourceType}`);
      return mappings;
    } catch (error) {
      console.error(`Error fetching mappings for ${resourceType}:`, error);
      
      // If there's an error with orderBy (index not created), try without ordering
      if (error.code === 'failed-precondition') {
        console.log('📝 Trying query without ordering (Firestore index may not exist yet)...');
        try {
          const mappingsRef = collection(db, 'fhirMappings');
          const q = query(mappingsRef, where('resourceType', '==', resourceType));
          const querySnapshot = await getDocs(q);
          const mappings = [];
          
          querySnapshot.forEach((doc) => {
            mappings.push(this.formatMapping(doc));
          });
          
          // Sort manually
          mappings.sort((a, b) => (a.priority || 999) - (b.priority || 999));
          
          console.log(`✅ Fetched ${mappings.length} mappings for ${resourceType} (manual sort)`);
          return mappings;
        } catch (fallbackError) {
          console.error('Fallback query also failed:', fallbackError);
          return [];
        }
      }
      
      return [];
    }
  }
  
  // Get mapping for a specific FHIR path
  static async getMappingForPath(resourceType, fhirPath) {
    try {
      console.log(`🔍 Looking up mapping for: ${resourceType}.${fhirPath}`);
      
      const mappingsRef = collection(db, 'fhirMappings');
      
      // Try exact match first
      let q = query(
        mappingsRef,
        where('resourceType', '==', resourceType),
        where('fhirPath', '==', fhirPath)
      );
      
      let querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        console.log(`✅ Found exact mapping for ${resourceType}.${fhirPath}`);
        return this.formatMapping(doc);
      }
      
      // Try normalized path for arrays
      const normalizedPath = fhirPath.replace(/\[\d+\]/g, '[]');
      if (normalizedPath !== fhirPath) {
        q = query(
          mappingsRef,
          where('resourceType', '==', resourceType),
          where('fhirPath', '==', normalizedPath)
        );
        
        querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const doc = querySnapshot.docs[0];
          console.log(`✅ Found normalized mapping for ${resourceType}.${normalizedPath}`);
          return this.formatMapping(doc);
        }
      }
      
      console.log(`❌ No mapping found for ${resourceType}.${fhirPath}`);
      return null;
    } catch (error) {
      console.error(`Error fetching mapping for ${resourceType}.${fhirPath}:`, error);
      return null;
    }
  }
  
  // Get all supported resource types
  static async getSupportedResourceTypes() {
    try {
      console.log('🔍 Fetching supported resource types from Firestore...');
      
      const mappingsRef = collection(db, 'fhirMappings');
      const querySnapshot = await getDocs(mappingsRef);
      
      const resourceTypes = new Set();
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.resourceType) {
          resourceTypes.add(data.resourceType);
        }
      });
      
      const result = Array.from(resourceTypes).sort();
      console.log(`✅ Found ${result.length} resource types:`, result);
      return result;
    } catch (error) {
      console.error('Error fetching supported resource types:', error);
      return [];
    }
  }
  
  // Add a new mapping to Firestore
  static async createMapping(mappingData, options = []) {
    try {
      console.log(`📝 Creating mapping for ${mappingData.resourceType}.${mappingData.fhirPath}`);
      
      const mappingsRef = collection(db, 'fhirMappings');
      
      // Include options in the document if provided
      const documentData = {
        ...mappingData,
        ...(options.length > 0 && { options })
      };
      
      const docRef = await addDoc(mappingsRef, documentData);
      
      console.log(`✅ Created mapping with ID: ${docRef.id}`);
      
      // ✅ SIMPLIFIED - No conversion needed!
      return {
        id: docRef.id,
        ...documentData
      };
    } catch (error) {
      console.error('Error creating mapping:', error);
      throw error;
    }
  }
  
  // Search mappings by category
  static async getMappingsByCategory(category) {
    try {
      console.log(`🔍 Fetching mappings for category: ${category}`);
      
      const mappingsRef = collection(db, 'fhirMappings');
      const q = query(mappingsRef, where('category', '==', category));
      const querySnapshot = await getDocs(q);
      
      const mappings = [];
      querySnapshot.forEach((doc) => {
        mappings.push(this.formatMapping(doc));
      });
      
      console.log(`✅ Found ${mappings.length} mappings for category ${category}`);
      return mappings;
    } catch (error) {
      console.error(`Error fetching mappings for category ${category}:`, error);
      return [];
    }
  }
}

export default FhirMappingService;
import React, { useState, useEffect } from 'react';
import { getFirestore, collection, doc, updateDoc, getDocs } from 'firebase/firestore';
import HealthRecordCard from '@/components/ui/HealthRecordCard';
import { useAuthContext } from '@/components/auth/AuthContext';

// Initialize Firebase services (assumes Firebase is already configured)
const db = getFirestore();

const Activity = () => {
  const [healthRecords, setHealthRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Get user from your AuthContext
  const { user } = useAuthContext();

  // Fetch health records from Firestore
  const fetchUserFiles = async (userId) => {
    try {
      console.log('Starting fetchUserFiles for userId:', userId);
      setLoading(true);
      setError(null);

      console.log('Fetching records from Firestore...');
      const recordsCollectionRef = collection(db, `users/${userId}/health-records`);
      const recordsSnapshot = await getDocs(recordsCollectionRef);
      
      console.log('Found records:', recordsSnapshot.size);
      
      if (recordsSnapshot.empty) {
        console.log('No records found in Firestore');
        setHealthRecords([]);
        setLoading(false);
        return;
      }

      const records = recordsSnapshot.docs.map(doc => {
        console.log('Processing document:', doc.id, doc.data());
        return {
          id: doc.id,
          ...doc.data()
        };
      });
      
      console.log('Processed records:', records.length, records);
      setHealthRecords(records);
      setError(null);
      
    } catch (err) {
      console.error('Error fetching health records:', err);
      setError(`Failed to load health records: ${err.message}`);
    } finally {
      console.log('fetchUserFiles completed');
      setLoading(false);
    }
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (!bytes) return 'Unknown size';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  // Handle record updates
  const handleRecordUpdate = async (recordId, updatedData) => {
    try {
      if (!user?.uid) return;

      const recordDocRef = doc(db, `users/${user.uid}/health-records`, recordId);
      const updatePayload = {
        ...updatedData,
        lastModified: new Date().toISOString()
      };

      await updateDoc(recordDocRef, updatePayload);
      
      // Update local state
      setHealthRecords(prev => 
        prev.map(record => 
          record.id === recordId 
            ? { ...record, ...updatePayload }
            : record
        )
      );
    } catch (error) {
      console.error('Error updating record:', error);
    }
  };

  // Handle record actions
  const handleRecordCopy = (recordData) => {
    navigator.clipboard.writeText(JSON.stringify(recordData, null, 2));
    console.log('Record copied to clipboard');
  };

  const handleRecordShare = (recordData) => {
    // Implement sharing logic
    console.log('Share record:', recordData);
  };

  const handleRecordArchive = async (recordData) => {
    // Implement archive logic
    console.log('Archive record:', recordData);
  };

  const handleRecordDelete = async (recordData) => {
    if (confirm('Are you sure you want to delete this record?')) {
      // Implement delete logic
      console.log('Delete record:', recordData);
    }
  };

  // Fetch data when component mounts or user changes
  useEffect(() => {
    console.log('Activity component mounted/user changed:', user);
    
    if (user?.uid) {
      console.log('Fetching records for user:', user.uid);
      fetchUserFiles(user.uid);
    } else {
      console.log('No user or user.uid found');
      setLoading(false);
      setHealthRecords([]);
    }
  }, [user?.uid]);

  // Loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2">Loading health records...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">{error}</p>
          <button 
            onClick={() => user?.uid && fetchUserFiles(user.uid)}
            className="mt-2 text-red-600 hover:text-red-700 underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  // No records state
  if (healthRecords.length === 0) {
    return (
      <div className="space-y-6">
        <div className="text-center p-8 bg-gray-50 rounded-lg">
          <p className="text-gray-600">No health records found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {healthRecords.map((record) => (
        <HealthRecordCard
          key={record.id}
          subject={record.subject}
          provider={record.provider}
          institutionName={record.institutionName}
          institutionAddress={record.institutionAddress}
          date={record.date}
          clinicNotes={record.clinicNotes}
          attachments={record.attachments}
          isBlockchainVerified={record.isBlockchainVerified}
          onUpdate={(updatedData) => handleRecordUpdate(record.id, updatedData)}
          onCopy={() => handleRecordCopy(record)}
          onShare={() => handleRecordShare(record)}
          onArchive={() => handleRecordArchive(record)}
          onDelete={() => handleRecordDelete(record)}
          isEditable={true}
        />
      ))}
    </div>
  );
};

export default Activity;
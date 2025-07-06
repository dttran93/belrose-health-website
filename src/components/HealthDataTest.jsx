import { useState } from 'react';
import { useHealthData } from '@/hooks/useHealthData';

function HealthDataTest() {
  const { 
    patient, 
    recentVitals, 
    loading, 
    addBloodPressure, 
    addWeight,
    isInitialized 
  } = useHealthData();
  
  const [bpForm, setBpForm] = useState({ systolic: '', diastolic: '', notes: '' });
  const [weightForm, setWeightForm] = useState({ weight: '', notes: '' });

  const handleAddBloodPressure = async (e) => {
    e.preventDefault();
    try {
      await addBloodPressure(
        parseInt(bpForm.systolic), 
        parseInt(bpForm.diastolic), 
        bpForm.notes
      );
      setBpForm({ systolic: '', diastolic: '', notes: '' });
    } catch (error) {
      console.error('Failed to add blood pressure:', error);
    }
  };

  const handleAddWeight = async (e) => {
    e.preventDefault();
    try {
      await addWeight(parseFloat(weightForm.weight), weightForm.notes);
      setWeightForm({ weight: '', notes: '' });
    } catch (error) {
      console.error('Failed to add weight:', error);
    }
  };

  if (!isInitialized) {
    return (
      <div className="p-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-blue-800">Initializing Health Profile...</h2>
          <p className="text-blue-600">Setting up your FHIR-compliant health database.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <h2 className="text-lg font-semibold text-green-800">✅ Database Setup Complete!</h2>
        <p className="text-green-600">Your FHIR-compliant health database is ready.</p>
      </div>

      {/* Patient Info */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Patient Record</h3>
        {patient && (
          <div className="space-y-2 text-sm">
            <p><strong>ID:</strong> {patient.id}</p>
            <p><strong>Name:</strong> {patient.name?.[0]?.given?.[0]} {patient.name?.[0]?.family}</p>
            <p><strong>Email:</strong> {patient.telecom?.[0]?.value}</p>
            <p><strong>Status:</strong> {patient.active ? 'Active' : 'Inactive'}</p>
          </div>
        )}
      </div>

      {/* Add Blood Pressure */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Add Blood Pressure</h3>
        <form onSubmit={handleAddBloodPressure} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Systolic</label>
              <input
                type="number"
                value={bpForm.systolic}
                onChange={(e) => setBpForm({...bpForm, systolic: e.target.value})}
                className="w-full border rounded px-3 py-2"
                placeholder="120"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Diastolic</label>
              <input
                type="number"
                value={bpForm.diastolic}
                onChange={(e) => setBpForm({...bpForm, diastolic: e.target.value})}
                className="w-full border rounded px-3 py-2"
                placeholder="80"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Notes (optional)</label>
            <input
              type="text"
              value={bpForm.notes}
              onChange={(e) => setBpForm({...bpForm, notes: e.target.value})}
              className="w-full border rounded px-3 py-2"
              placeholder="Morning reading after exercise"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Recording...' : 'Add Blood Pressure'}
          </button>
        </form>
      </div>

      {/* Add Weight */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Add Weight</h3>
        <form onSubmit={handleAddWeight} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Weight (kg)</label>
            <input
              type="number"
              step="0.1"
              value={weightForm.weight}
              onChange={(e) => setWeightForm({...weightForm, weight: e.target.value})}
              className="w-full border rounded px-3 py-2"
              placeholder="70.5"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Notes (optional)</label>
            <input
              type="text"
              value={weightForm.notes}
              onChange={(e) => setWeightForm({...weightForm, notes: e.target.value})}
              className="w-full border rounded px-3 py-2"
              placeholder="After morning workout"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? 'Recording...' : 'Add Weight'}
          </button>
        </form>
      </div>

      {/* Recent Vitals */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Recent Vital Signs</h3>
        {recentVitals.length === 0 ? (
          <p className="text-gray-500">No vital signs recorded yet.</p>
        ) : (
          <div className="space-y-3">
            {recentVitals.map((vital) => (
              <div key={vital.id} className="border-l-4 border-blue-500 pl-4 py-2">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">
                      {vital.code?.text || 'Vital Sign'}
                    </p>
                    <p className="text-sm text-gray-600">
                      {new Date(vital.effectiveDateTime).toLocaleString()}
                    </p>
                    {vital.note?.[0]?.text && (
                      <p className="text-sm text-gray-500 italic">
                        {vital.note[0].text}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    {vital.component ? (
                      // Blood pressure
                      <p className="font-mono text-lg">
                        {vital.component[0]?.valueQuantity?.value}/
                        {vital.component[1]?.valueQuantity?.value} mmHg
                      </p>
                    ) : vital.valueQuantity ? (
                      // Weight or other single value
                      <p className="font-mono text-lg">
                        {vital.valueQuantity.value} {vital.valueQuantity.unit}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default HealthDataTest;
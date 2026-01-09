import React, { useState, useEffect } from 'react';
import {
  RecordHashService,
  HashableFileContent,
} from '@/features/ViewEditRecord/services/generateRecordHash';

const HashTester = () => {
  const [jsonInput, setJsonInput] = useState<string>('');
  const [generatedHash, setGeneratedHash] = useState<string>('');
  const [canonicalString, setCanonicalString] = useState<string>('');
  const [referenceHash, setReferenceHash] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const generate = async () => {
      if (!jsonInput.trim()) return;
      try {
        setError(null);
        const parsed = JSON.parse(jsonInput);

        // 1. Manually mimic the RecordHashService's internal filtering
        // This helps us see what the service is actually looking at
        const filtered: HashableFileContent = {
          fileName: parsed.fileName || null,
          extractedText: parsed.extractedText || null,
          originalText: parsed.originalText || null,
          originalFileHash: parsed.originalFileHash || null,
          contextText: parsed.contextText || null,
          fhirData: parsed.fhirData || null,
          belroseFields: parsed.belroseFields || null,
          customData: parsed.customData || null,
        };

        // 2. Use the service to get the final hash
        const hash = await RecordHashService.generateRecordHash(parsed);

        // 3. Re-create the sorted string for display
        // We use a helper to get the exact string the service uses
        const sorted = (RecordHashService as any).sortObjectKeys(filtered);
        const finalString = JSON.stringify(sorted);

        setGeneratedHash(hash);
        setCanonicalString(finalString);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Invalid JSON');
        setGeneratedHash('');
        setCanonicalString('');
      }
    };

    const timeoutId = setTimeout(generate, 300);
    return () => clearTimeout(timeoutId);
  }, [jsonInput]);

  return (
    <div className="p-6 max-w-7xl mx-auto bg-slate-50 min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-slate-900">Record Hash Debugger</h1>
        <p className="text-slate-600">
          Compare raw JSON against the internal "Canonical String" used for hashing.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: Raw Input */}
        <div className="space-y-4">
          <div className="flex justify-between items-end">
            <label className="font-bold text-slate-700">1. Raw JSON Input</label>
            <button
              onClick={() => setJsonInput('')}
              className="text-xs text-red-600 hover:underline"
            >
              Clear
            </button>
          </div>
          <textarea
            className="w-full h-[500px] p-4 font-mono text-xs border rounded-lg shadow-inner bg-white focus:ring-2 focus:ring-blue-500 outline-none"
            value={jsonInput}
            onChange={e => setJsonInput(e.target.value)}
            placeholder="Paste the full record JSON here..."
          />
        </div>

        {/* Right: Results & Internal State */}
        <div className="space-y-6">
          {/* Comparison Status */}
          <div
            className={`p-4 rounded-lg border-2 flex flex-col items-center justify-center ${
              !referenceHash
                ? 'bg-white border-slate-200'
                : generatedHash === referenceHash
                  ? 'bg-green-50 border-green-500'
                  : 'bg-red-50 border-red-500'
            }`}
          >
            <span className="text-xs font-bold uppercase text-slate-500 mb-1">Status</span>
            <div className="text-lg font-black italic">
              {!referenceHash
                ? 'READY'
                : generatedHash === referenceHash
                  ? '✅ MATCH'
                  : '❌ MISMATCH'}
            </div>
          </div>

          {/* Reference Input */}
          <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
            <label className="text-xs font-bold text-slate-500 uppercase">
              Target Hash (from JSON)
            </label>
            <input
              className="w-full mt-2 p-2 font-mono text-sm border rounded bg-slate-50"
              value={referenceHash}
              onChange={e => setReferenceHash(e.target.value)}
              placeholder="Paste the 'recordHash' value here..."
            />
          </div>

          {/* Calculated Hash */}
          <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
            <label className="text-xs font-bold text-slate-500 uppercase">Calculated Hash</label>
            <div className="mt-2 p-2 font-mono text-sm bg-blue-50 text-blue-900 break-all rounded border border-blue-100">
              {generatedHash || '---'}
            </div>
          </div>

          {/* THE CANONICAL STRING (The "Secret Sauce") */}
          <div className="bg-slate-900 p-4 rounded-lg shadow-xl overflow-hidden">
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                The Hashing Payload (Canonical String)
              </label>
              <span className="text-[10px] text-slate-500 font-mono">
                Length: {canonicalString.length} chars
              </span>
            </div>
            <div className="h-64 overflow-y-auto font-mono text-[10px] text-green-400 leading-tight break-all whitespace-pre-wrap p-2 bg-black rounded">
              {error ? `ERROR: ${error}` : canonicalString || 'Waiting for valid JSON...'}
            </div>
            <p className="mt-3 text-[10px] text-slate-500 italic">
              * This is the exact string passed to SHA-256. Notice how keys like "belroseFields" are
              sorted alphabetically and extra fields are gone.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HashTester;

// src/features/RequestRecord/components/NewRequestForm.tsx

import { useProviderSearch } from '@/features/ProviderDirectory/hooks/useProviderSearch';
import { ProviderRegion, REGION_CONFIGS } from '@/features/ProviderDirectory/types';
import { useEffect, useState } from 'react';
import { RecordRequestService } from '../../services/recordRequestService';
import { AlertCircle, ArrowLeft, ArrowRight, Calendar, Loader2, Pencil, Send } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import ProviderSearchOverlay from '@/features/ProviderDirectory/components/ProviderSearchOverlay';
import { ProviderDirectoryFactory } from '@/features/ProviderDirectory/ProviderDirectoryFactory';

interface NewRequestFormProps {
  user: any;
  onBack: () => void;
  onSuccess: () => void;
}

export interface RequestNote {
  practice?: string;
  provider?: string;
  dateOfBirth?: string;
  patientIdNumber?: string;
  dateRange?: { from?: string; to?: string };
  freeText?: string;
}

const NewRequestForm: React.FC<NewRequestFormProps> = ({ user, onBack, onSuccess }) => {
  const [step, setStep] = useState<1 | 2>(1);

  // ── Step 1 state ────────────────────────────────────────────────────────────
  const [region, setRegion] = useState<ProviderRegion>('england');
  const [contactEmail, setContactEmail] = useState('');
  const [manualMode, setManualMode] = useState(false);
  const [icbLoading, setIcbLoading] = useState(false);
  const [icbName, setIcbName] = useState<string | null>(null);

  // ── Step 2 state ────────────────────────────────────────────────────────────
  const [requesterName, setRequesterName] = useState(user?.displayName ?? '');
  const [providerName, setProviderName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [patientIdNumber, setPatientIdNumber] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [freeText, setFreeText] = useState('');

  // ── Submission ──────────────────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // ── Provider search ─────────────────────────────────────────────────────────
  const {
    results,
    loading: searchLoading,
    error: searchError,
    selected,
    search,
    select,
    clear,
    clearSelection,
  } = useProviderSearch(region);

  // When a provider is selected, handle both active and closed cases
  const handleProviderSelect = async (result: NonNullable<typeof selected>) => {
    select(result);
    setIcbName(null);

    if (result.status === 'active') {
      // Active practice — pre-fill email if available, else clear
      setContactEmail(result.email ?? '');
    } else {
      // Closed practice — try to fetch the parent ICB's contact details
      const icb = result.parentInstitutions.find(p => p.type === 'Integrated Care Board');
      if (icb) {
        setIcbLoading(true);
        try {
          const directory = ProviderDirectoryFactory.getDirectory(region);
          const icbResult = await directory.getById(icb.id);
          if (icbResult) {
            setContactEmail(icbResult.email ?? '');
            setIcbName(icbResult.institutionName);
          } else {
            // ICB not in our database yet — clear email so user fills manually
            setContactEmail('');
            setIcbName(icb.name); // use the denormalised name at least
          }
        } catch {
          setContactEmail('');
          setIcbName(icb.name);
        } finally {
          setIcbLoading(false);
        }
      } else {
        // No parent ICB on record
        setContactEmail('');
      }
    }
  };

  const handleClearSelection = () => {
    clearSelection();
    setContactEmail('');
    setIcbName(null);
  };

  // When region changes, clear any existing selection
  useEffect(() => {
    handleClearSelection();
    setManualMode(false);
  }, [region]);

  // Can proceed when we have an email — either from directory, ICB lookup, or manual
  const canProceedToStep2 = contactEmail.trim().length > 0 && !icbLoading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!contactEmail.trim() || !requesterName.trim()) {
      setFormError('Contact email and your name are required.');
      return;
    }

    setSubmitting(true);
    try {
      const noteObj: RequestNote = {};

      if (selected) {
        noteObj.practice =
          selected.status === 'closed' && icbName
            ? `${selected.institutionName} (closed — via ${icbName})`
            : selected.institutionName;
      }
      if (providerName.trim()) noteObj.provider = providerName.trim();
      if (dateOfBirth) noteObj.dateOfBirth = dateOfBirth;
      if (patientIdNumber.trim()) noteObj.patientIdNumber = patientIdNumber.trim();
      if (dateFrom || dateTo)
        noteObj.dateRange = { from: dateFrom || undefined, to: dateTo || undefined };
      if (freeText.trim()) noteObj.freeText = freeText.trim();

      await RecordRequestService.createRequest({
        targetEmail: contactEmail.trim(),
        requesterName: requesterName.trim(),
        requestNote: Object.keys(noteObj).length > 0 ? noteObj : undefined,
      });

      onSuccess();
    } catch (err: any) {
      setFormError(err.message || 'Failed to send request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          className="p-2 text-slate-400 hover:text-slate-600 transition-colors rounded-lg hover:bg-slate-100"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex flex-col items-center">
          <h1 className="text-xl font-bold text-primary">New record request</h1>
          <p className="text-sm text-gray-500">Step {step} of 2</p>
        </div>
        <div className="w-8" aria-hidden="true" />
      </div>

      {/* Step indicators */}
      <div className="flex gap-2 mb-8">
        {[1, 2].map(s => (
          <div
            key={s}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              s <= step ? 'bg-primary' : 'bg-primary/10'
            }`}
          />
        ))}
      </div>

      {/* ── STEP 1 ── */}
      {step === 1 && (
        <div className="space-y-5">
          <div>
            <h2 className="text-base font-semibold text-slate-900 mb-0.5">Find your provider</h2>
            <p className="text-sm text-slate-500">
              Search for the GP surgery or hospital you want records from.
            </p>
          </div>

          {/* Region selector */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Region</label>
            <div className="flex flex-wrap gap-2">
              {REGION_CONFIGS.map(rc => (
                <button
                  key={rc.region}
                  type="button"
                  disabled={!rc.available}
                  onClick={() => rc.available && setRegion(rc.region)}
                  className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                    region === rc.region
                      ? 'bg-slate-900 text-white border-slate-900'
                      : rc.available
                        ? 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                        : 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed'
                  }`}
                >
                  {rc.label}
                  {!rc.available && <span className="ml-1 opacity-60">· soon</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Institution search */}
          {!manualMode && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Institution</label>
              <ProviderSearchOverlay
                results={results}
                loading={searchLoading}
                error={searchError}
                selected={selected}
                onSearch={search}
                onSelect={handleProviderSelect}
                onClear={clear}
                onClearSelection={handleClearSelection}
                onManualInput={() => setManualMode(true)}
              />
            </div>
          )}

          {/* Manual mode */}
          {manualMode && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-medium text-slate-600">
                  Institution name
                  <span className="text-slate-400 font-normal ml-1">(optional)</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setManualMode(false);
                    setContactEmail('');
                  }}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  ← Search instead
                </button>
              </div>
              <input
                type="text"
                placeholder="e.g. City Medical Centre"
                className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
              />
            </div>
          )}

          {/* ICB loading */}
          {icbLoading && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Looking up ICB contact details...
            </div>
          )}

          {/* Contact email */}
          {(selected || manualMode) && !icbLoading && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Contact email
                {selected?.email && selected.status === 'active' && (
                  <span className="ml-2 text-green-600 font-normal text-xs">
                    · filled from NHS directory
                  </span>
                )}
                {selected?.status === 'closed' && icbName && contactEmail && (
                  <span className="ml-2 text-amber-600 font-normal text-xs">
                    · ICB contact for {icbName}
                  </span>
                )}
              </label>
              <input
                type="email"
                value={contactEmail}
                onChange={e => setContactEmail(e.target.value)}
                placeholder="practice@nhs.net"
                className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
              />
              {selected?.status === 'active' && !selected.email && (
                <p className="text-xs text-amber-600 mt-1">
                  No email found in the NHS directory. Check the practice website or call them.
                </p>
              )}
              {selected?.status === 'closed' && !contactEmail && !icbLoading && (
                <p className="text-xs text-amber-600 mt-1">
                  No ICB contact found automatically. Search for your local ICB or enter the email
                  manually.
                </p>
              )}
            </div>
          )}

          <div className="pt-2">
            <Button
              type="button"
              onClick={() => setStep(2)}
              disabled={!canProceedToStep2}
              className="w-full gap-2 justify-center"
            >
              Next
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── STEP 2 ── */}
      {step === 2 && (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <h2 className="text-base font-semibold text-slate-900 mb-0.5">Your request</h2>
            <p className="text-sm text-slate-500">
              Tell us about yourself and which records you need.
            </p>
          </div>

          {/* Summary card */}
          <div
            className={`border rounded-lg p-3 ${
              selected?.status === 'closed'
                ? 'bg-amber-50 border-amber-200'
                : 'bg-slate-50 border-slate-200'
            }`}
          >
            <p className="text-xs font-medium text-slate-500 mb-1">Sending to</p>
            <p className="text-sm font-medium text-slate-900">
              {selected?.institutionName ?? 'Provider'}
            </p>
            {selected?.status === 'closed' && icbName && (
              <p className="text-xs text-amber-700 mt-0.5">Via {icbName} (practice is closed)</p>
            )}
            <p className="text-xs text-slate-500 mt-0.5">{contactEmail}</p>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="text-xs text-blue-600 hover:text-blue-800 mt-1 flex items-center gap-1"
            >
              <Pencil className="w-3 h-3" />
              Change
            </button>
          </div>

          {/* Your name */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Your name <span className="text-slate-400 font-normal">(required)</span>
            </label>
            <input
              type="text"
              value={requesterName}
              onChange={e => setRequesterName(e.target.value)}
              placeholder="e.g. Alex Johnson"
              required
              className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
            />
          </div>

          {/* Encrypted fields section */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="flex-1 border-t border-slate-200" />
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide whitespace-nowrap">
                Help the provider find your records
              </p>
              <div className="flex-1 border-t border-slate-200" />
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5 mb-4">
              <p className="text-xs text-blue-700 leading-relaxed">
                These fields are encrypted — only you and the provider can read them. All fields are
                optional; include anything that may help them locate your records.
              </p>
            </div>

            <div className="space-y-4">
              {/* DOB + Id number */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">
                    Date of birth
                  </label>
                  <input
                    type="date"
                    value={dateOfBirth}
                    onChange={e => setDateOfBirth(e.target.value)}
                    className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">
                    Patient ID number
                  </label>
                  <input
                    type="text"
                    value={patientIdNumber}
                    onChange={e => setPatientIdNumber(e.target.value)}
                    placeholder="e.g. your NHS number"
                    className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                  />
                </div>
              </div>

              {/* Provider name */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  Provider name
                </label>
                <input
                  type="text"
                  value={providerName}
                  onChange={e => setProviderName(e.target.value)}
                  placeholder="e.g. Dr. Sarah Johnson"
                  className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                />
              </div>

              {/* Date range */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  Date range
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={e => setDateFrom(e.target.value)}
                      className="w-full h-9 pl-8 pr-3 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                    />
                  </div>
                  <span className="text-xs text-slate-400">to</span>
                  <div className="relative flex-1">
                    <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                    <input
                      type="date"
                      value={dateTo}
                      onChange={e => setDateTo(e.target.value)}
                      className="w-full h-9 pl-8 pr-3 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                    />
                  </div>
                </div>
              </div>

              {/* Additional note */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  Additional note
                </label>
                <textarea
                  value={freeText}
                  onChange={e => setFreeText(e.target.value)}
                  placeholder="e.g. Please include the blood test results from my January appointment..."
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 resize-none"
                />
              </div>
            </div>
          </div>

          {formError && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700">{formError}</p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setStep(1)}
              disabled={submitting}
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
            <Button type="submit" className="flex-1 gap-2" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" /> Send request
                </>
              )}
            </Button>
          </div>

          {/* Legal note */}
          <p className="text-xs text-slate-400 leading-relaxed">
            Under GDPR Article 15 (UK/EU) and HIPAA 45 CFR §164.524 (US), covered entities are
            legally required to provide you with your records within 30 days of request.
          </p>
        </form>
      )}
    </div>
  );
};

export default NewRequestForm;

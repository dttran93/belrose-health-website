//src/features/RequestRecord/components/UploadView.tsx

import { Button } from '@/components/ui/Button';
import CombinedUploadFHIR from '@/features/AddRecord/components/CombinedUploadFHIR';
import { CheckCircle, Lock } from 'lucide-react';
import { RecordRequest } from '../../services/fulfillRequestService';

interface UploadViewProps {
  recordRequest: RecordRequest;
  canSubmit: boolean;
  onSubmit: () => void;
  onBack: () => void;
  // All CombinedUploadFHIR props passed through
  files: any;
  addFiles: any;
  removeFile: any;
  removeFileFromLocal: any;
  retryFile: any;
  getStats: any;
  addFhirAsVirtualFile: any;
  uploadFiles: any;
  fhirData: any;
  onFHIRConverted: any;
  convertTextToFHIR: any;
  savingToFirestore: any;
  processFile: any;
}

const UploadView: React.FC<UploadViewProps> = ({
  recordRequest,
  canSubmit,
  onSubmit,
  onBack,
  ...uploadProps
}) => (
  <div className="max-w-4xl mx-auto space-y-4">
    {/* Context banner */}
    <div className="bg-slate-900 text-white rounded-xl px-5 py-3 flex items-center justify-between">
      <div>
        <p className="text-sm font-medium">Uploading for {recordRequest.requesterName}</p>
        <p className="text-xs text-slate-400 mt-0.5">Record will be encrypted and sent securely</p>
      </div>
      <button
        onClick={onBack}
        className="text-xs text-slate-400 hover:text-white transition-colors"
      >
        ← Back
      </button>
    </div>

    {/* CombinedUploadFHIR used as a dumb ingestion component */}
    {/* uploadFiles is passed through but we intercept submission via onSubmit */}
    <CombinedUploadFHIR
      files={uploadProps.files}
      addFiles={uploadProps.addFiles}
      removeFile={uploadProps.removeFile}
      removeFileFromLocal={uploadProps.removeFileFromLocal}
      retryFile={uploadProps.retryFile}
      getStats={uploadProps.getStats}
      addFhirAsVirtualFile={uploadProps.addFhirAsVirtualFile}
      uploadFiles={uploadProps.uploadFiles}
      fhirData={uploadProps.fhirData}
      onFHIRConverted={uploadProps.onFHIRConverted}
      convertTextToFHIR={uploadProps.convertTextToFHIR}
      savingToFirestore={uploadProps.savingToFirestore}
      processFile={uploadProps.processFile}
      onReview={() => {}} // no-op — review step comes later
    />

    {/* Submit — only shows when a file is processed and ready */}
    {canSubmit && (
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-500" />
          <div>
            <p className="text-sm font-medium text-slate-900">Ready to send</p>
            <p className="text-xs text-slate-500">
              File will be encrypted before leaving your device
            </p>
          </div>
        </div>
        <Button onClick={onSubmit} className="gap-2">
          <Lock className="w-4 h-4" />
          Encrypt & Send
        </Button>
      </div>
    )}
  </div>
);

export default UploadView;

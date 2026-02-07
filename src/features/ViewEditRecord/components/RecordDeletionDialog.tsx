// src/features/ViewEditRecord/components/RecordDeletionDialog.tsx

import * as AlertDialog from '@radix-ui/react-alert-dialog';
import {
  Trash2,
  UserMinus,
  Loader2,
  XCircle,
  CheckCircle2,
  AlertTriangle,
  Users,
  Link,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FileObject } from '@/types/core';
import { RecordDeletionPhase } from '../hooks/useRecordDeletion';
import { DeletionCheckResult } from '../services/recordDeletionService';
import { SubjectActionDialog } from '@/features/Subject/components/ui/SubjectActionDialog';
import { useSubjectFlow } from '@/features/Subject/hooks/useSubjectFlow';

interface RecordDeletionDialogProps {
  isOpen: boolean;
  phase: RecordDeletionPhase;
  checkResult: DeletionCheckResult | null;
  error: string | null;
  isUserSubject: boolean;
  record: FileObject;
  startDeletion: () => void;
  confirmDeletion: () => void;
  removeJustMe: () => void;
  closeDialog: () => void;
}

export const RecordDeletionDialog: React.FC<RecordDeletionDialogProps> = ({
  isOpen,
  phase,
  checkResult,
  error,
  isUserSubject,
  record,
  startDeletion,
  confirmDeletion,
  removeJustMe,
  closeDialog,
}) => {
  // Use the same subject flow pattern as SubjectManager
  const { dialogProps, initiateRemoveSubjectStatus } = useSubjectFlow({
    record,
    onSuccess: () => {
      // After unanchoring is complete, continue with deletion
      console.log('✅ Subject unanchored, ready to delete');
    },
  });

  const canClose = phase === 'options' || phase === 'error' || phase === 'success';

  // Handle the "Delete Record" button when user is a subject
  const handleDeleteClick = () => {
    if (isUserSubject) {
      // Open SubjectActionDialog to unanchor first
      initiateRemoveSubjectStatus();
    } else {
      // Not a subject - proceed directly to confirmation
      startDeletion();
    }
  };

  // Handle "Remove Just Me" when user is a subject
  const handleRemoveJustMeClick = () => {
    if (isUserSubject) {
      // Open SubjectActionDialog to unanchor first, then remove permissions
      initiateRemoveSubjectStatus();
    } else {
      // Not a subject (or not removing subject status) - proceed directly
      removeJustMe();
    }
  };

  return (
    <>
      <AlertDialog.Root open={isOpen} onOpenChange={open => !open && canClose && closeDialog()}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[150]" />
          <AlertDialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-2xl z-[151] w-full max-w-md max-h-[90vh] overflow-y-auto">
            {/* Checking Phase */}
            {phase === 'checking' && <CheckingContent />}

            {/* Options Phase */}
            {phase === 'options' && checkResult && (
              <OptionsContent
                record={record}
                checkResult={checkResult}
                isUserSubject={isUserSubject}
                onStartDeletion={handleDeleteClick}
                onRemoveJustMe={handleRemoveJustMeClick}
                onClose={closeDialog}
              />
            )}

            {/* Confirming Phase */}
            {phase === 'confirming' && checkResult && (
              <ConfirmingContent
                record={record}
                checkResult={checkResult}
                onConfirm={confirmDeletion}
                onClose={closeDialog}
              />
            )}

            {/* Deleting Phase */}
            {phase === 'deleting' && <DeletingContent />}

            {/* Success Phase */}
            {phase === 'success' && <SuccessContent onClose={closeDialog} />}

            {/* Error Phase */}
            {phase === 'error' && <ErrorContent error={error} onClose={closeDialog} />}
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>

      {/* Subject Unanchoring Dialog */}
      <SubjectActionDialog {...dialogProps} />
    </>
  );
};

// ============================================================================
// PHASE CONTENT COMPONENTS
// ============================================================================

const CheckingContent: React.FC = () => (
  <div className="p-6 flex flex-col items-center gap-4 py-8">
    <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
    <AlertDialog.Title className="text-lg font-bold text-center">
      Checking Permissions
    </AlertDialog.Title>
    <AlertDialog.Description className="text-sm text-gray-600 text-center">
      Verifying your permissions to delete this record...
    </AlertDialog.Description>
  </div>
);

const OptionsContent: React.FC<{
  record: FileObject;
  checkResult: DeletionCheckResult;
  isUserSubject: boolean;
  onStartDeletion: () => void;
  onRemoveJustMe: () => void;
  onClose: () => void;
}> = ({ record, checkResult, isUserSubject, onStartDeletion, onRemoveJustMe, onClose }) => {
  const canDelete = checkResult.canDelete;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <AlertDialog.Title className="text-lg font-bold flex items-center gap-2">
          <Trash2 className="w-5 h-5 text-red-500" />
          Delete Record
        </AlertDialog.Title>
        <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {/* Record Info */}
      <div className="p-3 border rounded-lg bg-gray-50 mb-4">
        <p className="text-xs text-gray-500 mb-1">Record</p>
        <p className="font-medium text-gray-900">
          {record.belroseFields?.title || record.fileName || 'Untitled Record'}
        </p>
      </div>

      {/* Cannot Delete - Show Reason */}
      {!canDelete && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <div className="flex gap-3">
            <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-red-900">Cannot Delete</p>
              <p className="text-sm text-red-800 mt-1">{checkResult.reason}</p>
            </div>
          </div>
        </div>
      )}

      {/* Can Delete - Show Warnings */}
      {canDelete && (
        <>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
            <div className="flex gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-900">Warning</p>
                <div className="text-sm text-amber-800 mt-2 space-y-2">
                  {checkResult.affectsOtherUsers && checkResult.otherUserCount! > 0 && (
                    <div className="flex items-start gap-2">
                      <Users className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <p>
                        This will delete the record for {checkResult.otherUserCount} other user
                        {checkResult.otherUserCount! > 1 ? 's' : ''}
                        {checkResult.otherAdmins && checkResult.otherAdmins.length > 0 && (
                          <>
                            {' '}
                            ({checkResult.otherAdmins.length} admin
                            {checkResult.otherAdmins.length > 1 ? 's' : ''})
                          </>
                        )}
                        {checkResult.otherViewers && checkResult.otherViewers.length > 0 && (
                          <>
                            , {checkResult.otherViewers.length} viewer
                            {checkResult.otherViewers.length > 1 ? 's' : ''}
                          </>
                        )}
                      </p>
                    </div>
                  )}

                  {isUserSubject && (
                    <div className="flex items-start gap-2">
                      <Link className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <p>You are a subject - you must unanchor from the blockchain first</p>
                    </div>
                  )}

                  {checkResult.hasSubjects &&
                    checkResult.otherSubjects &&
                    checkResult.otherSubjects.length > 0 && (
                      <div className="flex items-start gap-2">
                        <Users className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <p>
                          {checkResult.otherSubjects.length} other subject
                          {checkResult.otherSubjects.length > 1 ? 's' : ''} will be asked to
                          unanchor
                        </p>
                      </div>
                    )}

                  <p className="font-medium">This action cannot be undone</p>
                </div>
              </div>
            </div>
          </div>

          {/* Delete Button */}
          <Button onClick={onStartDeletion} className="w-full mb-3 bg-red-600 hover:bg-red-700">
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Record Permanently
          </Button>
        </>
      )}

      {/* Remove Just Me Section */}
      <div className="border-t pt-4">
        <p className="text-sm font-medium text-gray-700 mb-2">Alternative Option</p>

        <Button onClick={onRemoveJustMe} variant="outline" className="w-full">
          <UserMinus className="w-4 h-4 mr-2" />
          Just Remove Me From This Record
        </Button>
        <p className="text-xs text-gray-500 mt-2">The record will remain for other users</p>
      </div>
    </div>
  );
};

const ConfirmingContent: React.FC<{
  record: FileObject;
  checkResult: DeletionCheckResult;
  onConfirm: () => void;
  onClose: () => void;
}> = ({ record, checkResult, onConfirm, onClose }) => (
  <div className="p-6">
    <AlertDialog.Title className="text-lg font-bold flex items-center gap-2 mb-4 text-red-600">
      <AlertTriangle className="w-5 h-5" />
      Final Confirmation
    </AlertDialog.Title>

    <AlertDialog.Description className="text-sm text-gray-600 mb-4">
      You are about to permanently delete this record.
    </AlertDialog.Description>

    {/* Record Info */}
    <div className="p-3 border border-red-200 rounded-lg bg-red-50 mb-4">
      <p className="text-xs text-red-600 mb-1">Deleting</p>
      <p className="font-medium text-gray-900">
        {record.belroseFields?.title || record.fileName || 'Untitled Record'}
      </p>
    </div>

    {/* Final Warning */}
    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
      <p className="font-medium text-red-900 mb-2">This will:</p>
      <ul className="text-sm text-red-800 space-y-1">
        {checkResult.affectsOtherUsers && checkResult.otherUserCount! > 0 && (
          <li>
            • Delete the record for {checkResult.otherUserCount} other user
            {checkResult.otherUserCount! > 1 ? 's' : ''}
          </li>
        )}
        {checkResult.otherSubjects && checkResult.otherSubjects.length > 0 && (
          <li>
            • Send {checkResult.otherSubjects.length} removal request
            {checkResult.otherSubjects.length > 1 ? 's' : ''} to subjects
          </li>
        )}
        <li>• Delete all versions and encryption keys</li>
        <li>• Delete the file from storage</li>
        <li>
          • <strong>Cannot be undone</strong>
        </li>
      </ul>
    </div>

    <div className="flex gap-3">
      <AlertDialog.Cancel asChild>
        <Button variant="outline" className="flex-1" onClick={onClose}>
          Cancel
        </Button>
      </AlertDialog.Cancel>
      <Button onClick={onConfirm} className="flex-1 bg-red-600 hover:bg-red-700">
        Delete Permanently
      </Button>
    </div>
  </div>
);

const DeletingContent: React.FC = () => (
  <div className="p-6 flex flex-col items-center gap-4 py-8">
    <Loader2 className="w-10 h-10 text-red-500 animate-spin" />
    <AlertDialog.Title className="text-lg font-bold text-center">Deleting Record</AlertDialog.Title>
    <AlertDialog.Description className="text-sm text-gray-600 text-center">
      Deleting record and notifying users...
    </AlertDialog.Description>
  </div>
);

const SuccessContent: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div className="p-6 flex flex-col items-center gap-4 py-8">
    <CheckCircle2 className="w-10 h-10 text-green-500" />
    <AlertDialog.Title className="text-lg font-bold text-center text-green-600">
      Record Deleted
    </AlertDialog.Title>
    <AlertDialog.Description className="text-sm text-gray-600 text-center">
      The record has been permanently deleted. Affected users have been notified.
    </AlertDialog.Description>
    <Button onClick={onClose} className="mt-2 bg-green-600 hover:bg-green-700">
      Done
    </Button>
  </div>
);

const ErrorContent: React.FC<{ error: string | null; onClose: () => void }> = ({
  error,
  onClose,
}) => (
  <div className="p-6 flex flex-col items-center gap-4 py-8">
    <XCircle className="w-10 h-10 text-red-500" />
    <AlertDialog.Title className="text-lg font-bold text-center text-red-600">
      Deletion Failed
    </AlertDialog.Title>
    <AlertDialog.Description className="text-sm text-gray-600 text-center">
      {error || 'An unexpected error occurred. Please try again.'}
    </AlertDialog.Description>
    <Button onClick={onClose} variant="outline" className="mt-2">
      Close
    </Button>
  </div>
);

export default RecordDeletionDialog;

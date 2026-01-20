// src/features/Subject/components/ui/RejectionResponseDialog.tsx

/**
 * RejectionResponseDialog Component
 *
 * Modal dialog for record owners/admins to respond to a declined subject request.
 * Options:
 * - Drop: Accept the rejection and remove the request
 * - Escalate: Flag for further review/dispute resolution
 */

import React, { useState } from 'react';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import {
  UserX,
  FileText,
  MessageSquare,
  XCircle,
  AlertTriangle,
  Loader2,
  X,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { UserCard } from '@/features/Users/components/ui/UserCard';
import { BelroseUserProfile, FileObject } from '@/types/core';
import { SubjectConsentRequest } from '../../services/subjectConsentService';
import {
  SubjectRejectionService,
  CreatorResponseStatus,
} from '../../services/subjectRejectionService';

interface RejectionResponseDialogProps {
  isOpen: boolean;
  onClose: () => void;
  request: SubjectConsentRequest;
  record: FileObject;
  subjectProfile?: BelroseUserProfile;
  onSuccess: () => void;
}

export const RejectionResponseDialog: React.FC<RejectionResponseDialogProps> = ({
  isOpen,
  onClose,
  request,
  record,
  subjectProfile,
  onSuccess,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedResponse, setSelectedResponse] = useState<CreatorResponseStatus | null>(null);

  const handleConfirm = async () => {
    if (!selectedResponse) return;

    setIsProcessing(true);
    try {
      await SubjectRejectionService.respondToRejection(
        request.recordId,
        request.subjectId,
        selectedResponse
      );
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error responding to rejection:', error);
      alert(error instanceof Error ? error.message : 'Failed to respond to rejection');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setSelectedResponse(null);
    onClose();
  };

  const recordTitle =
    request.recordTitle || record.belroseFields?.title || record.fileName || 'Untitled Record';
  const rejectionReason = request.rejection?.reason;

  return (
    <AlertDialog.Root open={isOpen} onOpenChange={open => !open && handleClose()}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <AlertDialog.AlertDialogDescription />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-xl z-50 w-full max-w-md max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <AlertDialog.Title className="text-lg font-semibold flex items-center gap-2">
              <UserX className="w-5 h-5 text-red-600" />
              Respond to Declined Request
            </AlertDialog.Title>
            <button
              onClick={handleClose}
              className="p-1 hover:bg-gray-100 rounded-full transition-colors"
              disabled={isProcessing}
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 space-y-4">
            {/* User Card - Compact */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Declined By
              </label>
              <UserCard
                user={subjectProfile}
                userId={request.subjectId}
                variant="compact"
                color="red"
                menuType="none"
              />
            </div>

            {/* Record Info */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide flex items-center gap-1">
                <FileText className="w-3 h-3" />
                Record
              </label>
              <div className="bg-gray-50 rounded-lg p-2">
                <p className="text-sm font-medium text-gray-900 truncate">{recordTitle}</p>
              </div>
            </div>

            {/* Rejection Reason */}
            {rejectionReason && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide flex items-center gap-1">
                  <MessageSquare className="w-3 h-3" />
                  Reason
                </label>
                <div className="bg-red-50 border border-red-100 rounded-lg p-2">
                  <p className="text-sm text-red-800 italic">"{rejectionReason}"</p>
                </div>
              </div>
            )}

            {/* Response Options */}
            <div className="space-y-2 pt-2">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Response
              </label>

              {/* Drop Option */}
              <button
                onClick={() => setSelectedResponse('dropped')}
                disabled={isProcessing}
                className={`w-full p-3 border-2 rounded-lg transition-all text-left
                  ${
                    selectedResponse === 'dropped'
                      ? 'border-amber-600 bg-amber-100'
                      : 'border-gray-200 hover:border-gray-400 hover:bg-gray-50'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-lg transition-colors
                    ${selectedResponse === 'dropped' ? 'bg-amber-200' : 'bg-gray-100'}`}
                  >
                    <XCircle className="w-5 h-5 text-gray-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">Drop Request</p>
                    <p className="text-sm text-gray-600 mt-0.5">
                      Accept their decision. You don't believe excluding this record will negatively
                      impact the patient's continuity of care.
                    </p>
                  </div>
                </div>
              </button>

              {/* Escalate Option */}
              <button
                onClick={() => setSelectedResponse('escalated')}
                disabled={isProcessing}
                className={`w-full p-3 border-2 rounded-lg transition-all text-left
                  ${
                    selectedResponse === 'escalated'
                      ? 'border-amber-500 bg-amber-50'
                      : 'border-gray-200 hover:border-gray-400 hover:bg-gray-50'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-lg transition-colors
                    ${selectedResponse === 'escalated' ? 'bg-amber-200' : 'bg-gray-100'}`}
                  >
                    <AlertTriangle className="w-5 h-5 text-gray-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">Escalate</p>
                    <p className="text-sm text-gray-800 mt-0.5">
                      Flag for review. You believe this record is important for the patient's
                      medical history and its absence could cause issues for future providers.
                    </p>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t">
            <Button
              onClick={handleConfirm}
              disabled={!selectedResponse || isProcessing}
              className="w-full"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Processing...
                </>
              ) : (
                'Confirm'
              )}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
};

export default RejectionResponseDialog;

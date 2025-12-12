// src/features/Settings/components/ChangePhotoModal.tsx

import React, { useState, useRef, useEffect } from 'react';
import { X, Upload, Trash2, User } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { getAuth } from 'firebase/auth';

interface ChangePhotoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (photoURL: string | null) => Promise<boolean>;
  isLoading: boolean;
  currentPhotoURL: string | null;
  userInitials: string;
}

export const ChangePhotoModal: React.FC<ChangePhotoModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
  currentPhotoURL,
  userInitials,
}) => {
  const [previewURL, setPreviewURL] = useState<string | null>(currentPhotoURL);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setPreviewURL(currentPhotoURL);
      setSelectedFile(null);
      setError(null);
    }
  }, [isOpen, currentPhotoURL]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be less than 5MB');
      return;
    }

    setError(null);
    setSelectedFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onload = e => {
      setPreviewURL(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleRemovePhoto = async () => {
    setError(null);

    // If there's a current photo, we'll remove it
    const success = await onSubmit(null);
    if (success) {
      setPreviewURL(null);
      setSelectedFile(null);
      onClose();
    }
  };

  const handleSubmit = async () => {
    if (!selectedFile) {
      // No new file selected, just close
      onClose();
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) {
        throw new Error('Not authenticated');
      }

      // Upload to Firebase Storage
      const storage = getStorage();
      const storageRef = ref(
        storage,
        `profile-photos/${user.uid}/${Date.now()}-${selectedFile.name}`
      );

      await uploadBytes(storageRef, selectedFile);
      const downloadURL = await getDownloadURL(storageRef);

      // Update profile with new URL
      const success = await onSubmit(downloadURL);
      if (success) {
        onClose();
      }
    } catch (err: any) {
      console.error('Error uploading photo:', err);
      setError(err.message || 'Failed to upload photo');
    } finally {
      setIsUploading(false);
    }
  };

  if (!isOpen) return null;

  const isProcessing = isLoading || isUploading;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-xl shadow-lg max-w-md w-full p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-foreground">Change Profile Photo</h2>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Photo Preview */}
        <div className="flex flex-col items-center mb-6">
          <div
            className="w-32 h-32 rounded-full flex items-center justify-center text-4xl font-semibold text-white mb-4 bg-gradient-to-br from-chart-1 to-chart-5 overflow-hidden"
            style={
              previewURL
                ? {
                    backgroundImage: `url(${previewURL})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }
                : undefined
            }
          >
            {!previewURL && (userInitials || <User className="w-12 h-12" />)}
          </div>

          {selectedFile && <p className="text-sm text-muted-foreground">{selectedFile.name}</p>}
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Action Buttons */}
        <div className="space-y-3 mb-6">
          <Button
            type="button"
            variant="outline"
            className="w-full justify-center"
            onClick={handleUploadClick}
            disabled={isProcessing}
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload New Photo
          </Button>

          {(currentPhotoURL || previewURL) && (
            <Button
              type="button"
              variant="outline"
              className="w-full justify-center text-destructive hover:text-destructive"
              onClick={handleRemovePhoto}
              disabled={isProcessing}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Remove Photo
            </Button>
          )}
        </div>

        {/* Requirements */}
        <p className="text-xs text-muted-foreground text-center mb-4">
          Accepted formats: JPG, PNG, GIF. Max size: 5MB.
        </p>

        {/* Error */}
        {error && <p className="text-sm text-destructive text-center mb-4">{error}</p>}

        {/* Footer Actions */}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose} disabled={isProcessing}>
            Cancel
          </Button>
          {selectedFile && (
            <Button
              type="button"
              onClick={handleSubmit}
              loading={isProcessing}
              disabled={isProcessing}
            >
              Save Photo
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChangePhotoModal;

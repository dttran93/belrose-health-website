// src/features/Credibility/hooks/useVerifiedByCurrentUser.ts
import { useState, useEffect } from 'react';
import { useAuth } from '@/features/Auth/hooks/useAuth';
import { getVerification } from '../services/verificationService';
import { FileObject } from '@/types/core';
import { getDispute } from '../services/disputeService';

export function useReviewedByCurrentUser(record: FileObject) {
  const { user } = useAuth();
  const [hasReviewed, setHasReviewed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const check = async () => {
      if (!user?.uid || !record.recordHash) {
        setHasReviewed(false);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        // Check both in parallel — either counts as a review
        const [verification, dispute] = await Promise.all([
          getVerification(record.recordHash, user.uid),
          getDispute(record.recordHash, user.uid, false), // decrypt=false, we only need isActive
        ]);

        const hasActiveVerification = !!verification && verification.isActive;
        const hasActiveDispute = !!dispute && dispute.isActive;

        setHasReviewed(hasActiveVerification || hasActiveDispute);
      } catch {
        setHasReviewed(false);
      } finally {
        setIsLoading(false);
      }
    };

    check();
  }, [record.recordHash, user?.uid]);

  return { hasReviewed, isLoading };
}

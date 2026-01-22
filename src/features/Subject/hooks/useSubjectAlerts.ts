// src/features/Subject/hooks/useSubjectAlerts.ts

import { useState, useEffect, useCallback } from 'react';
import { getAuth } from 'firebase/auth';
import SubjectQueryService, {
  PendingRejectionResponse,
  IncomingRemovalRequest,
} from '../services/subjectQueryService';
import { SubjectConsentRequest } from '../services/subjectConsentService';
import { SubjectRemovalRequest } from '../services/subjectRemovalService';

interface UseSubjectAlertsOptions {
  recordId: string;
}

interface UseSubjectAlertsReturn {
  // Loading state
  isLoading: boolean;

  // Alert flags for current user
  hasSubjectRequest: boolean;
  hasRemovalRequest: boolean;

  // Alert flag for owners/admins after rejection from subject
  hasPendingRejectionResponse: boolean;

  // Alert data
  pendingRejectionResponses: PendingRejectionResponse[];
  removalRequest: IncomingRemovalRequest | null;

  // Record-wide data (for owners/admins)
  pendingConsentRequests: SubjectConsentRequest[];
  pendingRemovalRequests: SubjectRemovalRequest[];

  // Refresh function
  refetch: () => Promise<void>;
}

export function useSubjectAlerts({ recordId }: UseSubjectAlertsOptions): UseSubjectAlertsReturn {
  const [isLoading, setIsLoading] = useState(true);

  // Current user alerts
  const [hasSubjectRequest, setHasSubjectRequest] = useState(false);
  const [hasRemovalRequest, setHasRemovalRequest] = useState(false);
  const [removalRequest, setRemovalRequest] = useState<IncomingRemovalRequest | null>(null);

  // Owner/admin alerts
  const [hasPendingRejectionResponse, setHasPendingRejectionResponse] = useState(false);
  const [pendingRejectionResponses, setPendingRejectionResponses] = useState<
    PendingRejectionResponse[]
  >([]);

  // Subject addition/removal requests
  const [pendingConsentRequests, setPendingConsentRequests] = useState<SubjectConsentRequest[]>([]);
  const [pendingRemovalRequests, setPendingRemovalRequests] = useState<SubjectRemovalRequest[]>([]);

  const fetchAlerts = useCallback(async () => {
    const auth = getAuth();
    if (!auth.currentUser || !recordId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const alerts = await SubjectQueryService.getRecordAlerts(recordId);

      // Current user alerts
      setHasSubjectRequest(alerts.hasPendingRequest);
      setHasRemovalRequest(alerts.hasRemovalRequest);
      setRemovalRequest(alerts.removalRequest);

      // Owner/admin alerts
      setHasPendingRejectionResponse(alerts.pendingRejectionResponses.length > 0);
      setPendingRejectionResponses(alerts.pendingRejectionResponses);

      // Record-wide data
      setPendingConsentRequests(alerts.pendingConsentRequests);
      setPendingRemovalRequests(alerts.pendingRemovalRequests);
    } catch (error) {
      console.error('Error fetching subject alerts:', error);
    } finally {
      setIsLoading(false);
    }
  }, [recordId]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  return {
    isLoading,
    hasSubjectRequest,
    hasRemovalRequest,
    hasPendingRejectionResponse,
    pendingRejectionResponses,
    removalRequest,
    pendingConsentRequests,
    pendingRemovalRequests,
    refetch: fetchAlerts,
  };
}

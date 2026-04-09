// src/features/RecordRequest/hooks/usePendingInboundRequests.ts

import { useState, useEffect } from 'react';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import { useAuthContext } from '@/features/Auth/AuthContext';

export function usePendingInboundRequests(): number {
  const { user } = useAuthContext();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user?.uid || !user?.email) return;

    const db = getFirestore();

    // Query both — by userId (existing users) and by email (guests who signed up)
    const byUserId = query(
      collection(db, 'recordRequests'),
      where('targetUserId', '==', user.uid),
      where('status', '==', 'pending')
    );

    const byEmail = query(
      collection(db, 'recordRequests'),
      where('targetEmail', '==', user.email),
      where('status', '==', 'pending')
    );

    Promise.all([getDocs(byUserId), getDocs(byEmail)])
      .then(([byIdSnap, byEmailSnap]) => {
        // Deduplicate by document ID in case both queries return the same doc
        const ids = new Set([...byIdSnap.docs.map(d => d.id), ...byEmailSnap.docs.map(d => d.id)]);
        setCount(ids.size);
      })
      .catch(console.error);
  }, [user?.uid, user?.email]);

  return count;
}

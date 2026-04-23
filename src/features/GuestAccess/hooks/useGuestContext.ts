import { useAuthContext } from '@/features/Auth/AuthContext';
import { db } from '@/firebase/config';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { useState } from 'react';

// hooks/useGuestContext.ts
export const useGuestContext = () => {
  const { user } = useAuthContext();
  const [guestContext, setGuestContext] = useState<'sharing' | 'record_request' | undefined>();

  const fetchGuestContext = async () => {
    if (guestContext || !user?.uid) return; // already fetched
    const snap = await getDocs(
      query(collection(db, 'guestInvites'), where('guestUserId', '==', user.uid), limit(1))
    );
    setGuestContext(snap.docs[0]?.data()?.context);
  };

  return { guestContext, fetchGuestContext };
};

// src/features/Messaging/hooks/useUnreadMessageCount.ts

import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebase/config';

export function useUnreadMessageCount(userId: string | undefined): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!userId) return;

    const q = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', userId)
    );

    const unsubscribe = onSnapshot(q, snapshot => {
      const unread = snapshot.docs.filter(doc => {
        const data = doc.data();
        const lastMessageAt = data.lastMessageAt?.toMillis() ?? 0;
        const lastReadAt = data.lastReadAt?.[userId]?.toMillis() ?? 0;
        // Only count conversations where the other person sent something new
        return lastMessageAt > lastReadAt;
      }).length;

      setCount(unread);
    });

    return unsubscribe;
  }, [userId]);

  return count;
}

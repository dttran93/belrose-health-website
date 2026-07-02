// src/features/Settings/components/VouchesSettings.tsx

import { getAuth } from 'firebase/auth';
import { VouchManagement } from '@/features/Credibility/components/Vouches/VouchManagement';

const VouchesSettings = () => {
  const auth = getAuth();
  const userId = auth.currentUser?.uid;

  if (!userId) return null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-1">Vouches</h2>
        <p className="text-sm text-gray-500">
          Vouches are trust statements between members of the Belrose network. They contribute to
          your credibility score.
        </p>
      </div>
      <VouchManagement userId={userId} />
    </div>
  );
};

export default VouchesSettings;

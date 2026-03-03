// src/features/HealthProfile/components/ui/ProfileHeader.tsx

import { ArrowLeft, Database, FileText, Mail, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getUserProfile } from '@/features/Users/services/userProfileService';
import { Avatar } from '@/features/Users/components/Avatar';
import { BelroseUserProfile } from '@/types/core';
import { useEffect, useState } from 'react';

// ============================================================================
// PROFILE HEADER
// ============================================================================

interface ProfileHeaderProps {
  subjectId: string;
  recordCount: number;
  totalResources: number;
  isOwnProfile: boolean;
  isLoading: boolean;
}

const ProfileHeader: React.FC<ProfileHeaderProps> = ({ subjectId, isOwnProfile }) => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<BelroseUserProfile | null>(null);

  // getUserProfile is async so we fetch it in an effect
  useEffect(() => {
    getUserProfile(subjectId).then(setProfile);
  }, [subjectId]);

  return (
    <div className="bg-accent px-6 py-4 rounded-t-lg">
      {/* Back + title row */}
      <div className="flex flex-col items-start gap-3 mb-3">
        <div className="flex justify-between items-center w-full">
          <div>
            <span className="px-2 py-1 text-xs font-medium rounded-full border bg-background text-primary">
              Health Profile
            </span>
          </div>
          <div>
            <button
              onClick={() => navigate(-1)}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-card-foreground"
              aria-label="Go back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex justify-between gap-2">
          <Avatar profile={profile} size="lg" />
          <div className="flex flex-col items-start gap-1">
            <h1 className="text-lg font-semibold text-card-foreground">
              {profile?.displayName ?? (isOwnProfile ? 'My Health Profile' : 'Health Profile')}
            </h1>
            <div className="flex items-center text-xs gap-1.5">
              <div className="flex gap-1">
                <User className="w-3.5 h-3.5" />
                <span className="font-mono">{subjectId}</span>
              </div>
              <div className="h-3 w-px bg-border" />
              <div className="flex gap-1">
                <Mail className="w-3.5 h-3.5" />
                <span className="font-mono">{profile?.email}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileHeader;

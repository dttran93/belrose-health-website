import { useEffect, useState } from 'react';
import { Bell, CircleUserRound, CreditCard, GlobeLock, Link, Settings2 } from 'lucide-react';
import UserSettings from '@/features/Settings/components/UserSettings';
import { getAuth } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { UserService } from '@/components/auth/services/userService';
import { BelroseUserProfile } from '@/types/core';
import { useUserSettings } from '@/features/Settings/hooks/useUserSettings';
import ChangeNameModal from '@/features/Settings/components/ChangeNameModal';
import ChangeEmailModal from '@/features/Settings/components/ChangeEmailModal';
import ChangePhotoModal from '@/features/Settings/components/ChangePhotoModal';

const SettingsPage = () => {
  const auth = getAuth();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('profile');
  const [userProfile, setUserProfile] = useState<BelroseUserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  //Modal states
  const [isChangeNameModalOpen, setIsChangeNameModalOpen] = useState(false);
  const [isChangeEmailModalOpen, setIsChangeEmailModalOpen] = useState(false);
  const [isChangePhotoModalOpen, setIsChangePhotoModalOpen] = useState(false);

  //User settings hook
  const {
    isUpdatingName,
    isUpdatingEmail,
    isUpdatingPhoto,
    updateName,
    updateEmail,
    updatePhoto,
    refreshUserProfile,
  } = useUserSettings({
    onSuccess: async () => {
      //Refresh user profile after successful update
      const updated = await refreshUserProfile();
      if (updated) {
        setUserProfile(updated);
      }
    },
  });

  // If no user is logged in, redirect to auth
  useEffect(() => {
    if (!auth.currentUser) {
      navigate('/auth');
    }
  }, [auth.currentUser, navigate]);

  // Fetch user profile and blockchain member data
  useEffect(() => {
    const fetchUserData = async () => {
      if (!auth.currentUser) return;

      setIsLoading(true);
      try {
        // Fetch user profile from Firestore
        const profile = await UserService.getUserProfile(auth.currentUser.uid);
        setUserProfile(profile);
      } catch (error) {
        console.error('Error fetching user data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, [auth.currentUser]);

  const settingsSections = [
    { id: 'profile', name: 'Profile', icon: CircleUserRound },
    { id: 'wallet', name: 'Blockchain Wallet', icon: Link },
    { id: 'preferences', name: 'Preferences', icon: Settings2 },
    { id: 'privacy', name: 'Privacy & Security', icon: GlobeLock },
    { id: 'notifications', name: 'Notifications', icon: Bell },
    { id: 'billing', name: 'Billing & Plans', icon: CreditCard },
  ];

  const renderContent = () => {
    switch (activeSection) {
      case 'profile':
        if (isLoading) {
          return (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          );
        }

        if (!userProfile) {
          return (
            <div className="bg-white rounded-lg border p-8 text-center">
              <p className="text-gray-600">Unable to load profile data</p>
            </div>
          );
        }

        return (
          <UserSettings
            user={userProfile}
            onChangeName={() => setIsChangeNameModalOpen(true)}
            onChangeEmail={() => setIsChangeEmailModalOpen(true)}
            onChangePhoto={() => setIsChangePhotoModalOpen(true)}
            onStartVerification={() => {
              navigate('/verification');
            }}
          />
        );

      case 'wallet':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Blockchain Wallet</h2>
              <p className="text-gray-600 mb-6">
                Connect a wallet to enable blockchain verification for your medical records. Your
                wallet will be permanently linked to your account for future use.
              </p>
            </div>
          </div>
        );

      case 'preferences':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Preferences</h2>
              <div className="bg-white rounded-lg border p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-gray-900">Blockchain Verification</h3>
                    <p className="text-sm text-gray-600">
                      Automatically verify new records on blockchain
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-gray-900">Auto-connect Wallet</h3>
                    <p className="text-sm text-gray-600">
                      Automatically connect wallet when you sign in
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-gray-900">Email Notifications</h3>
                    <p className="text-sm text-gray-600">
                      Receive updates about your records and verifications
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>
            </div>
          </div>
        );

      case 'privacy':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Privacy & Security</h2>
              <div className="bg-white rounded-lg border p-6 space-y-6">
                <div>
                  <h3 className="font-medium text-gray-900 mb-3">Data Sharing</h3>
                  <div className="space-y-3">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">Allow anonymous analytics</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        defaultChecked
                      />
                      <span className="ml-2 text-sm text-gray-700">
                        Share verification status with providers
                      </span>
                    </label>
                  </div>
                </div>

                <div>
                  <h3 className="font-medium text-gray-900 mb-3">Account Security</h3>
                  <div className="space-y-3">
                    <button className="w-full text-left px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Change Password</span>
                        <span className="text-gray-400">→</span>
                      </div>
                    </button>
                    <button className="w-full text-left px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Two-Factor Authentication</span>
                        <span className="text-gray-400">→</span>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="bg-white rounded-lg border p-8 text-center">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Coming Soon</h3>
            <p className="text-gray-600">This section is under development</p>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        {/* Sidebar */}
        <div className="w-64 bg-white shadow-sm border-r border-gray-200 min-h-screen">
          <div className="p-6">
            <h1 className="text-xl font-semibold text-primary">Settings</h1>
          </div>

          <nav className="px-3">
            {settingsSections.map(section => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center px-3 py-2 text-left rounded-lg mb-1 transition-colors ${
                  activeSection === section.id
                    ? 'bg-chart-1/10 text-primary'
                    : 'text-foreground hover:bg-chart-1/5'
                }`}
              >
                <section.icon className="mr-4 w-5 h-5" />
                <span>{section.name}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1">
          <div className="p-8">{renderContent()}</div>
        </div>
      </div>

      {/* Modals */}
      {userProfile && (
        <>
          <ChangeNameModal
            isOpen={isChangeNameModalOpen}
            onClose={() => setIsChangeNameModalOpen(false)}
            onSubmit={updateName}
            isLoading={isUpdatingName}
            currentFirstName={userProfile.firstName || ''}
            currentLastName={userProfile.lastName || ''}
          />
          <ChangeEmailModal
            isOpen={isChangeEmailModalOpen}
            onClose={() => setIsChangeEmailModalOpen(false)}
            onSubmit={updateEmail}
            isLoading={isUpdatingEmail}
            currentEmail={userProfile.email || ''}
          />
          <ChangePhotoModal
            isOpen={isChangePhotoModalOpen}
            onClose={() => setIsChangePhotoModalOpen(false)}
            onSubmit={updatePhoto}
            isLoading={isUpdatingPhoto}
            currentPhotoURL={userProfile.photoURL || null}
            userInitials={`${userProfile.firstName?.[0] || ''}${userProfile.lastName?.[0] || ''}`.toUpperCase()}
          />
        </>
      )}
    </div>
  );
};

export default SettingsPage;

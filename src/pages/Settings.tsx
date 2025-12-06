import React, { useState } from 'react';
import { Bell, CircleUserRound, CreditCard, GlobeLock, Link, Settings2 } from 'lucide-react';

const SettingsPage = () => {
  const [activeSection, setActiveSection] = useState('profile');

  const settingsSections = [
    { id: 'profile', name: 'Profile', icon: CircleUserRound },
    { id: 'wallet', name: 'Blockchain Wallet', icon: Link },
    { id: 'preferences', name: 'Preferences', icon: Settings2 },
    { id: 'privacy', name: 'Privacy & Security', icon: GlobeLock },
    { id: 'notifications', name: 'Notifications', icon: Bell },
    { id: 'billing', name: 'Billing & Plans', icon: CreditCard },
  ];

  //Replace these with more comprehensive Settings pages later.
  const renderContent = () => {
    switch (activeSection) {
      case 'profile':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Profile Information</h2>
              <div className="bg-white rounded-lg border p-6 space-y-4">
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center">
                    <span className="text-2xl">👤</span>
                  </div>
                  <div>
                    <h3 className="font-medium">John Doe</h3>
                    <p className="text-gray-600">john.doe@email.com</p>
                  </div>
                  <button className="ml-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    Edit Profile
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      defaultValue="John Doe"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      defaultValue="john.doe@email.com"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
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
    </div>
  );
};

export default SettingsPage;

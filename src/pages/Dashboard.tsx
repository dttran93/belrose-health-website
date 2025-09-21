import React from 'react';
import { User } from '@/types/core';

// Interface for component props
interface DashboardProps {
  user?: User | null;
}

// Interface for health statistics
interface HealthStats {
  lastCheckup: string;
  upcomingAppointments: number;
  activeMedications: number;
  pendingLabResults: number;
}

// Interface for activity items
interface ActivityItem {
  type: 'appointment' | 'lab' | 'medication';
  description: string;
  date: string;
}

// Interface for vital signs
interface Vitals {
  bloodPressure: string;
  heartRate: string;
  weight: string;
  temperature: string;
}

const Dashboard: React.FC<DashboardProps> = ({ user = null }) => {
  // Sample data - in real app, this would come from your API
  const healthStats: HealthStats = {
    lastCheckup: '2024-05-15',
    upcomingAppointments: 2,
    activeMedications: 3,
    pendingLabResults: 1,
  };

  const recentActivity: ActivityItem[] = [
    { type: 'appointment', description: 'Annual Physical Exam', date: '2024-05-15' },
    { type: 'lab', description: 'Blood work completed', date: '2024-05-10' },
    { type: 'medication', description: 'Prescription refilled', date: '2024-05-08' },
  ];

  const vitals: Vitals = {
    bloodPressure: '120/80',
    heartRate: '72 bpm',
    weight: '165 lbs',
    temperature: '98.6°F',
  };

  const getActivityIcon = (type: ActivityItem['type']): string => {
    switch (type) {
      case 'appointment':
        return '👨‍⚕️';
      case 'lab':
        return '🧪';
      case 'medication':
        return '💊';
      default:
        return '📋';
    }
  };

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-6 text-white">
        <h2 className="text-2xl font-bold mb-2">
          Welcome back, {user?.displayName || 'User'}!
        </h2>
        <p className="text-blue-100">
          Here's your health overview for today
        </p>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Last Checkup</p>
              <p className="text-2xl font-bold text-gray-900">{healthStats.lastCheckup}</p>
            </div>
            <div className="bg-green-100 p-3 rounded-full">
              <span className="text-green-600 text-xl">✓</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Upcoming Appointments</p>
              <p className="text-2xl font-bold text-gray-900">{healthStats.upcomingAppointments}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-full">
              <span className="text-blue-600 text-xl">📅</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Medications</p>
              <p className="text-2xl font-bold text-gray-900">{healthStats.activeMedications}</p>
            </div>
            <div className="bg-purple-100 p-3 rounded-full">
              <span className="text-purple-600 text-xl">💊</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pending Lab Results</p>
              <p className="text-2xl font-bold text-gray-900">{healthStats.pendingLabResults}</p>
            </div>
            <div className="bg-yellow-100 p-3 rounded-full">
              <span className="text-yellow-600 text-xl">🧪</span>
            </div>
          </div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {recentActivity.map((activity: ActivityItem, index: number) => (
                <div key={index} className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                    <span className="text-sm">
                      {getActivityIcon(activity.type)}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {activity.description}
                    </p>
                    <p className="text-xs text-gray-500">{activity.date}</p>
                  </div>
                </div>
              ))}
            </div>
            <button className="mt-4 text-blue-600 text-sm font-medium hover:text-blue-700">
              View all activity →
            </button>
          </div>
        </div>

        {/* Latest Vitals */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Latest Vitals</h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <p className="text-sm text-gray-600">Blood Pressure</p>
                <p className="text-lg font-semibold text-gray-900">{vitals.bloodPressure}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-600">Heart Rate</p>
                <p className="text-lg font-semibold text-gray-900">{vitals.heartRate}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-600">Weight</p>
                <p className="text-lg font-semibold text-gray-900">{vitals.weight}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-600">Temperature</p>
                <p className="text-lg font-semibold text-gray-900">{vitals.temperature}</p>
              </div>
            </div>
            <button className="mt-4 w-full bg-blue-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-blue-700">
              Update Vitals
            </button>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button className="p-4 border border-gray-200 rounded-md hover:bg-gray-50 text-center">
            <div className="text-2xl mb-2">📅</div>
            <p className="text-sm font-medium">Schedule Appointment</p>
          </button>
          <button className="p-4 border border-gray-200 rounded-md hover:bg-gray-50 text-center">
            <div className="text-2xl mb-2">💊</div>
            <p className="text-sm font-medium">Refill Prescription</p>
          </button>
          <button className="p-4 border border-gray-200 rounded-md hover:bg-gray-50 text-center">
            <div className="text-2xl mb-2">📋</div>
            <p className="text-sm font-medium">View Records</p>
          </button>
          <button className="p-4 border border-gray-200 rounded-md hover:bg-gray-50 text-center">
            <div className="text-2xl mb-2">💬</div>
            <p className="text-sm font-medium">Message Provider</p>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
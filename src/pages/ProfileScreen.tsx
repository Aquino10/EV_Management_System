import React from 'react';
import { Car, Zap, User, MapPin, Calendar } from 'lucide-react';
import type { FacilityState } from '../logic/types';
import type { UserProfile } from '../services/dataService';

interface ProfileScreenProps {
  state: FacilityState;
  currentUser: UserProfile;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ state, currentUser }) => {
  // Find user's EV
  const myEv = state.evs.find(
    (e) =>
      e.ownerUserId
        ? e.ownerUserId === currentUser.id
        : e.driverName.toLowerCase().includes(currentUser.name.toLowerCase().split(' ')[0]) ||
          (currentUser.licensePlate && e.licensePlate === currentUser.licensePlate)
  );

  const formatCountdown = (seconds: number) => {
    if (seconds <= 0 || !isFinite(seconds)) return '00:00:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8 space-y-6 pb-24">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
          My Profile
        </h1>
        <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
          Manage your account and vehicle information
        </p>
      </div>

      {/* User Info Card */}
      <div className="bg-white rounded-xl p-6 border-2 border-gray-200 space-y-4 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-teal-100 to-cyan-100 flex items-center justify-center border-2 border-teal-200">
            <User className="w-8 h-8 text-teal-700" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{currentUser.name}</h2>
            <p className="text-sm text-gray-500 capitalize">{currentUser.role}</p>
          </div>
        </div>
        {currentUser.licensePlate && (
          <div className="pt-4 border-t border-gray-100">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <MapPin className="w-4 h-4" />
              <span>License Plate: {currentUser.licensePlate}</span>
            </div>
          </div>
        )}
      </div>

      {/* My EV Countdown Timer */}
      {myEv ? (
        <div className="bg-gradient-to-br from-teal-50 to-cyan-50 rounded-2xl p-6 border-2 border-teal-300 space-y-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Car className="w-5 h-5 text-teal-700" />
              My EV Countdown
            </h2>
            <span className={`px-4 py-1.5 rounded-full text-xs font-semibold ${
              myEv.status === 'CHARGING'
                ? 'bg-teal-600 text-white'
                : myEv.status === 'COMPLETED'
                ? 'bg-green-600 text-white'
                : 'bg-amber-500 text-white'
            }`}>
              {myEv.status === 'CHARGING' ? 'Charging' : myEv.status === 'COMPLETED' ? 'Complete' : 'Waiting'}
            </span>
          </div>

          <div className="text-center py-8 bg-white rounded-xl border-2 border-teal-200">
            <div className="text-6xl sm:text-7xl font-mono font-bold text-teal-900 mb-3">
              {myEv.status === 'CHARGING' && myEv.timeRemainingSeconds > 0
                ? formatCountdown(myEv.timeRemainingSeconds)
                : myEv.status === 'WAITING' && myEv.estimatedWaitSeconds
                ? formatCountdown(myEv.estimatedWaitSeconds)
                : '00:00:00'}
            </div>
            <p className="text-base font-medium text-gray-600">
              {myEv.status === 'CHARGING' ? 'Time Remaining' : 'Estimated Wait Time'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-teal-200">
            <div className="bg-white rounded-xl p-4 border-2 border-teal-200 text-center">
              <div className="text-3xl font-bold text-gray-900">{myEv.currentChargePercent}%</div>
              <div className="text-sm text-gray-600">Current Charge</div>
            </div>
            <div className="bg-white rounded-xl p-4 border-2 border-teal-200 text-center">
              <div className="text-3xl font-bold text-gray-900">{myEv.targetChargePercent}%</div>
              <div className="text-sm text-gray-600">Target Charge</div>
            </div>
          </div>

          <div className="pt-4 border-t border-teal-200 space-y-3">
            <div className="flex items-center justify-between text-sm bg-white rounded-lg p-3 border border-teal-200">
              <span className="text-gray-600 flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Power Allocated
              </span>
              <span className="font-semibold text-gray-900">{myEv.allocatedPowerKw.toFixed(1)} kW</span>
            </div>
            <div className="flex items-center justify-between text-sm bg-white rounded-lg p-3 border border-teal-200">
              <span className="text-gray-600 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Finish Time
              </span>
              <span className="font-semibold text-gray-900">
                {myEv.estimatedFinishTime
                  ? new Date(myEv.estimatedFinishTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : 'Pending'}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 rounded-2xl p-8 border-2 border-gray-200 text-center space-y-3">
          <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center mx-auto">
            <Car className="w-8 h-8 text-gray-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900">No Vehicle Added</h3>
            <p className="text-sm text-gray-500 mt-1">
              Add your EV to start tracking charging progress
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

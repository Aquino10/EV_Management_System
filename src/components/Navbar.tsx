import React from 'react';
import { Zap, Car, ListOrdered, User, Bell, UserCircle, ShieldCheck } from 'lucide-react';
import type { FacilityState } from '../logic/types';
import type { UserProfile } from '../services/dataService';

export type ScreenType = 'splash' | 'login' | 'driver' | 'queue' | 'profile' | 'live-updates' | 'admin';

interface NavbarProps {
  currentScreen: ScreenType;
  onNavigate: (screen: ScreenType) => void;
  state: FacilityState;
  currentUser: UserProfile;
  onOpenAuth: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentScreen,
  onNavigate,
  state,
  currentUser,
  onOpenAuth,
}) => {
  const queuedCount = state.evs.filter((e) => e.bayId === null && e.energyNeededKwh > 0).length;
  const totalPowerUsed = state.bays.reduce((acc, b) => acc + b.currentPowerKw, 0);

  return (
    <header className="sticky top-0 z-30 w-full bg-white border-b border-gray-200">
      <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Brand */}
        <div
          onClick={() => onNavigate('driver')}
          className="flex items-center gap-2.5 cursor-pointer"
        >
          <div className="w-7 h-7 rounded bg-teal-700 flex items-center justify-center text-white">
            <Zap className="w-4 h-4" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-sm tracking-tight text-gray-900">
              ZeroStatic
            </span>
            <span className="text-[10px] text-gray-500 font-mono hidden sm:block">
              EV Bay Management
            </span>
          </div>
        </div>

        {/* Center Navigation Links (Desktop/Tablet) */}
        <nav className="hidden sm:flex items-center gap-1">
          <button
            onClick={() => onNavigate('driver')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors duration-150 flex items-center gap-1.5 ${
              currentScreen === 'driver'
                ? 'bg-teal-50 text-teal-800 font-semibold'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <Car className="w-3.5 h-3.5" />
            My EV
          </button>
          <button
            onClick={() => onNavigate('queue')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors duration-150 relative flex items-center gap-1.5 ${
              currentScreen === 'queue'
                ? 'bg-teal-50 text-teal-800 font-semibold'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <ListOrdered className="w-3.5 h-3.5" />
            Queue
            {queuedCount > 0 && (
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-amber-100 text-amber-800 font-bold">
                {queuedCount}
              </span>
            )}
          </button>
          <button
            onClick={() => onNavigate('live-updates')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors duration-150 flex items-center gap-1.5 ${
              currentScreen === 'live-updates'
                ? 'bg-teal-50 text-teal-800 font-semibold'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            Live Updates
          </button>
          <button
            onClick={() => onNavigate('profile')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors duration-150 flex items-center gap-1.5 ${
              currentScreen === 'profile'
                ? 'bg-teal-50 text-teal-800 font-semibold'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <UserCircle className="w-3.5 h-3.5" />
            Profile
          </button>
          {currentUser.role === 'admin' && (
            <button
              onClick={() => onNavigate('admin')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors duration-150 flex items-center gap-1.5 ${
                currentScreen === 'admin'
                  ? 'bg-teal-50 text-teal-800 font-semibold'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Facility
            </button>
          )}
        </nav>

        {/* Right Telemetry & User */}
        <div className="flex items-center gap-2">
          {/* Facility Power indicator */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded bg-gray-50 border border-gray-200 font-mono text-xs text-gray-700">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-600" />
            <span>Load: {totalPowerUsed.toFixed(1)} / {state.config.totalPowerKw.toFixed(1)} kW</span>
          </div>

          {/* User Profile switch button */}
          <button
            onClick={onOpenAuth}
            className="flex items-center gap-1.5 py-1 px-2.5 rounded-md bg-white hover:bg-gray-50 border border-gray-300 text-xs text-gray-700 transition-colors duration-150"
          >
            <User className="w-3.5 h-3.5 text-teal-700" />
            <span className="max-w-[90px] truncate">{currentUser.name.split(' ')[0]}</span>
            <span className="text-[10px] font-mono text-gray-500 uppercase">
              ({currentUser.role})
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};

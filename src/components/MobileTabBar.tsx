import React from 'react';
import { Car, ListOrdered, Bell, UserCircle, ShieldCheck } from 'lucide-react';
import type { ScreenType } from './Navbar';
import type { UserProfile } from '../services/dataService';

interface MobileTabBarProps {
  currentScreen: ScreenType;
  onNavigate: (screen: ScreenType) => void;
  queuedCount: number;
  currentUser: UserProfile;
}

export const MobileTabBar: React.FC<MobileTabBarProps> = ({
  currentScreen,
  onNavigate,
  queuedCount,
  currentUser,
}) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t-2 border-gray-200 sm:hidden flex items-center justify-around py-2 px-2">
      <button
        onClick={() => onNavigate('driver')}
        className={`flex flex-col items-center gap-1 py-2 px-3 rounded-xl transition-all duration-200 ${
          currentScreen === 'driver' ? 'bg-teal-50 text-teal-700 font-semibold' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
        }`}
      >
        <Car className="w-5 h-5" />
        <span className="text-xs">My EV</span>
      </button>

      <button
        onClick={() => onNavigate('queue')}
        className={`flex flex-col items-center gap-1 py-2 px-3 rounded-xl transition-all duration-200 relative ${
          currentScreen === 'queue' ? 'bg-teal-50 text-teal-700 font-semibold' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
        }`}
      >
        <div className="relative">
          <ListOrdered className="w-5 h-5" />
          {queuedCount > 0 && (
            <span className="absolute -top-1 -right-2 w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
              {queuedCount}
            </span>
          )}
        </div>
        <span className="text-xs">Queue</span>
      </button>

      <button
        onClick={() => onNavigate('live-updates')}
        className={`flex flex-col items-center gap-1 py-2 px-3 rounded-xl transition-all duration-200 ${
          currentScreen === 'live-updates' ? 'bg-teal-50 text-teal-700 font-semibold' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
        }`}
      >
        <Bell className="w-5 h-5" />
        <span className="text-xs">Live Updates</span>
      </button>

      <button
        onClick={() => onNavigate('profile')}
        className={`flex flex-col items-center gap-1 py-2 px-3 rounded-xl transition-all duration-200 ${
          currentScreen === 'profile' ? 'bg-teal-50 text-teal-700 font-semibold' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
        }`}
      >
        <UserCircle className="w-5 h-5" />
        <span className="text-xs">Profile</span>
      </button>

      {currentUser.role === 'admin' && (
        <button
          onClick={() => onNavigate('admin')}
          className={`flex flex-col items-center gap-1 py-2 px-3 rounded-xl transition-all duration-200 ${
            currentScreen === 'admin' ? 'bg-teal-50 text-teal-700 font-semibold' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
          }`}
        >
          <ShieldCheck className="w-5 h-5" />
          <span className="text-xs">Facility</span>
        </button>
      )}
    </nav>
  );
};

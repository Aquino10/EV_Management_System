import React from 'react';
import { Bell, Clock, CheckCircle, AlertCircle, Info } from 'lucide-react';
import type { FacilityState } from '../logic/types';
import type { UserProfile } from '../services/dataService';

interface LiveUpdatesScreenProps {
  state: FacilityState;
  currentUser: UserProfile;
}

interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning';
  message: string;
  timestamp: string;
}

export const LiveUpdatesScreen: React.FC<LiveUpdatesScreenProps> = ({ state, currentUser }) => {
  // Find user's EV
  const myEv = state.evs.find(
    (e) =>
      e.ownerUserId
        ? e.ownerUserId === currentUser.id
        : e.driverName.toLowerCase().includes(currentUser.name.toLowerCase().split(' ')[0]) ||
          (currentUser.licensePlate && e.licensePlate === currentUser.licensePlate)
  );

  // Generate notifications based on state
  const notifications: Notification[] = [];

  // Notification for user's EV starting to charge
  if (myEv && myEv.status === 'CHARGING' && myEv.timeRemainingSeconds > 0) {
    notifications.push({
      id: 'charging-start',
      type: 'success',
      message: `Your ${myEv.model} is now charging at ${myEv.allocatedPowerKw.toFixed(1)} kW`,
      timestamp: state.currentTime,
    });
  }

  // Notification for EV almost done (less than 5 minutes)
  if (myEv && myEv.status === 'CHARGING' && myEv.timeRemainingSeconds > 0 && myEv.timeRemainingSeconds < 300) {
    notifications.push({
      id: 'almost-done',
      type: 'warning',
      message: `Your ${myEv.model} is almost done charging! Less than 5 minutes remaining.`,
      timestamp: state.currentTime,
    });
  }

  // Notification for completed charging
  if (myEv && myEv.status === 'COMPLETED') {
    notifications.push({
      id: 'charging-complete',
      type: 'success',
      message: `Your ${myEv.model} has reached its target charge!`,
      timestamp: state.currentTime,
    });
  }

  // Notification for queue position
  if (myEv && myEv.status === 'WAITING' && myEv.queuePosition) {
    notifications.push({
      id: 'queue-position',
      type: 'info',
      message: `Your vehicle is in queue position #${myEv.queuePosition}. Estimated wait: ${Math.ceil((myEv.estimatedWaitSeconds || 0) / 60)} minutes.`,
      timestamp: state.currentTime,
    });
  }

  // Notification for other vehicles in bays
  state.evs.forEach((ev) => {
    if (ev.bayId && ev.status === 'CHARGING' && ev.timeRemainingSeconds > 0 && ev.timeRemainingSeconds < 300) {
      notifications.push({
        id: `bay-${ev.bayId}-alert`,
        type: 'info',
        message: `Bay ${ev.bayId}: ${ev.model} is almost done charging (${Math.ceil(ev.timeRemainingSeconds / 60)} min remaining)`,
        timestamp: state.currentTime,
      });
    }
  });

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-amber-600" />;
      case 'info':
      default:
        return <Info className="w-5 h-5 text-blue-600" />;
    }
  };

  const getNotificationBg = (type: Notification['type']) => {
    switch (type) {
      case 'success':
        return 'bg-green-50 border-green-200';
      case 'warning':
        return 'bg-amber-50 border-amber-200';
      case 'info':
      default:
        return 'bg-blue-50 border-blue-200';
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8 space-y-6 pb-24">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
          <Bell className="w-6 h-6 text-teal-700" />
          Live Updates
        </h1>
        <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
          Real-time notifications for your charging session
        </p>
      </div>

      {/* Notifications List */}
      <div className="space-y-4">
        {notifications.length > 0 ? (
          notifications.map((notification) => (
            <div
              key={notification.id}
              className={`p-5 rounded-xl border-2 ${getNotificationBg(notification.type)} flex items-start gap-4 shadow-sm`}
            >
              <div className="mt-0.5">{getNotificationIcon(notification.type)}</div>
              <div className="flex-1">
                <p className="text-sm text-gray-900 font-medium">{notification.message}</p>
                <p className="text-xs text-gray-500 mt-2">{formatTime(notification.timestamp)}</p>
              </div>
            </div>
          ))
        ) : (
          <div className="bg-gray-50 rounded-2xl p-8 border-2 border-gray-200 text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center mx-auto">
              <Bell className="w-8 h-8 text-gray-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900">No Notifications</h3>
              <p className="text-sm text-gray-500 mt-1">
                {myEv
                  ? 'You will receive updates when your EV starts charging or is almost done.'
                  : 'Add your EV to receive charging notifications.'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Quick Status Summary */}
      {myEv && (
        <div className="bg-white rounded-xl p-6 border-2 border-gray-200 space-y-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-teal-700" />
            Current Status
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 p-4 rounded-xl border-2 border-gray-200">
              <div className="text-xs text-gray-500 mb-1">Status</div>
              <div className="text-base font-semibold text-gray-900 capitalize">{myEv.status.toLowerCase()}</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-xl border-2 border-gray-200">
              <div className="text-xs text-gray-500 mb-1">Power</div>
              <div className="text-base font-semibold text-gray-900">{myEv.allocatedPowerKw.toFixed(1)} kW</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-xl border-2 border-gray-200">
              <div className="text-xs text-gray-500 mb-1">Current Charge</div>
              <div className="text-base font-semibold text-gray-900">{myEv.currentChargePercent}%</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-xl border-2 border-gray-200">
              <div className="text-xs text-gray-500 mb-1">Target</div>
              <div className="text-base font-semibold text-gray-900">{myEv.targetChargePercent}%</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

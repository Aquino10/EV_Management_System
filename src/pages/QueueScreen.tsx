import React from 'react';
import {
  ListOrdered,
  Clock,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import type { FacilityState } from '../logic/types';
import type { UserProfile } from '../services/dataService';
import type { ScreenType } from '../components/Navbar';

interface QueueScreenProps {
  state: FacilityState;
  currentUser: UserProfile;
  onNavigate?: (screen: ScreenType) => void;
  onSimulateEV?: () => void;
}

export const QueueScreen: React.FC<QueueScreenProps> = ({
  state,
  currentUser,
}) => {
  // Find all queued EVs (waiting with energyNeeded > 0 and bayId is null)
  const queuedEvs = state.evs
    .filter((e) => e.bayId === null && e.energyNeededKwh > 0 && e.status !== 'DEPARTED')
    .sort((a, b) => (a.queuePosition || 999) - (b.queuePosition || 999));

  // Find user's queued EV if any
  const myQueuedEv = queuedEvs.find(
    (e) =>
      e.ownerUserId
        ? e.ownerUserId === currentUser.id
        : e.driverName.toLowerCase().includes(currentUser.name.toLowerCase().split(' ')[0]) ||
          (currentUser.licensePlate && e.licensePlate === currentUser.licensePlate)
  );

  const activeBays = state.bays;

  // Find vehicles currently in bays
  const vehiclesInBays = state.evs.filter((e) => e.bayId !== null && e.status !== 'DEPARTED');

  const formatWaitTime = (seconds: number | null) => {
    if (seconds === null || seconds < 0 || !Number.isFinite(seconds)) return 'Estimating...';
    if (seconds === 0) return 'Immediate';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins >= 60) {
      const hrs = Math.floor(mins / 60);
      const remMins = mins % 60;
      return `approx ${hrs}h ${remMins}m`;
    }
    return `approx ${mins}m ${secs.toString().padStart(2, '0')}s`;
  };

  const formatChargingTime = (seconds: number | null) => {
    if (seconds === null || seconds < 0 || !Number.isFinite(seconds)) return 'Calculating...';
    if (seconds === 0) return 'Complete';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins >= 60) {
      const hrs = Math.floor(mins / 60);
      const remMins = mins % 60;
      return `${hrs}h ${remMins}m`;
    }
    return `${mins}m ${secs.toString().padStart(2, '0')}s`;
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8 space-y-6 pb-24">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
          Charging Status
        </h1>
        <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
          View vehicles currently charging in bays and those waiting in the queue.
        </p>
      </div>

      {/* Vehicles Currently in Bays */}
      <section className="space-y-4">
        <div className="flex items-center justify-between text-sm">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <ListOrdered className="w-5 h-5 text-teal-700" />
            <span>Vehicles in Bays ({vehiclesInBays.length})</span>
          </h2>
          <span className="text-gray-400">Active charging</span>
        </div>

        {vehiclesInBays.length > 0 ? (
          <div className="space-y-3">
            {vehiclesInBays.map((ev) => (
              <div
                key={ev.id}
                className="p-5 bg-white rounded-xl border-2 border-teal-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-sm shadow-sm"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-teal-50 text-teal-800 border-2 border-teal-200 font-mono font-bold text-sm flex items-center justify-center shrink-0">
                    Bay {ev.bayId}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{ev.model}</span>
                      <span className="font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                        {ev.licensePlate}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Driver: {ev.driverName} • Power: {ev.allocatedPowerKw.toFixed(1)} kW
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-8 pt-3 sm:pt-0 border-t sm:border-t-0 border-gray-100">
                  <div className="text-left sm:text-right">
                    <span className="text-[11px] uppercase font-mono text-gray-400 block">Est. Time Remaining</span>
                    <span className="font-mono font-semibold text-teal-700 text-base">
                      {formatChargingTime(ev.timeRemainingSeconds)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] uppercase font-mono text-gray-400 block">Current Charge</span>
                    <span className="font-mono font-semibold text-gray-900 text-base">
                      {ev.currentChargePercent}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 bg-gray-50 rounded-xl border-2 border-gray-200 text-sm text-gray-500 text-center">
            No vehicles currently charging in bays.
          </div>
        )}
      </section>

      {/* Featured Primary Card for Driver or Head of Queue */}
      {queuedEvs.length > 0 ? (
        <div className="bg-white rounded-lg p-5 border border-amber-300 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-amber-800 uppercase tracking-wider">
                  {myQueuedEv ? 'Your Queue Position' : 'Next Vehicle in Line'}
                </span>
                <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200 text-xs font-mono font-bold">
                  Position #{myQueuedEv ? myQueuedEv.queuePosition : queuedEvs[0].queuePosition}
                </span>
              </div>
              <h2 className="text-lg font-bold text-gray-900">
                {myQueuedEv ? myQueuedEv.model : queuedEvs[0].model}
              </h2>
              <div className="flex items-center gap-2 text-xs text-gray-500 font-mono mt-0.5">
                <span>{myQueuedEv ? myQueuedEv.licensePlate : queuedEvs[0].licensePlate}</span>
                <span>:</span>
                <span>Driver {myQueuedEv ? myQueuedEv.driverName : queuedEvs[0].driverName}</span>
              </div>
            </div>

            {/* Live Estimated Wait Time Badge */}
            <div className="bg-amber-50/60 border border-amber-200 rounded p-3 sm:p-4 text-left sm:text-right min-w-[200px]">
              <div className="text-[11px] font-mono text-amber-800 uppercase tracking-wider flex items-center sm:justify-end gap-1.5 font-medium">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                Estimated Wait Time
              </div>
              <div className="text-2xl font-bold font-mono text-gray-900 mt-1">
                {formatWaitTime(myQueuedEv ? myQueuedEv.estimatedWaitSeconds : queuedEvs[0].estimatedWaitSeconds)}
              </div>
              <div className="text-[10px] text-gray-500 mt-0.5">
                Updates as bays free up
              </div>
            </div>
          </div>

          {/* Prominent Disclaimer Label */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded flex items-start gap-2 text-xs text-amber-900">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              Estimate notice: Wait times are calculated forward from current bay charging progress and scheduled departure times.
            </span>
          </div>

          {/* Bay Availability Projection */}
          <div className="pt-1">
            <span className="text-xs font-medium text-gray-600 block mb-2">
              Bay Availability Projection
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {activeBays.map((bay) => {
                const occupyingEv = state.evs.find((e) => e.bayId === bay.id);
                const finishTimeStr = occupyingEv?.estimatedFinishTime
                  ? new Date(occupyingEv.estimatedFinishTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : 'N/A';

                return (
                  <div key={bay.id} className="p-3 rounded bg-gray-50 border border-gray-200 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-semibold text-gray-800">{bay.name}</div>
                      <div className="text-[11px] text-gray-500">
                        {occupyingEv ? `Charging ${occupyingEv.model}` : 'Unoccupied'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-medium text-teal-700">Est. Free: {finishTimeStr}</div>
                      <div className="text-[10px] text-gray-400">
                        {occupyingEv && occupyingEv.timeRemainingSeconds > 0
                          ? `in approx ${Math.ceil(occupyingEv.timeRemainingSeconds / 60)}m`
                          : 'Available'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg p-8 border border-gray-200 text-center space-y-3">
          <div className="w-10 h-10 rounded bg-teal-50 text-teal-700 flex items-center justify-center mx-auto">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">No Vehicles Waiting in Queue</h3>
            <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
              All arrived vehicles are currently parked in charging bays or have departed.
            </p>
          </div>
        </div>
      )}

      {/* Complete Queued EVs List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between text-sm">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <ListOrdered className="w-5 h-5 text-gray-500" />
            <span>Vehicles in Queue ({queuedEvs.length})</span>
          </h2>
          <span className="text-gray-400">Ordered by arrival timestamp</span>
        </div>

        {queuedEvs.length > 0 ? (
          <div className="space-y-3">
            {queuedEvs.map((ev) => (
              <div
                key={ev.id}
                className="p-5 bg-white rounded-xl border-2 border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-sm shadow-sm"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-800 border-2 border-amber-200 font-mono font-bold text-sm flex items-center justify-center shrink-0">
                    #{ev.queuePosition}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{ev.model}</span>
                      <span className="font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                        {ev.licensePlate}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Driver: {ev.driverName}, Trip: {ev.tripDistanceKm} km, Current: {ev.currentChargePercent}%
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-8 pt-3 sm:pt-0 border-t sm:border-t-0 border-gray-100">
                  <div className="text-left sm:text-right">
                    <span className="text-[11px] uppercase font-mono text-gray-400 block">Estimated Wait</span>
                    <span className="font-mono font-semibold text-amber-800 text-base">
                      {formatWaitTime(ev.estimatedWaitSeconds)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] uppercase font-mono text-gray-400 block">Target Charge</span>
                    <span className="font-mono font-semibold text-teal-700 text-base">
                      {ev.targetChargePercent}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 bg-gray-50 rounded-xl border-2 border-gray-200 text-sm text-gray-500 text-center">
            Queue is currently empty.
          </div>
        )}
      </div>
    </div>
  );
};

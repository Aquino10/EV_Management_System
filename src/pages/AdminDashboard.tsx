import React from 'react';
import {
  ShieldCheck,
  Zap,
  Layers,
  Trash2,
  Calendar,
} from 'lucide-react';
import type { FacilityState } from '../logic/types';
import type { UserProfile } from '../services/dataService';

interface AdminDashboardProps {
  state: FacilityState;
  currentUser: UserProfile;
  onUpdatePower: (powerKw: number) => void;
  onRemoveEV: (evId: string) => void;
  onSimulateUrgent?: () => void;
  onReset?: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  state,
  onUpdatePower,
  onRemoveEV,
}) => {
  const totalPowerUsed = state.bays.reduce((acc, b) => acc + b.currentPowerKw, 0);
  const totalPowerCapacity = state.config.totalPowerKw;
  const powerUtilization = Math.round((totalPowerUsed / totalPowerCapacity) * 100);
  const occupiedBays = state.bays.filter((b) => b.status !== 'FREE').length;

  const handlePowerChange = (power: number) => {
    onUpdatePower(power);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8 space-y-6 pb-24">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
          Facility Admin
        </h1>
        <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
          Overview of total facility power, bay occupancy, vehicle schedules, and registered drivers.
        </p>
      </div>

      {/* Facility Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Total Power Limit */}
        <div className="bg-white p-4 rounded-lg border border-gray-200 space-y-3">
          <div>
            <div className="text-xs text-gray-500 flex items-center gap-1.5 mb-1">
              <Zap className="w-3.5 h-3.5 text-teal-700" />
              <span>Facility Power Limit</span>
            </div>
            <div className="text-2xl font-bold font-mono text-gray-900">
              {totalPowerCapacity.toFixed(1)} <span className="text-xs text-gray-500 font-normal">kW</span>
            </div>
          </div>

          <div className="pt-2 border-t border-gray-100">
            <span className="text-[11px] text-gray-500 block mb-1.5">Change capacity limit:</span>
            <div className="grid grid-cols-4 gap-1">
              {[3.7, 7.0, 11.0, 22.0].map((kw) => (
                <button
                  key={kw}
                  onClick={() => handlePowerChange(kw)}
                  className={`py-1 text-xs font-mono rounded border transition-colors duration-150 ${
                    Math.abs(totalPowerCapacity - kw) < 0.1
                      ? 'bg-teal-50 text-teal-800 border-teal-600 font-semibold'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {kw}k
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Current Power In Use */}
        <div className="bg-white p-4 rounded-lg border border-gray-200 space-y-3">
          <div>
            <div className="text-xs text-gray-500 flex items-center gap-1.5 mb-1">
              <Zap className="w-3.5 h-3.5 text-teal-700" />
              <span>Power In Use</span>
            </div>
            <div className="text-2xl font-bold font-mono text-teal-700">
              {totalPowerUsed.toFixed(1)} <span className="text-xs text-gray-500 font-normal">kW</span>
            </div>
          </div>

          <div className="pt-2 border-t border-gray-100 text-xs">
            <div className="flex justify-between text-[11px] text-gray-600 mb-1">
              <span>Utilization: {powerUtilization}%</span>
              <span>Available: {(totalPowerCapacity - totalPowerUsed).toFixed(1)} kW</span>
            </div>
            <div className="w-full h-1.5 bg-gray-200 rounded overflow-hidden">
              <div
                className="h-full bg-teal-600 transition-all duration-200"
                style={{ width: `${Math.min(100, powerUtilization)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Bay Occupancy */}
        <div className="bg-white p-4 rounded-lg border border-gray-200 space-y-3">
          <div>
            <div className="text-xs text-gray-500 flex items-center gap-1.5 mb-1">
              <Layers className="w-3.5 h-3.5 text-gray-500" />
              <span>Bay Occupancy</span>
            </div>
            <div className="text-2xl font-bold font-mono text-gray-900">
              {occupiedBays} / {state.bays.length}{' '}
              <span className="text-xs text-gray-500 font-normal">Bays</span>
            </div>
          </div>

          <div className="pt-2 border-t border-gray-100 text-[11px] text-gray-500 space-y-1">
            {state.bays.map((bay) => (
              <div key={bay.id} className="flex justify-between">
                <span>{bay.name}:</span>
                <span className="font-mono text-gray-900 font-medium">
                  {bay.currentPowerKw.toFixed(1)} kW ({bay.status})
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Charging Schedule for All EVs */}
      <section className="bg-white rounded-lg border border-gray-200 p-5 space-y-3">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 text-xs">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            <span>Charging Schedule & Finish Times</span>
          </h2>
          <span className="font-mono text-gray-500">
            Current time: {new Date(state.currentTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        {state.evs.length > 0 ? (
          <div className="space-y-2">
            {state.evs.map((ev) => {
              const finishTimeStr = ev.estimatedFinishTime
                ? new Date(ev.estimatedFinishTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : 'Waiting in queue';
              const depTimeStr = new Date(ev.departureTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

              return (
                <div
                  key={ev.id}
                  className="p-3 bg-gray-50 rounded border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        ev.bayId ? 'bg-teal-600' : 'bg-amber-500'
                      }`}
                    />
                    <div>
                      <div className="flex items-center gap-2 font-medium text-gray-900">
                        <span>{ev.model}</span>
                        <span className="font-mono text-[11px] text-gray-500 bg-white border border-gray-200 px-1.5 py-0.2 rounded">
                          {ev.licensePlate}
                        </span>
                        {ev.bayId ? (
                          <span className="text-[10px] font-mono text-teal-800 bg-teal-50 border border-teal-200 px-1.5 py-0.2 rounded">
                            Bay {ev.bayId}
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded">
                            Queue #{ev.queuePosition}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-gray-500 mt-0.5">
                        Driver {ev.driverName}, Charge {ev.currentChargePercent.toFixed(1)}% of target {ev.targetChargePercent}%
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 font-mono text-xs pt-1 sm:pt-0 border-t sm:border-t-0 border-gray-200">
                    <div>
                      <span className="text-[10px] text-gray-400 block uppercase">Finish Time</span>
                      <span className="text-gray-900 font-semibold">{finishTimeStr}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 block uppercase">Departure</span>
                      <span className="text-gray-700">{depTimeStr}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 block uppercase">Power</span>
                      <span className="text-teal-700 font-semibold">{ev.allocatedPowerKw.toFixed(1)} kW</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-4 bg-gray-50 rounded border border-gray-200 text-xs text-gray-500 text-center">
            No registered vehicles in the facility.
          </div>
        )}
      </section>

      {/* Table of Registered Users and EVs */}
      <section className="bg-white rounded-lg border border-gray-200 p-5 space-y-3">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 text-xs">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-gray-500" />
            <span>Registered Vehicles ({state.evs.length})</span>
          </h2>
          <span className="text-gray-400">Live bay allocation data</span>
        </div>

        {state.evs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500 font-mono text-[11px]">
                  <th className="pb-2 font-medium">Driver & Vehicle</th>
                  <th className="pb-2 font-medium">Plate</th>
                  <th className="pb-2 font-medium">Charge / Target</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Location</th>
                  <th className="pb-2 font-medium">Power</th>
                  <th className="pb-2 font-medium">Finish Time</th>
                  <th className="pb-2 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {state.evs.map((ev) => (
                  <tr key={ev.id} className="hover:bg-gray-50/50">
                    <td className="py-2.5">
                      <div className="font-medium text-gray-900">{ev.driverName}</div>
                      <div className="text-[11px] text-gray-500">{ev.model}</div>
                    </td>
                    <td className="py-2.5 font-mono text-gray-600">{ev.licensePlate}</td>
                    <td className="py-2.5 font-mono">
                      <span className="font-medium text-gray-900">{ev.currentChargePercent.toFixed(1)}%</span>
                      <span className="text-gray-400"> / {ev.targetChargePercent}%</span>
                    </td>
                    <td className="py-2.5">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-mono uppercase ${
                          ev.status === 'CHARGING'
                            ? 'bg-teal-50 text-teal-800 border border-teal-200'
                            : ev.status === 'COMPLETED'
                            ? 'bg-teal-50 text-teal-800 border border-teal-200'
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {ev.status}
                      </span>
                    </td>
                    <td className="py-2.5 font-mono text-xs">
                      {ev.bayId ? `Bay ${ev.bayId}` : `Queue #${ev.queuePosition}`}
                    </td>
                    <td className="py-2.5 font-mono text-teal-700 font-medium">
                      {ev.allocatedPowerKw.toFixed(1)} kW
                    </td>
                    <td className="py-2.5 font-mono text-gray-600">
                      {ev.estimatedFinishTime
                        ? new Date(ev.estimatedFinishTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : 'N/A'}
                    </td>
                    <td className="py-2.5 text-right">
                      <button
                        onClick={() => onRemoveEV(ev.id)}
                        className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors duration-150"
                        title="Remove vehicle from facility"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-4 bg-gray-50 rounded border border-gray-200 text-xs text-gray-500 text-center">
            No registered vehicles to display.
          </div>
        )}
      </section>
    </div>
  );
};

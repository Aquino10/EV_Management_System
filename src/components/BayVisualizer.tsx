import React from 'react';
import { Zap, Clock, LogOut, Plus } from 'lucide-react';
import type { Bay, EV } from '../logic/types';

interface BayVisualizerProps {
  bays: Bay[];
  evs: EV[];
  onDepartBay?: (bayId: number) => void;
  onAddCarToBay?: (bayId: number) => void;
  onScrollToForm?: () => void;
}

export const BayVisualizer: React.FC<BayVisualizerProps> = ({
  bays,
  evs,
  onDepartBay,
  onAddCarToBay,
  onScrollToForm,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {bays.map((bay) => {
        const assignedEv = evs.find((e) => e.bayId === bay.id);
        const isCharging = bay.status === 'CHARGING' && bay.currentPowerKw > 0;
        const isOccupied = bay.status === 'OCCUPIED' || Boolean(assignedEv);
        const isFree = !assignedEv && bay.status === 'FREE';
        const isCompleted = assignedEv?.status === 'COMPLETED';
        const indicatorClassName = isOccupied
          ? bay.id === 1
            ? 'bg-yellow-400 text-yellow-600 animate-occupancy-blink'
            : 'bg-red-600 text-red-600 animate-occupancy-blink'
          : 'bg-green-500';
        const indicatorLabel = isOccupied
          ? `Bay ${bay.id} occupied: blinking ${bay.id === 1 ? 'yellow' : 'red'} indicator`
          : 'Bay free: green indicator';

        return (
          <div
            key={bay.id}
            className={`bg-white rounded-lg p-4 sm:p-5 border transition-all duration-200 ${
              isCharging
                ? 'border-teal-600 shadow-sm'
                : isCompleted
                ? 'border-teal-400'
                : isOccupied
                ? 'border-amber-400'
                : 'border-gray-200'
            }`}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span
                  role="img"
                  aria-label={indicatorLabel}
                  className={`w-2.5 h-2.5 rounded-full ${indicatorClassName}`}
                />
                <span className="font-semibold text-sm text-gray-900">{bay.name}</span>
              </div>

              {/* Status Badge */}
              <div className="flex items-center gap-1.5">
                <span
                  className={`text-[11px] font-mono uppercase tracking-wider px-2 py-0.5 rounded border font-medium ${
                    isCharging
                      ? 'bg-teal-50 text-teal-800 border-teal-200'
                      : isCompleted
                      ? 'bg-teal-50 text-teal-800 border-teal-200'
                      : isOccupied
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : 'bg-gray-50 text-gray-600 border-gray-200'
                  }`}
                >
                  {isCharging ? 'Charging' : isCompleted ? 'Target Reached' : isOccupied ? 'Occupied' : 'Free'}
                </span>
              </div>
            </div>

            {/* Live Parking Bay Floor & EV Representation */}
            <div className="relative bg-[#F3F4F6] rounded-md border border-gray-200 p-3 overflow-hidden min-h-[175px] flex items-center justify-between">
              {/* Parking Stall markings */}
              <div className="absolute inset-0 pointer-events-none opacity-40">
                <div className="absolute top-2 left-2 text-[9px] font-mono font-bold text-gray-400 tracking-wider">
                  STALL 0{bay.id}
                </div>
                {/* Yellow parking boundary lines */}
                <div className="absolute top-0 bottom-0 left-1 w-0.5 bg-yellow-400" />
                <div className="absolute top-0 bottom-0 right-1 w-0.5 bg-yellow-400" />
                <div className="absolute bottom-2 left-6 right-6 h-1 rounded bg-gray-400" />
              </div>

              {/* Left Column: Charger Pedestal & Telemetry */}
              <div className="z-10 flex flex-col justify-between self-stretch py-1">
                <div className="flex items-center gap-2.5">
                  {/* Physical Charger Pillar */}
                  <div
                    className={`w-10 h-14 rounded border flex flex-col items-center justify-between py-1 px-1 shadow-xs ${
                      isCharging
                        ? 'border-teal-600 bg-white'
                        : 'border-gray-300 bg-white'
                    }`}
                  >
                    <Zap
                      className={`w-3.5 h-3.5 ${
                        isCharging ? 'text-teal-600' : 'text-gray-400'
                      }`}
                    />
                    <div
                      className={`w-2 h-4 rounded-xs ${
                        isCharging ? 'bg-teal-600' : 'bg-gray-300'
                      }`}
                    />
                    <span className="text-[8px] font-mono text-gray-500">7kW</span>
                  </div>

                  {/* Power Display */}
                  <div>
                    <span className="text-[10px] uppercase font-mono text-gray-500 block">
                      Allocated Power
                    </span>
                    <div className="flex items-baseline gap-1">
                      <span className={`text-xl font-bold font-mono ${isCharging ? 'text-teal-700' : 'text-gray-500'}`}>
                        {bay.currentPowerKw.toFixed(1)}
                      </span>
                      <span className="text-xs text-gray-500 font-mono">kW</span>
                    </div>
                    <span className="text-[10px] text-gray-400 font-mono">
                      Max: {bay.maxPowerKw.toFixed(1)} kW
                    </span>
                  </div>
                </div>

                {/* Cable Connection representation */}
                {isCharging && (
                  <div className="text-[10px] font-mono text-teal-700 flex items-center gap-1 mt-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-600" />
                    <span>Power flow active</span>
                  </div>
                )}
              </div>

              {/* Right Column: Realistic Vehicle in Bay or Empty Bay Action */}
              <div className="z-10 flex flex-col items-center justify-center pl-2">
                {assignedEv ? (
                  <div className="flex items-center gap-3">
                    {/* Top-Down Realistic EV Illustration */}
                    <div className="relative transition-transform duration-300">
                      <svg
                        width="80"
                        height="135"
                        viewBox="0 0 80 135"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        className="drop-shadow-sm"
                      >
                        {/* Wheels */}
                        <rect x="2" y="22" width="6" height="18" rx="2" fill="#1F2937" />
                        <rect x="72" y="22" width="6" height="18" rx="2" fill="#1F2937" />
                        <rect x="2" y="95" width="6" height="18" rx="2" fill="#1F2937" />
                        <rect x="72" y="95" width="6" height="18" rx="2" fill="#1F2937" />

                        {/* Car Body Outer Shell */}
                        <rect
                          x="7"
                          y="6"
                          width="66"
                          height="123"
                          rx="14"
                          fill="#FFFFFF"
                          stroke={isCharging ? '#0D9488' : '#9CA3AF'}
                          strokeWidth="2"
                        />

                        {/* Front Windshield */}
                        <path
                          d="M17 40C17 32 23 27 40 27C57 27 63 32 63 40V46H17V40Z"
                          fill="#1E293B"
                        />

                        {/* Panoramic Glass Roof */}
                        <rect x="20" y="49" width="40" height="38" rx="4" fill="#334155" />

                        {/* Rear Windshield */}
                        <path
                          d="M17 92H63V98C63 105 57 109 40 109C23 109 17 105 17 98V92Z"
                          fill="#1E293B"
                        />

                        {/* Headlights */}
                        <rect x="12" y="8" width="10" height="4" rx="2" fill="#FDE047" />
                        <rect x="58" y="8" width="10" height="4" rx="2" fill="#FDE047" />

                        {/* Taillights */}
                        <rect x="12" y="123" width="12" height="3" rx="1.5" fill="#EF4444" />
                        <rect x="56" y="123" width="12" height="3" rx="1.5" fill="#EF4444" />

                        {/* Side Mirrors */}
                        <rect x="2" y="40" width="5" height="10" rx="2" fill="#64748B" />
                        <rect x="73" y="40" width="5" height="10" rx="2" fill="#64748B" />

                        {/* Charging Port Connector Socket on front left */}
                        {isCharging && (
                          <circle cx="12" cy="28" r="3.5" fill="#0D9488" stroke="#FFFFFF" strokeWidth="1" />
                        )}
                      </svg>
                    </div>

                    {/* Vehicle Text Details */}
                    <div className="text-left space-y-1 max-w-[130px]">
                      <span className="inline-block px-1.5 py-0.5 rounded bg-white border border-gray-300 text-xs font-mono font-bold text-gray-900">
                        {assignedEv.licensePlate}
                      </span>
                      <div className="text-xs font-semibold text-gray-900 leading-tight">
                        {assignedEv.model}
                      </div>
                      <div className="text-[11px] text-gray-500 truncate">
                        {assignedEv.driverName}
                      </div>

                      {/* Action Button */}
                      <div className="mt-2">
                        {onDepartBay && (
                          <button
                            onClick={() => onDepartBay(bay.id)}
                            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-semibold border border-red-500 transition-all duration-150 shadow-sm hover:shadow-md w-full"
                            title="Remove vehicle from bay"
                          >
                            <LogOut className="w-4 h-4" />
                            <span>Remove Charger</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Empty Bay State with direct button to add car */
                  <div className="text-center py-4 px-2 space-y-2">
                    <div className="text-xs font-medium text-gray-600">
                      Bay 0{bay.id} Empty
                    </div>
                    <p className="text-[11px] text-gray-400">
                      Port is ready for charging
                    </p>
                    {onAddCarToBay && (
                      <button
                        onClick={() => {
                          onAddCarToBay(bay.id);
                          onScrollToForm?.();
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-medium rounded-md transition-colors duration-150 shadow-xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Park EV Here</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* EV Charging Progress Bar & Timers */}
            {assignedEv && (
              <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Charge Progress</span>
                  <span className="font-mono text-gray-900 font-medium">
                    {assignedEv.currentChargePercent.toFixed(1)}% / {assignedEv.targetChargePercent}%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-gray-200 rounded overflow-hidden">
                  <div
                    className={`h-full transition-all duration-200 ${
                      isCompleted ? 'bg-teal-700' : 'bg-teal-600'
                    }`}
                    style={{ width: `${Math.min(100, assignedEv.currentChargePercent)}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-gray-500 font-mono pt-1">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-gray-400" />
                    <span>
                      {isCompleted
                        ? 'Target reached'
                        : assignedEv.timeRemainingSeconds > 0
                        ? `${Math.ceil(assignedEv.timeRemainingSeconds / 60)}m to target`
                        : 'Calculating'}
                    </span>
                  </div>
                  <span>
                    Dep: {new Date(assignedEv.departureTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            )}

            {isFree && (
              <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                <span>Fast AC 7.0 kW Port</span>
                <span className="text-gray-500 font-mono text-[11px]">Unassigned</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

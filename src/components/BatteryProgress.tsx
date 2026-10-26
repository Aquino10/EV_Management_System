import React from 'react';
import { Zap, AlertTriangle } from 'lucide-react';

interface BatteryProgressProps {
  currentPercent: number;
  targetPercent: number;
  allocatedPowerKw: number;
  isUnreachable?: boolean;
  maxAchievablePercent?: number;
  showDetails?: boolean;
}

export const BatteryProgress: React.FC<BatteryProgressProps> = ({
  currentPercent,
  targetPercent,
  allocatedPowerKw,
  isUnreachable,
  maxAchievablePercent,
  showDetails = true,
}) => {
  const clampedCurrent = Math.min(100, Math.max(0, currentPercent));
  const clampedTarget = Math.min(100, Math.max(0, targetPercent));
  const isCharging = allocatedPowerKw > 0;

  return (
    <div className="w-full space-y-2">
      <div className="flex justify-between items-baseline text-xs">
        <div className="flex items-center gap-1.5 font-medium text-gray-700">
          <Zap className={`w-3.5 h-3.5 ${isCharging ? 'text-teal-600' : 'text-gray-400'}`} />
          <span>Battery Charge</span>
          {isCharging && (
            <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200">
              +{allocatedPowerKw.toFixed(1)} kW
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 font-mono">
          <span className="text-sm font-semibold text-gray-900">{clampedCurrent.toFixed(1)}%</span>
          <span className="text-gray-400">/</span>
          <span className="text-xs text-gray-600">Target: <strong className="text-teal-700">{clampedTarget}%</strong></span>
        </div>
      </div>

      {/* Main Track */}
      <div className="relative w-full h-4 bg-gray-100 rounded border border-gray-200 overflow-hidden">
        {/* Target indicator marker */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-gray-900 z-20"
          style={{ left: `${clampedTarget}%` }}
          title={`Target ${clampedTarget}%`}
        >
          <div className="absolute top-0 -translate-x-1/2 w-1.5 h-1.5 bg-gray-900" />
        </div>

        {/* Max Achievable marker if unreachable */}
        {isUnreachable && maxAchievablePercent !== undefined && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-amber-600 z-20"
            style={{ left: `${maxAchievablePercent}%` }}
            title={`Max Achievable: ${maxAchievablePercent}%`}
          />
        )}

        {/* Current fill bar with flat solid color */}
        <div
          className={`h-full transition-all duration-200 ${
            clampedCurrent >= clampedTarget ? 'bg-teal-700' : 'bg-teal-600'
          }`}
          style={{ width: `${clampedCurrent}%` }}
        />
      </div>

      {showDetails && (
        <div className="flex items-center justify-between text-[11px] text-gray-500">
          <span>0%</span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm bg-teal-600"></span>
              Current
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm bg-gray-900"></span>
              Trip Target (with 10% safety margin)
            </span>
          </div>
          <span>100%</span>
        </div>
      )}

      {isUnreachable && (
        <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded text-amber-800 text-xs mt-1">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
          <span>Departure deadline is too short to reach target charge. Max achievable is approximately {maxAchievablePercent}%.</span>
        </div>
      )}
    </div>
  );
};

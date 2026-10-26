import React, { useState } from 'react';
import {
  Zap,
  Plus,
  RotateCcw,
  LogOut,
  Info,
  Car,
  Clock,
  CheckCircle2,
  AlertCircle,
  FastForward,
} from 'lucide-react';
import type { FacilityState } from '../logic/types';
import { BayVisualizer } from '../components/BayVisualizer';

interface LiveBaysScreenProps {
  state: FacilityState;
  onDepartBay: (bayId: number) => void;
  onCompleteBay?: (bayId: number) => void;
  onFastForwardQueue?: () => void;
  onAddCar: (data: {
    driverName: string;
    licensePlate: string;
    model: string;
    batteryCapacityKwh: number;
    currentChargePercent: number;
    tripDistanceKm: number;
    departureMinutesFromNow: number;
  }) => void;
  onReset: () => void;
}

export const LiveBaysScreen: React.FC<LiveBaysScreenProps> = ({
  state,
  onDepartBay,
  onCompleteBay,
  onFastForwardQueue,
  onAddCar,
  onReset,
}) => {
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [customModel, setCustomModel] = useState('Polestar 2');
  const [customPlate, setCustomPlate] = useState('ZS-404-EQ');
  const [customDriver, setCustomDriver] = useState('Sara Chen');
  const [tripKm, setTripKm] = useState(70);
  const [depMinutes, setDepMinutes] = useState(60);

  const totalPowerUsed = state.bays.reduce((acc, b) => acc + b.currentPowerKw, 0);
  const bay1 = state.bays.find((b) => b.id === 1);
  const bay2 = state.bays.find((b) => b.id === 2);

  const bay1Ev = state.evs.find((e) => e.bayId === 1);
  const bay2Ev = state.evs.find((e) => e.bayId === 2);

  const bothBaysOccupied = Boolean(bay1Ev && bay2Ev);

  // Queued 3rd vehicle
  const queuedEvs = state.evs
    .filter((e) => e.bayId === null && e.energyNeededKwh > 0 && e.status !== 'DEPARTED')
    .sort((a, b) => (a.queuePosition || 999) - (b.queuePosition || 999));

  const thirdEv = queuedEvs[0];

  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    onAddCar({
      driverName: customDriver,
      licensePlate: customPlate.toUpperCase(),
      model: customModel,
      batteryCapacityKwh: 30,
      currentChargePercent: 20,
      tripDistanceKm: tripKm,
      departureMinutesFromNow: depMinutes,
    });
    setShowQuickAdd(false);
  };

  const handleAddThirdVehicle = () => {
    onAddCar({
      driverName: 'Dr. David Kim',
      licensePlate: 'ZS-771-EV',
      model: 'BMW i4',
      batteryCapacityKwh: 30,
      currentChargePercent: 25,
      tripDistanceKm: 85,
      departureMinutesFromNow: 120,
    });
  };

  const formatCountdown = (seconds: number | null) => {
    if (seconds === null || seconds < 0 || !Number.isFinite(seconds)) return 'Estimating';
    const whole = Math.max(0, Math.round(seconds));
    if (whole === 0) return 'Any moment';
    const mins = Math.floor(whole / 60);
    const secs = whole % 60;
    if (mins >= 60) {
      const hrs = Math.floor(mins / 60);
      const remMins = mins % 60;
      return `${hrs}h ${remMins}m ${secs.toString().padStart(2, '0')}s`;
    }
    return `${mins}m ${secs.toString().padStart(2, '0')}s`;
  };

  const assignment = state.lastAutoAssignment;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8 space-y-6 pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
            Live Bay Representation
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Physical parking bays and live dynamic power sharing across the shared 7.0 kW facility grid.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!bay2Ev && (
            <button
              onClick={() => setShowQuickAdd(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-medium rounded-md transition-colors duration-150"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Car to Bay 2</span>
            </button>
          )}

          {bothBaysOccupied && !thirdEv && (
            <button
              onClick={handleAddThirdVehicle}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white text-xs font-medium rounded-md transition-colors duration-150"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add 3rd Vehicle (Queue)</span>
            </button>
          )}

          <button
            onClick={onReset}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 text-xs font-medium rounded-md transition-colors duration-150"
            title="Reset facility to initial state (1 car in Bay 1, Bay 2 empty)"
          >
            <RotateCcw className="w-3.5 h-3.5 text-gray-500" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Helpful Interactive Guide Box */}
      <div className="p-3.5 bg-teal-50/60 border border-teal-200 rounded-md text-xs text-teal-900 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-semibold block">How to demonstrate automatic queue assignment:</span>
          <span>
            {!bay2Ev
              ? '1. Bay 1 is charging. Click "Add Car to Bay 2" so both bays become occupied.'
              : !thirdEv
              ? '2. Both bays are full! Click "Add 3rd Vehicle (Queue)" to queue a 3rd car with a live countdown timer.'
              : '3. The 3rd vehicle is queued with a live timer. When Bay 1 or Bay 2 completes charging (click "Finish" on either bay), the 3rd car is automatically assigned to that bay!'}
          </span>
        </div>
      </div>

      {/* Live Power Distribution Schematic */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
        <div className="flex items-center justify-between text-xs pb-2 border-b border-gray-100">
          <span className="font-semibold text-gray-700 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-teal-700" />
            Grid Power Flow
          </span>
          <span className="font-mono text-gray-600">
            Total Draw: {totalPowerUsed.toFixed(1)} / {state.config.totalPowerKw.toFixed(1)} kW
          </span>
        </div>

        {/* Top-level Power Supply Flow Diagram */}
        <div className="flex items-center justify-center gap-4 py-1 text-xs font-mono">
          <div className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded text-center">
            <div className="text-[10px] text-gray-400 uppercase">Power Source</div>
            <div className="font-bold text-gray-900">{state.config.totalPowerKw.toFixed(1)} kW</div>
          </div>
          <div className="text-gray-400 font-bold">:</div>
          <div className="px-3 py-1.5 bg-teal-50 border border-teal-200 rounded text-center">
            <div className="text-[10px] text-teal-800 uppercase">Bay 1 Flow</div>
            <div className="font-bold text-teal-700">{bay1?.currentPowerKw.toFixed(1) || '0.0'} kW</div>
          </div>
          <div className="text-gray-300">+</div>
          <div className={`px-3 py-1.5 rounded text-center border ${
            bay2 && bay2.currentPowerKw > 0 ? 'bg-teal-50 border-teal-200' : 'bg-gray-50 border-gray-200'
          }`}>
            <div className="text-[10px] text-gray-500 uppercase">Bay 2 Flow</div>
            <div className={`font-bold ${bay2 && bay2.currentPowerKw > 0 ? 'text-teal-700' : 'text-gray-400'}`}>
              {bay2?.currentPowerKw.toFixed(1) || '0.0'} kW
            </div>
          </div>
        </div>
      </div>

      {/* Quick Add Form Modal or Panel if opened */}
      {showQuickAdd && (
        <div className="bg-white rounded-lg border border-teal-600 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-gray-100">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Car className="w-4 h-4 text-teal-700" />
              <span>Assign Vehicle to Bay 2</span>
            </h3>
            <button
              onClick={() => setShowQuickAdd(false)}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleQuickAdd} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Driver</label>
                <input
                  type="text"
                  required
                  value={customDriver}
                  onChange={(e) => setCustomDriver(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-teal-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">EV Model</label>
                <input
                  type="text"
                  required
                  value={customModel}
                  onChange={(e) => setCustomModel(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-teal-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Plate</label>
                <input
                  type="text"
                  required
                  value={customPlate}
                  onChange={(e) => setCustomPlate(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded px-2.5 py-1.5 text-xs text-gray-900 uppercase focus:outline-none focus:border-teal-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Trip Distance: {tripKm} km</label>
                <input
                  type="range"
                  min="20"
                  max="200"
                  step="5"
                  value={tripKm}
                  onChange={(e) => setTripKm(parseInt(e.target.value))}
                  className="w-full accent-teal-700 h-1.5 bg-gray-200 rounded"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Departure: in {depMinutes} min</label>
                <input
                  type="range"
                  min="20"
                  max="180"
                  step="10"
                  value={depMinutes}
                  onChange={(e) => setDepMinutes(parseInt(e.target.value))}
                  className="w-full accent-teal-700 h-1.5 bg-gray-200 rounded"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowQuickAdd(false)}
                className="px-3 py-1.5 border border-gray-300 rounded text-xs text-gray-600 hover:bg-gray-50"
              >
                Close
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded text-xs font-medium"
              >
                Park Vehicle into Bay 2
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Visual Live Bays Side by Side */}
      <BayVisualizer
        bays={state.bays}
        evs={state.evs}
        onDepartBay={onDepartBay}
        onAddCarToBay={() => setShowQuickAdd(true)}
      />

      {assignment && !thirdEv && (
        <div className="bg-white rounded-lg border border-teal-300 p-4 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
          <div>
            <div className="text-xs font-semibold text-teal-800 uppercase tracking-wider">
              Queue promoted automatically
            </div>
            <p className="text-sm text-gray-800 mt-1">
              {assignment.model} ({assignment.licensePlate}) — {assignment.driverName} — is now charging in Bay {assignment.bayId} because a stall finished and freed up.
            </p>
          </div>
        </div>
      )}

      {/* 3rd Queued Vehicle Card with Live Timer & Automatic Promotion */}
      {thirdEv && (
        <div className="bg-white rounded-lg border border-amber-300 p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-amber-800 uppercase tracking-wider">
                  3rd Vehicle in Queue
                </span>
                <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200 text-xs font-mono font-bold">
                  Queue Position #{thirdEv.queuePosition}
                </span>
              </div>
              <h3 className="text-lg font-bold text-gray-900">{thirdEv.model}</h3>
              <div className="text-xs text-gray-500 font-mono">
                {thirdEv.licensePlate} : Driver {thirdEv.driverName} : Trip {thirdEv.tripDistanceKm} km
              </div>
            </div>

            {/* Live Countdown Timer Badge */}
            <div className="bg-amber-50 border border-amber-200 rounded p-3 text-left sm:text-right min-w-[210px]">
              <div className="text-[11px] font-mono text-amber-800 uppercase tracking-wider flex items-center sm:justify-end gap-1.5 font-medium">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span>Timer to Bay Assignment</span>
              </div>
              <div className="text-2xl font-bold font-mono text-gray-900 mt-1 tabular-nums">
                {formatCountdown(thirdEv.estimatedWaitSeconds)}
              </div>
              <div className="text-[10px] text-gray-500 mt-0.5">
                Live wait until the next bay finishes charging
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2 p-2.5 bg-amber-50/70 border border-amber-200 rounded text-xs text-amber-900">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              Both bays are currently occupied. This vehicle will automatically move into the bay and start charging as soon as either vehicle finishes its target charge.
            </span>
          </div>

          {/* Quick Simulation Buttons to trigger completion immediately */}
          <div className="pt-1 flex flex-wrap items-center gap-2">
            {bay1Ev && (
              <button
                onClick={() => onCompleteBay && onCompleteBay(1)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded text-xs font-medium transition-colors duration-150"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Simulate Bay 1 Finished (Auto-Assigns 3rd EV)</span>
              </button>
            )}

            {bay2Ev && (
              <button
                onClick={() => onCompleteBay && onCompleteBay(2)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded text-xs font-medium transition-colors duration-150"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Simulate Bay 2 Finished (Auto-Assigns 3rd EV)</span>
              </button>
            )}

            {onFastForwardQueue && (
              <button
                onClick={onFastForwardQueue}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-300 rounded text-xs font-medium transition-colors duration-150 ml-auto"
              >
                <FastForward className="w-3.5 h-3.5 text-gray-600" />
                <span>Fast-Forward Timer</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Quick Action Demonstration Controls */}
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-2 text-xs">
        <span className="font-semibold text-gray-700 block">Demonstration Actions</span>
        <div className="flex flex-wrap items-center gap-2">
          {!bay2Ev ? (
            <button
              onClick={() => {
                onAddCar({
                  driverName: 'Sara Chen',
                  licensePlate: 'ZS-404-EQ',
                  model: 'Polestar 2',
                  batteryCapacityKwh: 30,
                  currentChargePercent: 20,
                  tripDistanceKm: 70,
                  departureMinutesFromNow: 60,
                });
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded text-xs font-medium transition-colors duration-150"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Step 1: Park Sara in Bay 2</span>
            </button>
          ) : !thirdEv ? (
            <button
              onClick={handleAddThirdVehicle}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded text-xs font-medium transition-colors duration-150"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Step 2: Add 3rd Car to Queue with Timer</span>
            </button>
          ) : (
            <button
              onClick={() => onCompleteBay && onCompleteBay(1)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded text-xs font-medium transition-colors duration-150"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Step 3: Complete Bay 1 Charge (Auto-assign 3rd EV)</span>
            </button>
          )}

          {bay1Ev && (
            <button
              onClick={() => onDepartBay(1)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-red-50 text-red-700 border border-gray-300 hover:border-red-300 rounded text-xs font-medium transition-colors duration-150"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Exit Bay 1</span>
            </button>
          )}

          {bay2Ev && (
            <button
              onClick={() => onDepartBay(2)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-red-50 text-red-700 border border-gray-300 hover:border-red-300 rounded text-xs font-medium transition-colors duration-150"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Exit Bay 2</span>
            </button>
          )}

          <button
            onClick={onReset}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-gray-100 text-gray-600 border border-gray-300 rounded text-xs font-medium transition-colors duration-150 ml-auto"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to Initial State</span>
          </button>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import {
  Car,
  Zap,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Plus,
  HelpCircle,
  Calendar,
  Navigation,
  ArrowRight,
  X,
  Info,
} from 'lucide-react';
import type { FacilityState } from '../logic/types';
import type { UserProfile } from '../services/dataService';
import { BayVisualizer } from '../components/BayVisualizer';
import { BatteryProgress } from '../components/BatteryProgress';
import { calculateTargetCharge, calculateEnergyNeeded } from '../logic/allocation';
import type { ScreenType } from '../components/Navbar';

interface DriverDashboardProps {
  state: FacilityState;
  currentUser: UserProfile;
  onAddEV: (data: {
    driverName: string;
    licensePlate: string;
    model: string;
    batteryCapacityKwh: number;
    currentChargePercent: number;
    requestedTargetChargePercent: number;
    tripDistanceKm: number;
    departureMinutesFromNow: number;
  }) => Promise<boolean>;
  onDepartBay?: (bayId: number) => void;
  onNavigate: (screen: ScreenType) => void;
}

export const DriverDashboard: React.FC<DriverDashboardProps> = ({
  state,
  currentUser,
  onAddEV,
  onDepartBay,
  onNavigate,
}) => {
  // Form State
  const [model, setModel] = useState('Polestar 2');
  const [licensePlate, setLicensePlate] = useState(currentUser.licensePlate || 'ZS-404-EQ');
  const [batteryCapacityKwh, setBatteryCapacityKwh] = useState(30);
  const [currentChargePercent, setCurrentChargePercent] = useState(25);
  const [requestedTargetChargePercent, setRequestedTargetChargePercent] = useState<number | null>(null);
  const [tripDistanceKm, setTripDistanceKm] = useState(80);
  const [departureMinutes, setDepartureMinutes] = useState(60);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Find My EVs (matching user name or license plate) - can have multiple
  const myEvs = state.evs.filter(
    (e) =>
      e.ownerUserId
        ? e.ownerUserId === currentUser.id
        : e.driverName.toLowerCase().includes(currentUser.name.toLowerCase().split(' ')[0]) ||
          (currentUser.licensePlate && e.licensePlate === currentUser.licensePlate)
  );

  // Primary EV (first one found)
  const myEv = myEvs[0] || null;

  // Check if bays are full
  const occupiedBays = state.bays.filter(b => b.currentEvId !== null).length;
  const baysFull = occupiedBays >= state.config.baysCount;

  // Live computed preview for form
  const previewTarget = calculateTargetCharge(
    tripDistanceKm,
    batteryCapacityKwh,
    state.config.consumptionKwhPerKm,
    state.config.safetyMarginPercent,
    currentChargePercent
  );
  const selectedTargetChargePercent = Math.max(
    currentChargePercent,
    requestedTargetChargePercent ?? previewTarget
  );
  const previewEnergyNeeded = calculateEnergyNeeded(
    selectedTargetChargePercent,
    currentChargePercent,
    batteryCapacityKwh
  );
  const simultaneousChargingBays = Math.min(
    Math.max(1, state.config.baysCount),
    Math.max(1, occupiedBays + 1)
  );
  const estimatedChargingPowerKw = Math.min(
    state.config.perBayMaxPowerKw,
    state.config.totalPowerKw / simultaneousChargingBays
  );
  const estimatedChargingMinutes = previewEnergyNeeded === 0
    ? 0
    : estimatedChargingPowerKw > 0
    ? (previewEnergyNeeded / estimatedChargingPowerKw) * 60
    : null;
  const formatDuration = (minutes: number) => {
    const roundedMinutes = Math.ceil(minutes);
    const hours = Math.floor(roundedMinutes / 60);
    const remainingMinutes = roundedMinutes % 60;
    if (hours === 0) return `${remainingMinutes} min`;
    return remainingMinutes === 0 ? `${hours}h` : `${hours}h ${remainingMinutes}m`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);
    let added = false;
    try {
      added = await onAddEV({
        driverName: currentUser.name,
        licensePlate: licensePlate.toUpperCase(),
        model,
        batteryCapacityKwh,
        currentChargePercent,
        requestedTargetChargePercent: selectedTargetChargePercent,
        tripDistanceKm,
        departureMinutesFromNow: departureMinutes,
      });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Could not save vehicle details.');
    } finally {
      setIsSubmitting(false);
    }
    if (!added) return;
    setShowAddForm(false);

    // Reset form for next entry
    setModel('Polestar 2');
    setLicensePlate(currentUser.licensePlate || 'ZS-404-EQ');
    setBatteryCapacityKwh(30);
    setCurrentChargePercent(25);
    setRequestedTargetChargePercent(null);
    setTripDistanceKm(80);
    setDepartureMinutes(60);

    if (baysFull) {
      console.log('EV added to queue. Bays are full.');
    }
  };

  const scrollToForm = () => {
    setShowAddForm(true);
    setTimeout(() => {
      const formElement = document.getElementById('ev-form');
      if (formElement) {
        formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const formatCountdown = (seconds: number) => {
    if (seconds <= 0 || !isFinite(seconds)) return '00:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}h ${mins.toString().padStart(2, '0')}m ${secs.toString().padStart(2, '0')}s`;
    }
    return `${mins}m ${secs.toString().padStart(2, '0')}s`;
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8 space-y-6 pb-24">
      {/* Top Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
            Charging Bays & Vehicle Status
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Two physical bays sharing up to {state.config.totalPowerKw.toFixed(1)} kW facility power.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          {myEv && (
            <button
              onClick={scrollToForm}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-600 hover:bg-gray-700 text-white text-sm font-semibold rounded-xl transition-all duration-300 shadow-sm hover:shadow-md"
            >
              <Plus className="w-4 h-4" />
              <span>Add EV</span>
            </button>
          )}
          <button
            onClick={() => (showAddForm ? setShowAddForm(false) : scrollToForm())}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-xl transition-all duration-300 shadow-sm hover:shadow-md"
          >
            {showAddForm ? <X className="w-4 h-4" /> : myEv ? 'Update My EV' : baysFull ? 'Add to Queue' : 'Add My EV'}
          </button>
        </div>
      </div>

      {/* Live Bays */}
      <section className="space-y-3">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span className="font-medium text-gray-700">Bay 1 and Bay 2 Status</span>
          <span className="font-mono">Total Capacity: {state.config.totalPowerKw.toFixed(1)} kW</span>
        </div>
        <BayVisualizer
          bays={state.bays}
          evs={state.evs}
          onDepartBay={onDepartBay}
          onAddCarToBay={scrollToForm}
          onScrollToForm={scrollToForm}
        />
      </section>

      {/* Prominent 3rd Car Queue Option - Only show when bays are full */}
      {baysFull && !myEv && (
        <section className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-6 border-2 border-amber-300 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
              <Clock className="w-6 h-6 text-amber-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-gray-900 mb-1">Add Your EV to Queue</h3>
              <p className="text-sm text-gray-600">
                Both charging bays are currently occupied. Join the queue and we'll notify you when a bay becomes available.
              </p>
            </div>
          </div>

          {/* Estimated Wait Time Display */}
          <div className="bg-white rounded-lg p-4 border border-amber-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Estimated Wait Time</span>
              <span className="text-xs text-gray-500">Based on current charging progress</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-amber-700 font-mono">
                {state.evs
                  .filter(e => e.bayId !== null && e.status === 'CHARGING')
                  .reduce((acc, ev) => acc + (ev.timeRemainingSeconds || 0), 0) > 0
                  ? `${Math.ceil(
                      state.evs
                        .filter(e => e.bayId !== null && e.status === 'CHARGING')
                        .reduce((acc, ev) => acc + (ev.timeRemainingSeconds || 0), 0) / 60
                    )} min`
                  : 'Calculating...'}
              </span>
              <span className="text-sm text-gray-600">until next bay is free</span>
            </div>
          </div>

          <button
            onClick={scrollToForm}
            className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-lg transition-all duration-300 flex items-center justify-center gap-2 shadow-sm hover:shadow-md"
          >
            <Plus className="w-5 h-5" />
            <span>Add My EV to Queue</span>
          </button>
        </section>
      )}

      {/* "Add my EV" Form if open */}
      {showAddForm && (
        <section id="ev-form" className="bg-white border-2 border-gray-200 rounded-xl p-6 space-y-5 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Car className="w-5 h-5 text-teal-700" />
              <span>Add Vehicle & Trip Requirements</span>
            </h2>
            <button
              onClick={() => setShowAddForm(false)}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">EV Model</label>
                <input
                  type="text"
                  required
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full bg-gray-50 border-2 border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">License Plate</label>
                <input
                  type="text"
                  required
                  value={licensePlate}
                  onChange={(e) => setLicensePlate(e.target.value)}
                  className="w-full bg-gray-50 border-2 border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 uppercase focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all"
                />
              </div>
            </div>

            {/* Battery Capacity (kWh) */}
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-700 font-medium">Battery Capacity</span>
                <span className="font-mono text-gray-900">{batteryCapacityKwh} kWh</span>
              </div>
              <p className="text-xs text-gray-500 mb-2">
                The total energy your EV battery can store. Enter the capacity listed in your vehicle specifications; kWh means kilowatt-hours.
              </p>
              <input
                type="range"
                min="20"
                max="100"
                step="5"
                value={batteryCapacityKwh}
                onChange={(e) => setBatteryCapacityKwh(parseInt(e.target.value))}
                className="w-full accent-teal-600 cursor-pointer h-2 bg-gray-200 rounded-lg"
              />
              <div className="flex justify-between text-xs text-gray-400 font-mono mt-1">
                <span>20 kWh</span>
                <span>Default 30 kWh</span>
                <span>100 kWh</span>
              </div>
            </div>

            {/* Current Charge % */}
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-700 font-medium">Current Charge</span>
                <span className="font-mono text-gray-900">{currentChargePercent}%</span>
              </div>
              <input
                type="range"
                min="5"
                max="95"
                step="1"
                value={currentChargePercent}
                onChange={(e) => setCurrentChargePercent(parseInt(e.target.value))}
                className="w-full accent-teal-600 cursor-pointer h-2 bg-gray-200 rounded-lg"
              />
            </div>

            {/* Desired charge target */}
            <div>
              <div className="flex justify-between text-sm mb-2">
                <label htmlFor="desired-charge-target" className="text-gray-700 font-medium">
                  Charge Until
                </label>
                <span className="font-mono text-gray-900">{selectedTargetChargePercent}%</span>
              </div>
              <input
                id="desired-charge-target"
                type="range"
                min={currentChargePercent}
                max="100"
                step="1"
                value={selectedTargetChargePercent}
                onChange={(e) => setRequestedTargetChargePercent(parseInt(e.target.value))}
                className="w-full accent-teal-600 cursor-pointer h-2 bg-gray-200 rounded-lg"
              />
              <div className="flex justify-between text-xs text-gray-400 font-mono mt-1">
                <span>Current {currentChargePercent}%</span>
                <span>Recommended {previewTarget}%</span>
                <span>100%</span>
              </div>
            </div>

            {/* Trip Distance (km) */}
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-700 font-medium">Trip Distance</span>
                <span className="font-mono text-gray-900">{tripDistanceKm} km</span>
              </div>
              <input
                type="range"
                min="10"
                max="300"
                step="5"
                value={tripDistanceKm}
                onChange={(e) => setTripDistanceKm(parseInt(e.target.value))}
                className="w-full accent-teal-600 cursor-pointer h-2 bg-gray-200 rounded-lg"
              />
            </div>

            {/* Departure Minutes */}
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-700 font-medium">Departure Window</span>
                <span className="font-mono text-gray-900">
                  In {departureMinutes} minutes ({Math.floor(departureMinutes / 60)}h {departureMinutes % 60}m)
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2 mb-2">
                {[30, 60, 120, 180].map((mins) => (
                  <button
                    type="button"
                    key={mins}
                    onClick={() => setDepartureMinutes(mins)}
                    className={`py-2 text-sm font-mono rounded-lg border-2 transition-all duration-150 ${
                      departureMinutes === mins
                        ? 'bg-teal-50 text-teal-800 border-teal-600 font-semibold'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                    }`}
                  >
                    +{mins}m
                  </button>
                ))}
              </div>
              <input
                type="range"
                min="20"
                max="360"
                step="10"
                value={departureMinutes}
                onChange={(e) => setDepartureMinutes(parseInt(e.target.value))}
                className="w-full accent-teal-600 cursor-pointer h-2 bg-gray-200 rounded-lg"
              />
              <div className={`mt-3 rounded-lg border p-3 text-xs ${
                estimatedChargingMinutes !== null && departureMinutes < estimatedChargingMinutes
                  ? 'bg-amber-50 border-amber-200 text-amber-900'
                  : 'bg-teal-50 border-teal-200 text-teal-900'
              }`}>
                {estimatedChargingMinutes === null ? (
                  <span>Charging duration unavailable: no facility power is currently configured.</span>
                ) : estimatedChargingMinutes === 0 ? (
                  <span>Your EV is already at its selected charge target.</span>
                ) : (
                  <>
                    <div className="font-semibold">
                      Recommended charging time: {formatDuration(estimatedChargingMinutes)}
                    </div>
                    <div className="mt-1">
                      Estimated at {estimatedChargingPowerKw.toFixed(1)} kW to reach {selectedTargetChargePercent}%.
                      {' '}At {state.timeSpeedMultiplier}× simulation speed, this is about{' '}
                      {formatDuration(estimatedChargingMinutes / state.timeSpeedMultiplier)} of real time.
                    </div>
                    {departureMinutes < estimatedChargingMinutes && (
                      <div className="mt-1 font-medium">
                        The selected departure window may be too short. This estimate excludes any queue wait.
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Dynamic Calculated Energy Box */}
            <div className="p-4 bg-gradient-to-r from-teal-50 to-cyan-50 rounded-xl border-2 border-teal-200 space-y-2 text-sm">
              <span className="font-medium text-gray-800 flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-teal-700" />
                Target Energy Calculation
              </span>
              <div className="flex justify-between text-gray-700">
                <span>Your requested target charge:</span>
                <span className="font-mono font-semibold text-gray-900">{selectedTargetChargePercent}%</span>
              </div>
              <div className="flex justify-between text-gray-700">
                <span>Net energy required:</span>
                <span className="font-mono font-semibold text-teal-700">{previewEnergyNeeded.toFixed(2)} kWh</span>
              </div>
            </div>

            {submitError && (
              <p role="alert" className="text-sm text-red-700">{submitError}</p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-all duration-300 flex items-center justify-center gap-2 shadow-sm hover:shadow-md"
            >
              <span>{isSubmitting ? 'Saving...' : baysFull ? 'Add to Queue' : 'Submit EV to System'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            {baysFull && (
              <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-xl flex items-start gap-3 text-sm text-amber-900">
                <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Both charging bays are currently occupied. Your EV will be added to the queue and assigned to a bay automatically when one becomes available.
                </span>
              </div>
            )}
          </form>
        </section>
      )}

      {/* My EV Card */}
      <section className="space-y-2">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          My Vehicle Telemetry
        </h2>

        {myEv ? (
          <div
            className={`bg-white rounded-lg p-5 border transition-all duration-150 space-y-5 ${
              myEv.status === 'CHARGING'
                ? 'border-teal-500'
                : myEv.status === 'COMPLETED'
                ? 'border-teal-300'
                : 'border-gray-200'
            }`}
          >
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-4 border-b border-gray-100">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-gray-500">
                    Driver: {myEv.driverName}
                  </span>
                  {myEv.bayId ? (
                    <span className="text-[11px] font-mono px-1.5 py-0.2 rounded bg-teal-50 text-teal-800 border border-teal-200">
                      Bay {myEv.bayId}
                    </span>
                  ) : (
                    <button
                      onClick={() => onNavigate('queue')}
                      className="text-[11px] font-mono px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200 hover:underline"
                    >
                      Queue Position #{myEv.queuePosition}
                    </button>
                  )}
                </div>
                <h3 className="text-lg font-bold text-gray-900">{myEv.model}</h3>
                <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded mt-1 inline-block">
                  {myEv.licensePlate}
                </span>
              </div>

              {/* Status Badge */}
              <div className="sm:text-right">
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium ${
                    myEv.status === 'CHARGING'
                      ? 'bg-teal-50 text-teal-800 border border-teal-200'
                      : myEv.status === 'COMPLETED'
                      ? 'bg-teal-50 text-teal-800 border border-teal-200'
                      : 'bg-amber-50 text-amber-800 border border-amber-200'
                  }`}
                >
                  {myEv.status === 'CHARGING' && <Zap className="w-3.5 h-3.5 text-teal-700" />}
                  {myEv.status === 'COMPLETED' && <CheckCircle2 className="w-3.5 h-3.5 text-teal-700" />}
                  {myEv.status === 'WAITING' && <Clock className="w-3.5 h-3.5 text-amber-600" />}
                  {myEv.status === 'CHARGING'
                    ? 'Charging'
                    : myEv.status === 'COMPLETED'
                    ? 'Target Done'
                    : 'Waiting in Queue'}
                </span>
                <div className="text-[11px] text-gray-500 font-mono mt-1">
                  Scheduled departure: {new Date(myEv.departureTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>

            {myEv.status === 'WAITING' && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded flex items-start gap-2 text-xs text-amber-900">
                <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Both bays are occupied. Live wait to auto-assignment:{' '}
                  <span className="font-mono font-bold">
                    {formatCountdown(myEv.estimatedWaitSeconds ?? 0)}
                  </span>
                  . You will be parked into whichever bay finishes charging first.
                </span>
              </div>
            )}

            {state.lastAutoAssignment?.evId === myEv.id && myEv.bayId && (
              <div className="p-3 bg-teal-50 border border-teal-200 rounded flex items-start gap-2 text-xs text-teal-900">
                <CheckCircle2 className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
                <span>
                  A bay finished charging. Your vehicle was automatically assigned to Bay {myEv.bayId} and is now charging.
                </span>
              </div>
            )}

            {/* Battery Progress Bar */}
            <BatteryProgress
              currentPercent={myEv.currentChargePercent}
              targetPercent={myEv.targetChargePercent}
              allocatedPowerKw={myEv.allocatedPowerKw}
              isUnreachable={myEv.isTargetUnreachable}
              maxAchievablePercent={myEv.maxAchievableChargePercent}
            />

            {/* Stat Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
              <div className="bg-gray-50 p-3 rounded border border-gray-200">
                <div className="text-[11px] text-gray-500 flex items-center gap-1">
                  <Zap className="w-3 h-3 text-teal-700" />
                  <span>Power Allocated</span>
                </div>
                <div className="text-lg font-bold font-mono text-gray-900 mt-0.5">
                  {myEv.allocatedPowerKw.toFixed(1)} <span className="text-xs text-gray-500 font-normal">kW</span>
                </div>
                <div className="text-[10px] text-gray-400 mt-0.5">
                  {myEv.bayId ? 'Active Port Output' : 'In Queue'}
                </div>
              </div>

              <div className="bg-gray-50 p-3 rounded border border-gray-200">
                <div className="text-[11px] text-gray-500 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-gray-500" />
                  <span>Time Remaining</span>
                </div>
                <div className="text-lg font-bold font-mono text-teal-700 mt-0.5">
                  {myEv.status === 'COMPLETED'
                    ? '00:00'
                    : myEv.status === 'WAITING'
                    ? formatCountdown(myEv.estimatedWaitSeconds ?? 0)
                    : myEv.timeRemainingSeconds > 0 && isFinite(myEv.timeRemainingSeconds)
                    ? formatCountdown(myEv.timeRemainingSeconds)
                    : myEv.bayId
                    ? 'Calculating'
                    : 'Pending Bay'}
                </div>
                <div className="text-[10px] text-gray-400 mt-0.5">
                  {myEv.status === 'WAITING' ? 'Until a bay is auto-assigned' : 'Until target charge'}
                </div>
              </div>

              <div className="bg-gray-50 p-3 rounded border border-gray-200">
                <div className="text-[11px] text-gray-500 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-gray-500" />
                  <span>Finish Time</span>
                </div>
                <div className="text-lg font-bold font-mono text-gray-900 mt-0.5">
                  {myEv.estimatedFinishTime
                    ? new Date(myEv.estimatedFinishTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : 'Pending'}
                </div>
                <div className="text-[10px] text-gray-400 mt-0.5">Clock finish estimate</div>
              </div>

              <div className="bg-gray-50 p-3 rounded border border-gray-200">
                <div className="text-[11px] text-gray-500 flex items-center gap-1">
                  <Navigation className="w-3 h-3 text-gray-500" />
                  <span>Trip Energy</span>
                </div>
                <div className="text-lg font-bold font-mono text-gray-900 mt-0.5">
                  {myEv.energyNeededKwh.toFixed(1)} <span className="text-xs text-gray-500 font-normal">kWh</span>
                </div>
                <div className="text-[10px] text-gray-400 mt-0.5">For {myEv.tripDistanceKm} km trip</div>
              </div>
            </div>

            {/* Unreachable target warning banner */}
            {myEv.isTargetUnreachable && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>{myEv.warningMessage}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-lg p-6 border border-gray-200 text-center space-y-3">
            <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center mx-auto text-gray-500">
              <Car className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">No Vehicle Linked to Current Account</h3>
              <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                Add your vehicle details above to view live power allocation and estimated finish time.
              </p>
            </div>
            <button
              onClick={scrollToForm}
              className="px-3.5 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-medium rounded-md transition-colors duration-150"
            >
              Add My EV
            </button>
          </div>
        )}
      </section>
    </div>
  );
};

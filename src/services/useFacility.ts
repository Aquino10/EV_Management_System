import { useCallback, useEffect, useRef, useState } from 'react';
import type { FacilityConfig, FacilityState, EV, Bay, EVStatus } from '../logic/types';
import {
  calculateTargetCharge,
  DEFAULT_CONFIG,
  recalculateAll,
} from '../logic/allocation';
import { supabase } from './supabase';

const FACILITY_ID = '00000000-0000-4000-8000-000000000001';
const SIMULATION_SPEED = 4;
const PROGRESS_SYNC_INTERVAL_MS = 10_000;

interface FacilityConfigRow {
  total_power_kw: number;
  per_bay_max_power_kw: number;
  default_battery_capacity_kwh: number;
  consumption_kwh_per_km: number;
  safety_margin_percent: number;
}

interface BayRow {
  id: number | string;
  name: string;
  max_power_kw: number;
}

interface EvSessionRow {
  id: string;
  bay_id: number | string | null;
  driver_name: string;
  license_plate: string;
  vehicle_model: string;
  battery_capacity_kwh: number;
  current_charge_percent: number;
  target_charge_percent: number;
  trip_distance_km: number;
  arrival_time: string;
  departure_time: string;
  status: EVStatus;
  queue_position: number | null;
  is_owner: boolean;
}

export interface AddEvInput {
  driverName: string;
  licensePlate: string;
  model: string;
  batteryCapacityKwh: number;
  currentChargePercent: number;
  requestedTargetChargePercent?: number;
  tripDistanceKm: number;
  departureMinutesFromNow: number;
}

const emptyState = (): FacilityState => ({
  config: { ...DEFAULT_CONFIG },
  bays: [],
  evs: [],
  currentTime: new Date().toISOString(),
  timeSpeedMultiplier: SIMULATION_SPEED,
  lastAutoAssignment: null,
});

function numberValue(value: number | string): number {
  return Number(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'An unexpected database error occurred.';
}

function mapSession(row: EvSessionRow, currentUserId: string): EV {
  return {
    id: row.id,
    driverName: row.driver_name,
    licensePlate: row.license_plate,
    model: row.vehicle_model,
    batteryCapacityKwh: numberValue(row.battery_capacity_kwh),
    currentChargePercent: numberValue(row.current_charge_percent),
    tripDistanceKm: numberValue(row.trip_distance_km),
    departureTime: row.departure_time,
    arrivalTime: row.arrival_time,
    targetChargePercent: numberValue(row.target_charge_percent),
    requestedTargetChargePercent: numberValue(row.target_charge_percent),
    energyNeededKwh: 0,
    allocatedPowerKw: 0,
    timeRemainingSeconds: 0,
    estimatedFinishTime: null,
    status: row.status,
    bayId: row.bay_id === null ? null : numberValue(row.bay_id),
    queuePosition: row.queue_position,
    estimatedWaitSeconds: null,
    isTargetUnreachable: false,
    ownerUserId: row.is_owner ? currentUserId : undefined,
  };
}

function mapBay(row: BayRow): Bay {
  return {
    id: numberValue(row.id),
    name: row.name,
    status: 'FREE',
    currentEvId: null,
    maxPowerKw: numberValue(row.max_power_kw),
    currentPowerKw: 0,
  };
}

export function useFacility(userId?: string) {
  const [state, setState] = useState<FacilityState>(emptyState);
  const [loadedUserId, setLoadedUserId] = useState<string>();
  const [error, setError] = useState<string | null>(null);
  const stateRef = useRef(state);
  const lastTickRef = useRef(0);
  const lastProgressSyncRef = useRef(0);
  const ownedProgressRef = useRef<Record<string, number>>({});
  const isLoading = Boolean(userId && loadedUserId !== userId);

  const applyState = useCallback((nextState: FacilityState) => {
    stateRef.current = nextState;
    setState(nextState);
  }, []);

  const refresh = useCallback(async () => {
    if (!supabase || !userId) return;

    try {
      const [configResult, bayResult, sessionResult] = await Promise.all([
      supabase
        .from('facility_config')
        .select('total_power_kw, per_bay_max_power_kw, default_battery_capacity_kwh, consumption_kwh_per_km, safety_margin_percent')
        .eq('facility_id', FACILITY_ID)
        .single(),
      supabase
        .from('bays')
        .select('id, name, max_power_kw')
        .eq('facility_id', FACILITY_ID)
        .order('id'),
      supabase
        .from('facility_ev_sessions')
        .select('id, bay_id, driver_name, license_plate, vehicle_model, battery_capacity_kwh, current_charge_percent, target_charge_percent, trip_distance_km, arrival_time, departure_time, status, queue_position, is_owner'),
      ]);

      const fetchError = configResult.error ?? bayResult.error ?? sessionResult.error;
      if (fetchError) {
        setError(`Could not load facility data: ${fetchError.message}`);
        setLoadedUserId(userId);
        return;
      }

      const configRow = configResult.data as FacilityConfigRow;
      const bays = (bayResult.data as BayRow[]).map(mapBay);
      const evs = (sessionResult.data as EvSessionRow[]).map(row => mapSession(row, userId));

      const config: FacilityConfig = {
        totalPowerKw: numberValue(configRow.total_power_kw),
        baysCount: bays.length,
        perBayMaxPowerKw: numberValue(configRow.per_bay_max_power_kw),
        defaultBatteryCapacityKwh: numberValue(configRow.default_battery_capacity_kwh),
        consumptionKwhPerKm: numberValue(configRow.consumption_kwh_per_km),
        safetyMarginPercent: numberValue(configRow.safety_margin_percent),
      };
      const currentTime = new Date().toISOString();
      const recalculated = recalculateAll(bays, evs, config, Date.now());

      applyState({
        ...stateRef.current,
        config,
        bays: recalculated.bays,
        evs: recalculated.evs,
        currentTime,
        timeSpeedMultiplier: SIMULATION_SPEED,
      });
      setError(null);
      setLoadedUserId(userId);
      lastTickRef.current = Date.now();
    } catch (refreshError) {
      setError(`Could not load facility data: ${errorMessage(refreshError)}`);
      setLoadedUserId(userId);
    }
  }, [applyState, userId]);

  useEffect(() => {
    if (!userId || !supabase) return;

    let active = true;
    const load = async () => {
      if (!active) return;
      await refresh();
    };
    void load();

    const channel = supabase
      .channel(`facility-state-${userId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'facility_signals',
        filter: `facility_id=eq.${FACILITY_ID}`,
      }, () => {
        void load();
      })
      .subscribe(status => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setError('Live updates could not connect. Refresh the page to retry.');
        }
      });

    return () => {
      active = false;
      void supabase?.removeChannel(channel);
    };
  }, [refresh, userId]);

  useEffect(() => {
    if (!userId || isLoading) return;

    const timer = setInterval(() => {
      const now = Date.now();
      const elapsedMs = Math.max(0, now - lastTickRef.current);
      lastTickRef.current = now;
      const previous = stateRef.current;
      const simulatedDeltaMs = elapsedMs * previous.timeSpeedMultiplier;
      const deltaHours = simulatedDeltaMs / 3_600_000;
      const updatedEvs = previous.evs.map(ev => {
        if (ev.status !== 'CHARGING' || ev.allocatedPowerKw <= 0) return ev;
        const nextPercent = Math.min(
          ev.targetChargePercent,
          Number((ev.currentChargePercent + ev.allocatedPowerKw * deltaHours / ev.batteryCapacityKwh * 100).toFixed(2))
        );
        if (ev.ownerUserId === userId) ownedProgressRef.current[ev.id] = nextPercent;
        return { ...ev, currentChargePercent: nextPercent };
      });
      const simulatedNow = new Date(new Date(previous.currentTime).getTime() + simulatedDeltaMs);
      const recalculated = recalculateAll(previous.bays, updatedEvs, previous.config, simulatedNow.getTime());

      applyState({
        ...previous,
        bays: recalculated.bays,
        evs: recalculated.evs,
        currentTime: simulatedNow.toISOString(),
      });

      const newlyDeparted = recalculated.evs.filter(ev =>
        ev.ownerUserId === userId &&
        ev.status === 'DEPARTED' &&
        previous.evs.find(previousEv => previousEv.id === ev.id)?.status !== 'DEPARTED'
      );
      for (const ev of newlyDeparted) {
        const persistDeparture = async () => {
          try {
            const result = await supabase?.rpc('depart_ev_session', { p_session_id: ev.id });
            if (result?.error) {
              setError(`Could not save vehicle departure: ${result.error.message}`);
            }
          } catch (departureError) {
            setError(`Could not save vehicle departure: ${errorMessage(departureError)}`);
          }
        };
        void persistDeparture();
      }

      if (now - lastProgressSyncRef.current >= PROGRESS_SYNC_INTERVAL_MS) {
        lastProgressSyncRef.current = now;
        const progressEntries = Object.entries(ownedProgressRef.current);
        ownedProgressRef.current = {};
        for (const [sessionId, chargePercent] of progressEntries) {
          const syncProgress = async () => {
            try {
              const result = await supabase?.rpc('sync_my_ev_progress', {
                p_session_id: sessionId,
                p_current_charge_percent: chargePercent,
              });
              if (result?.error) {
                setError(`Could not save charging progress: ${result.error.message}`);
              }
            } catch (syncError) {
              setError(`Could not save charging progress: ${errorMessage(syncError)}`);
            }
          };
          void syncProgress();
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [applyState, isLoading, userId]);

  const addEV = useCallback(async (input: AddEvInput): Promise<boolean> => {
    if (!supabase || !userId) {
      setError('Supabase is not connected. Check the project URL and publishable key.');
      return false;
    }

    const now = new Date();
    const target = input.requestedTargetChargePercent ?? calculateTargetCharge(
      input.tripDistanceKm,
      input.batteryCapacityKwh,
      stateRef.current.config.consumptionKwhPerKm,
      stateRef.current.config.safetyMarginPercent,
      input.currentChargePercent
    );
    try {
      const result = await supabase.rpc('create_ev_session', {
        p_facility_id: FACILITY_ID,
        p_driver_name: input.driverName,
        p_license_plate: input.licensePlate,
        p_vehicle_model: input.model,
        p_battery_capacity_kwh: input.batteryCapacityKwh,
        p_current_charge_percent: input.currentChargePercent,
        p_target_charge_percent: target,
        p_trip_distance_km: input.tripDistanceKm,
        p_departure_time: new Date(now.getTime() + input.departureMinutesFromNow * 60_000).toISOString(),
      });

      if (result.error) {
        setError(`Could not add vehicle: ${result.error.message}`);
        return false;
      }
      await refresh();
      return true;
    } catch (addError) {
      setError(`Could not add vehicle: ${errorMessage(addError)}`);
      return false;
    }
  }, [refresh, userId]);

  const departBay = useCallback(async (bayId: number): Promise<void> => {
    const evId = stateRef.current.bays.find(bay => bay.id === bayId)?.currentEvId;
    if (!evId || !supabase) return;

    try {
      const result = await supabase.rpc('depart_ev_session', { p_session_id: evId });
      if (result.error) {
        setError(`Could not depart vehicle: ${result.error.message}`);
        return;
      }
      await refresh();
    } catch (departError) {
      setError(`Could not depart vehicle: ${errorMessage(departError)}`);
    }
  }, [refresh]);

  const removeEV = useCallback(async (evId: string): Promise<void> => {
    if (!supabase) return;
    try {
      const result = await supabase.rpc('depart_ev_session', { p_session_id: evId });
      if (result.error) {
        setError(`Could not remove vehicle: ${result.error.message}`);
        return;
      }
      await refresh();
    } catch (removeError) {
      setError(`Could not remove vehicle: ${errorMessage(removeError)}`);
    }
  }, [refresh]);

  const updateConfig = useCallback(async (updates: Partial<FacilityConfig>): Promise<void> => {
    if (!supabase) return;

    const databaseUpdates = {
      ...(updates.totalPowerKw !== undefined && { total_power_kw: updates.totalPowerKw }),
      ...(updates.perBayMaxPowerKw !== undefined && { per_bay_max_power_kw: updates.perBayMaxPowerKw }),
      ...(updates.defaultBatteryCapacityKwh !== undefined && { default_battery_capacity_kwh: updates.defaultBatteryCapacityKwh }),
      ...(updates.consumptionKwhPerKm !== undefined && { consumption_kwh_per_km: updates.consumptionKwhPerKm }),
      ...(updates.safetyMarginPercent !== undefined && { safety_margin_percent: updates.safetyMarginPercent }),
    };
    try {
      const result = await supabase
        .from('facility_config')
        .update(databaseUpdates)
        .eq('facility_id', FACILITY_ID);

      if (result.error) {
        setError(`Could not update facility settings: ${result.error.message}`);
        return;
      }
      await refresh();
    } catch (updateError) {
      setError(`Could not update facility settings: ${errorMessage(updateError)}`);
    }
  }, [refresh]);

  const setTimeSpeed = useCallback((multiplier: number) => {
    applyState({ ...stateRef.current, timeSpeedMultiplier: multiplier });
  }, [applyState]);

  return {
    state,
    isLoading,
    error,
    clearError: () => setError(null),
    addEV,
    removeEV,
    departBay,
    updateConfig,
    setTimeSpeed,
    refresh,
  };
}

import type { EV, Bay, FacilityConfig, FacilityState, AutoAssignmentEvent } from '../logic/types';
import { DEFAULT_CONFIG, recalculateAll } from '../logic/allocation';

export interface UserProfile {
  id: string;
  name: string;
  role: 'driver' | 'admin';
  email?: string;
  licensePlate?: string;
  evId?: string;
}

export const MOCK_USERS: UserProfile[] = [
  {
    id: 'user-alex',
    name: 'Alex Rivera (Driver)',
    role: 'driver',
    licensePlate: 'EV-882-ZS',
  },
  {
    id: 'user-sara',
    name: 'Sara Chen (Driver)',
    role: 'driver',
    licensePlate: 'ZS-404-EQ',
  },
  {
    id: 'user-admin',
    name: 'Elena Vance (Facility Admin)',
    role: 'admin',
  },
];

class DataService {
  private state: FacilityState;
  private listeners: Set<(state: FacilityState) => void> = new Set();
  private currentUser: UserProfile = MOCK_USERS[0];
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastTickMs: number = Date.now();

  constructor() {
    this.state = this.getInitialState();
    this.startSimulationLoop();
  }

  private getInitialState(): FacilityState {
    const now = Date.now();
    const config: FacilityConfig = { ...DEFAULT_CONFIG };

    const initialBays: Bay[] = [
      { id: 1, name: 'Bay 1 (Fast AC)', status: 'FREE', currentEvId: null, maxPowerKw: 7.0, currentPowerKw: 0 },
      { id: 2, name: 'Bay 2 (Eco AC)', status: 'FREE', currentEvId: null, maxPowerKw: 7.0, currentPowerKw: 0 },
    ];

    // Start with no vehicles - users add them
    const initialEvs: EV[] = [];

    const recalculated = recalculateAll(initialBays, initialEvs, config, now);

    return {
      config,
      bays: recalculated.bays,
      evs: recalculated.evs,
      currentTime: new Date(now).toISOString(),
      timeSpeedMultiplier: 4,
      lastAutoAssignment: null,
    };
  }

  private detectQueuePromotion(prevEvs: EV[], nextEvs: EV[], atIso: string): AutoAssignmentEvent | null {
    const occupiedBefore = prevEvs.filter((e) => e.bayId !== null && e.energyNeededKwh > 0).length;
    if (occupiedBefore < this.state.config.baysCount) {
      return this.state.lastAutoAssignment;
    }

    for (const ev of nextEvs) {
      const prev = prevEvs.find((p) => p.id === ev.id);
      if (prev && prev.bayId === null && ev.bayId !== null && ev.energyNeededKwh > 0) {
        return {
          evId: ev.id,
          bayId: ev.bayId,
          driverName: ev.driverName,
          model: ev.model,
          licensePlate: ev.licensePlate,
          at: atIso,
        };
      }
    }

    return this.state.lastAutoAssignment;
  }

  private startSimulationLoop() {
    if (this.timer) clearInterval(this.timer);
    this.lastTickMs = Date.now();

    this.timer = setInterval(() => {
      this.tick();
    }, 1000);
  }

  private tick() {
    const realNow = Date.now();
    const realDeltaMs = realNow - this.lastTickMs;
    this.lastTickMs = realNow;

    const speed = this.state.timeSpeedMultiplier;
    const simDeltaMs = realDeltaMs * speed;
    const currentSimMs = new Date(this.state.currentTime).getTime() + simDeltaMs;

    // Advance energy for charging EVs
    const deltaHours = simDeltaMs / (1000 * 3600);

    const updatedEvs = this.state.evs.map(ev => {
      if (ev.status === 'CHARGING' && ev.allocatedPowerKw > 0) {
        const addedKwh = ev.allocatedPowerKw * deltaHours;
        const addedPercent = (addedKwh / ev.batteryCapacityKwh) * 100;
        const newPercent = Math.min(100, Number((ev.currentChargePercent + addedPercent).toFixed(2)));
        return {
          ...ev,
          currentChargePercent: newPercent,
        };
      }
      return ev;
    });

    const prevEvs = this.state.evs;
    const recalculated = recalculateAll(this.state.bays, updatedEvs, this.state.config, currentSimMs);
    const currentTime = new Date(currentSimMs).toISOString();

    this.state = {
      ...this.state,
      bays: recalculated.bays,
      evs: recalculated.evs,
      currentTime,
      lastAutoAssignment: this.detectQueuePromotion(prevEvs, recalculated.evs, currentTime),
    };

    this.notify();
  }

  public subscribe(listener: (state: FacilityState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  public getState(): FacilityState {
    return this.state;
  }

  public getCurrentUser(): UserProfile {
    return this.currentUser;
  }

  public setCurrentUser(user: UserProfile) {
    this.currentUser = user;
    this.notify();
  }

  public setTimeSpeed(multiplier: number) {
    this.state = {
      ...this.state,
      timeSpeedMultiplier: multiplier,
    };
    this.notify();
  }

  public updateConfig(updates: Partial<FacilityConfig>) {
    const newConfig = { ...this.state.config, ...updates };
    const nowMs = new Date(this.state.currentTime).getTime();
    const recalculated = recalculateAll(this.state.bays, this.state.evs, newConfig, nowMs);

    this.state = {
      ...this.state,
      config: newConfig,
      bays: recalculated.bays,
      evs: recalculated.evs,
    };
    this.notify();
  }

  public addEV(evInput: {
    driverName: string;
    licensePlate: string;
    model: string;
    batteryCapacityKwh: number;
    currentChargePercent: number;
    requestedTargetChargePercent?: number;
    tripDistanceKm: number;
    departureMinutesFromNow: number;
  }): EV {
    const nowMs = new Date(this.state.currentTime).getTime();
    const departureTime = new Date(nowMs + evInput.departureMinutesFromNow * 60 * 1000).toISOString();

    const newEv: EV = {
      id: `ev-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      driverName: evInput.driverName,
      licensePlate: evInput.licensePlate.toUpperCase(),
      model: evInput.model,
      batteryCapacityKwh: evInput.batteryCapacityKwh,
      currentChargePercent: evInput.currentChargePercent,
      requestedTargetChargePercent: evInput.requestedTargetChargePercent,
      tripDistanceKm: evInput.tripDistanceKm,
      arrivalTime: new Date(nowMs).toISOString(),
      departureTime,
      targetChargePercent: 0,
      energyNeededKwh: 0,
      allocatedPowerKw: 0,
      timeRemainingSeconds: 0,
      estimatedFinishTime: null,
      status: 'WAITING',
      bayId: null,
      queuePosition: null,
      estimatedWaitSeconds: null,
      isTargetUnreachable: false,
    };

    const prevEvs = this.state.evs;
    const newEvList = [...this.state.evs, newEv];
    const recalculated = recalculateAll(this.state.bays, newEvList, this.state.config, nowMs);
    const currentTime = this.state.currentTime;

    this.state = {
      ...this.state,
      bays: recalculated.bays,
      evs: recalculated.evs,
      lastAutoAssignment: this.detectQueuePromotion(prevEvs, recalculated.evs, currentTime),
    };

    this.notify();
    return this.state.evs.find(e => e.id === newEv.id) || newEv;
  }

  public removeEV(evId: string) {
    const nowMs = new Date(this.state.currentTime).getTime();
    const prevEvs = this.state.evs;
    const remaining = this.state.evs.filter(e => e.id !== evId);
    const recalculated = recalculateAll(this.state.bays, remaining, this.state.config, nowMs);

    this.state = {
      ...this.state,
      bays: recalculated.bays,
      evs: recalculated.evs,
      lastAutoAssignment: this.detectQueuePromotion(prevEvs, recalculated.evs, this.state.currentTime),
    };
    this.notify();
  }

  public departBay(bayId: number) {
    const bayEv = this.state.evs.find(e => e.bayId === bayId);
    if (bayEv) {
      this.removeEV(bayEv.id);
    }
  }

  public completeBayCharging(bayId: number) {
    const nowMs = new Date(this.state.currentTime).getTime();
    const updatedEvs = this.state.evs.map(e => {
      if (e.bayId === bayId) {
        return {
          ...e,
          currentChargePercent: e.targetChargePercent,
          energyNeededKwh: 0,
          status: 'COMPLETED' as const,
        };
      }
      return e;
    });

    const prevEvs = this.state.evs;
    const recalculated = recalculateAll(this.state.bays, updatedEvs, this.state.config, nowMs);

    this.state = {
      ...this.state,
      bays: recalculated.bays,
      evs: recalculated.evs,
      lastAutoAssignment: this.detectQueuePromotion(prevEvs, recalculated.evs, this.state.currentTime),
    };
    this.notify();
  }

  public fastForwardQueue() {
    // Find the bay that has a vehicle charging, preferentially with the earliest finish time
    const chargingBays = this.state.bays.filter(b => b.currentEvId !== null && b.status === 'CHARGING');
    if (chargingBays.length > 0) {
      // Complete charging in the first charging bay
      this.completeBayCharging(chargingBays[0].id);
    }
  }

  public resetFacility() {
    this.state = this.getInitialState();
    this.notify();
  }
}

export const dataService = new DataService();

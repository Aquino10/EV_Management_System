export type EVStatus = 'WAITING' | 'CHARGING' | 'COMPLETED' | 'DEPARTED';

export type BayStatus = 'FREE' | 'OCCUPIED' | 'CHARGING';

export interface EV {
  id: string;
  driverName: string;
  driverRole?: 'driver' | 'admin';
  ownerUserId?: string;
  licensePlate: string;
  model: string;
  batteryCapacityKwh: number;      // e.g. 30 kWh
  currentChargePercent: number;    // e.g. 20%
  tripDistanceKm: number;          // e.g. 100 km
  departureTime: string;           // ISO timestamp
  arrivalTime: string;             // ISO timestamp
  
  // Computed fields from logic
  targetChargePercent: number;     // e.g. 70%
  requestedTargetChargePercent?: number; // User-selected target, when provided
  energyNeededKwh: number;         // e.g. 15 kWh
  allocatedPowerKw: number;        // e.g. 3.5 kW
  timeRemainingSeconds: number;    // seconds until target reached
  estimatedFinishTime: string | null; // ISO timestamp
  status: EVStatus;
  bayId: number | null;            // 1, 2, or null (queued)
  queuePosition: number | null;    // 1-based, or null if in bay
  estimatedWaitSeconds: number | null; // wait time for queued EV
  isTargetUnreachable: boolean;    // warning flag
  warningMessage?: string;
  maxAchievableChargePercent?: number;
}

export interface Bay {
  id: number;
  name: string;
  status: BayStatus;
  currentEvId: string | null;
  maxPowerKw: number;             // e.g. 7.0 kW
  currentPowerKw: number;
}

export interface FacilityConfig {
  totalPowerKw: number;           // default 7.0 kW
  baysCount: number;              // default 2
  perBayMaxPowerKw: number;       // default 7.0 kW
  defaultBatteryCapacityKwh: number; // default 30 kWh
  consumptionKwhPerKm: number;    // default 0.18 kWh/km
  safetyMarginPercent: number;    // default 10%
}

export interface AutoAssignmentEvent {
  evId: string;
  bayId: number;
  driverName: string;
  model: string;
  licensePlate: string;
  at: string;
}

export interface FacilityState {
  config: FacilityConfig;
  bays: Bay[];
  evs: EV[];
  currentTime: string;           // simulated or real ISO timestamp
  timeSpeedMultiplier: number;   // Simulation time multiplier (defaults to 4x)
  lastAutoAssignment: AutoAssignmentEvent | null;
}

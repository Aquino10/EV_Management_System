import type { EV, Bay, FacilityConfig, BayStatus } from './types';

export const DEFAULT_CONFIG: FacilityConfig = {
  totalPowerKw: 7.0,
  baysCount: 2,
  perBayMaxPowerKw: 7.0,
  defaultBatteryCapacityKwh: 30.0,
  consumptionKwhPerKm: 0.18,
  safetyMarginPercent: 10.0,
};

/**
 * Calculates target battery charge percentage needed for the trip plus safety margin,
 * capped at 100%.
 */
export function calculateTargetCharge(
  tripDistanceKm: number,
  batteryCapacityKwh: number,
  consumptionKwhPerKm: number = DEFAULT_CONFIG.consumptionKwhPerKm,
  safetyMarginPercent: number = DEFAULT_CONFIG.safetyMarginPercent,
  currentChargePercent: number = 0
): number {
  if (batteryCapacityKwh <= 0) return 100;
  
  const tripEnergyKwh = Math.max(0, tripDistanceKm) * Math.max(0, consumptionKwhPerKm);
  const tripPercentage = (tripEnergyKwh / batteryCapacityKwh) * 100;
  const rawTarget = Math.ceil(tripPercentage + safetyMarginPercent);
  
  // Cap at 100%, and ensure target is at least current charge if current charge is valid
  const cappedTarget = Math.min(100, Math.max(10, rawTarget));
  return Math.max(currentChargePercent, cappedTarget);
}

/**
 * Calculates energy needed in kWh based on current and target percentages.
 */
export function calculateEnergyNeeded(
  targetChargePercent: number,
  currentChargePercent: number,
  batteryCapacityKwh: number
): number {
  if (currentChargePercent >= targetChargePercent) return 0;
  const neededPercent = Math.max(0, targetChargePercent - currentChargePercent);
  const kwh = (neededPercent / 100) * batteryCapacityKwh;
  return Number(kwh.toFixed(3));
}

/**
 * Evaluates whether an EV can physically reach its target charge before departure
 * at maximum bay power.
 */
export function evaluateReachability(
  energyNeededKwh: number,
  maxBayPowerKw: number,
  timeUntilDepartureHours: number,
  batteryCapacityKwh: number,
  currentChargePercent: number
): { isUnreachable: boolean; maxAchievablePercent: number; warning?: string } {
  if (energyNeededKwh <= 0) {
    return { isUnreachable: false, maxAchievablePercent: currentChargePercent };
  }

  const hoursAvailable = Math.max(0, timeUntilDepartureHours);
  const maxPossibleEnergyKwh = hoursAvailable * maxBayPowerKw;

  if (maxPossibleEnergyKwh < energyNeededKwh - 0.01) {
    const achievableChargeKwh = (currentChargePercent / 100) * batteryCapacityKwh + maxPossibleEnergyKwh;
    const maxAchievablePercent = Math.min(100, Math.max(currentChargePercent, Math.floor((achievableChargeKwh / batteryCapacityKwh) * 100)));
    return {
      isUnreachable: true,
      maxAchievablePercent,
      warning: `Departure is in ${(hoursAvailable * 60).toFixed(0)}m, which is insufficient to reach target even at maximum power (${maxBayPowerKw} kW). Max achievable: ~${maxAchievablePercent}%.`,
    };
  }

  return { isUnreachable: false, maxAchievablePercent: 100 };
}

/**
 * Computes an urgency priority score.
 * Urgency = (Time Needed at Max Bay Power) / (Time Remaining Until Departure).
 * Ratio > 1 indicates the vehicle is at severe risk of not completing before departure.
 */
export function calculateUrgencyScore(
  energyNeededKwh: number,
  maxBayPowerKw: number,
  timeUntilDepartureHours: number
): number {
  if (energyNeededKwh <= 0) return 0;
  const hoursAvailable = Math.max(0.01, timeUntilDepartureHours);
  const minHoursNeeded = energyNeededKwh / Math.max(0.1, maxBayPowerKw);
  
  // Base urgency ratio
  const ratio = minHoursNeeded / hoursAvailable;
  
  // Weight by square root of energy needed to also give credit to higher absolute deficits
  return Math.max(0.01, ratio * Math.sqrt(energyNeededKwh));
}

export interface PowerAllocationInput {
  evId: string;
  energyNeededKwh: number;
  timeUntilDepartureHours: number;
  bayMaxPowerKw: number;
}

export interface PowerAllocationOutput {
  evId: string;
  allocatedPowerKw: number;
}

/**
 * Allocates total facility power among currently charging EVs.
 * Priority-driven based on urgency ratio (departure window vs power needed) and energy requirement.
 * Respects each bay's maximum power and total facility capacity.
 */
export function allocateFacilityPower(
  candidates: PowerAllocationInput[],
  totalFacilityPowerKw: number,
  perBayMaxPowerKw: number = DEFAULT_CONFIG.perBayMaxPowerKw
): Record<string, number> {
  const allocations: Record<string, number> = {};

  // Filter out candidates with zero energy needed
  const activeCandidates = candidates.filter(c => c.energyNeededKwh > 0);

  if (activeCandidates.length === 0 || totalFacilityPowerKw <= 0) {
    for (const c of candidates) allocations[c.evId] = 0;
    return allocations;
  }

  // If active candidates total peak demand is <= totalFacilityPower, give each their bay max
  const totalMaxDemand = activeCandidates.reduce(
    (sum, c) => sum + Math.min(c.bayMaxPowerKw, perBayMaxPowerKw),
    0
  );

  if (totalMaxDemand <= totalFacilityPowerKw) {
    for (const c of candidates) {
      allocations[c.evId] = c.energyNeededKwh > 0 ? Math.min(c.bayMaxPowerKw, perBayMaxPowerKw) : 0;
    }
    return allocations;
  }

  // Calculate urgency scores
  const scores = activeCandidates.map(c => {
    const score = calculateUrgencyScore(c.energyNeededKwh, c.bayMaxPowerKw, c.timeUntilDepartureHours);
    return {
      candidate: c,
      score: Math.max(0.001, score),
      maxAllowed: Math.min(c.bayMaxPowerKw, perBayMaxPowerKw),
    };
  });

  // Iterative water-filling allocation respecting individual bay caps
  let remainingPower = totalFacilityPowerKw;
  const unconstrained = [...scores];

  for (const s of scores) {
    allocations[s.candidate.evId] = 0;
  }

  let iterations = 0;
  while (unconstrained.length > 0 && remainingPower > 0.001 && iterations < 10) {
    iterations++;
    const currentTotalScore = unconstrained.reduce((sum, s) => sum + s.score, 0);
    let cappedAny = false;

    for (let i = unconstrained.length - 1; i >= 0; i--) {
      const item = unconstrained[i];
      const proposedShare = (item.score / currentTotalScore) * remainingPower;
      
      if (proposedShare >= item.maxAllowed) {
        allocations[item.candidate.evId] = item.maxAllowed;
        remainingPower -= item.maxAllowed;
        unconstrained.splice(i, 1);
        cappedAny = true;
      }
    }

    if (!cappedAny) {
      // All remaining fit within their caps
      for (const item of unconstrained) {
        const share = (item.score / currentTotalScore) * remainingPower;
        allocations[item.candidate.evId] = Number(Math.min(item.maxAllowed, share).toFixed(2));
      }
      break;
    }
  }

  // Set 0 for any non-active candidates
  for (const c of candidates) {
    if (!allocations[c.evId]) allocations[c.evId] = 0;
  }

  return allocations;
}

/**
 * Calculates remaining time in seconds and clock finish time.
 */
export function calculateTimeRemaining(
  energyNeededKwh: number,
  allocatedPowerKw: number,
  nowMs: number
): { timeRemainingSeconds: number; estimatedFinishTime: string | null } {
  if (energyNeededKwh <= 0) {
    return {
      timeRemainingSeconds: 0,
      estimatedFinishTime: new Date(nowMs).toISOString(),
    };
  }

  if (allocatedPowerKw <= 0) {
    return {
      timeRemainingSeconds: Infinity,
      estimatedFinishTime: null,
    };
  }

  const hoursNeeded = energyNeededKwh / allocatedPowerKw;
  const secondsNeeded = Math.round(hoursNeeded * 3600);
  const finishDate = new Date(nowMs + secondsNeeded * 1000);

  return {
    timeRemainingSeconds: secondsNeeded,
    estimatedFinishTime: finishDate.toISOString(),
  };
}

export interface SimulatedBaySlot {
  bayId: number;
  availableAtMs: number;
}

/**
 * Simulates forward in time to estimate queue wait times.
 * Each queued vehicle gets an estimated wait time based on when
 * an occupied bay will next become free (target reached or departure reached).
 */
export function estimateQueueWaitTimes(
  bays: Bay[],
  chargingEvs: EV[],
  queuedEvs: EV[],
  facilityConfig: FacilityConfig,
  nowMs: number
): Record<string, number> {
  const waitTimes: Record<string, number> = {};

  if (queuedEvs.length === 0) return waitTimes;

  // Find when each bay is expected to free up
  const baySlots: SimulatedBaySlot[] = bays.map(bay => {
    const occupyingEv = chargingEvs.find(e => e.bayId === bay.id);
    if (!occupyingEv) {
      return { bayId: bay.id, availableAtMs: nowMs };
    }

    // A bay frees up when its EV reaches target OR reaches departure time, whichever is first
    const depMs = new Date(occupyingEv.departureTime).getTime();
    let finishMs = depMs;

    if (occupyingEv.estimatedFinishTime) {
      const eftMs = new Date(occupyingEv.estimatedFinishTime).getTime();
      if (Number.isFinite(eftMs)) {
        finishMs = Math.min(eftMs, depMs);
      }
    }

    if (Number.isFinite(occupyingEv.timeRemainingSeconds) && occupyingEv.timeRemainingSeconds > 0) {
      const fromRemaining = nowMs + occupyingEv.timeRemainingSeconds * 1000;
      finishMs = Math.min(finishMs, fromRemaining);
    }

    return {
      bayId: bay.id,
      availableAtMs: Math.max(nowMs, finishMs),
    };
  });

  // Sort queued EVs by arrival order
  const sortedQueue = [...queuedEvs].sort(
    (a, b) => new Date(a.arrivalTime).getTime() - new Date(b.arrivalTime).getTime()
  );

  // Forward simulation: assign queued EVs to earliest available slot
  for (const qEv of sortedQueue) {
    // Pick bay with smallest availableAtMs
    baySlots.sort((a, b) => a.availableAtMs - b.availableAtMs);
    const earliestSlot = baySlots[0];

    const waitSeconds = Math.max(0, Math.round((earliestSlot.availableAtMs - nowMs) / 1000));
    waitTimes[qEv.id] = waitSeconds;

    // Simulate this EV charging in that bay to push back that bay's availability for next queued EVs
    const targetCharge = qEv.requestedTargetChargePercent ?? calculateTargetCharge(
      qEv.tripDistanceKm,
      qEv.batteryCapacityKwh,
      facilityConfig.consumptionKwhPerKm,
      facilityConfig.safetyMarginPercent,
      qEv.currentChargePercent
    );
    const energyNeeded = calculateEnergyNeeded(
      targetCharge,
      qEv.currentChargePercent,
      qEv.batteryCapacityKwh
    );

    // Assume average power allocated will be totalFacilityPower / baysCount
    const expectedPower = Math.min(
      facilityConfig.perBayMaxPowerKw,
      facilityConfig.totalPowerKw / Math.max(1, facilityConfig.baysCount)
    );
    const chargeDurationSeconds = expectedPower > 0 ? (energyNeeded / expectedPower) * 3600 : 3600;
    
    const simulatedDepMs = new Date(qEv.departureTime).getTime();
    const simulatedFinishMs = earliestSlot.availableAtMs + chargeDurationSeconds * 1000;
    earliestSlot.availableAtMs = Math.min(simulatedFinishMs, Math.max(earliestSlot.availableAtMs, simulatedDepMs));
  }

  return waitTimes;
}

/**
 * Master recalculation function for all EVs and Bays in the facility.
 * Pure function: takes current data and returns updated copies.
 */
export function recalculateAll(
  bays: Bay[],
  evs: EV[],
  config: FacilityConfig,
  nowMs: number
): { bays: Bay[]; evs: EV[] } {
  const updatedEvs = evs.map(ev => ({ ...ev }));
  const updatedBays: Bay[] = bays.map(bay => ({
    ...bay,
    currentPowerKw: 0,
    status: 'FREE' as BayStatus,
    currentEvId: null as string | null,
  }));

  // 1. Identify completed or departed EVs and free bays
  for (const ev of updatedEvs) {
    const depTimeMs = new Date(ev.departureTime).getTime();
    const isDeparted = nowMs >= depTimeMs;

    // Recalculate target and needed energy
    ev.targetChargePercent = ev.requestedTargetChargePercent === undefined
      ? calculateTargetCharge(
          ev.tripDistanceKm,
          ev.batteryCapacityKwh,
          config.consumptionKwhPerKm,
          config.safetyMarginPercent,
          ev.currentChargePercent
        )
      : Math.min(100, Math.max(ev.currentChargePercent, ev.requestedTargetChargePercent));
    ev.energyNeededKwh = calculateEnergyNeeded(
      ev.targetChargePercent,
      ev.currentChargePercent,
      ev.batteryCapacityKwh
    );

    if (ev.energyNeededKwh <= 0) {
      if (ev.status !== 'DEPARTED') {
        ev.status = 'COMPLETED';
        ev.allocatedPowerKw = 0;
        // Reaching target charge frees the bay so queued vehicles or other drivers can park
        ev.bayId = null;
      }
    } else if (isDeparted) {
      ev.status = 'DEPARTED';
      ev.bayId = null;
      ev.queuePosition = null;
      ev.allocatedPowerKw = 0;
    }

    // Check reachability warning
    const timeUntilDepHours = Math.max(0, (depTimeMs - nowMs) / (1000 * 3600));
    const reachability = evaluateReachability(
      ev.energyNeededKwh,
      config.perBayMaxPowerKw,
      timeUntilDepHours,
      ev.batteryCapacityKwh,
      ev.currentChargePercent
    );
    ev.isTargetUnreachable = reachability.isUnreachable;
    ev.warningMessage = reachability.warning;
    ev.maxAchievableChargePercent = reachability.maxAchievablePercent;
  }

  // 2. Assign bays: Keep existing valid assignments first for EVs still needing charge
  const activeEvs = updatedEvs.filter(e => e.status !== 'DEPARTED');
  const availableBays = updatedBays.map(b => b.id);

  for (const ev of activeEvs) {
    if (ev.bayId && ev.energyNeededKwh > 0 && availableBays.includes(ev.bayId)) {
      const bay = updatedBays.find(b => b.id === ev.bayId);
      if (bay) {
        bay.currentEvId = ev.id;
        bay.status = 'CHARGING';
        const idx = availableBays.indexOf(ev.bayId);
        if (idx !== -1) availableBays.splice(idx, 1);
      }
    }
  }

  // 3. Promote queued EVs if any bays are empty
  const unassignedEvs = activeEvs.filter(e => !e.bayId && e.energyNeededKwh > 0);
  unassignedEvs.sort((a, b) => new Date(a.arrivalTime).getTime() - new Date(b.arrivalTime).getTime());

  while (availableBays.length > 0 && unassignedEvs.length > 0) {
    const bayId = availableBays.shift()!;
    const ev = unassignedEvs.shift()!;
    ev.bayId = bayId;
    ev.queuePosition = null;
    ev.status = 'CHARGING';
    
    const bay = updatedBays.find(b => b.id === bayId);
    if (bay) {
      bay.currentEvId = ev.id;
      bay.status = 'CHARGING';
    }
  }

  // 4. Update queue positions for remaining unassigned EVs
  let queueIndex = 1;
  const queuedEvsList: EV[] = [];
  for (const ev of activeEvs) {
    if (!ev.bayId && ev.energyNeededKwh > 0) {
      ev.status = 'WAITING';
      ev.queuePosition = queueIndex++;
      ev.allocatedPowerKw = 0;
      queuedEvsList.push(ev);
    } else if (ev.bayId) {
      ev.queuePosition = null;
    }
  }

  // 5. Power Allocation for EVs currently in bays that need charging
  const chargingEvs = activeEvs.filter(e => e.bayId !== null && e.energyNeededKwh > 0);
  const candidates: PowerAllocationInput[] = chargingEvs.map(e => {
    const depMs = new Date(e.departureTime).getTime();
    return {
      evId: e.id,
      energyNeededKwh: e.energyNeededKwh,
      timeUntilDepartureHours: Math.max(0.01, (depMs - nowMs) / (1000 * 3600)),
      bayMaxPowerKw: config.perBayMaxPowerKw,
    };
  });

  const allocations = allocateFacilityPower(candidates, config.totalPowerKw, config.perBayMaxPowerKw);

  for (const ev of chargingEvs) {
    const power = allocations[ev.id] || 0;
    ev.allocatedPowerKw = power;
    ev.status = power > 0 ? 'CHARGING' : 'WAITING';

    const timing = calculateTimeRemaining(ev.energyNeededKwh, power, nowMs);
    ev.timeRemainingSeconds = timing.timeRemainingSeconds;
    ev.estimatedFinishTime = timing.estimatedFinishTime;

    const bay = updatedBays.find(b => b.id === ev.bayId);
    if (bay) {
      bay.currentPowerKw = power;
      bay.status = power > 0 ? 'CHARGING' : 'OCCUPIED';
    }
  }

  // 6. Queue Wait Time Estimation
  const queueEstimates = estimateQueueWaitTimes(updatedBays, chargingEvs, queuedEvsList, config, nowMs);
  for (const ev of queuedEvsList) {
    ev.estimatedWaitSeconds = queueEstimates[ev.id] ?? null;
  }

  return { bays: updatedBays, evs: updatedEvs };
}

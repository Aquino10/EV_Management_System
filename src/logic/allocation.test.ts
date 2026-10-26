import { describe, it, expect } from 'vitest';
import {
  calculateTargetCharge,
  calculateEnergyNeeded,
  evaluateReachability,
  allocateFacilityPower,
  estimateQueueWaitTimes,
  recalculateAll,
  DEFAULT_CONFIG,
} from './allocation';
import type { EV, Bay } from './types';

describe('ZeroStatic Pure Allocation Logic', () => {
  const baseNow = new Date('2026-10-24T12:00:00Z').getTime();

  it('1. Normal charging: single EV receives bay max power up to facility limit', () => {
    // 30 kWh battery, 20% current, 100km trip distance -> target = (100 * 0.18 / 30) * 100 + 10 = 60 + 10 = 70%
    const target = calculateTargetCharge(100, 30, 0.18, 10, 20);
    expect(target).toBe(70);

    const needed = calculateEnergyNeeded(70, 20, 30);
    // (70 - 20) / 100 * 30 = 15 kWh
    expect(needed).toBe(15);

    // Facility has 7 kW total, per bay max 7 kW
    const allocations = allocateFacilityPower(
      [{ evId: 'ev-1', energyNeededKwh: needed, timeUntilDepartureHours: 3, bayMaxPowerKw: 7.0 }],
      7.0,
      7.0
    );

    // EV 1 should get full 7.0 kW
    expect(allocations['ev-1']).toBe(7.0);
  });

  it('2. Two EVs sharing limited power: both active EVs receive power sum <= total power', () => {
    const candidates = [
      { evId: 'ev-1', energyNeededKwh: 12, timeUntilDepartureHours: 2.0, bayMaxPowerKw: 7.0 },
      { evId: 'ev-2', energyNeededKwh: 12, timeUntilDepartureHours: 2.0, bayMaxPowerKw: 7.0 },
    ];

    const allocations = allocateFacilityPower(candidates, 7.0, 7.0);

    // Equal urgency -> equal split
    expect(allocations['ev-1'] + allocations['ev-2']).toBeCloseTo(7.0, 1);
    expect(allocations['ev-1']).toBeCloseTo(3.5, 1);
    expect(allocations['ev-2']).toBeCloseTo(3.5, 1);
  });

  it('3. Urgent EV arrival causing dynamic reallocation: urgent EV gets higher priority share', () => {
    // EV 1 leaves in 4 hours (relaxed)
    // EV 2 leaves in 30 minutes (0.5 hours) (urgent)
    const candidates = [
      { evId: 'ev-relaxed', energyNeededKwh: 10, timeUntilDepartureHours: 4.0, bayMaxPowerKw: 7.0 },
      { evId: 'ev-urgent', energyNeededKwh: 10, timeUntilDepartureHours: 0.5, bayMaxPowerKw: 7.0 },
    ];

    const allocations = allocateFacilityPower(candidates, 7.0, 7.0);

    // Total allocated must not exceed 7.0 kW
    expect(allocations['ev-relaxed'] + allocations['ev-urgent']).toBeLessThanOrEqual(7.01);

    // Urgent EV must receive strictly more power than the relaxed EV
    expect(allocations['ev-urgent']).toBeGreaterThan(allocations['ev-relaxed']);
    // In fact, urgent EV has urgency score = (10/7)/0.5 = 2.85 vs relaxed = (10/7)/4 = 0.35
    expect(allocations['ev-urgent']).toBeGreaterThan(5.0);
  });

  it('4. Queue wait estimate: when both bays full, 3rd EV gets an estimated wait time', () => {
    const bays: Bay[] = [
      { id: 1, name: 'Bay 1', status: 'CHARGING', currentEvId: 'ev-1', maxPowerKw: 7, currentPowerKw: 3.5 },
      { id: 2, name: 'Bay 2', status: 'CHARGING', currentEvId: 'ev-2', maxPowerKw: 7, currentPowerKw: 3.5 },
    ];

    // EV 1 needs 3.5 kWh, charging at 3.5 kW -> 1 hour (3600s)
    const ev1: EV = {
      id: 'ev-1',
      driverName: 'Driver 1',
      licensePlate: 'EV-01',
      model: 'Tesla Model 3',
      batteryCapacityKwh: 30,
      currentChargePercent: 50,
      tripDistanceKm: 100,
      departureTime: new Date(baseNow + 2 * 3600 * 1000).toISOString(),
      arrivalTime: new Date(baseNow - 1800 * 1000).toISOString(),
      targetChargePercent: 70,
      energyNeededKwh: 3.5,
      allocatedPowerKw: 3.5,
      timeRemainingSeconds: 3600,
      estimatedFinishTime: new Date(baseNow + 3600 * 1000).toISOString(), // finishes in 1 hour
      status: 'CHARGING',
      bayId: 1,
      queuePosition: null,
      estimatedWaitSeconds: null,
      isTargetUnreachable: false,
    };

    // EV 2 finishes in 2 hours
    const ev2: EV = {
      ...ev1,
      id: 'ev-2',
      bayId: 2,
      timeRemainingSeconds: 7200,
      estimatedFinishTime: new Date(baseNow + 7200 * 1000).toISOString(),
    };

    // EV 3 arrives and is queued
    const ev3Queue: EV = {
      ...ev1,
      id: 'ev-3',
      bayId: null,
      status: 'WAITING',
      queuePosition: 1,
      timeRemainingSeconds: 0,
      estimatedFinishTime: null,
      allocatedPowerKw: 0,
      arrivalTime: new Date(baseNow).toISOString(),
    };

    const estimates = estimateQueueWaitTimes(bays, [ev1, ev2], [ev3Queue], DEFAULT_CONFIG, baseNow);

    // EV 3 should wait for the first bay to free up (which is Bay 1 in ~3600s)
    expect(estimates['ev-3']).toBeDefined();
    expect(estimates['ev-3']).toBeCloseTo(3600, -2); // ~3600 seconds
  });

  it('5. Target unreachable warning: alerts when EV departure is too soon for target energy', () => {
    // 30 kWh battery, 10% current charge
    // Trip distance 200km -> needs ~46% charge + 10% margin = 56% target
    // Energy needed = 46% of 30 kWh = 13.8 kWh
    const energyNeeded = 13.8;
    // Max bay power = 7.0 kW. Time needed at max power = 13.8 / 7 = 1.97 hours (~118 min)
    // But departure is in only 30 minutes (0.5 hours)!
    const departureHours = 0.5;

    const reachability = evaluateReachability(
      energyNeeded,
      7.0,
      departureHours,
      30,
      10
    );

    expect(reachability.isUnreachable).toBe(true);
    expect(reachability.warning).toBeDefined();
    expect(reachability.warning).toContain('Departure is in 30m, which is insufficient');
    // In 0.5h at 7kW, max deliverable is 3.5 kWh -> ~11.6% added to 10% = ~21%
    expect(reachability.maxAchievablePercent).toBeLessThan(30);
  });

  it('6. Full recalculateAll integration with state transitions', () => {
    const bays: Bay[] = [
      { id: 1, name: 'Bay 1', status: 'FREE', currentEvId: null, maxPowerKw: 7, currentPowerKw: 0 },
      { id: 2, name: 'Bay 2', status: 'FREE', currentEvId: null, maxPowerKw: 7, currentPowerKw: 0 },
    ];

    const evs: EV[] = [
      {
        id: 'ev-a',
        driverName: 'Driver A',
        licensePlate: 'ABC-123',
        model: 'Nissan Leaf',
        batteryCapacityKwh: 30,
        currentChargePercent: 20,
        tripDistanceKm: 80,
        departureTime: new Date(baseNow + 2 * 3600 * 1000).toISOString(),
        arrivalTime: new Date(baseNow - 600 * 1000).toISOString(),
        targetChargePercent: 60,
        energyNeededKwh: 12,
        allocatedPowerKw: 0,
        timeRemainingSeconds: 0,
        estimatedFinishTime: null,
        status: 'WAITING',
        bayId: null,
        queuePosition: 1,
        estimatedWaitSeconds: null,
        isTargetUnreachable: false,
      },
      {
        id: 'ev-b',
        driverName: 'Driver B',
        licensePlate: 'XYZ-789',
        model: 'Chevy Bolt',
        batteryCapacityKwh: 30,
        currentChargePercent: 30,
        tripDistanceKm: 60,
        departureTime: new Date(baseNow + 1.5 * 3600 * 1000).toISOString(),
        arrivalTime: new Date(baseNow - 300 * 1000).toISOString(),
        targetChargePercent: 50,
        energyNeededKwh: 6,
        allocatedPowerKw: 0,
        timeRemainingSeconds: 0,
        estimatedFinishTime: null,
        status: 'WAITING',
        bayId: null,
        queuePosition: 2,
        estimatedWaitSeconds: null,
        isTargetUnreachable: false,
      },
    ];

    const result = recalculateAll(bays, evs, DEFAULT_CONFIG, baseNow);

    // Both should be assigned to Bay 1 and Bay 2
    expect(result.bays[0].status).toBe('CHARGING');
    expect(result.bays[1].status).toBe('CHARGING');
    expect(result.evs[0].bayId).toBe(1);
    expect(result.evs[1].bayId).toBe(2);

    // Total power allocated across bays should equal facility limit 7.0 kW
    const totalAllocated = result.bays[0].currentPowerKw + result.bays[1].currentPowerKw;
    expect(totalAllocated).toBeCloseTo(7.0, 1);
  });

  it('7. Automatic promotion: when any bay vehicle finishes charging, 3rd queued vehicle is automatically assigned the freed bay', () => {
    const bays: Bay[] = [
      { id: 1, name: 'Bay 1', status: 'CHARGING', currentEvId: 'ev-1', maxPowerKw: 7, currentPowerKw: 3.5 },
      { id: 2, name: 'Bay 2', status: 'CHARGING', currentEvId: 'ev-2', maxPowerKw: 7, currentPowerKw: 3.5 },
    ];

    // EV 1 has reached 100% of target (0 kWh needed, finished charging)
    const ev1Completed: EV = {
      id: 'ev-1',
      driverName: 'Driver 1',
      licensePlate: 'EV-01',
      model: 'Tesla Model 3',
      batteryCapacityKwh: 30,
      currentChargePercent: 70, // reached target 70%
      tripDistanceKm: 100,
      departureTime: new Date(baseNow + 2 * 3600 * 1000).toISOString(),
      arrivalTime: new Date(baseNow - 1800 * 1000).toISOString(),
      targetChargePercent: 70,
      energyNeededKwh: 0,
      allocatedPowerKw: 0,
      timeRemainingSeconds: 0,
      estimatedFinishTime: new Date(baseNow).toISOString(),
      status: 'COMPLETED',
      bayId: 1,
      queuePosition: null,
      estimatedWaitSeconds: null,
      isTargetUnreachable: false,
    };

    // EV 2 still charging
    const ev2Charging: EV = {
      ...ev1Completed,
      id: 'ev-2',
      licensePlate: 'EV-02',
      currentChargePercent: 40,
      energyNeededKwh: 9,
      bayId: 2,
      status: 'CHARGING',
    };

    // EV 3 is in queue waiting
    const ev3Queued: EV = {
      ...ev1Completed,
      id: 'ev-3',
      licensePlate: 'EV-03',
      currentChargePercent: 20,
      energyNeededKwh: 15,
      bayId: null,
      status: 'WAITING',
      queuePosition: 1,
    };

    const result = recalculateAll(bays, [ev1Completed, ev2Charging, ev3Queued], DEFAULT_CONFIG, baseNow);

    // EV 1 should be COMPLETED and freed from bay
    const updatedEv1 = result.evs.find(e => e.id === 'ev-1')!;
    expect(updatedEv1.status).toBe('COMPLETED');
    expect(updatedEv1.bayId).toBeNull();

    // EV 3 (the 3rd vehicle) should be AUTOMATICALLY assigned to Bay 1!
    const updatedEv3 = result.evs.find(e => e.id === 'ev-3')!;
    expect(updatedEv3.bayId).toBe(1);
    expect(updatedEv3.status).toBe('CHARGING');
    expect(updatedEv3.allocatedPowerKw).toBeGreaterThan(0);

    // Bay 1 now hosts EV 3
    const bay1 = result.bays.find(b => b.id === 1)!;
    expect(bay1.currentEvId).toBe('ev-3');
    expect(bay1.status).toBe('CHARGING');
  });

  it('8. Queue wait timer decreases as charging time advances while both bays stay occupied', () => {
    const bays: Bay[] = [
      { id: 1, name: 'Bay 1', status: 'CHARGING', currentEvId: 'ev-1', maxPowerKw: 7, currentPowerKw: 3.5 },
      { id: 2, name: 'Bay 2', status: 'CHARGING', currentEvId: 'ev-2', maxPowerKw: 7, currentPowerKw: 3.5 },
    ];

    const makeChargingEv = (id: string, bayId: number, currentChargePercent: number): EV => ({
      id,
      driverName: `Driver ${id}`,
      licensePlate: id.toUpperCase(),
      model: 'Tesla Model 3',
      batteryCapacityKwh: 30,
      currentChargePercent,
      tripDistanceKm: 100,
      departureTime: new Date(baseNow + 6 * 3600 * 1000).toISOString(),
      arrivalTime: new Date(baseNow - 1800 * 1000).toISOString(),
      targetChargePercent: 70,
      energyNeededKwh: 9,
      allocatedPowerKw: 3.5,
      timeRemainingSeconds: 3600,
      estimatedFinishTime: new Date(baseNow + 3600 * 1000).toISOString(),
      status: 'CHARGING',
      bayId,
      queuePosition: null,
      estimatedWaitSeconds: null,
      isTargetUnreachable: false,
    });

    const customTargetResult = recalculateAll(
      bays,
      [{ ...makeChargingEv('ev-custom-target', 1, 40), requestedTargetChargePercent: 55 }],
      DEFAULT_CONFIG,
      baseNow
    );
    const customTargetEv = customTargetResult.evs[0];
    expect(customTargetEv.targetChargePercent).toBe(55);
    expect(customTargetEv.energyNeededKwh).toBe(4.5);

    const queued: EV = {
      ...makeChargingEv('ev-3', 1, 20),
      bayId: null,
      status: 'WAITING',
      queuePosition: 1,
      allocatedPowerKw: 0,
      timeRemainingSeconds: 0,
      estimatedFinishTime: null,
      arrivalTime: new Date(baseNow).toISOString(),
    };

    const atStart = recalculateAll(
      bays,
      [makeChargingEv('ev-1', 1, 40), makeChargingEv('ev-2', 2, 40), queued],
      DEFAULT_CONFIG,
      baseNow
    );
    const waitAtStart = atStart.evs.find(e => e.id === 'ev-3')!.estimatedWaitSeconds;
    expect(waitAtStart).toBeGreaterThan(60);

    // 10 minutes of charging at the allocated power reduces remaining energy, so the queue timer ticks down
    const laterNow = baseNow + 10 * 60 * 1000;
    const progressed = atStart.evs.map((ev) => {
      if (ev.bayId && ev.allocatedPowerKw > 0) {
        const addedKwh = ev.allocatedPowerKw * (10 / 60);
        const addedPercent = (addedKwh / ev.batteryCapacityKwh) * 100;
        return { ...ev, currentChargePercent: ev.currentChargePercent + addedPercent };
      }
      return ev;
    });
    const later = recalculateAll(atStart.bays, progressed, DEFAULT_CONFIG, laterNow);
    const waitLater = later.evs.find(e => e.id === 'ev-3')!.estimatedWaitSeconds;
    expect(waitLater).not.toBeNull();
    expect(waitLater!).toBeLessThan(waitAtStart!);
    expect(later.evs.find(e => e.id === 'ev-3')!.bayId).toBeNull();
  });
});

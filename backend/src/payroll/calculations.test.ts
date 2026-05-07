import { describe, it, expect } from 'vitest';
import { calcEpf, calcEsic, calcLwf, isLwfApplicableMonth, calcGratuityProvision } from './calculations';

describe('calcEpf', () => {
  it('returns zeros when exempt', () => {
    expect(calcEpf(30000, true)).toEqual({ employee: 0, epfEmployer: 0, epsEmployer: 0 });
  });
  it('caps at basic salary of 15000', () => {
    const r = calcEpf(30000, false);
    expect(r.employee).toBe(1800);       // 12% of 15000
    expect(r.epfEmployer).toBe(550.5);   // 3.67% of 15000
    expect(r.epsEmployer).toBe(1249.5);  // 8.33% of 15000
  });
  it('uses actual basic when below ceiling', () => {
    const r = calcEpf(10000, false);
    expect(r.employee).toBe(1200);       // 12% of 10000
    expect(r.epfEmployer).toBe(367);     // 3.67% of 10000
    expect(r.epsEmployer).toBe(833);     // 8.33% of 10000
  });
});

describe('calcEsic', () => {
  it('returns zeros and not applicable when gross > 21000', () => {
    const r = calcEsic(25000, false);
    expect(r.employee).toBe(0);
    expect(r.applicable).toBe(false);
  });
  it('calculates correctly when gross <= 21000', () => {
    const r = calcEsic(18000, false);
    expect(r.employee).toBe(135);    // 0.75% of 18000
    expect(r.employer).toBe(585);    // 3.25% of 18000
    expect(r.applicable).toBe(true);
  });
  it('returns zeros when exempt regardless of salary', () => {
    const r = calcEsic(10000, true);
    expect(r.employee).toBe(0);
    expect(r.applicable).toBe(false);
  });
});

describe('isLwfApplicableMonth', () => {
  it('monthly is always applicable', () => {
    expect(isLwfApplicableMonth('monthly', 3)).toBe(true);
  });
  it('half_yearly applies only in June and December', () => {
    expect(isLwfApplicableMonth('half_yearly', 6)).toBe(true);
    expect(isLwfApplicableMonth('half_yearly', 12)).toBe(true);
    expect(isLwfApplicableMonth('half_yearly', 5)).toBe(false);
  });
  it('annually applies only in December', () => {
    expect(isLwfApplicableMonth('annually', 12)).toBe(true);
    expect(isLwfApplicableMonth('annually', 6)).toBe(false);
  });
});

describe('calcLwf', () => {
  it('returns zeros when exempt', () => {
    expect(calcLwf(25, 50, 'monthly', 3, true)).toEqual({ employee: 0, employer: 0 });
  });
  it('returns zeros when not an applicable month', () => {
    expect(calcLwf(25, 50, 'half_yearly', 3, false)).toEqual({ employee: 0, employer: 0 });
  });
  it('returns configured amounts in applicable month', () => {
    expect(calcLwf(25, 50, 'monthly', 3, false)).toEqual({ employee: 25, employer: 50 });
  });
});

describe('calcGratuityProvision', () => {
  it('calculates monthly provision correctly', () => {
    // (30000 * 15) / 26 / 12 = 1442.31
    expect(calcGratuityProvision(30000)).toBeCloseTo(1442.31, 1);
  });
});

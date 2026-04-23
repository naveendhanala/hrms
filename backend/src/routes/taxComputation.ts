import { Router, Response } from 'express';
import db from '../db';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

interface TaxSlab { from: number; to: number; rate: number; label: string }

const NEW_REGIME: TaxSlab[] = [
  { from: 0,       to: 400000,     rate: 0.00, label: 'Up to ₹4,00,000'           },
  { from: 400000,  to: 800000,     rate: 0.05, label: '₹4,00,001 – ₹8,00,000'     },
  { from: 800000,  to: 1200000,    rate: 0.10, label: '₹8,00,001 – ₹12,00,000'    },
  { from: 1200000, to: 1600000,    rate: 0.15, label: '₹12,00,001 – ₹16,00,000'   },
  { from: 1600000, to: 2000000,    rate: 0.20, label: '₹16,00,001 – ₹20,00,000'   },
  { from: 2000000, to: 2400000,    rate: 0.25, label: '₹20,00,001 – ₹24,00,000'   },
  { from: 2400000, to: 9999999999, rate: 0.30, label: 'Above ₹24,00,000'          },
];

const OLD_REGIME: TaxSlab[] = [
  { from: 0,       to: 250000,     rate: 0.00, label: 'Up to ₹2,50,000'           },
  { from: 250000,  to: 500000,     rate: 0.05, label: '₹2,50,001 – ₹5,00,000'     },
  { from: 500000,  to: 1000000,    rate: 0.20, label: '₹5,00,001 – ₹10,00,000'    },
  { from: 1000000, to: 9999999999, rate: 0.30, label: 'Above ₹10,00,000'          },
];

function computeTax(taxableIncome: number, slabs: TaxSlab[]) {
  const breakdown: { label: string; rate: string; taxableAmount: number; tax: number }[] = [];
  let totalTax = 0;
  for (const slab of slabs) {
    if (taxableIncome <= slab.from) {
      breakdown.push({ label: slab.label, rate: slab.rate === 0 ? 'Nil' : `${slab.rate * 100}%`, taxableAmount: 0, tax: 0 });
      continue;
    }
    const taxableInSlab = Math.min(taxableIncome, slab.to) - slab.from;
    const tax = Math.round(taxableInSlab * slab.rate);
    totalTax += tax;
    breakdown.push({ label: slab.label, rate: slab.rate === 0 ? 'Nil' : `${slab.rate * 100}%`, taxableAmount: Math.round(taxableInSlab), tax });
  }
  return { breakdown, totalTax };
}

function getSurcharge(taxableIncome: number, taxAfterRebate: number, regime: 'old' | 'new') {
  let rate = 0;
  let label = '';
  if (taxableIncome > 50_000_000) {
    rate = regime === 'new' ? 0.25 : 0.37;
    label = regime === 'new' ? '25% (capped under New Regime)' : '37%';
  } else if (taxableIncome > 20_000_000) {
    rate = 0.25; label = '25%';
  } else if (taxableIncome > 10_000_000) {
    rate = 0.15; label = '15%';
  } else if (taxableIncome > 5_000_000) {
    rate = 0.10; label = '10%';
  }
  return { surcharge: Math.round(taxAfterRebate * rate), surchargeLabel: label };
}

export function computeAnnualTax(annualGross: number, regime: 'old' | 'new') {
  const slabs = regime === 'new' ? NEW_REGIME : OLD_REGIME;
  const standardDeduction = regime === 'new' ? 75000 : 50000;
  const taxableIncome = Math.max(0, annualGross - standardDeduction);
  const { breakdown, totalTax: taxBeforeRebate } = computeTax(taxableIncome, slabs);

  let rebate = 0;
  let rebateNote = '';
  if (regime === 'new' && taxableIncome <= 700000) {
    rebate = Math.min(taxBeforeRebate, 25000);
    rebateNote = 'u/s 87A (taxable income ≤ ₹7,00,000)';
  } else if (regime === 'old' && taxableIncome <= 500000) {
    rebate = Math.min(taxBeforeRebate, 12500);
    rebateNote = 'u/s 87A (taxable income ≤ ₹5,00,000)';
  }

  const taxAfterRebate = taxBeforeRebate - rebate;
  const { surcharge, surchargeLabel } = getSurcharge(taxableIncome, taxAfterRebate, regime);
  // Cess is on (tax after rebate + surcharge)
  const cess = Math.round((taxAfterRebate + surcharge) * 0.04);
  const totalAnnualTax = taxAfterRebate + surcharge + cess;
  const monthlyTds = Math.round(totalAnnualTax / 12);

  return {
    annualGross,
    standardDeduction,
    taxableIncome,
    slabBreakdown: breakdown,
    taxBeforeRebate,
    rebate,
    rebateNote,
    taxAfterRebate,
    surcharge,
    surchargeLabel,
    cess,
    totalAnnualTax,
    monthlyTds,
  };
}

router.get('/', authenticateToken, requireRole('admin', 'hr'), async (_req: AuthRequest, res: Response) => {
  const employees = await db.query<any>(`
    SELECT u.id, u.emp_id, u.name, u.designation,
           COALESCE(s.basic_salary,      0) AS basic_salary,
           COALESCE(s.hra,               0) AS hra,
           COALESCE(s.meal_allowance,    0) AS meal_allowance,
           COALESCE(s.fuel_allowance,    0) AS fuel_allowance,
           COALESCE(s.driver_allowance,  0) AS driver_allowance,
           COALESCE(s.special_allowance, 0) AS special_allowance,
           COALESCE(t.tax_regime, 'new')    AS tax_regime
    FROM users u
    LEFT JOIN salary_master s ON s.employee_id = u.id
    LEFT JOIN employee_tax_config t ON t.employee_id = u.id
    WHERE u.role != 'admin' AND u.status = 'active'
    ORDER BY u.name ASC
  `);

  const result = employees.map((emp: any) => {
    const monthlyGross = emp.basic_salary + emp.hra + emp.meal_allowance + emp.fuel_allowance + emp.driver_allowance + emp.special_allowance;
    const regime = (emp.tax_regime || 'new') as 'old' | 'new';
    return {
      employee_id: emp.id,
      emp_id: emp.emp_id,
      name: emp.name,
      designation: emp.designation,
      tax_regime: regime,
      monthly_gross: monthlyGross,
      salary_components: {
        basic_salary:      emp.basic_salary,
        hra:               emp.hra,
        meal_allowance:    emp.meal_allowance,
        fuel_allowance:    emp.fuel_allowance,
        driver_allowance:  emp.driver_allowance,
        special_allowance: emp.special_allowance,
      },
      ...computeAnnualTax(monthlyGross * 12, regime),
    };
  });

  res.json(result);
});

router.put('/:employeeId/regime', authenticateToken, requireRole('admin', 'hr'), async (req: AuthRequest, res: Response) => {
  const { regime } = req.body;
  if (!['old', 'new'].includes(regime))
    return res.status(400).json({ error: 'regime must be "old" or "new"' });

  const user = await db.queryOne("SELECT id FROM users WHERE id = ? AND role != 'admin'", [req.params.employeeId]);
  if (!user) return res.status(404).json({ error: 'Employee not found' });

  const now = new Date().toISOString();
  await db.run(`
    INSERT INTO employee_tax_config (employee_id, tax_regime, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(employee_id) DO UPDATE SET tax_regime = excluded.tax_regime, updated_at = excluded.updated_at
  `, [Number(req.params.employeeId), regime, now]);

  res.json({ ok: true });
});

export default router;

import PDFDocument from 'pdfkit';
import { Response } from 'express';

export interface PayslipData {
  companyName: string;
  companyAddress: string;
  pfRegNumber: string;
  esicRegNumber: string;
  hrEmail: string;
  empId: string;
  employeeName: string;
  designation: string;
  department: string;
  uanNumber: string;
  panNumber: string;
  taxRegime: string;
  month: number;
  year: number;
  workingDays: number;
  presentDays: number;
  leaveDays: number;
  absentDays: number;
  lopDays: number;
  basicSalary: number;
  hra: number;
  mealAllowance: number;
  conveyanceAllowance: number;
  specialAllowance: number;
  grossSalary: number;
  lopDeduction: number;
  earnedSalary: number;
  epfEmployee: number;
  esicEmployee: number;
  esicApplicable: boolean;
  lwfEmployee: number;
  profTax: number;
  tdsDeduction: number;
  advanceDeduction: number;
  arrears: number;
  arrearsLabel: string;
  netSalary: number;
  epfEmployer: number;
  epsEmployer: number;
  esicEmployer: number;
  lwfEmployer: number;
  gratuityProvision: number;
  totalEmployerCost: number;
  totalCtc: number;
}

const MONTH_NAMES = ['', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

function fmt(n: number) {
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

export function streamPayslipPdf(data: PayslipData, res: Response): void {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="payslip-${data.empId}-${data.month}-${data.year}.pdf"`);
  doc.pipe(res);

  const period = `${MONTH_NAMES[data.month]} ${data.year}`;
  const W = 515;

  // Company header
  doc.fontSize(16).font('Helvetica-Bold').fillColor('#1a3a6b').text(data.companyName, 40, 40, { align: 'center', width: W });
  doc.fontSize(9).font('Helvetica').fillColor('#555').text(data.companyAddress, 40, 62, { align: 'center', width: W });
  if (data.pfRegNumber || data.esicRegNumber) {
    doc.fontSize(8).text(`PF Reg: ${data.pfRegNumber || 'N/A'}   |   ESIC Reg: ${data.esicRegNumber || 'N/A'}`, 40, 74, { align: 'center', width: W });
  }

  // Title bar
  doc.rect(40, 88, W, 22).fill('#1a3a6b');
  doc.fontSize(11).font('Helvetica-Bold').fillColor('#fff').text(`PAYSLIP — ${period}`, 40, 93, { align: 'center', width: W });

  // Employee info grid
  let y = 120;
  doc.rect(40, y, W, 14).fill('#f5f7fc');
  doc.fontSize(8).font('Helvetica-Bold').fillColor('#555').text('EMPLOYEE DETAILS', 44, y + 3);
  y += 14;

  const infoItems = [
    ['Employee Name', data.employeeName],   ['Employee ID', data.empId],
    ['Designation',   data.designation],     ['UAN Number',  data.uanNumber || 'N/A'],
    ['PAN Number',    data.panNumber || 'N/A'], ['Tax Regime', data.taxRegime === 'new' ? 'New Regime' : 'Old Regime'],
  ];
  doc.font('Helvetica').fillColor('#111');
  for (let i = 0; i < infoItems.length; i += 2) {
    const row = Math.floor(i / 2);
    const rowY = y + row * 18;
    doc.fontSize(8).fillColor('#888').text(infoItems[i][0], 44, rowY + 2);
    doc.fontSize(9).fillColor('#111').text(infoItems[i][1], 44, rowY + 10);
    if (infoItems[i + 1]) {
      doc.fontSize(8).fillColor('#888').text(infoItems[i + 1][0], 44 + W / 2, rowY + 2);
      doc.fontSize(9).fillColor('#111').text(infoItems[i + 1][1], 44 + W / 2, rowY + 10);
    }
  }
  y += 54;

  // Attendance strip
  doc.rect(40, y, W, 14).fill('#f5f7fc');
  doc.fontSize(8).font('Helvetica-Bold').fillColor('#555').text('ATTENDANCE', 44, y + 3);
  y += 14;
  const attCols = ['Working Days', 'Present', 'Leave', 'Absent', 'LOP Days'];
  const attVals = [data.workingDays, data.presentDays, data.leaveDays, data.absentDays, data.lopDays];
  const colW    = W / 5;
  attCols.forEach((label, i) => {
    doc.fontSize(7).font('Helvetica').fillColor('#888').text(label, 40 + i * colW, y + 2, { width: colW, align: 'center' });
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#111').text(String(attVals[i]), 40 + i * colW, y + 10, { width: colW, align: 'center' });
  });
  y += 30;

  // Earnings & Deductions side by side
  const halfW = W / 2 - 5;

  // Earnings header
  doc.rect(40, y, halfW, 14).fill('#1a3a6b');
  doc.fontSize(8).font('Helvetica-Bold').fillColor('#fff').text('EARNINGS', 44, y + 3);
  doc.rect(40 + halfW + 10, y, halfW, 14).fill('#7f1d1d');
  doc.fontSize(8).font('Helvetica-Bold').fillColor('#fff').text('EMPLOYEE DEDUCTIONS', 44 + halfW + 10, y + 3);
  y += 14;

  const earningsRows: [string, number][] = [
    ['Basic Salary',         data.basicSalary],
    ['HRA',                  data.hra],
    ['Conveyance Allowance', data.conveyanceAllowance],
    ['Meal Allowance',       data.mealAllowance],
    ['Special Allowance',    data.specialAllowance],
    ['Gross Earnings',       data.grossSalary],
    ['LOP Deduction',        -data.lopDeduction],
    ['Earned Salary',        data.earnedSalary],
  ];
  if (data.arrears !== 0) {
    const label = data.arrearsLabel ? `Salary Arrears (${data.arrearsLabel})` : 'Salary Arrears';
    earningsRows.push([label, data.arrears]);
  }
  const deductRows: [string, number | null][] = [
    ['EPF (12% of Basic)',   data.epfEmployee],
    ['ESIC (0.75%)',         data.esicApplicable ? data.esicEmployee : null],
    ['Labour Welfare Fund',  data.lwfEmployee],
    ['Professional Tax',     data.profTax],
    ['TDS (Income Tax)',     data.tdsDeduction],
    ['Advance Recovery',     data.advanceDeduction],
    ['Total Deductions',     data.epfEmployee + (data.esicApplicable ? data.esicEmployee : 0) + data.lwfEmployee + data.profTax + data.tdsDeduction + data.advanceDeduction],
  ];

  doc.font('Helvetica').fontSize(8).fillColor('#111');
  const rowH = 14;
  const maxRows = Math.max(earningsRows.length, deductRows.length);
  for (let i = 0; i < maxRows; i++) {
    const rowY = y + i * rowH;
    if (i % 2 === 0) {
      doc.rect(40, rowY, halfW, rowH).fill('#f9fafb');
      doc.rect(40 + halfW + 10, rowY, halfW, rowH).fill('#f9fafb');
    }
    if (earningsRows[i]) {
      const [label, val] = earningsRows[i];
      const isSpecial = label === 'Gross Earnings' || label === 'Earned Salary';
      doc.font(isSpecial ? 'Helvetica-Bold' : 'Helvetica').fillColor('#111').text(label, 44, rowY + 3);
      const valStr = val < 0 ? `- ${fmt(Math.abs(val))}` : fmt(val);
      doc.fillColor(val < 0 ? '#dc2626' : '#111').text(valStr, 40, rowY + 3, { width: halfW, align: 'right' });
    }
    if (deductRows[i]) {
      const [label, val] = deductRows[i];
      const isNull = val === null;
      const isTotal = label === 'Total Deductions';
      doc.font(isTotal ? 'Helvetica-Bold' : 'Helvetica').fillColor(isNull ? '#9ca3af' : '#111')
        .text(label, 44 + halfW + 10, rowY + 3);
      doc.fillColor(isNull ? '#9ca3af' : '#dc2626')
        .text(isNull ? 'N/A' : fmt(val as number), 40 + halfW + 10, rowY + 3, { width: halfW, align: 'right' });
    }
  }
  y += maxRows * rowH + 6;

  // Net pay bar
  doc.rect(40, y, W, 24).fill('#1a3a6b');
  doc.fontSize(11).font('Helvetica-Bold').fillColor('#fff').text('NET TAKE-HOME SALARY', 44, y + 6);
  doc.fontSize(13).text(fmt(data.netSalary), 40, y + 6, { width: W - 4, align: 'right' });
  y += 30;

  // Employer contributions
  doc.rect(40, y, W, 14).fill('#78350f');
  doc.fontSize(8).font('Helvetica-Bold').fillColor('#fff').text('EMPLOYER CONTRIBUTIONS (CTC COMPONENTS)', 44, y + 3);
  y += 14;
  const empRows: [string, number | null][] = [
    ['EPF Employer (3.67%)',    data.epfEmployer],
    ['EPS Employer (8.33%)',    data.epsEmployer],
    ['ESIC Employer (3.25%)',   data.esicApplicable ? data.esicEmployer : null],
    ['Labour Welfare Fund',     data.lwfEmployer],
    ['Gratuity Provision',      data.gratuityProvision],
    ['Total Employer Cost',     data.totalEmployerCost],
  ];
  doc.font('Helvetica').fontSize(8);
  empRows.forEach((row, i) => {
    const rowY = y + i * rowH;
    if (i % 2 === 0) doc.rect(40, rowY, W, rowH).fill('#fdf6ee');
    const [label, val] = row;
    const isNull  = val === null;
    const isTotal = label === 'Total Employer Cost';
    doc.font(isTotal ? 'Helvetica-Bold' : 'Helvetica').fillColor(isNull ? '#9ca3af' : '#111').text(label, 44, rowY + 3);
    doc.fillColor(isNull ? '#9ca3af' : '#92400e')
      .text(isNull ? 'N/A' : fmt(val as number), 40, rowY + 3, { width: W, align: 'right' });
  });
  y += empRows.length * rowH + 6;

  // CTC summary
  const cardW = W / 3 - 4;
  const cards = [
    { label: 'NET SALARY',    value: fmt(data.netSalary),         fill: '#f0fdf4', border: '#86efac', textColor: '#15803d' },
    { label: 'EMPLOYER COST', value: fmt(data.totalEmployerCost), fill: '#fff7ed', border: '#fed7aa', textColor: '#c2410c' },
    { label: 'TOTAL CTC',     value: fmt(data.totalCtc),          fill: '#eef2ff', border: '#a5b4fc', textColor: '#3730a3' },
  ];
  cards.forEach((card, i) => {
    const cx = 40 + i * (cardW + 6);
    doc.rect(cx, y, cardW, 36).fill(card.fill).stroke(card.border);
    doc.fontSize(7).font('Helvetica-Bold').fillColor(card.textColor).text(card.label, cx, y + 5, { width: cardW, align: 'center' });
    doc.fontSize(13).text(card.value, cx, y + 15, { width: cardW, align: 'center' });
  });
  y += 42;

  // Footer
  doc.moveTo(40, y).lineTo(40 + W, y).stroke('#e5e7eb');
  doc.fontSize(7).font('Helvetica').fillColor('#9ca3af')
    .text(`Computer-generated payslip. No signature required.  |  Queries: ${data.hrEmail}`, 40, y + 4, { align: 'center', width: W });

  doc.end();
}

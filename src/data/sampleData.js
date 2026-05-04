// Realistic sample data for BHSA Finance System demo
// Dates spread over ~6 months

export const sampleMembers = [
  { id: 'M001', name: 'Abdullah Karimi',  phone: '9876543210', joined_date: '2024-10-01', status: 'active' },
  { id: 'M002', name: 'Fathima Noor',     phone: '9845612345', joined_date: '2024-10-01', status: 'active' },
  { id: 'M003', name: 'Rashid Ansari',    phone: '9933221100', joined_date: '2024-10-15', status: 'active' },
  { id: 'M004', name: 'Zainab Hussain',   phone: '9765432109', joined_date: '2024-11-01', status: 'active' },
  { id: 'M005', name: 'Omar Farooq',      phone: '9654321098', joined_date: '2024-11-15', status: 'active' },
  { id: 'M006', name: 'Hana Malik',       phone: '9543210987', joined_date: '2024-12-01', status: 'active' },
  { id: 'M007', name: 'Bilal Chaudhary', phone: '9432109876', joined_date: '2025-01-05', status: 'inactive' },
];

export const sampleDeposits = [
  { id: 'D001', member_id: 'M001', amount: 20000, date: '2024-10-05', note: 'Initial deposit' },
  { id: 'D002', member_id: 'M002', amount: 15000, date: '2024-10-05', note: 'Initial deposit' },
  { id: 'D003', member_id: 'M003', amount: 25000, date: '2024-10-18', note: 'Initial deposit' },
  { id: 'D004', member_id: 'M004', amount: 10000, date: '2024-11-03', note: 'Initial deposit' },
  { id: 'D005', member_id: 'M005', amount: 18000, date: '2024-11-20', note: 'Initial deposit' },
  { id: 'D006', member_id: 'M006', amount: 12000, date: '2024-12-05', note: '' },
  { id: 'D007', member_id: 'M001', amount: 10000, date: '2025-01-10', note: 'Monthly top-up' },
  { id: 'D008', member_id: 'M003', amount: 5000,  date: '2025-01-15', note: 'Additional deposit' },
  { id: 'D009', member_id: 'M007', amount: 8000,  date: '2025-01-08', note: '' },
  { id: 'D010', member_id: 'M002', amount: 7000,  date: '2025-02-01', note: 'Monthly' },
  { id: 'D011', member_id: 'M004', amount: 5000,  date: '2025-02-15', note: '' },
  { id: 'D012', member_id: 'M005', amount: 10000, date: '2025-03-01', note: 'Top-up' },
];

export const sampleLoans = [
  { id: 'LOAN-0001', member_id: 'M002', amount: 12000, date: '2024-11-10', reason: 'Medical expenses', status: 'cleared' },
  { id: 'LOAN-0002', member_id: 'M003', amount: 20000, date: '2024-12-01', reason: 'Business purchase', status: 'partially_repaid' },
  { id: 'LOAN-0003', member_id: 'M001', amount: 8000,  date: '2024-12-20', reason: 'Home repair',       status: 'active' },
  { id: 'LOAN-0004', member_id: 'M004', amount: 6000,  date: '2025-01-12', reason: 'School fees',       status: 'cleared' },
  { id: 'LOAN-0005', member_id: 'M005', amount: 15000, date: '2025-01-25', reason: 'Vehicle repair',    status: 'partially_repaid' },
  { id: 'LOAN-0006', member_id: 'M002', amount: 9000,  date: '2025-02-10', reason: 'Emergency travel',  status: 'active' },
  { id: 'LOAN-0007', member_id: 'M006', amount: 10000, date: '2025-02-20', reason: 'Wedding expenses',  status: 'active' },
  { id: 'LOAN-0008', member_id: 'M001', amount: 5000,  date: '2025-03-05', reason: 'Grocery purchase',  status: 'active' },
];

export const sampleRepayments = [
  { id: 'R001', loan_id: 'LOAN-0001', member_id: 'M002', amount: 6000,  date: '2024-12-01', note: 'First instalment' },
  { id: 'R002', loan_id: 'LOAN-0001', member_id: 'M002', amount: 6000,  date: '2024-12-20', note: 'Final payment' },
  { id: 'R003', loan_id: 'LOAN-0002', member_id: 'M003', amount: 8000,  date: '2025-01-10', note: 'Partial repayment' },
  { id: 'R004', loan_id: 'LOAN-0004', member_id: 'M004', amount: 3000,  date: '2025-02-01', note: '' },
  { id: 'R005', loan_id: 'LOAN-0004', member_id: 'M004', amount: 3000,  date: '2025-02-20', note: 'Cleared' },
  { id: 'R006', loan_id: 'LOAN-0005', member_id: 'M005', amount: 5000,  date: '2025-02-15', note: 'Partial' },
  { id: 'R007', loan_id: 'LOAN-0005', member_id: 'M005', amount: 4000,  date: '2025-03-10', note: '' },
  { id: 'R008', loan_id: 'LOAN-0003', member_id: 'M001', amount: 2000,  date: '2025-03-15', note: '' },
];

export const initialData = {
  members:    sampleMembers,
  deposits:   sampleDeposits,
  loans:      sampleLoans,
  repayments: sampleRepayments,
};

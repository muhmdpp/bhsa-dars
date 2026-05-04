import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { StoreProvider } from './store/useStore';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import Members from './pages/Members';
import MemberLedger from './pages/MemberLedger';
import DepositEntry from './pages/DepositEntry';
import LoanEntry from './pages/LoanEntry';
import RepaymentEntry from './pages/RepaymentEntry';
import Reports from './pages/Reports';

export default function App() {
  return (
    <StoreProvider>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/members" element={<Members />} />
            <Route path="/members/:id" element={<MemberLedger />} />
            <Route path="/deposit" element={<DepositEntry />} />
            <Route path="/loan" element={<LoanEntry />} />
            <Route path="/repayment" element={<RepaymentEntry />} />
            <Route path="/reports" element={<Reports />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </StoreProvider>
  );
}

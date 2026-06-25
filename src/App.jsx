import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { StoreProvider } from './store/useStore';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/layout/Layout';
import LoginPage from './pages/LoginPage';
import PinLockScreen from './pages/PinLockScreen';
import MemberPortal from './pages/MemberPortal';
import Dashboard from './pages/Dashboard';
import Members from './pages/Members';
import MemberLedger from './pages/MemberLedger';
import DepositEntry from './pages/DepositEntry';
import WithdrawalEntry from './pages/WithdrawalEntry';
import LoanEntry from './pages/LoanEntry';
import RepaymentEntry from './pages/RepaymentEntry';
import Reports from './pages/Reports';
import Transactions from './pages/Transactions';
import BroadcastDeposit from './pages/BroadcastDeposit';
import Settings from './pages/Settings';

function AppInner() {
  const { loggedIn, pinLocked, pinReady, memberSession } = useAuth();

  if (!pinReady) return null; // brief init

  // Member portal session takes priority over admin flow
  if (memberSession) return <MemberPortal />;

  if (!loggedIn)  return <LoginPage />;
  if (pinLocked)  return <PinLockScreen />;

  return (
    <StoreProvider>
      <Layout>
        <Routes>
          <Route path="/"                    element={<Dashboard />} />
          <Route path="/members"             element={<Members />} />
          <Route path="/members/:id"         element={<MemberLedger />} />
          <Route path="/deposit"             element={<DepositEntry />} />
          <Route path="/withdrawal"           element={<WithdrawalEntry />} />
          <Route path="/broadcast-deposit"   element={<BroadcastDeposit />} />
          <Route path="/loan"                element={<LoanEntry />} />
          <Route path="/repayment"           element={<RepaymentEntry />} />
          <Route path="/transactions"        element={<Transactions />} />
          <Route path="/reports"             element={<Reports />} />
          <Route path="/settings"            element={<Settings />} />
        </Routes>
      </Layout>
    </StoreProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppInner />
      </BrowserRouter>
    </AuthProvider>
  );
}

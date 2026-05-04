import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import { useStore } from '../../store/useStore';

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-slate-300 border-t-slate-800 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm font-medium text-slate-600">Loading BHSA Finance…</p>
      </div>
    </div>
  );
}

function ErrorScreen({ message }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="card p-8 max-w-md w-full text-center">
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-slate-900 mb-2">Failed to load data</h2>
        <p className="text-sm text-slate-500 mb-1">Could not connect to Supabase.</p>
        <p className="text-xs text-red-600 bg-red-50 rounded p-2 mt-3 text-left font-mono break-all">{message}</p>
        <p className="text-xs text-slate-400 mt-4">Check your .env.local and Supabase project settings.</p>
        <button
          className="btn-primary mt-4 w-full"
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    </div>
  );
}

export default function Layout({ children }) {
  const { state } = useStore();

  if (state.loading) return <LoadingScreen />;
  if (state.error)   return <ErrorScreen message={state.error} />;

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />
      <MobileNav />

      {/* Main content */}
      <main className="md:ml-60 pb-20 md:pb-0 min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          {children}
        </div>
      </main>
    </div>
  );
}

import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Scanner from './pages/Scanner';
import Inventory from './pages/Inventory';
import Locations from './pages/Locations';
import Transfers from './pages/Transfers';
import InventoryLog from './pages/InventoryLog';
import Settings from './pages/Settings';
import Catalog from './pages/Catalog';
import PurchaseOrders from './pages/PurchaseOrders';
import Reports from './pages/Reports';
import Login from './pages/Login';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();
  const location = useLocation();

  if (location.pathname.toLowerCase() === '/login') {
    return <Login />;
  }

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/Dashboard" replace />} />
      <Route element={<Layout />}>
        <Route path="/Dashboard" element={<Dashboard />} />
        <Route path="/Scanner" element={<Scanner />} />
        <Route path="/Inventory" element={<Inventory />} />
        <Route path="/Locations" element={<Locations />} />
        <Route path="/Transfers" element={<Transfers />} />
        <Route path="/InventoryLog" element={<InventoryLog />} />
        <Route path="/Settings" element={<Settings />} />
        <Route path="/Catalog" element={<Catalog />} />
        <Route path="/PurchaseOrders" element={<PurchaseOrders />} />
        <Route path="/Reports" element={<Reports />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App

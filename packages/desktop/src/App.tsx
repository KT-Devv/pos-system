import { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import Layout from '@/layouts/Layout';
import Dashboard from '@/pages/Dashboard';
import Sales from '@/pages/Sales';
import Products from '@/pages/Products';
import Inventory from '@/pages/Inventory';
import Customers from '@/pages/Customers';
import Reports from '@/pages/Reports';
import Settings from '@/pages/Settings';
import Login from '@/pages/Login';
import SetupWizard from '@/components/SetupWizard';
import { api } from '@/lib/ipc';

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );
}

function SetupGate({ children }: { children: React.ReactNode }) {
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      try {
        if (typeof window === 'undefined' || !window.electronAPI) {
          setNeedsSetup(false);
          return;
        }
        const complete = await api.settings.isSetupComplete();
        setNeedsSetup(!complete);
      } catch {
        setNeedsSetup(false);
      }
    })();
  }, []);

  if (needsSetup === null) return <LoadingScreen />;
  if (needsSetup) return <SetupWizard onComplete={() => setNeedsSetup(false)} />;
  return <>{children}</>;
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { isAdmin, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function LoginGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <SetupGate>
      <AuthProvider>
        <HashRouter>
          <Routes>
            <Route path="/login" element={<LoginGuard><Login /></LoginGuard>} />
            <Route element={<AuthGuard><Layout /></AuthGuard>}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/sales" element={<Sales />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/products" element={<AdminGuard><Products /></AdminGuard>} />
              <Route path="/inventory" element={<AdminGuard><Inventory /></AdminGuard>} />
              <Route path="/reports" element={<AdminGuard><Reports /></AdminGuard>} />
              <Route path="/settings" element={<AdminGuard><Settings /></AdminGuard>} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </HashRouter>
      </AuthProvider>
    </SetupGate>
  );
}

import { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { api } from './lib/ipc';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './layouts/Layout';
import Dashboard from './pages/Dashboard';
import Sales from './pages/Sales';
import Products from './pages/Products';
import Inventory from './pages/Inventory';
import Customers from './pages/Customers';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Login from './pages/Login';
import SetupWizard from './components/SetupWizard';

function AppContent() {
  const { user, isAdmin } = useAuth();

  if (!user) {
    return <Login />;
  }

  const AdminRoute = ({ children }: { children: React.ReactNode }) => (
    isAdmin ? <>{children}</> : <Navigate to="/" replace />
  );

  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/sales" element={<Sales />} />
          <Route path="/products" element={<AdminRoute><Products /></AdminRoute>} />
          <Route path="/inventory" element={<AdminRoute><Inventory /></AdminRoute>} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/reports" element={<AdminRoute><Reports /></AdminRoute>} />
          <Route path="/settings" element={<AdminRoute><Settings /></AdminRoute>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}

export default function App() {
  const [setupComplete, setSetupComplete] = useState<boolean | null>(null);

  useEffect(() => {
    checkSetup();
  }, []);

  const checkSetup = async () => {
    try {
      const complete = await api.settings.isSetupComplete();
      setSetupComplete(complete);
    } catch {
      setSetupComplete(false);
    }
  };

  if (setupComplete === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading POS System...</p>
        </div>
      </div>
    );
  }

  if (!setupComplete) {
    return <SetupWizard onComplete={() => setSetupComplete(true)} />;
  }

  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

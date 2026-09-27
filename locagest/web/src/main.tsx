import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import './index.css';
import { AuthProvider, useAuth } from './lib/auth';
import { Layout } from './components/Layout';
import { Loading } from './components/ui';
import { Login, Register } from './pages/Auth';
import { Dashboard } from './pages/Dashboard';
import { Properties, PropertyDetail, PropertyForm } from './pages/Properties';
import { TenantDetail, TenantForm, Tenants } from './pages/Tenants';
import { LeaseDetail, LeaseForm, Leases } from './pages/Leases';
import { AlertsHistory } from './pages/Alerts';
import { Admin } from './pages/Admin';
import { Portal } from './pages/Portal';
import { Account } from './pages/Account';

function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) {
    return (
      <Routes>
        <Route path="/inscription" element={<Register />} />
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }
  return (
    <Routes>
      <Route element={<Layout />}>
        {user.role === 'bailleur' && (
          <>
            <Route index element={<Dashboard />} />
            <Route path="proprietes" element={<Properties />} />
            <Route path="proprietes/nouvelle" element={<PropertyForm />} />
            <Route path="proprietes/:id" element={<PropertyDetail />} />
            <Route path="proprietes/:id/modifier" element={<PropertyForm />} />
            <Route path="locataires" element={<Tenants />} />
            <Route path="locataires/nouveau" element={<TenantForm />} />
            <Route path="locataires/:id" element={<TenantDetail />} />
            <Route path="locataires/:id/modifier" element={<TenantForm />} />
            <Route path="baux" element={<Leases />} />
            <Route path="baux/nouveau" element={<LeaseForm />} />
            <Route path="baux/:id" element={<LeaseDetail />} />
            <Route path="baux/:id/modifier" element={<LeaseForm />} />
            <Route path="alertes" element={<AlertsHistory />} />
          </>
        )}
        {user.role === 'admin' && (
          <>
            <Route index element={<Admin />} />
            <Route path="alertes" element={<AlertsHistory />} />
          </>
        )}
        {user.role === 'locataire' && <Route index element={<Portal />} />}
        <Route path="compte" element={<Account />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);

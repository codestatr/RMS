import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Properties from './pages/Properties';
import Bookings from './pages/Bookings';
import Payments from './pages/Payments';
import Shifts from './pages/Shifts';
import Staff from './pages/Staff';
import Customers from './pages/Customers';
import SyncStatus from './pages/SyncStatus';
import Settings from './pages/Settings';
import Login from './pages/Login';
import Reports from './pages/Reports';
import Reviews from './pages/Reviews';
import Hospitality from './pages/Hospitality';
import CalendarView from './pages/CalendarView';
import Maintenance from './pages/Maintenance';
import CashierTerminal from './pages/CashierTerminal';
import AuditLogs from './pages/AuditLogs';
import EndOfDay from './pages/EndOfDay';
import CashierTransactions from './pages/cashier/CashierTransactions';
import '../styles/app.css';
import '../styles/dashboard.css';
import '../styles/bookings.css';
import '../styles/payments.css';
import '../styles/properties.css';
import '../styles/property-form.css';
import '../styles/recent-bookings.css';
import '../styles/revenue-chart.css';
import '../styles/shifts.css';
import '../styles/calendar.css';
import '../styles/maintenance.css';
import '../styles/cashier-transactions.css';
import '../styles/cashier-shifts.css';
import '../styles/kpi-card.css';

/**
 * Main Admin Client App Component
 * Electron desktop app for comprehensive property & booking management
 */
export default function App() {
  const [user, setUser] = useState(null);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [syncStatus, setSyncStatus] = useState('idle');
  const [lastSyncTime, setLastSyncTime] = useState(new Date().toLocaleTimeString());

  const logout = () => {
    localStorage.removeItem('rms_admin_token');
    localStorage.removeItem('rms_admin_user');
    sessionStorage.removeItem('rms_admin_token');
    sessionStorage.removeItem('rms_admin_user');
    setUser(null);
    setCurrentPage('dashboard');
  };

  useEffect(() => {
    localStorage.removeItem('rms_admin_token');
    localStorage.removeItem('rms_admin_user');
    sessionStorage.removeItem('rms_admin_token');
    sessionStorage.removeItem('rms_admin_user');
    setUser(null);
    setCurrentPage('dashboard');
  }, []);

  // Listen for sync status updates from Electron main process
  useEffect(() => {
    const handleSyncStart = () => setSyncStatus('syncing');
    const handleSyncComplete = () => {
      setSyncStatus('synced');
      setLastSyncTime(new Date().toLocaleTimeString());
      setTimeout(() => setSyncStatus('idle'), 3000);
    };
    const handleSyncError = () => {
      setSyncStatus('error');
      setTimeout(() => setSyncStatus('idle'), 5000);
    };

    if (window.ipcRenderer) {
      window.ipcRenderer.on('sync:start', handleSyncStart);
      window.ipcRenderer.on('sync:complete', handleSyncComplete);
      window.ipcRenderer.on('sync:error', handleSyncError);
    }

    return () => {
      if (window.ipcRenderer) {
        window.ipcRenderer.removeListener('sync:start', handleSyncStart);
        window.ipcRenderer.removeListener('sync:complete', handleSyncComplete);
        window.ipcRenderer.removeListener('sync:error', handleSyncError);
      }
    };
  }, []);

  useEffect(() => {
    if (!user || !window.ipcRenderer) return undefined;

    const sync = () => {
      const token = localStorage.getItem('rms_admin_token') || sessionStorage.getItem('rms_admin_token');
      if (token) window.ipcRenderer.invoke('sync:start', { token }).catch(() => {});
    };

    sync();
    const interval = setInterval(sync, 10000);
    return () => clearInterval(interval);
  }, [user]);

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  // Render page based on current selection
  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard user={user} userRole={user?.role} onNavigate={setCurrentPage} />;
      case 'cashier_terminal':
        return <CashierTerminal isAdmin={user?.role === 'admin'} onSwitchToAdmin={() => setCurrentPage('dashboard')} onLogout={logout} initialTab="walkin" />;
      case 'frontdesk':
        return <CashierTerminal isAdmin={user?.role === 'admin'} onSwitchToAdmin={() => setCurrentPage('dashboard')} onLogout={logout} initialTab="frontdesk" />;
      case 'cashier_shifts':
        return <Shifts />;
      case 'cashier_txs':
        return <CashierTransactions />;
      case 'properties':
        return <Properties />;
      case 'bookings':
        return <Bookings />;
      case 'payments':
        return <Payments />;
      case 'shifts':
        return <Shifts />;
      case 'staff':
        return <Staff />;
      case 'customers':
        return <Customers />;
      case 'sync':
        return <SyncStatus lastSync={lastSyncTime} />;
      case 'settings':
        return <Settings />;
      case 'reports':
        return <Reports />;
      case 'reviews':
        return <Reviews />;
      case 'hospitality':
        return <Hospitality />;
      case 'maintenance':
        return <Maintenance />;
      case 'calendar':
        return <CalendarView />;
      case 'audit':
        return <AuditLogs />;
      case 'end_of_day':
        return <EndOfDay />;
      default:
        return <Dashboard user={user} userRole={user?.role} onNavigate={setCurrentPage} />;
    }
  };

  const getPageTitle = () => {
    const titles = {
      dashboard: 'Executive Dashboard & Overview',
      cashier_terminal: 'Cashier POS Desk',
      frontdesk: 'Front-Desk Check-In / Out Desk',
      cashier_shifts: 'Cashier Shift & Cash Float',
      cashier_txs: 'Cashier Receipts History',
      properties: 'Property Listing Management (CRUD)',
      bookings: 'Booking Operations & Approvals',
      payments: 'Payment Monitoring & Reconciliation',
      shifts: 'Front-Desk Cashier Shifts',
      staff: 'Staff & Role Permissions',
      customers: 'Customer Accounts & Verification',
      sync: 'Offline SQLite Sync Hub',
      settings: 'System & Tax Settings',
      reports: 'Reports & Analytics',
      reviews: 'Review Moderation',
      hospitality: 'Guest Services & Hospitality Approvals',
      maintenance: 'Housekeeping & Unit Readiness',
      calendar: 'Availability Matrix & Calendar',
      audit: 'Activity Audit Trail',
      end_of_day: 'End-of-Day Summary',
    };
    return titles[currentPage] || 'Admin Portal';
  };

  return (
    <div className="app-container">
      <Sidebar
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        syncStatus={syncStatus}
        user={user}
        userRole={user.role}
        onLogout={logout}
      />

      <main className="main-content">
        <header className="page-header">
          <h1 className="page-title">{getPageTitle()}</h1>
          <div className="sync-indicator" title={`Last synchronized at: ${lastSyncTime}`}>
            <span className={`status-dot ${syncStatus}`}></span>
            <span>
              {syncStatus === 'syncing' && 'Sync in Progress...'}
              {syncStatus === 'synced' && 'Synced with MySQL'}
              {syncStatus === 'error' && 'Sync Error (Offline Mode)'}
              {syncStatus === 'idle' && `Last Sync: ${lastSyncTime}`}
            </span>
          </div>
        </header>

        <div className="page-content">{renderPage()}</div>
      </main>
    </div>
  );
}

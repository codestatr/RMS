import React, { lazy, Suspense, useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Properties = lazy(() => import('./pages/Properties'));
const Bookings = lazy(() => import('./pages/Bookings'));
const Payments = lazy(() => import('./pages/Payments'));
const Shifts = lazy(() => import('./pages/Shifts'));
const Staff = lazy(() => import('./pages/Staff'));
const Customers = lazy(() => import('./pages/Customers'));
const SyncStatus = lazy(() => import('./pages/SyncStatus'));
const Settings = lazy(() => import('./pages/Settings'));
const Login = lazy(() => import('./pages/Login'));
const Reports = lazy(() => import('./pages/Reports'));
const Reviews = lazy(() => import('./pages/Reviews'));
const Hospitality = lazy(() => import('./pages/Hospitality'));
const CalendarView = lazy(() => import('./pages/CalendarView'));
const Maintenance = lazy(() => import('./pages/Maintenance'));
const CashierTerminal = lazy(() => import('./pages/CashierTerminal'));
const AuditLogs = lazy(() => import('./pages/AuditLogs'));
const EndOfDay = lazy(() => import('./pages/EndOfDay'));
const CashierTransactions = lazy(() => import('./pages/cashier/CashierTransactions'));
const OwnerPortal = lazy(() => import('./pages/OwnerPortal'));
const HousekeepingPortal = lazy(() => import('./pages/HousekeepingPortal'));
const CateringPortal = lazy(() => import('./pages/CateringPortal'));
import IdleTimeoutModal from './components/IdleTimeoutModal';
import { useIdleTimer } from './hooks/useIdleTimer';
const MyProfile = lazy(() => import('./pages/MyProfile'));
import ProfileMenu from './components/ProfileMenu';
import NotificationsBell from './components/NotificationsBell';
import LiveClock from './components/LiveClock';
import { applyBrandColor } from './utils/brandTheme';
import { getBranding, saveBranding } from './utils/branding';
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
import '../styles/housekeeping-portal.css';
import '../styles/cashier-transactions.css';
import '../styles/reports.css';
import '../styles/end-of-day.css';
import '../styles/cashier-shifts.css';
import '../styles/kpi-card.css';
import '../styles/user-action-buttons.css';
import '../styles/pos-buttons.css';
import '../styles/admin-topbar.css';
import '../styles/catering-portal.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Apply the cached brand before React paints, then refresh it from shared settings.
applyBrandColor(getBranding().brandColor);

/**
 * Main Admin Client App Component
 * Electron desktop app for comprehensive property & booking management
 */
export default function App() {
  const [user, setUser] = useState(() => {
    // Authentication is per app launch. Remove tokens left by the previous
    // Electron session so restarting the app always returns to the login page.
    localStorage.removeItem('rms_admin_token');
    localStorage.removeItem('rms_admin_user');
    sessionStorage.removeItem('rms_admin_token');
    sessionStorage.removeItem('rms_admin_user');
    return null;
  });
  const getHomePage = (role) => role === 'property_owner' ? 'owner_portal' : role === 'housekeeping' ? 'housekeeping_portal' : role === 'catering' ? 'catering_portal' : 'dashboard';
  const [currentPage, setCurrentPage] = useState(() => getHomePage(user?.role));
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [syncStatus, setSyncStatus] = useState('idle');
  const [syncError, setSyncError] = useState('');
  const [lastSyncTime, setLastSyncTime] = useState('Not synced yet');

  const logout = useCallback(() => {
    localStorage.removeItem('rms_admin_token');
    localStorage.removeItem('rms_admin_user');
    sessionStorage.removeItem('rms_admin_token');
    sessionStorage.removeItem('rms_admin_user');
    setUser(null);
  }, []);

  const updateSignedInUser = (updatedUser) => {
    setUser(updatedUser);
    localStorage.setItem('rms_admin_user', JSON.stringify(updatedUser));
    sessionStorage.setItem('rms_admin_user', JSON.stringify(updatedUser));
  };

  const { isWarning, remainingSeconds, resetTimer } = useIdleTimer({
    timeout: 5 * 60 * 1000,
    warningTime: 30 * 1000,
    onTimeout: logout,
    enabled: Boolean(user),
  });

  useEffect(() => {
    let active = true;
    const refreshBranding = async () => {
      try {
        const response = await fetch(`${API_URL}/settings/branding`);
        if (!response.ok) throw new Error('Brand settings are unavailable');
        const shared = (await response.json())?.data || {};
        if (!active) return;

        const current = getBranding();
        const next = saveBranding({
          name: shared.brandName || current.name,
          logo: typeof shared.logo === 'string' ? shared.logo : current.logo,
          phone: typeof shared.phone === 'string' ? shared.phone : current.phone,
          email: typeof shared.email === 'string' ? shared.email : current.email,
          brandColor: shared.brandColor || current.brandColor,
        });
        applyBrandColor(next.brandColor);
      } catch {
        if (active) applyBrandColor(getBranding().brandColor);
      }
    };

    refreshBranding();
    return () => {
      active = false;
    };
  }, []);

  // Listen for sync status updates from Electron main process
  useEffect(() => {
    const handleSyncStart = () => { setSyncError(''); setSyncStatus('syncing'); };
    const handleSyncComplete = (syncTime) => {
      setSyncError('');
      setSyncStatus('synced');
      setLastSyncTime(syncTime ? new Date(syncTime).toLocaleTimeString() : new Date().toLocaleTimeString());
      setTimeout(() => setSyncStatus('idle'), 3000);
    };
    const handleSyncError = (message) => {
      setSyncError(message || 'Sync request failed');
      setSyncStatus('error');
    };

    if (window.ipcRenderer) {
      window.ipcRenderer.on('sync:start', handleSyncStart);
      window.ipcRenderer.on('sync:complete', handleSyncComplete);
      window.ipcRenderer.on('sync:error', handleSyncError);
      window.ipcRenderer.invoke('sync:status').then((status) => {
        if (status?.lastSync) setLastSyncTime(new Date(status.lastSync).toLocaleTimeString());
      }).catch(() => {});
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
    if (!['admin', 'cashier'].includes(user.role)) {
      setSyncStatus('idle');
      setSyncError('');
      return undefined;
    }

    const sync = () => {
      const token = localStorage.getItem('rms_admin_token');
      if (token) window.ipcRenderer.invoke('sync:start', { token }).catch(() => {});
    };

    const initialSync = setTimeout(sync, 8000);
    const interval = setInterval(sync, 5 * 60 * 1000);
    return () => { clearTimeout(initialSync); clearInterval(interval); };
  }, [user]);

  if (!user) {
    return <Suspense fallback={<div className="page-loading" role="status">Loading…</div>}><Login onLogin={(authUser) => { setUser(authUser); setCurrentPage(getHomePage(authUser.role)); }} /></Suspense>;
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
        return <Bookings onNewBooking={() => setCurrentPage('cashier_terminal')} />;
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
      case 'owner_portal':
        return <OwnerPortal user={user} onUserUpdate={setUser} />;
      case 'housekeeping_portal':
        return <HousekeepingPortal user={user} view="overview" />;
      case 'housekeeping_tasks':
        return <HousekeepingPortal user={user} view="tasks" />;
      case 'housekeeping_rooms':
        return <HousekeepingPortal user={user} view="rooms" />;
      case 'housekeeping_guest_requests':
        return <HousekeepingPortal user={user} view="guest_requests" />;
      case 'housekeeping_history':
        return <HousekeepingPortal user={user} view="history" />;
      case 'catering_portal':
        return <CateringPortal view="overview" />;
      case 'catering_orders':
        return <CateringPortal view="orders" />;
      case 'catering_walkins':
        return <CateringPortal view="walkins" />;
      case 'catering_kitchen':
        return <CateringPortal view="kitchen" />;
      case 'catering_menu':
        return <CateringPortal view="menu" />;
      case 'catering_history':
        return <CateringPortal view="history" />;
      case 'my_profile':
        return <MyProfile user={user} onUserUpdate={updateSignedInUser} />;
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
      owner_portal: 'Owner Portal',
      housekeeping_portal: 'Housekeeping Overview',
      housekeeping_tasks: 'Housekeeping Task Queue',
      housekeeping_rooms: 'Room Readiness',
      housekeeping_guest_requests: 'Guest Laundry & Cleaning',
      housekeeping_history: 'Completed Housekeeping Work',
      catering_portal: 'Catering Overview',
      catering_orders: 'Catering Order Requests',
        catering_walkins: 'Catering Walk-In Orders',
      catering_kitchen: 'Catering Kitchen Queue',
      catering_menu: 'Catering Menu & Availability',
      catering_history: 'Catering Order History',
      my_profile: 'My Profile',
    };
    if (user?.role === 'cashier' && currentPage === 'dashboard') return 'My Cashier Performance';
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
          <LiveClock />
          <div className={`sync-indicator sync-${syncStatus}`} title={syncError ? `Sync failed: ${syncError}` : `Last synchronized at: ${lastSyncTime}`}>
            <span className={`status-dot ${syncStatus}`}></span>
            <span>
              {syncStatus === 'syncing' && 'Sync in Progress...'}
              {syncStatus === 'synced' && 'Synced with MySQL'}
              {syncStatus === 'error' && (syncError ? `Sync failed: ${syncError}` : 'Sync Error (Offline Mode)')}
              {syncStatus === 'idle' && `Last Sync: ${lastSyncTime}`}
            </span>
          </div>
          <div className="page-header-actions">
            <NotificationsBell compact />
            <ProfileMenu user={user} onEditProfile={() => setCurrentPage('my_profile')} onLogout={logout} />
          </div>
        </header>

        <div className="page-content"><Suspense fallback={<div className="page-loading" role="status">Loading page…</div>}>{renderPage()}</Suspense></div>
      </main>
      <IdleTimeoutModal
        isOpen={isWarning && Boolean(user)}
        remainingSeconds={remainingSeconds}
        onExtend={resetTimer}
        onLogout={logout}
      />
    </div>
  );
}

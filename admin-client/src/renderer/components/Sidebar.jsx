import React from 'react';
import {
  FaHome,
  FaBuilding,
  FaCalendarAlt,
  FaCreditCard,
  FaClock,
  FaUsers,
  FaUserFriends,
  FaSync,
  FaSlidersH,
  FaChevronLeft,
  FaChevronRight,
  FaCashRegister,
  FaKey,
  FaReceipt,
  FaSignOutAlt,
  FaChartBar,
  FaBroom,
  FaStar,
  FaCalendarCheck,
  FaClipboardList,
  FaSun,
  FaPlane,
} from 'react-icons/fa';
import { getBranding } from '../utils/branding';
import NotificationsBell from './NotificationsBell';

export default function Sidebar({
  currentPage,
  onPageChange,
  collapsed,
  onToggleCollapse,
  syncStatus,
  userRole = 'admin',
  onLogout,
}) {
  const isCashier = userRole === 'cashier';
  const branding = getBranding();

  const adminSections = [
    {
      title: 'OVERVIEW & POS',
      items: [
        { id: 'dashboard', label: 'Dashboard & Analytics', icon: FaHome },
        { id: 'cashier_terminal', label: 'Cashier POS Desk', icon: FaCashRegister, badge: 'Live' },
        { id: 'calendar', label: 'Availability Calendar', icon: FaCalendarCheck },
      ],
    },
    {
      title: 'RENTALS & OPERATIONS',
      items: [
        { id: 'properties', label: 'Property Listings', icon: FaBuilding },
        { id: 'bookings', label: 'Bookings & Stays', icon: FaCalendarAlt },
        { id: 'maintenance', label: 'Housekeeping & Units', icon: FaBroom },
        { id: 'hospitality', label: 'Guest Services Desk', icon: FaPlane },
        { id: 'reviews', label: 'Guest Reviews', icon: FaStar },
      ],
    },
    {
      title: 'FINANCE & AUDITS',
      items: [
        { id: 'payments', label: 'Payments & Revenue', icon: FaCreditCard },
        { id: 'shifts', label: 'Cashier Shifts', icon: FaClock },
        { id: 'reports', label: 'Analytics Reports', icon: FaChartBar },
        { id: 'end_of_day', label: 'End-of-Day Summary', icon: FaSun },
      ],
    },
    {
      title: 'SYSTEM & PEOPLE',
      items: [
        { id: 'staff', label: 'Staff & Roles', icon: FaUsers },
        { id: 'customers', label: 'Customer Directory', icon: FaUserFriends },
        { id: 'sync', label: 'Sync Hub', icon: FaSync },
        { id: 'settings', label: 'System Settings', icon: FaSlidersH },
        { id: 'audit', label: 'Activity Audit Trail', icon: FaClipboardList },
      ],
    },
  ];

  const cashierSections = [
    {
      title: 'FRONT-DESK POS',
      items: [
        { id: 'cashier_terminal', label: 'Walk-In POS Desk', icon: FaCashRegister, badge: 'POS' },
        { id: 'frontdesk', label: 'Check-In / Out Desk', icon: FaKey },
        { id: 'calendar', label: 'Unit Calendar', icon: FaCalendarCheck },
      ],
    },
    {
      title: 'OPERATIONS & CASH',
      items: [
        { id: 'maintenance', label: 'Room Cleanliness Status', icon: FaBroom },
        { id: 'hospitality', label: 'Guest Services Requests', icon: FaPlane },
        { id: 'cashier_shifts', label: 'Shift & Cash Float', icon: FaClock },
        { id: 'cashier_txs', label: 'Shift Receipts History', icon: FaReceipt },
        { id: 'end_of_day', label: 'End-of-Day Summary', icon: FaSun },
        { id: 'sync', label: 'Offline Sync Status', icon: FaSync },
      ],
    },
  ];

  const sections = isCashier ? cashierSections : adminSections;

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      {/* Brand Header */}
      <div className="sidebar-header">
        <div className="brand">
          {branding.logo ? <img className="brand-logo" src={branding.logo} alt={`${branding.name} logo`} /> : <div className="brand-icon"><FaHome size={18} /></div>}
          {!collapsed && (
            <div>
              <span className="brand-name">
                {branding.name}
              </span>
              <span className="brand-role">
                {isCashier ? 'Front-Desk Node' : 'Management Hub'}
              </span>
            </div>
          )}
        </div>
        <button
          className="text-neutral-400 hover:text-neutral-700 p-1.5 rounded-lg hover:bg-neutral-100 transition"
          onClick={onToggleCollapse}
          title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {collapsed ? <FaChevronRight size={13} /> : <FaChevronLeft size={13} />}
        </button>
      </div>

      {/* Categorized Navigation Links */}
      <nav className="sidebar-menu">
        {sections.map((sec, idx) => (
          <div key={idx} className="space-y-1 mb-2">
            {!collapsed && sec.title && (
              <div className="sidebar-section-title">{sec.title}</div>
            )}
            {sec.items.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  className={`nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => onPageChange(item.id)}
                  title={collapsed ? item.label : ''}
                >
                  <Icon size={16} className="flex-shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                  {!collapsed && item.badge && (
                    <span className="nav-badge">{item.badge}</span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Communication & Footer */}
      <div className="sidebar-footer space-y-2">
        <div className="sidebar-communication-block">
          {!collapsed && <div className="sidebar-section-title">COMMUNICATION</div>}
          <NotificationsBell compact={collapsed} />
        </div>

        <div className="sync-indicator w-full justify-center">
          <span className={`status-dot ${syncStatus}`}></span>
          {!collapsed && (
            <span className="capitalize text-[11px]">
              {syncStatus === 'syncing' ? 'Syncing...' : 'SQLite Node Online'}
            </span>
          )}
        </div>

        {onLogout && (
          <button
            onClick={onLogout}
            className="sidebar-signout"
            title="Sign Out"
          >
            <FaSignOutAlt size={14} />
            {!collapsed && <span>Sign Out</span>}
          </button>
        )}
      </div>
    </aside>
  );
}

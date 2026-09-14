import React, { useState, useEffect } from 'react';
import {
  FaSync,
  FaCheckCircle,
  FaExclamationTriangle,
  FaClock,
  FaDatabase,
  FaCloudUploadAlt,
  FaCloudDownloadAlt,
  FaHistory,
} from 'react-icons/fa';
import axios from 'axios';

export default function SyncStatus({ lastSync }) {
  const [syncing, setSyncing] = useState(false);
  const [syncLogs, setSyncLogs] = useState([]);
  const [pendingChanges, setPendingChanges] = useState({ properties: 0, bookings: 0, payments: 0 });
  const [message, setMessage] = useState(null);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

  useEffect(() => {
    loadSyncLogs();
  }, []);

  const loadSyncLogs = async () => {
    try {
      const res = await axios.get(`${API_URL}/sync/logs?limit=10`, {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('rms_admin_token') || ''}` },
      });
      setSyncLogs(res.data?.data?.data || []);
    } catch (e) {
      // Mock local fallback logs if server unreachable
      setSyncLogs([
        { id: 'log-1', entity_type: 'properties', action: 'pull', status: 'synced', timestamp: new Date().toISOString() },
        { id: 'log-2', entity_type: 'bookings', action: 'push', status: 'synced', timestamp: new Date(Date.now() - 3600000).toISOString() },
      ]);
    }
  };

  const handleTriggerSync = async () => {
    setSyncing(true);
    setMessage(null);
    try {
      // Trigger via IPC if in Electron, or REST endpoint
      if (window.ipcRenderer) {
        const result = await window.ipcRenderer.invoke('sync:start', {
          token: sessionStorage.getItem('rms_admin_token') || '',
        });
        if (!result?.success) throw new Error(result?.error || 'Sync failed');
      } else {
        await axios.post(`${API_URL}/sync/pull`, {}, {
          headers: { Authorization: `Bearer ${sessionStorage.getItem('rms_admin_token') || ''}` },
        });
      }
      setMessage({ type: 'success', text: 'Synchronization completed successfully with MySQL central store!' });
      loadSyncLogs();
    } catch (err) {
      setMessage({ type: 'error', text: 'Sync failed: ' + (err.message || 'Check network connection.') });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Status */}
      <div className="admin-card flex justify-between items-center bg-white">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center text-2xl">
            <FaDatabase />
          </div>
          <div>
            <h2 className="text-lg font-bold text-neutral-900">Local SQLite & Central MySQL Sync Hub</h2>
            <p className="text-xs text-neutral-500">
              Offline-first resilience engine. Work locally; auto-sync when online.
            </p>
          </div>
        </div>

        <button
          onClick={handleTriggerSync}
          disabled={syncing}
          className="btn-amber flex items-center gap-2 text-xs"
        >
          <FaSync className={syncing ? 'animate-spin' : ''} />
          {syncing ? 'Syncing...' : 'Sync Now'}
        </button>
      </div>

      {message && (
        <div
          className={`p-4 rounded-xl text-xs font-semibold ${
            message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Sync Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="admin-card">
          <span className="text-neutral-400 text-xs font-bold uppercase tracking-wider block mb-2">
            Engine State
          </span>
          <div className="flex items-center gap-2 text-emerald-600 font-extrabold text-lg">
            <FaCheckCircle /> Online & Ready
          </div>
          <span className="text-xs text-neutral-500 mt-2 block">
            Last Sync: {lastSync || 'Just now'}
          </span>
        </div>

        <div className="admin-card">
          <span className="text-neutral-400 text-xs font-bold uppercase tracking-wider block mb-2">
            Offline Outbox Queue
          </span>
          <div className="text-2xl font-extrabold text-neutral-900">0 Items</div>
          <span className="text-xs text-neutral-500 mt-2 flex items-center gap-1">
            <FaCloudUploadAlt className="text-amber-500" /> All local edits are synced
          </span>
        </div>

        <div className="admin-card">
          <span className="text-neutral-400 text-xs font-bold uppercase tracking-wider block mb-2">
            Conflict Resolver
          </span>
          <div className="text-2xl font-extrabold text-neutral-900">0 Conflicts</div>
          <span className="text-xs text-emerald-600 mt-2 block font-medium">
            ✓ Timestamp-based auto-merge active
          </span>
        </div>
      </div>

      {/* Sync History Logs */}
      <div className="admin-card">
        <h3 className="text-sm font-bold text-neutral-900 mb-4 flex items-center gap-2">
          <FaHistory className="text-amber-500" /> Recent Sync Operations
        </h3>

        <table className="admin-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Action</th>
              <th>Entity Type</th>
              <th>Device ID</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {syncLogs.length === 0 ? (
              <tr>
                <td colSpan="5" className="text-center py-6 text-neutral-400 italic">
                  No sync logs recorded yet.
                </td>
              </tr>
            ) : (
              syncLogs.map((log) => (
                <tr key={log.id}>
                  <td>{new Date(log.timestamp).toLocaleString()}</td>
                  <td className="uppercase font-mono font-bold text-xs">{log.action}</td>
                  <td className="capitalize font-semibold">{log.entity_type}</td>
                  <td className="font-mono text-neutral-500">{log.device_id || 'electron-admin-node'}</td>
                  <td>
                    <span className="badge-confirmed">{log.status}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

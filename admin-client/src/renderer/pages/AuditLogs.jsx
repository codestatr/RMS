import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { FaClipboardList } from 'react-icons/fa';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API_URL}/audit?limit=100`, {
      headers: { Authorization: `Bearer ${sessionStorage.getItem('rms_admin_token') || ''}` },
    }).then((response) => {
      setLogs(response.data?.data || []);
    }).catch(() => {
      setLogs([]);
    }).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="admin-card">
        <h2 className="text-xl font-extrabold text-neutral-900 flex items-center gap-2">
          <FaClipboardList className="text-amber-500" /> Activity Audit Trail
        </h2>
        <p className="text-xs text-neutral-500 mt-1">Track staff actions across bookings, payments, shifts, and property operations.</p>
      </div>
      <div className="admin-card overflow-x-auto">
        {loading ? <p className="text-sm text-neutral-500">Loading activity...</p> : (
          <table className="admin-table">
            <thead><tr><th>Time</th><th>User</th><th>Action</th><th>Entity</th><th>Record</th></tr></thead>
            <tbody>
              {logs.length === 0 ? <tr><td colSpan="5" className="text-center py-8 text-neutral-400">No audit activity recorded yet.</td></tr> : logs.map((log) => (
                <tr key={log.id}>
                  <td>{new Date(log.timestamp).toLocaleString()}</td>
                  <td className="font-bold">{log.userName}</td>
                  <td className="uppercase font-mono text-xs">{log.action}</td>
                  <td>{log.entity_type || '-'}</td>
                  <td className="font-mono text-xs">{log.entity_id || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

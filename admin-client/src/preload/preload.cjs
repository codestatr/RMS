const { contextBridge, ipcRenderer } = require('electron')

const allowedEvents = ['sync:start', 'sync:complete', 'sync:error']

contextBridge.exposeInMainWorld('ipcRenderer', {
  invoke(channel, data) {
    const allowed = ['sync:start', 'sync:status', 'db:query', 'receipt:print', 'receipt:save-pdf']
    if (!allowed.includes(channel)) {
      return Promise.reject(new Error(`Unauthorized IPC channel: ${channel}`))
    }
    return ipcRenderer.invoke(channel, data)
  },
  on(channel, listener) {
    if (!allowedEvents.includes(channel)) return () => {}
    const wrapped = (_event, ...args) => listener(...args)
    ipcRenderer.on(channel, wrapped)
    return () => ipcRenderer.removeListener(channel, wrapped)
  },
})

contextBridge.exposeInMainWorld('db', {
  getDashboardKPIs: () => ipcRenderer.invoke('db:query', { operation: 'dashboardKpis' }),
  getRecentBookings: (limit) => ipcRenderer.invoke('db:query', { operation: 'recentBookings', limit }),
  getMonthlyRevenue: () => ipcRenderer.invoke('db:query', { operation: 'monthlyRevenue' }),
  getProperties: () => ipcRenderer.invoke('db:query', { operation: 'properties' }),
  getBookings: () => ipcRenderer.invoke('db:query', { operation: 'bookings' }),
  getPayments: () => ipcRenderer.invoke('db:query', { operation: 'payments' }),
  getShifts: () => ipcRenderer.invoke('db:query', { operation: 'shifts' }),
  createShift: (data) => ipcRenderer.invoke('db:query', { operation: 'createShift', data }),
  updateShift: (id, data) => ipcRenderer.invoke('db:query', { operation: 'updateShift', id, data }),
  createProperty: (data) => ipcRenderer.invoke('db:query', { operation: 'createProperty', data }),
  updateProperty: (id, data) => ipcRenderer.invoke('db:query', { operation: 'updateProperty', id, data }),
  deleteProperty: (id) => ipcRenderer.invoke('db:query', { operation: 'deleteProperty', id }),
  updateBookingStatus: (id, status) => ipcRenderer.invoke('db:query', { operation: 'updateBookingStatus', id, status }),
})

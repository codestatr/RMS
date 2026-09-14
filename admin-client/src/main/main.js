import { app, BrowserWindow, Menu, ipcMain } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import { randomUUID } from 'crypto'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let mainWindow

// Prevent the Electron app from silently crashing on unhandled errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception in Main Process:', error)
})
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection in Main Process at:', promise, 'reason:', reason)
})

function clearAdminAuthSession() {
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.session.clearStorageData({ storages: ['localStorage', 'sessionStorage'] }).catch(() => {})
      mainWindow.webContents.executeJavaScript(`
        try {
          localStorage.removeItem('rms_admin_token');
          localStorage.removeItem('rms_admin_user');
          sessionStorage.removeItem('rms_admin_token');
          sessionStorage.removeItem('rms_admin_user');
        } catch (error) {
          console.error('Failed to clear admin auth session:', error);
        }
      `).catch(() => {})
    }
  } catch (error) {
    console.error('Failed to clear admin auth session:', error)
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
    },
    icon: path.join(__dirname, '../../assets/icon.png'),
  })

  mainWindow.webContents.session.clearStorageData({ storages: ['localStorage', 'sessionStorage'] }).catch(() => {})
  mainWindow.loadFile(path.join(__dirname, '../index.html'))

  mainWindow.on('close', () => {
    clearAdminAuthSession()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.on('ready', createWindow)

app.on('before-quit', () => {
  clearAdminAuthSession()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  }
})

// Create menu
const template = [
  {
    label: 'File',
    submenu: [
      {
        label: 'Exit',
        accelerator: 'CmdOrCtrl+Q',
        click: () => {
          app.quit()
        },
      },
    ],
  },
  {
    label: 'Edit',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
    ],
  },
  {
    label: 'View',
    submenu: [
      { role: 'reload' },
      { role: 'forceReload' },
      { role: 'toggleDevTools' },
    ],
  },
]

const menu = Menu.buildFromTemplate(template)
Menu.setApplicationMenu(menu)

// IPC Handlers for sync
ipcMain.handle('db:query', async (_event, request = {}) => {
  const { default: db } = await import('../db/DatabaseManager.js')
  const { operation, id, data = {}, limit = 5 } = request

  switch (operation) {
    case 'dashboardKpis': {
      const totalProperties = db.get('SELECT COUNT(*) AS count FROM properties')?.count || 0
      const activeBookings = db.get(
        "SELECT COUNT(*) AS count FROM bookings WHERE status IN ('pending', 'confirmed', 'checked_in')"
      )?.count || 0
      const monthlyRevenue = db.get(
        "SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE status = 'paid' AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')"
      )?.total || 0
      return { totalProperties, activeBookings, monthlyRevenue, occupancyRate: 0 }
    }
    case 'recentBookings':
      return db.all(
        `SELECT b.*, COALESCE(b.guest_name, u.name) AS guestName,
         COALESCE(b.property_name, p.name) AS propertyName,
         b.check_in_date AS checkInDate, b.check_out_date AS checkOutDate,
         b.number_of_guests AS numberOfGuests, b.total_amount AS totalAmount
         FROM bookings b LEFT JOIN users u ON u.id = b.customer_id
         LEFT JOIN properties p ON p.id = b.property_id
         ORDER BY b.created_at DESC LIMIT ?`,
        [Number(limit)]
      )
    case 'monthlyRevenue':
      return db.all(
        "SELECT date(created_at) AS date, COALESCE(SUM(amount), 0) AS revenue FROM payments WHERE status = 'paid' GROUP BY date(created_at) ORDER BY date ASC LIMIT 31"
      )
    case 'properties':
      return db.all('SELECT * FROM properties ORDER BY created_at DESC')
    case 'bookings':
      return db.all(
        `SELECT b.*, COALESCE(b.guest_name, u.name) AS guestName,
         COALESCE(b.property_name, p.name) AS propertyName,
         b.check_in_date AS checkInDate, b.check_out_date AS checkOutDate,
         b.number_of_guests AS numberOfGuests, b.total_amount AS totalAmount
         FROM bookings b LEFT JOIN users u ON u.id = b.customer_id
         LEFT JOIN properties p ON p.id = b.property_id
         ORDER BY b.created_at DESC`
      )
    case 'payments':
      return db.all(
        `SELECT pay.*, u.name AS customerName, p.name AS propertyName
         FROM payments pay LEFT JOIN bookings b ON b.id = pay.booking_id
         LEFT JOIN users u ON u.id = b.customer_id LEFT JOIN properties p ON p.id = b.property_id
         ORDER BY pay.created_at DESC`
      )
    case 'shifts':
      return db.all('SELECT * FROM shifts ORDER BY open_time DESC')
    case 'createShift': {
      const shiftId = randomUUID()
      db.run(
        `INSERT INTO shifts (id, cashier_id, open_time, opening_balance, status, created_at, updated_at)
         VALUES (?, ?, datetime('now'), ?, 'open', datetime('now'), datetime('now'))`,
        [shiftId, data.cashierId || null, Number(data.openingBalance || 0)]
      )
      return db.get('SELECT * FROM shifts WHERE id = ?', [shiftId])
    }
    case 'updateShift':
      db.run(
        `UPDATE shifts SET close_time = ?, actual_closing_balance = ?, status = ?, updated_at = datetime('now') WHERE id = ?`,
        [data.endTime ? new Date(data.endTime).toISOString() : null, data.closingBalance ?? null, data.status || 'closed', id]
      )
      return db.get('SELECT * FROM shifts WHERE id = ?', [id])
    case 'createProperty': {
      const propertyId = randomUUID()
      db.run(
        `INSERT INTO properties (id, name, type, description, address, latitude, longitude, image_url, price_per_night, status, owner_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [propertyId, data.name, data.type, data.description || null, data.address, data.latitude || null, data.longitude || null, data.imageUrl || null, Number(data.pricePerNight), data.status || 'available', data.ownerId || null]
      )
      return db.get('SELECT * FROM properties WHERE id = ?', [propertyId])
    }
    case 'updateProperty':
      db.run(
        `UPDATE properties SET name = ?, type = ?, description = ?, address = ?, image_url = ?, price_per_night = ?, status = ?, updated_at = datetime('now') WHERE id = ?`,
        [data.name, data.type, data.description || null, data.address, data.imageUrl || null, Number(data.pricePerNight), data.status, id]
      )
      return db.get('SELECT * FROM properties WHERE id = ?', [id])
    case 'deleteProperty':
      return db.run('DELETE FROM properties WHERE id = ?', [id])
    case 'updateBookingStatus':
      return db.run("UPDATE bookings SET status = ?, updated_at = datetime('now') WHERE id = ?", [data.status || request.status, id])
    default:
      throw new Error(`Unsupported database operation: ${operation}`)
  }
})

ipcMain.handle('sync:start', async (_event, { token = '' } = {}) => {
  mainWindow?.webContents.send('sync:start')
  try {
    const { SyncManager } = await import('../sync/SyncManager.js')
    const syncManager = new SyncManager(token)
    await syncManager.sync()
    mainWindow?.webContents.send('sync:complete')
    return { success: true }
  } catch (error) {
    mainWindow?.webContents.send('sync:error', error.message)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('sync:status', async () => {
  const { SyncManager } = await import('../sync/SyncManager.js')
  const syncManager = new SyncManager()
  return await syncManager.getStatus()
})

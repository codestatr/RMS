import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
dotenv.config();

// Get __filename and __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import routes
import authRoutes from './routes/auth.js';
import propertiesRoutes from './routes/properties.js';
import bookingsRoutes from './routes/bookings.js';
import paymentsRoutes from './routes/payments.js';
import usersRoutes from './routes/users.js';
import reportsRoutes from './routes/reports.js';
import syncRoutes from './routes/sync.js';
import shiftsRoutes from './routes/shifts.js';
import receiptsRoutes from './routes/receipts.js';
import reviewsRoutes from './routes/reviews.js';
import wishlistRoutes from './routes/wishlist.js';
import auditRoutes from './routes/audit.js';
import endOfDayRoutes from './routes/endOfDay.js';
import notificationRoutes from './routes/notifications.js';

// Import error handling and database
import { errorHandler } from './utils/errors.js';
import { initializeDatabase } from './database/db.js';

// Initialize Express app
const app = express();
app.use('/uploads', express.static(join(__dirname, '../uploads')));

const configuredOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const isNgrokOrigin = (origin = '') => /^https?:\/\/([a-z0-9-]+\.)*ngrok(?:-free)?\.(?:io|app|dev)(:\d+)?$/i.test(origin);

// Middleware
app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      const isLocalDevelopmentOrigin = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$/.test(origin || '');
      const isAllowedOrigin = configuredOrigins.includes(origin) || configuredOrigins.includes('*') || isLocalDevelopmentOrigin || isNgrokOrigin(origin);

      if (!origin || isAllowedOrigin) {
        callback(null, true);
        return;
      }
      callback(new Error(`Origin not allowed by CORS: ${origin}`));
    },
    credentials: true,
  })
);

// Rate limiting
const isLocalDevHost = (hostname = '') => {
  const normalized = hostname.toLowerCase();
  return ['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(normalized);
};

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2500,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => isLocalDevHost(req.hostname || '') || req.path === '/health',
});

app.use('/api/', limiter);

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/properties', propertiesRoutes);
app.use('/api/bookings', bookingsRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/shifts', shiftsRoutes);
app.use('/api/receipts', receiptsRoutes);
app.use('/api/reviews', reviewsRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/end-of-day', endOfDayRoutes);
app.use('/api/notifications', notificationRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API documentation endpoint
app.get('/api', (req, res) => {
  res.json({
    message: 'RMS House Rental & Booking Management System API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      properties: '/api/properties',
      bookings: '/api/bookings',
      payments: '/api/payments',
      users: '/api/users',
      reports: '/api/reports',
      sync: '/api/sync',
      shifts: '/api/shifts',
      receipts: '/api/receipts',
      reviews: '/api/reviews',
      wishlist: '/api/wishlist',
    },
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.path,
    code: 'NOT_FOUND',
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 3000;
const PUBLIC_HOST = process.env.PUBLIC_HOST || process.env.HOST || 'localhost';
const BIND_HOST = process.env.BIND_HOST || '0.0.0.0';

// Initialize database and start server
async function startServer() {
  try {
    // Initialize database connection pool
    await initializeDatabase();

    const server = app.listen(PORT, BIND_HOST, () => {
      console.log(`
╔════════════════════════════════════════════════════╗
║  RMS Backend API Server Started                    ║
╟────────────────────────────────────────────────────╢
║  Host: ${PUBLIC_HOST.padEnd(37)}║
║  Port: ${PORT.toString().padEnd(37)}║
║  Environment: ${(process.env.NODE_ENV || 'development').padEnd(26)}║
║  API: http://${(PUBLIC_HOST + ':' + PORT).padEnd(33)}║
╚════════════════════════════════════════════════════╝`);
      console.log('📚 API Documentation: http://' + PUBLIC_HOST + ':' + PORT + '/api');
    });

    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use on ${BIND_HOST}.`);
        console.error('Stop the running server or start the backend on a different port by setting PORT=<port>.');
        process.exit(1);
      }

      console.error('Failed to start server:', error.message);
      process.exit(1);
    });
  } catch (error) {
    console.error('Failed to initialize server:', error.message);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export default app;

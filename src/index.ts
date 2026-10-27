// src/index.ts
import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { detectFrontendUrl } from './middleware/url.middleware';
import authRoutes from './routes/auth.routes';
import adminRoutes from './routes/admin.routes';
import { providerRouter, servicesRouter } from './routes/services.routes';
import { providerBookingsRouter, clientBookingsRouter } from './routes/bookings.routes';
import { responseMiddleware } from './middleware/response.middleware';
import { connectDB, sequelize } from './config/database.config';
import { clientWorkSessionsRouter, providerWorkSessionsRouter } from './routes/workSessions.routes';
import notificationsRoutes from './routes/notifications.routes';
import disputesRoutes from './routes/disputes.routes';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// ============================================================
// ✅ 1. Database Connection - MOST IMPORTANT!
// ============================================================
// This will connect to PostgreSQL and sync all tables
connectDB();

// ============================================================
// ✅ 2. Middleware
// ============================================================
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(responseMiddleware);

// ============================================================
// ✅ 3. Health Check
// ============================================================
app.get('/api/health', async (req: Request, res: Response) => {
  try {
    // Check database connection
    await sequelize.authenticate();
    res.json({ 
      status: 'OK', 
      message: 'Service Connect Backend is running!',
      database: 'connected'
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ 
      status: 'ERROR', 
      message: 'Database connection failed',
      error: errorMessage
    });
  }
});

// ============================================================
// ✅ 4. Routes
// ============================================================
app.use('/api/auth', detectFrontendUrl, authRoutes);
app.use('/api/admin', detectFrontendUrl, adminRoutes);
app.use('/api/services', detectFrontendUrl, servicesRouter);
app.use('/api/provider', detectFrontendUrl, providerRouter);
app.use('/api/provider', detectFrontendUrl, providerBookingsRouter);
app.use('/api/bookings', detectFrontendUrl, clientBookingsRouter);
app.use('/api/provider/bookings', detectFrontendUrl, providerWorkSessionsRouter);
app.use('/api/bookings', detectFrontendUrl, clientWorkSessionsRouter);
app.use('/api/notifications', detectFrontendUrl, notificationsRoutes);
app.use('/api/disputes', detectFrontendUrl, disputesRoutes);

// ============================================================
// ✅ 5. Error Handling
// ============================================================
app.use((err: any, req: Request, res: Response, next: any) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err : undefined
  });
});

// ============================================================
// ✅ 6. Start Server
// ============================================================
app.listen(port, () => {
  console.log(`🚀 Service Connect Backend running at http://localhost:${port}`);
  console.log(`📊 Database: ${process.env.DB_NAME || 'service_connect_db'}`);
});


// // src/index.ts
// import express, { Request, Response } from 'express';
// import { Pool } from 'pg';
// import cors from 'cors';
// import helmet from 'helmet';
// import morgan from 'morgan';
// import dotenv from 'dotenv';
// import { detectFrontendUrl } from './middleware/url.middleware';
// import authRoutes from './routes/auth.routes';
// import adminRoutes from './routes/admin.routes';
// import { responseMiddleware } from './middleware/response.middleware';
// dotenv.config();

// const app = express();
// const port = process.env.PORT || 3000;

// // Database connection
// const pool = new Pool({
//   user: process.env.DB_USER || 'trevor',
//   host: process.env.DB_HOST || 'localhost',
//   database: process.env.DB_NAME || 'service_connect_db',
//   password: process.env.DB_PASSWORD || 'your_password_here',
//   port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5433,
// });

// // Middleware
// app.use(helmet());
// app.use(cors());
// app.use(morgan('dev'));
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));

// app.use(responseMiddleware);
// // Health check
// app.get('/api/health', (req: Request, res: Response) => {
//   res.json({ status: 'OK', message: 'Service Connect Backend is running!' });
// });

// // Get all services
// app.get('/api/services', async (req: Request, res: Response) => {
//   try {
//     const result = await pool.query('SELECT * FROM services ORDER BY id');
//     res.json(result.rows);
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: 'Database error' });
//   }
// });

// // Add a service
// app.post('/api/services', async (req: Request, res: Response) => {
//   const { name, status } = req.body;
//   try {
//     const result = await pool.query(
//       'INSERT INTO services (name, status) VALUES ($1, $2) RETURNING *',
//       [name, status || 'pending']
//     );
//     res.status(201).json(result.rows[0]);
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: 'Database error' });
//   }
// });

// // Update service status
// app.put('/api/services/:id', async (req: Request, res: Response) => {
//   const { id } = req.params;
//   const { status } = req.body;
//   try {
//     const result = await pool.query(
//       'UPDATE services SET status = $1 WHERE id = $2 RETURNING *',
//       [status, id]
//     );
//     if (result.rows.length === 0) {
//       return res.status(404).json({ error: 'Service not found' });
//     }
//     res.json(result.rows[0]);
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: 'Database error' });
//   }
// });

// // Delete a service
// app.delete('/api/services/:id', async (req: Request, res: Response) => {
//   const { id } = req.params;
//   try {
//     const result = await pool.query('DELETE FROM services WHERE id = $1 RETURNING *', [id]);
//     if (result.rows.length === 0) {
//       return res.status(404).json({ error: 'Service not found' });
//     }
//     res.json({ message: 'Service deleted', service: result.rows[0] });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: 'Database error' });
//   }
// });

// // ============================================================
// // ✅ 8. Routes - AFTER all middleware
// // ============================================================
// app.use('/api/auth', detectFrontendUrl, authRoutes);
// app.use('/api/admin', detectFrontendUrl, adminRoutes);

// app.listen(port, () => {
//   console.log(`🚀 Service Connect Backend running at http://localhost:${port}`);
//   console.log(`📊 Database: service-connect-db`);
// });

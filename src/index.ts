import express, { Request, Response } from 'express';
import { Pool } from 'pg';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

const app = express();
const port = process.env.PORT || 3000;

// Database connection
const pool = new Pool({
  user: 'trevor',
  host: 'localhost',
  database: 'service-connect-db',
  password: process.env.DB_PASSWORD || 'your_password_here',
  port: 5432,
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'OK', message: 'Service Connect Backend is running!' });
});

// Get all services
app.get('/api/services', async (req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM services ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Add a service
app.post('/api/services', async (req: Request, res: Response) => {
  const { name, status } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO services (name, status) VALUES ($1, $2) RETURNING *',
      [name, status || 'pending']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Update service status
app.put('/api/services/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    const result = await pool.query(
      'UPDATE services SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Service not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Delete a service
app.delete('/api/services/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM services WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Service not found' });
    }
    res.json({ message: 'Service deleted', service: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.listen(port, () => {
  console.log(`🚀 Service Connect Backend running at http://localhost:${port}`);
  console.log(`📊 Database: service-connect-db`);
});

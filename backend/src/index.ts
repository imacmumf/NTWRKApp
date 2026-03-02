import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { clerkMiddleware } from '@clerk/express';
import { initNeo4j, closeNeo4j } from './config/neo4j';
import contactsRouter from './routes/contacts';
import networkRouter from './routes/network';
import usersRouter from './routes/users';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize services
initNeo4j();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(clerkMiddleware());

// Health check
app.get('/', (_req, res) => {
  res.json({ status: 'ok', service: 'NTWRK Backend' });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/contacts', contactsRouter);
app.use('/api/network', networkRouter);
app.use('/api/users', usersRouter);

// Start server
const server = app.listen(PORT, () => {
  console.log(`NTWRK Backend running on http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Shutting down...');
  server.close();
  await closeNeo4j();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received. Shutting down...');
  server.close();
  await closeNeo4j();
  process.exit(0);
});

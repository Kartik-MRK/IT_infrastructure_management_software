import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import config from './core/config.js';
import healthRouter from './routes/health.js';
import authRouter from './routes/auth.js';
import usersRouter from './routes/users.js';
import assetsRouter from './routes/assets.js';
import incidentsRouter from './routes/incidents.js';
import licensesRouter from './routes/licenses.js';
import auditsRouter from './routes/audits.js';
import financialsRouter from './routes/financials.js';
import telemetryRouter from './routes/telemetry.js';
import slaRouter from './routes/sla.js';
import postmortemsRouter from './routes/postmortems.js';
import cryptoAuditsRouter from './routes/cryptoAudits.js';
import vulnerabilitiesRouter from './routes/vulnerabilities.js';
import alertsRouter from './routes/alerts.js';
import activitiesRouter from './routes/activities.js';
import commandCenterRouter from './routes/commandCenter.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';

export const createApp = (routesCallback = null) => {
  const app = express();

  // Morgan HTTP logging (disabled in test)
  if (config.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
  }

  // CORS configuration matching Flask backend
  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      if (config.CORS_ORIGINS.indexOf(origin) !== -1 || config.NODE_ENV === 'development') {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  }));

  // Body parsers
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Mount Health Routes at root & /api
  app.use(healthRouter);

  // Mount Routers under both /api and /api/v1
  app.use('/api', authRouter);
  app.use('/api/v1', authRouter);
  app.use('/api', usersRouter);
  app.use('/api/v1', usersRouter);
  app.use('/api', assetsRouter);
  app.use('/api/v1', assetsRouter);
  app.use('/api', incidentsRouter);
  app.use('/api/v1', incidentsRouter);
  app.use('/api', licensesRouter);
  app.use('/api/v1', licensesRouter);
  app.use('/api', auditsRouter);
  app.use('/api/v1', auditsRouter);
  app.use('/api', financialsRouter);
  app.use('/api/v1', financialsRouter);
  app.use('/api', telemetryRouter);
  app.use('/api/v1', telemetryRouter);
  app.use('/api', slaRouter);
  app.use('/api/v1', slaRouter);
  app.use('/api', postmortemsRouter);
  app.use('/api/v1', postmortemsRouter);
  app.use('/api', cryptoAuditsRouter);
  app.use('/api/v1', cryptoAuditsRouter);
  app.use('/api', vulnerabilitiesRouter);
  app.use('/api/v1', vulnerabilitiesRouter);
  app.use('/api', alertsRouter);
  app.use('/api/v1', alertsRouter);
  app.use('/api', activitiesRouter);
  app.use('/api/v1', activitiesRouter);
  app.use('/api', commandCenterRouter);
  app.use('/api/v1', commandCenterRouter);

  // Mount custom routes/sub-routers (used for testing and modular routing)
  if (typeof routesCallback === 'function') {
    routesCallback(app);
  }

  // 404 & Centralized Error Handlers
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};

export const app = createApp();
export default app;

import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import config from './core/config.js';
import healthRouter from './routes/health.js';
import authRouter from './routes/auth.js';
import usersRouter from './routes/users.js';
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

  // Mount Auth & User Routers under both /api and /api/v1
  app.use('/api', authRouter);
  app.use('/api/v1', authRouter);
  app.use('/api', usersRouter);
  app.use('/api/v1', usersRouter);

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

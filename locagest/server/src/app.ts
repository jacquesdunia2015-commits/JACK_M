import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { authenticate } from './lib/auth.js';
import { errorHandler, HttpError } from './lib/errors.js';
import { config } from './lib/config.js';
import { authRouter } from './routes/auth.js';
import { propertiesRouter } from './routes/properties.js';
import { tenantsRouter } from './routes/tenants.js';
import { leasesRouter } from './routes/leases.js';
import { dashboardRouter, alertsRouter } from './routes/dashboard.js';
import { adminRouter } from './routes/admin.js';
import { portalRouter } from './routes/portal.js';
import { messagesRouter } from './routes/messages.js';
import { reportsRouter } from './routes/reports.js';
import { notificationsRouter } from './routes/notifications.js';

export function createApp(opts: { webDist?: string } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'same-site' } }));
  app.use(cors({ origin: config.appUrl }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });
  app.use('/api/auth', authRouter);
  app.use('/api/properties', authenticate, propertiesRouter);
  app.use('/api/tenants', authenticate, tenantsRouter);
  app.use('/api/leases', authenticate, leasesRouter);
  app.use('/api/dashboard', authenticate, dashboardRouter);
  app.use('/api/alerts', authenticate, alertsRouter);
  app.use('/api/admin', authenticate, adminRouter);
  app.use('/api/portal', authenticate, portalRouter);
  app.use('/api/messages', authenticate, messagesRouter);
  app.use('/api/reports', authenticate, reportsRouter);
  app.use('/api/notifications', authenticate, notificationsRouter);
  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Route inconnue', 'route_unknown')));

  app.use('/uploads', express.static(path.resolve(config.uploadDir), { maxAge: '7d', fallthrough: false }));

  // En production, le serveur sert aussi l'interface web compilée.
  if (opts.webDist && existsSync(opts.webDist)) {
    app.use(express.static(opts.webDist, { index: false, maxAge: '1h' }));
    app.get(/^\/(?!api|uploads).*/, (_req, res) => res.sendFile(path.join(opts.webDist!, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}

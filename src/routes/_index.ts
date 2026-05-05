import { Router } from 'express';
import { sitesRouter } from './sites.js';
import { tasksRouter } from './tasks.js';
import { inboxRouter } from './inbox.js';
import { placementsRouter } from './placements.js';
import { dashboardRouter } from './dashboard.js';
import { nichesRouter } from './niches.js';
import { plansRouter } from './plans.js';
import { indexRouter } from './index-pages.js';
import { matchRouter } from './matches.js';

export function registerRoutes(app: Router) {
  const api = Router();

  // Sites
  api.use('/sites', sitesRouter);

  // Tasks
  api.use('/tasks', tasksRouter);

  // Inbox
  api.use('/inbox', inboxRouter);

  // Placements
  api.use('/placements', placementsRouter);

  // Dashboard
  api.use('/dashboard', dashboardRouter);

  // Niches
  api.use('/niches', nichesRouter);

  // Plans
  api.use('/plans', plansRouter);

  // Index
  api.use('/index', indexRouter);

  // Matches
  api.use('/matches', matchRouter);

  app.use('/api/v1', api);
}

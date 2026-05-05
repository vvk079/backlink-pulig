import { eq } from 'drizzle-orm';
import type { Request, Response, NextFunction } from 'express';
import { db, sites } from '../db/client.js';
import { hashApiKey } from '../lib/api-key.js';
import { AppError } from '../lib/errors.js';

declare global {
  namespace Express {
    interface Request {
      site?: typeof sites.$inferSelect;
    }
  }
}

export const requireApiKey = async (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'] as string | undefined;

  if (!apiKey) {
    res.status(401).json({ error: 'UNAUTHORIZED', message: 'Missing X-API-Key header' });
    return;
  }

  const keyHash = hashApiKey(apiKey);
  const site = await db.query.sites.findFirst({
    where: eq(sites.apiKeyHash, keyHash),
  });

  if (!site) {
    res.status(401).json({ error: 'INVALID_API_KEY', message: 'Invalid API key' });
    return;
  }

  if (site.status !== 'active') {
    res.status(403).json({ error: 'SITE_INACTIVE', message: 'Site is not active' });
    return;
  }

  req.site = site;
  next();
};
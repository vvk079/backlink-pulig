import { desc } from 'drizzle-orm';
import { Router } from 'express';
import { db, niches } from '../db/client.js';
import { asyncHandler } from '../lib/errors.js';
import { requireApiKey } from '../middleware/auth.js';

export const nichesRouter = Router();

nichesRouter.get(
  '/',
  requireApiKey,
  asyncHandler(async (req, res) => {
    const allNiches = await db.query.niches.findMany({
      orderBy: [desc(niches.name)],
    });

    res.json({
      niches: allNiches.map(n => ({
        id: n.id,
        slug: n.slug,
        name: n.name,
        parent_id: n.parentId,
      })),
    });
  })
);
import { Router } from 'express';
import { z } from 'zod';
import { db, sites } from '../db/client.js';
import { generateApiKey } from '../lib/api-key.js';
import { AppError, asyncHandler, parseSiteUrl, validateBody } from '../lib/errors.js';
import { requireApiKey } from '../middleware/auth.js';

export const sitesRouter = Router();

const registerSchema = z.object({
  url: z.string().url().max(2048),
  niche_id: z.string().optional(),
});

sitesRouter.post(
  '/register',
  validateBody(registerSchema),
  asyncHandler(async (req, res) => {
    const { url, niche_id } = req.body;
    const parsed = parseSiteUrl(url);

    // Check if site already exists
    const existing = await db.query.sites.findFirst({
      where: (s, { eq }) => eq(s.rootDomain, parsed.rootDomain),
    });

    if (existing) {
      throw new AppError('SITE_EXISTS', 'Site with this domain already registered', 409);
    }

    const apiKey = generateApiKey();

    const [created] = await db
      .insert(sites)
      .values({
        url: parsed.fullUrl,
        rootDomain: parsed.rootDomain,
        apiKey: apiKey.raw,
        apiKeyHash: apiKey.hash,
        nicheId: niche_id || null,
        status: 'active',
      })
      .returning();

    if (!created) {
      throw new AppError('INTERNAL', 'Failed to create site', 500);
    }

    res.status(201).json({
      id: created.id,
      url: created.url,
      root_domain: created.rootDomain,
      api_key: apiKey.raw,
      status: created.status,
      created_at: created.createdAt,
    });
  })
);

sitesRouter.get(
  '/verify',
  requireApiKey,
  asyncHandler(async (req, res) => {
    const site = req.site!;

    // Mark as verified
    const [updated] = await db
      .update(sites)
      .set({ verifiedAt: new Date() })
      .where((s, { eq }) => eq(s.id, site.id))
      .returning();

    res.json({
      verified: true,
      site: {
        id: updated?.id || site.id,
        url: updated?.url || site.url,
        root_domain: updated?.rootDomain || site.rootDomain,
        status: updated?.status || site.status,
        verified_at: updated?.verifiedAt || site.verifiedAt,
      },
    });
  })
);

sitesRouter.get(
  '/me',
  requireApiKey,
  asyncHandler(async (req, res) => {
    const site = req.site!;
    res.json({
      id: site.id,
      url: site.url,
      root_domain: site.rootDomain,
      niche_id: site.nicheId,
      da_score: site.daScore,
      dr_score: site.drScore,
      monthly_traffic: site.monthlyTraffic,
      status: site.status,
      verified_at: site.verifiedAt,
      created_at: site.createdAt,
    });
  })
);

sitesRouter.patch(
  '/me',
  requireApiKey,
  asyncHandler(async (req, res) => {
    const site = req.site!;
    const { niche_id, da_score, dr_score, monthly_traffic } = req.body as { niche_id?: string; da_score?: number; dr_score?: number; monthly_traffic?: number };

    const [updated] = await db
      .update(sites)
      .set({
        nicheId: niche_id ?? site.nicheId,
        daScore: da_score ?? site.daScore,
        drScore: dr_score ?? site.drScore,
        monthlyTraffic: monthly_traffic ?? site.monthlyTraffic,
        updatedAt: new Date(),
      })
      .where((s, { eq }) => eq(s.id, site.id))
      .returning();

    res.json({
      id: updated?.id || site.id,
      url: updated?.url || site.url,
      root_domain: updated?.rootDomain || site.rootDomain,
      niche_id: updated?.nicheId || site.nicheId,
      da_score: updated?.daScore || site.daScore,
      dr_score: updated?.drScore || site.drScore,
      monthly_traffic: updated?.monthlyTraffic || site.monthlyTraffic,
      status: updated?.status || site.status,
    });
  })
);
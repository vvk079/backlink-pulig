import { eq, desc } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { db, placements, matches } from '../db/client.js';
import { AppError, asyncHandler, validateBody } from '../lib/errors.js';
import { requireApiKey } from '../middleware/auth.js';

export const placementsRouter = Router();

const createPlacementSchema = z.object({
  match_id: z.string().uuid(),
  host_page_url: z.string().url().max(2048),
  anchor_text: z.string().min(1).max(500),
  html_snapshot: z.string().max(65536).optional(),
});

placementsRouter.post(
  '/',
  requireApiKey,
  validateBody(createPlacementSchema),
  asyncHandler(async (req, res) => {
    const site = req.site!;
    const data = req.body as z.infer<typeof createPlacementSchema>;

    // Verify match belongs to this site and is in accepted state
    const match = await db.query.matches.findFirst({
      where: (m, { and, eq }) => and(eq(m.id, data.match_id), eq(m.fromSiteId, site.id)),
    });

    if (!match) {
      throw new AppError('NOT_FOUND', 'Match not found', 404);
    }

    if (match.status !== 'accepted') {
      throw new AppError(
        'INVALID_STATE',
        `Match must be in 'accepted' state to record placement (currently '${match.status}')`,
        409
      );
    }

    // Check for duplicate placement
    const existingPlacement = await db.query.placements.findFirst({
      where: (p, { eq }) => eq(p.matchId, data.match_id),
    });

    if (existingPlacement) {
      throw new AppError('PLACEMENT_EXISTS', 'A placement already exists for this match', 409);
    }

    const [created] = await db
      .insert(placements)
      .values({
        matchId: data.match_id,
        fromSiteId: site.id,
        toSiteId: match.toSiteId,
        toTaskId: match.toTaskId,
        anchorText: data.anchor_text,
        targetUrl: match.targetUrl,
        hostPageUrl: data.host_page_url,
        htmlSnapshot: data.html_snapshot || null,
        status: 'placed',
        placedAt: new Date(),
      })
      .returning();

    if (!created) {
      throw new AppError('INTERNAL', 'Failed to create placement', 500);
    }

    // Update match status
    await db
      .update(matches)
      .set({ status: 'placed', placedAt: new Date() })
      .where((m, { eq }) => eq(m.id, data.match_id));

    // Update task link counts
    await db
      .update(db._.updateTable(t => t.tasks))
      .set({ linksGivenCount: db._.sql`links_given_count + 1` })
      .where((t, { eq }) => eq(t.id, match.fromTaskId));

    // Update the receiving task's received count
    const receivingTask = await db.query.tasks.findFirst({
      where: (t, { eq }) => eq(t.id, match.toTaskId),
    });
    if (receivingTask) {
      await db
        .update(db._.updateTable(t => t.tasks))
        .set({ linksReceivedCount: db._.sql`links_received_count + 1` })
        .where((t, { eq }) => eq(t.id, match.toTaskId));
    }

    res.status(201).json({
      placement: {
        id: created.id,
        match_id: created.matchId,
        anchor_text: created.anchorText,
        target_url: created.targetUrl,
        host_page_url: created.hostPageUrl,
        status: created.status,
        placed_at: created.placedAt,
      },
    });
  })
);

placementsRouter.get(
  '/received',
  requireApiKey,
  asyncHandler(async (req, res) => {
    const site = req.site!;

    const receivedPlacements = await db.query.placements.findMany({
      where: (p, { eq }) => eq(p.toSiteId, site.id),
      orderBy: [desc(p.placedAt)],
      limit: 100,
    });

    res.json({
      placements: receivedPlacements.map(p => ({
        id: p.id,
        match_id: p.matchId,
        from_site_id: p.fromSiteId,
        anchor_text: p.anchorText,
        target_url: p.targetUrl,
        host_page_url: p.hostPageUrl,
        status: p.status,
        placed_at: p.placedAt,
        verified_at: p.verifiedAt,
      })),
    });
  })
);

placementsRouter.get(
  '/given',
  requireApiKey,
  asyncHandler(async (req, res) => {
    const site = req.site!;

    const givenPlacements = await db.query.placements.findMany({
      where: (p, { eq }) => eq(p.fromSiteId, site.id),
      orderBy: [desc(p.placedAt)],
      limit: 100,
    });

    res.json({
      placements: givenPlacements.map(p => ({
        id: p.id,
        match_id: p.matchId,
        to_site_id: p.toSiteId,
        anchor_text: p.anchorText,
        target_url: p.targetUrl,
        host_page_url: p.hostPageUrl,
        status: p.status,
        placed_at: p.placedAt,
        verified_at: p.verifiedAt,
      })),
    });
  })
);
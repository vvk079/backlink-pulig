import { and, eq, inArray } from 'drizzle-orm';
import { Router } from 'express';
import { db, matches, tasks, sites, placements } from '../db/client.js';
import { AppError, asyncHandler } from '../lib/errors.js';
import { requireApiKey } from '../middleware/auth.js';

export const inboxRouter = Router();

inboxRouter.get(
  '/',
  requireApiKey,
  asyncHandler(async (req, res) => {
    const site = req.site!;

    // Get all tasks for this site
    const siteTasks = await db.query.tasks.findMany({
      where: (t, { eq }) => eq(t.siteId, site.id),
    });

    if (siteTasks.length === 0) {
      res.json({ items: [] });
      return;
    }

    const taskIds = siteTasks.map(t => t.id);

    // Get matches where this site is the provider (placing links for others)
    const inboxMatches = await db.query.matches.findMany({
      where: (m, { and, eq, inArray }) => and(
        eq(m.fromSiteId, site.id),
        inArray(m.status, ['proposed', 'accepted'])
      ),
    });

    // Enhance with task and target site info
    const items = [];
    for (const match of inboxMatches) {
      const toTask = siteTasks.find(t => t.id === match.toTaskId);
      const toSite = await db.query.sites.findFirst({
        where: (s, { eq }) => eq(s.id, match.toSiteId),
      });

      // Get suggested host pages for this match
      const hostPages = await db.query.sitePages.findMany({
        where: (p, { eq }) => eq(p.siteId, site.id),
        limit: 5,
      });

      items.push({
        id: match.id,
        status: match.status,
        proposed_at: match.proposedAt,
        expires_at: match.expiresAt,
        anchor_keyword: match.anchorText,
        target_url: match.targetUrl,
        to_task_id: match.toTaskId,
        to_site_url: toSite?.url || '',
        suggested_host_pages: hostPages.map(p => ({
          id: p.id,
          url: p.url,
          title: p.title,
          post_id_in_cms: p.postIdInCms,
          outbound_partner_link_count: p.outboundPartnerLinkCount,
        })),
      });
    }

    res.json({ items });
  })
);

inboxRouter.post(
  '/:id/accept',
  requireApiKey,
  asyncHandler(async (req, res) => {
    const site = req.site!;
    const id = req.params.id;

    const match = await db.query.matches.findFirst({
      where: (m, { and, eq }) => and(eq(m.id, id), eq(m.fromSiteId, site.id)),
    });

    if (!match) {
      throw new AppError('NOT_FOUND', 'Match not found', 404);
    }

    if (match.status !== 'proposed' && match.status !== 'accepted') {
      throw new AppError(
        'INVALID_STATE',
        `Match cannot be accepted from '${match.status}' state`,
        409
      );
    }

    // Update match status to accepted
    const [updated] = await db
      .update(matches)
      .set({
        status: 'accepted',
        acceptedAt: new Date(),
        eligibleAt: new Date(), // Immediately eligible for placement
      })
      .where((m, { eq }) => eq(m.id, id))
      .returning();

    res.json({
      match: {
        id: updated?.id || match.id,
        status: 'accepted',
      },
    });
  })
);

inboxRouter.post(
  '/:id/decline',
  requireApiKey,
  asyncHandler(async (req, res) => {
    const site = req.site!;
    const id = req.params.id;

    const match = await db.query.matches.findFirst({
      where: (m, { and, eq }) => and(eq(m.id, id), eq(m.fromSiteId, site.id)),
    });

    if (!match) {
      throw new AppError('NOT_FOUND', 'Match not found', 404);
    }

    await db
      .update(matches)
      .set({ status: 'deleted' })
      .where((m, { eq }) => eq(m.id, id));

    res.status(204).send();
  })
);
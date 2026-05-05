import { count, desc, eq, gte, sql } from 'drizzle-orm';
import { Router } from 'express';
import { db, placements, tasks, matches, activity } from '../db/client.js';
import { asyncHandler } from '../lib/errors.js';
import { requireApiKey } from '../middleware/auth.js';

export const dashboardRouter = Router();

dashboardRouter.get(
  '/',
  requireApiKey,
  asyncHandler(async (req, res) => {
    const site = req.site!;
    const now = new Date();
    const startOfMonth = new Date(now.getUTCFullYear(), now.getUTCMonth(), 1);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get counts
    const [
      activeTasks,
      receivedThisMonth,
      givenThisMonth,
      pendingInbox,
      lifetimeReceived,
      lifetimeGiven,
    ] = await Promise.all([
      // Active tasks
      db
        .select({ n: count() })
        .from(tasks)
        .where(eq(tasks.siteId, site.id))
        .innerSelect((t) => t.status === 'active' || t.status === 'pending'),

      // Received this month
      db
        .select({ n: count() })
        .from(placements)
        .where(
          sql`${placements.toSiteId} = ${site.id} AND ${placements.placedAt} >= ${startOfMonth}`
        ),

      // Given this month
      db
        .select({ n: count() })
        .from(placements)
        .where(
          sql`${placements.fromSiteId} = ${site.id} AND ${placements.placedAt} >= ${startOfMonth}`
        ),

      // Pending inbox
      db
        .select({ n: count() })
        .from(matches)
        .where(
          sql`${matches.fromSiteId} = ${site.id} AND ${matches.status} IN ('proposed', 'accepted')`
        ),

      // Lifetime received
      db
        .select({ n: count() })
        .from(placements)
        .where(eq(placements.toSiteId, site.id)),

      // Lifetime given
      db
        .select({ n: count() })
        .from(placements)
        .where(eq(placements.fromSiteId, site.id)),
    ]);

    // Calculate balance (given - received for this month)
    const received = Number(receivedThisMonth[0]?.n ?? 0);
    const given = Number(givenThisMonth[0]?.n ?? 0);
    const balance = given - received;

    res.json({
      site: {
        url: site.url,
        root_domain: site.rootDomain,
        status: site.status,
        da_score: site.daScore,
        monthly_traffic: site.monthlyTraffic,
      },
      quota: {
        received_this_month: received,
        given_this_month: given,
        balance: balance,
      },
      counts: {
        active_tasks: Number(activeTasks[0]?.n ?? 0),
        pending_inbox: Number(pendingInbox[0]?.n ?? 0),
        lifetime_received: Number(lifetimeReceived[0]?.n ?? 0),
        lifetime_given: Number(lifetimeGiven[0]?.n ?? 0),
      },
      last_activity_at: now.toISOString(),
    });
  })
);

dashboardRouter.get(
  '/activity',
  requireApiKey,
  asyncHandler(async (req, res) => {
    const site = req.site!;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);

    const events = await db.query.activity.findMany({
      where: (a, { eq }) => eq(a.siteId, site.id),
      orderBy: [desc(activity.createdAt)],
      limit,
    });

    res.json({
      events: events.map(e => ({
        id: e.id,
        action: e.action,
        entity_type: e.entityType,
        entity_id: e.entityId,
        meta: e.meta,
        created_at: e.createdAt,
      })),
    });
  })
);
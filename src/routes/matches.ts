import { Router } from 'express';
import { db, sites, tasks, matches, matchGroups, placements } from '../db/client.js';
import { eq, and, or, inArray } from 'drizzle-orm';
import { asyncHandler } from '../lib/errors.js';
import { requireApiKey } from '../middleware/auth.js';

export const matchRouter = Router();

/**
 * Trigger matching for all active tasks
 */
matchRouter.post(
  '/run',
  requireApiKey,
  asyncHandler(async (req, res) => {
    const site = req.site!;

    // Get all active tasks from different sites in the same niche
    const activeTasks = await db.query.tasks.findMany({
      where: (t, { eq, and }) => and(
        eq(t.status, 'active'),
        eq(t.nicheId, site.nicheId || 'technology')
      ),
      limit: 100,
    });

    if (activeTasks.length < 3) {
      res.json({
        matched: 0,
        message: 'Not enough active tasks for triangular matching',
      });
      return;
    }

    // Group tasks by site
    const tasksBySite = new Map<string, typeof activeTasks>();
    for (const task of activeTasks) {
      if (!tasksBySite.has(task.siteId)) {
        tasksBySite.set(task.siteId, []);
      }
      tasksBySite.get(task.siteId)!.push(task);
    }

    // Check if we have at least 3 different sites
    if (tasksBySite.size < 3) {
      res.json({
        matched: 0,
        message: 'Need at least 3 different sites for triangular matching',
      });
      return;
    }

    const siteIds = Array.from(tasksBySite.keys());
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Create triangular groups
    let matchCount = 0;
    for (let i = 0; i < siteIds.length; i++) {
      const siteA = tasksBySite.get(siteIds[i]);
      const siteB = tasksBySite.get(siteIds[(i + 1) % siteIds.length]);
      const siteC = tasksBySite.get(siteIds[(i + 2) % siteIds.length]);

      if (!siteA || !siteB || !siteC) continue;
      if (siteA.length === 0 || siteB.length === 0 || siteC.length === 0) continue;

      const taskA = siteA[0];
      const taskB = siteB[0];
      const taskC = siteC[0];

      // Create match group
      const [group] = await db
        .insert(matchGroups)
        .values({})
        .returning();

      // Create 3 matches forming a triangle
      await db.insert(matches).values([
        {
          matchGroupId: group.id,
          fromSiteId: taskA.siteId,
          toSiteId: taskB.siteId,
          fromTaskId: taskA.id,
          toTaskId: taskB.id,
          anchorText: taskB.anchorKeyword,
          targetUrl: taskB.targetUrl,
          status: 'proposed',
          proposedAt: new Date(),
          expiresAt,
        },
        {
          matchGroupId: group.id,
          fromSiteId: taskB.siteId,
          toSiteId: taskC.siteId,
          fromTaskId: taskB.id,
          toTaskId: taskC.id,
          anchorText: taskC.anchorKeyword,
          targetUrl: taskC.targetUrl,
          status: 'proposed',
          proposedAt: new Date(),
          expiresAt,
        },
        {
          matchGroupId: group.id,
          fromSiteId: taskC.siteId,
          toSiteId: taskA.siteId,
          fromTaskId: taskC.id,
          toTaskId: taskA.id,
          anchorText: taskA.anchorKeyword,
          targetUrl: taskA.targetUrl,
          status: 'proposed',
          proposedAt: new Date(),
          expiresAt,
        },
      ]);

      matchCount += 3;
    }

    res.json({
      matched: matchCount,
      groups: Math.floor(matchCount / 3),
    });
  })
);

/**
 * Get match statistics
 */
matchRouter.get(
  '/stats',
  requireApiKey,
  asyncHandler(async (req, res) => {
    const site = req.site!;

    const siteMatches = await db.query.matches.findMany({
      where: (m, { or, eq }) => or(
        eq(m.fromSiteId, site.id),
        eq(m.toSiteId, site.id)
      ),
    });

    const stats = {
      total: siteMatches.length,
      proposed: 0,
      accepted: 0,
      placed: 0,
      live: 0,
      deleted: 0,
    };

    for (const match of siteMatches) {
      if (match.status in stats) {
        (stats as any)[match.status]++;
      }
    }

    res.json({ stats });
  })
);
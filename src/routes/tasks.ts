import { eq } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { db, tasks, matches, matchGroups } from '../db/client.js';
import { AppError, asyncHandler, validateBody } from '../lib/errors.js';
import { requireApiKey } from '../middleware/auth.js';

export const tasksRouter = Router();

const createTaskSchema = z.object({
  anchor_keyword: z.string().min(1).max(255),
  anchor_variations: z.array(z.string()).optional().default([]),
  brand_anchor: z.string().max(255).optional(),
  generic_anchors: z.array(z.string()).optional().default(['click here', 'learn more']),
  anchor_strategy: z.enum(['natural', 'exact', 'partial', 'branded', 'auto']).optional().default('natural'),
  use_url_anchor: z.boolean().optional().default(false),
  target_url: z.string().url().max(500),
  niche_id: z.string().min(1),
  desired_da_min: z.number().int().min(0).optional().default(0),
  desired_da_max: z.number().int().min(0).optional().default(40),
  desired_traffic_min: z.number().int().min(0).optional(),
  desired_traffic_max: z.number().int().min(0).optional(),
  monthly_receive_target: z.number().int().min(1).optional().default(1),
  max_outbound_per_month: z.number().int().min(1).optional().default(5),
});

const updateTaskSchema = createTaskSchema.partial();

tasksRouter.get(
  '/',
  requireApiKey,
  asyncHandler(async (req, res) => {
    const site = req.site!;
    const allTasks = await db.query.tasks.findMany({
      where: (t, { eq }) => eq(t.siteId, site.id),
      orderBy: (t, { desc }) => [desc(t.createdAt)],
    });

    res.json({
      tasks: allTasks.map(t => ({
        id: t.id,
        anchor_keyword: t.anchorKeyword,
        anchor_variations: t.anchorVariations,
        brand_anchor: t.brandAnchor,
        generic_anchors: t.genericAnchors,
        anchor_strategy: t.anchorStrategy,
        use_url_anchor: t.useUrlAnchor,
        target_url: t.targetUrl,
        niche_id: t.nicheId,
        desired_da_min: t.desiredDaMin,
        desired_da_max: t.desiredDaMax,
        desired_traffic_min: t.desiredTrafficMin,
        desired_traffic_max: t.desiredTrafficMax,
        monthly_receive_target: t.monthlyReceiveTarget,
        max_outbound_per_month: t.maxOutboundPerMonth,
        links_received_count: t.linksReceivedCount,
        links_given_count: t.linksGivenCount,
        status: t.status,
        created_at: t.createdAt,
        updated_at: t.updatedAt,
      })),
    });
  })
);

tasksRouter.post(
  '/',
  requireApiKey,
  validateBody(createTaskSchema),
  asyncHandler(async (req, res) => {
    const site = req.site!;
    const data = req.body as z.infer<typeof createTaskSchema>;

    const [created] = await db
      .insert(tasks)
      .values({
        siteId: site.id,
        anchorKeyword: data.anchor_keyword,
        anchorVariations: data.anchor_variations,
        brandAnchor: data.brand_anchor || null,
        genericAnchors: data.generic_anchors,
        anchorStrategy: data.anchor_strategy,
        useUrlAnchor: data.use_url_anchor,
        targetUrl: data.target_url,
        nicheId: data.niche_id,
        desiredDaMin: data.desired_da_min,
        desiredDaMax: data.desired_da_max,
        desiredTrafficMin: data.desired_traffic_min || null,
        desiredTrafficMax: data.desired_traffic_max || null,
        monthlyReceiveTarget: data.monthly_receive_target,
        maxOutboundPerMonth: data.max_outbound_per_month,
        status: 'active',
      })
      .returning();

    if (!created) {
      throw new AppError('INTERNAL', 'Failed to create task', 500);
    }

    // Auto-run matching if this is the 3rd+ task in this niche
    const matchResult = await autoMatchTasks(data.niche_id);

    res.status(201).json({
      task: {
        id: created.id,
        anchor_keyword: created.anchorKeyword,
        anchor_variations: created.anchorVariations,
        brand_anchor: created.brandAnchor,
        generic_anchors: created.genericAnchors,
        anchor_strategy: created.anchorStrategy,
        use_url_anchor: created.useUrlAnchor,
        target_url: created.targetUrl,
        niche_id: created.nicheId,
        status: created.status,
        created_at: created.createdAt,
      },
      match_created: matchResult,
    });
  })
);

tasksRouter.get(
  '/:id',
  requireApiKey,
  asyncHandler(async (req, res) => {
    const site = req.site!;
    const id = req.params.id;

    const task = await db.query.tasks.findFirst({
      where: (t, { and, eq }) => and(eq(t.id, id), eq(t.siteId, site.id)),
    });

    if (!task) {
      throw new AppError('NOT_FOUND', 'Task not found', 404);
    }

    res.json({
      task: {
        id: task.id,
        anchor_keyword: task.anchorKeyword,
        anchor_variations: task.anchorVariations,
        brand_anchor: task.brandAnchor,
        generic_anchors: task.genericAnchors,
        anchor_strategy: task.anchorStrategy,
        use_url_anchor: task.useUrlAnchor,
        target_url: task.targetUrl,
        niche_id: task.nicheId,
        desired_da_min: task.desiredDaMin,
        desired_da_max: task.desiredDaMax,
        desired_traffic_min: task.desiredTrafficMin,
        desired_traffic_max: task.desiredTrafficMax,
        monthly_receive_target: task.monthlyReceiveTarget,
        max_outbound_per_month: task.maxOutboundPerMonth,
        links_received_count: task.linksReceivedCount,
        links_given_count: task.linksGivenCount,
        status: task.status,
        created_at: task.createdAt,
        updated_at: task.updatedAt,
      },
    });
  })
);

tasksRouter.patch(
  '/:id',
  requireApiKey,
  validateBody(updateTaskSchema),
  asyncHandler(async (req, res) => {
    const site = req.site!;
    const id = req.params.id;
    const data = req.body as Partial<z.infer<typeof createTaskSchema>>;

    const task = await db.query.tasks.findFirst({
      where: (t, { and, eq }) => and(eq(t.id, id), eq(t.siteId, site.id)),
    });

    if (!task) {
      throw new AppError('NOT_FOUND', 'Task not found', 404);
    }

    const [updated] = await db
      .update(tasks)
      .set({
        anchorKeyword: data.anchor_keyword ?? task.anchorKeyword,
        anchorVariations: data.anchor_variations ?? task.anchorVariations,
        brandAnchor: data.brand_anchor !== undefined ? data.brand_anchor : task.brandAnchor,
        genericAnchors: data.generic_anchors ?? task.genericAnchors,
        anchorStrategy: data.anchor_strategy ?? task.anchorStrategy,
        useUrlAnchor: data.use_url_anchor ?? task.useUrlAnchor,
        targetUrl: data.target_url ?? task.targetUrl,
        nicheId: data.niche_id ?? task.nicheId,
        desiredDaMin: data.desired_da_min ?? task.desiredDaMin,
        desiredDaMax: data.desired_da_max ?? task.desiredDaMax,
        desiredTrafficMin: data.desired_traffic_min !== undefined ? data.desired_traffic_min : task.desiredTrafficMin,
        desiredTrafficMax: data.desired_traffic_max !== undefined ? data.desired_traffic_max : task.desiredTrafficMax,
        monthlyReceiveTarget: data.monthly_receive_target ?? task.monthlyReceiveTarget,
        maxOutboundPerMonth: data.max_outbound_per_month ?? task.maxOutboundPerMonth,
        status: data.anchor_keyword ? task.status : task.status,
        updatedAt: new Date(),
      })
      .where((t, { eq }) => eq(t.id, id))
      .returning();

    res.json({
      task: {
        id: updated?.id || task.id,
        anchor_keyword: updated?.anchorKeyword || task.anchorKeyword,
        status: updated?.status || task.status,
        updated_at: updated?.updatedAt || task.updatedAt,
      },
    });
  })
);

tasksRouter.delete(
  '/:id',
  requireApiKey,
  asyncHandler(async (req, res) => {
    const site = req.site!;
    const id = req.params.id;

    const task = await db.query.tasks.findFirst({
      where: (t, { and, eq }) => and(eq(t.id, id), eq(t.siteId, site.id)),
    });

    if (!task) {
      throw new AppError('NOT_FOUND', 'Task not found', 404);
    }

    await db.delete(tasks).where((t, { eq }) => eq(t.id, id));

    res.status(204).send();
  })
);

/**
 * Auto-match tasks in a niche when 3+ active tasks exist from different sites
 */
async function autoMatchTasks(nicheId: string): Promise<{ matched: number; message: string }> {
  // Get all active tasks in this niche that are NOT already matched
  const activeTasks = await db.query.tasks.findMany({
    where: (t, { and, eq }) => and(
      eq(t.status, 'active'),
      eq(t.nicheId, nicheId)
    ),
    limit: 100,
  });

  // Get existing matches for these tasks to filter out already matched ones
  const taskIds = activeTasks.map(t => t.id);

  const existingMatches = await db.query.matches.findMany({
    where: (m, { or }) => or(
      taskIds.map(id => ({ fromTaskId: id })).reduce((acc, curr) => acc, { fromTaskId: taskIds[0] })
    ),
  });

  const matchedTaskIds = new Set(existingMatches.map(m => m.fromTaskId));
  const unmatchedTasks = activeTasks.filter(t => !matchedTaskIds.has(t.id));

  if (unmatchedTasks.length < 3) {
    return { matched: 0, message: 'Not enough unmatched tasks for triangular matching' };
  }

  // Group by site
  const tasksBySite = new Map<string, typeof unmatchedTasks>();
  for (const task of unmatchedTasks) {
    if (!tasksBySite.has(task.siteId)) {
      tasksBySite.set(task.siteId, []);
    }
    tasksBySite.get(task.siteId)!.push(task);
  }

  if (tasksBySite.size < 3) {
    return { matched: 0, message: 'Need at least 3 different sites' };
  }

  const siteIds = Array.from(tasksBySite.keys());
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  let matchCount = 0;

  // Create triangular groups
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

    // Create 3 matches: A→B, B→C, C→A
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

  return {
    matched: matchCount,
    message: `Created ${Math.floor(matchCount / 3)} triangular match group(s)`,
  };
}
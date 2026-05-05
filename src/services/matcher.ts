import { db, tasks, matches, matchGroups, sites } from '../db/client.js';
import { eq, and, inArray } from 'drizzle-orm';

export interface MatchResult {
  matchId: string;
  fromSiteId: string;
  toSiteId: string;
  fromTaskId: string;
  toTaskId: string;
  anchorText: string;
  targetUrl: string;
}

/**
 * Run triangular matching for all active tasks in a niche.
 * Groups 3 tasks from 3 different sites into mutual link exchanges.
 */
export async function runTriangularMatching(nicheId?: string): Promise<number> {
  // Get all active tasks with site info
  const activeTasks = await db.query.tasks.findMany({
    where: (t, { eq, and, or }) => and(
      eq(t.status, 'active'),
      nicheId ? eq(t.nicheId, nicheId) : undefined
    ),
    with: {
      site: true,
    },
    limit: 1000,
  });

  if (activeTasks.length < 3) {
    return 0; // Not enough tasks for triangular matching
  }

  // Group tasks by niche
  const tasksByNiche = new Map<string, typeof activeTasks>();
  for (const task of activeTasks) {
    const niche = task.nicheId;
    if (!tasksByNiche.has(niche)) {
      tasksByNiche.set(niche, []);
    }
    tasksByNiche.get(niche)!.push(task);
  }

  let totalMatches = 0;

  // Process each niche
  for (const [niche, nicheTasks] of tasksByNiche) {
    const matchCount = await matchNicheTasks(niche, nicheTasks);
    totalMatches += matchCount;
  }

  return totalMatches;
}

async function matchNicheTasks(nicheId: string, tasks: typeof tasks.$inferSelect[]): Promise<number> {
  const count = tasks.length;
  const used = new Set<string>();
  let matches = 0;

  for (let a = 0; a < count; a++) {
    const taskA = tasks[a];
    if (used.has(taskA.id)) continue;

    for (let b = 0; b < count; b++) {
      if (a === b) continue;
      const taskB = tasks[b];
      if (used.has(taskB.id)) continue;
      if (taskA.siteId === taskB.siteId) continue; // Different sites only

      for (let c = 0; c < count; c++) {
        if (a === c || b === c) continue;
        const taskC = tasks[c];
        if (used.has(taskC.id)) continue;
        if (taskC.siteId === taskA.siteId || taskC.siteId === taskB.siteId) continue;

        // Found a valid triangular group
        await createTriangularMatch(taskA, taskB, taskC);
        used.add(taskA.id);
        used.add(taskB.id);
        used.add(taskC.id);
        matches++;
        break;
      }
    }
  }

  return matches;
}

async function createTriangularMatch(
  taskA: { id: string; siteId: string; anchorKeyword: string; targetUrl: string },
  taskB: { id: string; siteId: string; anchorKeyword: string; targetUrl: string },
  taskC: { id: string; siteId: string; anchorKeyword: string; targetUrl: string }
): Promise<void> {
  // Create match group
  const [group] = await db
    .insert(matchGroups)
    .values({})
    .returning();

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  // Create 3 matches forming a triangle:
  // A -> B (A places link for B using B's anchor keyword)
  // B -> C (B places link for C using C's anchor keyword)
  // C -> A (C places link for A using A's anchor keyword)

  const matchData = [
    { from: taskA, to: taskB, anchor: taskB.anchorKeyword },
    { from: taskB, to: taskC, anchor: taskC.anchorKeyword },
    { from: taskC, to: taskA, anchor: taskA.anchorKeyword },
  ];

  for (const m of matchData) {
    await db.insert(matches).values({
      matchGroupId: group.id,
      fromSiteId: m.from.siteId,
      toSiteId: m.to.siteId,
      fromTaskId: m.from.id,
      toTaskId: m.to.id,
      anchorText: m.anchor,
      targetUrl: m.to.targetUrl,
      status: 'proposed',
      proposedAt: new Date(),
      expiresAt,
    });
  }
}

/**
 * Check if a task has pending matches
 */
export async function getPendingMatchesForTask(taskId: string) {
  return db.query.matches.findMany({
    where: (m, { or, eq }) => or(
      eq(m.fromTaskId, taskId),
      eq(m.toTaskId, taskId)
    ),
    with: {
      fromSite: true,
      toSite: true,
    },
  });
}

/**
 * Get match statistics for a site
 */
export async function getSiteMatchStats(siteId: string) {
  const allMatches = await db.query.matches.findMany({
    where: (m, { or, eq }) => or(
      eq(m.fromSiteId, siteId),
      eq(m.toSiteId, siteId)
    ),
  });

  const stats = {
    proposed: 0,
    accepted: 0,
    placed: 0,
    live: 0,
    deleted: 0,
  };

  for (const match of allMatches) {
    if (match.status in stats) {
      stats[match.status as keyof typeof stats]++;
    }
  }

  return stats;
}
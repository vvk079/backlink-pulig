import { db, activity } from '../db/client.js';
import { eq } from 'drizzle-orm';

export interface ActivityLog {
  action: string;
  entityType: string;
  entityId?: string;
  meta?: Record<string, unknown>;
}

export async function logActivity(siteId: string, data: ActivityLog): Promise<void> {
  await db.insert(activity).values({
    siteId,
    action: data.action,
    entityType: data.entityType,
    entityId: data.entityId,
    meta: JSON.stringify(data.meta || {}),
  });
}

// Common activity actions
export const ActivityActions = {
  SITE_REGISTERED: 'site.registered',
  SITE_VERIFIED: 'site.verified',
  TASK_CREATED: 'task.created',
  TASK_UPDATED: 'task.updated',
  TASK_DELETED: 'task.deleted',
  MATCH_PROPOSED: 'match.proposed',
  MATCH_ACCEPTED: 'match.accepted',
  MATCH_DECLINED: 'match.declined',
  PLACEMENT_CREATED: 'placement.created',
  PLACEMENT_VERIFIED: 'placement.verified',
  PLACEMENT_BROKEN: 'placement.broken',
} as const;
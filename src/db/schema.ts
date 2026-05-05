import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

// Enums
export const siteStatusEnum = pgEnum('site_status', [
  'active',
  'paused',
  'banned',
]);

export const taskStatusEnum = pgEnum('task_status', [
  'pending',
  'active',
  'paused',
]);

export const anchorStrategyEnum = pgEnum('anchor_strategy', [
  'natural',
  'exact',
  'partial',
  'branded',
  'auto',
]);

export const matchStatusEnum = pgEnum('match_status', [
  'pending',
  'proposed',
  'accepted',
  'placed',
  'live',
  'broken',
  'deleted',
]);

export const placementStatusEnum = pgEnum('placement_status', [
  'pending',
  'placed',
  'live',
  'broken',
  'deleted',
]);

// Plans Table
export const plans = pgTable('plans', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  monthlyReceiveCap: integer('monthly_receive_cap').notNull().default(5),
  giveRatio: integer('give_ratio').notNull().default(1),
  receiveRatio: integer('receive_ratio').notNull().default(1),
  daOffsetMin: integer('da_offset_min'),
  daOffsetMax: integer('da_offset_max'),
  daAbsoluteCap: integer('da_absolute_cap'),
  trafficBandPct: integer('traffic_band_pct'),
  trafficFloorPct: integer('traffic_floor_pct'),
  requiresThreeWay: boolean('requires_three_way').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Niches Table (hierarchical)
export const niches = pgTable('niches', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  parentId: text('parent_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Sites Table
export const sites = pgTable(
  'sites',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    url: text('url').notNull(),
    rootDomain: text('root_domain').notNull(),
    apiKey: text('api_key').notNull().unique(),
    apiKeyHash: text('api_key_hash').notNull(),
    nicheId: text('niche_id'),
    daScore: integer('da_score').default(20),
    drScore: integer('dr_score'),
    monthlyTraffic: integer('monthly_traffic').default(1000),
    status: siteStatusEnum('status').notNull().default('active'),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    domainIdx: index('sites_root_domain_idx').on(t.rootDomain),
    apiKeyIdx: uniqueIndex('sites_api_key_idx').on(t.apiKey),
  })
);

// Tasks Table
export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    siteId: uuid('site_id')
      .notNull()
      .references(() => sites.id, { onDelete: 'cascade' }),
    anchorKeyword: text('anchor_keyword').notNull(),
    anchorVariations: text('anchor_variations').array().default(sql`'{}'`),
    brandAnchor: text('brand_anchor'),
    genericAnchors: text('generic_anchors').array().default(sql`ARRAY['click here', 'learn more']`),
    anchorStrategy: anchorStrategyEnum('anchor_strategy').notNull().default('natural'),
    useUrlAnchor: boolean('use_url_anchor').notNull().default(false),
    targetUrl: text('target_url').notNull(),
    nicheId: text('niche_id').notNull(),
    desiredDaMin: integer('desired_da_min').notNull().default(0),
    desiredDaMax: integer('desired_da_max').notNull().default(40),
    desiredTrafficMin: integer('desired_traffic_min'),
    desiredTrafficMax: integer('desired_traffic_max'),
    monthlyReceiveTarget: integer('monthly_receive_target').notNull().default(1),
    maxOutboundPerMonth: integer('max_outbound_per_month').notNull().default(5),
    linksReceivedCount: integer('links_received_count').notNull().default(0),
    linksGivenCount: integer('links_given_count').notNull().default(0),
    status: taskStatusEnum('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    siteIdIdx: index('tasks_site_id_idx').on(t.siteId),
    statusNicheIdx: index('tasks_status_niche_idx').on(t.status, t.nicheId),
  })
);

// Site Pages Table (for indexing)
export const sitePages = pgTable(
  'site_pages',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    siteId: uuid('site_id')
      .notNull()
      .references(() => sites.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    postIdInCms: integer('post_id_in_cms').notNull(),
    title: text('title').notNull(),
    wordCount: integer('word_count').default(0),
    outboundPartnerLinkCount: integer('outbound_partner_link_count').default(0),
    lastModifiedAt: timestamp('last_modified_at', { withTimezone: true }),
    indexedAt: timestamp('indexed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    siteIdx: index('site_pages_site_id_idx').on(t.siteId),
    sitePostUnique: uniqueIndex('site_pages_site_post_unique').on(t.siteId, t.postIdInCms),
  })
);

// Match Groups Table (triangular)
export const matchGroups = pgTable(
  'match_groups',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    createdIdx: index('match_groups_created_idx').on(t.createdAt),
  })
);

// Matches Table
export const matches = pgTable(
  'matches',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    matchGroupId: uuid('match_group_id')
      .notNull()
      .references(() => matchGroups.id, { onDelete: 'cascade' }),
    fromSiteId: uuid('from_site_id')
      .notNull()
      .references(() => sites.id, { onDelete: 'cascade' }),
    toSiteId: uuid('to_site_id')
      .notNull()
      .references(() => sites.id, { onDelete: 'cascade' }),
    fromTaskId: uuid('from_task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    toTaskId: uuid('to_task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    anchorText: text('anchor_text').notNull(),
    targetUrl: text('target_url').notNull(),
    status: matchStatusEnum('status').notNull().default('proposed'),
    proposedAt: timestamp('proposed_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull().default(sql`now() + interval '7 days'`),
    eligibleAt: timestamp('eligible_at', { withTimezone: true }),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    placedAt: timestamp('placed_at', { withTimezone: true }),
  },
  (t) => ({
    fromSiteIdx: index('matches_from_site_idx').on(t.fromSiteId),
    toSiteIdx: index('matches_to_site_idx').on(t.toSiteId),
    statusIdx: index('matches_status_idx').on(t.status),
  })
);

// Placements Table
export const placements = pgTable(
  'placements',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    matchId: uuid('match_id')
      .notNull()
      .references(() => matches.id, { onDelete: 'cascade' }),
    fromSiteId: uuid('from_site_id')
      .notNull()
      .references(() => sites.id, { onDelete: 'cascade' }),
    toSiteId: uuid('to_site_id')
      .notNull()
      .references(() => sites.id, { onDelete: 'cascade' }),
    toTaskId: uuid('to_task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    anchorText: text('anchor_text').notNull(),
    targetUrl: text('target_url').notNull(),
    hostPageUrl: text('host_page_url'),
    htmlSnapshot: text('html_snapshot'),
    status: placementStatusEnum('status').notNull().default('pending'),
    placedAt: timestamp('placed_at', { withTimezone: true }),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    fromSiteIdx: index('placements_from_site_idx').on(t.fromSiteId),
    toSiteIdx: index('placements_to_site_idx').on(t.toSiteId),
    statusIdx: index('placements_status_idx').on(t.status),
  })
);

// Activity Table
export const activity = pgTable(
  'activity',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    siteId: uuid('site_id')
      .notNull()
      .references(() => sites.id, { onDelete: 'cascade' }),
    action: text('action').notNull(),
    entityType: text('entity_type'),
    entityId: uuid('entity_id'),
    meta: text('meta').default('{}'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    siteCreatedIdx: index('activity_site_created_idx').on(t.siteId, t.createdAt),
  })
);

// Types
export type Plan = typeof plans.$inferSelect;
export type NewPlan = typeof plans.$inferInsert;
export type Niche = typeof niches.$inferSelect;
export type NewNiche = typeof niches.$inferInsert;
export type Site = typeof sites.$inferSelect;
export type NewSite = typeof sites.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type SitePage = typeof sitePages.$inferSelect;
export type NewSitePage = typeof sitePages.$inferInsert;
export type MatchGroup = typeof matchGroups.$inferSelect;
export type NewMatchGroup = typeof matchGroups.$inferInsert;
export type Match = typeof matches.$inferSelect;
export type NewMatch = typeof matches.$inferInsert;
export type Placement = typeof placements.$inferSelect;
export type NewPlacement = typeof placements.$inferInsert;
export type ActivityEntry = typeof activity.$inferSelect;
export type NewActivityEntry = typeof activity.$inferInsert;
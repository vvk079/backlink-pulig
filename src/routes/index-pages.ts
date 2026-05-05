import { eq } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { db, sitePages } from '../db/client.js';
import { AppError, asyncHandler, validateBody } from '../lib/errors.js';
import { requireApiKey } from '../middleware/auth.js';

export const indexRouter = Router();

const indexPagesSchema = z.object({
  pages: z.array(z.object({
    url: z.string().url().max(2048),
    post_id_in_cms: z.number().int().positive(),
    title: z.string().min(1).max(500),
    word_count: z.number().int().min(0).optional().default(0),
    outbound_partner_link_count: z.number().int().min(0).optional().default(0),
    last_modified_at: z.string().datetime().optional(),
  })).min(1).max(500),
});

indexRouter.post(
  '/pages',
  requireApiKey,
  validateBody(indexPagesSchema),
  asyncHandler(async (req, res) => {
    const site = req.site!;
    const { pages } = req.body as z.infer<typeof indexPagesSchema>;

    const results = [];
    for (const page of pages) {
      const [createdOrUpdated] = await db
        .insert(sitePages)
        .values({
          siteId: site.id,
          url: page.url,
          postIdInCms: page.post_id_in_cms,
          title: page.title,
          wordCount: page.word_count,
          outboundPartnerLinkCount: page.outbound_partner_link_count,
          lastModifiedAt: page.last_modified_at ? new Date(page.last_modified_at) : null,
          indexedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [sitePages.siteId, sitePages.postIdInCms],
          set: {
            url: page.url,
            title: page.title,
            wordCount: page.word_count,
            outboundPartnerLinkCount: page.outbound_partner_link_count,
            lastModifiedAt: page.last_modified_at ? new Date(page.last_modified_at) : null,
            indexedAt: new Date(),
          },
        })
        .returning();

      results.push({
        url: page.url,
        post_id_in_cms: page.post_id_in_cms,
        indexed: true,
        page_id: createdOrUpdated?.id,
      });
    }

    res.status(201).json({
      indexed: results.length,
      pages: results,
    });
  })
);

indexRouter.get(
  '/stats',
  requireApiKey,
  asyncHandler(async (req, res) => {
    const site = req.site!;

    const totalPages = await db.query.sitePages.findMany({
      where: (p, { eq }) => eq(p.siteId, site.id),
    });

    res.json({
      total_indexed_pages: totalPages.length,
      pages: totalPages.map(p => ({
        id: p.id,
        url: p.url,
        title: p.title,
        word_count: p.wordCount,
        outbound_partner_link_count: p.outboundPartnerLinkCount,
        indexed_at: p.indexedAt,
      })),
    });
  })
);
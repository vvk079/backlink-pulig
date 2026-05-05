import { desc } from 'drizzle-orm';
import { Router } from 'express';
import { db, plans } from '../db/client.js';
import { asyncHandler } from '../lib/errors.js';
import { requireApiKey } from '../middleware/auth.js';

export const plansRouter = Router();

plansRouter.get(
  '/',
  requireApiKey,
  asyncHandler(async (req, res) => {
    const allPlans = await db.query.plans.findMany({
      orderBy: [desc(plans.monthlyReceiveCap)],
    });

    res.json({
      plans: allPlans.map(p => ({
        id: p.id,
        slug: p.slug,
        name: p.name,
        monthly_receive_cap: p.monthlyReceiveCap,
        give_ratio: p.giveRatio,
        receive_ratio: p.receiveRatio,
        da_offset_min: p.daOffsetMin,
        da_offset_max: p.daOffsetMax,
        da_absolute_cap: p.daAbsoluteCap,
        traffic_band_pct: p.trafficBandPct,
        traffic_floor_pct: p.trafficFloorPct,
        requires_three_way: p.requiresThreeWay,
      })),
    });
  })
);
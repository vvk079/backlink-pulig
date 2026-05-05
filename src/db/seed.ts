import { db, niches, plans } from './client.js';

async function seed() {
  console.log('Seeding database...');

  // Seed niches
  const nicheData = [
    { id: 'technology', slug: 'technology', name: 'Technology' },
    { id: 'business', slug: 'business', name: 'Business' },
    { id: 'finance', slug: 'finance', name: 'Finance' },
    { id: 'health', slug: 'health', name: 'Health & Wellness' },
    { id: 'travel', slug: 'travel', name: 'Travel' },
    { id: 'food', slug: 'food', name: 'Food & Cooking' },
    { id: 'lifestyle', slug: 'lifestyle', name: 'Lifestyle' },
    { id: 'education', slug: 'education', name: 'Education' },
    { id: 'sports', slug: 'sports', name: 'Sports' },
    { id: 'entertainment', slug: 'entertainment', name: 'Entertainment' },
    { id: 'real-estate', slug: 'real-estate', name: 'Real Estate' },
    { id: 'fashion', slug: 'fashion', name: 'Fashion' },
  ];

  for (const niche of nicheData) {
    await db.insert(niches).values(niche).onConflictDoNothing();
  }
  console.log(`Seeded ${nicheData.length} niches`);

  // Seed plans
  const planData = [
    {
      id: 'free',
      slug: 'free',
      name: 'Free',
      monthlyReceiveCap: 2,
      giveRatio: 1,
      receiveRatio: 1,
      requiresThreeWay: false,
    },
    {
      id: 'pro',
      slug: 'pro',
      name: 'Pro',
      monthlyReceiveCap: 20,
      giveRatio: 1,
      receiveRatio: 2,
      daOffsetMin: -5,
      daOffsetMax: 10,
      trafficBandPct: 50,
      requiresThreeWay: false,
    },
    {
      id: 'master',
      slug: 'master',
      name: 'Master',
      monthlyReceiveCap: 100,
      giveRatio: 1,
      receiveRatio: 3,
      daAbsoluteCap: 80,
      trafficBandPct: 75,
      trafficFloorPct: 25,
      requiresThreeWay: true,
    },
  ];

  for (const plan of planData) {
    await db.insert(plans).values(plan).onConflictDoNothing();
  }
  console.log(`Seeded ${planData.length} plans`);

  console.log('Seeding complete!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
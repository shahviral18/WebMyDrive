-- SQL script to update WebMyDrive pricing plans
-- Usage: sqlite3 server-php/database/dev.db < server-php/database/update-plans.sql
-- Or paste these commands into your SQLite client

-- Make sure foreign keys are enabled
PRAGMA foreign_keys = ON;

-- Create or update plans
-- First, add missing columns if they don't exist (these will be silently ignored if they exist)
ALTER TABLE "Plan" ADD COLUMN priceINR REAL;
ALTER TABLE "Plan" ADD COLUMN priceMonthlyINR REAL;
ALTER TABLE "Plan" ADD COLUMN priceYearlyINR REAL;
ALTER TABLE "Plan" ADD COLUMN storageGB INTEGER;
ALTER TABLE "Plan" ADD COLUMN features TEXT;
ALTER TABLE "Plan" ADD COLUMN hasOverride INTEGER DEFAULT 0;

-- Delete old plans (optional - comment out if you want to preserve old ones)
-- DELETE FROM "Plan";

-- Insert or update the new plans
--  Plan 1: Basic
INSERT OR REPLACE INTO "Plan" (id, name, price, priceINR, priceMonthlyINR, priceYearlyINR, storageGB, maxUsers, features, isActive, hasOverride, googleSKU, createdAt, updatedAt)
SELECT 
    COALESCE(id, (SELECT MAX(id) + 1 FROM "Plan")),
    'Cloud Storage – Basic',
    3000,
    3000,
    3000,
    36000,
    500,
    1,
    '[
        "500 GB Combined Storage",
        "1 User",
        "Standard Support",
        "₹3000 +GST – 10% OFF",
        "Coupon: tds20"
    ]',
    1,
    1,
    'basic_500gb',
    COALESCE(createdAt, datetime('now')),
    datetime('now')
FROM (
    SELECT id, createdAt FROM "Plan" WHERE name = 'Cloud Storage – Basic' LIMIT 1
    UNION ALL
    SELECT NULL, NULL WHERE NOT EXISTS (SELECT 1 FROM "Plan" WHERE name = 'Cloud Storage – Basic')
);

-- Plan 2: Professional
INSERT OR REPLACE INTO "Plan" (id, name, price, priceINR, priceMonthlyINR, priceYearlyINR, storageGB, maxUsers, features, isActive, hasOverride, googleSKU, createdAt, updatedAt)
SELECT 
    COALESCE(id, (SELECT MAX(id) + 2 FROM "Plan")),
    'Cloud Storage – Professional',
    5000,
    5000,
    5000,
    60000,
    5000,
    5,
    '[
        "5 TB Combined Storage",
        "Up to 5 Users",
        "Priority Support",
        "₹5000 +GST – 20% OFF",
        "Coupon: tds20"
    ]',
    1,
    1,
    'professional_5tb',
    COALESCE(createdAt, datetime('now')),
    datetime('now')
FROM (
    SELECT id, createdAt FROM "Plan" WHERE name = 'Cloud Storage – Professional' LIMIT 1
    UNION ALL
    SELECT NULL, NULL WHERE NOT EXISTS (SELECT 1 FROM "Plan" WHERE name = 'Cloud Storage – Professional')
);

-- Plan 3: Premium
INSERT OR REPLACE INTO "Plan" (id, name, price, priceINR, priceMonthlyINR, priceYearlyINR, storageGB, maxUsers, features, isActive, hasOverride, googleSKU, createdAt, updatedAt)
SELECT 
    COALESCE(id, (SELECT MAX(id) + 3 FROM "Plan")),
    'Cloud Storage – Premium',
    9000,
    9000,
    9000,
    108000,
    50000,
    20,
    '[
        "50 TB Combined Storage",
        "Up to 20 Users",
        "24/7 Premium Support",
        "Advanced Admin Controls",
        "₹9000 +GST – 40% OFF",
        "Coupon: tds40",
        "Best Seller ⭐"
    ]',
    1,
    1,
    'premium_50tb',
    COALESCE(createdAt, datetime('now')),
    datetime('now')
FROM (
    SELECT id, createdAt FROM "Plan" WHERE name = 'Cloud Storage – Premium' LIMIT 1
    UNION ALL
    SELECT NULL, NULL WHERE NOT EXISTS (SELECT 1 FROM "Plan" WHERE name = 'Cloud Storage – Premium')
);

-- Plan 4: Enterprise
INSERT OR REPLACE INTO "Plan" (id, name, price, priceINR, priceMonthlyINR, priceYearlyINR, storageGB, maxUsers, features, isActive, hasOverride, googleSKU, createdAt, updatedAt)
SELECT 
    COALESCE(id, (SELECT MAX(id) + 4 FROM "Plan")),
    'Cloud Storage – Enterprise',
    15000,
    15000,
    15000,
    180000,
    100000,
    100,
    '[
        "100 TB Combined Storage",
        "Unlimited Users",
        "Dedicated Account Manager",
        "Custom SLA",
        "White-label Options",
        "₹15000 +GST – 40% OFF",
        "Coupon: tds40"
    ]',
    1,
    1,
    'enterprise_100tb',
    COALESCE(createdAt, datetime('now')),
    datetime('now')
FROM (
    SELECT id, createdAt FROM "Plan" WHERE name = 'Cloud Storage – Enterprise' LIMIT 1
    UNION ALL
    SELECT NULL, NULL WHERE NOT EXISTS (SELECT 1 FROM "Plan" WHERE name = 'Cloud Storage – Enterprise')
);

-- Display all plans
SELECT 'Final Plans:' as info;
SELECT 
    id,
    name,
    '₹' || priceINR as price,
    storageGB || ' GB' as storage,
    CASE WHEN isActive = 1 THEN '✓' ELSE '✗' END as active
FROM "Plan" 
ORDER BY priceINR ASC;

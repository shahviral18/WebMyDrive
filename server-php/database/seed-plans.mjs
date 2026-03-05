#!/usr/bin/env node
/**
 * seed-plans.mjs — Seed pricing plans to WebMyDrive database
 * Usage: node server-php/database/seed-plans.mjs
 */

import BetterSqlite3 from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'dev.db');

let db;
try {
    db = new BetterSqlite3(dbPath);
    db.pragma('foreign_keys = ON');
} catch (e) {
    console.error(`Error: Could not open database at ${dbPath}`);
    console.error('Run: node server-php/database/migrate.mjs');
    process.exit(1);
}

console.log('Seeding/Updating Pricing Plans...');
console.log('================================\n');

// New plans data
const plans = [
    {
        name: 'Cloud Storage – Basic',
        priceINR: 3000,
        priceMonthlyINR: 3000,
        priceYearlyINR: 36000,
        storageGB: 500,
        maxUsers: 1,
        features: JSON.stringify([
            '500 GB Combined Storage',
            '1 User',
            'Standard Support',
            '₹3000 +GST – 10% OFF',
            'Coupon: tds20'
        ]),
        isActive: 1,
        hasOverride: 1,
        googleSKU: 'basic_500gb',
    },
    {
        name: 'Cloud Storage – Professional',
        priceINR: 5000,
        priceMonthlyINR: 5000,
        priceYearlyINR: 60000,
        storageGB: 5000,  // 5 TB
        maxUsers: 5,
        features: JSON.stringify([
            '5 TB Combined Storage',
            'Up to 5 Users',
            'Priority Support',
            '₹5000 +GST – 20% OFF',
            'Coupon: tds20'
        ]),
        isActive: 1,
        hasOverride: 1,
        googleSKU: 'professional_5tb',
    },
    {
        name: 'Cloud Storage – Premium',
        priceINR: 9000,
        priceMonthlyINR: 9000,
        priceYearlyINR: 108000,
        storageGB: 50000,  // 50 TB
        maxUsers: 20,
        features: JSON.stringify([
            '50 TB Combined Storage',
            'Up to 20 Users',
            '24/7 Premium Support',
            'Advanced Admin Controls',
            '₹9000 +GST – 40% OFF',
            'Coupon: tds40',
            'Best Seller ⭐'
        ]),
        isActive: 1,
        hasOverride: 1,
        googleSKU: 'premium_50tb',
    },
    {
        name: 'Cloud Storage – Enterprise',
        priceINR: 15000,
        priceMonthlyINR: 15000,
        priceYearlyINR: 180000,
        storageGB: 100000,  // 100 TB
        maxUsers: 100,
        features: JSON.stringify([
            '100 TB Combined Storage',
            'Unlimited Users',
            'Dedicated Account Manager',
            'Custom SLA',
            'White-label Options',
            '₹15000 +GST – 40% OFF',
            'Coupon: tds40'
        ]),
        isActive: 1,
        hasOverride: 1,
        googleSKU: 'enterprise_100tb',
    },
];

const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

// Check if required columns exist
try {
    db.prepare('SELECT priceMonthlyINR FROM "Plan" LIMIT 1').get();
} catch (e) {
    console.log('Migrating Plan table schema...\n');
    const alterStatements = [
        'ALTER TABLE "Plan" ADD COLUMN priceINR REAL',
        'ALTER TABLE "Plan" ADD COLUMN priceMonthlyINR REAL',
        'ALTER TABLE "Plan" ADD COLUMN priceYearlyINR REAL',
        'ALTER TABLE "Plan" ADD COLUMN storageGB INTEGER',
        'ALTER TABLE "Plan" ADD COLUMN features TEXT',
        'ALTER TABLE "Plan" ADD COLUMN hasOverride INTEGER DEFAULT 0',
    ];
    
    for (const stmt of alterStatements) {
        try {
            db.exec(stmt);
            console.log(`  ✓ Applied: ${stmt}`);
        } catch (err) {
            // Column might already exist, skip silently
        }
    }
    console.log('\n');
}

// Add isActive column if it doesn't exist (we'll use isVisible from the schema)
try {
    db.prepare('SELECT isActive FROM "Plan" LIMIT 1').get();
} catch (e) {
    // Column doesn't exist, we'll use isVisible instead
}

// Upsert plans
for (const plan of plans) {
    const check = db.prepare('SELECT id FROM "Plan" WHERE name = ?').get(plan.name);
    
    if (check) {
        // Update existing plan
        db.prepare(`
            UPDATE "Plan" SET 
                price = ?,
                priceINR = ?,
                priceMonthlyINR = ?,
                priceYearlyINR = ?,
                storageGB = ?,
                storage = ?,
                maxUsers = ?,
                features = ?,
                isVisible = ?,
                hasOverride = ?,
                googleSKU = ?,
                updatedAt = ?
            WHERE name = ?
        `).run(
            plan.priceINR,
            plan.priceINR,
            plan.priceMonthlyINR,
            plan.priceYearlyINR,
            plan.storageGB,
            plan.storageGB,
            plan.maxUsers,
            plan.features,
            plan.isActive,
            plan.hasOverride,
            plan.googleSKU,
            now,
            plan.name
        );
        console.log(`✓ Updated: ${plan.name}`);
    } else {
        // Insert new plan
        db.prepare(`
            INSERT INTO "Plan" (
                name, price, priceINR, priceMonthlyINR, priceYearlyINR,
                storageGB, storage, maxUsers, features, isVisible, hasOverride,
                googleSKU, createdAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            plan.name,
            plan.priceINR,
            plan.priceINR,
            plan.priceMonthlyINR,
            plan.priceYearlyINR,
            plan.storageGB,
            plan.storageGB,
            plan.maxUsers,
            plan.features,
            plan.isActive,
            plan.hasOverride,
            plan.googleSKU,
            now,
            now
        );
        console.log(`✓ Inserted: ${plan.name}`);
    }
}

// Display final plans
console.log('\n================================');
console.log('Final Plans in Database:');
console.log('================================\n');

const allPlans = db.prepare(
    'SELECT id, name, priceINR, storageGB, isVisible FROM "Plan" ORDER BY priceINR ASC'
).all();

for (const p of allPlans) {
    const status = p.isVisible ? '✓' : '✗';
    console.log(`${status} ${p.name}`);
    console.log(`  └─ Price: ₹${p.priceINR} | Storage: ${p.storageGB} GB | ID: ${p.id}\n`);
}

console.log('================================');
console.log('✓ Plans seeded successfully!');

db.close();

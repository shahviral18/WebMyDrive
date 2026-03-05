#!/usr/bin/env node
/**
 * update-plans.mjs — Update WebMyDrive pricing plans via API
 * Usage: node update-plans.mjs
 * 
 * Note: Backend server must be running
 */

const API_BASE = 'http://localhost:3000/api';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || ''; // Set this as env variable

const plans = [
    {
        name: 'Cloud Storage – Basic',
        priceINR: 3000,
        priceMonthlyINR: 3000,
        priceYearlyINR: 36000,
        storageGB: 500,
        maxUsers: 1,
        features: [
            '500 GB Combined Storage',
            '1 User',
            'Standard Support',
            '₹3000 +GST – 10% OFF',
            'Coupon: tds20'
        ],
        isActive: true,
        hasOverride: true,
        googleSKU: 'basic_500gb',
    },
    {
        name: 'Cloud Storage – Professional',
        priceINR: 5000,
        priceMonthlyINR: 5000,
        priceYearlyINR: 60000,
        storageGB: 5000,
        maxUsers: 5,
        features: [
            '5 TB Combined Storage',
            'Up to 5 Users',
            'Priority Support',
            '₹5000 +GST – 20% OFF',
            'Coupon: tds20'
        ],
        isActive: true,
        hasOverride: true,
        googleSKU: 'professional_5tb',
    },
    {
        name: 'Cloud Storage – Premium',
        priceINR: 9000,
        priceMonthlyINR: 9000,
        priceYearlyINR: 108000,
        storageGB: 50000,
        maxUsers: 20,
        features: [
            '50 TB Combined Storage',
            'Up to 20 Users',
            '24/7 Premium Support',
            'Advanced Admin Controls',
            '₹9000 +GST – 40% OFF',
            'Coupon: tds40',
            'Best Seller ⭐'
        ],
        isActive: true,
        hasOverride: true,
        googleSKU: 'premium_50tb',
    },
    {
        name: 'Cloud Storage – Enterprise',
        priceINR: 15000,
        priceMonthlyINR: 15000,
        priceYearlyINR: 180000,
        storageGB: 100000,
        maxUsers: 100,
        features: [
            '100 TB Combined Storage',
            'Unlimited Users',
            'Dedicated Account Manager',
            'Custom SLA',
            'White-label Options',
            '₹15000 +GST – 40% OFF',
            'Coupon: tds40'
        ],
        isActive: true,
        hasOverride: true,
        googleSKU: 'enterprise_100tb',
    },
];

async function updatePlans() {
    console.log('Updating WebMyDrive Pricing Plans...');
    console.log('====================================\n');

    for (const plan of plans) {
        try {
            const response = await fetch(`${API_BASE}/admin/plans`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(ADMIN_TOKEN ? { 'Authorization': `Bearer ${ADMIN_TOKEN}` } : {}),
                },
                body: JSON.stringify(plan),
            });

            if (!response.ok) {
                const errorData = await response.text();
                console.log(`✗ ${plan.name} - Error: ${response.status}`);
                console.log(`  ${errorData}\n`);
            } else {
                console.log(`✓ ${plan.name} - Updated successfully`);
                console.log(`  Price: ₹${plan.priceINR} | Storage: ${plan.storageGB} GB\n`);
            }
        } catch (error) {
            console.log(`✗ ${plan.name} - Network Error: ${error.message}\n`);
        }
    }

    console.log('====================================');
    console.log('Plan update complete!');
    console.log('\nNote: Make sure your backend is running on http://localhost:3000');
}

updatePlans().catch(console.error);

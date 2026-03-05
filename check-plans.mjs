import BetterSqlite3 from 'better-sqlite3';

const db = new BetterSqlite3('./server-php/database/dev.db');

// Get all active plans
const plans = db.prepare('SELECT * FROM "Plan" WHERE isVisible = 1 ORDER BY price ASC').all();

console.log('\n=== Active Plans (as seen by users) ===\n');
plans.forEach(p => {
  console.log(p.name);
  console.log('  Price: ₹' + (p.priceINR || p.price));
  console.log('  Storage: ' + (p.storageGB || p.storage) + ' GB');
  console.log('  Users: ' + p.maxUsers);
  if (p.features) {
    try {
      const features = JSON.parse(p.features);
      console.log('  Features:', features.slice(0, 3).join(', ') + '...');
    } catch (e) {}
  }
  console.log('');
});

db.close();

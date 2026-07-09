import type { Database as SqlJsDatabase } from 'sql.js';

export function seedDefaultData(db: SqlJsDatabase): void {
  const result = db.exec('SELECT COUNT(*) as count FROM categories');
  const count = result[0]?.values[0]?.[0] || 0;

  if (count === 0) {
    const categories = [
      ['cat-dairy', 'Dairy'],
      ['cat-bakery', 'Bakery'],
      ['cat-grains', 'Grains'],
      ['cat-cooking', 'Cooking'],
      ['cat-beverages', 'Beverages'],
      ['cat-personal', 'Personal Care'],
      ['cat-cleaning', 'Cleaning'],
      ['cat-snacks', 'Snacks'],
      ['cat-canned', 'Canned Goods'],
      ['cat-stationery', 'Stationery'],
    ];

    for (const [id, name] of categories) {
      db.run('INSERT INTO categories (id, name) VALUES (?, ?)', [id, name]);
    }
  }

  const settingsResult = db.exec('SELECT COUNT(*) as count FROM settings');
  const settingsCount = settingsResult[0]?.values[0]?.[0] || 0;

  if (settingsCount === 0) {
    const settings: [string, string][] = [
      ['shop_name', "Mom's Shop"],
      ['shop_phone', ''],
      ['shop_address', ''],
      ['currency', 'GHS'],
      ['receipt_header', "Mom's Shop"],
      ['receipt_footer', 'Thank you for your purchase!'],
      ['receipt_note', ''],
      ['printer_type', 'none'],
      ['printer_paper_size', '80'],
      ['low_stock_threshold', '10'],
      ['cloud_sync_enabled', 'false'],
      ['setup_complete', 'false'],
    ];

    for (const [key, value] of settings) {
      db.run('INSERT INTO settings (key, value) VALUES (?, ?)', [key, value]);
    }
  }
}

import { test, expect } from '@playwright/test';

// This test injects axe-core into each route and writes a JSON report
import fs from 'fs';

const routes = ['/', '/sales', '/products', '/inventory', '/customers', '/reports', '/settings'];

test('site-wide accessibility audit (axe)', async ({ page }) => {
  await page.goto('http://localhost:5174/');
  // fetch axe from CDN
  await page.addScriptTag({ url: 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.8.3/axe.min.js' });

  const summary: Record<string, { violations: any[] }> = {};

  for (const route of routes) {
    await page.goto('http://localhost:5174' + route);
    await page.waitForLoadState('networkidle');
    const result = await page.evaluate(async () => {
      // @ts-ignore
      const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } });
      return r;
    });

    summary[route] = { violations: result.violations };
  }

  const outDir = 'reports/accessibility';
  try { fs.mkdirSync(outDir, { recursive: true }); } catch (e) {}
  fs.writeFileSync(`${outDir}/web-axe.json`, JSON.stringify(summary, null, 2));

  // simple assertion: the test will not fail on violations but will save the report
  expect(Object.keys(summary).length).toBeGreaterThan(0);
});

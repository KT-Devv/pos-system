**Accessibility Report (site-wide)**

- Summary: Run the Playwright accessibility test to generate a full JSON report.
- Report file: [reports/accessibility/web-axe.json](reports/accessibility/web-axe.json)

How to generate the report locally:

```bash
# 1. Serve the web app (dev server)
cd packages/web
npm run dev

# 2. In another terminal, run the Playwright test
npx playwright test packages/web/tests/accessibility.spec.ts --project=chromium
```

The test saves a JSON report at `reports/accessibility/web-axe.json`. Open it to inspect violations per route.

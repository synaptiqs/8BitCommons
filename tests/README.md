# FlopSource Playwright Tests

This folder contains end-to-end tests for the FlopSource frontend, especially the parts that were historically fragile:

- Floating comparison tray
- "Compare Providers" button
- Theme toggle (light ↔ dark bento) via the logo
- "Ask Grok" AI button in the comparison modal

## Running the tests

```bash
# Run all tests (headless)
npm test

# Run with UI (recommended for debugging)
npm run test:ui

# Run with browser visible
npm run test:headed
```

Playwright will automatically start a static server for the `website/` folder on port 8765 during test runs.

## Key Tests

- `basic.spec.ts` — Basic loading + filtering
- `comparison.spec.ts` — The important stuff (theme toggle while tray is open, opening modal, "Ask Grok" button presence in both themes)

These tests were added specifically to catch regressions on the recurring "Compare Providers button stops working" issues.

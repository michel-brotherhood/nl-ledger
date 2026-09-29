// node brand/src/shot.cjs <url|file> <out.png> [width] [dpr] [height|full] [dark]
// Needs Playwright with Chromium: npm install --no-save playwright && npx playwright install chromium
const { chromium } = require('playwright');
(async () => {
  const [url, out, w = 1200, dpr = 1, h = 'full', dark] = process.argv.slice(2);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: +w, height: h === 'full' ? 800 : +h }, deviceScaleFactor: +dpr, colorScheme: dark ? 'dark' : 'light' });
  await p.goto(url.startsWith('http') || url.startsWith('file:') ? url : 'file://' + require('path').resolve(url));
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(300);
  await p.screenshot({ path: out, fullPage: h === 'full' });
  await b.close();
})();

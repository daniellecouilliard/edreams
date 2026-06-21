const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BUNDLES_DIR = path.join(__dirname, 'bundles');
if (!fs.existsSync(BUNDLES_DIR)) fs.mkdirSync(BUNDLES_DIR);

(async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
  });
  const page = await browser.newPage();
  
  // Set a realistic user agent
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  // Try to bypass simple bot detections
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false,
    });
  });

  page.on('response', async (response) => {
    const url = response.url();
    const contentType = response.headers()['content-type'] || '';
    
    if (url.includes('.js') || contentType.includes('javascript')) {
      try {
        const buffer = await response.buffer();
        const urlObj = new URL(url);
        let fileName = path.basename(urlObj.pathname);
        if (!fileName) fileName = 'index.js';
        
        const safeName = fileName.replace(/[^a-zA-Z0-9.\-_]/g, '_');
        const hash = crypto.createHash('md5').update(url).digest('hex').slice(0, 6);
        const finalName = safeName.endsWith('.js') ? `${hash}_${safeName}` : `${hash}_${safeName}.js`;
        
        fs.writeFileSync(path.join(BUNDLES_DIR, finalName), buffer);
      } catch (err) {
        // Some responses fail (e.g. CORS preflights or aborted)
      }
    }
  });

  console.log("Navigating to eDreams...");
  try {
    // Go to a deep link or homepage
    await page.goto('https://www.edreams.com/', { waitUntil: 'networkidle2', timeout: 45000 });
    
    console.log("Waiting 10 seconds for any lazy-loaded bundles...");
    await new Promise(r => setTimeout(r, 10000));
    
    console.log(`Finished downloading JS bundles to ${BUNDLES_DIR}`);
  } catch(e) {
    console.error("Navigation error:", e.message);
  } finally {
    await browser.close();
  }
})();

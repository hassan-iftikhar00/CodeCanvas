const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

(async () => {
  // Allow passing a custom URL, or default to localhost:3000
  const url = process.argv[2] || "http://localhost:3000";
  const dir = "./tmp";

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }

  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();

  // Set to a standard desktop viewport size
  await page.setViewport({ width: 1280, height: 800 });

  try {
    console.log(`Rendering ${url}...`);
    await page.goto(url, { waitUntil: "networkidle2", timeout: 15000 });

    const outputPath = path.join(dir, "ui-screenshot.png");
    await page.screenshot({ path: outputPath });
    console.log(`SUCCESS: Captured screenshot at ${outputPath}`);
  } catch (err) {
    console.error(`ERROR: Failed to capture UI. ${err.message}`);
  } finally {
    await browser.close();
  }
})();

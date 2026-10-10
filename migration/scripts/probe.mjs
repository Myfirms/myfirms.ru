// Ad-hoc DOM probe of a live page via local Edge: prints JSON returned by an
// expression evaluated in the page. Usage: node scripts/probe.mjs /path/ "<js expr>"
import puppeteer from 'puppeteer-core';

const [path, expr] = process.argv.slice(2);
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: true, acceptInsecureCerts: true, args: ['--ignore-certificate-errors'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.goto('https://myfirms.ru' + path, { waitUntil: 'networkidle2', timeout: 90000 });
console.log(JSON.stringify(await page.evaluate(`(async () => (${expr}))()`), null, 1));
await browser.close();

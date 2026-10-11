// Browser regression: random-mode defaults, persistence, resume and post-win deals.
// Run with the local server on port 8123: node tools/random-themecheck.mjs
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
const require = createRequire(homedir() + '/Documents/mahjpods/film/package.json');
const puppeteer = require('puppeteer-core');
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 800, height: 450 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('response', (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  await page.evaluateOnNewDocument(() => {
    if (!localStorage.getItem('freecellworlds.settings')) {
      localStorage.setItem('freecellworlds.settings', JSON.stringify({ theme: 'roman', quality: 'low', reducedMotion: true, autoFoundation: false }));
    }
  });
  const check = (label, ok) => { if (!ok) throw new Error(label); console.log('PASS', label); };
  const ready = () => page.waitForFunction(() => !document.getElementById('loader'), { timeout: 90000 });
  const settle = () => page.waitForFunction(() => !FreeCell.busy, { timeout: 150000 });
  const theme = () => page.evaluate(() => document.body.dataset.theme);
  const state = () => page.evaluate(() => JSON.stringify(FreeCell.getState()));
  const newDeal = async (n) => { await page.evaluate((n) => FreeCell.newGame(n), n); await settle(); };
  const toggle = (value) => page.$eval('#set-random-theme', (el, value) => { el.checked = value; el.dispatchEvent(new Event('change')); }, value);
  await page.goto('http://localhost:8123/');
  await ready();
  const initial = await theme();
  check('launch randomizes the remembered theme', initial !== 'roman');
  check('Random is first, selected, and enabled by default', await page.evaluate(() => {
    const first = document.querySelector('#theme-row').firstElementChild;
    return first.classList.contains('theme-random') && first.classList.contains('selected') && document.getElementById('set-random-theme').checked;
  }));
  await newDeal(1);
  check('a fresh game uses a different theme', await theme() !== initial);
  const inGame = await theme();
  await page.click('#btn-home');
  await page.click('#btn-play');
  check('continuing the active game preserves its theme', await theme() === inGame);
  await toggle(false);
  await newDeal(2);
  check('turning automatic themes off preserves the theme for new games', await theme() === inGame);
  await page.reload();
  await ready();
  check('off preference and fixed theme survive reload', await theme() === inGame && await page.$eval('#set-random-theme', (el) => !el.checked));
  await page.click('#theme-row .theme-random');
  await page.waitForFunction(() => !document.querySelector('.theme-random').disabled);
  check('Random reenables automatic themes', await page.$eval('#set-random-theme', (el) => el.checked));
  await page.click('#btn-title-themes');
  await page.click('#theme-grid [data-theme="jetset"]');
  await page.waitForFunction(() => document.body.dataset.theme === 'jetset');
  check('choosing a named theme switches to fixed mode', await page.$eval('#set-random-theme', (el) => !el.checked));
  await toggle(true);
  await newDeal(1);
  const preWinTheme = await theme();
  const result = await page.evaluate(() => FreeCell.advance(10000));
  check('fixture solves the complete board', result.total > 0 && result.remaining === 0);
  await page.waitForFunction(() => FreeCell.isWon() && document.getElementById('win-overlay').classList.contains('show'));
  await page.click('#btn-win-new');
  await settle();
  check('Deal again after a win randomizes the next board', await theme() !== preWinTheme && !await page.evaluate(() => FreeCell.isWon()));
  await newDeal(1);
  await page.evaluate(() => FreeCell.advance(1));
  await settle();
  const savedTheme = await theme();
  const savedState = await state();
  await page.reload();
  await ready();
  check('home launch gets another random preview', await theme() !== savedTheme);
  await page.click('#btn-play');
  await settle();
  check('saved-game resume restores the board and its theme', await theme() === savedTheme && await state() === savedState);
  check('no browser or HTTP errors', errors.length === 0);
} finally {
  await browser.close();
}

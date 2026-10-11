import { THEMES, THEME_ORDER } from '../js/themes.js';
import { createRun, startBoard, winBoard, pickCharm, loseRun, runView } from '../js/voyage/run.js';
import { nextChoices } from '../js/voyage/map.js';
import { voyageUI } from '../js/voyage/ui.js';
import { ui } from '../js/ui.js';
import { voyageStats } from '../js/voyage/stats.js';

// Use the production markup so this page stays a faithful, standalone DOM preview.
const html = await (await fetch('../index.html')).text();
const source = new DOMParser().parseFromString(html, 'text/html');
for (const id of ['title-screen', 'hud', 'voyage-hud', 'voyage-map', 'voyage-intro', 'voyage-result', 'voyage-end', 'voyage-confirm', 'voyage-tutorial', 'voyage-tooltip', 'modal-stats', 'modal-settings', 'modal-themes']) {
  document.body.append(source.getElementById(id));
}
const fakeHistory = (board) => [
  ...Array.from({ length: 12 + board * 2 }, () => ({ t: 'T' })),
  ...Array.from({ length: 52 }, () => ({ t: 'F' })),
];
const run = createRun({ seed: 'voyage-ui-preview' });
const snapshot = (r) => structuredClone(runView(r));
const scenes = [{ id: 'title-classic', title: 'Title · Classic', view: snapshot(run) }, { id: 'title-voyage', title: 'Title · Voyage', view: snapshot(run) }, { id: 'map1', title: 'Map · first choice', view: snapshot(run) }];
for (let board = 1; board <= 7; board++) {
  const choice = nextChoices(run.map)[board % 2 === 0 ? 0 : Math.min(1, nextChoices(run.map).length - 1)];
  startBoard(run, choice.id, { deal: 12000 + board, par: 78 + board * 3, score: 2.5 });
  scenes.push({ id: `intro${board}`, title: `Intro · board ${board}`, view: snapshot(run) });
  scenes.push({ id: `hud${board}`, title: `HUD · board ${board}`, view: snapshot(run) });
  if (board === 7) scenes.push({ id: 'map-final', title: 'Map · boss row', view: snapshot(run) });
  winBoard(run, fakeHistory(board), null, { elapsed: 150 + board * 32 });
  scenes.push({ id: `result${board}`, title: `Result · board ${board}`, view: snapshot(run) });
  if (run.status === 'reward') pickCharm(run, run.reward.offers[0]);
  if (run.status === 'map') scenes.push({ id: `map${board + 1}`, title: `Map · board ${board + 1}`, view: snapshot(run) });
}
scenes.push({ id: 'end-win', title: 'Run end · victory', view: snapshot(run) });
scenes.unshift({ id: 'title-classic-run', title: 'Title · Classic with run', view: scenes.find((s) => s.id === 'map3').view }, { id: 'title-voyage-run', title: 'Title · Continue Voyage', view: scenes.find((s) => s.id === 'map3').view });
const lost = createRun({ seed: 'voyage-ui-preview-lost' });
startBoard(lost, nextChoices(lost.map)[0].id, { deal: 9331, par: 82, score: 2.5 });
loseRun(lost, 'stuck');
scenes.push({ id: 'end-loss', title: 'Run end · defeat', view: snapshot(lost) });
scenes.push({ id: 'confirm', title: 'Confirm dialog', view: snapshot(lost) });
scenes.push({ id: 'stats', title: 'Voyage stats', view: snapshot(run) });
scenes.push({ id: 'tutorial-map', title: 'Tutorial · map', view: scenes.find((s) => s.id === 'map1').view });
scenes.push({ id: 'tutorial-board', title: 'Tutorial · board', view: scenes.find((s) => s.id === 'hud1').view });
scenes.push({ id: 'tutorial-reward', title: 'Tutorial · reward', view: scenes.find((s) => s.id === 'result1').view });

const screen = document.getElementById('preview-screen');
const themeSelect = document.getElementById('preview-theme');
for (const scene of scenes) screen.add(new Option(scene.title, scene.id));
for (const id of THEME_ORDER) themeSelect.add(new Option(THEMES[id].name, id));
const params = new URLSearchParams(location.search);
if (params.has('clean')) document.body.classList.add('preview-clean');
let activeScene = params.get('screen') || 'map1';
let activeTheme = params.get('theme') || 'roman';
let focusScene = null;
const stats = { runs: 8, wins: 3, losses: 5, boardsCleared: 34, bestBoard: 7, bestScore: 13782, bestStars: 18, winStreak: 1, bestWinStreak: 2, themeClears: { zen: 6, roman: 5, aero: 4 }, charmPicks: Object.fromEntries(run.boons.map((id, i) => [id, i + 2])), recent: [{ won: true, board: 7, score: 13782, stars: 18 }, { won: false, board: 5, score: 6800, stars: 9 }] };
Object.assign(voyageStats, stats);
ui.els.title = document.getElementById('title-screen');
ui.setHero = (url) => { const hero = document.getElementById('hero-a'); hero.src = new URL(`../${url.replace(/^\.\//, '')}`, import.meta.url).href; hero.classList.add('show'); };
ui.handlers.theme = (id) => { activeTheme = id; applyTheme(id); };
ui.handlers.randomTheme = () => { activeTheme = THEME_ORDER[Math.floor(Math.random() * THEME_ORDER.length)]; applyTheme(activeTheme); };
ui.buildThemeUI();
ui.refreshDaily();
document.querySelectorAll('.theme-card img, .theme-big img').forEach((img) => { img.src = new URL(`../${img.getAttribute('src').replace(/^\.\//, '')}`, import.meta.url).href; });
for (const name of ['classic', 'voyage']) {
  const tab = document.getElementById(`title-tab-${name}`);
  tab.addEventListener('click', () => ui.setTitleMode(name));
  tab.addEventListener('keydown', (event) => {
    const next = event.key === 'ArrowRight' || event.key === 'ArrowLeft' ? (name === 'classic' ? 'voyage' : 'classic') : event.key === 'Home' ? 'classic' : event.key === 'End' ? 'voyage' : null;
    if (next) { event.preventDefault(); ui.setTitleMode(next); document.getElementById(`title-tab-${next}`).focus(); }
  });
}
document.getElementById('btn-title-deal-reveal').addEventListener('click', () => { const wrap = document.getElementById('title-deal-wrap'); wrap.hidden = !wrap.hidden; document.getElementById('btn-title-deal-reveal').setAttribute('aria-expanded', String(!wrap.hidden)); });

voyageUI.init({
  startVoyage: () => show('map1'), continueVoyage: () => show('map1'),
  pickNode: () => show(`intro${Math.min(7, (focusScene?.view.results.length || 0) + 1)}`),
  pickCharm: () => show(`map${Math.min(7, (focusScene?.view.results.length || 0) + 1)}`),
  continueToMap: () => show('map1'), showRunEnd: () => show('end-win'),
  abandonBoard: async () => { if (await voyageUI.confirm({ title: 'Abandon run?', text: 'This voyage will end.', ok: 'Abandon' })) show('end-loss'); },
  openMap: () => voyageUI.showMap(focusScene.view), toMenu: () => show('title-voyage'),
});
function applyTheme(id) {
  const t = THEMES[id] || THEMES.roman;
  ui.applyThemeCss(t);
  themeSelect.value = t.id;
}
function show(id) {
  const scene = scenes.find((s) => s.id === id) || scenes[1];
  activeScene = scene.id; focusScene = scene; screen.value = scene.id;
  voyageUI.hideAll();
  document.getElementById('modal-stats').classList.remove('show');
  document.getElementById('title-screen').classList.add('hidden');
  document.getElementById('hud').classList.add('hidden');
  document.body.dataset.mode = 'classic';
  const view = scene.view;
  if (id.startsWith('title-')) {
    voyageUI.refreshTitle({ run: id.endsWith('-run') ? view : null, daily: { key: '2026-10-10', result: null } });
    document.getElementById('title-screen').classList.remove('hidden');
    ui.setTitleMode(id.includes('voyage') ? 'voyage' : 'classic', { persist: false });
  } else if (id.startsWith('map') || id === 'tutorial-map') {
    voyageUI.setMode('voyage');
    voyageUI.showMap(view);
    if (id === 'tutorial-map') { voyageUI.tutorialSeen.map = false; voyageUI.tutorial('map'); }
  } else if (id.startsWith('intro')) {
    voyageUI.setMode('voyage');
    voyageUI.showBoardIntro(view);
  } else if (id.startsWith('hud') || id === 'tutorial-board') {
    voyageUI.setMode('voyage');
    document.getElementById('hud').classList.remove('hidden');
    voyageUI.setHud(view);
    voyageUI.setLiveScore({ total: 1100, stars: 2, thresholds: view.current.starThresholds });
    if (id === 'tutorial-board') { voyageUI.tutorialSeen.board = false; voyageUI.tutorial('board'); }
  } else if (id.startsWith('result') || id === 'tutorial-reward') {
    voyageUI.setMode('voyage');
    voyageUI.showResult(view);
    if (id === 'tutorial-reward') { voyageUI.tutorialSeen.reward = false; voyageUI.tutorial('reward'); }
  } else if (id.startsWith('end-')) {
    voyageUI.setMode('voyage'); voyageUI.showRunEnd(view);
  } else if (id === 'confirm') {
    voyageUI.confirm({ title: 'Abandon voyage?', text: 'This run will end and the route will be lost.', ok: 'Abandon run', cancel: 'Keep sailing' });
  } else if (id === 'stats') {
    voyageUI.renderStats(stats); voyageUI.statsTab('voyage'); document.getElementById('modal-stats').classList.add('show');
  }
  history.replaceState(null, '', `?screen=${scene.id}&theme=${activeTheme}${document.body.classList.contains('preview-clean') ? '&clean=1' : ''}`);
}
screen.addEventListener('change', () => show(screen.value));
themeSelect.addEventListener('change', () => { activeTheme = themeSelect.value; applyTheme(activeTheme); show(activeScene); });
document.getElementById('preview-next').addEventListener('click', () => show(scenes[(scenes.findIndex((s) => s.id === activeScene) + 1) % scenes.length].id));
applyTheme(activeTheme); show(activeScene);
window.preview = { scenes, show, applyTheme, voyageUI };

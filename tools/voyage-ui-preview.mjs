import { THEMES, THEME_ORDER } from '../js/themes.js';
import { createRun, startBoard, winBoard, pickCharm, loseRun, runView } from '../js/voyage/run.js';
import { nextChoices } from '../js/voyage/map.js';
import { leavePort } from '../js/voyage/port.js';
import { buildCardMesh, setCardMark, setCardSticker, setCardConcealed, applyCardStyle } from '../js/card.js';
import { setCardTheme } from '../js/textures.js';
import { voyageUI } from '../js/voyage/ui.js';
import { ui } from '../js/ui.js';
import { voyageStats } from '../js/voyage/stats.js';

// Use the production markup so this page stays a faithful, standalone DOM preview.
const html = await (await fetch('../index.html')).text();
const source = new DOMParser().parseFromString(html, 'text/html');
for (const id of ['title-screen', 'hud', 'voyage-hud', 'voyage-dock', 'voyage-map', 'voyage-port', 'voyage-sticker-picker', 'voyage-intro', 'voyage-result', 'voyage-end', 'voyage-confirm', 'voyage-tutorial', 'voyage-tooltip', 'modal-stats', 'modal-settings', 'modal-themes']) {
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
  while (run.status === 'reward') pickCharm(run, run.reward.offers[0]);
  if (run.status === 'port') leavePort(run);
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

// Explicit v2 view-model fixtures cover data independently of the parallel engine work.
const fixtureBoon = (id, name, family, text, upgradeText, level = 1) => ({ id, name, family, text, upgradeText, level, kind: 'boon', icon: '✦', theme: 'roman', placeholder: true, pressure: false, hidden: false });
const fixtureBoons = [
  fixtureBoon('preview.cell', 'Travelling Cell', 'cells', 'Carry one extra free cell.', 'Carry two extra free cells.', 2),
  fixtureBoon('preview.coin', 'Harbour Purse', 'coin', 'Earn a coin for each early home.', 'Earn two coins for each early home.'),
  fixtureBoon('preview.vision', 'Lookout', 'vision', 'Preview the next three moves.', 'Preview the next five moves.'),
];
const stickerFixture = ['wild', 'fool', 'key', 'gold', 'lucky'].map((type, i) => ({ card: 1 + i * 13 % 52 + (i === 4 ? 1 : 0), type }));
for (const scene of scenes) {
  const view = scene.view;
  view.coins ??= 86;
  view.stickers = structuredClone(stickerFixture);
  if (view.current) { view.current.undoGrants = 1; view.current.undoCap = 3; }
  if (view.boons.length) view.boons[0] = { ...view.boons[0], level: 2, family: 'cells', upgradeText: 'Carry two extra free cells.' };
  view.markets ??= [];
  for (const result of view.results) {
    result.coins ??= 38;
    result.coinLines ??= [{ label: 'Table cleared', coins: 10 }, { label: 'Three stars', coins: 18 }, { label: 'Score dividend', coins: 5 }, { label: 'Gold sticker', coins: 5 }];
  }
}
const portBase = structuredClone(scenes.find((s) => s.id === 'map3').view);
portBase.status = 'port'; portBase.coins = 86; portBase.boons = structuredClone(fixtureBoons);
portBase.port = {
  kind: 'stickers',
  name: 'Sticker market',
  coins: 86,
  boons: [fixtureBoon('preview.wild', 'Prism', 'wild', 'One rank ignores colour when stacking.', 'Two ranks ignore colour when stacking.'), fixtureBoon('preview.ability', 'Second Wind', 'ability', 'Play the next solver move once.', 'Play the next solver move twice.'), fixtureBoon('preview.foundation', 'Homeward', 'foundation', 'Start one ace at home.', 'Start two aces at home.')].map((charm, i) => ({ charm, price: i === 1 ? 60 : 45, sold: false })),
  stickers: [
    { type: 'wild', name: 'Wild', text: 'Ignores colour when stacking.', price: 30, sold: false },
    { type: 'gold', name: 'Gold', text: '+5 coins when this card goes home early.', price: 20, sold: false },
    { type: 'key', name: 'Key', text: 'Ignores free-cell restrictions.', price: 25, sold: false },
  ],
  upgrades: fixtureBoons.slice(1).map((charm) => ({ charm, price: 40 })),
  provisions: { price: 15, left: 3 },
  sell: fixtureBoons.map((charm) => ({ charm, price: 20 })), reroll: { price: 10, used: false },
  services: [{ id: 'preview.copy', label: 'Copy a sticker', text: 'Choose a card to receive another Wild sticker.', price: 12, needsCard: true, affordable: true }, { id: 'preview.boon', label: 'Bless a boon', text: 'Choose a companion for a special blessing.', price: 8, needsBoon: true, affordable: true }, { id: 'preview.supplies', label: 'Gather supplies', text: 'Your companions provision the next crossing.', price: 5, affordable: true }],
};
const charmPort = structuredClone(portBase); charmPort.port.kind = 'boons'; charmPort.port.name = 'Charm market';
const upgradePort = structuredClone(portBase); upgradePort.port.kind = 'upgrades'; upgradePort.port.name = 'Upgrade market';
const poorPort = structuredClone(charmPort); poorPort.coins = poorPort.port.coins = 8; for (const service of poorPort.port.services) service.affordable = service.price <= 8;
const spentPort = structuredClone(portBase); spentPort.port.boons[0].sold = true; spentPort.port.stickers[0].sold = true; spentPort.port.provisions.left = 0; spentPort.port.reroll.used = true; spentPort.port.upgrades = [];
const finale = structuredClone(scenes.find((s) => s.id === 'hud7').view);
finale.boons = structuredClone(fixtureBoons); finale.confiscated = finale.current.confiscated = structuredClone(fixtureBoons[0]);
finale.current.challenge.pressure = true;
const curse = structuredClone(scenes.find((s) => s.id === 'hud3').view);
curse.boons = structuredClone(fixtureBoons); curse.current.challenge.pressure = true;
const finalMap = structuredClone(finale);
const reward = structuredClone(scenes.find((s) => s.id === 'result3').view);
reward.reward = { ...(reward.reward || {}), offers: structuredClone(fixtureBoons) }; reward.status = 'reward'; reward.coins = 86;
const rewardTwo = structuredClone(reward); rewardTwo.reward.picks = 2;
const endView = scenes.find((s) => s.id === 'end-win').view; endView.boons.push(...structuredClone(fixtureBoons)); endView.results[0].charms = fixtureBoons.slice(0, 2).map((c) => c.id);
const stormChallenge = { id: 'preview.storm', kind: 'challenge', name: 'Rough Seas', icon: 'ϟ', text: 'The storm grants one fewer shared undo.', pressure: true, placeholder: true, level: 1, hidden: false };
const stormMap = structuredClone(scenes.find((s) => s.id === 'map3').view);
const stormNode = stormMap.map.flat().find((n) => n.state === 'available'); stormNode.storm = true; stormNode.stormChallenge = stormChallenge;
const stormBoard = structuredClone(curse); stormBoard.current.storm = true; stormBoard.current.stormChallenge = stormChallenge; stormBoard.current.extraChallenges = [stormChallenge];
const stormResult = structuredClone(reward); stormResult.results.at(-1).storm = true; const stormCoins = stormResult.results.at(-1).coins; stormResult.results.at(-1).coins *= 2; stormResult.results.at(-1).coinLines.push({ label: 'Storm bonus', coins: stormCoins });
const lookaheadThreeRun = createRun({ seed: 'voyage-ui-chart-lookahead' });
lookaheadThreeRun.boons.push('broadcast.tuning');
lookaheadThreeRun.levels['broadcast.tuning'] = 1;
const chartLookaheadThree = snapshot(lookaheadThreeRun);
const twoRun = createRun({ seed: 'voyage-ui-chart-lookahead' });
const chartLookaheadTwo = snapshot(twoRun);
const fourRun = createRun({ seed: 'voyage-ui-chart-lookahead' });
fourRun.boons.push('broadcast.tuning'); fourRun.levels['broadcast.tuning'] = 2;
const chartLookaheadFour = snapshot(fourRun);
const chartMid = structuredClone(scenes.find((s) => s.id === 'map4').view);
const chartReadOnly = structuredClone(scenes.find((s) => s.id === 'hud3').view);
const chartSail = structuredClone(chartMid);
const chartLate = structuredClone(scenes.find((s) => s.id === 'map6').view);
const chartDock = structuredClone(portBase);
chartDock.status = 'port';
const dockMarket = (chartDock.markets || []).find((market) => chartDock.map.flat().some((node) => node.row === market.row && ['visited', 'current'].includes(node.state))) || chartDock.markets?.[0];
scenes.push(
  { id: 'chart-boss-selected', title: 'Chart · boss inspected from the opening view', view: chartLookaheadTwo },
  { id: 'chart-board7-readonly', title: 'Chart · board 7 read-only', view: finalMap },
  { id: 'chart-start', title: 'Chart · start of run', view: chartLookaheadTwo },
  { id: 'chart-mid', title: 'Chart · travelled and skipped', view: chartMid },
  { id: 'chart-lookahead-2', title: 'Chart · lookout 2', view: chartLookaheadTwo },
  { id: 'chart-lookahead-3', title: 'Chart · lookout 3', view: chartLookaheadThree },
  { id: 'chart-lookahead-4', title: 'Chart · lookout 4', view: chartLookaheadFour },
  { id: 'chart-readonly', title: 'Chart · read-only mid-board', view: chartReadOnly },
  { id: 'chart-sail', title: 'Chart · sailing frame', view: chartSail },
  { id: 'chart-docking', title: 'Chart · docking at harbour', view: chartDock },
  { id: 'chart-late', title: 'Chart · board 6 full history', view: chartLate },
  { id: 'map-storm', title: 'Map · storm route', view: stormMap },
  { id: 'intro-storm', title: 'Intro · secondary storm curse', view: stormBoard },
  { id: 'hud-storm', title: 'HUD · secondary storm curse', view: stormBoard },
  { id: 'result-storm', title: 'Result · storm coins and offers', view: stormResult },
  { id: 'reward-two', title: 'Reward · choose 2 boons', view: rewardTwo },
  { id: 'service-card', title: 'Service · choose a card', view: portBase },
  { id: 'service-boon', title: 'Service · choose a boon', view: portBase },
  { id: 'port-charms', title: 'Charm market', view: charmPort },
  { id: 'port-grand', title: 'Upgrade market', view: upgradePort },
  { id: 'port', title: 'Sticker market', view: portBase },
  { id: 'port-poor', title: 'Harbour · shortfall', view: poorPort },
  { id: 'port-spent', title: 'Harbour · sold and exhausted', view: spentPort },
  { id: 'sticker-picker', title: 'Stickers · 52-card picker', view: portBase },
  { id: 'boss-intro', title: 'Boss · confiscation', view: finale },
  { id: 'hud-finale', title: 'HUD · confiscation', view: finale },
  { id: 'hud-curse', title: 'HUD · curse and levels', view: curse },
  { id: 'map-confiscation', title: 'Map · confiscation', view: finalMap },
  { id: 'result-coins', title: 'Reward · coins and levels', view: reward },
  { id: 'sticker-marks', title: 'Cards · marks coexist', view: portBase },
);
const calls = [];
function portAction(name, ...args) {
  calls.push({ name, args });
  const view = focusScene.view, port = view.port;
  if (name === 'portLeave') { show('map3'); return; }
  let price = 0;
  if (name === 'portService') { price = port.services.find((s) => s.id === args[0]).price; }
  else if (name === 'portBuySticker') {
    const [index, card] = args, offer = port.stickers[index]; price = offer.price; offer.sold = true;
    view.stickers = view.stickers.filter((s) => s.card !== card).concat({ card, type: offer.type });
  } else if (name === 'portBuyBoon') {
    const offer = port.boons.find((o) => o.charm.id === args[0]); price = offer.price; offer.sold = true;
    view.boons.push(structuredClone(offer.charm)); port.sell.push({ charm: structuredClone(offer.charm), price: 20 });
  } else if (name === 'portUpgrade') {
    const offer = port.upgrades.find((o) => o.charm.id === args[0]); price = offer.price;
    const held = view.boons.find((c) => c.id === args[0]); held.level = 2;
    port.sell.find((o) => o.charm.id === held.id).charm.level = 2;
    port.upgrades = port.upgrades.filter((o) => o !== offer);
  } else if (name === 'portBuyUndo') { price = port.provisions.price; port.provisions.left--; view.undos++; }
  else if (name === 'portSell') {
    const offer = port.sell.find((o) => o.charm.id === args[0]); price = -offer.price;
    view.boons = view.boons.filter((c) => c.id !== args[0]); port.sell = port.sell.filter((o) => o !== offer); port.upgrades = port.upgrades.filter((o) => o.charm.id !== args[0]);
  } else if (name === 'portReroll') { price = port.reroll.price; port.reroll.used = true; port.boons.reverse(); }
  view.coins -= price; port.coins = view.coins; voyageUI.showPort(view);
}

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
  ...Object.fromEntries(['portBuyBoon', 'portBuySticker', 'portUpgrade', 'portBuyUndo', 'portSell', 'portReroll', 'portLeave', 'portService'].map((name) => [name, (...args) => portAction(name, ...args)])),
  startVoyage: () => show('map1'), continueVoyage: () => show('map1'),
  pickNode: (id) => { calls.push({ name: 'pickNode', args: [id] }); show(`intro${Math.min(7, (focusScene?.view.results.length || 0) + 1)}`); },
  pickCharm: (id) => {
    if (focusScene.view.reward?.picks > 1) { focusScene.view.reward.picks--; focusScene.view.reward.offers = focusScene.view.reward.offers.filter((c) => c.id !== id); calls.push({ name: 'pickCharm', args: [id] }); voyageUI.showResult(focusScene.view); return; }
    show(`map${Math.min(7, (focusScene?.view.results.length || 0) + 1)}`); },
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
  document.getElementById('preview-marks')?.remove();
  document.getElementById('modal-stats').classList.remove('show');
  document.getElementById('title-screen').classList.add('hidden');
  document.getElementById('hud').classList.add('hidden');
  document.body.dataset.mode = 'classic';
  const view = scene.view;
  if (id.startsWith('title-')) {
    voyageUI.refreshTitle({ run: id.endsWith('-run') ? view : null, daily: { key: '2026-10-10', result: null } });
    document.getElementById('title-screen').classList.remove('hidden');
    ui.setTitleMode(id.includes('voyage') ? 'voyage' : 'classic', { persist: false });
  } else if (id.startsWith('port') || id === 'sticker-picker' || id.startsWith('service-')) {
    voyageUI.setMode('voyage'); voyageUI.showPort(view);
    if (id === 'sticker-picker') voyageUI.openStickerPicker(0);
    if (id.startsWith('service-')) voyageUI.openPortService(id === 'service-card' ? 'preview.copy' : 'preview.boon');
  } else if (id === 'boss-intro') {
    voyageUI.setMode('voyage'); voyageUI.showBossIntro(view);
  } else if (id === 'sticker-marks') {
    showMarks();
  } else if (id.startsWith('map') || id.startsWith('chart-') || id === 'tutorial-map') {
    voyageUI.setMode('voyage');
    voyageUI.showMap(view);
    if (id === 'chart-boss-selected') voyageUI.selectNode('__boss__', false);
    if (id === 'chart-sail') voyageUI.sailTo(view.map.flat().find((node) => node.state === 'available').id, { preview: true });
    if (id === 'chart-docking' && dockMarket) voyageUI.chart.dock(dockMarket.id, { preview: true });
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
  } else if (id.startsWith('result') || id === 'reward-two' || id === 'tutorial-reward') {
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
const markGroups = [];
function showMarks() {
  setCardTheme(THEMES[activeTheme]);
  const panel = document.createElement('section'); panel.id = 'preview-marks'; panel.className = 'panel';
  panel.innerHTML = '<p class="voyage-kicker">Voyage · card stickers</p><h2>Small marks, lasting luck</h2><p>Charm seal above. Sticker sigil in the opposite corner.</p><div class="preview-mark-grid"></div>';
  document.body.append(panel); markGroups.length = 0;
  ['wild', 'fool', 'key', 'gold', 'lucky'].forEach((type, i) => {
    const group = buildCardMesh(i * 10 + 1, THEMES[activeTheme].card);
    setCardMark(group, ['lock', 'cap', 'star', 'wild', 'frost'][i]); setCardSticker(group, type); markGroups.push(group);
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 360;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(group.userData.frontMat.map.image, 0, 0, 256, 360);
    ctx.drawImage(group.userData.markMesh.material.map.image, 0, 0);
    ctx.drawImage(group.userData.stickerMesh.material.map.image, 0, 0);
    const figure = document.createElement('figure'); const label = document.createElement('figcaption'); label.textContent = type;
    figure.append(canvas, label); panel.querySelector('.preview-mark-grid').append(figure);
  });
}
screen.addEventListener('change', () => show(screen.value));
themeSelect.addEventListener('change', () => { activeTheme = themeSelect.value; applyTheme(activeTheme); show(activeScene); });
document.getElementById('preview-next').addEventListener('click', () => show(scenes[(scenes.findIndex((s) => s.id === activeScene) + 1) % scenes.length].id));
applyTheme(activeTheme); show(activeScene);
window.preview = { scenes, show, applyTheme, voyageUI, calls, markGroups, setCardMark, setCardSticker, setCardConcealed, applyCardStyle, chartLate };

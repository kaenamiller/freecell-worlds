// DEV ONLY: not imported by index.js. Checker/browser fixtures import this explicitly.
import { CHARMS, defineCharm } from '../registry.js';
import './index.js';
import * as Rules from '../../rules.js';
import { replay, countHome, rankMask, suitMask, rankOf, canUndoBoard, boardWon } from './kit.js';

export function registerExampleMoves() {
  if (!Rules.registerCustomMove) return false;
  Rules.registerCustomMove('dev.swap', {
    apply(st, m) {
      const a = st.tableau[m.a], b = st.tableau[m.b];
      if (!a?.length || !b?.length || m.a === m.b) throw new Error('Swap requires two different non-empty columns');
      m.cards = [a.at(-1), b.at(-1)];
      [a[a.length - 1], b[b.length - 1]] = [b.at(-1), a.at(-1)];
    },
    undo(st, m) {
      const a = st.tableau[m.a], b = st.tableau[m.b];
      [a[a.length - 1], b[b.length - 1]] = [b.at(-1), a.at(-1)];
    },
  });
  return true;
}
registerExampleMoves();

export const examples = [
  defineCharm({
    id: 'dev.survey', kind: 'boon', theme: 'roman', name: 'Survey Kit', icon: '⌖',
    text: 'Mark a card, add an ability use, and play a hint.', abilityBonus: 1,
    family: 'vision', upgrade: 'Mark a card, add an ability use, and play two hints.',
    rules(r) { r.wildRanks = (r.wildRanks || 0) | rankMask(10); r.suitBuild = (r.suitBuild || 0) | suitMask(0); },
    setup(board, ctx) {
      ctx.memo.card ??= board.state.tableau[0].at(-1);
      ctx.api.mark([ctx.memo.card], 'wanted'); ctx.api.badge('♦');
    },
    onPick(run, ctx) { ctx.runMemo.picked = true; ctx.api.addUndos(1); },
    ability: { uses: 1, label: 'Scout a move', use: (ctx) => ctx.api.hint() },
    offers: (n) => n + 1,
    thresholds: (arr) => arr.map((n, i) => i ? Math.round(n * .95) : n),
    score(sb, ctx) {
      replay(sb, () => {});
      sb.add('survey', 'Surveyed cards', countHome(sb.history, (id) => id === ctx.memo.card) * 25);
    },
    on: { reveal(ctx) { ctx.memo.reveals = (ctx.memo.reveals || 0) + 1; } },
  }),
  defineCharm({
    id: 'dev.workshop', kind: 'boon', theme: 'roman', name: 'Workshop', icon: '⇄',
    text: 'Pick two columns and swap their top cards; undo restores them.',
    family: 'ability', upgrade: 'Swap column tops three times; undo restores them.',
    ability: {
      uses: 2, label: 'Swap column tops',
      available: (ctx) => !!ctx.api.state?.tableau.filter((c) => c.length).length,
      async use(ctx) {
        // Other modes exercise the remaining runtime primitives in the checker.
        if (ctx.memo.mode === 'cells') return ctx.api.setFreeCells(ctx.api.state.free.length + 1);
        if (ctx.memo.mode === 'override') return ctx.api.override({ ignoreColour: true, ignoreRank: true });
        if (ctx.memo.mode === 'home') return ctx.api.autoHome();
        const a = await ctx.api.pick({ kind: 'column', filter: (i, st) => st.tableau[i].length > 0 });
        if (a == null) return false;
        const b = await ctx.api.pick({ kind: 'column', filter: (i, st) => i !== a && st.tableau[i].length > 0 });
        if (b == null) return false;
        return !!ctx.api.charmMove('dev.swap', { a, b });
      },
    },
  }),
  defineCharm({
    id: 'dev.veil', kind: 'challenge', theme: 'roman', name: 'Practice Fog', icon: '◩', tags: ['VIS', 'SCORE'],
    text: (s) => `Conceal ${s} buried cards in each column.`, pressure: true,
    setup(board, ctx) {
      ctx.api.conceal(board.state.tableau.flatMap((col) => col.slice(Math.max(0, col.length - 1 - ctx.strength), -1)));
      ctx.api.badge(String(ctx.strength));
    },
    starCap: (ctx) => ctx.elapsed > 600 ? 2 : 3,
    score(sb) { sb.add('fog', 'Fog practice', countHome(sb.history, (id) => rankOf(id) === 1) * 5); },
    on: {
      stuck(ctx) {
        if (ctx.runMemo.rescued) return false;
        ctx.runMemo.rescued = true; ctx.api.addUndos(2); ctx.api.notify('Practice rescue'); return true;
      },
    },
  }),
  defineCharm({
    id: 'dev.preview', kind: 'boon', theme: 'roman', hidden: true, name: 'Three-Move Look', icon: '◉',
    family: 'vision', text: 'Preview three moves without playing them.', upgrade: 'Preview three moves twice.',
    ability: { uses: (ctx) => ctx.level, label: 'Preview line', available: ({api}) => !boardWon(api.state), async use(ctx) { return !!(await ctx.api.preview(3)); } },
  }),
  defineCharm({
    id: 'dev.reset', kind: 'boon', theme: 'roman', hidden: true, name: 'Deal Reset', icon: '⟲',
    family: 'undo', text: 'Return to the dealt position for free.', upgrade: 'Return to the deal twice.',
    ability: { uses: 1, label: 'Reset board', available: canUndoBoard, use: ({api}) => api.resetBoard() },
  }),
  defineCharm({
    id: 'dev.window', kind: 'boon', theme: 'roman', hidden: true, name: 'Undo Window', icon: '↶',
    family: 'undo', text: 'Open a streak of free undo steps.', upgrade: 'Open a free undo streak with an extra use.',
    ability: { uses: 1, label: 'Open free undos', available: (ctx) => canUndoBoard(ctx) && !ctx.api.undoWindowUsed, use: ({api}) => api.openUndoWindow() },
  }),
  defineCharm({
    id: 'dev.battery', kind: 'boon', theme: 'roman', hidden: true, name: 'Use Battery', icon: '⊕',
    family: 'ability', text: 'Grant another ability use, capped at two extras.', upgrade: 'Grant two extra ability uses.',
    ability: { uses: 5, label: 'Grant ability uses', use: (ctx) => { ctx.api.grantUse(ctx.memo.target || '*', ctx.level); return true; } },
    on: {
      ability(ctx, {id}) { (ctx.memo.events ??= []).push(id); },
      undo(ctx, ev) { (ctx.memo.undos ??= []).push({free: !!ev.free, reset: !!ev.reset, moves: ev.moves?.length || 0}); },
      win(ctx) { ctx.runMemo.winUses = ctx.api.abilityUses(); },
    },
  }),
  defineCharm({
    id: 'dev.faucet', kind: 'boon', theme: 'roman', hidden: true, name: 'Undo Faucet', icon: '♧',
    family: 'undo', text: 'Grant two undos and exercise the board cap.', upgrade: 'Try granting four undos.',
    ability: { uses: 5, label: 'Grant capped undos', use: (ctx) => { ctx.api.addUndos(ctx.level * 2); return true; } },
    on: { stuck(ctx) { ctx.api.addUndos(4); return true; } },
  }),
  defineCharm({
    id: 'dev.exempt', kind: 'boon', theme: 'roman', hidden: true, name: 'Exempt Undo', icon: '∞', undoCapExempt: true,
    family: 'undo', text: 'Grant an undo outside the board cap.', upgrade: 'Grant two exempt undos.',
    ability: { uses: 2, label: 'Grant exempt undo', use: (ctx) => { ctx.api.addUndos(ctx.level); return true; } },
  }),
  defineCharm({
    id: 'dev.wager', kind: 'boon', theme: 'roman', hidden: true, name: 'Opening Sticker', icon: '◇',
    family: 'fortune', text: 'Before playing, place a sticker for the next board.', upgrade: 'Before playing, replace a sticker with a key.',
    ability: { uses: 1, when: 'start', label: 'Sticker next board', use: (ctx) => ctx.api.addSticker(ctx.memo.card || 1, ctx.level === 2 ? 'key' : 'wild') },
  }),
  defineCharm({
    id: 'dev.weather', kind: 'boon', theme: 'roman', hidden: true, name: 'Weather Eye', icon: '☁',
    family: 'vision', text: 'Check whether a win remains reachable.', upgrade: 'Check reachability twice.',
    ability: { uses: (ctx) => ctx.level, label: 'Check reachability', async use(ctx) { ctx.memo.answer = await ctx.api.solvable(); return true; } },
  }),
];

// Preserve historical runtime regressions when a content migration retires an ID.
// These definitions are hidden and loaded only with this dev fixture module.
export const legacyHintIds = {};
for (const legacy of [
  {id:'pinecone.compass', name:'Pocket Compass', icon:'⌖', family:'vision', text:'Play one hint.', ability:{uses:1,label:'Compass hint',use:(ctx) => ctx.api.hint()}},
  {id:'signal.lock', name:'Lock', icon:'⌖', family:'vision', text:'Play two hints.', ability:{uses:2,label:'Lock next move',use:(ctx) => ctx.api.hint()}},
  {id:'museum.docent', name:'Docent', icon:'⌖', family:'vision', text:'Play a museum hint.', ability:{uses:1,label:'Show best move',use:(ctx) => ctx.api.hint()}},
  {id:'lapis.horus', name:'Eye of Horus', icon:'⌖', family:'vision', text:'Play a hint and reveal three cards.', ability:{uses:1,label:'Eye of Horus',async use(ctx) {const hinted=await ctx.api.hint(); const hidden=ctx.api.concealed.slice(0,3); if(hidden.length) ctx.api.reveal(hidden); return hinted || hidden.length > 0;}}},
  {id:'cyber.cache', name:'Cache Hit', icon:'↶', family:'undo', text:'Refund the first paid undo.', on:{undo(ctx) {if(ctx.memo.refunded) return; ctx.memo.refunded=true; ctx.api.addUndos(1);}}},
  {id:'canyon.echo', name:'Echo Canyon', icon:'↶', family:'undo', text:'Refund a paid undo of a cell placement.', on:{undo(ctx,{move}) {if(move?.t==='C') ctx.api.addUndos(1);}}},
  {id:'deepstorage.redundancy', name:'Redundancy', icon:'↶', family:'undo', text:'Refund each third paid undo.', on:{undo(ctx) {ctx.runMemo.spent=(ctx.runMemo.spent || 0)+1; if(ctx.runMemo.spent % 3===0) ctx.api.addUndos(1);}}},
]) {
  const current = CHARMS[legacy.id];
  const changed = legacy.ability && current && !/\.hint\s*\(/.test(String(current.ability?.use));
  const id = changed ? `dev.legacy.${legacy.id}` : legacy.id;
  if (!CHARMS[id]) defineCharm({...legacy,id,kind:'boon',theme:legacy.id.split('.')[0],hidden:true,upgrade:legacy.text});
  if (legacy.ability) legacyHintIds[legacy.id] = id;
}

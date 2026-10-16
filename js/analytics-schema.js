// The analytics event catalog (docs/analytics-plan.md §5). One schema for GA4, the first-party
// store and tools/analytics-check.mjs, so both stores agree on every name and meaning.
// Pure module: no DOM, so the API Worker and Node tools can import it too.
//
// PARAMS defines each param once; an event lists the params it may carry.
//   type   str | id | int | num | bool | list (array of strings) | obj (JSON value, first-party only)
//   max    longest string (default 100) or list length (default 20)
//   enum   allowed values
//   ga     false: first-party only (lists over 100 chars, ids GA can't use, raw referrers)
// EVENTS entries:
//   params   allowed params
//   summary  true: self-contained, so it is still sent in anonymous mode (first-party plan §4.4)
//   ga       false: first-party only. Or { alias, map(params) }: also send a GA4 recommended event
//            (map returns its params, or null to skip it for this call)
//   only     'ga': GA4 only (no first-party copy)

export const SCHEMA_VERSION = 1;

// GA4 limits (analytics-plan.md §3).
export const GA_LIMITS = { name: 40, params: 25, value: 100 };

// Added to every event by js/analytics.js.
export const CONTEXT = ['app_version', 'mode', 'theme_id', 'theme_auto', 'logged_in', 'input', 'quality', 'installed'];

const str = (max = 100, extra = {}) => ({ type: 'str', max, ...extra });
const oneOf = (...values) => ({ type: 'str', enum: values });
const int = { type: 'int' };
const num = { type: 'num' };
const bool = { type: 'bool' };
const id = { type: 'id', max: 64 };
const list = (max = 20, extra = {}) => ({ type: 'list', max, ...extra });
const fpOnly = (spec) => ({ ...spec, ga: false });

export const PARAMS = {
  // context
  app_version: str(40),
  mode: oneOf('classic', 'voyage', 'menu'),
  theme_id: str(40),
  theme_auto: bool,
  logged_in: bool,
  input: oneOf('touch', 'mouse'),
  quality: oneOf('ultra', 'high', 'medium', 'low'),
  installed: bool,

  // navigation and app
  screen_name: str(40),
  page_title: str(60),
  page_location: str(100),
  load_ms: int,
  quality_auto: str(10),
  cores: int,
  standalone: bool,
  from: str(20),
  to: str(20),
  fps: int,
  tab: oneOf('classic', 'voyage'),
  modal: str(40),
  source: str(40),
  setting: str(40),
  setting_value: str(40),
  on: bool,
  outcome: str(30),
  message: str(100),
  where: str(100),
  muted: bool,
  ms: int,
  from_cache: bool,
  reason: str(40),

  // classic
  game_id: id,
  deal: int,
  daily: bool,
  free_cells: int,
  moves_so_far: int,
  elapsed_s: int,
  result: str(20),
  time_s: int,
  moves: int,
  undos: int,
  hints: int,
  checks: int,
  cards_home: int,
  streak: int,
  resumed: bool,
  score: int,
  level: int,
  character: str(40),
  level_name: str(40),
  success: bool,
  achievement_id: str(40),

  // interaction counters (§5.6). First-party only: game_end and voyage_board_end would pass
  // GA4's 25-param limit with them.
  invalid_moves: fpOnly(int),
  drags: fpOnly(int),
  taps: fpOnly(int),
  double_clicks: fpOnly(int),
  key_moves: fpOnly(int),
  auto_moves: fpOnly(int),
  freecell_uses: fpOnly(int),
  first_move_ms: fpOnly(int),
  idle_max_s: fpOnly(int),
  undo_max_streak: fpOnly(int),
  rank_highlight_uses: fpOnly(int),
  peeks: fpOnly(int),
  bg_seconds: fpOnly(int),
  auto_finished: fpOnly(bool),
  after_invalid_burst: fpOnly(bool),

  // voyage
  run_id: id,
  boss_id: str(40),
  replaced_run: bool,
  runs_lifetime: int,
  status: str(20),
  board_idx: int,
  challenge_id: str(40),
  extra_challenges: list(4),
  strength: int,
  tier: fpOnly(int),
  storm: bool,
  is_final: bool,
  offered_themes: list(4),
  offered_challenges: list(4),
  prep_wait_ms: int,
  decide_ms: int,
  inspected: int,
  par: fpOnly(int),
  deal_rating: fpOnly(num),
  relaxed: bool,
  boss_relented: bool,
  ease_total: num,
  undos_available: int,
  charms_held: int,
  held: fpOnly(list(16)),
  kind: str(30),
  undos_left: int,
  ability_available: bool,
  charm_id: str(40),
  charm_theme: str(40),
  charm_family: str(30),
  uses_left: int,
  consumed: bool,
  while_stuck: bool,
  stars: int,
  moves_over_par: int,
  undos_used: int,
  coins_earned: int,
  coins_spent: int,
  coins_left: int,
  coins: int,
  coins_before: int,
  coins_after: int,
  ability_uses: int,
  score_cards: fpOnly(int),
  score_efficiency: fpOnly(int),
  score_freecells: fpOnly(int),
  score_chains: fpOnly(int),
  score_charms: fpOnly(int),
  score_lines: fpOnly({ type: 'obj' }),
  total_score: int,
  total_stars: int,
  boards_cleared: int,
  died_on_theme: str(40),
  died_on_challenge: str(40),
  duration_min: num,
  picks_allowed: int,
  offered: list(6),
  picked: list(3),
  offer_count: int,
  pick_slot: int,
  held_before: int,
  price: int,
  held_boards: int,
  what: str(40),
  n: int,
  market_kind: str(20),
  item_name: str(60),
  items_bought: int,
  rerolls: int,
  stock: fpOnly(list(20)),
  step: str(20),
  replay: bool,
  skipped: bool,
  points: int,
  mult: num,
  stage: str(20),
  steps: int,
  found: bool,
  virtual_currency_name: str(30),
  value: num,

  // accounts and purchases
  entry: str(40),
  method: str(20),
  key: str(40),
  resolution: str(20),
  token_balance: int,
  item_list_id: str(40),
  items: { type: 'obj' }, // GA4 ecommerce items array
  currency: str(3),
  checkout_id: fpOnly(id),
  transaction_id: id,
  is_first_purchase: bool,
  purchase_number: int,
  category: str(40),
  version_n: int,
  gen_seconds: int,
  rolls_used: int,

  // first-party sessions
  referrer: fpOnly(str(300)),
  landing: str(100),
  utm_source: str(100),
  utm_medium: str(100),
  utm_campaign: str(100),
  utm_term: str(100),
  utm_content: str(100),
  first_visit: bool,
  active_s: int,
  foreground_s: int,
  events: int,
};

const COUNTERS = ['invalid_moves', 'drags', 'taps', 'double_clicks', 'key_moves', 'auto_moves', 'freecell_uses', 'first_move_ms', 'idle_max_s', 'undo_max_streak', 'rank_highlight_uses', 'peeks', 'bg_seconds', 'auto_finished'];

export const EVENTS = {
  // --- app and navigation (§5.1) ---
  page_view: { params: ['screen_name', 'page_title', 'page_location'] },
  app_ready: { params: ['load_ms', 'quality_auto', 'cores', 'standalone'], summary: true },
  perf_downgrade: { params: ['from', 'to', 'fps'], summary: true },
  title_tab: { params: ['tab'] },
  modal_open: { params: ['modal'] },
  theme_select: { params: ['source'], summary: true },
  settings_change: { params: ['setting', 'setting_value'] },
  fullscreen_toggle: { params: ['on'] },
  pwa_install_prompt: { params: ['outcome'] },
  pwa_installed: { params: [] },
  stats_reset: { params: [] },
  app_error: { params: ['message', 'where'], summary: true },
  mute_toggle: { params: ['muted'] },
  theme_load: { params: ['ms', 'from_cache'], summary: true },
  webgl_context_lost: { params: [], summary: true },
  webgl_context_restored: { params: [], summary: true },
  audio_unlock_failed: { params: ['reason'] },
  session_start: { params: ['referrer', 'landing', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'first_visit'], ga: false },
  session_end: { params: ['active_s', 'foreground_s', 'events'], ga: false, summary: true },

  // --- classic (§5.2, §5.6) ---
  game_start: {
    params: ['game_id', 'deal', 'daily', 'source', 'free_cells'],
    ga: { alias: 'level_start', map: () => ({ level_name: 'classic' }) },
  },
  game_resume: { params: ['game_id', 'deal', 'daily', 'moves_so_far', 'elapsed_s'] },
  hint_used: { params: ['game_id', 'moves_so_far'] },
  check_used: { params: ['game_id', 'moves_so_far', 'result'] },
  solve_used: { params: ['game_id', 'moves_so_far'] },
  game_end: {
    params: ['game_id', 'deal', 'daily', 'outcome', 'reason', 'resumed', 'time_s', 'moves', 'undos', 'hints', 'checks', 'cards_home', 'streak', 'after_invalid_burst', ...COUNTERS],
    summary: true,
    ga: { alias: 'level_end', map: (p) => ({ level_name: 'classic', success: p.outcome === 'win' }) },
  },
  post_score: { params: ['score', 'level', 'character'], only: 'ga' },
  game_exit: { params: ['game_id', 'cards_home', 'elapsed_s', 'moves'] },
  unlock_achievement: { params: ['achievement_id'] },
  daily_complete: { params: ['deal', 'time_s', 'moves'] },
  streak_lost: { params: ['streak'] },
  deal_number_entered: { params: ['deal'] },

  // --- voyage (§5.3, §5.6). Wired in the next phase. ---
  voyage_run_start: { params: ['run_id', 'daily', 'boss_id', 'replaced_run', 'runs_lifetime'] },
  voyage_run_resume: { params: ['run_id', 'status', 'board_idx'] },
  voyage_node_pick: { params: ['run_id', 'board_idx', 'theme_id', 'challenge_id', 'strength', 'storm', 'is_final', 'offered_themes', 'offered_challenges', 'prep_wait_ms', 'decide_ms', 'inspected'] },
  voyage_board_start: {
    params: ['run_id', 'board_idx', 'challenge_id', 'extra_challenges', 'boss_id', 'tier', 'strength', 'deal', 'par', 'deal_rating', 'relaxed', 'boss_relented', 'ease_total', 'free_cells', 'undos_available', 'charms_held', 'held'],
    ga: { alias: 'level_start', map: (p) => ({ level_name: `voyage_${(p.board_idx ?? 0) + 1}` }) },
  },
  voyage_stuck_warning: { params: ['run_id', 'board_idx', 'kind', 'undos_left', 'ability_available'] },
  voyage_ability_use: { params: ['run_id', 'board_idx', 'charm_id', 'uses_left', 'consumed', 'while_stuck', 'cards_home', 'moves_so_far'] },
  voyage_ability_cancel: { params: ['run_id', 'board_idx', 'charm_id', 'stage'] },
  voyage_undo: { params: ['run_id', 'board_idx', 'undos_left'] },
  voyage_board_end: {
    params: ['run_id', 'board_idx', 'challenge_id', 'boss_id', 'tier', 'strength', 'deal_rating', 'held', 'outcome', 'stars', 'score', 'par', 'moves', 'moves_over_par', 'time_s', 'undos_used', 'undos_left', 'coins_earned', 'ability_uses', 'score_cards', 'score_efficiency', 'score_freecells', 'score_chains', 'score_charms', 'score_lines', 'cards_home', 'after_invalid_burst', ...COUNTERS],
    summary: true,
    ga: { alias: 'level_end', map: (p) => ({ level_name: `voyage_${(p.board_idx ?? 0) + 1}`, success: p.outcome === 'cleared' }) },
  },
  voyage_charm_score: { params: ['run_id', 'board_idx', 'charm_id', 'points', 'coins', 'mult'], summary: true },
  voyage_challenge_trigger: { params: ['run_id', 'board_idx', 'charm_id', 'what', 'n'], summary: true },
  voyage_loss_saved: { params: ['run_id', 'board_idx', 'charm_id', 'undos_left'], summary: true },
  voyage_undo_cap_hit: { params: ['run_id', 'board_idx', 'charm_id'] },
  voyage_sonar_result: { params: ['run_id', 'board_idx', 'steps', 'ms'] },
  voyage_preview_used: { params: ['run_id', 'board_idx', 'n', 'found'] },
  voyage_run_end: { params: ['run_id', 'outcome', 'daily', 'boss_id', 'boards_cleared', 'total_score', 'total_stars', 'coins_earned', 'coins_spent', 'coins_left', 'charms_held', 'held', 'died_on_theme', 'died_on_challenge', 'duration_min'], summary: true },
  voyage_charm_offer: { params: ['run_id', 'board_idx', 'stars', 'picks_allowed', 'offered', 'picked', 'offer_count', 'source'], summary: true },
  voyage_charm_pick: { params: ['run_id', 'board_idx', 'charm_id', 'charm_theme', 'charm_family', 'pick_slot', 'offered', 'held_before', 'source'] },
  voyage_charm_upgrade: { params: ['run_id', 'charm_id', 'price'] },
  voyage_charm_sell: { params: ['run_id', 'charm_id', 'price', 'held_boards'] },
  voyage_port_enter: { params: ['run_id', 'market_kind', 'coins', 'stock'] },
  voyage_port_leave: { params: ['run_id', 'market_kind', 'coins_before', 'coins_after', 'items_bought', 'rerolls', 'held'], summary: true },
  earn_virtual_currency: { params: ['virtual_currency_name', 'value', 'source'] },
  spend_virtual_currency: { params: ['virtual_currency_name', 'value', 'item_name'] },
  tutorial_begin: { params: ['step', 'replay'] },
  tutorial_complete: { params: ['step', 'replay', 'skipped'] },

  // --- accounts and Theme Tokens (§5.4, §5.5). Wired on the accounts branch. ---
  sign_up_start: { params: ['entry'] },
  sign_up: { params: ['method'] },
  login: { params: ['method'] },
  logout: { params: [] },
  sync_conflict: { params: ['key', 'resolution'] },
  creator_open: { params: ['entry', 'token_balance'] },
  view_item_list: { params: ['item_list_id', 'items'] },
  select_item: { params: ['item_list_id', 'items'] },
  paywall_hit: { params: ['entry'] },
  begin_checkout: { params: ['currency', 'value', 'items', 'checkout_id'] },
  theme_prompt_rejected: { params: ['category'] },
  theme_version_ready: { params: ['version_n', 'gen_seconds'] },
  theme_version_failed: { params: ['version_n', 'gen_seconds'] },
  theme_pick: { params: ['version_n', 'rolls_used'] },
  theme_cancel_refund: { params: [] },
  custom_theme_play: { params: [] },
};

const LIST_GA_SEP = ',';

function cleanValue(spec, v) {
  if (v == null) return undefined;
  switch (spec.type) {
    case 'int': {
      const n = Number(v);
      return Number.isFinite(n) ? Math.round(n) : NaN;
    }
    case 'num': {
      const n = Number(v);
      return Number.isFinite(n) ? Math.round(n * 1000) / 1000 : NaN;
    }
    case 'bool':
      return typeof v === 'boolean' ? v : NaN;
    case 'str':
    case 'id':
      return typeof v === 'string' || typeof v === 'number' ? String(v) : NaN;
    case 'list':
      return Array.isArray(v) ? v.map(String) : NaN;
    case 'obj':
      return v;
    default:
      return NaN;
  }
}

// Validate and split one event. Returns
//   { fp: params for the first-party store | null, ga: [{ name, params }], errors: [string] }
// Invalid params are dropped (and reported), so a bad value never takes the whole event down.
export function prepareEvent(name, params = {}, context = {}) {
  const def = EVENTS[name];
  const errors = [];
  if (!def) return { fp: null, ga: [], errors: [`unknown event ${name}`] };
  const clean = {};
  for (const [key, raw] of Object.entries(params)) {
    if (raw === undefined) continue;
    const spec = PARAMS[key];
    if (!spec || !def.params.includes(key)) { errors.push(`${name}: param ${key} is not in the schema`); continue; }
    const v = cleanValue(spec, raw);
    if (Number.isNaN(v)) { errors.push(`${name}.${key}: expected ${spec.type}, got ${typeof raw}`); continue; }
    if (v === undefined) continue;
    if (spec.enum && !spec.enum.includes(v)) { errors.push(`${name}.${key}: ${v} is not one of ${spec.enum.join('/')}`); continue; }
    if ((spec.type === 'str' || spec.type === 'id') && v.length > (spec.max ?? 100)) { errors.push(`${name}.${key}: longer than ${spec.max ?? 100}`); clean[key] = v.slice(0, spec.max ?? 100); continue; }
    if (spec.type === 'list' && v.length > (spec.max ?? 20)) { errors.push(`${name}.${key}: more than ${spec.max ?? 20} items`); clean[key] = v.slice(0, spec.max ?? 20); continue; }
    clean[key] = v;
  }

  const fp = def.only === 'ga' ? null : clean;
  const ga = [];
  if (def.ga !== false) {
    const toGa = (evName, p) => {
      const out = {};
      for (const [k, v] of Object.entries({ ...context, ...p })) {
        const spec = PARAMS[k];
        if (v === undefined || spec?.ga === false) continue;
        if (spec?.type === 'obj' && k !== 'items') continue;
        if (Array.isArray(v) && k !== 'items') out[k] = v.join(LIST_GA_SEP).slice(0, GA_LIMITS.value);
        else out[k] = typeof v === 'string' ? v.slice(0, GA_LIMITS.value) : v;
      }
      if (Object.keys(out).length > GA_LIMITS.params) errors.push(`${evName}: ${Object.keys(out).length} GA params (limit ${GA_LIMITS.params})`);
      ga.push({ name: evName, params: out });
    };
    if (!def.ga?.alias || def.only === 'ga') toGa(name, clean);
    else {
      toGa(name, clean);
      const mapped = def.ga.map(clean);
      if (mapped) toGa(def.ga.alias, mapped);
    }
  }
  return { fp, ga, errors };
}

// Static checks for tools/analytics-check.mjs.
export function lintSchema() {
  const problems = [];
  for (const [name, def] of Object.entries(EVENTS)) {
    if (name.length > GA_LIMITS.name) problems.push(`${name}: name longer than ${GA_LIMITS.name}`);
    if (!/^[a-z][a-z0-9_]*$/.test(name)) problems.push(`${name}: names are snake_case`);
    for (const p of def.params) if (!PARAMS[p]) problems.push(`${name}: unknown param ${p}`);
    const gaCount = CONTEXT.length + def.params.filter((p) => PARAMS[p]?.ga !== false && PARAMS[p]?.type !== 'obj').length;
    if (def.ga !== false && gaCount > GA_LIMITS.params) problems.push(`${name}: up to ${gaCount} GA params (limit ${GA_LIMITS.params})`);
  }
  return problems;
}

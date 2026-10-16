// Analytics consent (docs/first-party-analytics-plan.md §2). Works out the collection mode:
//   full       outside the EEA/UK/CH, or the player accepted: persistent ids, GA4, offline queue
//   anonymous  consent region without a yes, or Global Privacy Control: summary events only,
//              nothing stored on the device for analytics, no GA4
//   off        Settings → Privacy → Share play statistics is off: nothing is sent at all
import { settings, saveSettings, load, save } from './store.js';

const $ = (s) => document.querySelector(s);

// Fallback when /config can't be reached. Over-inclusive on purpose: a European time zone
// outside the EEA only means one extra question.
const CONSENT_ZONES = /^(Europe\/|Arctic\/Longyearbyen$|Atlantic\/(Reykjavik|Canary|Madeira|Azores|Faroe)$|Asia\/(Nicosia|Famagusta)$)/;
const REGION_KEY = 'freecellworlds.region';

function timezoneRegion() {
  let tz = '';
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch { /* very old browser */ }
  return { country: null, required: CONSENT_ZONES.test(tz), source: 'timezone' };
}

async function fetchConfig(api) {
  if (!api) return null;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 1500);
  try {
    const res = await fetch(`${api}/config`, { signal: ctl.signal, credentials: 'omit' });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const listeners = new Set();

export const consent = {
  region: timezoneRegion(),
  remote: { enabled: true },
  ready: false,

  // choice: 'granted' | 'denied' | null (not asked yet)
  get choice() {
    return load('consent', null)?.choice ?? null;
  },

  get gpc() {
    return navigator.globalPrivacyControl === true;
  },

  get mode() {
    if (settings.shareData === false || this.remote.enabled === false) return 'off';
    if (this.gpc) return 'anonymous';
    if (this.region.required && this.choice !== 'granted') return 'anonymous';
    return 'full';
  },

  async init({ api, forceRegion } = {}) {
    let cached = null;
    try { cached = JSON.parse(sessionStorage.getItem(REGION_KEY) || 'null'); } catch { /* storage off */ }
    if (forceRegion) this.region = { country: null, required: forceRegion === 'eu', source: 'override' };
    else if (cached) this.region = cached;
    else {
      const remote = await fetchConfig(api);
      if (remote) {
        this.region = { country: remote.country ?? null, required: !!remote.consentRequired, source: 'config' };
        if (remote.analytics && remote.analytics.enabled === false) this.remote.enabled = false;
      }
      try { sessionStorage.setItem(REGION_KEY, JSON.stringify(this.region)); } catch { /* storage off */ }
    }
    this.ready = true;
    this.mountUI();
    return this.mode;
  },

  choose(granted) {
    save('consent', { choice: granted ? 'granted' : 'denied', at: Date.now() });
    this.syncUI();
    this.changed();
  },

  // Settings → Share play statistics.
  setShare(on) {
    settings.shareData = !!on;
    saveSettings();
    this.syncUI();
    this.changed();
  },

  onChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  changed() {
    const mode = this.mode;
    for (const fn of listeners) {
      try { fn(mode); } catch (error) { console.warn('[consent]', error); }
    }
  },

  mountUI() {
    const banner = $('#consent-banner');
    if (banner && !banner.dataset.wired) {
      banner.dataset.wired = '1';
      $('#consent-accept')?.addEventListener('click', () => this.choose(true));
      $('#consent-decline')?.addEventListener('click', () => this.choose(false));
    }
    const share = $('#set-share-data');
    if (share && !share.dataset.wired) {
      share.dataset.wired = '1';
      share.addEventListener('change', () => this.setShare(share.checked));
    }
    const cookies = $('#set-analytics-cookies');
    if (cookies && !cookies.dataset.wired) {
      cookies.dataset.wired = '1';
      cookies.addEventListener('change', () => this.choose(cookies.checked));
    }
    this.syncUI();
  },

  syncUI() {
    const banner = $('#consent-banner');
    if (banner) banner.hidden = !(this.ready && this.region.required && this.choice == null && settings.shareData !== false && !this.gpc);
    const share = $('#set-share-data');
    if (share) share.checked = settings.shareData !== false;
    const row = $('#set-analytics-cookies-row');
    if (row) row.hidden = !this.region.required;
    const cookies = $('#set-analytics-cookies');
    if (cookies) {
      cookies.checked = this.choice === 'granted';
      cookies.disabled = settings.shareData === false;
    }
  },
};

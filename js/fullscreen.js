// Full screen toggle for the title screen, the in-game HUD, and the Voyage map.
// Phones often stay in portrait; full screen plus a landscape lock is the
// reliable way to give the table the wide layout. Installed apps are already
// full screen, and iPhone Safari has no Fullscreen API at all.
const EXPAND = 'M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z';
const COMPRESS = 'M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z';

const root = document.documentElement;

function fullscreenElement() {
  return document.fullscreenElement || document.webkitFullscreenElement || null;
}

function canFullscreen() {
  return typeof (root.requestFullscreen || root.webkitRequestFullscreen) === 'function';
}

function requestFullscreen() {
  const request = root.requestFullscreen?.bind(root) || root.webkitRequestFullscreen?.bind(root);
  return request ? request() : Promise.reject(new Error('fullscreen unavailable'));
}

function exitFullscreen() {
  const exit = document.exitFullscreen?.bind(document)
    || document.webkitExitFullscreen?.bind(document)
    || document.webkitCancelFullScreen?.bind(document);
  return exit ? exit() : Promise.resolve();
}

export function initFullscreen({ onPress } = {}) {
  const buttons = [...document.querySelectorAll('.fs-toggle')];
  const hint = document.getElementById('fs-hint');
  if (!buttons.length) return;

  const supported = canFullscreen();
  let orientationLocked = false;
  let opener = null;

  const releaseOrientation = () => {
    if (!orientationLocked) return;
    orientationLocked = false;
    try { screen.orientation?.unlock?.(); } catch { /* already unlocked, or unsupported */ }
  };

  const paint = (on) => {
    const label = on ? 'Exit full screen' : supported ? 'Enter full screen' : 'How to play full screen';
    const title = on ? 'Exit full screen' : supported ? 'Full screen' : 'Full screen help';
    for (const button of buttons) {
      button.classList.toggle('active', on);
      button.setAttribute('aria-pressed', on ? 'true' : 'false');
      button.setAttribute('aria-label', label);
      button.title = title;
      const path = button.querySelector('svg path');
      if (path) path.setAttribute('d', on ? COMPRESS : EXPAND);
      const text = button.querySelector('.fs-label');
      if (text) text.textContent = on ? 'Exit' : 'Full';
    }
  };

  const setExpanded = (open) => {
    for (const button of buttons) {
      if (supported) button.removeAttribute('aria-expanded');
      else button.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
  };

  const placeHint = (anchor) => {
    if (!hint) return;
    const margin = 10;
    hint.hidden = false;
    hint.style.visibility = 'hidden';
    const width = hint.offsetWidth;
    const height = hint.offsetHeight;
    const rect = anchor.getBoundingClientRect();
    let top = rect.bottom + 8;
    if (top + height > window.innerHeight - margin) top = Math.max(margin, rect.top - height - 8);
    let left = rect.right - width;
    left = Math.min(Math.max(margin, left), window.innerWidth - width - margin);
    hint.style.top = `${Math.round(top)}px`;
    hint.style.left = `${Math.round(left)}px`;
    hint.style.visibility = '';
  };

  const hideHint = ({ restore = false } = {}) => {
    if (!hint || hint.hidden) return;
    hint.hidden = true;
    setExpanded(false);
    const returnTo = opener;
    opener = null;
    if (restore && returnTo && document.contains(returnTo)) returnTo.focus();
  };

  const showHint = (anchor) => {
    if (!hint) return;
    opener = anchor;
    placeHint(anchor);
    setExpanded(true);
    hint.querySelector('button')?.focus();
  };

  const enter = async () => {
    try {
      const pending = requestFullscreen();
      if (pending && typeof pending.then === 'function') await pending;
    } catch {
      return;
    }
    try {
      if (typeof screen.orientation?.lock === 'function') {
        await screen.orientation.lock('landscape');
        orientationLocked = true;
        if (!fullscreenElement()) releaseOrientation();
      }
    } catch {
      orientationLocked = false;
    }
  };

  const leave = async () => {
    try {
      const pending = exitFullscreen();
      if (pending && typeof pending.then === 'function') await pending;
    } catch { /* already left, or the browser rejected the exit */ }
    releaseOrientation();
  };

  const sync = () => {
    const on = !!fullscreenElement();
    if (!on) releaseOrientation();
    paint(on);
  };

  for (const button of buttons) {
    if (!supported) button.setAttribute('aria-controls', 'fs-hint');
    button.addEventListener('click', () => {
      try { onPress?.(); } catch { /* a missing click sound should not block the toggle */ }
      if (!supported) {
        if (hint && !hint.hidden && opener === button) hideHint({ restore: true });
        else showHint(button);
        return;
      }
      hideHint();
      if (fullscreenElement()) void leave();
      else void enter();
    });
  }

  document.addEventListener('fullscreenchange', sync);
  document.addEventListener('webkitfullscreenchange', sync);
  paint(!!fullscreenElement());
  setExpanded(false);

  if (!hint) return;
  hint.querySelector('[data-fs-hint-close]')?.addEventListener('click', () => {
    try { onPress?.(); } catch { /* ignore */ }
    hideHint({ restore: true });
  });
  document.addEventListener('pointerdown', (event) => {
    if (hint.hidden) return;
    if (hint.contains(event.target)) return;
    if (event.target instanceof Element && event.target.closest('.fs-toggle')) return;
    hideHint();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || hint.hidden) return;
    event.stopPropagation();
    hideHint({ restore: true });
  }, true);
  window.addEventListener('resize', () => { if (!hint.hidden && opener) placeHint(opener); });
}

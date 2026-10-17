// Compare actual score lines, keeping card feedback consistent with replay, caps,
// cleansing and undo. Ordinary move efficiency and elapsed-time decay stay in the HUD.
function scoreFeedback(before, after, fallbackCard, bonus = false) {
  const result = [];
  for (const [field, value, unit] of [['lines', 'pts', 'points'], ['coinLines', 'coins', 'coins']]) {
    const totals = (sb) => {
      const map = new Map();
      for (const line of sb[field]) map.set(line.key, (map.get(line.key) || 0) + line[value]);
      return map;
    };
    const old = totals(before), next = totals(after);
    for (const [key, total] of next) {
      if (['layover', 'musicbox-stake'].includes(key)) continue;
      if (bonus && field === 'lines' && ['cards', 'efficiency', 'freecells', 'chains', 'bossStars'].includes(key)) continue;
      // The free-cell budget is a positive line which loses points on placement.
      const loss = bonus ? Math.max(0, total) - Math.max(0, old.get(key) || 0)
        : key === 'freecells' ? (old.get(key) || 0) - total
        : Math.max(0, -total) - Math.max(0, -(old.get(key) || 0));
      if (loss <= 0) continue;
      const label = key === 'freecells' ? 'Free-cell cost' : after[field].find((l) => l.key === key).label;
      const cards = (sb) => {
        const map = new Map();
        for (const p of sb[bonus ? 'cardBonuses' : 'cardPenalties'] || []) {
          if (p.key === key && p.unit === unit) map.set(p.card, (map.get(p.card) || 0) + p.amount);
        }
        return map;
      };
      const previous = cards(before);
      let remaining = loss;
      for (const [card, amount] of cards(after)) {
        const charged = Math.min(remaining, Math.max(0, amount - (previous.get(card) || 0)));
        if (charged) result.push({ card, amount: charged, unit, label, ...(bonus ? { bonus: true } : {}), ...(key === 'freecells' ? { muted: true } : {}) });
        remaining -= charged;
      }
      if (remaining && fallbackCard) result.push({ card: fallbackCard, amount: remaining, unit, label, ...(bonus ? { bonus: true } : {}), ...(key === 'freecells' ? { muted: true } : {}) });
    }
  }
  return result;
}

export const penaltyFeedback = (before, after, card) => scoreFeedback(before, after, card);
export const bonusFeedback = (before, after, card) => scoreFeedback(before, after, card, true);

export class PenaltyFloats {
  constructor(project = null) { this.items = []; this.project = project; }
  show(losses, { reducedMotion = false } = {}) {
    for (const loss of losses) {
      const el = document.createElement('div');
      el.className = `card-penalty${loss.bonus ? ' card-bonus' : ''}${loss.muted ? ' card-cost' : ''}`;
      el.hidden = true;
      el.dataset.card = loss.card;
      const amount = document.createElement('strong');
      const unit = loss.unit === 'coins' ? ` coin${loss.amount === 1 ? '' : 's'}` : loss.unit === 'undos' ? ` undo${loss.amount === 1 ? '' : 's'}` : loss.muted ? ' pts' : '';
      amount.textContent = `${loss.bonus ? '+' : '−'}${loss.amount}${unit}`;
      const label = document.createElement('span');
      label.textContent = loss.label;
      el.append(amount);
      if (!loss.muted) el.append(label);
      document.body.append(el);
      // Stack simultaneous effects at this card, including rapid repeat moves.
      const lane = this.items.filter((item) => item.card === loss.card).length;
      this.items.push({ el, card: loss.card, born: performance.now(), lane, reducedMotion });
    }
    if (this.project) this.update(this.project);
  }
  update(project, now = performance.now()) {
    const placed = [];
    this.items = this.items.filter((item) => {
      const age = now - item.born;
      if (age >= 1500) { item.el.remove(); return false; }
      const p = project(item.card);
      item.el.hidden = !p;
      if (p) {
        const rise = item.reducedMotion ? 0 : Math.min(1, age / 1300) * 46;
        const x = Math.max(82, Math.min(innerWidth - 82, p.x));
        let y = Math.min(innerHeight - 45, p.y - 16 - rise - item.lane * 46);
        // Several cards can cash in at the same foundation during autoplay.
        while (placed.some((p) => Math.abs(p.x - x) < 155 && Math.abs(p.y - y) < 44)) y -= 46;
        y = Math.max(32, y);
        placed.push({ x, y });
        item.el.style.left = `${x}px`;
        item.el.style.top = `${y}px`;
        item.el.style.opacity = String(Math.min(1, (1500 - age) / 400));
      }
      return true;
    });
  }
  clear() {
    this.items.forEach(({ el }) => el.remove());
    this.items = [];
  }
}

// Small tween engine used for all card motion.

export const Easing = {
  linear: (t) => t,
  quadIn: (t) => t * t,
  quadOut: (t) => 1 - (1 - t) * (1 - t),
  quadInOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  cubicIn: (t) => t * t * t,
  cubicOut: (t) => 1 - Math.pow(1 - t, 3),
  cubicInOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  quartOut: (t) => 1 - Math.pow(1 - t, 4),
  backOut: (t) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  elasticOut: (t) => {
    if (t === 0 || t === 1) return t;
    const c4 = (2 * Math.PI) / 3;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },
};

export class Animator {
  constructor() {
    this.tweens = [];
  }

  add({ duration = 0.5, delay = 0, ease = Easing.cubicInOut, onUpdate, onComplete }) {
    const tw = { duration, delay, elapsed: -delay, ease, onUpdate, onComplete };
    this.tweens.push(tw);
    return tw;
  }

  remove(tw) {
    const i = this.tweens.indexOf(tw);
    if (i >= 0) this.tweens.splice(i, 1);
  }

  clear() {
    this.tweens.length = 0;
  }

  update(dt) {
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const tw = this.tweens[i];
      tw.elapsed += dt;
      if (tw.elapsed < 0) continue;
      const t = tw.duration <= 0 ? 1 : Math.min(1, tw.elapsed / tw.duration);
      tw.onUpdate && tw.onUpdate(tw.ease(t), t);
      if (t >= 1) {
        this.tweens.splice(i, 1);
        tw.onComplete && tw.onComplete();
      }
    }
  }

  get busy() {
    return this.tweens.length > 0;
  }
}

// ---------------------------------------------------------------------------
// Spring-driven card motion: mass-and-damper feel with overshoot, velocity tilt,
// a lift arc, flip rotation and landing callbacks (used for sound + particles).
// ---------------------------------------------------------------------------
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export class CardMotion {
  constructor() {
    this.items = new Map();
    this.speed = 1; // >1 slower, <1 faster
    this.reduced = false;
    this.onLand = null; // (group, impactSpeed, item)
    this.onFlip = null; // (group)
    this.onTrail = null; // (group, speed)
  }

  get busy() {
    return this.items.size > 0;
  }

  release(g) {
    this.items.delete(g);
  }

  clear() {
    this.items.clear();
  }

  move(g, t, o = {}) {
    const prev = this.items.get(g);
    if (o.fromFlip) g.rotation.x = Math.PI;
    const dist = Math.hypot(t.x - g.position.x, t.z - g.position.z);
    const m = {
      g,
      tx: t.x,
      ty: t.y,
      tz: t.z,
      trx: t.rx || 0,
      try: t.ry || 0,
      vx: prev ? prev.vx : 0,
      vy: prev ? prev.vy : 0,
      vz: prev ? prev.vz : 0,
      vrx: prev ? prev.vrx : 0,
      vry: prev ? prev.vry : 0,
      rx: g.userData.rxState ?? g.rotation.x,
      delay: o.delay || 0,
      arc: this.reduced ? 0 : o.arc || 0,
      spin: this.reduced ? 0 : o.spin || 0,
      d0: Math.max(0.25, dist),
      k: o.stiffness || 190,
      zeta: this.reduced ? 1 : o.damping || 0.7,
      touched: false,
      flipped: !o.fromFlip && Math.abs((g.userData.rxState ?? g.rotation.x) - (t.rx || 0)) < 0.5,
      trail: !!o.trail,
      onLand: o.onLand || null,
      flat: !!o.flat, // slide along the table: no lean into the direction of travel
    };
    g.userData.rxState = m.rx;
    g.userData.target = { x: t.x, y: t.y, z: t.z, rx: m.trx, ry: m.try };
    this.items.set(g, m);
  }

  update(dtReal) {
    const dt = dtReal / this.speed;
    for (const m of [...this.items.values()]) {
      if (m.delay > 0) {
        m.delay -= dtReal;
        if (m.delay > 0) continue;
      }
      let rem = dt;
      while (rem > 1e-6) {
        const h = Math.min(rem, 1 / 120);
        this.step(m, h);
        rem -= h;
      }
      this.apply(m);
    }
  }

  step(m, h) {
    const g = m.g;
    const w = Math.sqrt(m.k);
    const c = 2 * m.zeta * w;
    const dx = m.tx - g.position.x;
    const dz = m.tz - g.position.z;
    const remain = Math.hypot(dx, dz);
    const p = clamp(1 - remain / m.d0, 0, 1);
    const ty = m.ty + m.arc * 4 * p * (1 - p);

    m.vx += (m.k * dx - c * m.vx) * h;
    m.vz += (m.k * dz - c * m.vz) * h;
    m.vy += (m.k * (ty - g.position.y) - c * m.vy) * h;
    g.position.x += m.vx * h;
    g.position.z += m.vz * h;
    g.position.y += m.vy * h;

    const rk = m.k * 0.8;
    const rc = 2 * Math.max(m.zeta, 0.85) * Math.sqrt(rk);
    m.vrx += (rk * (m.trx - m.rx) - rc * m.vrx) * h;
    m.rx += m.vrx * h;
    m.vry += (rk * (m.try + m.spin * Math.sin(Math.PI * p) - g.rotation.y) - rc * m.vry) * h;
    g.rotation.y += m.vry * h;
  }

  apply(m) {
    const g = m.g;
    const speed = Math.hypot(m.vx, m.vz);
    const dist = Math.hypot(m.tx - g.position.x, m.tz - g.position.z);
    const dy = Math.abs(m.ty - g.position.y);

    // Flip crossing the vertical: fire once for the flip sound.
    if (!m.flipped && m.rx < Math.PI / 2) {
      m.flipped = true;
      this.onFlip && this.onFlip(g);
    }
    if (!m.touched && dist < 0.07 && dy < 0.07) {
      m.touched = true;
      const impact = Math.hypot(m.vx, m.vy, m.vz);
      (m.onLand || this.onLand) && (m.onLand || this.onLand)(g, impact, m);
    }
    if (m.trail && this.onTrail) this.onTrail(g, speed);

    const total = dist + dy + Math.abs(m.trx - m.rx) * 0.3;
    const vel = Math.abs(m.vx) + Math.abs(m.vz) + Math.abs(m.vy) + Math.abs(m.vrx) * 0.3;
    if (total < 0.0015 && vel < 0.05) {
      g.position.set(m.tx, m.ty, m.tz);
      g.rotation.set(m.trx, m.try, 0);
      g.userData.rxState = m.trx;
      this.items.delete(g);
      return;
    }
    g.userData.rxState = m.rx;
    // Lean into the direction of travel; relax as it settles.
    const lean = this.reduced || m.flat ? 0 : 1;
    g.rotation.x = m.rx + clamp(m.vz * 0.02, -0.16, 0.16) * lean;
    g.rotation.z = clamp(-m.vx * 0.028, -0.2, 0.2) * lean;
  }
}

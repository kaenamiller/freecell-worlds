// Focused checks for C3 themes (carvings, varsity, driftwood, pinecone, winterglass, concrete).
export async function check({ assert, CHARMS, scoreBoard, BoardEffects, charmContext, stream, kit }) {
  const totem = CHARMS['carvings.totem'];
  assert(totem?.score, 'carvings.totem score hook');
  const sb = {
    initial: {
      tableau: [[1, 2], [], [3], [], [], [], [], []],
      free: [0, 0, 0, 0],
      found: [0, 0, 0, 0],
    },
    history: [],
    stat: { moves: 0, freeCellPlacements: 0, chains: [], cards: 0 },
    lines: [],
    mults: [],
    add(k, l, p) { this.lines.push({ key: k, label: l, pts: p }); },
    scale() {},
    mult() {},
  };
  totem.score(sb);
  assert.equal(sb.lines.length, 0, 'totem: no empty-column bonus on untouched deal');

  const breeze = CHARMS['driftwood.breeze'];
  const baseSb = scoreBoard([], 60, null, { initial: null });
  baseSb.stat.freeCellPlacements = 5;
  baseSb.lines = [{ key: 'freecells', label: '', pts: 0 }];
  breeze.score(baseSb);
  const line = baseSb.lines.find((l) => l.key === 'freecells');
  assert(line && line.pts === 360, 'breeze: first 3 placements free (5 uses → 2 paid)');

  const rivalry = CHARMS['varsity.challenge'];
  const ctx = charmContext({ id: rivalry.id, kind: 'challenge', strength: 5 }, { seed: 'c3', boardIndex: 4 });
  const out = rivalry.thresholds([0, 1000, 2000], ctx);
  assert.equal(out[1], Math.round(1000 * 1.2), 'rivalry s5: +20% on 2★ threshold');

  const mixtape = CHARMS['concrete.mixtape'];
  const chainSb = {
    stat: { chains: [6, 3] },
    history: [],
    lines: [],
    mults: [],
    add(k, l, p) { this.lines.push({ key: k, label: l, pts: p }); },
    scale() {},
    mult() {},
  };
  mixtape.score(chainSb);
  assert(chainSb.lines[0]?.pts === 120, 'mixtape doubles best chain of 6');
}

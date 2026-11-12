/* 猫耳部件（定稿版）：直线三角剪影 + 内耳。
   耳根沿当前头型轮廓生成（对 body path 每条边在 x 处求交取上包络），8 个头型都贴边不悬空。
   尺寸取 01-sizes 里 1.00 档：耳尖高出头顶约 42px（430 视口，bot 288）。 */
(() => {
  const MID = 114.27;
  const BOT = document.querySelector('#bot');
  const BODY = document.querySelector('#shape-body-path');
  const SHAPE_BTNS = [...document.querySelectorAll('#shape-options button')];

  // 每型：[左基点 x, 右基点 x, 耳高 T, 额外外倾角]
  const ANCHORS = {
    blob:     [40, 92, 58, -4],
    pebble:   [40, 92, 58, -4],
    squircle: [40, 92, 58, -2],
    capsule:  [40, 92, 58, -2],
    hex:      [38, 90, 58, -6],
    cloud:    [36, 88, 62, -6],
    drop:     [60, 100, 64, -6],
    triangle: [74, 104, 54, -2]
  };

  const Q = new URLSearchParams(location.search);
  const EAR_SCALE = Number(Q.get('earsize') || 1);     // 相对整耳（含耳根）等比缩放
  const WITH_INNER = Q.get('noinner') !== '1';
  const DEBUG = Q.get('edebug') === '1';

  const group = document.querySelector('#part-cat-ears');

  /* 解析 path 的 d（M/L/C/Q/Z，覆盖本项目的 8 个头型），按约 1.2 单位密度采样成折线。
     比逐点 getPointAtLength 快两个数量级，且第一次切头型也不卡。 */
  const POLY_CACHE = new Map();
  function polygonize(d) {
    if (POLY_CACHE.has(d)) return POLY_CACHE.get(d);
    const tok = d.match(/[MCLQHVZ]|-?\d*\.?\d+/g) || [];
    let i = 0, cur = [0, 0], start = [0, 0], cmd = '';
    const pts = [];
    const add = (x, y) => pts.push([x, y]);
    while (i < tok.length) {
      const t = tok[i];
      if (/[MCLQHVZ]/.test(t)) {
        cmd = t; i++;
        if (cmd === 'Z') cur = start.slice();
        continue;
      }
      if (cmd === 'M') {
        cur = [+tok[i], +tok[i + 1]]; start = cur.slice(); add(cur[0], cur[1]); i += 2; cmd = 'L';
      } else if (cmd === 'L') {
        cur = [+tok[i], +tok[i + 1]]; add(cur[0], cur[1]); i += 2;
      } else if (cmd === 'H') {
        cur = [+tok[i], cur[1]]; add(cur[0], cur[1]); i++;
      } else if (cmd === 'V') {
        cur = [cur[0], +tok[i]]; add(cur[0], cur[1]); i++;
      } else if (cmd === 'C') {
        const p1 = [+tok[i], +tok[i + 1]], p2 = [+tok[i + 2], +tok[i + 3]], p3 = [+tok[i + 4], +tok[i + 5]];
        const n = Math.max(6, Math.ceil((Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) + Math.hypot(p3[0] - p2[0], p3[1] - p2[1])) / 1.2));
        for (let k = 1; k <= n; k++) {
          const u = k / n, v = 1 - u;
          add(
            v * v * v * cur[0] + 3 * v * v * u * p1[0] + 3 * v * u * u * p2[0] + u * u * u * p3[0],
            v * v * v * cur[1] + 3 * v * v * u * p1[1] + 3 * v * u * u * p2[1] + u * u * u * p3[1]
          );
        }
        cur = p3; i += 6;
      } else if (cmd === 'Q') {
        const p1 = [+tok[i], +tok[i + 1]], p2 = [+tok[i + 2], +tok[i + 3]];
        const n = Math.max(5, Math.ceil((Math.hypot(p1[0] - cur[0], p1[1] - cur[1]) + Math.hypot(p2[0] - p1[0], p2[1] - p1[1])) / 1.2));
        for (let k = 1; k <= n; k++) {
          const u = k / n, v = 1 - u;
          add(v * v * cur[0] + 2 * v * u * p1[0] + u * u * p2[0], v * v * cur[1] + 2 * v * u * p1[1] + u * u * p2[1]);
        }
        cur = p2; i += 4;
      } else { i++; }
    }
    POLY_CACHE.set(d, pts);
    return pts;
  }

  /* 取头型上包络：对每条边做 x 处竖线求交，取最小 y（顶边）。
     按边求交而不是按采样点，直边（圆角方/胶囊/六边）也不会漏。 */
  function topEnvelope(x1, x2) {
    const pts = polygonize(BODY.getAttribute('d'));
    const out = [];
    for (let x = x1; x <= x2 + 1e-6; x += 0.5) {
      let y = Infinity;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        if (a[0] === b[0]) continue;
        if ((a[0] - x) * (b[0] - x) > 0) continue;
        const yy = a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]);
        if (yy < y) y = yy;
      }
      if (Number.isFinite(y)) out.push([x, y]);
    }
    return out;
  }

  function tipOf(base, height, lean) {
    const a = base[0], b = base[base.length - 1];
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    let deg = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI - 90;
    deg = Math.max(-100, Math.min(-84, deg)) + lean;
    const r = (deg * Math.PI) / 180;
    return [mx + Math.cos(r) * height, my + Math.sin(r) * height];
  }

  /* 整耳（耳根折线 + 耳尖）绕耳根弦中点等比缩放；耳根因此落到头型内部，依旧贴边 */
  function shrinkTo(base, tip, k) {
    const m = [(base[0][0] + base[base.length - 1][0]) / 2, (base[0][1] + base[base.length - 1][1]) / 2];
    const f = p => [m[0] + (p[0] - m[0]) * k, m[1] + (p[1] - m[1]) * k];
    return { base: base.map(f), tip: f(tip) };
  }

  function pathFor(base, tip, mirror) {
    const x = v => (mirror ? 2 * MID - v : v);
    let d = `M${x(base[0][0]).toFixed(2)} ${base[0][1].toFixed(2)}`;
    for (let i = 1; i < base.length; i++) d += `L${x(base[i][0]).toFixed(2)} ${base[i][1].toFixed(2)}`;
    d += `L${x(tip[0]).toFixed(2)} ${tip[1].toFixed(2)}Z`;
    return d;
  }

  function innerOf(base, tip) {
    const k = 0.52, dy = 7;
    const m = p => [tip[0] + (p[0] - tip[0]) * k, tip[1] + (p[1] - tip[1]) * k + dy];
    return base.map(m);
  }

  function currentShape() {
    const d = BODY.getAttribute('d');
    const hit = SHAPE_BTNS.find(b => b.querySelector('.shape-swatch')?.getAttribute('d') === d);
    return hit ? hit.dataset.shape : 'blob';
  }

  function build() {
    const shape = currentShape();
    const [x1, x2, T, lean] = ANCHORS[shape] || ANCHORS.blob;
    const raw = topEnvelope(x1, x2);
    const { base, tip } = shrinkTo(raw, tipOf(raw, T, lean), EAR_SCALE);
    const out = { left: pathFor(base, tip, false), right: pathFor(base, tip, true), shape };
    if (WITH_INNER) {
      const ib = innerOf(base, tip);
      out.innerLeft = pathFor(ib, [tip[0], tip[1] + 7], false);
      out.innerRight = pathFor(ib, [tip[0], tip[1] + 7], true);
    }
    document.querySelector('#cat-ear-l').setAttribute('d', out.left);
    document.querySelector('#cat-ear-r').setAttribute('d', out.right);
    document.querySelector('#cat-ear-l-in').setAttribute('d', out.innerLeft || '');
    document.querySelector('#cat-ear-r-in').setAttribute('d', out.innerRight || '');
    return out;
  }

  let snap = null;
  const sync = () => { snap = build(); };
  new MutationObserver(sync).observe(BODY, { attributes: true, attributeFilter: ['d'] });
  sync();

  if (DEBUG) {
    BODY.style.fill = '#2f86ed';
    BODY.style.stroke = 'none';
    document.querySelectorAll('#part-cat-ears .cat-ear').forEach(p => { p.style.fill = '#ff0000'; p.style.stroke = 'none'; });
    document.querySelectorAll('#part-cat-ears .cat-ear-inner').forEach(p => { p.style.display = 'none'; });
    [...BOT.children].forEach(el => {
      if (!['shape-body-path', 'part-cat-ears', 'defs'].includes(el.id) && !['title', 'desc'].includes(el.tagName)) el.style.display = 'none';
    });
    group.classList.add('enabled');
  }

  window.CatEars = { sync, data: () => snap, scale: EAR_SCALE };
})();

import { account, accountStat, logout, type Account } from '../api/account';
import { fmtCount, h, icon, ICONS } from './dom';

/**
 * 头像卡片：移植用户贴来的 21st「ID Card Lanyard」——
 * 悬停头像，一条挂绳从头像下方垂下一张工牌（Verlet 绳子 13 个点、重力 .55、摩擦 .98、约束迭代 6 次），
 * 可以拖着甩、点一下翻面，鼠标在卡上时按位置倾斜并打一层高光。
 * 正面：B 站标识、等级 / 会员 / 硬币三行、头像照片、名字、经验、UID / 关注 / 粉丝 / 硬币·B 币、装饰二维码。
 * 背面：条码、个人空间二维码区、原来菜单里的全部入口（个人空间、投稿管理、大会员、钱包、账号设置、退出登录）、签名。
 * 原组件的 Archivo / JetBrains Mono / Caveat 换成站内字体，不从 Google Fonts 拉字。
 */

const NUM_POINTS = 13;
const REST_LENGTH = 140;
const SEGMENT_LENGTH = REST_LENGTH / (NUM_POINTS - 1);
const GRAVITY = 0.55;
const FRICTION = 0.98;
const CONSTRAINT_ITERATIONS = 6;
const TAP_THRESHOLD = 6;
const MAX_TILT = 9;
const HINT_KEY = 'margin:idcl-hint';

type Pt = { x: number; y: number; oldx: number; oldy: number; pinned: boolean };

function qr(seed: number, small = false): HTMLElement {
  const el = h('div', { class: small ? 'idcl-qr idcl-small' : 'idcl-qr', 'aria-hidden': 'true' });
  const seedOn = new Set([0, 1, 2, 9, 10, 11, 18, 19, 20, 6, 7, 8, 15, 16, 17, 24, 25, 26, 54, 55, 56, 63, 64, 65, 72, 73, 74]);
  for (let i = 0; i < 81; i++) el.append(h('i', { class: seedOn.has(i) || (i * seed) % 97 < 46 ? 'on' : '' }));
  return el;
}

function barcode(mid: number): HTMLElement {
  const el = h('div', { class: 'idcl-barcode', 'aria-hidden': 'true' });
  const s = String(mid).padStart(10, '0');
  for (let i = 0; i < 30; i++) {
    const k = (i * 37 + Number(s[i % s.length]) * 11) % 100;
    el.append(h('span', { style: `height:${k > 40 ? 100 : 55}%` }));
  }
  return el;
}

export function createUserMenu(a: Account): HTMLElement {
  const face = (px: number) => `${a.face}@${px}w_${px}h_1c.webp`;
  const trigger = h('a', { class: 'user in', href: `https://space.bilibili.com/${a.mid}`, target: '_blank', rel: 'noopener', 'aria-haspopup': 'dialog', 'aria-label': a.name },
    h('img', { src: face(80), alt: '', referrerpolicy: 'no-referrer' }));
  const wrap = h('div', { class: 'um-wrap' }, trigger);

  /* ── 卡面 ───────────────────────────────────────── */
  const space = `https://space.bilibili.com/${a.mid}`;
  const n = (v: string) => h('b', {}, v);
  const following = n('–'), follower = n('–');
  const pct = a.next > 0 ? Math.min(100, (a.exp / a.next) * 100) : 100;
  const name = h('h2', { class: 'idcl-name' }, a.name);
  if (a.vip && a.vipColor) name.style.color = a.vipColor;
  const role = a.vipLabel || (a.level >= 1 ? '正式会员' : '注册会员');

  const front = h('div', { class: 'idcl-face idcl-front' },
    h('div', { class: 'idcl-hole' }),
    h('div', { class: 'idcl-holo' }),
    h('div', { class: 'idcl-header' },
      h('div', { class: 'idcl-brand' },
        h('span', { class: 'idcl-brand-mark' }, '▲'),
        h('div', { class: 'idcl-brand-text' }, h('b', {}, 'BILIBILI'), h('small', {}, 'Margin · 映间'))),
      h('div', { class: 'idcl-pillars' },
        h('span', {}, `LV${a.level}`), h('span', {}, role), h('span', {}, `硬币 ${a.coins}`), h('i'))),
    h('div', { class: 'idcl-photo' },
      h('img', { class: 'idcl-photo-bg', src: face(96), alt: '', referrerpolicy: 'no-referrer' }),
      h('img', { class: 'idcl-photo-face', src: face(240), alt: '', referrerpolicy: 'no-referrer' }),
      a.vip ? h('span', { class: 'idcl-verified', title: role }, svgCheck()) : ''),
    name,
    h('p', { class: 'idcl-role' }, `${role} · LV${a.level}`),
    h('div', { class: 'idcl-exp', title: a.next > 0 ? `经验 ${a.exp} / ${a.next}` : '已满级' },
      h('i', { style: `width:${pct}%` })),
    h('div', { class: 'idcl-divider' }),
    h('div', { class: 'idcl-idrow' },
      h('div', { class: 'idcl-idrow-labels' },
        h('div', {}, h('span', {}, 'UID'), n(String(a.mid))),
        h('a', { href: `${space}/relation/follow`, target: '_blank', rel: 'noopener' }, h('span', {}, '关注'), following),
        h('a', { href: `${space}/relation/fans`, target: '_blank', rel: 'noopener' }, h('span', {}, '粉丝'), follower),
        h('div', {}, h('span', {}, '硬币 · B币'), n(`${a.coins} · ${a.bcoin}`))),
      qr(574123 + a.mid % 997, true)),
    h('div', { class: 'idcl-footer' }, '点赞', h('i', {}, '·'), '投币', h('i', {}, '·'), '收藏'),
  );

  const link = (label: string, ic: string, href: string) => h('a', { class: 'idcl-link', href, target: '_blank', rel: 'noopener' }, icon(ic), h('span', {}, label));
  const out = h('button', { class: 'idcl-link danger', type: 'button' }, icon(ICONS.exit), h('span', {}, '退出登录'));
  out.addEventListener('click', async () => {
    if (!confirm('退出当前 B 站账号？')) return;
    out.setAttribute('aria-disabled', 'true');
    if (await logout()) location.reload(); else out.removeAttribute('aria-disabled');
  });
  const back = h('div', { class: 'idcl-face idcl-back' },
    h('div', { class: 'idcl-hole' }),
    h('div', { class: 'idcl-holo' }),
    h('div', { class: 'idcl-stripe' }),
    h('div', { class: 'idcl-idnum' }, h('span', {}, `NO. ${a.mid}`), h('em', {}, `LV${a.level}`)),
    barcode(a.mid),
    h('div', { class: 'idcl-backrow' },
      qr(928371 + a.mid % 991),
      h('div', { class: 'idcl-scan' }, h('b', {}, '个人空间'), `space.bilibili.com/${a.mid}`, h('br'), '投稿、收藏与动态')),
    h('div', { class: 'idcl-links' },
      link('个人空间', ICONS.user, space),
      link('投稿管理', ICONS.upload, 'https://member.bilibili.com/platform/upload-manager/article'),
      link('大会员', ICONS.vip, 'https://account.bilibili.com/big'),
      link('我的钱包', ICONS.wallet, 'https://pay.bilibili.com/'),
      link('账号设置', ICONS.gear, 'https://account.bilibili.com/account/home'),
      out),
    h('div', { class: 'idcl-sig' }, h('div', { class: 'idcl-script' }, a.name), h('small', {}, 'Authorized Signature')),
  );

  const flipper = h('div', { class: 'idcl-flipper' }, front, back);
  const card = h('div', { class: 'idcl-card', role: 'dialog', 'aria-label': `${a.name} 的账号卡片` }, flipper);
  const canvas = h('canvas', { class: 'idcl-rope' }) as HTMLCanvasElement;
  const hint = h('div', { class: 'idcl-hint' }, h('span', {}, '拖动摇晃 · 点击翻面'));
  const stage = h('div', { class: 'idcl-stage', hidden: '' }, canvas, card);
  if (!localStorage.getItem(HINT_KEY)) card.append(hint);

  /* ── 物理（原组件逻辑） ─────────────────────────── */
  const ctx = canvas.getContext('2d')!;
  const anchor = { x: 0, y: 0 };
  const points: Pt[] = [];
  let dragging = false, flipped = false, interacted = false;
  let downPos = { x: 0, y: 0 }, pointer = { x: 0, y: 0 }, lastPointer = { x: 0, y: 0 };
  const velocity = { x: 0, y: 0 };
  let flipTarget = 0, flipCurrent = 0;
  const tiltTarget = { x: 0, y: 0 }, tiltCurrent = { x: 0, y: 0 };
  let mouse = { x: -9999, y: -9999 };
  let raf = 0, isOpen = false, dpr = 1, t = 0;

  const resize = () => {
    dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr;
    canvas.style.width = `${innerWidth}px`; canvas.style.height = `${innerHeight}px`;
    const r = trigger.getBoundingClientRect();
    anchor.x = r.left + r.width / 2;
    anchor.y = r.bottom + 10;
    // 卡片宽 236，别让它挂出视口右边
    anchor.x = Math.min(anchor.x, innerWidth - 140);
  };
  const clamp = (p: { x: number; y: number }) => {
    p.x = Math.max(18, Math.min(innerWidth - 18, p.x));
    p.y = Math.max(anchor.y + 20, Math.min(innerHeight - 30, p.y));
    return p;
  };
  const updatePoints = () => {
    for (let i = 1; i < points.length; i++) {
      if (dragging && i === points.length - 1) continue;
      const p = points[i];
      const vx = (p.x - p.oldx) * FRICTION, vy = (p.y - p.oldy) * FRICTION;
      p.oldx = p.x; p.oldy = p.y;
      p.x += vx; p.y += vy + GRAVITY;
    }
  };
  const applyConstraints = () => {
    points[0].x = anchor.x; points[0].y = anchor.y;
    if (dragging) { const last = points[points.length - 1]; last.x = pointer.x; last.y = pointer.y; }
    for (let iter = 0; iter < CONSTRAINT_ITERATIONS; iter++) {
      for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i], p2 = points[i + 1];
        const dx = p2.x - p1.x, dy = p2.y - p1.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.0001;
        const diff = (SEGMENT_LENGTH - dist) / dist;
        const offX = dx * diff * 0.5, offY = dy * diff * 0.5;
        if (!p1.pinned) { p1.x -= offX; p1.y -= offY; }
        if (!(dragging && i + 1 === points.length - 1)) { p2.x += offX; p2.y += offY; }
      }
    }
    for (let i = 1; i < points.length; i++) clamp(points[i]);
  };
  const drawRope = () => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    const path: { x: number; y: number; cx?: number; cy?: number }[] = [{ x: points[0].x, y: points[0].y }];
    for (let i = 1; i < points.length - 1; i++) path.push({ x: points[i].x, y: points[i].y, cx: (points[i].x + points[i + 1].x) / 2, cy: (points[i].y + points[i + 1].y) / 2 });
    path.push({ x: points[points.length - 1].x, y: points[points.length - 1].y });
    const ribbon = (style: string, width: number) => {
      ctx.beginPath(); ctx.moveTo(path[0].x, path[0].y);
      for (let i = 1; i < path.length; i++) { const p = path[i]; if (p.cx !== undefined) ctx.quadraticCurveTo(p.x, p.y, p.cx, p.cy!); else ctx.lineTo(p.x, p.y); }
      ctx.strokeStyle = style; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
    };
    ctx.save(); ctx.translate(2, 4); ctx.globalAlpha = 0.3; ribbon('#000000', 16); ctx.restore();
    ribbon('#1c1e23', 16); ribbon('rgba(0,0,0,0.35)', 16.5); ribbon('#1c1e23', 13.5); ribbon('rgba(255,255,255,0.07)', 3);
    const mi = Math.floor(points.length * 0.3);
    const m = points[mi], mp = points[mi - 1], mn = points[mi + 1];
    ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(Math.atan2(mn.y - mp.y, mn.x - mp.x) + Math.PI / 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(-4, 3.5); ctx.lineTo(0, -3.5); ctx.lineTo(4, 3.5); ctx.stroke(); ctx.restore();
  };
  const drawClip = () => {
    ctx.save(); ctx.translate(anchor.x, anchor.y - 2);
    const g = ctx.createLinearGradient(-11, -9, 11, 9);
    g.addColorStop(0, '#e7e9ec'); g.addColorStop(0.35, '#aeb2b8'); g.addColorStop(0.65, '#7c8087'); g.addColorStop(1, '#4d5157');
    ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(-11, -9, 22, 16, 4); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.moveTo(-8, -6); ctx.lineTo(8, -6); ctx.stroke();
    ctx.fillStyle = '#3a3d42'; ctx.beginPath(); ctx.arc(0, 0, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };
  const positionCard = () => {
    const last = points[points.length - 1], prev = points[points.length - 2];
    const angle = Math.atan2(last.y - prev.y, last.x - prev.x) - Math.PI / 2;
    card.style.left = `${last.x - card.offsetWidth / 2}px`;
    card.style.top = `${last.y}px`;
    card.style.transform = `rotate(${angle}rad)`;
  };
  const updateTilt = () => {
    flipCurrent += (flipTarget - flipCurrent) * 0.16;
    if (!dragging && mouse.x > -1000) {
      const cx = card.offsetLeft + card.offsetWidth / 2, cy = card.offsetTop + card.offsetHeight / 2;
      const dx = Math.max(-1, Math.min(1, (mouse.x - cx) / (card.offsetWidth / 2)));
      const dy = Math.max(-1, Math.min(1, (mouse.y - cy) / (card.offsetHeight / 2)));
      tiltTarget.y = dx * MAX_TILT; tiltTarget.x = -dy * MAX_TILT;
      card.style.setProperty('--mx', `${Math.max(0, Math.min(100, ((mouse.x - card.offsetLeft) / card.offsetWidth) * 100))}%`);
      card.style.setProperty('--my', `${Math.max(0, Math.min(100, ((mouse.y - card.offsetTop) / card.offsetHeight) * 100))}%`);
      card.classList.add('idcl-hovering');
    } else {
      tiltTarget.x = 0; tiltTarget.y = 0;
      card.classList.remove('idcl-hovering');
    }
    tiltCurrent.x += (tiltTarget.x - tiltCurrent.x) * 0.12;
    tiltCurrent.y += (tiltTarget.y - tiltCurrent.y) * 0.12;
    flipper.style.transform = `rotateY(${flipCurrent + tiltCurrent.y}deg) rotateX(${tiltCurrent.x}deg)`;
  };
  const loop = () => {
    updatePoints(); applyConstraints(); drawRope(); drawClip(); positionCard(); updateTilt();
    raf = requestAnimationFrame(loop);
  };

  /* ── 指针 ──────────────────────────────────────── */
  const pos = (e: PointerEvent) => ({ x: e.clientX, y: e.clientY });
  card.addEventListener('pointerdown', (e) => {
    if ((e.target as HTMLElement).closest('a, button')) return;
    e.preventDefault();
    dragging = true;
    if (!interacted) { interacted = true; hint.classList.add('idcl-hint-hidden'); localStorage.setItem(HINT_KEY, '1'); }
    card.setPointerCapture(e.pointerId);
    // 记住抓的位置相对绳端的偏移，免得一按下卡片顶端就跳到鼠标处（原组件会跳）
    const raw = pos(e), last = points[points.length - 1];
    grab = { x: raw.x - last.x, y: raw.y - last.y };
    const p = { x: last.x, y: last.y };
    pointer = p; lastPointer = p; downPos = raw;
  });
  // 是否还在「头像 + 绳子 + 卡片」范围里：卡片会甩到鼠标下面又甩走，用 pointerleave 判断会误收
  const inside = (x: number, y: number) => {
    const pad = 16;
    const hit = (r: DOMRect) => x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad;
    if (hit(trigger.getBoundingClientRect()) || hit(card.getBoundingClientRect())) return true;
    let l = anchor.x, r = anchor.x, t = anchor.y, b = anchor.y;
    for (const p of points) { l = Math.min(l, p.x); r = Math.max(r, p.x); t = Math.min(t, p.y); b = Math.max(b, p.y); }
    return x >= l - 28 && x <= r + 28 && y >= t - 28 && y <= b + 4;
  };
  let away = false;
  let grab = { x: 0, y: 0 };
  const onMove = (e: PointerEvent) => {
    if (!e.isTrusted) return; // 页面脚本派发的合成事件不算
    mouse = pos(e);
    if (!dragging) {
      const out = !inside(mouse.x, mouse.y);
      if (out && !away) scheduleClose();
      if (!out && away) clearTimeout(t);
      away = out;
      return;
    }
    const p = clamp({ x: mouse.x - grab.x, y: mouse.y - grab.y });
    velocity.x = p.x - lastPointer.x; velocity.y = p.y - lastPointer.y;
    lastPointer = p; pointer = p;
  };
  const onUp = (e: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    const p = pos(e);
    const last = points[points.length - 1];
    if (Math.hypot(p.x - downPos.x, p.y - downPos.y) < TAP_THRESHOLD) {
      flipped = !flipped; flipTarget = flipped ? 180 : 0;
      last.oldx = last.x; last.oldy = last.y;
      return;
    }
    last.oldx = last.x - velocity.x; last.oldy = last.y - velocity.y;
    away = !inside(p.x, p.y);
    if (away) scheduleClose();
  };
  // 鼠标离开窗口时只取消倾斜；回到页面并移出范围时再收起
  const onOut = () => { mouse = { x: -9999, y: -9999 }; };

  /* ── 打开 / 收起：悬停头像垂下，离开头像和卡片 .4s 后收起 ── */
  let loaded = false;
  const open = () => {
    clearTimeout(t);
    if (isOpen) return;
    isOpen = true;
    away = false;
    if (!stage.isConnected) (wrap.closest('.app') ?? wrap.getRootNode() as ShadowRoot).append(stage);
    resize();
    points.length = 0;
    // 和原组件一样按原长摆直，再给一点横向初速度，挂出来时轻轻晃一下
    for (let i = 0; i < NUM_POINTS; i++) { const y = anchor.y + i * SEGMENT_LENGTH; points.push({ x: anchor.x, y, oldx: anchor.x + (i / NUM_POINTS) * 3, oldy: y, pinned: i === 0 }); }
    flipped = false; flipTarget = 0; flipCurrent = 0;
    stage.hidden = false;
    stage.classList.remove('idcl-leaving');
    addEventListener('pointermove', onMove);
    addEventListener('pointerup', onUp);
    addEventListener('resize', resize);
    addEventListener('blur', onOut);
    cancelAnimationFrame(raf); loop();
    wrap.setAttribute('data-open', '');
    if (!loaded) {
      loaded = true;
      accountStat().then((s) => { following.textContent = fmtCount(s.following); follower.textContent = fmtCount(s.follower); }).catch(() => { loaded = false; });
    }
  };
  const close = () => {
    if (!isOpen || dragging) return;
    isOpen = false;
    wrap.removeAttribute('data-open');
    stage.classList.add('idcl-leaving');
    window.setTimeout(() => {
      if (isOpen) return;
      stage.hidden = true;
      cancelAnimationFrame(raf);
      removeEventListener('pointermove', onMove);
      removeEventListener('pointerup', onUp);
      removeEventListener('resize', resize);
      removeEventListener('blur', onOut);
    }, 220);
  };
  const scheduleClose = () => { clearTimeout(t); t = window.setTimeout(close, 500); };

  wrap.addEventListener('pointerenter', (e) => { if ((e as PointerEvent).pointerType !== 'touch') { clearTimeout(t); t = window.setTimeout(open, 120); } });
  wrap.addEventListener('pointerleave', () => { if (!isOpen) clearTimeout(t); });
  wrap.addEventListener('focusin', open);
  card.addEventListener('focusout', (e) => { if (!card.contains((e as FocusEvent).relatedTarget as Node)) scheduleClose(); });
  const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && isOpen) { dragging = false; close(); trigger.focus(); } };
  wrap.addEventListener('keydown', esc);
  card.addEventListener('keydown', esc);
  return wrap;
}

function svgCheck(): SVGElement {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.innerHTML = '<path d="M4 12l5 5L20 6" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>';
  return s;
}

export { account };

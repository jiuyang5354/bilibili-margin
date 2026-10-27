/* 映间 MARGIN · 交互增强（改写自 21st.dev 组件：HoverPlayCard、Beam Search Bar、Theme Toggle、Command Search）
 * 不依赖构建，直接作用在 #margin-extension 的 shadow DOM 上。 */
(() => {
  if (window.__margin21) return;
  window.__margin21 = true;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');

  const SHADOW_CSS = `
/* ---------- HoverPlayCard：悬停静音预览 ---------- */
.v2-cover .m21-preview{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:2;opacity:0;transition:opacity .35s ease;background:#000;pointer-events:none}
.v2-cover .m21-preview.on{opacity:1}
.v2-cover .m21-bar{position:absolute;left:0;bottom:0;height:3px;width:0;z-index:4;background:linear-gradient(90deg,#00aeec,#fb7299);border-radius:0 2px 2px 0;transition:width .25s linear;pointer-events:none}
.v2-cover .m21-sound{position:absolute;left:8px;bottom:8px;z-index:5;display:flex;align-items:center;gap:5px;padding:4px 9px 4px 7px;border-radius:999px;font-size:11px;line-height:1;color:#fff;background:rgb(0 0 0 / .45);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);opacity:0;transform:translateY(4px);transition:opacity .25s,transform .25s,background .2s;cursor:pointer}
.v2-cover .m21-sound.on{opacity:1;transform:none}
.v2-cover .m21-sound:hover{background:rgb(0 0 0 / .65)}
.v2-cover .m21-sound svg{width:13px;height:13px}
.v2-cover.m21-playing .v2-cover-play,.v2-cover.m21-playing .v2-cover-duration{opacity:0!important;transition:opacity .25s}
.v2-cover .m21-spin{position:absolute;right:9px;top:9px;z-index:5;width:14px;height:14px;border-radius:50%;border:2px solid rgb(255 255 255 / .35);border-top-color:#fff;animation:m21-rot .7s linear infinite;pointer-events:none}
@keyframes m21-rot{to{transform:rotate(360deg)}}

/* ---------- Beam Search Bar：聚焦光束 ---------- */
.search-input-row{position:relative}
.search-input-row::after,.search-input-row::before{content:"";position:absolute;left:0;right:0;bottom:-1px;height:2px;pointer-events:none;opacity:0;transition:opacity .35s ease;
  background:linear-gradient(90deg,transparent 0,#00aeec 30%,#fb7299 55%,#8b6cff 75%,transparent 100%);background-size:45% 100%;background-repeat:no-repeat;animation:m21-beam 2.6s cubic-bezier(.45,.05,.35,1) infinite}
.search-input-row::before{height:14px;bottom:-8px;filter:blur(10px)}
.search-input-row:focus-within::after{opacity:1}
.search-input-row:focus-within::before{opacity:.55}
.v4-search{position:relative}
.v4-search::after{content:"";position:absolute;left:14px;right:14px;bottom:0;height:1.5px;pointer-events:none;opacity:0;transition:opacity .3s;
  background:linear-gradient(90deg,transparent,#00aeec,#fb7299,transparent);background-size:50% 100%;background-repeat:no-repeat;animation:m21-beam 2.2s linear infinite}
.v4-search:hover::after,.v4-search:focus-visible::after{opacity:1}
@keyframes m21-beam{from{background-position:-60% 0}to{background-position:160% 0}}

/* ---------- Command Search：滑动高亮 + 打字机提示 ---------- */
.command-list{position:relative}
.command-list .m21-pill{position:absolute;left:10px;right:10px;top:0;height:0;border-radius:8px;background:var(--subtle);z-index:0;pointer-events:none;opacity:0;
  transition:transform .26s cubic-bezier(.34,1.25,.64,1),height .2s ease,opacity .15s}
.command-list .command-option{position:relative;z-index:1}
.command-list.m21-has-pill .command-option.active{background:transparent!important}
.command-list.m21-has-pill .command-option.active::before{content:"";position:absolute;left:0;top:50%;width:3px;height:16px;margin-top:-8px;border-radius:2px;background:#00aeec}

/* ---------- Theme Toggle：日月变形 ---------- */
.v2-theme-button svg{animation:m21-morph .55s cubic-bezier(.34,1.4,.64,1)}
.v2-theme-button:hover svg{transform:rotate(-18deg);transition:transform .3s}
@keyframes m21-morph{from{transform:rotate(-120deg) scale(.4);opacity:0}to{transform:none;opacity:1}}

@media (prefers-reduced-motion: reduce){
  .search-input-row::after,.search-input-row::before,.v4-search::after{animation:none;background-size:100% 100%}
  .v2-theme-button svg{animation:none}
  .command-list .m21-pill{transition:none}
}`;

  const DOC_CSS = `
::view-transition-old(root),::view-transition-new(root){animation:none;mix-blend-mode:normal}
html.m21-reveal::view-transition-new(root){animation:m21-reveal .68s cubic-bezier(.22,.9,.24,1) both}
@keyframes m21-reveal{from{clip-path:circle(0 at var(--m21-x,50%) var(--m21-y,50%))}to{clip-path:circle(var(--m21-r,150vmax) at var(--m21-x,50%) var(--m21-y,50%))}}`;

  const docStyle = document.createElement('style');
  docStyle.id = 'margin-21st-doc';
  docStyle.textContent = DOC_CSS;
  (document.head || document.documentElement).appendChild(docStyle);

  let root = null;
  let previewOn = true;
  try {
    chrome.storage?.local.get('margin-hover-preview', (v) => { previewOn = v?.['margin-hover-preview'] !== false; });
    chrome.storage?.onChanged.addListener((c) => { if (c['margin-hover-preview']) previewOn = c['margin-hover-preview'].newValue !== false; });
  } catch (_) {}

  /* ---------------- 悬停预览 ---------------- */
  const urlCache = new Map();
  async function getPlayUrl(bvid, cid) {
    const key = bvid;
    if (urlCache.has(key)) return urlCache.get(key);
    const job = (async () => {
      if (!cid) {
        const r = await fetch(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`, { credentials: 'include' }).then((x) => x.json());
        cid = r?.data?.cid;
        if (!cid) throw new Error('no cid');
      }
      const q = `bvid=${bvid}&cid=${cid}&qn=16&fnval=1&fnver=0&fourk=0&platform=html5&high_quality=1`;
      let r = await fetch(`https://api.bilibili.com/x/player/playurl?${q}`, { credentials: 'include' }).then((x) => x.json());
      let u = r?.data?.durl?.[0]?.url;
      if (!u) throw new Error('no url ' + r?.code);
      return u.replace(/^http:/, 'https:');
    })();
    urlCache.set(key, job);
    job.catch(() => urlCache.delete(key));
    return job;
  }

  const ICON_MUTE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>';
  const ICON_SOUND = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/></svg>';
  let soundWanted = false; // 用户点过“开声音”后，后续预览也带声音
  let active = null;

  function stopPreview() {
    if (!active) return;
    const { cover, timer, video, extras } = active;
    clearTimeout(timer);
    if (video) { try { video.pause(); video.removeAttribute('src'); video.load(); } catch (_) {} video.remove(); }
    extras.forEach((n) => n.remove());
    cover.classList.remove('m21-playing');
    active = null;
  }

  function startPreview(cover) {
    if (active?.cover === cover) return;
    stopPreview();
    const art = cover.closest('article[data-bvid]');
    if (!art || !previewOn) return;
    const bvid = art.dataset.bvid;
    const cid = Number(art.dataset.cid) || 0;
    const state = { cover, extras: [], video: null, timer: 0 };
    active = state;
    state.timer = setTimeout(async () => {
      const spin = document.createElement('span');
      spin.className = 'm21-spin';
      cover.appendChild(spin);
      state.extras.push(spin);
      let url;
      try { url = await getPlayUrl(bvid, cid); } catch (_) { if (active === state) spin.remove(); return; }
      if (active !== state) return;
      const v = document.createElement('video');
      v.className = 'm21-preview';
      v.muted = !soundWanted;
      v.playsInline = true;
      v.loop = true;
      v.preload = 'auto';
      v.src = url;
      state.video = v;
      const bar = document.createElement('span');
      bar.className = 'm21-bar';
      const snd = document.createElement('span');
      snd.className = 'm21-sound';
      snd.setAttribute('role', 'button');
      snd.setAttribute('aria-label', '切换预览声音');
      const paint = () => { snd.innerHTML = (v.muted ? ICON_MUTE : ICON_SOUND) + `<span>${v.muted ? '静音预览' : '声音已开'}</span>`; };
      paint();
      snd.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
        v.muted = !v.muted; soundWanted = !v.muted; paint();
        if (v.paused) v.play().catch(() => {});
      }, true);
      snd.addEventListener('pointerdown', (e) => e.stopPropagation(), true);
      state.extras.push(bar, snd);
      v.addEventListener('playing', () => {
        if (active !== state) return;
        spin.remove();
        v.classList.add('on'); snd.classList.add('on'); cover.classList.add('m21-playing');
      });
      v.addEventListener('timeupdate', () => { if (v.duration) bar.style.width = (v.currentTime / v.duration * 100).toFixed(2) + '%'; });
      v.addEventListener('error', () => { if (active === state) stopPreview(); });
      cover.append(v, bar, snd);
      v.play().catch(() => { v.muted = true; paint(); v.play().catch(() => {}); });
    }, 450);
  }

  function bindHover(r) {
    r.addEventListener('pointerover', (e) => {
      const cover = e.target.closest?.('.v2-cover');
      if (cover) startPreview(cover);
    });
    r.addEventListener('pointerout', (e) => {
      if (!active) return;
      const wrap = active.cover.closest('.v2-cover-wrap') || active.cover;
      if (!e.relatedTarget || !wrap.contains(e.relatedTarget)) stopPreview();
    });
    r.addEventListener('click', (e) => { if (e.target.closest?.('.v2-cover')) stopPreview(); }, true);
    window.addEventListener('blur', stopPreview);
    document.addEventListener('visibilitychange', () => { if (document.hidden) stopPreview(); });
  }

  /* ---------------- 主题圆形揭幕 ---------------- */
  function bindTheme(r) {
    r.addEventListener('click', (e) => {
      const btn = e.target.closest?.('.v2-theme-button');
      if (!btn || !e.isTrusted || reduce.matches || typeof document.startViewTransition !== 'function') return;
      e.preventDefault(); e.stopImmediatePropagation(); e.stopPropagation();
      const b = btn.getBoundingClientRect();
      const x = b.left + b.width / 2, y = b.top + b.height / 2;
      const rad = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
      const h = document.documentElement;
      h.style.setProperty('--m21-x', x + 'px');
      h.style.setProperty('--m21-y', y + 'px');
      h.style.setProperty('--m21-r', rad + 'px');
      h.classList.add('m21-reveal');
      const t = document.startViewTransition(() => new Promise((res) => {
        btn.click();
        requestAnimationFrame(() => requestAnimationFrame(res));
      }));
      t.finished.finally(() => h.classList.remove('m21-reveal'));
    }, true);
  }

  /* ---------------- 命令面板：高亮 pill + 打字机 ---------------- */
  const SAMPLES = ['影视飓风', 'LPL 赛事集锦', '罗翔说刑法', '4K 城市漫步', '原神 新版本', '何同学'];
  let typer = null;
  function runTyper(input) {
    if (typer?.input === input) return;
    stopTyper();
    const base = input.getAttribute('placeholder') || '';
    const st = { input, base, i: 0, ch: 0, dir: 1, t: 0 };
    typer = st;
    const tick = () => {
      if (typer !== st) return;
      if (input.value) { input.placeholder = base; st.t = setTimeout(tick, 600); return; }
      const word = SAMPLES[st.i % SAMPLES.length];
      st.ch += st.dir;
      input.placeholder = '试试搜索：' + word.slice(0, st.ch) + '▍';
      let wait = st.dir > 0 ? 140 : 60;
      if (st.ch >= word.length) { st.dir = -1; wait = 2200; }
      else if (st.ch <= 0) { st.dir = 1; st.i++; wait = 500; }
      st.t = setTimeout(tick, wait);
    };
    st.t = setTimeout(tick, 700);
  }
  function stopTyper() {
    if (!typer) return;
    clearTimeout(typer.t);
    typer.input.placeholder = typer.base;
    typer = null;
  }

  const pilled = new WeakSet();
  function bindPill(list) {
    if (pilled.has(list)) return;
    pilled.add(list);
    const pill = document.createElement('div');
    pill.className = 'm21-pill';
    list.prepend(pill);
    list.classList.add('m21-has-pill');
    const place = () => {
      if (!pill.isConnected) list.prepend(pill);
      const a = list.querySelector('.command-option.active');
      if (!a) { pill.style.opacity = '0'; return; }
      pill.style.opacity = '1';
      pill.style.transform = `translateY(${a.offsetTop}px)`;
      pill.style.height = a.offsetHeight + 'px';
    };
    list.__m21place = place;
    new MutationObserver(place).observe(list, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
    place();
  }

  function scan() {
    if (!root) return;
    const dlg = root.querySelector('.search-dialog');
    const input = dlg?.querySelector('input');
    if (dlg && dlg.open && input && !reduce.matches) runTyper(input); else stopTyper();
    root.querySelectorAll('.command-list').forEach((l) => { bindPill(l); if (dlg?.open) requestAnimationFrame(() => l.__m21place?.()); });
  }

  function attach() {
    const host = document.getElementById('margin-extension');
    const r = host?.shadowRoot;
    if (!r || r === root) return;
    root = r;
    if (!r.getElementById('margin-21st')) {
      const st = document.createElement('style');
      st.id = 'margin-21st';
      st.textContent = SHADOW_CSS;
      r.appendChild(st);
    }
    bindHover(r);
    bindTheme(r);
    new MutationObserver(scan).observe(r, { subtree: true, childList: true, attributes: true, attributeFilter: ['open'] });
    scan();
  }

  attach();
  setInterval(attach, 1500);
  document.addEventListener('DOMContentLoaded', attach);
})();

// Regressions for #263 (folder card text scaling), #237 follow-ups (settings gear rim + sticky back button glass),
// #219 (header capsule endcap concentricity), and #261 (favorites keyword search + non-create ftype passthrough).
import assert from 'node:assert/strict';
import { chromium, firefox } from 'playwright';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { build } from 'vite';
import { apiBody, installMocks } from './mocks.mjs';

const out = resolve(process.env.SMOKE_OUT || 'tests/artifacts/quick-fixes');
mkdirSync(out, { recursive: true });
const ext = resolve(process.env.SMOKE_EXT || 'dist');
const results = [], errors = [];

const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'margin-quick-fixes-')), {
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : { channel: 'chromium' }),
  headless: true, viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1.2,
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
});

try {
  const favRequests = [];
  const chargingFeedItems = [
    {
      id_str: '990001', type: 'DYNAMIC_TYPE_NONE',
      modules: {
        module_author: { mid: 346563107, name: '波士顿圆脸', face: '', pub_ts: Math.floor(Date.now() / 1000) - 3600, icon_badge: { text: '充电专属' } },
        module_stat: { comment: { count: 42 }, forward: { count: 3 }, like: { count: 320 } },
        module_dynamic: {
          desc: null,
          major: {
            type: 'MAJOR_TYPE_BLOCKED',
            blocked: {
              blocked_type: 3, title: '仅充电用户可见', hint_message: '加入 TA 的包月充电，解锁充电专属动态',
              jump_url: 'https://space.bilibili.com/346563107', button: { text: '去充电查看' },
            },
          },
        },
      },
    },
    {
      id_str: '990002', type: 'DYNAMIC_TYPE_OPUS', basic: { is_only_fans: true },
      modules: {
        module_author: { mid: 346563107, name: '波士顿圆脸', face: '', pub_ts: Math.floor(Date.now() / 1000) - 7200 },
        module_stat: { comment: { count: 12 }, forward: { count: 1 }, like: { count: 90 } },
        module_dynamic: { desc: null, major: { type: 'MAJOR_TYPE_OPUS', opus: { summary: { text: '' } } } },
      },
    },
  ];
  await installMocks(ctx, (url) => {
    const u = new URL(url);
    if (u.pathname.includes('/fav/resource/list')) {
      favRequests.push({ mediaId: u.searchParams.get('media_id'), keyword: u.searchParams.get('keyword') ?? '', type: u.searchParams.get('type') ?? '0' });
      const base = apiBody(url);
      const kw = (u.searchParams.get('keyword') ?? '').trim().toLowerCase();
      if (kw) {
        base.data.medias = base.data.medias.filter((m) => m.title.toLowerCase().includes(kw) || (m.upper?.name ?? '').toLowerCase().includes(kw));
      }
      return base;
    }
    if (u.pathname.endsWith('/web-dynamic/v1/feed/all') || u.pathname.endsWith('/web-dynamic/v1/feed/space')) {
      const base = apiBody(url);
      base.data.items = [...chargingFeedItems, ...base.data.items];
      return base;
    }
    if (u.pathname.includes('/fav/folder/collected/list')) {
      return { code: 0, data: { has_more: false, list: [{ id: 801, type: 21, title: '设计合集', media_count: 2, cover: '' }] } };
    }
    if (u.pathname.includes('/fav/season/list')) {
      return { code: 0, data: { info: { upper: { mid: 9, name: '合集作者' } }, medias: [
        { id: 1, bvid: 'BVseasonA', title: '字体排印指南', cover: '', duration: 90, pubtime: 123 },
        { id: 2, bvid: 'BVseasonB', title: '动效曲线解析', cover: '', duration: 60, pubtime: 124 },
      ] } };
    }
    if (u.pathname.includes('/x/space/bangumi/follow/list')) {
      const type = u.searchParams.get('type');
      const status = Number(u.searchParams.get('follow_status') || 0);
      const all = type === '2'
        ? [
          { season_id: 5101, title: '航拍中国 第四季', cover: 'https://i0.hdslb.com/bfs/bangumi/cinema-1.jpg', badge: '纪录片', progress: '看到第3集 22:10', new_ep: { index_show: '全11集' }, url: 'https://www.bilibili.com/bangumi/play/ss5101', follow_status: 2 },
          { season_id: 5102, title: '人生一串 第三季', cover: 'https://i0.hdslb.com/bfs/bangumi/cinema-2.jpg', badge: '出品', progress: '已看完', new_ep: { index_show: '全6集' }, url: 'https://www.bilibili.com/bangumi/play/ss5102', follow_status: 3 },
        ]
        : [
          { season_id: 4101, title: '葬送的芙莉莲', cover: 'https://i0.hdslb.com/bfs/bangumi/frieren.jpg', badge: '独家', progress: '看到第14话 12:30', new_ep: { index_show: '全28话' }, url: 'https://www.bilibili.com/bangumi/play/ss4101', follow_status: 2 },
          { season_id: 4102, title: '迷宫饭', cover: 'https://i0.hdslb.com/bfs/bangumi/dungeon.jpg', badge: '会员专享', progress: '', new_ep: { index_show: '全24话' }, url: 'https://www.bilibili.com/bangumi/play/ss4102', follow_status: 1 },
          { season_id: 4103, title: '孤独摇滚！', cover: 'https://i0.hdslb.com/bfs/bangumi/bocchi.jpg', badge: '独家', progress: '已看完第12话', new_ep: { index_show: '全12话' }, url: 'https://www.bilibili.com/bangumi/play/ss4103', follow_status: 3 },
        ];
      const list = status ? all.filter((item) => item.follow_status === status) : all;
      return { code: 0, data: { list, total: list.length } };
    }
  });
  const sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker');
  const set = (patch) => sw.evaluate(async (p) => {
    const k = 'margin:settings', cur = (await chrome.storage.local.get(k))[k] || {};
    await chrome.storage.local.set({ [k]: { ...cur, ...p } });
  }, patch);

  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));

  // 1. #237 follow-up A (settings gear glass rim) + #219 (header capsule endcap concentricity)
  await set({ intro: false, weather: false, footprint: false, bg: { mode: 'off' }, theme: 'dark', glass: 'soft', favDirect: false, favColumns: 4, batchNav: false });
  await page.goto('https://www.bilibili.com/');
  await page.locator('#margin-root .top .hd-settings').waitFor();

  for (const theme of ['dark', 'light']) {
    await set({ theme, glass: 'soft' });
    await page.locator(`#margin-root .app[data-theme="${theme}"]`).waitFor();
    await page.waitForTimeout(500);
    await page.screenshot({ path: join(out, `header-${theme}.png`), clip: { x: 640, y: 0, width: 780, height: 76 } });
    const headerAudit = await page.evaluate(() => {
      const root = document.getElementById('margin-root').shadowRoot;
      const et = root.querySelector('.top .et');
      const gear = root.querySelector('.top .hd-settings');
      const etCss = getComputedStyle(et);
      const gearCss = getComputedStyle(gear);
      const buttons = [...et.querySelectorAll('.et-btn')].filter((b) => !b.hidden);
      const er = et.getBoundingClientRect(), first = buttons[0].getBoundingClientRect(), last = buttons[buttons.length - 1].getBoundingClientRect();
      return {
        gearMaterial: gear.dataset.material,
        gearBorder: gearCss.borderTopWidth,
        gearBg: gearCss.backgroundColor,
        etBg: etCss.backgroundColor,
        gearShadow: gearCss.boxShadow,
        etShadow: etCss.boxShadow,
        gearSquare: Math.abs(gear.getBoundingClientRect().width - gear.getBoundingClientRect().height) < 0.5,
        gaps: {
          top: +(first.top - er.top).toFixed(2),
          bottom: +(er.bottom - first.bottom).toFixed(2),
          left: +(first.left - er.left).toFixed(2),
          right: +(er.right - last.right).toFixed(2),
        },
      };
    });
    assert.equal(headerAudit.gearMaterial, 'lens', `${theme}: settings button should use header lens material`);
    assert.equal(headerAudit.gearBorder, '0px', `${theme}: settings button should not keep matte border`);
    assert.equal(headerAudit.gearBg, headerAudit.etBg, `${theme}: settings button fill matches nav pill`);
    assert.equal(headerAudit.gearShadow, headerAudit.etShadow, `${theme}: settings button rim highlight matches nav pill`);
    assert.equal(headerAudit.gearSquare, true, `${theme}: settings button remains circular`);
    assert(Math.abs(headerAudit.gaps.left - headerAudit.gaps.top) < 1, `${theme}: left endcap not concentric ${JSON.stringify(headerAudit.gaps)}`);
    assert(Math.abs(headerAudit.gaps.right - headerAudit.gaps.top) < 1, `${theme}: right endcap not concentric ${JSON.stringify(headerAudit.gaps)}`);
    assert(Math.abs(headerAudit.gaps.top - headerAudit.gaps.bottom) < 1, `${theme}: vertical endcap not centered ${JSON.stringify(headerAudit.gaps)}`);
  }
  results.push('#237-A & #219: settings gear matches glass rim highlight and nav pill endcaps are concentric in light & dark');

  // 2. #237 follow-up B (sticky bar 上一批 & 排行榜 glass backdrop)
  await set({ theme: 'dark', glass: 'soft' });
  await page.locator('#margin-root .app[data-theme="dark"]').waitFor();
  await page.locator('#margin-root .card:not(.sk)').first().waitFor();
  await page.locator('#margin-root .bar .refresh:not(.back)').click();
  await page.locator('#margin-root .bar .refresh.back:not([hidden])').waitFor();
  await page.locator('#margin-root .app').evaluate((app) => { app.scrollTop = 600; });
  await page.locator('#margin-root .bar.stuck').waitFor();
  await page.waitForTimeout(200);
  await page.screenshot({ path: join(out, 'sticky-back-btn.png'), clip: { x: 960, y: 68, width: 450, height: 76 } });
  const sticky = await page.evaluate(() => {
    const root = document.getElementById('margin-root').shadowRoot;
    const pick = (sel) => {
      const el = root.querySelector(sel); const css = getComputedStyle(el);
      return { bg: css.backgroundColor, filter: css.backdropFilter, shadow: css.boxShadow, h: Math.round(el.getBoundingClientRect().height) };
    };
    return { refresh: pick('.bar .refresh:not(.back)'), back: pick('.bar .refresh.back') };
  });
  assert.notEqual(sticky.back.filter, 'none', 'sticky back button lost backdrop-filter');
  assert.equal(sticky.back.filter, sticky.refresh.filter, 'sticky back button backdrop-filter must match refresh button');
  assert.equal(sticky.back.bg, sticky.refresh.bg, 'sticky back button fill must match refresh button');
  assert.equal(sticky.back.h, sticky.refresh.h, 'sticky back button height must match refresh button');
  await page.locator('#margin-root .tab[data-tab="popular"]').click();
  await page.waitForTimeout(200);
  const rankFilter = await page.evaluate(() => getComputedStyle(document.getElementById('margin-root').shadowRoot.querySelector('.bar .rank-link')).backdropFilter);
  assert.notEqual(rankFilter, 'none', 'sticky rank-link button should also keep glass backdrop');
  results.push('#237-B: sticky back and rank buttons share glass backdrop with refresh');

  // 3. #263 (4-column folder card text scaling, non-squash on open/hover, readable menu, aligned new-folder card)
  await set({ theme: 'dark', glass: 'soft', favDirect: false, favColumns: 4 });
  await page.evaluate(() => dispatchEvent(new Event('margin:open-fav', { cancelable: true })));
  const favDialog = page.getByRole('dialog', { name: '收藏夹', exact: true });
  await favDialog.locator('.gf-root[data-entered]').first().waitFor();
  await page.waitForTimeout(400);
  const firstFolder = favDialog.locator('.gf-root').first();
  const idleMetrics = await firstFolder.evaluate((card) => {
    const shelf = card.closest('.shelf');
    const title = card.querySelector('.gf-title'), meta = card.querySelector('.gf-meta');
    const stage = card.querySelector('.gf-stage'), newTile = shelf.querySelector('.fav-new');
    const k = parseFloat(card.style.getPropertyValue('--gf-k'));
    return {
      k,
      titleFs: parseFloat(getComputedStyle(title).fontSize) * k,
      metaFs: parseFloat(getComputedStyle(meta).fontSize) * k,
      titleH: title.getBoundingClientRect().height,
      metaH: meta.getBoundingClientRect().height,
      stageH: stage.getBoundingClientRect().height,
      newH: newTile.getBoundingClientRect().height,
      fits: title.scrollWidth <= title.clientWidth + 1 && title.scrollHeight <= title.clientHeight + 1,
    };
  });
  assert(idleMetrics.titleFs >= 11, `4-col title visual font size too small: ${idleMetrics.titleFs}`);
  assert(idleMetrics.metaFs >= 9.4, `4-col meta visual font size too small: ${idleMetrics.metaFs}`);
  assert(idleMetrics.fits, '4-col title clipped');
  assert(Math.abs(idleMetrics.newH - idleMetrics.stageH) < 4, `fav-new height ${idleMetrics.newH} mismatches folder body ${idleMetrics.stageH}`);
  await favDialog.screenshot({ path: join(out, 'fav-4col-dark.png') });

  // Open folder + menu: label must not vertically squash; menu stays readable and in bounds
  await firstFolder.locator('.gf-hit').click();
  await firstFolder.locator('.gf-key').click();
  await page.waitForTimeout(500);
  await firstFolder.screenshot({ path: join(out, 'fav-4col-menu.png') });
  const openMetrics = await firstFolder.evaluate((card) => {
    const title = card.querySelector('.gf-title'), meta = card.querySelector('.gf-meta');
    const menu = card.querySelector('.gf-menu'), item = card.querySelector('.gf-menu-item');
    const mr = menu.getBoundingClientRect(), cr = card.getBoundingClientRect();
    const scale = mr.width / menu.offsetWidth;
    return {
      titleH: title.getBoundingClientRect().height,
      metaH: meta.getBoundingClientRect().height,
      menuW: mr.width,
      cardW: cr.width,
      menuInLeftBounds: mr.left >= cr.left - 2,
      itemVisualFs: parseFloat(getComputedStyle(item).fontSize) * scale,
    };
  });
  assert(Math.abs(openMetrics.titleH - idleMetrics.titleH) < 2, `title vertically squashed on open: idle=${idleMetrics.titleH} open=${openMetrics.titleH}`);
  assert(Math.abs(openMetrics.metaH - idleMetrics.metaH) < 2, `meta vertically squashed on open: idle=${idleMetrics.metaH} open=${openMetrics.metaH}`);
  assert(openMetrics.itemVisualFs >= 10.5 && openMetrics.itemVisualFs <= 14, `menu item visual size out of range: ${openMetrics.itemVisualFs}`);
  assert(openMetrics.menuW <= openMetrics.cardW * 0.8, `menu overly wide for 4-col card: ${JSON.stringify(openMetrics)}`);
  assert(openMetrics.menuInLeftBounds, `menu clipped past card left edge: ${JSON.stringify(openMetrics)}`);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  results.push('#263: 4-col folder card text stays readable, un-squashed on open, menu stays crisp, and fav-new aligns');

  // 4. #261 (favorites drawer search + other-fav link + space fav search + non-create ftype passthrough)
  const otherLink = favDialog.locator('.fav-other-link');
  assert.equal(await otherLink.isVisible(), true);
  assert.match(await otherLink.getAttribute('href'), /space\.bilibili\.com\/1\/favlist\?ftype=opus&margin=off$/);
  const firstVideoTitle = await favDialog.locator('.fav-grid .card .title').first().textContent();
  const token = firstVideoTitle.trim().slice(0, 4);
  const search = favDialog.getByRole('searchbox', { name: '搜索收藏夹内视频' });
  await search.fill(token);
  await search.press('Enter');
  await page.waitForFunction(() => document.getElementById('margin-root').shadowRoot.querySelectorAll('.fav-grid .card:not(.sk)').length >= 1);
  assert(favRequests.some((r) => r.keyword === token && r.type === '0'), 'favorites search must pass keyword to /fav/resource/list');
  // Toggle scope to 全部收藏夹 (type=1)
  const scopeBtn = favDialog.locator('.fav-search-scope');
  await scopeBtn.waitFor();
  assert.equal(await scopeBtn.textContent(), '当前');
  await scopeBtn.click();
  assert.equal(await scopeBtn.textContent(), '全部');
  await page.waitForTimeout(200);
  assert(favRequests.some((r) => r.keyword === token && r.type === '1'), 'all-favorites scope must pass type=1');
  await scopeBtn.click();
  assert.equal(await scopeBtn.textContent(), '当前');
  await search.fill('绝对搜不到的关键词XYZ');
  await search.press('Enter');
  await favDialog.getByText('没有找到「绝对搜不到的关键词XYZ」相关视频').waitFor();
  await search.press('Escape');
  assert.equal(await search.inputValue(), '');
  assert.equal(await favDialog.isVisible(), true, 'Escape with query clears search instead of closing drawer');
  await page.waitForFunction(() => document.getElementById('margin-root').shadowRoot.querySelectorAll('.fav-grid .card:not(.sk)').length === 8);

  // Subscribed season local search
  await favDialog.getByRole('radio', { name: '订阅内容', exact: true }).click();
  await favDialog.locator('.fav-grid .card').filter({ hasText: '字体排印指南' }).waitFor();
  await search.fill('动效');
  await search.press('Enter');
  await page.waitForFunction(() => {
    const cards = [...document.getElementById('margin-root').shadowRoot.querySelectorAll('.fav-grid .card:not(.sk)')];
    return cards.length === 1 && cards[0].textContent.includes('动效曲线解析');
  });

  // 4a. Favorites drawer: 追番 / 追剧 tabs + status filtering + contextual native link + dark/light screenshots
  for (const theme of ['dark', 'light']) {
    await set({ theme, glass: 'soft' });
    await page.locator(`#margin-root .app[data-theme="${theme}"]`).waitFor();
    await favDialog.getByRole('radio', { name: '追番', exact: true }).click();
    await favDialog.locator('.pgc-card').filter({ hasText: '葬送的芙莉莲' }).waitFor();
    assert.equal(await favDialog.locator('.pgc-card').count(), 3, `${theme}: expected 3 bangumi cards`);
    assert.match(await otherLink.getAttribute('href'), /space\.bilibili\.com\/1\/bangumi\?margin=off$/);
    assert.equal(await otherLink.getAttribute('rel'), 'noopener', 'same-site otherLink must not carry noreferrer');
    await page.waitForTimeout(250);
    await favDialog.screenshot({ path: join(out, `fav-bangumi-${theme}.png`) });
  }
  await set({ theme: 'dark', glass: 'soft' });
  await favDialog.locator('.pgc-filter', { hasText: '在看' }).click();
  await page.waitForFunction(() => {
    const cards = [...document.getElementById('margin-root').shadowRoot.querySelectorAll('.pgc-card:not(.sk)')];
    return cards.length === 1 && cards[0].textContent.includes('葬送的芙莉莲');
  });
  await favDialog.getByRole('radio', { name: '追剧', exact: true }).click();
  await favDialog.locator('.pgc-card').filter({ hasText: '航拍中国 第四季' }).waitFor();
  assert.equal(await favDialog.locator('.pgc-card').count(), 2, 'expected 2 cinema cards');
  assert.match(await otherLink.getAttribute('href'), /space\.bilibili\.com\/1\/cinema\?margin=off$/);
  // Switch back to 我的收藏: shelf & folder grid restore cleanly
  await favDialog.getByRole('radio', { name: '我的收藏', exact: true }).click();
  await favDialog.locator('.gf-root').first().waitFor();
  assert.equal(await favDialog.locator('.shelf').isVisible(), true, 'folder shelf should reappear after leaving 追番/追剧');
  results.push('favorites drawer 追番/追剧: 4-tab layout, poster cards, status filters, contextual links & clean tab switching verified');

  // Own space 追番／追剧 link opens 映间 favorites drawer directly on 追番 tab
  await page.goto('https://space.bilibili.com/1');
  await page.locator('#margin-root .sp-acts-self').waitFor();
  const spaceBangumiBtn = page.locator('#margin-root .sp-native-following', { hasText: '追番／追剧' });
  await spaceBangumiBtn.waitFor();
  await spaceBangumiBtn.click();
  await favDialog.locator('.pgc-card').filter({ hasText: '葬送的芙莉莲' }).waitFor();
  assert.equal(await favDialog.getByRole('radio', { name: '追番', exact: true }).getAttribute('aria-checked'), 'true');
  assert.match(page.url(), /space\.bilibili\.com\/1\/?$/, 'own space 追番／追剧 should open drawer in-place without leaving space');
  await page.keyboard.press('Escape');
  results.push('own space 追番／追剧: opens favorites drawer directly on 追番 tab');

  // Space own favlist: other-fav link + root all-favorites search + folder search + ftype passthrough
  await page.goto('https://space.bilibili.com/1/favlist');
  const spaceOther = page.locator('#margin-root .sp-tools .fav-other-link');
  await spaceOther.waitFor();
  assert.match(await spaceOther.getAttribute('href'), /space\.bilibili\.com\/1\/favlist\?ftype=opus&margin=off$/);
  const spaceRootSearch = page.getByRole('searchbox', { name: '搜索全部收藏夹' });
  await spaceRootSearch.waitFor();
  await spaceRootSearch.fill(token);
  await spaceRootSearch.press('Enter');
  await page.locator('#margin-root .sp-collection-head').filter({ hasText: `全部收藏夹 · 搜索「${token}」` }).waitFor();
  assert(favRequests.some((r) => r.keyword === token && r.type === '1'), 'space root search queries all favorites (type=1)');
  await page.locator('#margin-root .sp-collection-head button').click();
  await page.locator('#margin-root .sp-favorite-folder .cover').first().click();
  const spaceSearch = page.getByRole('searchbox', { name: '搜索收藏夹内视频' });
  await spaceSearch.waitFor();
  await spaceSearch.fill(token);
  await spaceSearch.press('Enter');
  await page.waitForTimeout(300);
  assert(favRequests.filter((r) => r.keyword === token && r.type === '0').length >= 2, 'space folder search passes keyword');
  for (const ftype of ['opus', 'topic', 'pugv']) {
    await page.goto(`https://space.bilibili.com/1/favlist?ftype=${ftype}`);
    await page.locator('#margin-watch-top').waitFor();
    assert.equal(await page.locator('#margin-root .sp-bar').count(), 0, `ftype=${ftype} should pass through to native favlist`);
  }
  results.push('#261: favorites drawer/space all-folder & in-folder search, season filtering, other-fav links and ftype passthrough work');

  // 4b. Charging-exclusive dynamics must show explicit notice card (never blank) on t.bilibili.com & space dynamic tab
  for (const theme of ['dark', 'light']) {
    await set({ theme, glass: 'soft' });
    await page.goto('https://t.bilibili.com/');
    await page.locator(`#margin-root .app[data-theme="${theme}"] .dy-blocked.is-charging`).first().waitFor();
    const blockedCount = await page.locator('#margin-root .dy-blocked.is-charging').count();
    assert(blockedCount >= 2, `${theme}: expected both blocked and is_only_fans charging dynamics to render notice cards, got ${blockedCount}`);
    const firstCard = page.locator('#margin-root article.dy').first();
    const cardText = (await firstCard.textContent()) ?? '';
    assert(cardText.includes('充电专属') && cardText.includes('仅充电用户可见'), `${theme}: missing charging notice text: ${cardText}`);
    await page.locator('#margin-root .fd-list').screenshot({ path: join(out, `charging-dyn-${theme}.png`) });
  }
  await page.goto('https://space.bilibili.com/346563107/dynamic');
  await page.locator('#margin-root .dy-blocked.is-charging').first().waitFor();
  assert(await page.locator('#margin-root .dy-blocked.is-charging').count() >= 2, 'space dynamic tab should render charging notice cards');
  results.push('charging dynamics: MAJOR_TYPE_BLOCKED and empty is_only_fans render clear charging cards on feed & space');

  // 4c. Same-site rel="noopener" (no noreferrer) audit on homepage & dynamics; external links keep noreferrer
  for (const url of ['https://www.bilibili.com/', 'https://t.bilibili.com/']) {
    await page.goto(url);
    await page.locator(url.includes('t.bilibili') ? '#margin-root article.dy' : '#margin-root .card:not(.sk)').first().waitFor();
    const relAudit = await page.evaluate(() => {
      const root = document.getElementById('margin-root').shadowRoot;
      const biliBad = [];
      let biliChecked = 0;
      for (const a of root.querySelectorAll('a[href]')) {
        try {
          const u = new URL(a.href, location.href);
          const isBili = u.hostname === 'bilibili.com' || u.hostname.endsWith('.bilibili.com');
          const rel = (a.getAttribute('rel') || '').split(/\s+/).filter(Boolean);
          if (isBili) {
            biliChecked++;
            if (rel.includes('noreferrer') || !rel.includes('noopener')) biliBad.push({ href: a.href, rel: a.getAttribute('rel') });
          }
        } catch {}
      }
      return { biliChecked, biliBad };
    });
    assert(relAudit.biliChecked >= 5, `${url}: expected at least 5 same-site links, saw ${relAudit.biliChecked}`);
    assert.deepEqual(relAudit.biliBad, [], `${url}: same-site Bilibili links must use rel="noopener" without noreferrer`);
  }
  await page.locator('#margin-root .top .hd-settings').click();
  await page.locator('#margin-root a[href*="github.com"]').first().waitFor();
  const extRel = await page.locator('#margin-root a[href*="github.com"]').first().getAttribute('rel');
  assert(extRel?.includes('noopener') && extRel?.includes('noreferrer'), `external link should retain noopener noreferrer, got: ${extRel}`);
  await page.keyboard.press('Escape');
  results.push('autoplay fix: same-site *.bilibili.com links omit noreferrer while external links keep noopener noreferrer');

  // 4d. 375px narrow viewport check: favorites drawer (including 追番 4-tab bar) & space favlist have zero horizontal overflow
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('https://www.bilibili.com/');
  await page.locator('#margin-root .top .hd-settings').waitFor();
  await page.evaluate(() => dispatchEvent(new Event('margin:open-fav', { cancelable: true })));
  await favDialog.locator('.fav-search').waitFor();
  const mobileFavOverflow = await favDialog.evaluate((sheet) => sheet.scrollWidth - sheet.clientWidth);
  assert(mobileFavOverflow <= 1, `favorites drawer overflows horizontally at 375px by ${mobileFavOverflow}px`);
  await favDialog.getByRole('radio', { name: '追番', exact: true }).click();
  await favDialog.locator('.pgc-card').filter({ hasText: '葬送的芙莉莲' }).waitFor();
  const mobilePgcOverflow = await favDialog.evaluate((sheet) => sheet.scrollWidth - sheet.clientWidth);
  assert(mobilePgcOverflow <= 1, `favorites drawer 追番 tab overflows horizontally at 375px by ${mobilePgcOverflow}px`);
  await favDialog.screenshot({ path: join(out, 'fav-bangumi-375.png') });
  await page.goto('https://space.bilibili.com/1/favlist');
  await page.locator('#margin-root .sp-tools .fav-other-link').waitFor();
  const mobileSpaceOverflow = await page.evaluate(() => {
    const tools = document.getElementById('margin-root').shadowRoot.querySelector('.sp-tools');
    return tools.scrollWidth - tools.clientWidth;
  });
  assert(mobileSpaceOverflow <= 1, `space favlist toolbar overflows horizontally at 375px by ${mobileSpaceOverflow}px`);
  await page.goto('https://space.bilibili.com/346563107/dynamic');
  await page.locator('#margin-root .dy-blocked.is-charging').first().waitFor();
  const mobileDynOverflow = await page.evaluate(() => {
    const card = document.getElementById('margin-root').shadowRoot.querySelector('.dy-blocked.is-charging');
    return card.scrollWidth - card.clientWidth;
  });
  assert(mobileDynOverflow <= 1, `charging dynamic card overflows horizontally at 375px by ${mobileDynOverflow}px`);
  results.push('375px mobile: zero horizontal overflow in favorites drawer, space favlist toolbar and charging dynamic card');

  // 5. Firefox 1.2x DPR check for #263
  const bundle = await build({ configFile: false, publicDir: false, logLevel: 'error', build: {
    write: false, lib: { entry: resolve('src/content/ui/glass-folder.ts'), name: 'folders', formats: ['iife'] },
  } });
  const css = ['01-base', '03-cards', '04-glass-folder', '08-home-search', '09-appearance'].map((n) => readFileSync(`src/content/styles/${n}.css`, 'utf8')).join('\n');
  const ff = await firefox.launch({ headless: true });
  try {
    const ffCtx = await ff.newContext({ viewport: { width: 820, height: 600 }, deviceScaleFactor: 1.2, reducedMotion: 'reduce' });
    const ffPage = await ffCtx.newPage();
    ffPage.on('pageerror', (e) => errors.push('firefox: ' + e.message));
    await ffPage.setContent('<!doctype html><meta charset="UTF-8"><div id="host"></div>');
    await ffPage.addScriptTag({ content: (Array.isArray(bundle) ? bundle[0] : bundle).output.find((x) => x.type === 'chunk').code });
    const ffCheck = await ffPage.evaluate((css) => {
      const tree = document.getElementById('host').attachShadow({ mode: 'open' });
      const style = document.createElement('style'); style.textContent = css;
      const app = document.createElement('main'); app.className = 'app'; app.dataset.glass = 'soft'; app.dataset.theme = 'dark';
      const shelf = document.createElement('div'); shelf.className = 'shelf'; shelf.style.width = '760px'; shelf.style.setProperty('--fav-cols', '4');
      const gf = folders.glassFolder({
        label: 'main', meta: '15 个视频', width: 236,
        files: [
          { name: '完爆Astra，它美得像一件艺术品', meta: '10:25', href: '#' },
          { name: '1500 个实体不掉帧？我重写了 Mine...', meta: '2:04', href: '#' },
        ],
        menu: [{ label: '查看全部视频' }, { label: '在 B 站打开' }, { label: '删除收藏夹', danger: true }],
      });
      shelf.append(gf.el); app.append(shelf); tree.append(style, app);
      return new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(() => {
        const beforeH = gf.el.querySelector('.gf-title').getBoundingClientRect().height;
        const beforeMetaH = gf.el.querySelector('.gf-meta').getBoundingClientRect().height;
        gf.setOpen(true);
        gf.el.querySelector('.gf-key').click();
        requestAnimationFrame(() => {
          const afterH = gf.el.querySelector('.gf-title').getBoundingClientRect().height;
          const afterMetaH = gf.el.querySelector('.gf-meta').getBoundingClientRect().height;
          const k = parseFloat(gf.el.style.getPropertyValue('--gf-k'));
          const menu = gf.el.querySelector('.gf-menu');
          const mr = menu.getBoundingClientRect();
          const cr = gf.el.getBoundingClientRect();
          res({
            k,
            titleFs: parseFloat(getComputedStyle(gf.el.querySelector('.gf-title')).fontSize) * k,
            metaFs: parseFloat(getComputedStyle(gf.el.querySelector('.gf-meta')).fontSize) * k,
            beforeH, afterH, beforeMetaH, afterMetaH,
            menuOpen: menu.hasAttribute('data-open'),
            menuW: mr.width,
            cardW: cr.width,
            menuItemFs: parseFloat(getComputedStyle(gf.el.querySelector('.gf-menu-item')).fontSize) * (mr.width / menu.offsetWidth),
          });
        });
      })));
    }, css);
    await ffPage.locator('.gf-root').screenshot({ path: join(out, 'firefox-4col-fixed.png') });
    assert(ffCheck.titleFs >= 11 && ffCheck.metaFs >= 9.4, `Firefox 4-col text too small: ${JSON.stringify(ffCheck)}`);
    assert(Math.abs(ffCheck.afterH - ffCheck.beforeH) < 2 && Math.abs(ffCheck.afterMetaH - ffCheck.beforeMetaH) < 2, `Firefox label squashed: ${JSON.stringify(ffCheck)}`);
    assert(ffCheck.menuOpen && ffCheck.menuItemFs >= 10.5 && ffCheck.menuW <= ffCheck.cardW * 0.8, `Firefox menu out of bounds/range: ${JSON.stringify(ffCheck)}`);
    results.push('#263 Firefox 1.2x DPR: 4-col folder text & menu verified');
  } finally { await ff.close(); }

  assert.deepEqual(errors, []);
  results.forEach((r) => console.log('PASS ' + r));
} finally {
  writeFileSync(join(out, 'results.json'), JSON.stringify({ results, errors }, null, 2));
  await ctx.close();
}

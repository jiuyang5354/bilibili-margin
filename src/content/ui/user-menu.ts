import { account, accountStat, logout, type Account } from '../api/account';
import { fmtCount, h, icon, ICONS } from './dom';

/**
 * 头像悬停卡片：21st「User Profile Dropdown Menu」（shadcnspace）的原生移植——
 * 头像 + 名字 + 状态在上，分组链接居中，退出登录单独一组放最后。
 * 补上 B 站原版头像卡片里的等级进度、关注/粉丝/动态、硬币和 B 币。
 */
export function createUserMenu(a: Account): HTMLElement {
  const face = (px: number) => `${a.face}@${px}w_${px}h_1c.webp`;
  const trigger = h('a', { class: 'user in', href: `https://space.bilibili.com/${a.mid}`, target: '_blank', rel: 'noopener', 'aria-haspopup': 'menu', 'aria-label': a.name },
    h('img', { src: face(80), alt: '', referrerpolicy: 'no-referrer' }));
  const panel = h('div', { class: 'um', role: 'menu', 'aria-label': '账号' });
  const wrap = h('div', { class: 'um-wrap' }, trigger, panel);

  const link = (label: string, ic: string, href: string) => h('a', { class: 'um-item', role: 'menuitem', href, target: '_blank', rel: 'noopener' }, icon(ic), h('span', {}, label));
  const stat = (n: string, label: string, href: string) => h('a', { class: 'um-stat', href, target: '_blank', rel: 'noopener' }, h('b', {}, n), h('span', {}, label));
  const stats = h('div', { class: 'um-stats' }, stat('–', '关注', `https://space.bilibili.com/${a.mid}/relation/follow`), stat('–', '粉丝', `https://space.bilibili.com/${a.mid}/relation/fans`), stat('–', '动态', `https://space.bilibili.com/${a.mid}/dynamic`));
  const pct = a.next > 0 ? Math.min(100, (a.exp / a.next) * 100) : 100;
  const name = h('span', { class: 'um-name' }, a.name);
  if (a.vip && a.vipColor) name.style.color = a.vipColor;
  const out = h('button', { class: 'um-item danger', role: 'menuitem', type: 'button' }, icon(ICONS.exit), h('span', {}, '退出登录'));
  out.addEventListener('click', async () => {
    if (!confirm('退出当前 B 站账号？')) return;
    out.setAttribute('aria-disabled', 'true');
    if (await logout()) location.reload(); else out.removeAttribute('aria-disabled');
  });

  panel.append(
    h('div', { class: 'um-head' },
      h('img', { src: face(96), alt: '', referrerpolicy: 'no-referrer' }),
      h('div', { class: 'um-id' }, name,
        h('div', { class: 'um-tags' },
          h('span', { class: `um-lv lv${a.level}` }, `LV${a.level}`),
          a.vipLabel ? h('span', { class: 'um-vip' }, a.vipLabel) : null))),
    h('div', { class: 'um-exp', title: a.next > 0 ? `经验 ${a.exp} / ${a.next}` : '已满级' },
      h('div', { class: 'um-bar' }, h('i', { style: `width:${pct}%` })),
      h('span', {}, a.next > 0 ? `${a.exp} / ${a.next}` : '满级')),
    stats,
    h('div', { class: 'um-wallet' },
      h('span', {}, '硬币 ', h('b', {}, String(a.coins))),
      h('span', {}, 'B 币 ', h('b', {}, String(a.bcoin)))),
    h('div', { class: 'um-sep' }),
    link('个人空间', ICONS.user, `https://space.bilibili.com/${a.mid}`),
    link('投稿管理', ICONS.upload, 'https://member.bilibili.com/platform/upload-manager/article'),
    link('大会员', ICONS.vip, 'https://account.bilibili.com/big'),
    link('我的钱包', ICONS.wallet, 'https://pay.bilibili.com/'),
    link('账号设置', ICONS.gear, 'https://account.bilibili.com/account/home'),
    h('div', { class: 'um-sep' }),
    out,
  );

  let loaded = false, t = 0;
  const open = (on: boolean) => {
    clearTimeout(t);
    t = window.setTimeout(() => {
      wrap.toggleAttribute('data-open', on);
      if (on && !loaded) {
        loaded = true;
        accountStat().then((s) => {
          const b = stats.querySelectorAll('b');
          [s.following, s.follower, s.dynamic].forEach((n, i) => { b[i].textContent = fmtCount(n); });
        }).catch(() => { loaded = false; });
      }
    }, on ? 120 : 220);
  };
  wrap.addEventListener('pointerenter', (e) => { if ((e as PointerEvent).pointerType !== 'touch') open(true); });
  wrap.addEventListener('pointerleave', () => open(false));
  wrap.addEventListener('focusin', () => open(true));
  wrap.addEventListener('focusout', (e) => { if (!wrap.contains((e as FocusEvent).relatedTarget as Node)) open(false); });
  wrap.addEventListener('keydown', (e) => { if (e.key === 'Escape') { wrap.removeAttribute('data-open'); trigger.focus(); } });
  return wrap;
}

export { account };

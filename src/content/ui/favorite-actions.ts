import { removeFolderVideo, transferFolderVideo, type Folder } from '../api/fav';
import type { Video } from '../api/feed';
import { h, icon, ICONS } from './dom';

let pickerId = 0;

function openFolderPicker(trigger: HTMLButtonElement, form: HTMLFormElement, folders: Folder[], select: (folder: Folder) => void, onClose: () => void): (() => void) | undefined {
  const app = trigger.closest('.app');
  if (!app) return;
  const id = `fav-select-${++pickerId}`;
  const hl = h('span', { class: 'fav-select-hl', 'aria-hidden': 'true' });
  const options = folders.map((folder, i) => h('div', {
    id: `${id}-${i}`, class: 'fav-select-opt', role: 'option', 'data-value': folder.id,
    'aria-selected': String(trigger.dataset.value === String(folder.id)),
  }, h('span', { class: 'fav-select-title' }, folder.title),
  folder.count == null ? null : h('span', { class: 'fav-select-count' }, String(folder.count)), icon(ICONS.check)));
  const menu = h('div', { id, class: 'fav-select-menu', role: 'listbox', 'aria-label': '目标收藏夹' }, hl, ...options);
  const listeners = new AbortController();
  const { signal } = listeners;
  const close = () => {
    listeners.abort();
    observer.disconnect();
    menu.remove();
    trigger.setAttribute('aria-expanded', 'false');
    trigger.removeAttribute('aria-controls');
    trigger.removeAttribute('aria-activedescendant');
    onClose();
  };
  const observer = new MutationObserver(() => { if (!form.isConnected) close(); });
  observer.observe(app.getRootNode(), { childList: true, subtree: true });
  observer.observe(document, { childList: true, subtree: true });

  app.append(menu);
  const rect = trigger.getBoundingClientRect();
  const viewportWidth = document.documentElement.clientWidth;
  const gap = 6, inset = 8;
  const width = Math.min(Math.max(rect.width, 196), viewportWidth - 2 * inset);
  menu.style.width = `${width}px`;
  menu.style.left = `${Math.max(inset, Math.min(rect.left, viewportWidth - inset - width))}px`;
  const below = innerHeight - rect.bottom;
  const above = below < Math.min(248, menu.offsetHeight + 12);
  menu.style.maxHeight = `${Math.min(240, Math.max(0, (above ? rect.top : below) - gap - inset))}px`;
  menu.style.top = `${above ? rect.top - menu.offsetHeight - gap : rect.bottom + gap}px`;
  trigger.setAttribute('aria-controls', id);
  trigger.setAttribute('aria-expanded', 'true');
  trigger.focus({ preventScroll: true });

  let active = Math.max(0, options.findIndex(option => option.getAttribute('aria-selected') === 'true'));
  const highlight = (i: number, reveal = false) => {
    active = i;
    const option = options[i];
    trigger.setAttribute('aria-activedescendant', option.id);
    const top = option.offsetTop;
    hl.style.transform = `translateY(${top}px)`;
    hl.style.height = `${option.offsetHeight}px`;
    if (!reveal) return;
    if (top < menu.scrollTop) menu.scrollTop = top;
    else if (top + option.offsetHeight > menu.scrollTop + menu.clientHeight) menu.scrollTop = top + option.offsetHeight - menu.clientHeight;
  };
  highlight(active, true);

  const choose = (i: number) => { select(folders[i]); close(); trigger.focus({ preventScroll: true }); };
  options.forEach((option, i) => {
    option.addEventListener('pointerenter', () => highlight(i));
    option.addEventListener('click', () => choose(i));
  });
  menu.addEventListener('mousedown', e => { if (e.target !== menu) e.preventDefault(); });
  trigger.addEventListener('keydown', e => {
    switch (e.key) {
      case 'ArrowDown': highlight(Math.min(active + 1, options.length - 1), true); break;
      case 'ArrowUp': highlight(Math.max(active - 1, 0), true); break;
      case 'Home': highlight(0, true); break;
      case 'End': highlight(options.length - 1, true); break;
      case ' ': case 'Enter': choose(active); break;
      case 'Escape': close(); trigger.focus({ preventScroll: true }); break;
      default: return;
    }
    e.preventDefault();
    e.stopPropagation();
  }, { signal });
  const outside = (e: Event) => {
    const path = e.composedPath();
    if (!path.includes(trigger) && !path.includes(menu)) close();
  };
  for (const event of ['pointerdown', 'focusin']) document.addEventListener(event, outside, { capture: true, signal });
  app.addEventListener('scroll', e => { if (e.target !== menu) close(); }, { capture: true, signal });
  app.addEventListener('margin:sheet', close, { signal });
  window.addEventListener('scroll', close, { signal });
  window.addEventListener('resize', close, { signal });
  return close;
}

/** 收藏抽屉与个人空间共用原站收藏操作，只在请求成功后通知列表更新。 */
export function favoriteActions(video: Video, folder: Folder, targets: () => Folder[] | Promise<Folder[]>, changed: (action: 'remove' | 'move' | 'copy', target?: Folder) => void): HTMLElement {
  let busy = false;
  let closeMenu: (() => void) | undefined;
  let syncTransfer: (() => void) | undefined;
  const error = h('span', { class: 'fav-video-error', role: 'alert' });
  const remove = h('button', { type: 'button', class: 'fav-video-remove', 'aria-label': `取消收藏：${video.title}` }, icon(ICONS.close), '取消收藏') as HTMLButtonElement;
  const actions = h('div', { class: 'fav-video-actions' }, remove);
  const lock = (value: boolean) => {
    busy = value;
    if (value) closeMenu?.();
    actions.querySelectorAll<HTMLButtonElement>('.fav-video-remove').forEach(el => { el.disabled = value; });
    syncTransfer?.();
  };
  remove.addEventListener('click', async e => {
    e.preventDefault(); e.stopPropagation();
    if (busy || !confirm(`将「${video.title}」从「${folder.title}」中移除？其他收藏夹不受影响。`)) return;
    lock(true); error.textContent = '';
    try {
      await removeFolderVideo(folder.id, video.aid!);
      changed('remove');
    } catch (e) { if (actions.isConnected) error.textContent = `取消失败：${(e as Error).message}`; }
    finally { lock(false); }
  });
  const transfer = async (action: 'move' | 'copy') => {
    if (busy || actions.querySelector('form')) return;
    error.textContent = '';
    const title = h('span', { class: 'fav-select-title' }, '加载收藏夹…');
    const trigger = h('button', {
      type: 'button', class: 'fav-select-trigger', role: 'combobox', 'aria-label': '目标收藏夹',
      'aria-haspopup': 'listbox', 'aria-expanded': 'false', 'data-value': '', disabled: true,
    }, title, icon(ICONS.chevronDown));
    const submit = h('button', { type: 'submit', class: 'fav-transfer-ok', disabled: true }, action === 'move' ? '确认移动' : '确认复制');
    let list: Folder[] = [];
    const select = (target: Folder) => {
      trigger.dataset.value = String(target.id);
      title.textContent = target.title;
    };
    const dismiss = () => {
      closeMenu?.();
      closeMenu = undefined;
      syncTransfer = undefined;
      form.remove();
    };
    const cancel = h('button', { type: 'button', class: 'fav-transfer-cancel', onclick: dismiss }, '取消');
    const form = h('form', { class: 'fav-video-transfer', onsubmit: async (e: Event) => {
      e.preventDefault(); e.stopPropagation();
      if (busy || submit.disabled) return;
      const target = list.find(f => f.id === Number(trigger.dataset.value));
      if (!target) return;
      lock(true); error.textContent = '';
      try {
        await transferFolderVideo(action, folder, target, video.aid!);
        changed(action, target);
        dismiss();
        if (action === 'copy') error.textContent = `已复制到「${target.title}」`;
      } catch (e) { if (actions.isConnected) error.textContent = `${action === 'move' ? '移动' : '复制'}失败：${(e as Error).message}`; }
      finally { lock(false); }
    } }, trigger, submit, cancel);
    syncTransfer = () => {
      trigger.disabled = submit.disabled = busy || !list.length;
      cancel.disabled = busy;
    };
    const open = () => {
      if (trigger.disabled) return;
      closeMenu = openFolderPicker(trigger, form, list, select, () => { closeMenu = undefined; });
    };
    trigger.addEventListener('click', () => {
      if (trigger.getAttribute('aria-expanded') === 'true') closeMenu?.();
      else open();
    });
    trigger.addEventListener('keydown', e => {
      if (trigger.getAttribute('aria-expanded') === 'true' || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp')) return;
      e.preventDefault();
      e.stopPropagation();
      open();
    });
    form.addEventListener('click', e => e.stopPropagation());
    actions.append(form);
    try {
      list = (await targets()).filter(f => !f.kind && f.mid === folder.mid && f.id !== folder.id);
      if (!form.isConnected) return;
      if (list.length) select(list[0]);
      else title.textContent = error.textContent = '没有其他可用的收藏夹';
      syncTransfer?.();
      trigger.focus();
    } catch (e) {
      if (!form.isConnected) return;
      dismiss(); error.textContent = `收藏夹加载失败：${(e as Error).message}`;
    }
  };
  actions.append(...(['move', 'copy'] as const).map(action => h('button', { type: 'button', class: 'fav-video-remove', onclick: (e: Event) => {
    e.preventDefault(); e.stopPropagation(); void transfer(action);
  } }, action === 'move' ? '移动到…' : '复制到…')), error);
  return actions;
}

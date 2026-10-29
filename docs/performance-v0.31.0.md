# 性能记录 · v0.31.0

测量环境：沙箱 2 核 ARM、Chromium 156 headless=new、1440×900、离线伪造的 B 站（tests/mocks.mjs），数值只用于前后对比。

## 1. 按路由拆分代码

| | v0.30.3 | v0.31.0 |
| --- | ---: | ---: |
| `content.js`（document_start 注入每个 B 站页面） | 447,502 B | 33,978 B（−92%） |
| 其中 | 全部页面代码 | 路由判断、设置、字体注册、足迹心跳、原版拦截、播放页换皮 CSS（26 KB，保证不闪原版） |
| 首页实际执行的 JS | 447,502 B | 325,4xx B（入口 + `pages/home.js` 37.6 KB + 共享块 244 KB + 9.5 KB） |
| 播放页实际执行的 JS | 447,502 B | ≈304 KB |
| 不接管的 B 站页面（专题、活动页、关掉映间时） | 447,502 B | 33,978 B |

- 开场引擎（28.7 KB）只在要播开场时加载；ID 卡二维码库（20.6 KB）在卡片挂上时才加载。
- `dist/pages/*.js` 是 ES 模块，入口用 `import(chrome.runtime.getURL('pages/<name>.js'))` 加载（和 flux.js 同一套做法），共享代码由 Rolldown 自动拆成 `pages/chunk-*.js`。

挂载时间（导航开始 → `#margin-root` / `#margin-watch-css` 出现，9 次中位数，`node tests/mount-timing.mjs`）：

| 页面 | v0.30.3 | v0.31.0 |
| --- | ---: | ---: |
| 首页（`#margin-root`） | 162 ms | 259 ms |
| 播放页（换皮 CSS） | 153 ms | 139 ms |
| 历史记录（`#margin-root`） | 131 ms | 237 ms |

接管页（首页 / 历史 / 空间 / 消息 / 动态）在 document_start 就用同色底板藏起原版，所以不会闪原版，但映间内容在这台 2 核沙箱上晚出现约 100 ms：
单是动态 import 一个只有一行的空模块，这里就要 22–90 ms（扩展资源走浏览器进程取回）。在真实桌面机器上这段延迟应该小得多，未在真机上测。
播放页 / 搜索页的换皮 CSS 由入口同步挂上（按上次设置的 localStorage 镜像判断），比之前还早。

## 2. 中文字体按 unicode-range 切片

`scripts/slice-fonts.py` 把 Margin Sans SC / Margin Serif SC 按 Google Fonts 的 Noto Sans SC 分片方案（字频排序的约 100 组）各切成 97 片，
@font-face 表在 `fonts/margin-sc.css`，入口只插一个 `<link>`。

| 首页首次加载 | v0.30.3 | v0.31.0 |
| --- | ---: | ---: |
| 字体请求数 | 7 | 37（含 margin-sc.css） |
| 字体字节 | 3,253,400 B | 1,684,101 B（−48%） |
| 其中中文字体 | 3,068,988 B（两整份） | ≈1.42 MB（只取用到的切片） + 124 KB css |

切片后两款字体总量变大（2.32 MB + 1.67 MB，每片都带一份字形表头和可变字重数据），但浏览器只下载页面上真正出现的字所在的切片。

## 3. 计时器与观察者

- 新增 `src/content/sched.ts`：全页面一个 setTimeout，页面隐藏时暂停所有周期任务，切回可见时过期任务只补跑一次，到期时间相近的任务合并到一次唤醒。
  原来的 6 处 setInterval（足迹心跳、评论区换皮、足迹卡片刷新、顶栏未读轮询、首页搜索热词轮播、天气动画）全部改用它，代码里不再有 setInterval。
- 8 个 MutationObserver 逐个看过：原版脚本拦截（document 子树，必须）、悬浮菜单 / 小电视眼睛 / 播放页全屏状态（都只看一两个属性）、tooltip（只看 title 属性和新增节点）、三连特效（长按后 5 秒内、只看三个按钮）——都已限定范围，没有合并的必要，保持不变。
- 足迹计时搬进后台 service worker（`src/background/sw.ts`）：各标签页活跃时每 15 秒报一段时间区间，SW 串行读改写；
  以 15 秒为一片取并集，两个标签页同时活跃 47 秒只记 45 秒（原来是各页面自己读改写，会互相覆盖）。存储键 `margin:activity` 与 DayRecord 格式不变。

# 映间 MARGIN

一个从零编写的 B 站首页浏览器扩展（Chrome / Edge，Manifest V3）。安静的排版、干净的推荐流。

> 非 B 站官方项目，与哔哩哔哩无关联。所有数据直接来自你当前登录的 B 站账号，不经过任何第三方服务器。

## 功能（v0.5）

- 接管 `www.bilibili.com` 首页，原页面隐藏
- v0.10：搜索页（`search.bilibili.com`）重新设计（大号胶囊搜索框、衬线分类标签、胶囊排序、圆角卡片、去广告），热门 / 排行 / 番剧 / 专栏 / 空间 / 动态等页面换上 MARGIN 顶栏和主题色；Shader 背景铺到播放页和这些页面，跟随首页设置
- 播放页（`/video/BV…`）重设计：换上和首页一致的顶栏（搜索、快捷入口、日月主题、收藏夹、设置），标题衬线排版、播放器圆角卡片、互动胶囊、简介 / 评论 / UP 主卡片化、推荐列表重排、去广告；保留 B 站原生播放器、弹幕、评论和账号操作。改写 B 站主题变量，评论区也跟着换亮 / 暗色。网页全屏时自动收起顶栏。设置或弹窗里可关闭，链接后加 `?margin=off` 或点顶栏「原版」可临时看原版
- 「推荐」：B 站网页端个性推荐流（WBI 签名接口），无限滚动、去重、换一批；「热门」：综合热门榜
- 封面悬停半秒静音播放低清预览，底部细线显示进度
- 推荐过滤：标题关键词（支持 `/正则/`）、屏蔽 UP 主（卡片上一键屏蔽，可撤销）、最低播放量、最短时长
- B 站足迹：首页顶部的近一年热力图，记录每天首次打开时间和停留时长（只存本机），登录后用观看历史补全过去的天数
- 日月主题切换：太阳和月亮沿弧线一落一升，按钮里的天空与星星渐变，整页颜色同步淡入淡出
- 顶栏快捷入口：Expandable Tabs，平时只露图标，点击后弹性展开文字
- 收藏夹抽屉：玻璃文件夹（弯角标签、封面从口袋露出、毛玻璃前板、指针靠近时前倾），点开浏览，无限加载
- 配色：经典（暖白 · 衬线），亮色 / 暗色 / 跟随系统
- 动态背景：5 款原创 WebGL 着色器（极光 / 丝绸 / 网格渐变 / 颗粒 / 冰蓝），每次打开随机或固定一款；也可上传自己的图片；强度可调。半分辨率、约 30fps、标签页隐藏时暂停，尊重「减少动态效果」
- 顶栏搜索（按 `/` 聚焦），动态 / 消息 / 历史快捷入口，登录头像
- 亮色 / 暗色 / 跟随系统主题，切换带过渡；设置面板与扩展弹窗即时同步
- 页脚可「本次回到 B 站原版首页」，弹窗可整体关闭

## 设计参考

交互参考了 21st.dev 上的 Sheet、Segmented Control、Chip Group、Minimal Slider、Glow Button、Glass Button、Toggle Switch、Command Search 等组件的形态，用原生 TypeScript / CSS 重新实现。

阴影（Smooth Shadows 的分层合成与 0.5px 发丝环）和嵌套圆角规则（Perfect Corner Radius）也来自 movements.dev。足迹热力图的玻璃透镜算法移植自 movements.dev「Refractive Glass」（@movements/react-glass，MIT）。个人空间与消息中心的版式参考了 21st.dev 的 Editorial Image Hero、Editorial service list、Activity Timeline、Notification Panel、Conversation List。

收藏夹的玻璃文件夹按 21st.dev「Glass Folder Cards」的公开源码移植（React → 原生 TS，含液态纹理生成算法、扇形展开、··· 菜单与入场组装），并接入 B 站收藏数据：后板是收藏夹封面，口袋里是最近收藏的 4 个视频。

主题按钮按 21st.dev「Sun Moon Theme Toggle」的源码移植（Web Animations 弧线关键帧、中途再点倒放）。

顶栏快捷入口按 21st.dev「Expandable Tabs」的源码移植（framer-motion 弹簧展开 → 原生 CSS 过渡，点外部收起）。

命令面板按 21st.dev「Command Palette」（rafa-porto，Raycast 风格）移植：点顶栏搜索框、按 `/` 或 `Ctrl/⌘ + K` 唤出，有 B 站搜索联想、最近搜索、bilibili 热搜和 MARGIN 命令（换一批、切主题、收藏夹、网页全屏……），↑↓ 选、↵ 执行、Tab 切分类，常用命令按次数排前。

视频卡片右键菜单按 21st.dev「Context Menu」（ddoemonn）移植：新标签打开、稍后再看、复制链接 / BV 号、UP 主空间、不看该 UP；贴边自动翻转，支持键盘和首字母跳转，Shift + 右键是浏览器原生菜单。

「稍后再看」抽屉按 21st.dev「Drawer」（ddoemonn）移植：右侧弹簧滑出、遮罩随位置变化、拖动头部甩出关闭；顶栏「稍后」、命令面板和卡片右键都能打开，可直接移出条目，显示观看进度。

首页背景新增 6 款着色器：丝缎、烟霞、流萤、流沙、天光、弥散，移植自 21st.dev Shader Builder 系列（Silk、Smoke、Neuro Noise、Grain Gradient、God Rays、Mesh Gradient；Mesh Gradient 改编自 Paper Shaders，Apache-2.0），配色按亮暗主题重新调过；设置面板的样式色块改为真实渲染的缩略图。推荐流加载占位按「Skeleton Loader」（animbits）改成 1.5s 流光。播放页右缘的刻度尺滚动进度按「Scroll Bars」（radiumcoders）竖向版移植：滚动时出现，指示条弹簧跟随，悬停显示百分比，点刻度跳转。

播放页底部的快捷菜单按 21st.dev「Floating Menu」移植（胶囊变形成面板、墨色圆从底部漫上来、逐字翻滚悬停），配色换成墨色 / 暖白，菜单字改衬线：回到顶部、看评论、网页全屏、宽屏模式、收藏夹。

顶栏的液态玻璃（搜索框、快捷入口胶囊、选中滑块）按 21st.dev「Apple Liquid glass switcher」（Den Dionigi）移植：多层内阴影高光 + `backdrop-filter: url(#位移滤镜)` 折射背后的内容，选中滑块移动时弹一下。原版位移图是按 344×76 胶囊画的，这里按每块玻璃的实际尺寸用光学公式（squircle 斜面 + 斯涅尔折射）现算，尺寸变化时重算。

## 安装

1. 在 [Releases](../../releases) 下载 `margin.zip` 并解压，或自行构建（见下）
2. 打开 `chrome://extensions`（Edge 为 `edge://extensions`），开启「开发者模式」
3. 点「加载已解压的扩展程序」，选择解压后的文件夹

手动安装的版本不会自动更新，有新版本时扩展弹窗顶部会提示。Edge 加载项商店版本上架后会由浏览器自动更新。隐私政策见 [PRIVACY.md](PRIVACY.md)。

## 开发

```bash
npm install
npm run build   # 产物在 dist/
npm run pack    # 生成 margin.zip
```

源码结构：

```
src/
  content/        内容脚本：首页接管与界面
    api/          B 站接口、WBI 签名、MD5、收藏夹、预览地址
    bg/           WebGL 背景着色器
    filter.ts     推荐过滤规则
    ui/           界面组件（原生 DOM + Shadow DOM）
    styles.css    页面样式（以字符串注入 Shadow DOM）
  popup/          扩展弹窗
  shared/         设置读写（chrome.storage.local）
public/           manifest、弹窗 HTML、图标
scripts/build.mjs Vite 构建（每个入口打成独立 IIFE）
```

## 许可

MIT © 2026 jiuyang5354

首页足迹热力图的液态玻璃借鉴 bubbbly「GitHub Glass Card」的 WebGL 透镜思路：背景着色器先画进纹理，再在卡片位置做边缘折射、内部模糊、顶光高光与乳白 / 墨色染色（改写为圆角矩形 SDF，自写实现）。命令面板 v0.10 改为两栏：左边搜索，右边命令。

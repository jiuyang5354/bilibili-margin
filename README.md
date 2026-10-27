# 映间 MARGIN

一个从零编写的 B 站首页浏览器扩展（Chrome / Edge，Manifest V3）。安静的排版、干净的推荐流。

> 非 B 站官方项目，与哔哩哔哩无关联。所有数据直接来自你当前登录的 B 站账号，不经过任何第三方服务器。

## 功能（v0.3）

- 接管 `www.bilibili.com` 首页，原页面隐藏，播放页等其他页面不受影响
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

收藏夹的玻璃文件夹按 21st.dev「Glass Folder Cards」的公开源码移植（React → 原生 TS，含液态纹理生成算法、扇形展开、··· 菜单与入场组装），并接入 B 站收藏数据：后板是收藏夹封面，口袋里是最近收藏的 4 个视频。

主题按钮按 21st.dev「Sun Moon Theme Toggle」的源码移植（Web Animations 弧线关键帧、中途再点倒放）。

顶栏快捷入口按 21st.dev「Expandable Tabs」的源码移植（framer-motion 弹簧展开 → 原生 CSS 过渡，点外部收起）。

## 安装

1. 在 [Releases](../../releases) 下载 `margin.zip` 并解压，或自行构建（见下）
2. 打开 `chrome://extensions`（Edge 为 `edge://extensions`），开启「开发者模式」
3. 点「加载已解压的扩展程序」，选择解压后的文件夹

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

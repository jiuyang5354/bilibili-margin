# 映间 MARGIN

一个从零编写的 B 站首页浏览器扩展（Chrome / Edge，Manifest V3）。安静的排版、干净的推荐流。

> 非 B 站官方项目，与哔哩哔哩无关联。所有数据直接来自你当前登录的 B 站账号，不经过任何第三方服务器。

## 功能（v0.1）

- 接管 `www.bilibili.com` 首页，原页面隐藏，播放页等其他页面不受影响
- 「推荐」：B 站网页端个性推荐流（WBI 签名接口），无限滚动、去重、换一批
- 「热门」：综合热门榜
- 顶栏搜索（按 `/` 聚焦，回车在新标签页搜索），动态 / 消息 / 收藏 / 历史快捷入口，登录头像
- 亮色 / 暗色 / 跟随系统主题，弹窗与页面即时同步
- 页脚可「本次回到 B 站原版首页」，弹窗可整体关闭

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
    api/          B 站接口、WBI 签名、MD5
    ui/           界面组件（原生 DOM + Shadow DOM）
    styles.css    页面样式（以字符串注入 Shadow DOM）
  popup/          扩展弹窗
  shared/         设置读写（chrome.storage.local）
public/           manifest、弹窗 HTML、图标
scripts/build.mjs Vite 构建（每个入口打成独立 IIFE）
```

## 许可

MIT © 2026 jiuyang5354

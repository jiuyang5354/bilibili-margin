# 映间 MARGIN 0.6

Edge：打开 edge://extensions/ ，开启开发人员模式，加载包含 manifest.json 的 margin-v6-extension 文件夹。停用其他 B 站首页/播放页重设计扩展后查看本版。

访问 B 站首页或 /video/BV… 播放页。首页视频默认在新标签页打开原生播放页。播放页使用黑白灰外观，保留 B 站原生播放器、弹幕、清晰度、倍速、全屏、账号操作和评论。

播放页顶部可切换深浅色。B 站原版链接附加 ?margin=off ，可查看未修改页面。插件开关控制首页与播放页。

构建：node scripts/build-margin-v6.mjs

类型检查：node node_modules/vue-tsc/bin/vue-tsc.js --noEmit -p tsconfig.margin-v6.json

范围：B 站普通视频页与首页。番剧、直播、稍后再看播放器不是本版播放页的匹配范围。登录、会员内容、广告和媒体可用性仍由 B 站决定。

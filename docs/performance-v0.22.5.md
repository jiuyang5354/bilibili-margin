# v0.22.5 性能与持续动态背景 / Performance and continuous backgrounds

## 中文

基于 v0.22.4（62fce65），保留该版本收藏夹展开空间和扇形裁切修复。

- 背景采用累计绘制期限，修正高刷新率屏幕上目标 60 被间隔取整为 48/53 次绘制的问题。负载较高时仍可降至约 30，恢复后回升。
- 滚动、视频播放和播放中的主题切换不会暂停背景；隐藏标签页、关闭背景、减少动态效果及软件渲染兼容策略仍适用。
- 缓存 WebGL 属性位置、固定参数和未变化的调色板。
- 顶栏控件展开时复用位移图，尺寸稳定 80ms 后生成精确贴图，保留原光学公式和参数。
- 足迹在同一日期、月份和视图内复用格子及日期条，更新统计、等级和选择状态；切换视图、月份和跨日时重建，保留日期居中和最新数据提示。

同机 Edge / NVIDIA RTX 3060 Laptop GPU / ANGLE D3D11 专项测试：

| 场景 | v0.22.4 | v0.22.5 |
| --- | --- | --- |
| silk 背景、1440×900、三次各 3 秒绘制提交频率 | 53.325 / 53.335 / 53.335 次/秒 | 60.000 / 60.041 / 60.002 次/秒 |
| 六次顶栏展开生成贴图 | 385 次 | 13 次 |
| 上述贴图像素计算总时间 | 499.1ms | 24.2ms |
| 月视图选四次日期新增元素 | 2116 个 | 0 个 |
| 年视图两次刷新新增格子（含图例） | 752 个 | 0 个 |

绘制提交频率不是 GPU 最终呈现帧率。背景提交间隔 p95 仍约 18.9ms，不声称所有帧间隔都相等。贴图计时包括延迟任务中的计算。

实际 B 站未登录播放测试中，三个连续 3 秒窗口的背景提交频率为 58.72、51.60、60.00 次/秒；视频解码统计丢帧均为 0，但播放进度分别只推进 2.447、2.385、2.522 秒。因此仍存在并发场景波动，不能认定整页稳定 60fps 或播放完全没有卡顿，原因尚未确定。

验证包括 TypeScript/生产构建、144 组着色器像素对比、顶栏/年/月视图静态画面对比、日期与跨日逻辑、持续动态、受控 60–240Hz 调度及 30/60 自适应，以及真实 B 站首页、播放和网页全屏。最新收藏夹的几何布局、裁切和最终画面对比一致。未覆盖所有设备、长时间温度/功耗、登录账号操作或 WebGPU Flux 专项性能。

## English

Based on v0.22.4 (62fce65), preserving its favorites-folder headroom and fan-clipping fixes.

The background scheduler advances accumulated deadlines instead of restarting its interval after each draw. This avoids quantizing a 60fps target down to 48 or 53 submissions on high-refresh displays. It retains adaptive operation around 30 under load and recovery toward 60. Scrolling, video playback and theme changes during playback keep the background animated; hidden-tab, disabled-background, reduced-motion and software-rendering policies still apply.

WebGL locations, constant parameters and unchanged palettes are cached. Expanding header controls reuse their displacement map until dimensions settle for 80ms, then regenerate exact optics with the original formula and parameters. Activity views reuse their existing grid/strip for data and selection updates, rebuilding for view, month or date changes while retaining selection centering and current tooltip data.

On the same Edge / RTX 3060 Laptop GPU / ANGLE D3D11 setup, isolated silk-background submission rates increased from about 53.3 to 60 per second. Six header expansions generated 13 maps instead of 385, with total pixel-generation time falling from 499.1ms to 24.2ms. Four monthly date selections created no new elements instead of 2,116; two yearly refreshes added no cells instead of 752, including legend cells.

Submission rate is not GPU presentation FPS; p95 submission spacing remained around 18.9ms. During actual signed-out Bilibili playback, three consecutive three-second windows measured 58.72, 51.60 and 60.00 background submissions per second. Reported dropped video frames were zero, but media time advanced only 2.447, 2.385 and 2.522 seconds. This does not establish stable whole-page 60fps or stall-free video, and the cause of the variation remains unresolved.

Validation covered TypeScript/production builds, 144 shader pixel comparisons, settled header/year/month visuals, date and midnight behavior, continuous animation, controlled 60–240Hz scheduling and adaptive 30/60 behavior, favorites-folder geometry/clipping, and live homepage/playback/web-fullscreen behavior. All-device performance, sustained thermals/power, signed-in account actions and native WebGPU Flux performance were not measured.

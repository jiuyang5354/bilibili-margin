# v0.22.7：收藏夹与昼夜切换 / Favorites and theme switching

## 中文

本次针对文件夹展开/悬停和首页、播放页的昼夜切换。

- 修复三条无效 CSS transition：同一 transform 过渡重复指定两条缓动曲线，导致浏览器整条声明失效。原来前板和扇形卡片的有效时长为 0s，现在分别恢复为 0.8s、0.75s，并保留错峰、弹性和最终布局。
- 指针事件只记录最新坐标，每帧统一读取一次文件夹位置并更新视差；离开后恢复中心。
- 日月开关的圆盘、云和星星改用 transform 移动，保留原有尺寸、颜色、终态位置和缓动。减少动态效果时不播放这些过渡。
- 主题过渡限定在主要容器和组件，避免给每个后代及伪元素创建颜色过渡；页面根只过渡背景色。
- 首页、空间等接管页和播放页先更新界面，再异步保存主题，避免等待存储响应或由存储回调重复应用同一主题。
- 播放页移除覆盖实时按钮的整页 View Transition 快照。原生页面颜色直接更新，按钮和着色器背景仍实时过渡；这是有意取消整页交叉淡化来避免冻结，而非保留该效果。
- 主题插值期间背景也遵守原有约 60/30 自适应调度，不再绕过节拍逐显示帧重绘；滚动、视频播放期间仍持续动态。

同机 Edge 专项对比，场景为实际组件组成的六个文件夹、日月按钮、持续动态背景与 200 张示例卡片；不使用用户收藏数据：

| 检查 | 修复前 | 修复后 |
| --- | --- | --- |
| 前板/文件卡 transform 过渡 | 0s / 0s | 0.8s / 0.75s |
| 一帧前集中发送 240 个指针事件：布局矩形读取 | 240 次 | 1 次 |
| 按钮位置属性 left/top/bottom 的过渡启动 | 5 次 | 0 次 |
| 不加整页颜色过渡的切换：布局次数 | 48 | 1 |
| 加页面颜色过渡的切换：样式重算累计时间 | 626.7ms | 252.1ms |

性能计数来自 CDP Performance，耗时受设备与场景影响。这不是所有页面的帧率保证；指针测试为同帧突发输入，不能直接解释成日常帧率提升比例。完整页面仍会发生必要布局，并未降到零。

浏览器回归验证：文件夹展开存在中间状态、最终几何与裁切保留；日月开关明暗终态的四个运动部件几何一致；真实 B 站首页和播放页均启动 transform 过渡、没有整页快照覆盖，连续切换四次后状态正确且刷新后保留。持续动态背景、关闭背景、减少动态效果和生产构建检查通过。未覆盖所有登录账号收藏数据、所有设备与长时间功耗。

## English

Three invalid transition declarations specified two timing functions for the same transform transition, causing the browser to discard them. The front panel and file fan now use their intended 0.8s and 0.75s transitions, retaining the stagger, spring and final geometry.

Pointer events retain the latest coordinates and share one geometry read per frame. The theme switch moves its circle, clouds and stars with transforms rather than left/top/bottom. Its sizes, colors, final geometry and easing are retained, with reduced-motion support.

Page color transitions are limited to major containers/components instead of every descendant and pseudo-element; the root transitions only its background. Theme changes update the UI before saving to storage. The watch page removes the whole-page View Transition snapshot: native page colors update directly while the switch and shader background remain live. Removing that whole-page crossfade is an intentional tradeoff to prevent freezing the button. Background color interpolation now follows the existing adaptive 60/30 cadence rather than drawing every display frame, without pausing during scroll or video playback.

In an isolated Edge fixture using the real components, six folders, a live background and 200 sample cards, a burst of 240 pointer events reduced geometry reads from 240 to one. Button left/top/bottom transition starts fell from five to zero, the button-only switch scenario's layout count fell from 48 to one, and total style recalculation in the page-fade scenario fell from 626.7ms to 252.1ms. These are scenario measurements, not whole-site FPS guarantees or a claimed everyday speedup ratio.

Browser checks covered visible folder interpolation, final geometry/clipping, both theme-switch end states, live homepage/watch-page motion, rapid toggling and persistence after reload, continuous backgrounds, disabled backgrounds, reduced motion, and production builds. User account favorites, all devices and sustained power/thermal behavior were not comprehensively tested.

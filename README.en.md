[中文](README.md) | **English**

# MARGIN

A Bilibili interface extension written from scratch for Chrome and Edge, using Manifest V3. It provides quiet typography, a clean video feed, redesigned pages, and liquid glass controls.

This is an unofficial project with no affiliation to Bilibili. Data is requested directly using your current Bilibili session, without a third-party relay server.

## Features

- Replaces the Bilibili homepage while hiding the original page.
- Redesigns video pages, search, personal spaces, activity feeds, and messages; applies matching headers and themes to other supported Bilibili pages.
- Keeps the native player, danmaku, comments, and account actions. The header hides during web fullscreen. Use settings, the extension popup, or `?margin=off` to return to the original page.
- Personalized recommendations use the web WBI-signed API. Includes popular videos, infinite scrolling, deduplication, and refresh.
- Hovering over a cover for half a second starts a muted, low-quality preview with a progress line.
- Filter by title keywords or `/regular expressions/`, blocked uploaders, minimum views, and minimum duration. Uploader blocking can be undone.
- A local yearly activity heatmap records the first opening time and time spent each day. Signed-in viewing history can fill earlier dates.
- Animated sun/moon theme switching, expandable header shortcuts, and a glass-folder favorites drawer with infinite loading.
- Classic warm-white and serif styling, with light, dark, and system themes. Appearance changes synchronize with the popup.
- Eleven shader backgrounds, random or fixed selection, uploaded images, and adjustable intensity. Rendering uses reduced resolution, pauses in hidden tabs, and respects reduced motion.
- A command palette with Bilibili suggestions, recent searches, trending searches, and MARGIN commands. Open it from the search field, `/`, or `Ctrl/Command + K`; use arrows, Enter, and Tab to navigate.
- Video context menus provide open-in-new-tab, watch later, copy link/BV ID, uploader space, and uploader blocking. Shift + right-click retains the browser menu.
- A watch-later drawer shows viewing progress and allows removal. The watch page includes a floating quick menu and a scroll-position ruler.

## Design references

Interactions were independently implemented in native TypeScript and CSS after studying 21st.dev components including Sheet, Segmented Control, Chip Group, Minimal Slider, buttons, toggles, and Command Search.

Adapted component references include:

- **Glass Folder Cards:** React-to-native-TypeScript adaptation with liquid texture generation, fan-out, menus, and entrance assembly, connected to Bilibili favorites and recent thumbnails.
- **Sun Moon Theme Toggle:** Web Animations arc keyframes with reversal when clicked midway.
- **Expandable Tabs:** native CSS transitions adapting the original spring expansion.
- **Command Palette** by rafa-porto: Raycast-style search and commands; a two-column layout was added in v0.10.
- **Context Menu** and **Drawer** by ddoemonn: edge-aware keyboard navigation, spring drawer behavior, and drag dismissal.
- **Skeleton Loader** by animbits and vertical **Scroll Bars** by radiumcoders.
- **Floating Menu:** a capsule expanding into a panel with a rising ink circle and word-by-word hover movement.
- **Apple Liquid glass switcher** by Den Dionigi: layered inset highlights and `backdrop-filter` displacement. Maps are recalculated for each element using a squircle bevel and Snell refraction.
- **Editorial Image Hero**, **Editorial service list**, **Activity Timeline**, **Notification Panel**, and **Conversation List** informed space and message layouts.

The heatmap glass lens algorithm is adapted from movements.dev Refractive Glass (@movements/react-glass, MIT). Layered shadows and the 0.5px hairline ring follow Smooth Shadows; nested corner radii follow Perfect Corner Radius, also from movements.dev. The "Flux" background is a WebGPU compute shader built with [vgpu](https://vgpu.sh) (vercel-labs, MIT): 24,000 particles drifting through a curl-noise flow field, loaded only when that background is selected, with a WebGL fallback when WebGPU is unavailable.

Additional shader references are Silk, Smoke, Neuro Noise, Grain Gradient, God Rays, and Mesh Gradient from 21st's Shader Builder series. Mesh Gradient derives from Paper Shaders under Apache-2.0. Settings thumbnails render the actual shaders.

The activity heatmap's glass takes inspiration from bubbbly's **GitHub Glass Card** WebGL lens approach. The background is rendered to a texture and sampled through a rounded-rectangle SDF lens with edge refraction, blur, highlights, and tinting. This implementation is independently written.

## Install

1. Download `margin.zip` from [Releases](https://github.com/jiuyang5354/bilibili-margin/releases), or build it yourself.
2. Extract it. Open `chrome://extensions` or `edge://extensions` and enable Developer mode.
3. Choose **Load unpacked** and select the extracted directory.

Manually loaded extensions do not update automatically; the popup notifies you when a newer release is available. An Edge Add-ons version, once published, will use browser-managed updates. See [Privacy](PRIVACY.md).

## Develop

```sh
npm install
npm run build
npm run pack
```

The build writes `dist/`; packaging creates `margin.zip`.

```text
src/
  content/
    api/       Bilibili requests, WBI signing, MD5, favorites, preview URLs
    bg/        WebGL background shaders
    filter.ts  Recommendation filters
    ui/        Native DOM and Shadow DOM components
    styles.css Homepage styles injected into Shadow DOM
  popup/       Extension popup
  shared/      chrome.storage.local settings
public/        Manifest, popup HTML, icons
scripts/build.mjs  Vite build; each entry is a standalone IIFE
```

## License

MIT © 2026 jiuyang5354. See [LICENSE](LICENSE). The [Chinese README](README.md) retains the original version-specific notes.

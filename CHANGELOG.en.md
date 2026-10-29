[中文](CHANGELOG.md) | **English**

# Changelog

## [v0.29.0](https://github.com/jiuyang5354/bilibili-margin/releases/tag/v0.29.0) · 2026-10-29

Performance, see docs/performance-v0.29.0.md.

- Takeover pages (home, feed, history, messages) now block the hidden native Bilibili scripts: home load script time 2.0s → 0.3s, JS heap 48.5MB → 3.6MB, nodes 15k → 2.7k. Space page excluded; risk-control 412 / -352 lets native scripts through once.
- Weather dot sky reuses its paths and only updates d.
- ID card animation loop sleeps once settled and wakes on pointer input.

## [v0.28.3](https://github.com/jiuyang5354/bilibili-margin/releases/tag/v0.28.3) · 2026-10-29

Secondary text legibility.

- Secondary text tokens (--muted, --faint, native --text3, --graph_medium) darkened in light / lifted in dark so they stay readable over the colourful animated background.
- Watch page meta row (views, danmaku, date, copyright, AI notice) now uses --muted with selectors updated for the current Bilibili DOM; soft shadow in dark mode.

## [v0.28.2](https://github.com/jiuyang5354/bilibili-margin/releases/tag/v0.28.2) · 2026-10-29

ID card back re-laid out (keeps the original 21st ID Card Lanyard Connect row).

- Links as a 2×3 grid under an "ACCOUNT" eyebrow; adds Message center.
- New quick-access icon row: favourites, history, watch later, dynamics.
- Log out moved to the signature line; no more empty gap, stripe and barcode tightened.

## [v0.28.1](https://github.com/jiuyang5354/bilibili-margin/releases/tag/v0.28.1) · 2026-10-29

ID card front re-laid out (after 21st ID Card Lanyard + Flip Card stats row).

- Following / followers / coins as a three-column stat row; exp numbers share the line with the membership role.
- Top-right shows level and UID; info rows show exp to next level, B-coins and a scan hint.
- No text on the card below 10px, matching the site type scale.

## [v0.28.0](https://github.com/jiuyang5354/bilibili-margin/releases/tag/v0.28.0) · 2026-10-29

Avatar ID card upgrade.

### Improved

- ID card enlarged ~1.28× (scale 0.86 → 1.1) for readability.
- Front/back QR codes are now real (qrcode-generator, MIT) and open your space when scanned.
- Front footer now shows unread messages and new dynamics counts (clickable, highlighted when non-zero) instead of placeholder text.
- Hovering the avatar must dwell 200ms before the card drops, so passing over it no longer opens it.

## [v0.27.3](https://github.com/jiuyang5354/bilibili-margin/releases/tag/v0.27.3) · 2026-10-29

Ball-chain ID card.

- A metal ball chain hangs from the avatar into the card slot, theme-aware.
- Drag-swing and tap-to-flip kept; the card pivots at its slot.

## [v0.27.2](https://github.com/jiuyang5354/bilibili-margin/releases/tag/v0.27.2) · 2026-10-29

No more lanyard rope.

- The card floats under the avatar on a hidden pivot, still draggable and flippable, kept inside the viewport.

## [v0.27.1](https://github.com/jiuyang5354/bilibili-margin/releases/tag/v0.27.1) · 2026-10-29

Card placement.

- Clasp under the avatar, shorter rope, card at 86%.
- Tilted gravity keeps the card inside the viewport.

## [v0.27.0](https://github.com/jiuyang5354/bilibili-margin/releases/tag/v0.27.0) · 2026-10-28

Avatar card becomes an ID card.

- Hovering the avatar drops a 21st ID Card Lanyard style card: rope physics, drag-swing, tap to flip, account links on the back.
- Closes 0.5s after the pointer leaves.
- Home elastic gallery removed.

## [v0.26.0](https://github.com/jiuyang5354/bilibili-margin/releases/tag/v0.26.0) · 2026-10-28

Dot-matrix weather card.

- New home weather card (21st Weather Widget port): animated sky, hourly and 3-day forecast.
- Open-Meteo + IP location, editable city, 30-minute cache.

## [v0.25.2](https://github.com/jiuyang5354/bilibili-margin/releases/tag/v0.25.2) · 2026-10-28

Gallery follows recommendations.

- The elastic gallery shows the first 5 recommended videos of each batch, refreshes with Shuffle and never repeats them in the grid.

## [v0.25.1](https://github.com/jiuyang5354/bilibili-margin/releases/tag/v0.25.1) · 2026-10-28

Elastic gallery.

- Home widgets replaced by 21st Elastic Gallery: 5 accordion covers with vertical CJK titles; resume recent history when signed in.

## [v0.25.0](https://github.com/jiuyang5354/bilibili-margin/releases/tag/v0.25.0) · 2026-10-28

Home layout matches search.

- Home width, gutters and columns now match the Bilibili search page (6/7/8 columns by width).
- Footprint card fixed width with a widget slot.

## [v0.24.0](https://github.com/jiuyang5354/bilibili-margin/releases/tag/v0.24.0) · 2026-10-28

Intro finale.

- After the intro the TV flies to the top-left and stays as the home link.
- Header Command tab removed; Ctrl+K still works.

## [v0.23.3](https://github.com/jiuyang5354/bilibili-margin/releases/tag/v0.23.3) · 2026-10-28

Watch menu type scale.

- CJK 18px, English 11px tracked caps, labels 14px.

## [v0.23.2](https://github.com/jiuyang5354/bilibili-margin/releases/tag/v0.23.2) · 2026-10-28

Menu fonts and comment spacing.

- Floating menu uses sans fonts (Margin Sans SC + Alte Haas Grotesk).
- 24px top padding on comments.

## [v0.23.1](https://github.com/jiuyang5354/bilibili-margin/releases/tag/v0.23.1) · 2026-10-28

Comment skin.

- Native comment header and composer follow Margin colours.
- Command palette entry moved to the header (Ctrl+K).

## [v0.23.0](https://github.com/jiuyang5354/bilibili-margin/releases/tag/v0.23.0) · 2026-10-28

Combined homepage-search and performance update. Includes all optimizations and fixes from v0.22.5 through v0.22.7; no separate performance patch is required.

### Added

- Rotating trending-search placeholders, focus dimming, and an expanding homepage search panel.
- Recent searches, trending terms and input suggestions, with history deletion, keyboard selection and dismissal.
- A text-dissolve submission effect with simplified reduced-motion behavior.

### Included optimizations and fixes

- Backgrounds remain animated during scrolling, video playback and theme changes during playback. Accumulated deadlines correct high-refresh drawing cadence while retaining adaptive operation around 60/30 under load.
- Cached WebGL constants/palettes and reused glass displacement maps during header expansion, regenerating exact maps after dimensions settle.
- Reused yearly/monthly activity nodes, retaining centered date selection, current statistics/tooltips and midnight refresh.
- Card-relative date-tooltip positioning fixes offsets caused by backdrop-filter changes; resizing and horizontal graph scrolling dismiss stale tips.
- Restored valid 0.8s front-panel and 0.75s file-card transitions. Pointer geometry reads are coalesced per frame, preserving folder headroom and fan clipping.
- The theme switch uses transforms. Homepage/watch-page UI updates precede asynchronous persistence. The watch page removes the whole-page snapshot transition that obscured live switch motion, retaining the switch and background animations.
- Page color transitions have a narrower scope; background theme interpolation follows its normal target cadence to reduce contention.

### Validation scope

Earlier targeted checks covered shader/component visual comparisons, activity-date logic, continuous animation, folder interpolation/final geometry, live homepage/watch-page theme switching and persistence. See [background/activity measurements](docs/performance-v0.22.5.md) and [folder/theme-switch measurements](docs/interaction-performance-v0.22.7.md).

These changes do not guarantee stable 60fps in every scenario. Earlier live concurrent-video tests still showed drawing-rate variation. The v0.23.0 local update verified code inclusion and release-file integrity; a complete performance suite was not rerun for that update.

## v0.22.7 · 2026-10-28

- Fixed duplicate easing functions that invalidated folder-opening transitions; coalesced pointer geometry reads.
- Moved the theme switch using transforms and narrowed page color transitions.
- Updated theme UI before saving settings and removed watch-page snapshots that froze the switch.
- Kept backgrounds animated during theme interpolation at the normal target cadence.

## v0.22.6 · 2026-10-28

- Positioned activity-date tooltips in card-local coordinates.
- Dismissed stale tips on horizontal graph scroll and card resizing.

## v0.22.5 · 2026-10-28

- Corrected high-refresh background scheduling, retaining load adaptation and continuous animation during scroll/playback.
- Reduced glass-map generation, repeated WebGL uploads and activity-view node rebuilding.

## v0.22.4 · 2026-10-28

- Reserved folder-opening headroom and narrowed the fan/clipping region to reduce overlap with adjacent cards.

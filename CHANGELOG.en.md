[中文](CHANGELOG.md) | **English**

# Changelog

## [v0.28.0](https://github.com/jiuyang5354/bilibili-margin/releases/tag/v0.28.0) · 2026-10-29

Avatar ID card upgrade.

### Improved

- ID card enlarged ~1.28× (scale 0.86 → 1.1) for readability.
- Front/back QR codes are now real (qrcode-generator, MIT) and open your space when scanned.
- Front footer now shows unread messages and new dynamics counts (clickable, highlighted when non-zero) instead of placeholder text.
- Hovering the avatar must dwell 200ms before the card drops, so passing over it no longer opens it.

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

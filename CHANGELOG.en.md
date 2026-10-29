[中文](CHANGELOG.md) | **English**

# Changelog

## [v0.31.0](https://github.com/jiuyang5354/bilibili-margin/releases/tag/v0.31.0) · 2026-10-29

Performance: per-page code loading, sliced CJK fonts, one scheduler for timers.

- The entry script injected into every Bilibili page drops from 447 KB to 34 KB: UI code for home, watch, search, space, messages, history and feed now loads on demand by route; the intro engine and the ID-card QR code library load only when used.
- Both CJK fonts (Noto Sans SC subset 1.7 MB, LXGW Neo ZhiSong subset 1.3 MB) are split into ~100 frequency-ordered slices so pages only download the characters they show; font traffic on a first home load drops from 3.25 MB to 1.68 MB.
- All periodic work (footprint timing, unread badges, trending rotation, weather animation, comment skin) shares one scheduler and pauses entirely while the tab is in the background.
- Footprint time is now accumulated by a background service worker, so several Bilibili tabs no longer overwrite or double-count each other. Data format unchanged.
- The watch-page skin stylesheet is applied at document start without waiting for the UI code, so the native page doesn't flash.

## [v0.30.3](https://github.com/jiuyang5354/bilibili-margin/releases/tag/v0.30.3) · 2026-10-29

Lighter opening animation, fixes stutter.

- While the intro plays, the home background, weather animation and header TV eyes it fully covers are paused, resuming as soon as it fades out, so they no longer compete for the GPU.
- The intro nebula is evaluated twice per pixel instead of once per dispersion sample (20×), with 3 noise octaves instead of 4.
- Adaptive resolution for the intro canvas: pixel density steps down on sustained dropped frames.

## [v0.30.2](https://github.com/jiuyang5354/bilibili-margin/releases/tag/v0.30.2) · 2026-10-29

Shader background for the opening animation.

- The intro background is now a flowing nebula using the Live Orb fbm domain warp: Bilibili blue breathes at the centre like an orb, pink and orange drift around it; soft tinted paper in light mode, a dim glow on near-black in dark mode.
- The glass tile refracts this moving backdrop, so its rim dispersion visibly bends it.
- Reverted the v0.30.1 skeleton shader (misunderstood request); skeletons use the CSS shimmer again.

## [v0.30.1](https://github.com/jiuyang5354/bilibili-margin/releases/tag/v0.30.1) · 2026-10-29

Shader loading skeletons.

- Cover placeholders on video cards and Watch Later now use a WebGL shader: the Live Orb fbm domain-warped ink fog drifts slowly, with an occasional pink-to-orange accent and a diagonal light sweep; text lines keep the CSS shimmer.
- One shared WebGL context renders a small image; each cover copies its own region via a 2D canvas. ~30fps, stops as soon as skeletons are gone, one still frame under reduced motion, CSS shimmer kept without WebGL.

## [v0.30.0](https://github.com/jiuyang5354/bilibili-margin/releases/tag/v0.30.0) · 2026-10-29

The header TV comes alive.

- The top-left TV's eyes are now drawn in WebGL (a port of the 21st Live Orb technique): the screen is a slightly convex CRT surface, the two capsule eyes sit on it and turn in 3D toward the pointer with perspective foreshortening, blink now and then, and glance around after the pointer rests for 3 seconds.
- No animation frames while still; a timer waits for the next blink or glance. Pauses when the tab is hidden, the icon is off screen, or reduced motion is on.
- Follows the day/night theme; falls back to the original SVG icon without WebGL or after a lost context. The intro still lands on the same spot.

## [v0.29.1](https://github.com/jiuyang5354/bilibili-margin/releases/tag/v0.29.1) · 2026-10-29

Favourites card size fix.

- Video cards in the Favourites sheet are back to auto-fill width (min ~210px) instead of inheriting the home page's 6/7/8-column grid. Regression from v0.25.0.

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

## [v0.22.4](https://github.com/jiuyang5354/bilibili-margin/releases/tag/v0.22.4) · 2026-10-28

- Reserved folder-opening headroom and narrowed the fan/clipping region to reduce overlap with adjacent cards.

## [v0.22.3](https://github.com/jiuyang5354/bilibili-margin/releases/tag/v0.22.3) · 2026-10-28

Watch menu English sub-labels.

- Each floating-menu item gets an Instrument Serif italic English sub-label.

## [v0.22.2](https://github.com/jiuyang5354/bilibili-margin/releases/tag/v0.22.2) · 2026-10-28

Watch menu font.

- Floating menu uses LXGW WenKai Medium, subset to the menu characters only (5.6KB).

## [v0.22.1](https://github.com/jiuyang5354/bilibili-margin/releases/tag/v0.22.1) · 2026-10-28

Day/night switch colours.

- Warm paper track, white clouds and a Bilibili pink-to-orange sun by day; ink track and cool white moon by night.

## [v0.22.0](https://github.com/jiuyang5354/bilibili-margin/releases/tag/v0.22.0) · 2026-10-28

New day/night switch.

- Theme toggle replaced by a native port of Uiverse theme-switch, keeping its structure, proportions and curves.
- Page colour fade now 500ms, in sync with the switch.

## [v0.21.1](https://github.com/jiuyang5354/bilibili-margin/releases/tag/v0.21.1) · 2026-10-28

Sun/moon toggle fixes.

- Back to the original 21st Sun Moon Theme Toggle behaviour: colour-only page fade, 150ms button easing, twinkling stars.

## [v0.21.0](https://github.com/jiuyang5354/bilibili-margin/releases/tag/v0.21.0) · 2026-10-28

Scroll performance and motion tokens.

- Large blurred surfaces drop their backdrop while scrolling; off-screen cards skip rendering.
- Motion unified to three easing curves and 150/200/300/400ms durations; press feedback on buttons.

## [v0.20.0](https://github.com/jiuyang5354/bilibili-margin/releases/tag/v0.20.0) · 2026-10-28

Footprint card glass.

- Footprint card uses 21st Glass Calendar glass (translucent fill, 24px blur, hairline border, 24px radius); GL refractive lens disabled.

## [v0.19.0](https://github.com/jiuyang5354/bilibili-margin/releases/tag/v0.19.0) · 2026-10-28

Footprint month view.

- Footprint card gains a 21st Glass Calendar month view: year/month toggle, scrollable day strip, tap a day for details.
- Background targets ~60fps and steps down on slow frames.
- Header selection pill becomes a clear highlight.

## [v0.18.1](https://github.com/jiuyang5354/bilibili-margin/releases/tag/v0.18.1) · 2026-10-28

Typography pass.

- Font sizes reduced to a 12-step integer scale on a 4px spacing grid.
- Serif only for titles ≥16px, mono only for numbers and English eyebrows, tighter CJK tracking, concentric radii.

## [v0.18.0](https://github.com/jiuyang5354/bilibili-margin/releases/tag/v0.18.0) · 2026-10-28

History and feed pages.

- History and the feed home become Margin pages (21st Activity Timeline / SocialPostCard).
- Instrument Serif Latin titles and italic English eyebrows.
- Fixed the square corner on the collapsed danmaku list.

## [v0.17.0](https://github.com/jiuyang5354/bilibili-margin/releases/tag/v0.17.0) · 2026-10-28

Intro animation.

- Home intro (21st Glass Reveal with the Bilibili TV), once per session, skippable, can be turned off.
- Fixed a stray blue dot on the triple-action button.

## [v0.16.0](https://github.com/jiuyang5354/bilibili-margin/releases/tag/v0.16.0) · 2026-10-28

Header complete.

- Header adds VIP, Creator Center and Upload, plus unread badges for messages and feed.
- Avatar card with level, following, followers, coins and sign-out.
- Create and delete favourite folders.

## [v0.15.0](https://github.com/jiuyang5354/bilibili-margin/releases/tag/v0.15.0) · 2026-10-28

"Flux" background.

- New Flux background: a WebGPU compute particle flow field, loaded only when selected, with a WebGL fallback.

## [v0.14.2](https://github.com/jiuyang5354/bilibili-margin/releases/tag/v0.14.2) · 2026-10-28

Performance.

- Background thumbnails in settings compile lazily and are cached.
- Scrolling reuses the background texture; software rendering keeps the background static.

## [v0.14.1](https://github.com/jiuyang5354/bilibili-margin/releases/tag/v0.14.1) · 2026-10-28

Watch page shadows.

- Action pills, description and comment cards and the floating menu use Smooth Shadows with a hairline ring.

## [v0.14.0](https://github.com/jiuyang5354/bilibili-margin/releases/tag/v0.14.0) · 2026-10-28

Shadow and radius tokens.

- Shadows unified to --sh-xs/sm/md/lg plus a --ring hairline (movements.dev Smooth Shadows); nested radii are concentric.

## [v0.13.2](https://github.com/jiuyang5354/bilibili-margin/releases/tag/v0.13.2) · 2026-10-28

Heatmap glass tweak.

- Softer edge bend and aberration on the heatmap glass, lighter border and shadow.

## [v0.13.1](https://github.com/jiuyang5354/bilibili-margin/releases/tag/v0.13.1) · 2026-10-28

Refractive heatmap glass.

- Heatmap glass follows movements.dev Refractive Glass, with inner stroke and sheen.

## [v0.13.0](https://github.com/jiuyang5354/bilibili-margin/releases/tag/v0.13.0) · 2026-10-28

Space and messages layout.

- Space header becomes a large fading banner with a big serif name; videos gain a list view.
- Messages grouped by day with sentence-style notices and quotes; DMs grouped by date.

## [v0.12.0](https://github.com/jiuyang5354/bilibili-margin/releases/tag/v0.12.0) · 2026-10-28

Space and messages.

- Personal space rebuilt as a Margin page: editorial profile bar, videos and posts.
- Message center rebuilt: categories, notice stream and DM conversations.

## [v0.11.5](https://github.com/jiuyang5354/bilibili-margin/releases/tag/v0.11.5) · 2026-10-28

Theme switch sync.

- Removed the header bottom hairline.
- Background palette and toggle animate in step; watch page fade is 1740ms.

## [v0.11.4](https://github.com/jiuyang5354/bilibili-margin/releases/tag/v0.11.4) · 2026-10-28

Performance and search page.

- Background shader renders at lower resolution and 24fps, pausing while scrolling or playing video.
- Search page box matches the header, suggestion popup fixed, sticky search bar hidden.

## [v0.11.3](https://github.com/jiuyang5354/bilibili-margin/releases/tag/v0.11.3) · 2026-10-28

Update notice and Edge listing.

- Popup shows when a new version is available.
- Edge Add-ons listing assets: privacy policy, screenshots, logo, publish script.

## [v0.11.2](https://github.com/jiuyang5354/bilibili-margin/releases/tag/v0.11.2) · 2026-10-28

Favourites, wide mode, triple action.

- Favourites wrap to multiple rows; right column yields in wide mode; danmaku list edges fixed.
- Margin triple-action animation (21st Hold to Confirm + Like Burst).

## v0.11.1 · 2026-10-28

Header hover.

- Header shortcuts expand into labelled pills on hover.

## v0.11.0 · 2026-10-28

Fonts and typography.

- Bundled font subsets: Geist, Geist Mono, Source Han Sans, LXGW Neo ZhiSong; editorial typography.
- Header tooltips (21st Tooltip port).

## v0.10.6 · 2026-10-28

Full-strength liquid glass.

- Background strength and fade mask moved into GL compositing so the glass is no longer washed out.

## v0.10.5 · 2026-10-28

Physically based liquid glass.

- Heatmap glass rewritten: curved-edge refraction with Fresnel, dispersion, light blur and directional highlights.

## v0.10.4 · 2026-10-28

Clear glass.

- Heatmap glass drops the milky tint and heavy blur for edge refraction, dispersion and highlights.

## v0.10.3 · 2026-10-28

Home search box.

- Large centred search box on home; header search hidden there.

## v0.10.2 · 2026-10-28

Search page fix.

- Only one search box on the search page.

## v0.10.1 · 2026-10-28

Theme fade safeguard.

- 1.6s fallback so the theme cross-fade never gets stuck.

## v0.10.0 · 2026-10-28

Site-wide takeover.

- Search and other pages get the Margin look; shader backgrounds site-wide.
- Liquid-glass heatmap; two-column command palette.

## v0.9.3 · 2026-10-28

Watch page theme switch.

- Whole-page cross-fade on the watch page; softer dark-mode glass highlights.

## v0.9.2 · 2026-10-27

Feed bar fix.

- Removed the grey glass strip under the feed tabs.

## v0.9.1 · 2026-10-27

Header logo removed.

- Removed the top-left header logo.

## v0.9.0 · 2026-10-27

Shader backgrounds.

- Six 21st shader backgrounds; footprint card loses its border.

## v0.8.0 · 2026-10-27

Glass footprint card and scroll ruler.

- Glass footprint card, shimmer skeletons and a ruler-style scroll indicator.

## v0.7.1 · 2026-10-27

Watch Later drawer.

- New Watch Later side drawer.

## v0.7.0 · 2026-10-27

Command palette and context menu.

- Command palette (Ctrl+K) and a right-click menu on video cards.

## v0.6.2 · 2026-10-27

Sticky tabs.

- Sticky category bar becomes liquid glass.

## v0.6.1 · 2026-10-27

Watch page menu.

- Floating quick menu on the watch page.

## v0.6.0 · 2026-10-27

Liquid-glass header.

- Header becomes liquid glass.

## v0.5.2 · 2026-10-27

Player bottom corners.

- Fixed the player bottom corners.

## v0.5.1 · 2026-10-27

Player edge.

- Removed the black edge outside the rounded player.

## v0.5.0 · 2026-10-27

Watch page redesign.

- Watch page gets the Margin look: title, player, description and related column.

## v0.4.2 · 2026-10-27

Sun/moon toggle.

- New sun/moon theme toggle.

## v0.4.1 · 2026-10-27

Footprint on home.

- Footprint heatmap moved onto the home page.

## v0.4.0 · 2026-10-27

Footprint heatmap and expandable tabs.

- Bilibili footprint heatmap (first open time and duration per day).
- Header uses Expandable Tabs.

## v0.3.0 · 2026-10-27

Palettes and favourites.

- Mist blue / night blue palettes, ice background and glass-folder favourites.

## v0.2.1 · 2026-10-27

UI fixes.

- Fixed broken blur, narrow-screen header and sticky bar overlap.

## v0.2.0 · 2026-10-27

Settings and home features.

- Settings panel, feed filters, hover preview, favourites and animated backgrounds.

## v0.1.0 · 2026-10-27

Clean-room rewrite.

- Margin rewritten from scratch with Vite + TypeScript (vanilla DOM + Shadow DOM), no longer based on BewlyBewly.
- New home feed and header.

## Legacy (based on BewlyBewly, branch `legacy-v0.6`)

The first build before the clean-room rewrite, which restarted numbering at v0.1.0.

### v0.6.4 · 2026-10-27

- 6 random shader backgrounds plus custom image background.

### v0.6.3 · 2026-10-27

- Glass-folder favourites in the right column.

### v0.6.2 · 2026-10-27

- Footprint heatmap in the right column (first visit time and duration per day).

### v0.6.1 · 2026-10-27

- 21st interactions: hover preview, shimmer search, typewriter command palette, circular theme reveal.

### [v0.6.0](https://github.com/jiuyang5354/bilibili-margin/releases/tag/v0.6.0) · 2026-10-27

- First preview: Bilibili home and watch page redesign on top of BewlyBewly.

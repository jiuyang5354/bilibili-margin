# MARGIN v0.6

Edge extension: homepage and native Bilibili watch page. The homepage removes decorative headings, bilingual labels and explanatory copy. The watch page places the native player first, then title, statistics, native action bar, description, tags and comments. Native uploader and recommendation nodes receive matching monochrome typography and spacing in a right column. No player iframe, media download, replacement media element, or proxy playback API.

Every watch CSS rule is scoped to html[data-margin-watch=on]. Mounting requires the real native player and video container. Original DOM nodes stay under Bilibili ownership; CSS flex order changes the visual order. Same-document route changes remount extension chrome, and the ?margin=off bypass removes all watch styles.

Design skill: redesign-existing-projects. References retained from v0.5: 21st Prism, Dashboard 2, Animated Navigation Tabs and Liquid Glass.

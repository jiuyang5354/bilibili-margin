# Third-party notices

## BewlyBewly
Based on https://github.com/BewlyBewly/BewlyBewly
Upstream commit d42143547bf4e9cc6864f227fcbcbd396bbff25b.
Copyright (c) 2021 Hakadao. MIT. Full text in LICENSE-BewlyBewly.txt (source: ../LICENSE).
MARGIN reuses API definitions, the message/request factory and API client. Its UI,
homepage injection, local library and build entrypoints are independently authored.
Original files remain in this development fork for traceability; they are not all bundled.

## Liquid Metal shader
Retrieved from https://21st.dev/@paper-design/components/liquid-metal
Adapted from Paper Shaders: https://shaders.paper.design/liquid-metal
Paper Shaders: https://github.com/paper-design/shaders
License: Apache License 2.0; full text in LICENSE-Apache-2.0.txt.
Changes: extracted the GLSL vertex/fragment source, replaced React lifecycle with Vue,
limited drawing to a 320x240 canvas, switched to monochrome, added hover-only motion,
reduced-motion handling, visibility/intersection pause, and GPU fallback.
The original 21st component is retained under design/references for provenance.

## 21st interaction research
https://21st.dev/@victor-teles/components/command-menu
https://21st.dev/@manuarora700/components/liquid-glass
These were inspected as references. Their React implementation was not copied into
the shipped extension. MARGIN uses a native-dialog Vue command menu and CSS frosted
glass. The toolbar is not described as physically refractive liquid glass.

## Phosphor icons
https://github.com/phosphor-icons/core
Copyright (c) 2023 Phosphor Icons. MIT. Distributed via @iconify/json.
The icon subset is extracted without alteration. Full MIT text follows.

Permission is hereby granted, free of charge, to any person obtaining a copy of this
software and associated documentation files (the "Software"), to deal in the Software
without restriction, including without limitation the rights to use, copy, modify,
merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF
CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE
OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## Vue, Iconify and WebExtension Polyfill
Vue: MIT, https://github.com/vuejs/core/blob/main/LICENSE
Iconify Vue: MIT, https://github.com/iconify/iconify/blob/main/license.txt
WebExtension Polyfill: MPL-2.0, https://github.com/mozilla/webextension-polyfill
Bundled dependency license files are included in DEPENDENCY-LICENSES/.

## Preview images and metadata
Bilibili public feed snapshot, 2026-10-26. See PREVIEW-CONTENT-SOURCES.json in the
source project. Covers remain the property of their respective rights holders and
are used only to review the Bilibili interface redesign. No preview images or sample
feed data are bundled into margin-extension.

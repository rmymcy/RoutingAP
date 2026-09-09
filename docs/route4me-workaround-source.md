# Route4Me Workaround — full source

**v25 · `index.html` · 4,130 lines · one self-contained offline file.**

No build step and no server: open the file in a browser and it runs. The only
thing it fetches is OpenStreetMap tiles — Leaflet itself is vendored inline.

The file is assembled as: document head → vendored Leaflet → `<style>` → markup →
the app script. Reproduced below in that order, except the Leaflet blob, which is
stock 1.9.4 and 144 KB of minified noise.

Companion doc: `Tool_Anatomy_and_Reuse.md` — what each part does, which pieces are
portable, and what the next tool needs.

---

## Contents

- [Document, styles and markup](#document-styles-and-markup)
- Script
  - [SEED DATA](#seed-data) — 4 lines
  - [STORAGE](#storage) — 234 lines
  - [MATCHING](#matching) — 114 lines
  - [CSV](#csv) — 25 lines
  - [CONVERT](#convert) — 47 lines
  - [TASK SETTINGS](#task-settings) — 376 lines
  - [JOBS TABLE (trim file01 before Send)](#jobs-table-trim-file01-before-send) — 132 lines
  - [OPTION 2: CREW MAP (depot preview)](#option-2-crew-map-depot-preview) — 248 lines
  - [BRING BACK (file03 -> file04)](#bring-back-file03-file04) — 189 lines
  - [SUB RESOLUTION MODAL (fuzzy review cards)](#sub-resolution-modal-fuzzy-review-cards) — 142 lines
  - [SUBS LIBRARY (inline grid, dispatch-style)](#subs-library-inline-grid-dispatch-style) — 173 lines
  - [SUBS MAP (Leaflet — all subs + per-sub focus)](#subs-map-leaflet-all-subs-per-sub-focus) — 78 lines
  - [CREWS TABLE](#crews-table) — 22 lines
  - [EDIT MODALS](#edit-modals) — 104 lines
  - [KMZ IMPORT (update library from Google Earth files)](#kmz-import-update-library-from-google-earth-files) — 521 lines
  - [HELPERS](#helpers) — 25 lines
  - [WIRING](#wiring) — 88 lines
  - [STORAGE READOUT](#storage-readout) — 506 lines

---

## Document, styles and markup

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Route4Me Workaround</title>
<!-- Leaflet 1.9.4 vendored inline (no CDN): only the OpenStreetMap TILES need internet -->
<style>/* required styles */

.leaflet-pane,
.leaflet-tile,
.leaflet-marker-icon,
.leaflet-marker-shadow,
.leaflet-tile-container,
.leaflet-pane > svg,
.leaflet-pane > canvas,
.leaflet-zoom-box,
.leaflet-image-layer,
.leaflet-layer {
	position: absolute;
	left: 0;
	top: 0;
	}
.leaflet-container {
	overflow: hidden;
	}
.leaflet-tile,
.leaflet-marker-icon,
.leaflet-marker-shadow {
	-webkit-user-select: none;
	   -moz-user-select: none;
	        user-select: none;
	  -webkit-user-drag: none;
	}
/* Prevents IE11 from highlighting tiles in blue */
.leaflet-tile::selection {
	background: transparent;
}
/* Safari renders non-retina tile on retina better with this, but Chrome is worse */
.leaflet-safari .leaflet-tile {
	image-rendering: -webkit-optimize-contrast;
	}
/* hack that prevents hw layers "stretching" when loading new tiles */
.leaflet-safari .leaflet-tile-container {
	width: 1600px;
	height: 1600px;
	-webkit-transform-origin: 0 0;
	}
.leaflet-marker-icon,
.leaflet-marker-shadow {
	display: block;
	}
/* .leaflet-container svg: reset svg max-width decleration shipped in Joomla! (joomla.org) 3.x */
/* .leaflet-container img: map is broken in FF if you have max-width: 100% on tiles */
.leaflet-container .leaflet-overlay-pane svg {
	max-width: none !important;
	max-height: none !important;
	}
.leaflet-container .leaflet-marker-pane img,
.leaflet-container .leaflet-shadow-pane img,
.leaflet-container .leaflet-tile-pane img,
.leaflet-container img.leaflet-image-layer,
.leaflet-container .leaflet-tile {
	max-width: none !important;
	max-height: none !important;
	width: auto;
	padding: 0;
	}

.leaflet-container img.leaflet-tile {
	/* See: https://bugs.chromium.org/p/chromium/issues/detail?id=600120 */
	mix-blend-mode: plus-lighter;
}

.leaflet-container.leaflet-touch-zoom {
	-ms-touch-action: pan-x pan-y;
	touch-action: pan-x pan-y;
	}
.leaflet-container.leaflet-touch-drag {
	-ms-touch-action: pinch-zoom;
	/* Fallback for FF which doesn't support pinch-zoom */
	touch-action: none;
	touch-action: pinch-zoom;
}
.leaflet-container.leaflet-touch-drag.leaflet-touch-zoom {
	-ms-touch-action: none;
	touch-action: none;
}
.leaflet-container {
	-webkit-tap-highlight-color: transparent;
}
.leaflet-container a {
	-webkit-tap-highlight-color: rgba(51, 181, 229, 0.4);
}
.leaflet-tile {
	filter: inherit;
	visibility: hidden;
	}
.leaflet-tile-loaded {
	visibility: inherit;
	}
.leaflet-zoom-box {
	width: 0;
	height: 0;
	-moz-box-sizing: border-box;
	     box-sizing: border-box;
	z-index: 800;
	}
/* workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=888319 */
.leaflet-overlay-pane svg {
	-moz-user-select: none;
	}

.leaflet-pane         { z-index: 400; }

.leaflet-tile-pane    { z-index: 200; }
.leaflet-overlay-pane { z-index: 400; }
.leaflet-shadow-pane  { z-index: 500; }
.leaflet-marker-pane  { z-index: 600; }
.leaflet-tooltip-pane   { z-index: 650; }
.leaflet-popup-pane   { z-index: 700; }

.leaflet-map-pane canvas { z-index: 100; }
.leaflet-map-pane svg    { z-index: 200; }

.leaflet-vml-shape {
	width: 1px;
	height: 1px;
	}
.lvml {
	behavior: url(#default#VML);
	display: inline-block;
	position: absolute;
	}


/* control positioning */

.leaflet-control {
	position: relative;
	z-index: 800;
	pointer-events: visiblePainted; /* IE 9-10 doesn't have auto */
	pointer-events: auto;
	}
.leaflet-top,
.leaflet-bottom {
	position: absolute;
	z-index: 1000;
	pointer-events: none;
	}
.leaflet-top {
	top: 0;
	}
.leaflet-right {
	right: 0;
	}
.leaflet-bottom {
	bottom: 0;
	}
.leaflet-left {
	left: 0;
	}
.leaflet-control {
	float: left;
	clear: both;
	}
.leaflet-right .leaflet-control {
	float: right;
	}
.leaflet-top .leaflet-control {
	margin-top: 10px;
	}
.leaflet-bottom .leaflet-control {
	margin-bottom: 10px;
	}
.leaflet-left .leaflet-control {
	margin-left: 10px;
	}
.leaflet-right .leaflet-control {
	margin-right: 10px;
	}


/* zoom and fade animations */

.leaflet-fade-anim .leaflet-popup {
	opacity: 0;
	-webkit-transition: opacity 0.2s linear;
	   -moz-transition: opacity 0.2s linear;
	        transition: opacity 0.2s linear;
	}
.leaflet-fade-anim .leaflet-map-pane .leaflet-popup {
	opacity: 1;
	}
.leaflet-zoom-animated {
	-webkit-transform-origin: 0 0;
	    -ms-transform-origin: 0 0;
	        transform-origin: 0 0;
	}
svg.leaflet-zoom-animated {
	will-change: transform;
}

.leaflet-zoom-anim .leaflet-zoom-animated {
	-webkit-transition: -webkit-transform 0.25s cubic-bezier(0,0,0.25,1);
	   -moz-transition:    -moz-transform 0.25s cubic-bezier(0,0,0.25,1);
	        transition:         transform 0.25s cubic-bezier(0,0,0.25,1);
	}
.leaflet-zoom-anim .leaflet-tile,
.leaflet-pan-anim .leaflet-tile {
	-webkit-transition: none;
	   -moz-transition: none;
	        transition: none;
	}

.leaflet-zoom-anim .leaflet-zoom-hide {
	visibility: hidden;
	}


/* cursors */

.leaflet-interactive {
	cursor: pointer;
	}
.leaflet-grab {
	cursor: -webkit-grab;
	cursor:    -moz-grab;
	cursor:         grab;
	}
.leaflet-crosshair,
.leaflet-crosshair .leaflet-interactive {
	cursor: crosshair;
	}
.leaflet-popup-pane,
.leaflet-control {
	cursor: auto;
	}
.leaflet-dragging .leaflet-grab,
.leaflet-dragging .leaflet-grab .leaflet-interactive,
.leaflet-dragging .leaflet-marker-draggable {
	cursor: move;
	cursor: -webkit-grabbing;
	cursor:    -moz-grabbing;
	cursor:         grabbing;
	}

/* marker & overlays interactivity */
.leaflet-marker-icon,
.leaflet-marker-shadow,
.leaflet-image-layer,
.leaflet-pane > svg path,
.leaflet-tile-container {
	pointer-events: none;
	}

.leaflet-marker-icon.leaflet-interactive,
.leaflet-image-layer.leaflet-interactive,
.leaflet-pane > svg path.leaflet-interactive,
svg.leaflet-image-layer.leaflet-interactive path {
	pointer-events: visiblePainted; /* IE 9-10 doesn't have auto */
	pointer-events: auto;
	}

/* visual tweaks */

.leaflet-container {
	background: #ddd;
	outline-offset: 1px;
	}
.leaflet-container a {
	color: #0078A8;
	}
.leaflet-zoom-box {
	border: 2px dotted #38f;
	background: rgba(255,255,255,0.5);
	}


/* general typography */
.leaflet-container {
	font-family: "Helvetica Neue", Arial, Helvetica, sans-serif;
	font-size: 12px;
	font-size: 0.75rem;
	line-height: 1.5;
	}


/* general toolbar styles */

.leaflet-bar {
	box-shadow: 0 1px 5px rgba(0,0,0,0.65);
	border-radius: 4px;
	}
.leaflet-bar a {
	background-color: #fff;
	border-bottom: 1px solid #ccc;
	width: 26px;
	height: 26px;
	line-height: 26px;
	display: block;
	text-align: center;
	text-decoration: none;
	color: black;
	}
.leaflet-bar a,
.leaflet-control-layers-toggle {
	background-position: 50% 50%;
	background-repeat: no-repeat;
	display: block;
	}
.leaflet-bar a:hover,
.leaflet-bar a:focus {
	background-color: #f4f4f4;
	}
.leaflet-bar a:first-child {
	border-top-left-radius: 4px;
	border-top-right-radius: 4px;
	}
.leaflet-bar a:last-child {
	border-bottom-left-radius: 4px;
	border-bottom-right-radius: 4px;
	border-bottom: none;
	}
.leaflet-bar a.leaflet-disabled {
	cursor: default;
	background-color: #f4f4f4;
	color: #bbb;
	}

.leaflet-touch .leaflet-bar a {
	width: 30px;
	height: 30px;
	line-height: 30px;
	}
.leaflet-touch .leaflet-bar a:first-child {
	border-top-left-radius: 2px;
	border-top-right-radius: 2px;
	}
.leaflet-touch .leaflet-bar a:last-child {
	border-bottom-left-radius: 2px;
	border-bottom-right-radius: 2px;
	}

/* zoom control */

.leaflet-control-zoom-in,
.leaflet-control-zoom-out {
	font: bold 18px 'Lucida Console', Monaco, monospace;
	text-indent: 1px;
	}

.leaflet-touch .leaflet-control-zoom-in, .leaflet-touch .leaflet-control-zoom-out  {
	font-size: 22px;
	}


/* layers control */

.leaflet-control-layers {
	box-shadow: 0 1px 5px rgba(0,0,0,0.4);
	background: #fff;
	border-radius: 5px;
	}
.leaflet-control-layers-toggle {
	background-image: url(images/layers.png);
	width: 36px;
	height: 36px;
	}
.leaflet-retina .leaflet-control-layers-toggle {
	background-image: url(images/layers-2x.png);
	background-size: 26px 26px;
	}
.leaflet-touch .leaflet-control-layers-toggle {
	width: 44px;
	height: 44px;
	}
.leaflet-control-layers .leaflet-control-layers-list,
.leaflet-control-layers-expanded .leaflet-control-layers-toggle {
	display: none;
	}
.leaflet-control-layers-expanded .leaflet-control-layers-list {
	display: block;
	position: relative;
	}
.leaflet-control-layers-expanded {
	padding: 6px 10px 6px 6px;
	color: #333;
	background: #fff;
	}
.leaflet-control-layers-scrollbar {
	overflow-y: scroll;
	overflow-x: hidden;
	padding-right: 5px;
	}
.leaflet-control-layers-selector {
	margin-top: 2px;
	position: relative;
	top: 1px;
	}
.leaflet-control-layers label {
	display: block;
	font-size: 13px;
	font-size: 1.08333em;
	}
.leaflet-control-layers-separator {
	height: 0;
	border-top: 1px solid #ddd;
	margin: 5px -10px 5px -6px;
	}

/* Default icon URLs */
.leaflet-default-icon-path { /* used only in path-guessing heuristic, see L.Icon.Default */
	background-image: url(images/marker-icon.png);
	}


/* attribution and scale controls */

.leaflet-container .leaflet-control-attribution {
	background: #fff;
	background: rgba(255, 255, 255, 0.8);
	margin: 0;
	}
.leaflet-control-attribution,
.leaflet-control-scale-line {
	padding: 0 5px;
	color: #333;
	line-height: 1.4;
	}
.leaflet-control-attribution a {
	text-decoration: none;
	}
.leaflet-control-attribution a:hover,
.leaflet-control-attribution a:focus {
	text-decoration: underline;
	}
.leaflet-attribution-flag {
	display: inline !important;
	vertical-align: baseline !important;
	width: 1em;
	height: 0.6669em;
	}
.leaflet-left .leaflet-control-scale {
	margin-left: 5px;
	}
.leaflet-bottom .leaflet-control-scale {
	margin-bottom: 5px;
	}
.leaflet-control-scale-line {
	border: 2px solid #777;
	border-top: none;
	line-height: 1.1;
	padding: 2px 5px 1px;
	white-space: nowrap;
	-moz-box-sizing: border-box;
	     box-sizing: border-box;
	background: rgba(255, 255, 255, 0.8);
	text-shadow: 1px 1px #fff;
	}
.leaflet-control-scale-line:not(:first-child) {
	border-top: 2px solid #777;
	border-bottom: none;
	margin-top: -2px;
	}
.leaflet-control-scale-line:not(:first-child):not(:last-child) {
	border-bottom: 2px solid #777;
	}

.leaflet-touch .leaflet-control-attribution,
.leaflet-touch .leaflet-control-layers,
.leaflet-touch .leaflet-bar {
	box-shadow: none;
	}
.leaflet-touch .leaflet-control-layers,
.leaflet-touch .leaflet-bar {
	border: 2px solid rgba(0,0,0,0.2);
	background-clip: padding-box;
	}


/* popup */

.leaflet-popup {
	position: absolute;
	text-align: center;
	margin-bottom: 20px;
	}
.leaflet-popup-content-wrapper {
	padding: 1px;
	text-align: left;
	border-radius: 12px;
	}
.leaflet-popup-content {
	margin: 13px 24px 13px 20px;
	line-height: 1.3;
	font-size: 13px;
	font-size: 1.08333em;
	min-height: 1px;
	}
.leaflet-popup-content p {
	margin: 17px 0;
	margin: 1.3em 0;
	}
.leaflet-popup-tip-container {
	width: 40px;
	height: 20px;
	position: absolute;
	left: 50%;
	margin-top: -1px;
	margin-left: -20px;
	overflow: hidden;
	pointer-events: none;
	}
.leaflet-popup-tip {
	width: 17px;
	height: 17px;
	padding: 1px;

	margin: -10px auto 0;
	pointer-events: auto;

	-webkit-transform: rotate(45deg);
	   -moz-transform: rotate(45deg);
	    -ms-transform: rotate(45deg);
	        transform: rotate(45deg);
	}
.leaflet-popup-content-wrapper,
.leaflet-popup-tip {
	background: white;
	color: #333;
	box-shadow: 0 3px 14px rgba(0,0,0,0.4);
	}
.leaflet-container a.leaflet-popup-close-button {
	position: absolute;
	top: 0;
	right: 0;
	border: none;
	text-align: center;
	width: 24px;
	height: 24px;
	font: 16px/24px Tahoma, Verdana, sans-serif;
	color: #757575;
	text-decoration: none;
	background: transparent;
	}
.leaflet-container a.leaflet-popup-close-button:hover,
.leaflet-container a.leaflet-popup-close-button:focus {
	color: #585858;
	}
.leaflet-popup-scrolled {
	overflow: auto;
	}

.leaflet-oldie .leaflet-popup-content-wrapper {
	-ms-zoom: 1;
	}
.leaflet-oldie .leaflet-popup-tip {
	width: 24px;
	margin: 0 auto;

	-ms-filter: "progid:DXImageTransform.Microsoft.Matrix(M11=0.70710678, M12=0.70710678, M21=-0.70710678, M22=0.70710678)";
	filter: progid:DXImageTransform.Microsoft.Matrix(M11=0.70710678, M12=0.70710678, M21=-0.70710678, M22=0.70710678);
	}

.leaflet-oldie .leaflet-control-zoom,
.leaflet-oldie .leaflet-control-layers,
.leaflet-oldie .leaflet-popup-content-wrapper,
.leaflet-oldie .leaflet-popup-tip {
	border: 1px solid #999;
	}


/* div icon */

.leaflet-div-icon {
	background: #fff;
	border: 1px solid #666;
	}


/* Tooltip */
/* Base styles for the element that has a tooltip */
.leaflet-tooltip {
	position: absolute;
	padding: 6px;
	background-color: #fff;
	border: 1px solid #fff;
	border-radius: 3px;
	color: #222;
	white-space: nowrap;
	-webkit-user-select: none;
	-moz-user-select: none;
	-ms-user-select: none;
	user-select: none;
	pointer-events: none;
	box-shadow: 0 1px 3px rgba(0,0,0,0.4);
	}
.leaflet-tooltip.leaflet-interactive {
	cursor: pointer;
	pointer-events: auto;
	}
.leaflet-tooltip-top:before,
.leaflet-tooltip-bottom:before,
.leaflet-tooltip-left:before,
.leaflet-tooltip-right:before {
	position: absolute;
	pointer-events: none;
	border: 6px solid transparent;
	background: transparent;
	content: "";
	}

/* Directions */

.leaflet-tooltip-bottom {
	margin-top: 6px;
}
.leaflet-tooltip-top {
	margin-top: -6px;
}
.leaflet-tooltip-bottom:before,
.leaflet-tooltip-top:before {
	left: 50%;
	margin-left: -6px;
	}
.leaflet-tooltip-top:before {
	bottom: 0;
	margin-bottom: -12px;
	border-top-color: #fff;
	}
.leaflet-tooltip-bottom:before {
	top: 0;
	margin-top: -12px;
	margin-left: -6px;
	border-bottom-color: #fff;
	}
.leaflet-tooltip-left {
	margin-left: -6px;
}
.leaflet-tooltip-right {
	margin-left: 6px;
}
.leaflet-tooltip-left:before,
.leaflet-tooltip-right:before {
	top: 50%;
	margin-top: -6px;
	}
.leaflet-tooltip-left:before {
	right: 0;
	margin-right: -12px;
	border-left-color: #fff;
	}
.leaflet-tooltip-right:before {
	left: 0;
	margin-left: -12px;
	border-right-color: #fff;
	}

/* Printing */

@media print {
	/* Prevent printers from removing background-images of controls. */
	.leaflet-control {
		-webkit-print-color-adjust: exact;
		print-color-adjust: exact;
		}
	}
</style>
<script>/* @preserve
 * Leaflet 1.9.4, a JS library for interactive maps. https://leafletjs.com
 * (c) 2010-2023 Vladimir Agafonkin, (c) 2010-2011 CloudMade
 */
  /* ---- Leaflet 1.9.4, vendored inline: 144 KB, one minified line, omitted ---- */
</script>
<style>
  :root{
    --bg:#f4f6f9; --panel:#ffffff; --ink:#1f2733; --muted:#6b7683;
    --line:#e2e7ee; --brand:#2563eb; --brand-d:#1d4ed8; --ok:#16a34a;
    --warn:#d97706; --warn-bg:#fff7ed; --err:#dc2626; --err-bg:#fef2f2;
    --chip:#eef2f7; --shadow:0 1px 3px rgba(16,24,40,.08),0 1px 2px rgba(16,24,40,.04);
  }
  *{box-sizing:border-box}
  body{margin:0;font:14px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
    background:var(--bg);color:var(--ink)}
  header{background:var(--panel);border-bottom:1px solid var(--line);padding:12px 24px;
    display:flex;align-items:center;gap:14px;position:sticky;top:0;z-index:20}
  header h1{font-size:16px;margin:0;font-weight:700;letter-spacing:.2px}
  header .sub{color:var(--muted);font-size:12px}
  .tabs{display:flex;gap:4px;margin-left:auto}
  .tab{padding:7px 14px;border-radius:8px;cursor:pointer;color:var(--muted);font-weight:600;font-size:13px;border:1px solid transparent}
  .tab.active{background:var(--chip);color:var(--ink)}
  /* region switcher — each region is a fully separate workspace (own storage) */
  .regions{display:flex;gap:2px;padding:3px;background:var(--chip);border-radius:9px}
  .region{padding:5px 12px;border-radius:7px;cursor:pointer;font-weight:700;font-size:12px;color:var(--muted);letter-spacing:.04em}
  .region:hover{color:var(--ink)}
  .region.active{background:var(--panel);box-shadow:var(--shadow)}
  main{max-width:1680px;margin:0 auto;padding:22px 28px 80px}
  .card{background:var(--panel);border:1px solid var(--line);border-radius:12px;box-shadow:var(--shadow);padding:18px 22px;margin-bottom:16px}
  .card h2{margin:0 0 4px;font-size:15px}
  .card p.help{margin:0 0 16px;color:var(--muted);font-size:13px}
  button{font:inherit;cursor:pointer;border-radius:8px;border:1px solid var(--line);background:#fff;padding:8px 14px;font-weight:600;color:var(--ink)}
  button:hover{background:#f8fafc}
  button.primary{background:var(--brand);border-color:var(--brand);color:#fff}
  button.primary:hover{background:var(--brand-d)}
  button.primary:disabled{background:#9db6ef;border-color:#9db6ef;cursor:not-allowed}
  button.danger{color:var(--err);border-color:#f3c9c9}
  button.danger:hover{background:var(--err-bg)}
  button.small{padding:5px 10px;font-size:12px}
  .row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
  .drop{border:2px dashed var(--line);border-radius:12px;padding:34px;text-align:center;color:var(--muted);transition:.15s;background:#fbfcfe}
  .drop.drag{border-color:var(--brand);background:#eff4ff;color:var(--brand)}
  .drop b{color:var(--ink)}
  input[type=text],input[type=number],input[type=search]{font:inherit;padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:#fff;color:var(--ink);width:100%}
  input:focus{outline:2px solid #bfd3ff;border-color:var(--brand)}
  label.fld{display:block;font-size:12px;font-weight:600;color:var(--muted);margin:0 0 4px}
  table{border-collapse:collapse;width:100%;font-size:13px}
  th,td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--line);vertical-align:top}
  th{font-size:11px;text-transform:uppercase;letter-spacing:.4px;color:var(--muted);position:sticky;top:0;background:var(--panel);z-index:1}
  tr:hover td{background:#fafbfd}
  .tablewrap{max-height:640px;overflow:auto;border:1px solid var(--line);border-radius:10px}
  .chip{display:inline-block;background:var(--chip);border-radius:999px;padding:2px 9px;font-size:11px;margin:2px 3px 2px 0;color:#475467}
  .chip .x{cursor:pointer;color:#98a2b3;margin-left:4px;font-weight:700}
  .chip .x:hover{color:var(--err)}
  .pin{color:var(--muted);font-variant-numeric:tabular-nums;font-size:12px}
  .badge{font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px}
  .badge.sec{background:var(--chip);color:var(--muted);font-weight:600}
.badge.ok{background:#ecfdf3;color:var(--ok)}
  .badge.warn{background:var(--warn-bg);color:var(--warn)}
  .badge.err{background:var(--err-bg);color:var(--err)}
  .switch{position:relative;display:inline-block;width:38px;height:22px;cursor:pointer}
  .switch input{opacity:0;width:0;height:0;position:absolute}
  .switch .track{position:absolute;inset:0;background:#cbd5e1;border-radius:999px;transition:.15s}
  .switch .track:before{content:"";position:absolute;height:16px;width:16px;left:3px;top:3px;background:#fff;border-radius:50%;transition:.15s}
  .switch input:checked+.track{background:var(--ok)}
  .switch input:checked+.track:before{transform:translateX(16px)}
  #jobsTable{user-select:none}
  #jobsTable th.sortable{cursor:pointer;white-space:nowrap}
  #jobsTable th .arr{color:var(--brand);font-size:10px}
  #jobsTable tbody tr{cursor:pointer}
  #jobsTable tbody tr.sel td{background:#e8f0fe}
  #jobsTable tbody tr.sel:hover td{background:#dfe9fd}
  .stat{display:flex;gap:22px;flex-wrap:wrap;margin:4px 0 0}
  .stat div{font-size:12px;color:var(--muted)}
  .stat b{display:block;font-size:22px;color:var(--ink);font-weight:700;line-height:1.1}
  .toolbar{display:flex;gap:8px;align-items:center;margin-bottom:12px;flex-wrap:wrap}
  .toolbar .grow{flex:1;min-width:180px}
  .menu-wrap{position:relative}
  .menu{position:absolute;right:0;top:calc(100% + 4px);background:var(--panel);border:1px solid var(--line);border-radius:10px;
    box-shadow:0 8px 24px rgba(16,24,40,.14);display:none;flex-direction:column;min-width:160px;z-index:45;overflow:hidden;padding:4px}
  .menu.open{display:flex}
  .menu button{border:none;background:none;text-align:left;padding:8px 12px;font-weight:500;border-radius:6px}
  .menu button:hover{background:#f8fafc}
  .menu button.mdanger{color:var(--err)}
  .menu button.mdanger:hover{background:var(--err-bg)}
  .muted{color:var(--muted)}
  .hide{display:none}
  /* modal */
  .backdrop{position:fixed;inset:0;background:rgba(16,24,40,.45);display:flex;align-items:center;justify-content:center;z-index:50;padding:20px}
  .modal{background:var(--panel);border-radius:14px;max-width:640px;width:100%;max-height:86vh;overflow:auto;box-shadow:0 20px 40px rgba(16,24,40,.25)}
  .modal .mh{padding:18px 22px;border-bottom:1px solid var(--line)}
  .modal .mh h3{margin:0;font-size:16px}
  .modal .mb{padding:18px 22px}
  .modal .mf{padding:14px 22px;border-top:1px solid var(--line);display:flex;gap:10px;justify-content:flex-end;position:sticky;bottom:0;background:var(--panel);z-index:20}
  /* KMZ review card: info left, mini map right; isolate the map so Leaflet's
     internal z-indexes can't escape over the modal chrome */
  .kz-grid{display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:12px;align-items:stretch}
  .kz-mini{height:150px;border:1px solid var(--line);border-radius:8px;background:#eaeaed;display:flex;align-items:center;justify-content:center;
    color:var(--muted);font-size:12px;position:relative;z-index:0;isolation:isolate;overflow:hidden}
  @media(max-width:640px){.kz-grid{grid-template-columns:1fr}.kz-mini{height:160px}}
  .unmatched{border:1px solid var(--warn-bg);border-left:3px solid var(--warn);border-radius:8px;padding:12px;margin-bottom:10px;background:#fffdf8}
  .unmatched .nm{font-weight:700;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:13px}
  .unmatched .cnt{color:var(--muted);font-size:12px}
  .grid3{display:grid;grid-template-columns:1fr 1fr auto;gap:8px;align-items:end;margin-top:8px}
  .note{font-size:12px;padding:10px 12px;border-radius:8px;background:#eff4ff;color:#334e9e;border:1px solid #d7e3ff}
  /* dispatch-style chips for the import job table */
  .job-status{display:inline-block;font-size:10px;text-transform:uppercase;font-weight:600;border-radius:3px;padding:1px 6px;border:1px solid rgba(107,114,128,.4);color:#475467;background:rgba(154,163,175,.1)}
  .job-status-cff{color:#ca8a04;background:rgba(202,138,4,.13);border-color:rgba(202,138,4,.4)}
  .job-status-if{color:#0891b2;background:rgba(8,145,178,.12);border-color:rgba(8,145,178,.4)}
  .job-status-fv{color:#16a34a;background:rgba(22,163,74,.12);border-color:rgba(22,163,74,.4)}
  .job-status-fe{color:#6b7280;background:rgba(107,114,128,.1);border-color:rgba(107,114,128,.4)}
  .task-badge{display:inline-block;font-size:9.5px;font-weight:700;border-radius:3px;padding:1px 6px;border:1px solid;white-space:nowrap}
  .rush-badge{display:inline-block;font-size:9.5px;font-weight:700;border-radius:3px;padding:1px 7px;background:var(--err);color:#fff;animation:rushPulse 1.6s ease-in-out infinite}
  @keyframes rushPulse{0%,100%{opacity:1}50%{opacity:.55}}
  .due-late{color:var(--err);font-weight:700}
  .due-soon{color:#d97706;font-weight:600}
  /* welcome card */
  .wgreet{font-size:17px;font-weight:700;margin-bottom:14px}
  .wsteps{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
  @media(max-width:760px){.wsteps{grid-template-columns:1fr}}
  .wstep{display:flex;gap:10px;align-items:flex-start;font-size:12.5px;line-height:1.5;color:var(--ink);
    background:#f8fafc;border:1px solid var(--line);border-radius:10px;padding:12px}
  .wnum{flex:0 0 22px;height:22px;border-radius:50%;background:var(--brand);color:#fff;font-size:12px;font-weight:700;
    display:inline-flex;align-items:center;justify-content:center;margin-top:1px}
  .toast{position:fixed;bottom:22px;left:50%;transform:translateX(-50%);background:#111827;color:#fff;padding:11px 18px;border-radius:10px;font-size:13px;box-shadow:0 8px 24px rgba(0,0,0,.25);z-index:80;opacity:0;transition:.2s}
  .toast.show{opacity:1}
  .toast.warn{background:#b45309}
  .toast.err{background:#b91c1c}
  footer{color:var(--muted);font-size:12px;text-align:center;padding:20px}
  .split{display:grid;grid-template-columns:1fr 1fr;gap:18px}
  @media(max-width:760px){.split{grid-template-columns:1fr}}
  /* ---- subs library grid (dispatch-style) ---- */
  .subs-grid-head{display:grid;grid-template-columns:26px 1.6fr 1fr 1.6fr 150px 2fr 96px;gap:10px;align-items:center;
    padding:6px 12px;background:#f8fafc;border:1px solid var(--line);border-radius:8px;font-size:10px;color:var(--muted);
    text-transform:uppercase;letter-spacing:.08em;font-weight:600;margin-bottom:6px}
  .sub-card2{display:grid;grid-template-columns:26px 1.6fr 1fr 1.6fr 150px 2fr 96px;gap:10px;align-items:center;
    background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:7px 12px;margin-bottom:5px;font-size:13px;
    box-shadow:var(--shadow);transition:border-color .08s}
  .sub-card2:hover{border-color:#c3ccd8}
  .sub-card2 input[type=text]{padding:5px 8px;font-size:12.5px}
  .dot{width:9px;height:9px;border-radius:50%;display:inline-block}
  .dot-green{background:var(--ok)} .dot-amber{background:var(--warn)}
  .geo-cell{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:600;cursor:pointer;
    font-variant-numeric:tabular-nums;border-radius:6px;padding:3px 6px}
  .geo-cell.ok{color:var(--ok)} .geo-cell.no{color:var(--warn)}
  .geo-cell:hover{background:var(--chip)}
  .alias-wrap{display:flex;flex-wrap:wrap;gap:4px;align-items:center;min-height:24px}
  .alias-chip{display:inline-flex;align-items:center;gap:4px;background:#eef6ff;color:#2563eb;font-size:10.5px;
    padding:2px 4px 2px 8px;border-radius:10px;font-weight:500;max-width:190px}
  .alias-chip span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .alias-chip button{background:transparent;border:none;color:#2563eb;cursor:pointer;padding:0 3px;opacity:.6;font-size:12px;line-height:1}
  .alias-chip button:hover{opacity:1;color:var(--err)}
  .alias-add{display:inline-flex;align-items:center;background:transparent;border:1px dashed #c3ccd8;color:var(--muted);
    font-size:10.5px;padding:2px 8px;border-radius:10px;cursor:pointer}
  .alias-add:hover{border-color:var(--brand);color:var(--brand)}
  .alias-input{border:1px solid var(--brand);border-radius:10px;padding:2px 8px;font-size:10.5px;min-width:120px;outline:none}
  .sub-actions2{display:flex;gap:4px;justify-content:flex-end}
  .icon-btn{border:1px solid var(--line);background:var(--panel);border-radius:6px;width:26px;height:26px;display:inline-flex;
    align-items:center;justify-content:center;cursor:pointer;font-size:13px;padding:0;color:#475467}
  .icon-btn:hover{border-color:var(--brand);color:var(--brand);background:#f8fafc}
  .icon-btn.danger:hover{border-color:var(--err);color:var(--err);background:var(--err-bg)}
  .sub-folder{display:flex;align-items:center;gap:9px;background:#f1f5f9;border:1px solid var(--line);border-radius:8px;
    padding:8px 12px;margin-bottom:5px;cursor:pointer;font-size:13px;user-select:none}
  .sub-folder:hover{border-color:var(--brand)}
  .sub-folder.open{background:var(--chip)}
  .sub-folder .fchev{color:var(--muted);font-size:11px;width:10px}
  .sub-card2.nested{margin-left:22px;border-left:3px solid var(--chip)}
  #subsMapWrap{height:66vh;min-height:480px;border:1px solid var(--line);border-radius:10px;overflow:hidden;background:#eaeaed}
  /* ---- sub review cards (fuzzy import resolution) ---- */
  .review-card{background:var(--panel);border:1px solid var(--line);border-left:3px solid var(--warn);border-radius:8px;
    padding:12px;margin-bottom:10px;font-size:13px}
  .review-card.done{border-left-color:var(--ok);background:#f6fef9}
  .review-head{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:8px}
  .review-head .raw{font-weight:700;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:13px}
  .review-head .meta{color:var(--muted);font-size:11.5px}
  .review-label{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.07em;font-weight:700;margin:8px 0 4px}
  .review-sug{display:flex;align-items:center;gap:8px;padding:3px 0}
  .review-sug .name{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .review-sug .score{color:var(--muted);font-size:10.5px;background:var(--chip);border-radius:10px;padding:1px 7px;font-variant-numeric:tabular-nums}
  .review-sug .btns{margin-left:auto;display:flex;gap:5px;flex-shrink:0}
  .sub-picker{position:relative}
  .sub-picker-list{position:absolute;left:0;right:0;top:100%;margin-top:2px;background:var(--panel);border:1px solid #c3ccd8;
    border-radius:8px;box-shadow:0 8px 24px rgba(16,24,40,.18);max-height:210px;overflow-y:auto;z-index:60;display:none}
  .sub-picker-list.open{display:block}
  .sub-picker-item{padding:6px 10px;font-size:12.5px;cursor:pointer;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:8px}
  .sub-picker-item:last-child{border-bottom:none}
  .sub-picker-item.active,.sub-picker-item:hover{background:#eef6ff;color:var(--brand)}
  .sub-picker-item .nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .sub-picker-alias{flex:none;font-size:10px;padding:2px 7px;border:1px solid var(--line);border-radius:4px;background:#f8fafc;color:#475467;cursor:pointer;font-weight:600}
  .sub-picker-alias:hover{background:var(--brand);color:#fff;border-color:var(--brand)}
  .sub-picker-empty{padding:8px 10px;font-size:11.5px;color:var(--muted);font-style:italic}
  .review-create{display:grid;grid-template-columns:2fr 1fr 1fr auto;gap:6px;align-items:center}
  @media(max-width:760px){.review-create{grid-template-columns:1fr}}
</style>
</head>
<body>
<header>
  <div>
    <h1>Route4Me Workaround</h1>
    <div class="sub"><span id="appVer"></span></div>
  </div>
  <nav class="regions" id="regionBar" title="Each region keeps its own subs, crews, imports and settings — nothing crosses"></nav>
  <button class="small" id="toastLogBtn" title="recent messages" style="margin-left:auto">Log</button>
  <nav class="tabs" style="margin-left:0">
    <div class="tab active" data-tab="dispatch">Dispatch</div>
    <div class="tab" data-tab="crews">Crews</div>
    <div class="tab" data-tab="subs">Subs</div>
    <div class="tab" data-tab="settings">Settings</div>
  </nav>
</header>

<main>
  <!-- ================= CONVERT ================= -->
  <section id="tab-convert">
    <div class="card" id="welcomeCard">
      <div class="wgreet">How it works</div>
      <div class="wsteps">
        <div class="wstep"><span class="wnum">1</span><div><b>Drop the Sage export</b><br>
          The jobs appear below — trim what&rsquo;s not going out, and the priority matrix, aliases and colors apply themselves.</div></div>
        <div class="wstep"><span class="wnum">2</span><div><b>Build &amp; upload to Route4Me</b><br>
          Import the file as <i>orders</i>, pick the day, and schedule by territory. Duplicates are pre-numbered, RUSH is pre-flagged.</div></div>
        <div class="wstep"><span class="wnum">3</span><div><b>Bring the routes back</b><br>
          Drop the Route4Me export(s) in the right-hand box — you get the Sage import plus the CFF calc requests, ready to send.</div></div>
      </div>
      <p class="muted" style="margin:14px 2px 0;font-size:12px">Region tabs up top keep FL · HOU · DFW · ASA fully separate.
      The subdivision library and crews live in <b>Settings</b>.</p>
    </div>
    <div class="split">
      <div class="card">
        <h2>Send out &mdash; Sage export (file01)</h2>
        <div id="drop" class="drop">
          <p style="margin:0 0 8px"><b>Drag &amp; drop</b> the Sage CSV here, or</p>
          <button class="primary" id="pickBtn">Choose file&hellip;</button>
          <input type="file" id="file" accept=".csv,text/csv" class="hide">
          <p id="fileName" class="muted" style="margin:12px 0 0"></p>
        </div>
      </div>
      <div class="card" style="margin-bottom:18px">
        <h2>Bring back &mdash; Route4Me export (file03)</h2>
        <label class="fld">Paired Sage export (file01)</label>
        <div id="f1box" class="note" style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:14px">
          <span id="f1status">No file01 loaded yet.</span>
          <span><button class="small" id="f1pickBtn">Use a different file01&hellip;</button>
          <input type="file" id="f1file" accept=".csv,text/csv" class="hide"></span>
        </div>
        <div id="drop3" class="drop">
          <p style="margin:0 0 8px"><b>Drag &amp; drop</b> the Route4Me export(s) here &mdash; several merge into one &mdash; or</p>
          <button class="primary" id="pick3Btn">Choose file(s)&hellip;</button>
          <input type="file" id="file3" accept=".csv,text/csv" multiple class="hide">
          <p id="file3Name" class="muted" style="margin:12px 0 0"></p>
        </div>
        <div id="bringResult" class="row hide" style="margin-top:14px;align-items:center;gap:10px;flex-wrap:wrap">
          <button class="primary" id="download4Btn">Download Sage import (file04)</button>
          <button id="cffBtn" class="hide">CFF</button>
          <span class="muted" id="bringSummary" style="font-size:12.5px"></span>
        </div>
      </div>
    </div>

    <div class="card hide" id="trimCard">
      <h2>Review &amp; trim</h2>
      <div id="trimWarn" class="hide" style="margin-bottom:14px"></div>
      <div class="toolbar">
        <button class="small danger" id="removeSelBtn">Remove selected (0)</button>
        <button class="small" id="restoreBtn">Restore removed</button>
        <button class="small" id="winBtn" title="give the selected jobs a time of day they have to happen in">&#9200; Time window&hellip;</button>
        <span class="muted grow" id="trimCount"></span>
        <label class="muted" style="font-size:12px;display:flex;align-items:center;gap:6px" title="Adds a &ldquo;Scheduled For&rdquo; column with this date on every job — Route4Me auto-schedules the orders for that day. Clear it to leave the column out. Sage's own Schedule_Date is untouched.">
          Schedule for <input type="date" id="schedFor" style="padding:5px 8px;font:inherit;font-size:12.5px;border:1px solid var(--line);border-radius:8px"></label>
        <button class="small" id="prioBtn" title="task service times and priority live in Settings → Tasks">Tasks&hellip;</button>
        <button class="small" id="colsBtn" title="choose which columns go to Route4Me (core: Alias, Lat, Long, Svc Job Num)">Columns&hellip;</button>
        <label class="muted" style="font-size:12px;display:flex;align-items:center;gap:6px"
          title="On: append each working crew's start as a Depot row, for the one-upload depot run (Option 2). Off: no depots — for territories, which set their own starts.">
          <input type="checkbox" id="depotToggle"> Crew depots</label>
        <button class="small" id="crewMapBtn" title="see which crew each job would fall to, and drag starts to change it">&#128506; Crew map</button>
        <button class="primary" id="genBtn">Build Route4Me file &rarr;</button>
      </div>
      <div class="tablewrap" id="jobsTableWrap" style="max-height:62vh">
        <table id="jobsTable" title="Click a header to sort · Shift+click selects a range · Ctrl/Cmd+click toggles">
          <thead><tr id="jobsHead"></tr></thead>
          <tbody id="jobsBody"></tbody>
        </table>
      </div>
      <div id="crewMapPanel" class="hide">
        <div class="note" style="margin-bottom:10px">
          <b>Option 2 — depots.</b> One upload with every crew's home as a depot; Route4Me assigns the jobs.
          This is our estimate of that assignment, so you can drag a start and see who picks up what
          <b>before</b> you upload. Route4Me makes the final call &mdash; check it against file03 when it comes back.
        </div>
        <div class="toolbar" style="margin-bottom:10px">
          <label class="muted" style="font-size:12px;display:flex;align-items:center;gap:6px"
            title="Route4Me's max stops per route. Leave blank to let it assign freely — which is how a crew ends up with nothing.">
            Max stops per crew <input type="number" min="1" id="cmCap" style="width:80px;padding:5px 8px;font:inherit;font-size:12.5px;border:1px solid var(--line);border-radius:8px"></label>
          <span class="muted grow" id="cmSummary"></span>
          <button class="small" id="cmReset">Reset starts</button>
          <button class="small primary" id="cmSave">Save moved starts</button>
        </div>
        <div style="display:flex;gap:14px;align-items:flex-start;flex-wrap:wrap">
          <div id="crewMapWrap" style="flex:1 1 520px;min-width:320px;height:60vh;border:1px solid var(--line);border-radius:10px"></div>
          <div style="flex:0 1 320px;min-width:260px">
            <div class="tablewrap" style="max-height:60vh">
              <table><thead><tr><th>Crew</th><th style="width:60px">Jobs</th><th style="width:70px">Avg mi</th></tr></thead>
              <tbody id="cmCrewBody"></tbody></table>
            </div>
          </div>
        </div>
      </div>
    </div>

  </section>

  <!-- ================= BRING BACK result (file03 -> file04) ================= -->
  <section id="tab-bring">
  </section>

  <!-- ================= SUBDIVISIONS ================= -->
  <section id="tab-settings" class="hide">
    <div class="card">
      <h2>Tasks</h2>
      <div class="muted" style="font-size:12.5px;margin:-4px 0 12px">One row per Sage task name, exactly as it is spelled in
        <b>Description Of Problem</b>. Each carries how long it takes on site and how its priority behaves.
        A task with no row here gets a blank Priority &mdash; Sage&rsquo;s own numbers are never passed through.</div>
      <div id="taskUnmapped"></div>
      <div class="tablewrap" style="max-height:56vh">
        <table id="taskTable">
          <thead><tr>
            <th>Task (as Sage spells it)</th>
            <th style="width:78px" title="minutes the crew spends on site — becomes Route4Me's service time">On site</th>
            <th colspan="4" style="text-align:center">Due clock &mdash; how close to the route day</th>
            <th colspan="4" style="text-align:center">Received clock &mdash; how old the job is</th>
            <th style="width:34px"></th>
          </tr><tr id="taskSubHead"></tr></thead>
          <tbody id="taskBody"></tbody>
        </table>
      </div>
      <div class="row" style="margin-top:10px;gap:8px;align-items:center;flex-wrap:wrap">
        <input type="text" id="taskNew" placeholder="Add a task name&hellip;" style="flex:1;min-width:200px">
        <button class="primary small" id="taskAdd">Add</button>
        <button class="small" id="taskReset" style="margin-left:auto">Reset to standard</button>
      </div>
      <p class="muted" id="taskCount" style="margin:10px 2px 0"></p>
    </div>
    <div class="card">
      <h2>Priority</h2>
      <div class="muted" style="font-size:12.5px;margin:-4px 0 12px">Lower is hotter. A job takes the <b>hottest</b> value its dates
        reach on either clock above. A letter arriving in Sage&rsquo;s Priority column overrides both.</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center" id="codeWrap"></div>
      <div class="row" style="margin-top:10px;gap:8px;align-items:center">
        <input type="text" id="pmCodeK" placeholder="code" maxlength="3" style="width:70px">
        <input type="number" id="pmCodeV" placeholder="priority" style="width:100px">
        <button class="small" id="pmCodeAdd">Add code</button>
      </div>
      <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--line)">
        <div class="muted" style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;font-weight:600;margin-bottom:6px">Colour ladder</div>
        <div id="prioLadder" style="display:flex;gap:0;border-radius:8px;overflow:hidden;max-width:520px"></div>
        <div class="muted" style="font-size:11px;margin-top:5px">The Color column Route4Me pins each stop with, hottest to coolest.</div>
      </div>
    </div>
    <div class="card">
      <h2>Import</h2>
      <div class="row" style="align-items:center;gap:12px;flex-wrap:wrap">
        <button class="primary" id="importAllBtn">&#8681; Import anything&hellip;</button>
        <span class="muted" style="font-size:12.5px">Setup files, manager spreadsheets, Geotab zone exports, KMZ/KML site plans, or a whole folder &mdash;
        the tool works out what each file is.</span>
      </div>
      <div id="kmzStatus" class="note hide" style="margin-top:12px"></div>
      <div class="row" style="align-items:center;gap:12px;margin-top:14px">
        <button class="small" id="storageBtn">Storage&hellip;</button>
        <span class="muted" id="storageLine" style="font-size:12.5px">Checking browser storage&hellip;</span>
      </div>
    </div>
  </section>

  <section id="tab-crews" class="hide">
    <div class="card">
      <h2>Crews</h2>
      <div class="toolbar">
        <input type="search" class="grow" id="crewSearch" placeholder="Filter&hellip;">
        <button class="primary small" id="addCrewBtn">+ Add</button>
        <input type="file" id="crewsXlsFile" accept=".xlsx,.csv" class="hide">
        <div class="menu-wrap">
          <button class="small" id="crewsMenuBtn" title="more">&#8943;</button>
          <div class="menu" id="crewsMenu">
            <button id="exportCrews">Export JSON</button>
            <button class="mdanger" id="resetCrews">Reset to seed</button>
          </div>
        </div>
        <input type="file" id="importCrews" accept=".json" class="hide">
      </div>
      <div class="tablewrap">
        <table>
          <thead><tr><th style="width:52px">On</th><th>Crew</th><th style="width:90px">Servicer Id</th><th style="width:170px">Home Lat / Long</th><th style="width:90px"></th></tr></thead>
          <tbody id="crewBody"></tbody>
        </table>
      </div>
      <p class="muted" id="crewCount" style="margin:10px 2px 0"></p>
    </div>
  </section>
  <section id="tab-subs" class="hide">
    <div class="card">
      <h2>Subdivisions</h2>
      <div class="toolbar">
        <input type="search" class="grow" id="subSearch" placeholder="Filter&hellip;">
        <button class="small" id="subsMapBtn">&#128205; Map</button>
        <button class="small" id="subsSortBtn" title="toggle list order: alphabetical or grouped by geography">Sort: A&ndash;Z</button>
        <button class="small" id="subsFoldBtn" title="group phases and sections of one subdivision under a folder">Folders</button>
        <button class="primary small" id="addSubBtn">+ Add</button>
        <input type="file" id="zonesFile" accept=".xlsx,.csv" class="hide">
        <div class="menu-wrap">
          <button class="small" id="subsMenuBtn" title="more">&#8943;</button>
          <div class="menu" id="subsMenu">
            <button id="exportSubs">Export JSON</button>
            <button class="mdanger" id="resetSubs">Reset to seed</button>
          </div>
        </div>
        <input type="file" id="importSubs" accept=".json" class="hide">
      </div>
      <div id="subsListWrap">
        <div class="subs-grid-head" id="subsGridHead"></div>
        <div id="subsList" style="max-height:64vh;overflow-y:auto"></div>
      </div>
      <div id="subsMapWrap" class="hide"></div>
      <p class="muted" id="subCount" style="margin:10px 2px 0"></p>
    </div>
  </section>
</main>

<div id="modalRoot"></div>
<div id="modalRoot2"></div>
<div id="toast" class="toast"></div>

<script>
```

---

## Script

### SEED DATA

```js
/* ============================ SEED DATA ============================ */
const SUBS_SEED = [{"name":"Atla Key","address":"(pin drop only)","lat":26.79539,"lng":-81.704087,"aliases":[]},{"name":"Avalon Lake Townhomes","address":"(pin drop only)","lat":28.510332,"lng":-81.157184,"aliases":[]},{"name":"Babcock Ranch Community (Sanctuary)","address":"44848 Callisia Court","lat":26.797585,"lng":-81.723735,"aliases":["Babcock Ranch Community ("]},{"name":"Benton Hills","address":"31323 Albarino Dr, Brooksville, FL 34602","lat":28.483553,"lng":-82.226273,"aliases":[]},{"name":"Berry Bay","address":"(pin drop only)","lat":27.673494,"lng":-82.34718,"aliases":[]},{"name":"Bloomingdale Townes","address":"1054 Golden Willow Ct, Brandon, FL 33511","lat":27.897603,"lng":-82.265629,"aliases":[]},{"name":"Brighton/Jacaranda","address":"9544 Vibrant Ln, Venice, FL 34292","lat":27.089331,"lng":-82.387711,"aliases":["Brighton-Jacaranda"]},{"name":"Bronsons Ridge","address":"1812 rider rain ln, apopka, fl 32703","lat":28.66121,"lng":-81.537856,"aliases":[]},{"name":"Cassata Lakes","address":"(pin drop only)","lat":27.14327,"lng":-82.42731,"aliases":[]},{"name":"Central Parc","address":"(pin drop only)","lat":27.048673,"lng":-82.222496,"aliases":[]},{"name":"Congdon Townhomes (Grove","address":"(pin drop only)","lat":28.124466,"lng":-81.593193,"aliases":[]},{"name":"Copperleaf","address":"10555 SW 76th Ct, Ocala, FL 34476","lat":29.068921,"lng":-82.248447,"aliases":[]},{"name":"Creekside at Rutland Ranch","address":"6515 tortoise trl, parrish, fl 34219","lat":27.571835,"lng":-82.382179,"aliases":["Creekside At Rutland Ranc"]},{"name":"Cresswind at Lake Harris","address":"(pin drop only)","lat":28.790011,"lng":-81.774676,"aliases":[]},{"name":"Cresswind Jax","address":"(pin drop only)","lat":29.43104,"lng":-81.15579,"aliases":["Cresswind"]},{"name":"Crosswind Ranch","address":"13037 Pierce St, Parrish, FL 34219, USA","lat":27.595899,"lng":-82.410901,"aliases":[]},{"name":"Crosswinds East","address":"4350 riverbend blvd, haines city, fl 33844","lat":28.122548,"lng":-81.584936,"aliases":[]},{"name":"Crystal Lake Preserve","address":"311 Biltmore Blvd, Dundee, FL 33838","lat":28.026937,"lng":-81.635874,"aliases":[]},{"name":"EA McKinnon Groves","address":"(pin drop only)","lat":28.508966,"lng":-81.662882,"aliases":["EA-McKinnon Groves","EA McKinnon Grove"]},{"name":"Edgewater Cross Prairie","address":"5094 loyalty dr, st cloud, fl 34772","lat":28.218153,"lng":-81.335569,"aliases":[]},{"name":"Esplanade at Center Lake Ranch","address":"5292 Goldfinch Dr, St Cloud, FL 34771","lat":28.280765,"lng":-81.222724,"aliases":["Esplanade at Center Lake"]},{"name":"Founders Corner (Waterlin","address":"(pin drop only)","lat":28.154544,"lng":-81.273941,"aliases":[]},{"name":"Garden Hill at Providence","address":"5148 bridgehaven rd, fl 33837","lat":28.190841,"lng":-81.547661,"aliases":[]},{"name":"Gum Lake Preserve","address":"3314 Chinotto Drive","lat":28.12373,"lng":-81.730394,"aliases":[]},{"name":"Hamilton Bluff","address":"1528 redwood ln, haines city, fl 33844","lat":28.049394,"lng":-81.613997,"aliases":["Hamilton Bluff Subdivision","Hamilton Bluff Subdivisio"]},{"name":"Heritage Station","address":"25584 Calusa Dr, Punta Gorda, FL 33955","lat":26.936444,"lng":-82.044431,"aliases":[]},{"name":"Hidden Ridge at Estate","address":"929 tundra lp, groveland, fl 34736","lat":28.60532,"lng":-81.802779,"aliases":[]},{"name":"Hidden Ridge at Estates at Cherry Lake","address":"929 Tundra Lp, Groveland, FL 34736","lat":28.60532,"lng":-81.802779,"aliases":["Hidden Ridge at Estates a"]},{"name":"Hillcrest East","address":"(pin drop only)","lat":28.329297,"lng":-82.357896,"aliases":[]},{"name":"Hills of Montverde","address":"Serenity wy, fl 34756","lat":28.585986,"lng":-81.705044,"aliases":["Hills of Monteverde"]},{"name":"K-Bar Ranch Homestead (Mo","address":"(pin drop only)","lat":28.157169,"lng":-82.271849,"aliases":[]},{"name":"Kentucky Square","address":"(pin drop only)","lat":28.757126,"lng":-81.226236,"aliases":[]},{"name":"Kings Gate","address":"(pin drop only)","lat":27.007797,"lng":-82.04718,"aliases":[]},{"name":"Landings at Pecan Park","address":"14591 Macadamia Ln, Jacksonville, FL 32218","lat":30.504495,"lng":-81.627032,"aliases":[]},{"name":"Laureate Park","address":"9176 sinatra ln orlando fl 32827","lat":28.350933,"lng":-81.256177,"aliases":[]},{"name":"Laurel Preserve","address":"(pin drop only)","lat":30.801581,"lng":-81.608186,"aliases":[]},{"name":"Leala Reserve","address":"2603 Priya Drive, Tavares, FL 32778","lat":28.76691,"lng":-81.755603,"aliases":["Leela Reserve"]},{"name":"Liberty Trace","address":"(pin drop only)","lat":28.106857,"lng":-81.596948,"aliases":[]},{"name":"Lochside","address":"19337 lochside ln, mt dora, fl 32757","lat":28.82423,"lng":-81.63696,"aliases":[]},{"name":"Magnolia Bay North","address":"205 Holly Bank Ave, Nokomis, FL 34275","lat":27.163068,"lng":-82.425181,"aliases":[]},{"name":"Magnolia Bay South","address":"205 Holly Bank Ave, Nokomis, FL 34275","lat":27.156824,"lng":-82.417018,"aliases":[]},{"name":"Mandarin Grove","address":"(pin drop only)","lat":27.614976,"lng":-82.526656,"aliases":[]},{"name":"Meadow Pointe at Esta","address":"929 tundra lp, groveland, fl 34736","lat":28.60532,"lng":-81.802779,"aliases":["Meadow Pointe & Hidden Rd"]},{"name":"Meadow Pointe at Estates at Cherry Lake","address":"929 Tundra Lp, Groveland, FL 34736, USA","lat":28.60532,"lng":-81.802779,"aliases":["Meadow Pointe at Estates"]},{"name":"Northshore","address":"100 Longshore Dr, Kingsland, GA 31548","lat":30.808358,"lng":-81.782039,"aliases":[]},{"name":"Oak Hammock Reserve","address":"1363 Blue Ash Ln, DeLand, FL 32720","lat":29.004912,"lng":-81.327861,"aliases":[]},{"name":"Palm Grove at Lakewood Ranch","address":"2013 COCONUT PALM Cv, Bradenton, FL 34212","lat":27.478866,"lng":-82.358128,"aliases":["Palm Grove at Lakewood Ranch Subdivision","Palm Grove at Lakewood Ra"]},{"name":"Palmera At Wellen Park","address":"18477 Foxtail Lp, Venice, FL 34293","lat":27.019319,"lng":-82.329395,"aliases":["Palmera Townhomes at Well"]},{"name":"Palms (Venetian Bay)","address":"112 Venetian Palms Blvd, New Smyrna Beach, FL 32168","lat":29.02637,"lng":-81.023055,"aliases":[]},{"name":"Palms at West Port","address":"1433 Remington Trce Dr, Port Charlotte, FL 33953","lat":27.000063,"lng":-82.186393,"aliases":[]},{"name":"Parkside Townhomes","address":"1531 Tristar Dr, Plant City, FL 33563","lat":28.014906,"lng":-82.107045,"aliases":[]},{"name":"Parkview at Hamlin","address":"15501 Hamlin Pk Dr, Winter Garden, FL 34787","lat":28.476191,"lng":-81.618014,"aliases":[]},{"name":"Parrish Lakes","address":"sawgrass rd parrish fl 34219","lat":27.586489,"lng":-82.464395,"aliases":["Parish Lakes [Searle]","Parish Lakes [Seairie]","Parrish Lakes [Seaitle]","Parish Lakes (Searle)","Parrish Lakes (Seairie)","Parrish Lakes (Searle)","Parrish Lakes (Seaire)"]},{"name":"Pepper Grove","address":"3459 canberra pl, palmetto, fl 34221","lat":27.546204,"lng":-82.530664,"aliases":["Pepper Grove (f.k.a. Paddocks)","Pepper Grove (f.k.a. Padd"]},{"name":"Pine Grove Reserve","address":"(pin drop only)","lat":28.253289,"lng":-81.196976,"aliases":[]},{"name":"Plat of Subdivision SurveyEsplanade at St. Marys","address":"251 Grandview Drive, St Marys, GA 31558","lat":30.779394,"lng":-81.616158,"aliases":["Plat of Subdivision Survey(Esplanade at St. Marys)","Plat of Subdivision Surve"]},{"name":"Poitras N-4 West","address":"(pin drop only)","lat":28.35655,"lng":-81.262412,"aliases":[]},{"name":"Riverbank Place","address":"3682 Arbordale Lp, Sanford, FL 32771","lat":28.806127,"lng":-81.226816,"aliases":[]},{"name":"Riverstone","address":"20195 Azul Marble, Land O' Lakes, FL 34638","lat":28.203252,"lng":-82.482822,"aliases":[]},{"name":"Rivington","address":"639 terrapin dr, debary, fl 32713","lat":28.855197,"lng":-81.342132,"aliases":[]},{"name":"Saddlestone at Star Farms Lakewood Ranch","address":"17943 Cropside Trl, Lakewood Ranch, FL 34211","lat":27.464526,"lng":-82.354918,"aliases":["Saddlestone at Star Farms"]},{"name":"Sanderling","address":"1639 Soaring Vida St, Palmetto, FL 34221","lat":27.564886,"lng":-82.547048,"aliases":[]},{"name":"Sandhill Preserve","address":"5601 Dease Road","lat":28.32287,"lng":-81.204667,"aliases":[]},{"name":"Sandpiper Pointe","address":"(pin drop only)","lat":26.952897,"lng":-82.340878,"aliases":[]},{"name":"Seminole Palms","address":"35 Enclave Ave, Palm Coast, FL 32164","lat":29.453207,"lng":-81.202959,"aliases":[]},{"name":"Seminole Palms Townhomes","address":"42 Alexander Lane, palm coast, fl 32164","lat":29.450891,"lng":-81.184391,"aliases":[]},{"name":"Shearwater","address":"32 Buffalo Ct, St. Augustine, FL 32092","lat":29.916846,"lng":-81.541755,"aliases":[]},{"name":"Shoreline Ranch","address":"(pin drop only)","lat":28.912564,"lng":-81.617563,"aliases":[]},{"name":"Skye Ranch","address":"8208 Summer Night Rd, Sarasota, FL 34241, USA","lat":27.240884,"lng":-82.402261,"aliases":["Skye Ranch Neighborhood","LT Ranch Neighborhood One"]},{"name":"Sorrento Pines","address":"(pin drop only)","lat":28.835565,"lng":-81.563712,"aliases":[]},{"name":"Southern Hills Plantation","address":"4951 Summit View Dr, Brooksville, FL 34601","lat":28.507977,"lng":-82.402231,"aliases":[]},{"name":"Star Farms","address":"16921 Barnwood Pl, Lakewood Ranch, FL 34211","lat":27.467033,"lng":-82.367552,"aliases":[]},{"name":"Stillwater at Lakewood Ranch","address":"5637 Lightning Whelk Ln, Lakewood Ranch, FL 34211","lat":27.440941,"lng":-82.350128,"aliases":["Stillwater at Lakewood Ra"]},{"name":"Sunstone Village","address":"Starbright path, venice, fl 34293","lat":27.025859,"lng":-82.317625,"aliases":["Sunstone Village (Lakeside)","Sunstone Village [Lakeside]","Sunstone Village (Lakesid"]},{"name":"The Villas at Camden","address":"100 the villas wy, kingsland, GA 31548","lat":30.78413,"lng":-81.628176,"aliases":[]},{"name":"The Villas at Camden Woods","address":"205 Collin Nicholas Dr, Kingsland, GA 31548","lat":30.785467,"lng":-81.62521,"aliases":["The Villas at Camden Wood"]},{"name":"Tiburon","address":"Foxboro wy, laurel fl 34275","lat":27.158254,"lng":-82.432611,"aliases":[]},{"name":"Tideline","address":"1008 Tideline Cove, Bradenton, FL 34209","lat":27.502814,"lng":-82.657801,"aliases":[]},{"name":"Townwalk","address":"(pin drop only)","lat":26.777827,"lng":-81.747429,"aliases":[]},{"name":"Trailside","address":"30182 rustic mills st, mt dora, fl 32757","lat":28.78855,"lng":-81.590972,"aliases":[]},{"name":"Turnleaf","address":"13542 Turnleaf Blvd, Punta Gorda, FL 33955","lat":26.838392,"lng":-82.014873,"aliases":[]},{"name":"Two Rivers","address":"(pin drop only)","lat":28.181651,"lng":-82.23576,"aliases":[]},{"name":"Village (Atla Key)","address":"16506 Sundial Circle","lat":26.798438,"lng":-81.699311,"aliases":[]},{"name":"Villamar","address":"3745 Giorgio Dr, Winter Haven, FL 33884","lat":27.956209,"lng":-81.695727,"aliases":[]},{"name":"Villas at Bishop Oaks","address":"10629 Waterfield Rd, Jacksonville, FL 32210","lat":30.248519,"lng":-81.83773,"aliases":[]},{"name":"Vintera Townhomes","address":"15150 Ginetti St, Nokomis, FL 34275","lat":27.162126,"lng":-82.454876,"aliases":["Vinterra Townhomes"]},{"name":"Vistera","address":"(pin drop only)","lat":27.129224,"lng":-82.391913,"aliases":[]},{"name":"Waters at Center Lake Ranch","address":"5292 Goldfinch Dr, St Cloud, FL 34771","lat":28.28002,"lng":-81.234541,"aliases":["Waters at Center Lake Ran"]},{"name":"Waterset Wolf Creek","address":"5357 Wolf Crk Dr, Apollo Beach, FL 33572","lat":27.747934,"lng":-82.39336,"aliases":[]},{"name":"Waterstone Subdivision","address":"2722 Portadown St, Ormond Beach, FL 32174","lat":29.300489,"lng":-81.112506,"aliases":[]},{"name":"Weslyn Park","address":"3166 Sailhouse Drive","lat":28.336818,"lng":-81.170369,"aliases":[]},{"name":"Westview","address":"5644 morant bay path, kissimmee fl 34758","lat":28.156969,"lng":-81.507465,"aliases":[]},{"name":"Whispering Lakes","address":"(pin drop only)","lat":26.586817,"lng":-81.617136,"aliases":[]},{"name":"Windward Preserve","address":"3862 Windward Dr, Cocoa, FL 32926","lat":28.405683,"lng":-80.811896,"aliases":[]},{"name":"Windwater","address":"5018 123rd Ave E, Parrish, FL 34219","lat":27.560294,"lng":-82.422772,"aliases":[]},{"name":"Woodland Crossings","address":"(pin drop only)","lat":28.884086,"lng":-82.086428,"aliases":[]},{"name":"Woodland Preserve","address":"5035 Shade Forest Dr, Parrish, FL 34219","lat":27.559855,"lng":-82.397532,"aliases":[]},{"name":"Woodland Ranch Estates","address":"208 Spindlewood Blvd, Lake Wales, FL 33898","lat":28.012769,"lng":-81.582085,"aliases":[]},{"name":"Wynnstone","address":"4507 Wynnstone Dr, Davenport, FL 33837","lat":28.202575,"lng":-81.645108,"aliases":[]}];
const CREWS_SEED = [{"name":"Hunter","last":"Cope","code":"","lat":30.277278,"lng":-81.73279},{"name":"Steven","last":"Brooks","code":"","lat":28.51403924410546,"lng":-81.48095821},{"name":"Ayinde","last":"Blackman","code":"","lat":28.158096,"lng":-81.497195},{"name":"Johnathan","last":"Ortiz","code":"","lat":28.521713,"lng":-81.289175},{"name":"Paul","last":"Mabb","code":"","lat":28.753204,"lng":-81.28209},{"name":"Eric","last":"Brand","code":"","lat":28.476193,"lng":-81.269467},{"name":"Daniel","last":"","code":"","lat":28.460857,"lng":-82.495107},{"name":"Kameron","last":"","code":"","lat":28.183023,"lng":-82.403044},{"name":"Joseph","last":"","code":"","lat":27.07305,"lng":-82.174303},{"name":"Owen","last":"","code":"","lat":26.972213,"lng":-82.089491},{"name":"Gustavo","last":"","code":"","lat":26.617244,"lng":-81.928241}];
```

### STORAGE

```js
/* ============================ STORAGE ============================ */
/* Regions are fully isolated workspaces: every key below is prefixed per
   region, so subs / crews / imports / caches never cross between region tabs.
   FL keeps the original un-prefixed keys so pre-region data is untouched. */
const K_REGION='r4m_region_v1'; // the ONLY shared key: which region is open
const REGION_DEFS={ FL:{c:'#2563eb',d:'#1d4ed8',center:[28.5,-81.4]},
                    HOU:{c:'#ea580c',d:'#c2410c',center:[29.76,-95.37]},
                    DFW:{c:'#16a34a',d:'#15803d',center:[32.85,-97.0]},
                    ASA:{c:'#9333ea',d:'#7e22ce',center:[29.9,-98.1]} };
let REGION='FL';
try{ const r=localStorage.getItem(K_REGION); if(REGION_DEFS[r]) REGION=r; }catch(e){}
const REGION_COLOR=REGION_DEFS[REGION].c, REGION_CENTER=REGION_DEFS[REGION].center;
const RK = REGION==='FL' ? 'r4m_' : 'r4m_'+REGION.toLowerCase()+'_';
const REGION_SUBS_SEED = REGION==='FL' ? SUBS_SEED : [];
const REGION_CREWS_SEED = REGION==='FL' ? CREWS_SEED : [];
const K_SUBS=RK+'subs_v1', K_CREWS=RK+'crews_v1', K_LASTIMPORT=RK+'lastimport_v1';
function load(key,seed){ try{const v=localStorage.getItem(key); if(v) return JSON.parse(v);}catch(e){} return JSON.parse(JSON.stringify(seed)); }
/* Browsers cap this origin at a few MB and every region shares it, so a big
   library can push a save over the edge. Never lose data silently: make room
   by dropping the disposable KMZ scan cache, retry, and if it still won't fit,
   say so loudly instead of throwing into whatever called us. */
function save(key,val){
  const s=JSON.stringify(val);
  try{ localStorage.setItem(key,s); return true; }
  catch(e){
    try{ showToast("Browser storage is full — that change could NOT be saved. Export a library and reset a market you don't use.",'err');
         logMsg(`SAVE FAILED for ${key} (${Math.round(s.length/1024)} KB) — browser storage full`,'err'); }catch(e3){}
    return false;
  }
}
/* localStorage is ONE ~5 MB bucket shared by every market on this machine, so
   anything that grows with the day's work must not live there. The raw file01
   text alone runs to megabytes, and a couple of stashed Sage exports filled the
   bucket — which is what was rejecting Houston's 424 KB library outright.
   IndexedDB works on a plain double-clicked file:// page with no launch flags
   and gives us hundreds of MB, so the big blobs go there and localStorage is
   left to the small settings it can actually hold. */
const IDB_NAME='r4m', IDB_STORE='kv';
let idbP=null;
function idbOpen(){
  if(idbP) return idbP;
  idbP=new Promise((res,rej)=>{
    let rq; try{ rq=indexedDB.open(IDB_NAME,1); }catch(e){ return rej(e); }
    rq.onupgradeneeded=()=>{ try{ rq.result.createObjectStore(IDB_STORE); }catch(e){} };
    rq.onsuccess=()=>res(rq.result);
    rq.onerror=()=>rej(rq.error||new Error('IndexedDB unavailable'));
    rq.onblocked=()=>rej(new Error('IndexedDB blocked'));
  }).catch(e=>{ idbP=null; throw e; });
  return idbP;
}
function idbReq(mode,fn){
  return idbOpen().then(db=>new Promise((res,rej)=>{
    let out;
    const tx=db.transaction(IDB_STORE,mode);
    const rq=fn(tx.objectStore(IDB_STORE));
    if(rq) rq.onsuccess=()=>{ out=rq.result; };
    tx.oncomplete=()=>res(out);                 // resolve on commit, not on the request
    tx.onerror=()=>rej(tx.error||new Error('write failed'));
    tx.onabort=()=>rej(tx.error||new Error('write aborted'));
  }));
}
const idbGet=k=>idbReq('readonly',s=>s.get(k));
/* Read a stored library from wherever it actually lives: IndexedDB normally,
   the old localStorage copy when a browser refuses IndexedDB or when a market
   has not been opened since upgrading. */
async function storedLibrary(key){
  let v=null; try{ v=await idbGet(key); }catch(e){}
  if(!Array.isArray(v)){ try{ const raw=JSON.parse(localStorage.getItem(key)||'null'); if(Array.isArray(raw)) v=raw; }catch(e){} }
  return Array.isArray(v)?v:[];
}
const idbSet=(k,v)=>idbReq('readwrite',s=>s.put(v,k));
const idbDel=k=>idbReq('readwrite',s=>s.delete(k));
/* Subs are stored compactly: empty nickname/address/aliases are simply left
   out, which cuts a 5,600-sub library roughly in half. */
function packSubs(list){
  return list.map(s=>{
    const o={n:s.name};
    if(s.lat!=null&&s.lat!=='') { o.a=+s.lat; o.o=+s.lng; }
    if(s.nickname) o.k=s.nickname;
    if(s.address) o.d=s.address;
    if(Array.isArray(s.aliases)&&s.aliases.length) o.x=s.aliases;
    return o;
  });
}
function unpackSubs(list){
  if(!Array.isArray(list)) return [];
  return list.map(s=> s && s.n!==undefined
    ? {name:s.n,nickname:s.k||'',address:s.d||'',lat:s.a==null?null:s.a,lng:s.o==null?null:s.o,aliases:s.x||[]}
    : {name:(s&&s.name)||'',nickname:(s&&s.nickname)||'',address:(s&&s.address)||'',
       lat:s&&s.lat!=null?s.lat:null,lng:s&&s.lng!=null?s.lng:null,aliases:(s&&s.aliases)||[]});
}
let SUBS = unpackSubs(load(K_SUBS,REGION_SUBS_SEED));
let CREWS = load(K_CREWS,REGION_CREWS_SEED);
// migrate crews saved before last-name / servicer-code existed
(function migrateCrews(){
  const knownLast={hunter:'Cope',steven:'Brooks',ayinde:'Blackman',johnathan:'Ortiz',paul:'Mabb',eric:'Brand'};
  let changed=false;
  for(const c of CREWS){
    if(c.last===undefined){ c.last=knownLast[String(c.name||'').trim().toLowerCase()]||''; changed=true; }
    if(c.code===undefined){ c.code=''; changed=true; }
    if(!Array.isArray(c.locs)){ c.locs = isFinite(+c.lat)?[{label:'Home',lat:+c.lat,lng:+c.lng}]:[]; c.locIdx=0; changed=true; }
  }
  if(changed) save(K_CREWS,CREWS);
})();
/* A crew can have several known start locations (two homes, a yard, a
   relative's place). c.locs = [{label,lat,lng}] and c.locIdx picks the active
   one; c.lat/c.lng always mirror it so everything downstream stays simple. */
function crewLocs(c){
  if(!Array.isArray(c.locs)||!c.locs.length)
    c.locs = isFinite(+c.lat) ? [{label:'Home',lat:+c.lat,lng:+c.lng}] : [];
  return c.locs;
}
function crewSetLoc(c,i){
  const L=crewLocs(c); if(!L[i]) return;
  c.locIdx=i; c.lat=L[i].lat; c.lng=L[i].lng;
}
function crewAddLoc(c,label,lat,lng){
  const L=crewLocs(c);
  if(L.some(x=>haversineMi(+x.lat,+x.lng,lat,lng)<=0.1)) return false; // same spot already known
  L.push({label:label||`Location ${L.length+1}`,lat,lng});
  if(L.length===1) crewSetLoc(c,0);
  return true;
}
/* Guard against the one failure that actually loses work: writing an empty (or
   drastically smaller) library over a full one. That happens when a second tab
   is open on the same market with stale state, when a load silently fell back
   to the seed, or when any handler runs before an import finishes. The write is
   refused, the good copy stays on disk, and the operator is told out loud. */
/* The libraries live in IndexedDB. localStorage is one ~5 MB bucket shared by
   every market AND by every other local page on this machine, so what is left
   for us is not ours to control — Houston's 424 KB import kept being rejected
   outright by a bucket something else had already filled. IndexedDB gets its
   own database and hundreds of MB, which is what a 5,600-sub library has always
   needed. localStorage stays for the small settings, and remains the fallback
   if a browser ever refuses IndexedDB.

   STORED_N mirrors what we believe is on disk so the wipe guards below can stay
   synchronous even though the write itself is not. */
const STORED_N={};
let HYDRATED=false, DB_MODE='localStorage';
function storedCount(key){
  if(key in STORED_N) return STORED_N[key];
  try{ const v=JSON.parse(localStorage.getItem(key)||'[]'); return Array.isArray(v)?v.length:0; }catch(e){ return 0; }
}
/* Write a library. Prefers IndexedDB; falls back to localStorage and says so
   loudly if neither will take it. Verification happens after the commit. */
function dbPut(key,packed,label,count){
  return idbSet(key,packed).then(()=>{
    DB_MODE='IndexedDB';
    try{ localStorage.removeItem(key); }catch(e){}   // the old copy is dead weight in a full bucket
    return idbGet(key).then(v=>{
      const after=Array.isArray(v)?v.length:0;
      if(after!==count){
        showToast(`Save did not stick — the browser stored ${after} of ${count} ${label}. Export a backup now.`,'err');
        logMsg(`VERIFY FAILED for ${key}: wrote ${count}, read back ${after}`,'err');
        return false;
      }
      return true;
    });
  }).catch(err=>{
    logMsg(`IndexedDB unavailable (${(err&&err.name)||err}) — falling back to browser settings storage`,'warn');
    if(!save(key,packed)){
      showToast(`Could NOT save ${count} ${label}. This browser is out of room and won't take it — export a backup before closing.`,'err');
      return false;
    }
    return true;
  });
}
function guardedSave(key,arr,packed,label,opt){
  const have=arr.length, had=storedCount(key), force=!!(opt&&opt.force);
  if(!HYDRATED && !force){        // never write over a library we haven't read yet
    logMsg(`Ignored a ${label} save that arrived before the library finished loading`,'warn');
    return false;
  }
  if(!force && had>0 && have===0){
    showToast(`Refused to erase ${had} ${label} — this page is out of date. Reload before making changes.`,'err');
    logMsg(`BLOCKED a wipe: tried to save 0 ${label} over ${had} stored (${key}). Nothing was changed.`,'err');
    return false;
  }
  if(!force && had>=25 && have<had*0.5){
    if(!confirm(`This will cut ${label} from ${had} to ${have}. Continue?`)){
      logMsg(`Cancelled a large ${label} reduction (${had} -> ${have})`,'warn');
      return false;
    }
  }
  STORED_N[key]=have;
  dbPut(key,packed,label,have);   // reports its own failures
  return true;
}
function persistSubs(opt){ return guardedSave(K_SUBS,SUBS,packSubs(SUBS),'subdivisions',opt); }
function persistCrews(opt){ return guardedSave(K_CREWS,CREWS,CREWS,'crews',opt); }
/* Read this market's libraries out of IndexedDB, migrating any copy still
   sitting in localStorage on the way. Until this lands, writes are refused. */
async function hydrateLibraries(){
  try{
    let s=await idbGet(K_SUBS), c=await idbGet(K_CREWS);
    DB_MODE='IndexedDB';
    if(!Array.isArray(s) && SUBS.length){ await idbSet(K_SUBS,packSubs(SUBS)); s=packSubs(SUBS);
      logMsg(`Moved ${SUBS.length} ${REGION} subdivisions into IndexedDB`); }
    if(!Array.isArray(c) && CREWS.length){ await idbSet(K_CREWS,CREWS); c=CREWS;
      logMsg(`Moved ${CREWS.length} ${REGION} crews into IndexedDB`); }
    if(Array.isArray(s)) SUBS=unpackSubs(s);
    if(Array.isArray(c)) CREWS=c;
    // the libraries are safe in IndexedDB now; stop paying for them in the small bucket
    try{ localStorage.removeItem(K_SUBS); localStorage.removeItem(K_CREWS); }catch(e){}
  }catch(err){
    DB_MODE='localStorage';
    logMsg(`IndexedDB unavailable (${(err&&err.name)||err}) — using browser settings storage`,'warn');
  }
  STORED_N[K_SUBS]=SUBS.length; STORED_N[K_CREWS]=CREWS.length;
  HYDRATED=true;
  try{ renderSubs(); renderCrews(); }catch(e){}
}
/* Another tab writing this market's library is the classic way a good copy gets
   clobbered; notice it and say so instead of letting it pass unseen. */
window.addEventListener('storage',e=>{
  if(!e.key || e.newValue===e.oldValue) return;
  if(e.key===K_SUBS || e.key===K_CREWS){
    const mine=(e.key===K_SUBS?SUBS:CREWS).length;
    let theirs=0; try{ const v=JSON.parse(e.newValue||'[]'); theirs=Array.isArray(v)?v.length:0; }catch(err){}
    if(theirs<mine){
      showToast(`Another tab just changed ${REGION} (${mine} → ${theirs}). Close the other tab and reload.`,'err');
      logMsg(`Another tab wrote ${e.key}: ${mine} -> ${theirs}`,'err');
    }
  }
});

// territories were removed — clean up their old storage keys in every region
// (the shelved API experiment's stored key is scrubbed here too)
(function(){ try{ for(const p of ['r4m_','r4m_hou_','r4m_dfw_','r4m_asa_'])
  for(const k of ['territories_v1','terrpoly_v1','kmzcache_v1','kmzmulti_v1','kmzignoredirs_v1']) localStorage.removeItem(p+k);
  localStorage.removeItem('r4m_apikey_v1'); }catch(e){} })();
```

### MATCHING

```js
/* ============================ MATCHING ============================ */
function norm(s){ return String(s==null?'':s).trim().toLowerCase().replace(/\s+/g,' '); }
function buildIndex(){
  const byName=new Map(), byAlias=new Map();
  for(const s of SUBS){
    byName.set(norm(s.name),s);
    for(const a of (s.aliases||[])) byAlias.set(norm(a),s);
  }
  return {byName,byAlias};
}
/* One-time raw->subName matches from the review popup ("Match" without alias).
   Cleared whenever a new file01 is loaded — it's per-import-run, like dispatch. */
const ONE_TIME_SUB=new Map();

/* Sage splits one place across two columns — "Subdiv Name" and "Section" — while
   the library has a separate zone, with its own centroid, for every phase and
   section ("Easton Park 10", "Woodlands at Medina Hills U2A Ph3"). Matching on the
   name alone collapses them: every Easton Park job becomes a single decision, and
   Section 5's jobs land on Section 2's coordinates. These rebuild the full place
   name so each section is matched, resolved and geocoded on its own. */
function subKeyForms(name, section){
  const n=String(name==null?'':name).trim();
  const s=String(section==null?'':section).trim();
  if(!n||!s) return [n];
  if(norm(n).endsWith(' '+norm(s))) return [n];        // the name already carries it
  const tight=s.replace(/\s+/g,'');                     // "Ph 3" is also written "Ph3"
  return tight!==s ? [n+' '+s, n+' '+tight] : [n+' '+s];
}
function subKeyOf(name, section){ return subKeyForms(name,section)[0]; }

/* returns {sub, how} or {sub:null, how}. With a section, the fuller name is tried
   first and the bare name is the fallback, so a library with no section detail
   still matches exactly as it did before. */
function matchSub(value, idx, section){
  const bare=String(value==null?'':value).trim();
  if(section===undefined) return matchSubName(value, idx);
  const tried=subKeyForms(value, section);
  if(!tried.some(f=>norm(f)===norm(bare))) tried.push(bare);
  for(const f of tried){ const r=matchSubName(f, idx); if(r.sub) return r; }
  return {sub:null, how: norm(bare)?'miss':'empty'};
}
function matchSubName(value, idx){
  const n=norm(value);
  if(!n) return {sub:null,how:'empty'};
  if(idx.byName.has(n)) return {sub:idx.byName.get(n),how:'name'};
  if(idx.byAlias.has(n)) return {sub:idx.byAlias.get(n),how:'alias'};
  if(ONE_TIME_SUB.has(n)){ const s=SUBS.find(x=>norm(x.name)===norm(ONE_TIME_SUB.get(n))); if(s) return {sub:s,how:'onetime'}; }
  // Truncation-aware: Sage cuts "Subdiv Name" at a fixed column width, so a long
  // library name arrives shortened. If the raw name is >=19 chars and the unique
  // prefix of exactly one longer name (or alias), treat it as a truncation and
  // SAVE it as an alias so the next import hits the exact fast path. The 19-char
  // floor stops short shared prefixes ("Star Lake"/"Star Lake Estates") collapsing.
  const raw0=String(value==null?'':value).trim();
  if(raw0.length>=19){
    const nameHits=SUBS.filter(s=>norm(s.name).length>n.length && norm(s.name).startsWith(n));
    if(nameHits.length===1) return {sub:_saveTruncAlias(nameHits[0],raw0),how:'prefix'};
    if(nameHits.length===0){
      const am=new Map();
      for(const s of SUBS) for(const a of (s.aliases||[])) if(norm(a).length>n.length && norm(a).startsWith(n)) am.set(s.name,s);
      if(am.size===1) return {sub:_saveTruncAlias([...am.values()][0],raw0),how:'aliasprefix'};
    }
  }
  return {sub:null,how:'miss'};
}
function _saveTruncAlias(sub,raw0){
  if(!Array.isArray(sub.aliases)) sub.aliases=[];
  if(!sub.aliases.some(a=>norm(a)===norm(raw0))){ sub.aliases.push(raw0); persistSubs(); }
  return sub;
}

/* ---- Jaro-Winkler fuzzy scoring (ported from the dispatch tool) ---- */
function jaroWinkler(a,b){
  if(!a||!b) return 0;
  a=a.toLowerCase();b=b.toLowerCase();
  if(a===b) return 1;
  const al=a.length,bl=b.length;
  const md=Math.max(0,Math.floor(Math.max(al,bl)/2)-1);
  const am=new Array(al).fill(false),bm=new Array(bl).fill(false);
  let matches=0;
  for(let i=0;i<al;i++){
    const lo=Math.max(0,i-md),hi=Math.min(bl,i+md+1);
    for(let j=lo;j<hi;j++){
      if(bm[j]||a[i]!==b[j])continue;
      am[i]=bm[j]=true;matches++;break;
    }
  }
  if(!matches)return 0;
  let t=0,k=0;
  for(let i=0;i<al;i++){
    if(!am[i])continue;
    while(!bm[k])k++;
    if(a[i]!==b[k])t++;
    k++;
  }
  t/=2;
  const j=(matches/al+matches/bl+(matches-t)/matches)/3;
  let prefix=0;
  for(let i=0;i<Math.min(4,al,bl);i++){if(a[i]===b[i])prefix++;else break;}
  return j+prefix*0.1*(1-j);
}
const FUZZY_THRESHOLD=0.80;
/* Score a raw name against every sub name AND alias; sorted descending. */
function scoreSubs(raw){
  const out=[];
  if(!raw) return out;
  for(const s of SUBS){
    let best=jaroWinkler(raw,s.name);
    for(const a of (s.aliases||[])){ const sc=jaroWinkler(raw,a); if(sc>best) best=sc; }
    out.push({name:s.name, score:best});
  }
  out.sort((a,b)=>b.score-a.score);
  return out;
}
```

### CSV

```js
/* ============================ CSV ============================ */
function parseCSV(text){
  // returns array of rows (array of string cells). Handles quotes + CRLF. Preserves cell text incl. padding.
  const rows=[]; let row=[], cell='', i=0, q=false; const n=text.length;
  while(i<n){
    const c=text[i];
    if(q){
      if(c==='"'){ if(text[i+1]==='"'){cell+='"';i+=2;continue;} q=false;i++;continue; }
      cell+=c;i++;continue;
    }
    if(c==='"'){ q=true;i++;continue; }
    if(c===','){ row.push(cell);cell='';i++;continue; }
    if(c==='\n'){ row.push(cell);rows.push(row);row=[];cell='';i++;continue; }
    if(c==='\r'){ i++;continue; }
    cell+=c;i++;
  }
  if(cell!==''||row.length){ row.push(cell);rows.push(row); }
  return rows;
}
function csvCell(v){
  const s=String(v==null?'':v);
  return /[",\n\r]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s;
}
function toCSV(rows){ return rows.map(r=>r.map(csvCell).join(',')).join('\r\n'); }
```

### CONVERT

```js
/* ============================ CONVERT ============================ */
const LAT_H='Latitude', LNG_H='Longitude', DEPOT_H='Depot';
/* Route4Me's own header names for on-site time and a stop's time window. If an
   upload rejects them, these three strings are the only thing to change. */
const SVC_H='Service Time', WINF_H='Time Window Start', WINT_H='Time Window End';
/* Time windows belong to a single order, not to a kind of work, so they live
   here keyed by Svc Job Num rather than on the task. */
const JOB_WINDOWS=new Map();

function findCol(header, name){
  const target=norm(name);
  for(let i=0;i<header.length;i++) if(norm(header[i])===target) return i;
  return -1;
}

function convert(text, sourceName){
  const rows=parseCSV(text).filter(r=>r.some(c=>String(c).trim()!==''));
  if(!rows.length) throw new Error('Empty file.');
  return buildFile02(rows);
}
/* file02 extra columns (beyond the locked core), chosen in "Columns…" — per region */
const K_F02COLS=RK+'file02cols_v1';
const F02_CORE=['Latitude','Longitude','Svc Job Num','Depot']; // locked in or excluded by design
function loadFile02Cols(){ const a=load(K_F02COLS,[]); return new Set(Array.isArray(a)?a.map(norm):[]); }
function openColsModal(){
  if(!jobsHeader){ showToast('Load a Sage export first'); return; }
  const chosen=loadFile02Cols();
  const coreNorm=new Set(F02_CORE.map(norm));
  const opts=jobsHeader.map(h=>String(h).trim()).filter(h=>h&&!coreNorm.has(norm(h)));
  const root=document.getElementById('modalRoot');
  root.innerHTML=`<div class="backdrop"><div class="modal" style="max-width:460px"><div class="mh"><h3>Route4Me file columns</h3>
    <div class="muted" style="font-size:12.5px;margin-top:4px">Core columns always included: <b>Alias (task - subdivision - address), Latitude, Longitude, Svc Job Num, Scheduled For, Priority, Color</b>
    (Svc Job Num is the key that splices the Route4Me export back onto the Sage export). Check anything extra you want visible in Route4Me.</div></div>
  <div class="mb" style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
    ${opts.map(h=>`<label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer">
      <input type="checkbox" data-f02col="${esc(h)}" ${chosen.has(norm(h))?'checked':''}> ${esc(h)}</label>`).join('')}
  </div>
  <div class="mf"><button id="colsCancel">Cancel</button><button class="primary" id="colsSave">Save</button></div></div></div>`;
  document.getElementById('colsCancel').onclick=()=>root.innerHTML='';
  document.getElementById('colsSave').onclick=()=>{
    const sel=[...root.querySelectorAll('input[data-f02col]:checked')].map(x=>x.dataset.f02col);
    save(K_F02COLS,sel);
    root.innerHTML='';
    showToast(sel.length?`Saved — core + ${sel.length} extra column${sel.length===1?'':'s'}. Click Build.`:'Saved — minimal core columns only. Click Build.');
  };
}
```

### TASK SETTINGS

```js
/* ==== TASK SETTINGS ====
   Every Sage task name stands on its own row and carries what the tool knows
   about that kind of work:

     svc       how long it takes on site, in minutes -> Route4Me service time
     due[4]    priority by how close Schedule_Date is to the route day
     recv[4]   priority by how old the job is

   A job takes the HOTTEST (lowest) value the two clocks offer; a blank bucket
   contributes nothing, and a task with no row gets a blank Priority — Sage's
   own numbers are never passed through. Sage Priority "R" (rush) = 1, over
   everything. Time windows are NOT here: they belong to an individual order,
   not to a kind of work, and are set per job on the Dispatch page.
   Stored per market. */
const K_PRIOMX=RK+'priomatrix_v2';       // families — superseded, read once to migrate
const K_TASKMX=RK+'taskmatrix_v1';
const PRIO_DUE=['Late','Due that day','1 day before','2+ before'];
const PRIO_RECV=['Received day','+1 day','+2 days','+3 or more'];
const blank4=()=>['','','',''];
const TASK_DEFAULT=[
  {name:'ENV W\\ELEV STK', svc:'', due:['10','15','',''],    recv:blank4()},
  {name:'GRADE STAKING',   svc:'', due:['10','15','',''],    recv:blank4()},
  {name:'RE-GRADE STAKE',  svc:'', due:['10','15','',''],    recv:blank4()},
  {name:'FORM SURVEY',     svc:'', due:['10','10','15','40'], recv:blank4()},
  {name:'SIGNED SLAB SVY', svc:'', due:['20','15','15',''],   recv:['50','50','40','30']},
  {name:'FINAL SVY SWALE', svc:'', due:['20','15','30',''],   recv:['60','60','60','50']}
];
function normTask(t){
  const o={name:String((t&&t.name)||'').trim(), svc:String((t&&t.svc)||'').trim(), due:blank4(), recv:blank4()};
  for(const k of ['due','recv']) for(let i=0;i<4;i++){
    const v=t&&Array.isArray(t[k])?t[k][i]:''; o[k][i]=v==null?'':String(v).trim();
  }
  return o;
}
/* Families are gone — a task carries its own numbers now. Anyone upgrading gets
   their family values copied onto every task that family held, so a matrix
   tuned over weeks survives the change. */
function migrateFamilies(){
  const m=load(K_PRIOMX,null);
  if(!m||!m.fam) return null;
  const out=[];
  for(const f of Object.values(m.fam))
    for(const t of (f.tasks||[])) out.push(normTask({name:t,due:f.due,recv:f.recv}));
  return out.length?{tasks:out, codes:(m.codes&&typeof m.codes==='object')?m.codes:{R:'1'}}:null;
}
function loadTaskMx(){
  let m=load(K_TASKMX,null);
  if(!m||!Array.isArray(m.tasks)) m=migrateFamilies();
  if(!m||!Array.isArray(m.tasks)) m={tasks:JSON.parse(JSON.stringify(TASK_DEFAULT)),codes:{R:'1'}};
  m.tasks=m.tasks.map(normTask).filter(t=>t.name);
  if(!m.codes||typeof m.codes!=='object') m.codes={R:'1'};
  return m;
}
function saveTaskMx(m){ return save(K_TASKMX,{tasks:(m.tasks||[]).map(normTask).filter(t=>t.name), codes:m.codes||{R:'1'}}); }
function taskIndex(m){ const by={}; for(const t of m.tasks) by[norm(t.name)]=t; return by; }
function prioMxActive(mx){ return (mx.tasks||[]).some(t=>[...(t.due||[]),...(t.recv||[])].some(x=>x!==''&&x!=null)); }
function loadPrioMx(){ return loadTaskMx(); }   // old name, current data

/* A task is matched by its exact Sage name, so anything spelled differently —
   or a task type this market has and Florida never did — quietly comes out with
   a blank Priority. Rather than leave the manager guessing which ones, list the
   task names sitting in the loaded file that no family claims. */
/* Task names that turned up in the loaded file01 and have no row yet. Matching
   is exact (case and spacing aside), so a market's own spelling — or a task
   type Florida never had — would otherwise come out with a blank Priority and
   nothing on screen to say why. */
function unmappedTasks(mx){
  if(!jobsHeader) return [];
  const i=findCol(jobsHeader,'Description Of Problem'); if(i<0) return [];
  const known=new Set((mx.tasks||[]).map(t=>norm(t.name)));
  const seen=new Map();
  for(const r of jobsRows){
    if(r.removed) continue;
    const raw=String(r.cells[i]==null?'':r.cells[i]).trim();
    if(!raw || known.has(norm(raw))) continue;
    seen.set(raw,(seen.get(raw)||0)+1);
  }
  return [...seen.entries()].sort((a,b)=>b[1]-a[1]);
}
/* How many jobs in the loaded file each task covers — shown beside the row so
   the manager can see which settings actually matter today. */
function taskJobCounts(){
  const out=new Map();
  if(!jobsHeader) return out;
  const i=findCol(jobsHeader,'Description Of Problem'); if(i<0) return out;
  for(const r of jobsRows){
    if(r.removed) continue;
    const k=norm(r.cells[i]==null?'':r.cells[i]);
    if(k) out.set(k,(out.get(k)||0)+1);
  }
  return out;
}
let TASKMX=null;
function renderTasks(){
  if(!document.getElementById('taskBody')) return;
  TASKMX=TASKMX||loadTaskMx();
  const counts=taskJobCounts();
  const sub=document.getElementById('taskSubHead');
  sub.innerHTML='<th></th><th class="muted" style="font-weight:500;font-size:10.5px">min</th>'+
    PRIO_DUE.map(b=>`<th class="muted" style="font-weight:500;font-size:10.5px;text-align:center">${esc(b)}</th>`).join('')+
    PRIO_RECV.map(b=>`<th class="muted" style="font-weight:500;font-size:10.5px;text-align:center">${esc(b)}</th>`).join('')+'<th></th>';
  const cell=(ti,kind,i,v)=>`<td><input type="number" data-tk="${ti}|${kind}|${i}" value="${esc(v||'')}" placeholder="—"
    style="width:100%;padding:4px 2px;font-size:12px;text-align:center;border:1px solid var(--line);border-radius:6px"></td>`;
  document.getElementById('taskBody').innerHTML=TASKMX.tasks.map((t,ti)=>{
    const n=counts.get(norm(t.name))||0;
    return `<tr>
      <td><input type="text" data-tname="${ti}" value="${esc(t.name)}"
            style="width:100%;padding:4px 6px;font-size:12.5px;font-family:ui-monospace,Menlo,Consolas,monospace;border:1px solid var(--line);border-radius:6px">
          ${n?`<span class="muted" style="font-size:10.5px">${n} job${n===1?'':'s'} in this file</span>`:''}</td>
      <td><input type="number" min="0" data-tsvc="${ti}" value="${esc(t.svc||'')}" placeholder="—"
            style="width:100%;padding:4px 2px;font-size:12px;text-align:center;border:1px solid var(--line);border-radius:6px"></td>
      ${t.due.map((v,i)=>cell(ti,'due',i,v)).join('')}
      ${t.recv.map((v,i)=>cell(ti,'recv',i,v)).join('')}
      <td><button class="icon-btn danger" data-tdel="${ti}" title="remove task">&times;</button></td>
    </tr>`;
  }).join('') || '<tr><td colspan="11" class="muted">No tasks yet — add one below, or import a file01 and use the list above.</td></tr>';

  const un=unmappedTasks(TASKMX);
  const unJobs=un.reduce((a,b)=>a+b[1],0);
  document.getElementById('taskUnmapped').innerHTML = !jobsHeader ? ''
    : un.length ? `<div style="padding:10px 11px;border:1px solid var(--warn);background:var(--warn-bg);border-radius:8px;margin-bottom:12px">
        <div style="font-size:11px;color:var(--warn);text-transform:uppercase;letter-spacing:.06em;font-weight:700">
          In this file but not set up &mdash; ${un.length} task${un.length===1?'':'s'}, ${unJobs} job${unJobs===1?'':'s'} getting a blank Priority</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:7px">
          ${un.map(([t,n])=>`<button class="small" data-tadd="${esc(t)}">+ ${esc(t)} <b>&times;${n}</b></button>`).join('')}
        </div></div>`
    : `<div class="muted" style="font-size:12px;margin-bottom:12px">&#10003; Every task in the loaded file has a row.</div>`;

  document.getElementById('taskCount').textContent=
    `${TASKMX.tasks.length} task${TASKMX.tasks.length===1?'':'s'}`+
    (jobsHeader?` · ${[...counts.keys()].length} in the loaded file`:'');
  renderCodes(); renderLadder();
}
function commitTasks(){
  const b=document.getElementById('taskBody'); if(!b) return;
  b.querySelectorAll('[data-tname]').forEach(inp=>{ const t=TASKMX.tasks[+inp.dataset.tname]; if(t) t.name=inp.value.trim(); });
  b.querySelectorAll('[data-tsvc]').forEach(inp=>{ const t=TASKMX.tasks[+inp.dataset.tsvc]; if(t) t.svc=inp.value.trim(); });
  b.querySelectorAll('[data-tk]').forEach(inp=>{
    const [ti,kind,i]=inp.dataset.tk.split('|'); const t=TASKMX.tasks[+ti];
    if(t) t[kind][+i]=inp.value.trim();
  });
  TASKMX.tasks=TASKMX.tasks.filter(t=>t.name);
  saveTaskMx(TASKMX);
}
function renderCodes(){
  const w=document.getElementById('codeWrap'); if(!w) return;
  w.innerHTML=Object.entries(TASKMX.codes).map(([c,v])=>
    `<span class="alias-chip" style="font-size:12px;padding:4px 6px 4px 10px"><b>${esc(c)}</b>&nbsp;&rarr;&nbsp;${esc(v)}<button data-cdel="${esc(c)}" title="remove code">&times;</button></span>`).join('')
    || '<span class="muted" style="font-size:12px">No letter codes.</span>';
  w.querySelectorAll('[data-cdel]').forEach(b=>b.onclick=()=>{ commitTasks(); delete TASKMX.codes[b.dataset.cdel]; saveTaskMx(TASKMX); renderTasks(); });
}
function renderLadder(){
  const el=document.getElementById('prioLadder'); if(!el) return;
  el.innerHTML=[['10','1-10'],['15','11-15'],['20','16-20'],['30','21-30'],['40','31-40'],['60','41-60'],['99','61+']]
    .map(([v,lbl])=>`<div style="flex:1;background:#${prioColorFor(+v)};padding:7px 2px;text-align:center;font-size:10.5px;
      color:${+v<=20?'#fff':'#333'};font-weight:600">${lbl}</div>`).join('');
}
/* Shared by the export and the ladder above so they can never drift apart. */
function prioColorFor(n){
  if(!isFinite(n)) return '';
  return n<=10?'FF0000' : n<=15?'FF7A00' : n<=20?'FFB055'
    : n<=30?'FFE000' : n<=40?'FFEB80' : n<=60?'FFF5C2' : 'FFFFFF';
}
function wireTaskSettings(){
  const body=document.getElementById('taskBody');
  body.addEventListener('change',e=>{ if(e.target.matches('input')) commitTasks(); });
  body.addEventListener('click',e=>{
    const d=e.target.closest('[data-tdel]'); if(!d) return;
    commitTasks();
    const t=TASKMX.tasks[+d.dataset.tdel];
    if(confirm(`Remove "${t.name}"? Its jobs will get a blank Priority.`)){
      TASKMX.tasks.splice(+d.dataset.tdel,1); saveTaskMx(TASKMX); renderTasks();
    }
  });
  document.getElementById('taskUnmapped').addEventListener('click',e=>{
    const a=e.target.closest('[data-tadd]'); if(!a) return;
    commitTasks();
    TASKMX.tasks.push(normTask({name:a.dataset.tadd}));
    saveTaskMx(TASKMX); renderTasks();
    showToast(`Added "${a.dataset.tadd}" — set its numbers to give it a priority`);
  });
  const addTask=()=>{
    const el=document.getElementById('taskNew'), v=el.value.trim();
    if(!v){ showToast('Type a task name'); return; }
    commitTasks();
    if(TASKMX.tasks.some(t=>norm(t.name)===norm(v))){ showToast('That task already has a row'); return; }
    TASKMX.tasks.push(normTask({name:v})); saveTaskMx(TASKMX); el.value=''; renderTasks();
  };
  document.getElementById('taskAdd').onclick=addTask;
  document.getElementById('taskNew').addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); addTask(); } });
  document.getElementById('taskReset').onclick=()=>{
    if(!confirm('Reset every task to the standard AllPoints setup? Your service times and priority numbers will be lost.')) return;
    TASKMX={tasks:JSON.parse(JSON.stringify(TASK_DEFAULT)),codes:{R:'1'}};
    saveTaskMx(TASKMX); renderTasks(); showToast('Tasks reset to standard');
  };
  document.getElementById('pmCodeAdd').onclick=()=>{
    const c=document.getElementById('pmCodeK').value.trim().toUpperCase();
    const v=document.getElementById('pmCodeV').value.trim();
    if(!c||!v||!isFinite(+v)){ showToast('Enter a code and a numeric priority'); return; }
    commitTasks(); TASKMX.codes[c]=v; saveTaskMx(TASKMX);
    document.getElementById('pmCodeK').value=''; document.getElementById('pmCodeV').value='';
    renderTasks();
  };
}
/* The old Priority… buttons now just take you to where the settings live. */
function openPrioModal(){
  const tab=document.querySelector('.tab[data-tab="settings"]');
  if(tab) tab.click();
  const card=document.getElementById('taskTable');
  if(card) card.scrollIntoView({behavior:'smooth',block:'start'});
}

function buildFile02(rows){
  const header=rows[0];
  const iAddr=findCol(header,'Address 1');
  const iSub=findCol(header,'Subdiv Name');
  const iSec=findCol(header,'Section');   // optional: splits phases/sections apart
  if(iAddr<0) throw new Error('Could not find an "Address 1" column in this file.');
  if(iSub<0) throw new Error('Could not find a "Subdiv Name" column in this file.');
  if(findCol(header,'Svc Job Num')<0) throw new Error('Could not find a "Svc Job Num" column — it\'s required to match the Route4Me export back to Sage.');

  const idx=buildIndex();
  const out=[];

  // ---- Output column plan ----
  // Jobs go to Route4Me as ORDERS. Keep the upload minimal: the core columns
  // are Address 1 (mapped to Alias), Latitude, Longitude, and Svc Job Num —
  // the join key that must survive the Route4Me round trip so file03 can be
  // spliced with file01 into the Sage import. Any other original column can
  // be toggled on via "Columns…" (stored per region).
  const iSvc=findCol(header,'Svc Job Num');
  const skip=new Set([findCol(header,LAT_H),findCol(header,LNG_H),findCol(header,DEPOT_H)].filter(x=>x>=0));
  // "Scheduled For": one uniform date on every job so Route4Me auto-schedules the
  // orders for that day (its own column — Sage's Schedule_Date is untouched)
  const sfEl=document.getElementById('schedFor');
  let schedFor=null;
  if(sfEl && sfEl.value){
    const m=sfEl.value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(m) schedFor=`${+m[2]}/${+m[3]}/${m[1]}`;
  }
  // Alias: task - subdivision - address, e.g. "FORM SURVEY - Laureate Park - 9620 Duflo Way".
  // Uses the full library sub name when matched (Sage's Subdiv Name is truncated).
  const iTask=findCol(header,'Description Of Problem');
  const aliasFor=(cells,subName)=>[iTask>=0?String(cells[iTask]||'').trim():'',
    String(subName||subKeyOf(cells[iSub],iSec>=0?cells[iSec]:'')||'').trim(),
    String(cells[iAddr]||'').trim()].filter(Boolean).join(' - ');
  // priority matrix (two clocks): hottest of Due-clock and Received-clock values
  const PRIOMX=loadPrioMx();
  const prioOn=prioMxActive(PRIOMX) && iTask>=0;
  const iPrio01=findCol(header,'Priority'), iSched01=findCol(header,'Schedule_Date'), iRecv01=findCol(header,'Received Date');
  const routeDay = sfEl&&sfEl.value
    ? new Date(+sfEl.value.slice(0,4), +sfEl.value.slice(5,7)-1, +sfEl.value.slice(8,10))
    : (d=>new Date(d.getFullYear(),d.getMonth(),d.getDate()))(new Date());
  const TASK_BY=taskIndex(PRIOMX);
  const keyDate=k=>new Date(Math.floor(k/10000),Math.floor(k/100)%100-1,k%100);
  const dayDiff=(a,b)=>Math.round((a-b)/86400000);
  let prioApplied=0, rushN=0;
  const codes=PRIOMX.codes||{R:'1'};
  const prioUnmapped=new Map();
  const prioFor=cells=>{ // {v, rush} or null -> no priority at all
    const pc=iPrio01>=0?String(cells[iPrio01]||'').trim().toUpperCase():'';
    if(pc && codes[pc]!=null){ rushN++; return {v:String(codes[pc]),rush:true}; }
    const f=TASK_BY[norm(cells[iTask])];
    if(!f){ const t=String(cells[iTask]||'').trim();
      if(t) prioUnmapped.set(t,(prioUnmapped.get(t)||0)+1);
      return null; }
    const cand=[];
    if(iSched01>=0){ const k=parseDateKey(cells[iSched01]);
      if(k!=null){ const d=dayDiff(keyDate(k),routeDay);
        const v=(f.due||[])[d<0?0:d===0?1:d===1?2:3]; if(v!==''&&v!=null&&isFinite(+v)) cand.push(+v); } }
    if(iRecv01>=0){ const k=parseDateKey(cells[iRecv01]);
      if(k!=null){ const age=dayDiff(routeDay,keyDate(k));
        const v=(f.recv||[])[age<=0?0:age===1?1:age===2?2:3]; if(v!==''&&v!=null&&isFinite(+v)) cand.push(+v); } }
    return cand.length?{v:String(Math.min(...cand)),rush:false}:null;
  };
  // marker colour: heat fade, red -> white as priority cools (bare hex, Route4Me's format)
  const prioColor=v=>prioColorFor(+v);
  /* On-site minutes and a per-order time window only earn a column when
     something actually carries them, so a market that uses neither still gets
     the same lean upload it had before. */
  const svcOf=cells=>{ const t=TASK_BY[norm(cells[iTask])]; return t&&t.svc!==''&&isFinite(+t.svc)?String(+t.svc):''; };
  const svcOn = iTask>=0 && (PRIOMX.tasks||[]).some(t=>t.svc!==''&&isFinite(+t.svc));
  const winOf=cells=>{ const k=iSvc>=0?String(cells[iSvc]||'').trim():''; return k?JOB_WINDOWS.get(k)||null:null; };
  const winOn = iSvc>=0 && JOB_WINDOWS.size>0;
  const plan=[], placed=new Set();
  const addOrig=i=>{ if(i>=0 && !placed.has(i) && !skip.has(i)){ plan.push({k:'orig',i}); placed.add(i); } };
  // no Address column: the address rides inside the Alias (re-addable via Columns…)
  plan.push({k:'alias'});
  plan.push({k:'lat'});
  plan.push({k:'lng'});
  addOrig(iSvc);
  if(schedFor) plan.push({k:'sched'});
  if(svcOn) plan.push({k:'svc'});
  if(winOn){ plan.push({k:'winf'}); plan.push({k:'wint'}); }
  if(prioOn){ plan.push({k:'prio'}); plan.push({k:'color'}); }
  const extras=loadFile02Cols();
  for(let c=0;c<header.length;c++) if(extras.has(norm(header[c]))) addOrig(c); // chosen extras, original order
  if(DEPOTS_ON) plan.push({k:'depot'});          // last column, as it always was
  function reshape(cells, latVal, lngVal, schedVal, aliasVal, prioVal, colorVal, depotVal, x){
    x=x||{};
    return plan.map(s=> s.k==='orig' ? (cells[s.i]==null?'':cells[s.i])
      : s.k==='lat' ? latVal : s.k==='lng' ? lngVal : s.k==='alias' ? aliasVal
      : s.k==='prio' ? prioVal : s.k==='color' ? colorVal : s.k==='depot' ? (depotVal||'')
      : s.k==='svc' ? (x.svc||'') : s.k==='winf' ? (x.winf||'') : s.k==='wint' ? (x.wint||'') : schedVal);
  }
  out.push(reshape(header, LAT_H, LNG_H, 'Scheduled For', 'Alias', 'Priority', 'Color', DEPOT_H,
    {svc:SVC_H, winf:WINF_H, wint:WINT_H})); // header row

  const unmatched=new Map(); // erpName -> {count}
  const noCoords=new Map();  // matched sub name -> count (sub exists but has no lat/long yet)
  let matched=0, jobs=0, windowed=0;
  for(let r=1;r<rows.length;r++){
    const cells=rows[r];
    jobs++;
    const subVal=cells[iSub]!=null?cells[iSub]:'';
    const secVal=iSec>=0&&cells[iSec]!=null?cells[iSec]:'';
    const m=matchSub(subVal, idx, secVal);
    let lat='', lng='';
    if(m.sub){
      const hasCoords = m.sub.lat!=null && m.sub.lat!=='' && m.sub.lng!=null && m.sub.lng!=='';
      if(hasCoords){ lat=fmtCoord(m.sub.lat); lng=fmtCoord(m.sub.lng); matched++; }
      else noCoords.set(m.sub.name,(noCoords.get(m.sub.name)||0)+1);
    }
    else{
      const key=subKeyOf(subVal,secVal)||String(subVal).trim();
      const rec=unmatched.get(key)||{count:0,name:String(subVal).trim(),section:String(secVal).trim()};
      rec.count++; unmatched.set(key,rec);
    }
    if(!lat) continue; // only geocoded rows export — unresolved / coordless jobs are dropped (and reported)
    let prio='', color='';
    if(prioOn){
      const mv=prioFor(cells);
      if(mv!=null){ prio=mv.v; color=prioColor(mv.v); prioApplied++; }
      // unmapped/undated jobs get NO priority — Sage's numbers mean nothing to Route4Me
    }
    const w=winOn?winOf(cells):null;
    if(w) windowed++;
    out.push(reshape(cells, lat, lng, schedFor, aliasFor(cells, m.sub?m.sub.name:''), prio, color, '',
      {svc:svcOn?svcOf(cells):'', winf:w?w.from:'', wint:w?w.to:''}));
  }
  // same task in the same sub -> identical aliases; number them so every stop
  // in Route4Me is distinguishable: "FORM SURVEY - Westview (1)", "(2)", ...
  const iAlOut=plan.findIndex(s=>s.k==='alias');
  const aliasCount=new Map(), aliasSeen=new Map();
  for(let r=1;r<out.length;r++){ const a=out[r][iAlOut]; aliasCount.set(a,(aliasCount.get(a)||0)+1); }
  for(let r=1;r<out.length;r++){
    const a=out[r][iAlOut];
    if(aliasCount.get(a)>1){ const n=(aliasSeen.get(a)||0)+1; aliasSeen.set(a,n); out[r][iAlOut]=`${a} (${n})`; }
  }

  /* Depot rows last, as the original did: everything blank but the alias
     ("<crew> Home"), the start coordinates, and Depot = 1. No Svc Job Num, so
     the reverse trip skips straight past them when file03 comes back.
     Starts moved on the crew map count — that's the point of moving them — and
     the caller says so out loud, since an unsaved drag is easy to forget. */
  let depots=0, depotsMoved=0;
  if(DEPOTS_ON){
    for(const s of crewStarts()){
      const cells=new Array(header.length).fill('');
      out.push(reshape(cells, fmtCoord(s.lat), fmtCoord(s.lng), '', `${s.name} Home`, '', '', '1'));
      depots++; if(s.moved) depotsMoved++;
    }
  }

  const outName=`Route4Me Upload ${REGION} ${todayStamp()}.csv`;
  return {rows:out, outName, schedFor, prioOn, prioApplied, rushN, unmatched, noCoords, matched, jobs,
          depots, depotsMoved, prioUnmapped, svcOn, winOn, windowed};
}
function isActive(cw){ return cw.active!==false; } // default on unless explicitly false
function todayStamp(){ const d=new Date(); const p=n=>String(n).padStart(2,'0'); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`; }
function fmtCoord(v){
  if(v==null||v==='') return '';
  const n=Number(v);
  return isNaN(n)?String(v):String(n);
}
```

### JOBS TABLE (trim file01 before Send)

```js
/* ============================ JOBS TABLE (trim file01 before Send) ============================ */
let jobsHeader=null, jobsRows=[], jobsCols=[], jobsSort={i:null,dir:1}, jobsSel=new Set(), jobsAnchor=null;
function parseDateKey(s){
  const m=String(s==null?'':s).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if(!m) return null;
  let y=+m[3]; if(y<100) y+=2000;
  return y*10000 + (+m[1])*100 + (+m[2]);
}
const K_TRIM=RK+'trimstate_v1';   // which rows were trimmed, so a refresh keeps the day's state
const K_UITAB=RK+'uitab_v1';     // which page (Dispatch/Settings) was open
function persistTrim(){ try{ save(K_TRIM,{name:file01Name||'',
    removed:jobsRows.filter(r=>r.removed).map(r=>r.id),
    wins:[...JOB_WINDOWS.entries()]}); }catch(e){} }
function loadFile01ForReview(text,name,restoring){
  let rows;
  try{ rows=parseCSV(text).filter(r=>r.some(c=>String(c).trim()!=='')); }
  catch(e){ showToast('Could not read that CSV'); return; }
  if(rows.length<2){ showToast('That file has no job rows'); return; }
  jobsHeader=rows[0];
  jobsRows=rows.slice(1).map((cells,i)=>({cells,id:i,removed:false}));
  jobsSel=new Set(); jobsAnchor=null; jobsSort={i:null,dir:1};
  ONE_TIME_SUB.clear();   // one-time sub matches are per-import-run
  JOB_WINDOWS.clear();    // and so are time windows — they belong to today's orders
  // fresh default per import: tomorrow (Route4Me auto-schedules orders for this day)
  const sfEl=document.getElementById('schedFor');
  if(sfEl){ const d=new Date(Date.now()+86400000), p=n=>String(n).padStart(2,'0');
    sfEl.value=`${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`; }
  // display columns (by header name; skipped silently if absent)
  const want=[['Svc Job Num','text'],['Received Date','date'],['Schedule_Date','date'],
    ['Description Of Problem','text'],['Status Code','text'],['Priority','text'],
    ['Subdiv Name','text'],['Address 1','text']];
  jobsCols=want.map(([n,t])=>({name:n,i:findCol(jobsHeader,n),type:t})).filter(c=>c.i>=0);
  // stash the full original for the reverse trip (IndexedDB; speaks up if it can't)
  saveLastImport({name,text,when:0});
  setFile01(text,name,true);   // keep the Bring-back tab's file01 in sync with the latest Send
  // guard: warn if this looks like an already-processed file02 (has Depot/Lat/Long col or depot rows)
  const hasProcCol = ['Depot','Latitude','Longitude'].some(n=>findCol(jobsHeader,n)>=0);
  const iAddrW = findCol(jobsHeader,'Address 1');
  const hasHomeRows = iAddrW>=0 && jobsRows.some(r=>/\bhome$/i.test(String(r.cells[iAddrW]||'').trim()));
  const warn=document.getElementById('trimWarn');
  const missingCore=['Address 1','Subdiv Name'].filter(n=>findCol(jobsHeader,n)<0);
  if(missingCore.length || jobsCols.length<4){
    // malformed / wrong file: parsed, but barely any expected Sage columns matched
    warn.className='';
    warn.innerHTML=`<div class="unmatched" style="border-left-color:var(--err);background:var(--err-bg)"><span class="badge err">This doesn&rsquo;t look like a Sage export</span>
      <div style="margin-top:6px">Only <b>${jobsCols.length}</b> of the usual columns matched${jobsCols.length?` (${jobsCols.map(c=>esc(c.name)).join(', ')})`:''}${missingCore.length?` &mdash; missing <b>${missingCore.join('</b> and <b>')}</b>, which the converter requires`:''}.
      The file may be malformed (wrong delimiter, wrong export, or edited). Headers seen: ${esc(jobsHeader.slice(0,8).map(h=>String(h).trim()).filter(Boolean).join(' · ')||'(none)')}.</div></div>`;
  } else if(hasProcCol||hasHomeRows){
    warn.className='';
    warn.innerHTML=`<div class="unmatched"><span class="badge warn">Heads up</span>
      This looks like an <b>already-processed file (file02)</b>${hasProcCol?' &mdash; it has a Depot/Latitude/Longitude column':''}${hasHomeRows?' &mdash; it contains crew <b>&ldquo;Home&rdquo;</b> depot rows':''}.
      For a clean run, drop the <b>raw Sage export (file01)</b> instead. You can still continue if this was intentional.</div>`;
  } else { warn.className='hide'; warn.innerHTML=''; }
  document.getElementById('trimCard').classList.remove('hide');
  document.getElementById('welcomeCard').classList.add('hide'); // work has started — get out of the way
  // spaced hues per distinct task so similar-length names never blur together
  TASK_HUES.clear();
  const iTk2=findCol(jobsHeader,'Description Of Problem');
  if(iTk2>=0){
    const tasks=[...new Set(jobsRows.map(r=>norm(r.cells[iTk2])).filter(Boolean))].sort();
    tasks.forEach((t,i)=>TASK_HUES.set(t, Math.round(i*137.508)%360));
  }
  renderJobs();
  if(!restoring){
    persistTrim(); // fresh import starts a fresh trim state
    setTimeout(scanUnmatchedAtImport,60); // sub resolution up front — Build becomes one click
  }
}
function scanUnmatchedAtImport(){
  if(!jobsHeader) return;
  const iSubC=findCol(jobsHeader,'Subdiv Name'); if(iSubC<0) return;
  const iSecC=findCol(jobsHeader,'Section');
  const idx=buildIndex();
  const unmatched=new Map();
  for(const r of jobsRows){
    if(r.removed) continue;
    const v=r.cells[iSubC]!=null?r.cells[iSubC]:'';
    const sec=iSecC>=0&&r.cells[iSecC]!=null?r.cells[iSecC]:'';
    const m=matchSub(v, idx, sec);
    if(!m.sub){ const key=subKeyOf(v,sec)||String(v).trim();
      const rec=unmatched.get(key)||{count:0,name:String(v).trim(),section:String(sec).trim()};
      rec.count++; unmatched.set(key,rec); }
  }
  if(!unmatched.size) return;
  openUnmatchedModal(unmatched, scanUnmatchedAtImport, {mode:'import'});
}
function jobsView(){
  const v=jobsRows.filter(r=>!r.removed);
  if(jobsSort.i!=null){
    const col=jobsCols.find(c=>c.i===jobsSort.i), dir=jobsSort.dir;
    v.sort((ra,rb)=>{
      const a=ra.cells[jobsSort.i], b=rb.cells[jobsSort.i];
      let x,y;
      if(col && col.type==='date'){ x=parseDateKey(a); y=parseDateKey(b); }
      else { const na=parseFloat(a), nb=parseFloat(b);
        if(!isNaN(na)&&!isNaN(nb)&&/^\s*-?\d/.test(String(a))&&/^\s*-?\d/.test(String(b))){ x=na; y=nb; }
        else { x=String(a==null?'':a).trim().toLowerCase(); y=String(b==null?'':b).trim().toLowerCase(); } }
      if(x==null&&y==null) return 0; if(x==null) return 1; if(y==null) return -1;
      return x<y ? -dir : x>y ? dir : 0;
    });
  }
  return v;
}
function renderJobs(){
  const head=document.getElementById('jobsHead');
  head.innerHTML=`<th style="width:34px"><input type="checkbox" id="jobsAll"></th>`+
    jobsCols.map(c=>{ const on=jobsSort.i===c.i; const arr=on?(jobsSort.dir>0?' ▲':' ▼'):'';
      return `<th class="sortable" data-sort="${c.i}">${esc(c.name)}<span class="arr">${arr}</span></th>`; }).join('');
  const view=jobsView();
  const body=document.getElementById('jobsBody');
  body.innerHTML=view.map(r=>`<tr data-id="${r.id}" class="${jobsSel.has(r.id)?'sel':''}">`+
    `<td><input type="checkbox" data-cb="${r.id}" ${jobsSel.has(r.id)?'checked':''}></td>`+
    jobsCols.map(c=>`<td>${jobCellHtml(c.name, String(r.cells[c.i]==null?'':r.cells[c.i]).trim())}</td>`).join('')+`</tr>`).join('');
  const removed=jobsRows.filter(r=>r.removed).length;
  const live=jobsRows.filter(r=>!r.removed);
  const iStatC=findCol(jobsHeader,'Status Code'), iPrioC=findCol(jobsHeader,'Priority');
  const cffN=iStatC>=0?live.filter(r=>norm(r.cells[iStatC])==='cff').length:0;
  const rushRe=/^[a-z]{1,3}$/i;
  const rushN=iPrioC>=0?live.filter(r=>rushRe.test(String(r.cells[iPrioC]||'').trim())).length:0;
  const winN=JOB_WINDOWS.size;
  document.getElementById('trimCount').textContent=`${view.length} jobs${removed?` · ${removed} removed`:''}${cffN?` · ${cffN} CFF`:''}${rushN?` · ${rushN} rush`:''}${winN?` · ${winN} windowed`:''} · ${jobsSel.size} selected`;
  document.getElementById('removeSelBtn').textContent=`Remove selected (${jobsSel.size})`;
  const all=document.getElementById('jobsAll');
  if(all) all.checked = view.length>0 && view.every(r=>jobsSel.has(r.id));
}
/* dispatch-style cell rendering for the import table: status chips, task
   badges, RUSH pulse, and due-date coloring by working-day distance */
function statusChipHtml(code){
  const v=String(code||'').trim(); if(!v) return '';
  const cls={cff:'job-status-cff','if':'job-status-if',fv:'job-status-fv',fe:'job-status-fe'}[norm(v)]||'';
  return `<span class="job-status ${cls}">${esc(v)}</span>`;
}
```

### OPTION 2: CREW MAP (depot preview)

```js
/* ==================== OPTION 2: CREW MAP (depot preview) ====================
   Territories are Option 1 and stay the default: they decide who gets what, but
   their start is welded in place, so a crew who moves for a week can't be
   re-pointed quickly. Option 2 is the other trade — every crew's home goes in as
   a depot on ONE upload, and Route4Me does the assigning. That's what used to
   scatter jobs onto crews you'd avoid, because nobody could see it coming.

   This is the seeing. We estimate the assignment from the crew starts, draw it,
   and let a start be dragged so the manager can shape the outcome before
   uploading rather than discovering it afterwards.

   What we can and cannot predict: assignment is driven by proximity and load, so
   it approximates well. SEQUENCING — stop order, drive times — is where Route4Me
   is genuinely clever and unpredictable, and we don't attempt it. Route4Me still
   makes the real call; file03 is the ground truth to check this against. */
const K_DEPOTS=RK+'depots_v1';
/* Option 2 appends each working crew's start as a Depot row, the way the very
   first version did. Territories set their own starts, so Option 1 leaves it
   off and ships orders only. */
let DEPOTS_ON=load(K_DEPOTS,false)===true;
let PREVIEW_STARTS={};      // crew index -> {lat,lng} dragged this session (not saved until asked)
let CREW_MAP_ON=false, crewMapInstance=null, crewJobLayer=null, crewPinLayer=null;
function crewColor(n){ return `hsl(${Math.round(n*137.508)%360} 72% 45%)`; }

/* Every job that has coordinates, resolved the same way the export resolves them. */
function jobPoints(){
  if(!jobsHeader) return [];
  const iSub=findCol(jobsHeader,'Subdiv Name'); if(iSub<0) return [];
  const iSec=findCol(jobsHeader,'Section'), iAddr=findCol(jobsHeader,'Address 1'),
        iTask=findCol(jobsHeader,'Description Of Problem');
  const idx=buildIndex(), out=[];
  for(const r of jobsRows){
    if(r.removed) continue;
    const m=matchSub(r.cells[iSub]!=null?r.cells[iSub]:'', idx, iSec>=0&&r.cells[iSec]!=null?r.cells[iSec]:'');
    if(!m.sub) continue;
    const lat=+m.sub.lat, lng=+m.sub.lng;
    if(!geoOk(lat,lng)) continue;
    out.push({id:r.id, lat, lng, sub:m.sub.name,
      addr:iAddr>=0?String(r.cells[iAddr]||'').trim():'', task:iTask>=0?String(r.cells[iTask]||'').trim():''});
  }
  return out;
}
/* Active crews with a usable start — the dragged position if there is one. */
function crewStarts(){
  const out=[];
  CREWS.forEach((c,i)=>{
    if(!isActive(c)) return;
    const mv=PREVIEW_STARTS[i];
    const lat=mv?mv.lat:+c.lat, lng=mv?mv.lng:+c.lng;
    if(!geoOk(lat,lng)) return;
    out.push({i, lat, lng, moved:!!mv, color:crewColor(out.length),
      name:`${c.name||''} ${c.last||''}`.trim()||c.code||`Crew ${i+1}`, code:c.code||''});
  });
  return out;
}
/* Nearest-start assignment, optionally capped the way Route4Me caps stops.
   Jobs are placed in order of how strongly they prefer one crew over the next
   (their "regret"), so the ones with a clear owner claim it before the
   toss-ups do — which is roughly how a solver settles them too. */
function previewAssign(pts, starts, cap){
  const byCrew=new Map(); starts.forEach(s=>byCrew.set(s.i,[]));
  const of=new Map();
  if(!starts.length) return {byCrew, of};
  const limit=cap>0?cap:Infinity;
  const ranked=pts.map(p=>{
    const ds=starts.map(s=>({i:s.i,d:haversineMi(p.lat,p.lng,s.lat,s.lng)})).sort((a,b)=>a.d-b.d);
    return {p, ds, regret: ds.length>1 ? ds[1].d-ds[0].d : Infinity};
  }).sort((a,b)=>b.regret-a.regret);
  for(const r of ranked){
    let pick=r.ds.find(c=>byCrew.get(c.i).length<limit) || r.ds[0];
    byCrew.get(pick.i).push(r.p.id);
    of.set(r.p.id,{crew:pick.i, mi:pick.d});
  }
  return {byCrew, of};
}
function toggleCrewMap(){
  CREW_MAP_ON=!CREW_MAP_ON;
  document.getElementById('crewMapPanel').classList.toggle('hide',!CREW_MAP_ON);
  document.getElementById('jobsTableWrap').classList.toggle('hide',CREW_MAP_ON);
  document.getElementById('crewMapBtn').classList.toggle('primary',CREW_MAP_ON);
  if(CREW_MAP_ON) renderCrewMap(true);
}
function renderCrewMap(fit){
  if(!CREW_MAP_ON) return;
  const wrap=document.getElementById('crewMapWrap');
  if(!crewMapInstance && !wrap.offsetWidth){ setTimeout(()=>renderCrewMap(fit),120); return; }
  if(!crewMapInstance){
    crewMapInstance=L.map('crewMapWrap',{zoomControl:true}).setView(REGION_CENTER,8);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap',maxZoom:19}).addTo(crewMapInstance);
    crewJobLayer=L.layerGroup().addTo(crewMapInstance);
    crewPinLayer=L.layerGroup().addTo(crewMapInstance);
  }
  setTimeout(()=>crewMapInstance.invalidateSize(),50);
  const pts=jobPoints(), starts=crewStarts();
  const capEl=document.getElementById('cmCap');
  const cap=capEl&&capEl.value?Math.max(1,+capEl.value):0;
  const {byCrew,of}=previewAssign(pts,starts,cap);
  const colorOf=new Map(starts.map(s=>[s.i,s.color]));

  /* Every job in a subdivision sits on that sub's single centroid, so drawing one
     dot per job stacks 20 jobs invisibly on top of 1. Group by location and size
     the dot by how much work is there — volume is the thing you're judging when
     you decide where a start belongs. */
  crewJobLayer.clearLayers();
  const bySpot=new Map();
  for(const p of pts){
    const k=p.lat+','+p.lng;
    let g=bySpot.get(k);
    if(!g){ g={lat:p.lat,lng:p.lng,sub:p.sub,n:0,crews:new Map(),mi:0}; bySpot.set(k,g); }
    g.n++;
    const a=of.get(p.id);
    if(a){ g.crews.set(a.crew,(g.crews.get(a.crew)||0)+1); g.mi=a.mi; }
  }
  const nameOf=new Map(starts.map(s=>[s.i,s.name]));
  for(const g of bySpot.values()){
    const ranked=[...g.crews.entries()].sort((a,b)=>b[1]-a[1]);
    const owner=ranked.length?ranked[0][0]:null;
    const col=owner!=null?colorOf.get(owner):'#9aa4b2';
    const split=ranked.length>1
      ? '<br>'+ranked.map(([c,n])=>`${esc(nameOf.get(c)||'?')} ${n}`).join(' · ')
      : (owner!=null?`<br><b>${esc(nameOf.get(owner)||'')}</b> · ${g.mi.toFixed(1)} mi`:'');
    L.circleMarker([g.lat,g.lng],{radius:Math.min(16,4+Math.sqrt(g.n)*2.2),
        color:col,weight:1,fillColor:col,fillOpacity:.7})
      .bindTooltip(`<b>${esc(g.sub)}</b><br>${g.n} job${g.n===1?'':'s'}${split}`,{sticky:true})
      .addTo(crewJobLayer);
  }
  crewPinLayer.clearLayers();
  for(const s of starts){
    const icon=L.divIcon({className:'',iconSize:[18,18],iconAnchor:[9,9],
      html:`<div style="width:18px;height:18px;border-radius:50%;background:${s.color};border:3px solid #fff;box-shadow:0 0 0 1.5px ${s.color},0 1px 4px rgba(0,0,0,.4)"></div>`});
    const mk=L.marker([s.lat,s.lng],{icon,draggable:true,zIndexOffset:1000})
      .bindTooltip(`<b>${esc(s.name)}</b>${s.code?' · '+esc(s.code):''}<br>${byCrew.get(s.i).length} job(s)${s.moved?'<br><i>moved</i>':''}<br><i>drag to try a different start</i>`,{sticky:true})
      .addTo(crewPinLayer);
    mk.on('dragend',e=>{ const ll=e.target.getLatLng();
      PREVIEW_STARTS[s.i]={lat:+ll.lat.toFixed(6),lng:+ll.lng.toFixed(6)};
      renderCrewMap(false); });
  }
  if(fit){
    const all=pts.map(p=>[p.lat,p.lng]).concat(starts.map(s=>[s.lat,s.lng]));
    const {keep}=fitCluster(all,500);          // a stray pin must not zoom us to the world
    if(keep.length) crewMapInstance.fitBounds(keep,{padding:[40,40]});
  }
  renderCrewSummary(starts,byCrew,of,pts.length);
}
function renderCrewSummary(starts,byCrew,of,total){
  const rows=starts.map(s=>{
    const ids=byCrew.get(s.i);
    const mi=ids.length?ids.reduce((a,id)=>a+of.get(id).mi,0)/ids.length:0;
    return {s, n:ids.length, mi};
  }).sort((a,b)=>b.n-a.n);
  document.getElementById('cmCrewBody').innerHTML=rows.map(r=>`<tr>
    <td><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${r.s.color};margin-right:7px"></span>${esc(r.s.name)}${r.s.moved?' <span class="badge sec">moved</span>':''}</td>
    <td>${r.n?r.n:'<span class="badge warn">0</span>'}</td><td>${r.n?r.mi.toFixed(1):'—'}</td></tr>`).join('')
    || '<tr><td colspan="3" class="muted">No active crews with a start location.</td></tr>';
  const starved=rows.filter(r=>!r.n).length;
  const moved=rows.filter(r=>r.s.moved).length;
  document.getElementById('cmSummary').textContent=
    `${total} job(s) across ${rows.length} crew(s)`+
    (starved?` · ${starved} would get nothing`:'')+(moved?` · ${moved} start(s) moved`:'');
}
const TASK_HUES=new Map(); // per-import golden-angle hues (set in loadFile01ForReview)
function taskColor(t){
  const k=norm(t);
  if(TASK_HUES.has(k)) return TASK_HUES.get(k);
  let h=0; for(let i=0;i<k.length;i++) h=(h*31+k.charCodeAt(i))>>>0; return h%360;
}
function taskBadgeHtml(t){
  const v=String(t||'').trim(); if(!v) return '';
  const h=taskColor(v);
  return `<span class="task-badge" style="color:hsl(${h} 65% 34%);background:hsl(${h} 65% 45% / .12);border-color:hsl(${h} 65% 45% / .4)">${esc(v)}</span>`;
}
function workdayDiff(key){ // working days from today to the date (negative = past); weekends skipped
  if(key==null) return null;
  const due=new Date(Math.floor(key/10000),Math.floor(key/100)%100-1,key%100);
  const t=new Date(), today=new Date(t.getFullYear(),t.getMonth(),t.getDate());
  if(due.getTime()===today.getTime()) return 0;
  const step=due>today?1:-1; let d=new Date(today), n=0;
  for(let i=0;i<250 && d.getTime()!==due.getTime();i++){ d.setDate(d.getDate()+step); if(d.getDay()!==0&&d.getDay()!==6) n+=step; }
  return n;
}
function jobCellHtml(colName, raw){
  if(colName==='Status Code') return statusChipHtml(raw);
  if(colName==='Description Of Problem') return taskBadgeHtml(raw);
  if(colName==='Priority'){
    if(/^[a-z]{1,3}$/i.test(raw)) return `<span class="rush-badge">${esc(raw.toUpperCase()==='R'?'RUSH':raw.toUpperCase())}</span>`;
    return esc(raw);
  }
  if(colName==='Schedule_Date'){
    const n=workdayDiff(parseDateKey(raw));
    if(n!=null && n<0) return `<span class="due-late">${esc(raw)}</span>`;
    if(n!=null && n<=1) return `<span class="due-soon">${esc(raw)}</span>`;
    return esc(raw);
  }
  return esc(raw);
}
function jobsClick(e){
  const tr=e.target.closest('tr[data-id]'); if(!tr) return;
  const id=+tr.dataset.id;
  const view=jobsView(), ids=view.map(r=>r.id);
  const isCb = e.target.matches('input[data-cb]');
  if(e.shiftKey && jobsAnchor!=null && ids.includes(jobsAnchor)){
    e.preventDefault();
    const a=ids.indexOf(jobsAnchor), b=ids.indexOf(id), lo=Math.min(a,b), hi=Math.max(a,b);
    for(let k=lo;k<=hi;k++) jobsSel.add(ids[k]);
  } else if(isCb || e.ctrlKey || e.metaKey){
    if(jobsSel.has(id)) jobsSel.delete(id); else jobsSel.add(id);
    jobsAnchor=id;
  } else {
    jobsSel.clear(); jobsSel.add(id); jobsAnchor=id;
  }
  renderJobs();
}
function finishExport(res){
  if(!res.matched){ showToast('Nothing geocoded — nothing to export. Resolve subs or set coordinates first.','err'); return; }
  if(res.schedFor) logMsg(`Scheduled For ${res.schedFor} stamped on every job`);
  if(res.prioOn){
    logMsg(`Priority matrix: ${res.prioApplied} of ${res.matched} prioritized${res.rushN?` (${res.rushN} letter-coded)`:''}; unmapped left blank`);
    if(res.prioUnmapped && res.prioUnmapped.size)
      logMsg(`No priority — these tasks have no row in Settings → Tasks: `+
        [...res.prioUnmapped].sort((a,b)=>b[1]-a[1]).map(([t,n])=>`${t} ×${n}`).join(', '),'warn');
  }
  if(res.unmatched.size) logMsg(`Dropped — unresolved subs: ${[...res.unmatched].map(([k,i])=>`${k||'(blank)'} ×${i.count}`).join(', ')}`,'warn');
  if(res.noCoords.size) logMsg(`Dropped — no coordinates yet: ${[...res.noCoords].map(([k,n])=>`${k} ×${n}`).join(', ')}`,'warn');
  if(res.depots) logMsg(`Depot rows appended: ${res.depots} crew start(s)${res.depotsMoved?`, ${res.depotsMoved} moved on the crew map`:''}`);
  if(res.svcOn) logMsg(`On-site minutes written as "${SVC_H}" from the task settings`);
  if(res.winOn) logMsg(`${res.windowed} job(s) carry a time window ("${WINF_H}"/"${WINT_H}")`);
  downloadFile02Res(res);
  const dropped=res.jobs-res.matched;
  showToast(`Downloaded ${res.outName} — ${res.matched} of ${res.jobs} jobs`+
    (res.depots?` + ${res.depots} depot${res.depots===1?'':'s'}`:'')+
    (dropped?` (${dropped} dropped, see Log)`:''), dropped?'warn':undefined);
  // an unsaved drag is easy to forget, and it just shipped
  if(res.depotsMoved) showToast(`${res.depotsMoved} start(s) came from the map and aren't saved — "Save moved starts" to keep them.`,'warn');
}
function runConvertRows(header, dataRows, autoDl){
  let res;
  try{ res=buildFile02([header, ...dataRows]); }
  catch(e){ showToast(e.message,'err'); return; }
  if(res.unmatched.size){
    // offer resolution once; skipping exports anyway, minus the unresolved jobs
    openUnmatchedModal(res.unmatched, ()=>runConvertRows(header,dataRows,autoDl), {onSkip:()=>finishExport(res)});
    return;
  }
  finishExport(res);
}

function downloadFile02Res(res){ download(res.outName, toCSV(res.rows), 'text/csv'); }
```

### BRING BACK (file03 -> file04)

```js
/* ============================ BRING BACK (file03 -> file04) ============================ */
let file01Text=null, file01Name=null, file03Text=null, lastFile04=null;

function crewByName(first,last){
  const nf=norm(first), nl=norm(last);
  let c=CREWS.find(x=>norm(x.name)===nf && norm(x.last||'')===nl);
  if(!c) c=CREWS.find(x=>norm(x.name)===nf); // fallback on first name
  return c||null;
}

/* CFF calc requests: short task labels + the companion-file text format
   (crew header F## - NAME:, subs alphabetical, • job - TASK (sched M/D)) */
function cffShortTask(t){
  const v=String(t||'').trim().toUpperCase();
  const map={'FORM SURVEY':'FORM','GRADE STAKING':'GRADE','RE-GRADE STAKE':'REGRADE',
    'FINAL SVY SWALE':'FINALS','SIGNED SLAB SVY':'SLAB','ENV W\\ELEV STK':'ENV'};
  return map[v] || v.split(/\s+/)[0] || '';
}
function buildCffText(items){
  if(!items.length) return '';
  const byCrew=new Map();
  for(const it of items){
    if(!byCrew.has(it.code)) byCrew.set(it.code,{name:it.name,subs:new Map()});
    const c=byCrew.get(it.code);
    const sub=(it.sub||'(no subdivision)').toUpperCase();
    if(!c.subs.has(sub)) c.subs.set(sub,[]);
    c.subs.get(sub).push(`    • ${it.job} - ${it.task}${it.sched?` (sched ${it.sched})`:''}`);
  }
  const parts=[];
  for(const code of [...byCrew.keys()].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}))){
    const c=byCrew.get(code);
    const lines=[`${code} - ${String(c.name||'').toUpperCase()}:`];
    for(const sub of [...c.subs.keys()].sort()) lines.push(`- ${sub}`, ...c.subs.get(sub));
    parts.push(lines.join('\n'));
  }
  return parts.join('\n\n');
}
function openCffModal(res){
  const root=document.getElementById('modalRoot');
  const crews=new Set(res.cffReq.map(x=>x.code)).size;
  root.innerHTML=`<div class="backdrop"><div class="modal" style="max-width:560px"><div class="mh"><h3>CFF calc requests</h3>
    <div class="muted" style="font-size:12.5px;margin-top:4px">${res.cffReq.length} assignment${res.cffReq.length===1?'':'s'} across ${crews} crew${crews===1?'':'s'}
    &mdash; these rows were dropped from the Sage import; send this to the calc department.</div></div>
  <div class="mb"><pre id="cffPre" style="margin:0;background:#f8fafc;border:1px solid var(--line);border-radius:8px;padding:12px;font-size:12.5px;line-height:1.55;max-height:48vh;overflow:auto;white-space:pre-wrap">${esc(res.cffText)}</pre></div>
  <div class="mf"><button id="cffDl" style="margin-right:auto">Download .txt</button>
    <button id="cffClose">Close</button><button class="primary" id="cffCopy">Copy</button></div></div></div>`;
  document.getElementById('cffClose').onclick=()=>root.innerHTML='';
  document.getElementById('cffDl').onclick=()=>download(`CFF Requests ${REGION} ${todayStamp()}.txt`, res.cffText, 'text/plain');
  document.getElementById('cffCopy').onclick=async()=>{
    try{ await navigator.clipboard.writeText(res.cffText); showToast('Copied'); }
    catch(e){
      const ta=document.createElement('textarea'); ta.value=res.cffText; document.body.appendChild(ta);
      ta.select(); try{ document.execCommand('copy'); showToast('Copied'); }catch(e2){ showToast('Copy failed — select the text manually'); }
      ta.remove();
    }
  };
}

function reverseConvert(f03Text, f01Text){
  if(!f01Text) throw new Error('Load the original Sage export (file01) first.');
  const f1 = parseCSV(f01Text).filter(r=>r.some(c=>String(c).trim()!==''));  // handles quoted or padded
  if(f1.length<2) throw new Error('file01 looks empty.');
  const f1cols = f1[0].map(s=>String(s).trim());
  const ix = n=>f1cols.findIndex(c=>norm(c)===norm(n));
  const iSvc=ix('Svc Job Num'), iSid=ix('Servicer Id'), iStat=ix('Status Code');
  if(iSvc<0||iSid<0||iStat<0) throw new Error('file01 is missing Svc Job Num / Servicer Id / Status Code columns.');
  const iMj=ix('Master Job'), iSb=ix('Subdiv Name'), iTk=ix('Description Of Problem'), iSd=ix('Schedule_Date');

  // file03 -> assignment map by Svc Job Num
  const f3rows=parseCSV(f03Text).filter(r=>r.some(c=>String(c).trim()!==''));
  if(!f3rows.length) throw new Error('file03 is empty.');
  const f3h=f3rows[0].map(s=>norm(s));
  const j3=(...names)=>{ for(const n of names){ const k=f3h.indexOf(norm(n)); if(k>=0) return k; } return -1; };
  const c3svc=j3('Svc Job Num'), c3f=j3('User_First_Name','User First Name'), c3l=j3('User_Last_Name','User Last Name');
  if(c3svc<0) throw new Error('file03 has no "Svc Job Num" column.');
  if(c3f<0||c3l<0) throw new Error('file03 has no User_First_Name / User_Last_Name columns.');
  const assign=new Map();
  for(let r=1;r<f3rows.length;r++){
    const svc=String(f3rows[r][c3svc]||'').trim();
    if(!svc) continue; // blank / depot / break row
    assign.set(svc,{first:String(f3rows[r][c3f]||'').trim(), last:String(f3rows[r][c3l]||'').trim()});
  }

  // Always emit the fixed 15-column Sage import template, pulling values by column NAME
  // (so a file02, a reordered export, etc. still produce the correct file04).
  const OUT_COLS=['Received Date','Servicer Id','Status Code','Builder Name','Master Job','Svc Job Num',
    'Address 1','Map Code','Subdiv Name','Section','Description Of Problem','Priority','Division','Title','Schedule_Date'];
  const srcIdx=OUT_COLS.map(n=>f1cols.findIndex(c=>norm(c)===norm(n)));
  const isDateName = n => norm(n)==='received date' || norm(n)==='schedule_date';
  const outRows=[ OUT_COLS.slice() ];  // canonical header
  const st={kept:0, out2if:0, feKept:0, fvKept:0, dropCFF:0, dropUnassigned:0};
  const cffReq=[]; // CFF rows with a routed crew that has a Field # -> calc requests
  const missingCode=new Map();   // "First Last" -> count (crew found, no code)
  const unknownCrew=new Map();   // "First Last" -> count (not in library)
  const f01svc=new Set();
  for(let li=1;li<f1.length;li++){
    const cells=f1[li];
    const status=String(cells[iStat]||'').trim();
    const svc=String(cells[iSvc]||'').trim();
    if(svc) f01svc.add(svc);
    if(status==='CFF'){
      // dropped from file04 (calc owns these) — but a routed CFF with a coded
      // crew becomes a calc request in the companion window
      st.dropCFF++;
      const a3=assign.get(svc);
      if(a3){ const cw=crewByName(a3.first,a3.last);
        if(cw && cw.code){
          const mj=iMj>=0?String(cells[iMj]||'').trim().replace(/^0+/,''):'';
          const sk=iSd>=0?parseDateKey(cells[iSd]):null;
          cffReq.push({code:cw.code, name:cw.name,
            sub:iSb>=0?String(cells[iSb]||'').trim():'',
            job:mj||svc, task:cffShortTask(iTk>=0?cells[iTk]:''),
            sched:sk!=null?`${Math.floor(sk/100)%100}/${sk%100}`:''});
        } }
      continue;
    }
    if(!assign.has(svc)){ st.dropUnassigned++; continue; }
    const a=assign.get(svc);
    const crew=crewByName(a.first,a.last);
    const who=`${a.first} ${a.last}`.trim();
    if(!crew) unknownCrew.set(who,(unknownCrew.get(who)||0)+1);
    else if(!crew.code) missingCode.set(who,(missingCode.get(who)||0)+1);
    const newSid = (crew && crew.code) ? crew.code : String(cells[iSid]||'').trim(); // keep original if no code
    const newStatus = status==='OUT' ? 'IF' : status; // FE/FV unchanged
    const rec = OUT_COLS.map((name,k)=>{
      const si=srcIdx[k];
      let v = si>=0 ? String(cells[si]==null?'':cells[si]).trim() : '';
      if(norm(name)==='servicer id') v=newSid;
      else if(norm(name)==='status code') v=newStatus;
      else if(isDateName(name)) v=toMMDDYY(v);
      return v;
    });
    outRows.push(rec);
    st.kept++;
    if(status==='OUT') st.out2if++; else if(status==='FE') st.feKept++; else if(status==='FV') st.fvKept++;
  }
  // mismatch signal: routed jobs (from file03) that aren't in this file01
  const routedTotal=assign.size;
  const routedMissing=[...assign.keys()].filter(s=>!f01svc.has(s)).length;
  const q = s => '"'+String(s==null?'':s).replace(/"/g,'""')+'"';
  const text = outRows.map(r=>r.map(q).join(',')).join('\n')+'\n';
  return {text, outName:`Sage Import ${REGION} ${todayStamp()}.csv`, st, missingCode, unknownCrew, routedTotal, routedMissing,
    cffReq, cffText:buildCffText(cffReq)};
}
function toMMDDYY(s){
  s=String(s==null?'':s).trim();
  const m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if(!m) return s; // not a M/D/Y date -> leave as-is
  const yy=m[3].length===4 ? m[3].slice(2) : m[3].padStart(2,'0');
  return `${m[1].padStart(2,'0')}/${m[2].padStart(2,'0')}/${yy}`;
}

function runReverse(){
  if(!file03Text){ showToast('Drop the Route4Me export (file03) first'); return; }
  let res;
  try{ res=reverseConvert(file03Text, file01Text); }
  catch(e){ showToast(e.message); return; }
  lastFile04=res;
  const s=res.st;
  logMsg(`file04 built: ${s.kept} rows (${s.out2if} OUT→IF, ${s.feKept+s.fvKept} FE/FV), ${s.dropCFF} CFF dropped, ${s.dropUnassigned} unassigned dropped`);
  if(res.routedMissing>0){
    const frac=res.routedTotal?Math.round(100*res.routedMissing/res.routedTotal):0;
    showToast(`file01 doesn't match: ${res.routedMissing} of ${res.routedTotal} routed jobs (${frac}%) aren't in the loaded file01 — load the right Sage export`,'err');
  }
  if(res.unknownCrew.size) showToast(`Unknown crew in file03: ${[...res.unknownCrew.keys()].join(', ')} — Servicer Id left unchanged`,'warn');
  if(res.missingCode.size) showToast(`Crews missing a Servicer Id code: ${[...res.missingCode.keys()].join(', ')} (Settings → Crews)`,'warn');
  const row=document.getElementById('bringResult');
  row.classList.remove('hide');
  const cffBtn=document.getElementById('cffBtn');
  if(res.cffReq.length){ cffBtn.classList.remove('hide'); cffBtn.onclick=()=>openCffModal(res);
    logMsg(`${res.cffReq.length} CFF calc request(s) across ${new Set(res.cffReq.map(x=>x.code)).size} crew(s)`); }
  else cffBtn.classList.add('hide');
  document.getElementById('bringSummary').textContent=
    `${s.kept} rows · ${s.out2if} OUT→IF · ${s.dropCFF} CFF dropped · ${s.dropUnassigned} unassigned dropped · ${res.outName}`;
}
function download4(){
  if(!lastFile04) return;
  const blob=new Blob([lastFile04.text],{type:'text/csv'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob); a.download=lastFile04.outName;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),2000);
}
function setFile01(text,name,fromStash){
  file01Text=text; file01Name=name;
  const rows=(text.split(/\r?\n/).filter(l=>l.trim()!=='').length-1);
  document.getElementById('f1status').innerHTML = `<b>file01:</b> ${esc(name)} &middot; ${rows} job rows${fromStash?' <span class="muted">(from your last Send)</span>':''}`;
}
```

### SUB RESOLUTION MODAL (fuzzy review cards)

```js
/* ============================ SUB RESOLUTION MODAL (fuzzy review cards) ============================ */
function openUnmatchedModal(unmatched, onResolvedRerun, opts){
  const atImport=!!(opts&&opts.mode==='import');
  const onSkip=opts&&opts.onSkip;
  // `raw` is the full place name (subdivision + section) — that is what gets matched,
  // saved as an alias, and used to name a newly created sub.
  const entries=[...unmatched.entries()].map(([raw,info],i)=>
    ({raw,count:info.count,name:info.name||raw,section:info.section||'',i,resolved:null}));
  const secChip=e=>e.section?` <span class="badge sec">Section ${esc(e.section)}</span>`:'';
  const root=document.getElementById('modalRoot');
  root.innerHTML=`
  <div class="backdrop">
    <div class="modal" style="max-width:760px">
      <div class="mh"><h3>Sub resolution &mdash; ${entries.length} place(s) need review</h3>
        <div class="muted" style="font-size:13px;margin-top:4px"><b>Match</b> routes this import only &middot; <b>Match + alias</b> also saves the spelling so future imports auto-resolve &middot; or pick any sub / create new.</div></div>
      <div class="mb" id="umBody"></div>
      <div class="mf">
        <button id="umSkip">${atImport?'Resolve later':'Skip — export without these jobs'}</button>
        <button class="primary" id="umDone" disabled>${atImport?'Done':'Re-convert'}</button>
      </div>
    </div>
  </div>`;
  const body=root.querySelector('#umBody');
  let resolvedN=0;
  const markResolved=(entry,subName,how)=>{
    entry.resolved=subName; resolvedN++;
    const card=body.querySelector(`[data-card="${entry.i}"]`);
    if(card){ card.classList.add('done');
      card.innerHTML=`<div class="review-head"><span class="raw">${esc(entry.name)}</span>${secChip(entry)}
        <span class="meta">&rarr; <b>${esc(subName)}</b> ${how==='alias'?'(alias saved)':how==='create'?'(new sub)':'(this import only)'}</span>
        <span class="badge ok" style="margin-left:auto">resolved</span></div>`; }
    document.getElementById('umDone').disabled = resolvedN===0;
  };
  const doMatch=(entry,subName,withAlias)=>{
    const s=SUBS.find(x=>norm(x.name)===norm(subName));
    if(!s){ showToast('Sub not found'); return; }
    if(withAlias){
      if(!Array.isArray(s.aliases)) s.aliases=[];
      if(!s.aliases.some(a=>norm(a)===norm(entry.raw))) s.aliases.push(entry.raw);
      persistSubs();
    } else {
      ONE_TIME_SUB.set(norm(entry.raw), s.name);
    }
    markResolved(entry,s.name,withAlias?'alias':'once');
  };
  for(const entry of entries){
    const card=document.createElement('div');
    card.className='review-card'; card.dataset.card=entry.i;
    const sugs=scoreSubs(entry.raw).filter(c=>c.score>=FUZZY_THRESHOLD).slice(0,3);
    const sugHtml = sugs.length
      ? `<div class="review-label">Suggestions</div>`+sugs.map(c=>`
          <div class="review-sug"><span class="name">${esc(c.name)}</span><span class="score">${c.score.toFixed(2)}</span>
            <span class="btns"><button class="small primary" data-m="${esc(c.name)}">Match</button>
            <button class="small" data-ma="${esc(c.name)}">Match + alias</button></span></div>`).join('')
      : `<div class="muted" style="font-size:12px;font-style:italic;padding:2px 0 4px">No close matches &mdash; pick below or create a new sub.</div>`;
    card.innerHTML=`
      <div class="review-head"><span class="raw">${esc(entry.name||'(blank)')}</span>${secChip(entry)}
        <span class="meta"><b>${entry.count}</b> job row${entry.count===1?'':'s'}</span></div>
      ${sugHtml}
      <div class="review-label">&mdash; or pick any existing sub (type to filter)</div>
      <div class="sub-picker" data-picker></div>
      <div class="review-label">&mdash; or create a new sub (lat/long optional; set later via KMZ or the map/library)</div>
      <div class="review-create">
        <input type="text" data-new-name placeholder="sub name" value="${esc(entry.raw)}">
        <input type="number" step="any" data-new-lat placeholder="lat">
        <input type="number" step="any" data-new-lng placeholder="long">
        <button class="primary small" data-create>Create</button>
      </div>`;
    body.appendChild(card);
    mountSubPicker(card.querySelector('[data-picker]'), (name,opts)=>doMatch(entry,name,!!(opts&&opts.alias)));
    card.addEventListener('click',e=>{
      const m=e.target.closest('[data-m]'), ma=e.target.closest('[data-ma]'), cr=e.target.closest('[data-create]');
      if(m) doMatch(entry,m.dataset.m,false);
      else if(ma) doMatch(entry,ma.dataset.ma,true);
      else if(cr){
        const name=card.querySelector('[data-new-name]').value.trim();
        if(!name){ showToast('Need a name'); return; }
        const latS=card.querySelector('[data-new-lat]').value.trim(), lngS=card.querySelector('[data-new-lng]').value.trim();
        const lat=latS===''?null:+latS, lng=lngS===''?null:+lngS;
        if((latS!==''&&!isFinite(lat))||(lngS!==''&&!isFinite(lng))){ showToast('Bad lat/long'); return; }
        const existing=SUBS.find(s=>norm(s.name)===norm(name));
        if(existing){ // collision: treat as match(+alias if spelled differently)
          if(lat!=null&&lng!=null){ existing.lat=lat; existing.lng=lng; }
          doMatch(entry,existing.name, norm(name)!==norm(entry.raw));
          persistSubs(); return;
        }
        const aliases = norm(name)!==norm(entry.raw)&&entry.raw ? [entry.raw] : [];
        SUBS.push({name,nickname:'',address:'',lat,lng,aliases});
        persistSubs();
        markResolved(entry,name,'create');
      }
    });
  }
  document.getElementById('umSkip').addEventListener('click',()=>{ root.innerHTML='';
    if(onSkip){ onSkip(); return; }
    if(atImport) showToast('Unresolved subs will be dropped from the export unless fixed before Build'); });
  document.getElementById('umDone').addEventListener('click',()=>{ root.innerHTML=''; renderSubs(); onResolvedRerun();
    if(!atImport) showToast('Re-converted with your matches'); });
}

/* Filter-as-you-type combo over all subs (names, nicknames, aliases). Ported from dispatch. */
function mountSubPicker(host,onPick){
  host.innerHTML='';
  const input=document.createElement('input');
  input.type='text'; input.placeholder='type to filter subs · "+ alias" also saves this spelling';
  const list=document.createElement('div'); list.className='sub-picker-list';
  host.appendChild(input); host.appendChild(list);
  let activeIdx=-1, matches=[];
  const render=()=>{
    const q=norm(input.value);
    matches=SUBS.filter(s=>{
      if(!q) return true;
      if(norm(s.name).includes(q)) return true;
      if(norm(s.nickname||'').includes(q)) return true;
      return (s.aliases||[]).some(a=>norm(a).includes(q));
    }).slice(0,50);
    if(!matches.length){ list.innerHTML=`<div class="sub-picker-empty">${SUBS.length?'no matches':'no subs yet'}</div>`; list.classList.add('open'); return; }
    list.innerHTML=matches.map((s,i)=>`<div class="sub-picker-item${i===activeIdx?' active':''}" data-idx="${i}">
      <span class="nm">${esc(s.name)}${(s.aliases||[]).length?` <span class="muted" style="font-size:10.5px">(${esc(s.aliases.join(', '))})</span>`:''}</span>
      <button type="button" class="sub-picker-alias" data-aidx="${i}" title="match AND save the raw spelling as an alias">+ alias</button></div>`).join('');
    list.classList.add('open');
  };
  const close=()=>{ list.classList.remove('open'); activeIdx=-1; };
  const pick=(idx,withAlias)=>{ const s=matches[idx]; if(!s) return; close(); onPick(s.name, withAlias?{alias:true}:undefined); };
  input.addEventListener('focus',render);
  input.addEventListener('input',()=>{ activeIdx=-1; render(); });
  input.addEventListener('keydown',e=>{
    if(!list.classList.contains('open')) return;
    if(e.key==='ArrowDown'){ e.preventDefault(); activeIdx=Math.min(matches.length-1,activeIdx+1); render(); }
    else if(e.key==='ArrowUp'){ e.preventDefault(); activeIdx=Math.max(0,activeIdx-1); render(); }
    else if(e.key==='Enter'){ e.preventDefault(); pick(activeIdx>=0?activeIdx:0, e.shiftKey); }
    else if(e.key==='Escape'){ e.preventDefault(); close(); input.blur(); }
  });
  list.addEventListener('mousedown',e=>{
    const ab=e.target.closest('[data-aidx]');
    if(ab){ e.preventDefault(); e.stopPropagation(); pick(+ab.dataset.aidx,true); return; }
    const it=e.target.closest('[data-idx]');
    if(!it) return; e.preventDefault(); pick(+it.dataset.idx,false);
  });
  input.addEventListener('blur',()=>setTimeout(close,120));
}
```

### SUBS LIBRARY (inline grid, dispatch-style)

```js
/* ============================ SUBS LIBRARY (inline grid, dispatch-style) ============================ */
function subHasGeo(s){ return s.lat!=null&&s.lat!==''&&s.lng!=null&&s.lng!==''; }
/* "Has coordinates" is not the same as "has usable coordinates". A swapped pair
   (28.5,-81.4 typed as -81.4,28.5) is a perfectly legal point — in the Southern
   Ocean — so it sails past every check and drags the map's bounds halfway round
   the planet, which is what leaves a market opening zoomed to the whole world
   and then labouring on every zoom. Range-check before anything reaches Leaflet. */
function geoOk(lat,lng){
  const a=+lat, o=+lng;
  return isFinite(a)&&isFinite(o)&&a>=-90&&a<=90&&o>=-180&&o<=180&&!(a===0&&o===0);
}
function subGeoOk(s){ return subHasGeo(s)&&geoOk(s.lat,s.lng); }
/* One stray pin should never decide the whole view. Fit to the points that sit
   with the bulk of the work and let the strays be found by looking, not by the
   map zooming out to include them. */
function fitCluster(pts, maxMi){
  if(pts.length<3) return {keep:pts, out:[]};
  const lats=pts.map(p=>p[0]).slice().sort((a,b)=>a-b);
  const lngs=pts.map(p=>p[1]).slice().sort((a,b)=>a-b);
  const mid=a=>a[Math.floor(a.length/2)];
  const cLat=mid(lats), cLng=mid(lngs);
  const keep=[], out=[];
  for(const p of pts) (haversineMi(p[0],p[1],cLat,cLng)<=(maxMi||500) ? keep : out).push(p);
  return keep.length ? {keep,out} : {keep:pts,out:[]};
}
const K_SUBSORT=RK+'subsort_v1';
let SUBS_SORT=load(K_SUBSORT,'az'); // 'az' | 'geo'
/* Morton (z-order) key: interleaves lat/lng bits so map-neighbors sort adjacent */
function mortonKey(lat,lng){
  const a=Math.max(0,Math.min(65535,Math.round((+lat+90)/180*65535)));
  const b=Math.max(0,Math.min(65535,Math.round((+lng+180)/360*65535)));
  let m=0;
  for(let i=15;i>=0;i--) m=m*4+((a>>i&1)*2+(b>>i&1));
  return m;
}
/* Group phases/sections of one subdivision under a folder — display only.
   "Elyson 12", "Elyson 13A" -> folder "Elyson". Records are never merged;
   every phase keeps its own row, coordinates and aliases. */
const FAM_TOK=/\s*[-–—,:]?\s*\(?\s*(?:(?:ph(?:ase)?|sec(?:tion)?|sect|unit|u|pod|pb|pbn|blk|block|tr|parcel|p|s)\s*-?\s*\d+[a-z]?(?:\.\d+)?|\d+\s*(?:ph(?:ase)?|sec(?:tion)?|s|p|u)\s*\d*[a-z]?|[a-z]?\d+[a-z]?(?:\.\d+)?)\s*\)?\s*$/i;
function subFamily(name){
  let s=String(name||'').trim();
  for(let i=0;i<4;i++){
    const t=s.replace(FAM_TOK,'').replace(/[\s\-–—,:(]+$/,'').trim();
    if(t===s || t.length<4) break;
    s=t;
  }
  return s;
}
const K_SUBFOLD=RK+'subfolders_v1';
let SUBS_FOLDERS=load(K_SUBFOLD,true)!==false;
const OPEN_FAMS=new Set();
function subsFilterList(){
  const q=norm(document.getElementById('subSearch').value);
  const list=SUBS.map((s,i)=>({s,i}))
    .filter(({s})=>!q || norm(s.name).includes(q) || norm(s.nickname||'').includes(q)
      || norm(s.address||'').includes(q) || (s.aliases||[]).some(a=>norm(a).includes(q)));
  if(SUBS_SORT==='geo'){
    list.sort((a,b)=>{
      const ga=subHasGeo(a.s), gb=subHasGeo(b.s);
      if(ga!==gb) return ga?-1:1;                    // no-coordinate subs sink to the bottom
      if(ga&&gb){ const d=mortonKey(a.s.lat,a.s.lng)-mortonKey(b.s.lat,b.s.lng); if(d) return d; }
      return a.s.name.localeCompare(b.s.name);
    });
  } else {
    list.sort((a,b)=>a.s.name.localeCompare(b.s.name));
  }
  return {list, filtered:!!q};
}
const SUBS_RENDER_CAP=400; // huge libraries: render the first N, filter to narrow
function renderSubs(){
  const body=document.getElementById('subsList');
  const {list}=subsFilterList();
  const head=document.getElementById('subsGridHead');
  head.className='subs-grid-head';
  head.innerHTML=`<div></div><div>Name</div><div>Nickname</div><div>Address</div><div>Lat / Long</div><div>Aliases</div><div style="text-align:right">Actions</div>`;
  const q0=norm(document.getElementById('subSearch').value);
  let entries=[], capped=false, shown=list, totalTop=list.length;
  if(SUBS_FOLDERS){
    const fams=new Map();
    for(const it of list){
      const key=norm(subFamily(it.s.name))||norm(it.s.name);
      if(!fams.has(key)) fams.set(key,{label:subFamily(it.s.name)||it.s.name,items:[]});
      fams.get(key).items.push(it);
    }
    for(const [key,f] of fams) entries.push(f.items.length>1?{folder:true,key,label:f.label,items:f.items}:{folder:false,...f.items[0]});
    totalTop=entries.length;
    // folder rows are cheap, so a grouped library can show far more at once
    const cap=Math.max(SUBS_RENDER_CAP,1600);
    capped=entries.length>cap;
    entries=capped?entries.slice(0,cap):entries;
    if(q0) entries.forEach(e=>{ if(e.folder) OPEN_FAMS.add(e.key); });   // searching reveals the matches
    shown=[];
    for(const e of entries){
      if(!e.folder){ shown.push(e); continue; }
      const open=OPEN_FAMS.has(e.key);
      const geo=e.items.filter(x=>subHasGeo(x.s)).length;
      shown.push({folderRow:true,key:e.key,label:e.label,n:e.items.length,geo,open});
      if(open) for(const it of e.items) shown.push({...it,inFolder:true});
    }
  } else {
    capped=list.length>SUBS_RENDER_CAP;
    shown=capped?list.slice(0,SUBS_RENDER_CAP):list;
  }
  body.innerHTML=shown.map(row=>{
    if(row.folderRow) return `<div class="sub-folder${row.open?' open':''}" data-fam="${esc(row.key)}">
      <span class="fchev">${row.open?'&#9662;':'&#9656;'}</span>
      <b>${esc(row.label)}</b>
      <span class="muted" style="font-size:12px">${row.n} phase${row.n===1?'':'s'}${row.geo<row.n?` · <span style="color:var(--warn)">${row.n-row.geo} without coordinates</span>`:''}</span>
    </div>`;
    const {s,i}=row;
    const geo=subHasGeo(s);
    return `<div class="sub-card2${row.inFolder?' nested':''}" data-i="${i}">
      <div style="display:flex;justify-content:center"><span class="dot ${geo?'dot-green':'dot-amber'}" title="${geo?'has coordinates':'no coordinates yet'}"></span></div>
      <input type="text" value="${esc(s.name)}" data-f="name" data-i="${i}" title="rename">
      <input type="text" value="${esc(s.nickname||'')}" data-f="nickname" data-i="${i}" placeholder="nickname&hellip;">
      <input type="text" value="${esc(s.address||'')}" data-f="address" data-i="${i}" placeholder="address (reference only)&hellip;">
      <div class="geo-cell ${geo?'ok':'no'}" data-geo="${i}" title="click to set / edit coordinates">
        ${geo?`${(+s.lat).toFixed(4)}<br>${(+s.lng).toFixed(4)}`:'no geo — set'}
      </div>
      <div class="alias-wrap">
        ${(s.aliases||[]).map((a,ai)=>`<span class="alias-chip"><span>${esc(a)}</span><button data-adel="${i}" data-ai="${ai}" title="remove alias">&times;</button></span>`).join('')}
        <button class="alias-add" data-aadd="${i}">+ alias</button>
      </div>
      <div class="sub-actions2">
        ${geo?`<button class="icon-btn" data-map="${i}" title="show on map">&#128205;</button>`:''}
        <button class="icon-btn danger" data-del="${i}" title="delete sub">&#128465;</button>
      </div>
    </div>`;}).join('') || `<div class="muted" style="text-align:center;padding:36px">${SUBS.length?'no subs match the filter':'no subs yet — add one or import'}</div>`;
  const withGeo=SUBS.filter(subHasGeo).length;
  document.getElementById('subCount').textContent=`${SUBS.length} subdivisions · ${withGeo} with coordinates${SUBS.length-withGeo?` · ${SUBS.length-withGeo} without`:''}${SUBS_FOLDERS&&list.length!==totalTop?` · ${totalTop} folders/rows`:''}${capped?` · showing first ${SUBS_FOLDERS?1600:SUBS_RENDER_CAP} of ${totalTop} — filter to narrow`:''}`;
  try{ renderSubsMap(false); }catch(e){ console.error(e); } // a map hiccup must never break the list
}

/* small modal: set/edit one sub's coordinates by pasting "lat, long" */
function openGeoEditor(i){
  const s=SUBS[i]; if(!s) return;
  const root=document.getElementById('modalRoot');
  const cur=subHasGeo(s)?`${s.lat}, ${s.lng}`:'';
  root.innerHTML=`<div class="backdrop"><div class="modal" style="max-width:440px">
    <div class="mh"><h3>Coordinates &mdash; ${esc(s.name)}</h3></div>
    <div class="mb">
      <label class="fld">Paste "lat, long" (e.g. from Google Maps right-click &rarr; copy)</label>
      <input type="text" id="geo_pair" value="${esc(cur)}" placeholder="28.187693, -81.553468">
      <div class="muted" style="font-size:11px;margin-top:6px">Leave empty and save to clear the coordinates.</div>
    </div>
    <div class="mf"><button id="geo_cancel">Cancel</button><button class="primary" id="geo_save">Save</button></div>
  </div></div>`;
  const inp=document.getElementById('geo_pair'); inp.focus(); inp.select();
  document.getElementById('geo_cancel').onclick=()=>root.innerHTML='';
  const commit=()=>{
    const v=inp.value.trim();
    if(!v){ s.lat=null; s.lng=null; persistSubs(); root.innerHTML=''; renderSubs(); showToast('Coordinates cleared'); return; }
    const m=v.match(/^\s*(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)\s*$/);
    if(!m){ showToast('Could not read that — paste like "28.1876, -81.5534"'); return; }
    let lat=+m[1], lng=+m[2];
    /* The common slip is pasting them the wrong way round. That lands in the
       Southern Ocean — a legal point, so nothing downstream would object, and
       the map would quietly zoom out to fit half the planet. Catch it here. */
    if(!geoOk(lat,lng)){ showToast('That is not a point on Earth — check the numbers','err'); return; }
    const away    = haversineMi(lat,lng,REGION_CENTER[0],REGION_CENTER[1]);
    const awaySwap = geoOk(lng,lat) ? haversineMi(lng,lat,REGION_CENTER[0],REGION_CENTER[1]) : Infinity;
    if(away>500 && awaySwap<500){
      if(confirm(`Those look swapped — ${lat}, ${lng} is ${Math.round(away)} miles from ${REGION}.\n\nUse ${lng}, ${lat} instead?`)){
        const t=lat; lat=lng; lng=t;
      }
    }
    s.lat=lat; s.lng=lng;
    persistSubs(); root.innerHTML=''; renderSubs(); showToast('Coordinates set');
  };
  document.getElementById('geo_save').onclick=commit;
  inp.addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); commit(); } });
}
```

### SUBS MAP (Leaflet — all subs + per-sub focus)

```js
/* ============================ SUBS MAP (Leaflet — all subs + per-sub focus) ============================ */
let subsMapInstance=null, subsMapLayer=null, subsMapInfoEl=null, _subsMapLastFilter=null, pendingSubFocus=null, _focusPin=null;
function mapAvailable(){ return typeof L!=='undefined'; }
function toggleSubsMap(force){
  const mapWrap=document.getElementById('subsMapWrap'), listWrap=document.getElementById('subsListWrap'), btn=document.getElementById('subsMapBtn');
  const show = force!==undefined ? force : mapWrap.classList.contains('hide');
  if(show && !mapAvailable()){ showToast('Map needs internet (Leaflet + OpenStreetMap tiles) — reconnect and reload'); return; }
  mapWrap.classList.toggle('hide',!show);
  listWrap.classList.toggle('hide',show);
  btn.classList.toggle('primary',show);
  if(show) renderSubsMap(true);
}
function renderSubsMap(fit){
  const wrap=document.getElementById('subsMapWrap');
  if(!wrap||wrap.classList.contains('hide')||!mapAvailable()) return;
  if(!subsMapInstance && !wrap.offsetWidth){ setTimeout(()=>renderSubsMap(fit),120); return; } // container not laid out yet
  if(!subsMapInstance){
    // SVG renderer (no preferCanvas): canvas was for the old 8k-sub company
    // page and is the renderer implicated in Chrome tab crashes
    subsMapInstance=L.map('subsMapWrap',{zoomControl:true}).setView(REGION_CENTER,8);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap',maxZoom:19}).addTo(subsMapInstance);
    subsMapLayer=L.layerGroup().addTo(subsMapInstance);
    const info=L.control({position:'topright'});
    info.onAdd=()=>{ subsMapInfoEl=L.DomUtil.create('div');
      subsMapInfoEl.style.cssText='background:rgba(255,255,255,.93);border:1px solid #d1d1d6;border-radius:6px;padding:5px 9px;font-size:11px;color:#3f3f46;box-shadow:0 1px 4px rgba(0,0,0,.15);line-height:1.5';
      return subsMapInfoEl; };
    info.addTo(subsMapInstance);
  }
  setTimeout(()=>subsMapInstance.invalidateSize(),50);
  subsMapLayer.clearLayers();
  const {list,filtered}=subsFilterList();
  const curFilter=norm(document.getElementById('subSearch').value);
  if(_subsMapLastFilter!==null && curFilter!==_subsMapLastFilter) fit=true;
  _subsMapLastFilter=curFilter;
  const located=list.filter(({s})=>subGeoOk(s));
  const bad=list.filter(({s})=>subHasGeo(s)&&!subGeoOk(s));
  const missing=list.length-located.length-bad.length;
  const pts=[];
  for(const {s,i} of located){
    const m=L.circleMarker([+s.lat,+s.lng],{radius:7,color:'#fff',weight:1.5,fillColor:REGION_COLOR,fillOpacity:.92});
    m.bindTooltip(esc(s.name),{direction:'top',offset:[0,-6]});
    m.bindPopup(`<div style="min-width:180px">
      <div style="font-weight:700;font-size:12.5px">${esc(s.name)}</div>
      ${s.nickname?`<div style="font-size:11px;color:#6b6b73">&ldquo;${esc(s.nickname)}&rdquo;</div>`:''}
      ${s.address?`<div style="font-size:11px;color:#6b6b73;margin-top:2px">${esc(s.address)}</div>`:''}
      <div style="font-size:11px;color:#6b6b73;margin-top:3px;font-variant-numeric:tabular-nums">${(+s.lat).toFixed(6)}, ${(+s.lng).toFixed(6)}</div>
    </div>`);
    subsMapLayer.addLayer(m);
    pts.push([+s.lat,+s.lng]);
  }
  const {keep,out}=fitCluster(pts,500);
  if(subsMapInfoEl) subsMapInfoEl.innerHTML=`<b>${located.length}</b> sub${located.length===1?'':'s'} shown${filtered?' (filtered)':''}`+
    `${missing?` · <span style="color:#d97706">${missing} without coordinates</span>`:''}`+
    `${bad.length?` · <span style="color:#dc2626">${bad.length} with impossible coordinates</span>`:''}`+
    `${out.length?` · <span style="color:#d97706">${out.length} far outside ${REGION}</span>`:''}`;
  if(bad.length){
    logMsg(`Impossible coordinates (not drawn) — ${bad.map(({s})=>`${s.name} [${s.lat}, ${s.lng}]`).join(', ')}`,'err');
    showToast(`${bad.length} sub(s) have impossible coordinates and were left off the map — see the Log.`,'err');
  }
  if(out.length) logMsg(`${out.length} sub(s) sit more than 500 miles from the rest of ${REGION}; the map fits the bulk, not them`,'warn');
  if(pendingSubFocus){
    const p=pendingSubFocus; pendingSubFocus=null;
    setTimeout(()=>{
      subsMapInstance.setView([p.lat,p.lng],15);
      if(_focusPin){ _focusPin.remove(); _focusPin=null; }
      _focusPin=L.circleMarker([p.lat,p.lng],{radius:13,color:REGION_COLOR,weight:3,fillOpacity:0}).addTo(subsMapInstance).bindTooltip(esc(p.name),{permanent:false});
      const check=()=>{ if(_focusPin && subsMapInstance.getZoom()<=13){ _focusPin.remove(); _focusPin=null; subsMapInstance.off('zoomend',check); } };
      subsMapInstance.on('zoomend',check);
    },80);
  } else if(fit&&keep.length) subsMapInstance.fitBounds(keep,{padding:[40,40]});
}
function focusSubOnMap(i){
  const s=SUBS[i]; if(!s||!subHasGeo(s)) return;
  if(!mapAvailable()){ showToast('Map needs internet (Leaflet + OpenStreetMap tiles)'); return; }
  pendingSubFocus={lat:+s.lat,lng:+s.lng,name:s.name};
  toggleSubsMap(true);
}
```

### CREWS TABLE

```js
/* ============================ CREWS TABLE ============================ */
function renderCrews(){
  const q=norm(document.getElementById('crewSearch').value);
  const body=document.getElementById('crewBody');
  const list=CREWS.map((c,i)=>({c,i})).filter(({c})=>!q||norm(c.name).includes(q));
  body.innerHTML=list.map(({c,i})=>{
    const on=isActive(c);
    return `
    <tr style="${on?'':'opacity:.5'}">
      <td><label class="switch"><input type="checkbox" data-togglecrew="${i}" ${on?'checked':''}><span class="track"></span></label></td>
      <td><b>${esc(c.name)} ${esc(c.last||'')}</b> ${on?'<span class="badge ok">Working</span>':'<span class="badge warn">Day off</span>'}${c.email?`<div class="muted" style="font-size:11px">${esc(c.email)}</div>`:''}</td>
      <td>${c.code?`<span class="chip" style="background:#eef6ff;color:#2563eb;font-weight:700">${esc(c.code)}</span>`:'<span class="badge err">no code</span>'}</td>
      <td class="pin">${(()=>{ const L=crewLocs(c), k=Math.min(c.locIdx||0,Math.max(L.length-1,0));
        if(L.length>1) return `<select data-crewloc="${i}" class="terr-select" style="width:100%;font-family:inherit">`+
          L.map((x,j)=>`<option value="${j}"${j===k?' selected':''}>${esc(x.label)} · ${(+x.lat).toFixed(4)}, ${(+x.lng).toFixed(4)}</option>`).join('')+`</select>`;
        return L.length?`${fmtCoord(c.lat)}, ${fmtCoord(c.lng)}`:'<span class="badge warn">no home</span>'; })()}</td>
      <td><button class="small" data-editcrew="${i}">Edit</button> <button class="small danger" data-delcrew="${i}">Del</button></td>
    </tr>`;}).join('');
  const activeN=CREWS.filter(isActive).length;
  document.getElementById('crewCount').textContent=`${activeN} of ${CREWS.length} crews working${q?` (${list.length} shown)`:''}`;
}
```

### EDIT MODALS

```js
/* ============================ EDIT MODALS ============================ */
function editSubModal(i){
  const isNew=i<0;
  const s=isNew?{name:'',nickname:'',address:'',lat:'',lng:'',aliases:[]}:SUBS[i];
  const root=document.getElementById('modalRoot');
  root.innerHTML=`<div class="backdrop"><div class="modal"><div class="mh"><h3>${isNew?'Add':'Edit'} subdivision</h3></div>
    <div class="mb">
      <div class="split" style="margin-bottom:12px">
        <div><label class="fld">Name</label><input type="text" id="e_name" value="${esc(s.name)}"></div>
        <div><label class="fld">Nickname (optional)</label><input type="text" id="e_nick" value="${esc(s.nickname||'')}"></div>
      </div>
      <div style="margin-bottom:12px"><label class="fld">Address (optional, reference only &mdash; never geocoded)</label><input type="text" id="e_addr" value="${esc(s.address||'')}"></div>
      <div class="split" style="margin-bottom:12px">
        <div><label class="fld">Latitude (optional &mdash; can come from KMZ later)</label><input type="number" step="any" id="e_lat" value="${s.lat==null?'':s.lat}"></div>
        <div><label class="fld">Longitude</label><input type="number" step="any" id="e_lng" value="${s.lng==null?'':s.lng}"></div>
      </div>
      <div><label class="fld">Aliases (one per line &mdash; the shortened/misspelled Sage forms)</label>
        <textarea id="e_aliases" style="width:100%;min-height:90px;font:inherit;padding:8px 10px;border:1px solid var(--line);border-radius:8px">${esc((s.aliases||[]).join('\n'))}</textarea></div>
    </div>
    <div class="mf"><button id="e_cancel">Cancel</button><button class="primary" id="e_save">Save</button></div>
  </div></div>`;
  document.getElementById('e_cancel').onclick=()=>root.innerHTML='';
  document.getElementById('e_save').onclick=()=>{
    const name=document.getElementById('e_name').value.trim();
    const lat=document.getElementById('e_lat').value.trim();
    const lng=document.getElementById('e_lng').value.trim();
    if(!name){ showToast('Name is required'); return; }
    if((lat==='')!==(lng==='')){ showToast('Enter both lat & long, or neither'); return; }
    if(lat!==''&&(!isFinite(+lat)||!isFinite(+lng))){ showToast('Valid lat & long required'); return; }
    const rec={name,nickname:document.getElementById('e_nick').value.trim(),address:document.getElementById('e_addr').value.trim(),
      lat:lat===''?null:+lat,lng:lng===''?null:+lng,
      aliases:document.getElementById('e_aliases').value.split('\n').map(x=>x.trim()).filter(Boolean)};
    if(isNew) SUBS.push(rec); else SUBS[i]=rec;
    persistSubs(); root.innerHTML=''; renderSubs(); showToast('Saved');
  };
}
function editCrewModal(i){
  const isNew=i<0;
  const c=isNew?{name:'',last:'',code:'',lat:'',lng:''}:CREWS[i];
  const root=document.getElementById('modalRoot');
  root.innerHTML=`<div class="backdrop"><div class="modal"><div class="mh"><h3>${isNew?'Add':'Edit'} crew</h3></div>
    <div class="mb">
      <div class="split" style="margin-bottom:12px">
        <div><label class="fld">First name</label><input type="text" id="c_name" value="${esc(c.name)}" placeholder="Hunter">
          <div class="muted" style="font-size:11px;margin-top:4px">Home location &mdash; used as a Route4Me start location reference</div></div>
        <div><label class="fld">Last name</label><input type="text" id="c_last" value="${esc(c.last||'')}" placeholder="Cope">
          <div class="muted" style="font-size:11px;margin-top:4px">Must match the Route4Me driver name</div></div>
      </div>
      <div class="split" style="margin-bottom:12px">
        <div><label class="fld">Servicer Id / crew code</label><input type="text" id="c_code" value="${esc(c.code||'')}" placeholder="F85">
          <div class="muted" style="font-size:11px;margin-top:4px">Written into Servicer Id on the way back to Sage</div></div>
        <div><label class="fld">Work email (optional)</label><input type="text" id="c_email" value="${esc(c.email||'')}" placeholder="name@company.com"></div>
      </div>
      <label class="fld">Start locations</label>
      <div id="c_locs" style="margin-bottom:10px"></div>
      <div class="row" style="gap:8px;flex-wrap:wrap">
        <input type="text" id="c_llabel" placeholder="Label (2nd Home, Yard…)" style="flex:1;min-width:150px">
        <input type="number" step="any" id="c_lat" placeholder="Latitude" style="width:150px">
        <input type="number" step="any" id="c_lng" placeholder="Longitude" style="width:150px">
        <button class="small" id="c_ladd">Add location</button>
      </div>
      <div class="muted" style="font-size:11px;margin-top:6px">The selected location is the crew&rsquo;s start point; switch it any time from the Crews list.</div>
    </div>
    <div class="mf"><button id="c_cancel">Cancel</button><button class="primary" id="c_save">Save</button></div>
  </div></div>`;
  const draft=isNew?{locs:[],locIdx:0}:c;
  const drawLocs=()=>{
    const L=crewLocs(draft), k=Math.min(draft.locIdx||0,Math.max(L.length-1,0));
    document.getElementById('c_locs').innerHTML = L.length ? L.map((x,j)=>`
      <div style="display:flex;align-items:center;gap:8px;padding:6px 8px;border:1px solid var(--line);border-radius:8px;margin-bottom:5px">
        <input type="radio" name="cloc" data-lpick="${j}" ${j===k?'checked':''} title="use as start location">
        <input type="text" data-llabel="${j}" value="${esc(x.label)}" style="flex:1;padding:4px 8px;font-size:12.5px">
        <span class="pin" style="font-size:11.5px">${(+x.lat).toFixed(6)}, ${(+x.lng).toFixed(6)}</span>
        <button class="icon-btn danger" data-ldel="${j}" title="remove">&times;</button>
      </div>`).join('') : '<div class="muted" style="font-size:12px;padding:4px 0">No location yet — add one below.</div>';
    document.getElementById('c_locs').querySelectorAll('[data-lpick]').forEach(r=>r.onclick=()=>{ crewSetLoc(draft,+r.dataset.lpick); drawLocs(); });
    document.getElementById('c_locs').querySelectorAll('[data-llabel]').forEach(inp=>inp.onchange=()=>{ crewLocs(draft)[+inp.dataset.llabel].label=inp.value.trim()||'Location'; });
    document.getElementById('c_locs').querySelectorAll('[data-ldel]').forEach(b=>b.onclick=()=>{
      const L=crewLocs(draft); L.splice(+b.dataset.ldel,1); crewSetLoc(draft,0); drawLocs(); });
  };
  drawLocs();
  document.getElementById('c_ladd').onclick=()=>{
    const la=parseFloat(document.getElementById('c_lat').value), lo=parseFloat(document.getElementById('c_lng').value);
    if(!isFinite(la)||!isFinite(lo)){ showToast('Enter a valid latitude and longitude'); return; }
    const lbl=document.getElementById('c_llabel').value.trim();
    if(!crewAddLoc(draft,lbl,la,lo)){ showToast('That spot is already listed'); return; }
    document.getElementById('c_llabel').value=''; document.getElementById('c_lat').value=''; document.getElementById('c_lng').value='';
    drawLocs();
  };
  document.getElementById('c_cancel').onclick=()=>root.innerHTML='';
  document.getElementById('c_save').onclick=()=>{
    const name=document.getElementById('c_name').value.trim();
    if(!name){ showToast('Crew name required'); return; }
    const L=crewLocs(draft);
    if(!L.length){ showToast('Add at least one start location'); return; }
    crewSetLoc(draft,Math.min(draft.locIdx||0,L.length-1));
    const rec={name,last:document.getElementById('c_last').value.trim(),code:document.getElementById('c_code').value.trim(),
      email:document.getElementById('c_email').value.trim(),
      locs:L,locIdx:draft.locIdx||0,lat:draft.lat,lng:draft.lng,active:isNew?true:isActive(CREWS[i])};
    if(isNew) CREWS.push(rec); else CREWS[i]=rec;
    persistCrews(); root.innerHTML=''; renderCrews(); showToast('Saved');
  };
}
```

### KMZ IMPORT (update library from Google Earth files)

```js
/* ============================ KMZ IMPORT (update library from Google Earth files) ============================ */
async function inflateRaw(bytes){
  if(typeof DecompressionStream==='undefined') throw new Error('This browser can’t unzip KMZ (needs a newer browser).');
  const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
/* ---- generic ZIP helpers (xlsx is a zip of XML) ---- */
function zipEntries(arrayBuffer){
  const dv=new DataView(arrayBuffer), u8=new Uint8Array(arrayBuffer);
  let eocd=-1;
  for(let i=u8.length-22;i>=0;i--){ if(dv.getUint32(i,true)===0x06054b50){ eocd=i; break; } }
  if(eocd<0) throw new Error('Not a valid .xlsx file.');
  const cdOff=dv.getUint32(eocd+16,true), cdCount=dv.getUint16(eocd+10,true);
  let p=cdOff; const out=[];
  for(let n=0;n<cdCount;n++){
    if(dv.getUint32(p,true)!==0x02014b50) break;
    const method=dv.getUint16(p+10,true), compSize=dv.getUint32(p+20,true);
    const nameLen=dv.getUint16(p+28,true), extraLen=dv.getUint16(p+30,true), commentLen=dv.getUint16(p+32,true);
    const localOff=dv.getUint32(p+42,true);
    out.push({name:new TextDecoder().decode(u8.subarray(p+46,p+46+nameLen)), method, compSize, localOff});
    p+=46+nameLen+extraLen+commentLen;
  }
  return out;
}
async function zipExtract(arrayBuffer, entry){
  const dv=new DataView(arrayBuffer), u8=new Uint8Array(arrayBuffer);
  if(dv.getUint32(entry.localOff,true)!==0x04034b50) throw new Error('Corrupt zip entry.');
  const dataStart=entry.localOff+30+dv.getUint16(entry.localOff+26,true)+dv.getUint16(entry.localOff+28,true);
  const comp=u8.subarray(dataStart, dataStart+entry.compSize);
  return entry.method===0?comp:await inflateRaw(comp);
}
/* Parse the first worksheet of an .xlsx into a 2-D string grid. */
async function parseXlsxGrid(arrayBuffer){
  const entries=zipEntries(arrayBuffer);
  const sheet=entries.filter(e=>/^xl\/worksheets\/sheet\d+\.xml$/i.test(e.name))
    .sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true}))[0];
  if(!sheet) throw new Error('No worksheet found inside the Excel file.');
  let shared=[];
  const ss=entries.find(e=>e.name.toLowerCase()==='xl/sharedstrings.xml');
  if(ss){
    const doc=new DOMParser().parseFromString(new TextDecoder().decode(await zipExtract(arrayBuffer,ss)),'application/xml');
    shared=[...doc.getElementsByTagNameNS('*','si')].map(si=>si.textContent);
  }
  const doc=new DOMParser().parseFromString(new TextDecoder().decode(await zipExtract(arrayBuffer,sheet)),'application/xml');
  if(doc.getElementsByTagName('parsererror').length) throw new Error('Couldn’t read the worksheet XML.');
  const rows=[];
  for(const rowEl of doc.getElementsByTagNameNS('*','row')){
    const cells=[];
    let auto=0;
    for(const c of rowEl.getElementsByTagNameNS('*','c')){
      const ref=c.getAttribute('r')||'';
      const letters=(ref.match(/^[A-Z]+/i)||[])[0];
      let idx=auto;
      if(letters){ idx=0; for(const ch of letters.toUpperCase()) idx=idx*26+(ch.charCodeAt(0)-64); idx--; }
      auto=idx+1;
      const t=c.getAttribute('t');
      let v='';
      if(t==='inlineStr') v=c.textContent;
      else{
        const vEl=c.getElementsByTagNameNS('*','v')[0];
        v=vEl?vEl.textContent:'';
        if(t==='s') v=shared[+v]!=null?shared[+v]:'';
      }
      cells[idx]=v;
    }
    rows.push(cells);
  }
  return rows;
}

/* ---- Geotab zones import: name + centroid lat/long, customer zones only ---- */
async function processZonesFile(f){
  try{
    setKmzStatus(`Reading ${esc(f.name)}&hellip;`);
    const grid=/\.csv$/i.test(f.name) ? parseCSV(await f.text()) : await parseXlsxGrid(await f.arrayBuffer());
    // find the header row: needs a latitude and a longitude column
    let hr=-1, iName=-1, iLat=-1, iLng=-1, iType=-1;
    for(let r=0;r<Math.min(12,grid.length);r++){
      const cells=(grid[r]||[]).map(c=>norm(c));
      const li=cells.findIndex(c=>/lat/.test(c));
      const gi=cells.findIndex(c=>/(lon|lng)/.test(c));
      if(li>=0 && gi>=0 && li!==gi){
        hr=r; iLat=li; iLng=gi;
        iName=cells.findIndex(c=>c==='name' || c==='zone name');
        if(iName<0) iName=cells.findIndex(c=>/name/.test(c));
        iType=cells.findIndex(c=>/type/.test(c));
        break;
      }
    }
    if(hr<0) throw new Error('No Latitude/Longitude columns found. First row seen: '+((grid[0]||[]).filter(Boolean).slice(0,8).join(', ')||'(empty)'));
    if(iName<0) throw new Error('No Name column found next to the coordinates.');
    const locs=[]; let nonCustomer=0, badCoord=0;
    LAST_SCAN_REPORT=[];
    for(let r=hr+1;r<grid.length;r++){
      const row=grid[r]||[];
      const name=String(row[iName]==null?'':row[iName]).trim();
      if(!name) continue;
      const type=iType>=0?String(row[iType]==null?'':row[iType]).trim():'';
      if(iType>=0 && !/customer/i.test(type)){
        nonCustomer++;
        LAST_SCAN_REPORT.push({folder:'Geotab zones',file:f.name,status:'skipped — not a customer zone',map:name,kind:'zone',lat:'',lng:'',resolution:'',note:type});
        continue;
      }
      const lat=parseFloat(row[iLat]), lng=parseFloat(row[iLng]);
      if(!isFinite(lat)||!isFinite(lng)||(lat===0&&lng===0)){
        badCoord++;
        LAST_SCAN_REPORT.push({folder:'Geotab zones',file:f.name,status:'error',map:name,kind:'zone',lat:'',lng:'',resolution:'',note:'bad coordinates'});
        continue;
      }
      const rep={folder:'Geotab zones',file:f.name,status:'zone',map:name,kind:'zone',lat:rnd(lat),lng:rnd(lng),resolution:'',note:type};
      LAST_SCAN_REPORT.push(rep);
      locs.push({name,lat,lng,kind:'zone',src:f.name,dir:'Geotab zones',_rep:rep});
    }
    // territory filter: company-wide exports carry other regions' zones. Your own
    // library defines the service area — keep zones within ZONES_NEAR_MI of any
    // library sub that has coordinates; park the rest behind a button.
    const geoSubs=SUBS.filter(subHasGeo);
    let near=locs, far=[];
    if(geoSubs.length){
      near=[];
      for(const L of locs){
        let ok=false;
        for(const s of geoSubs){ if(haversineMi(L.lat,L.lng,+s.lat,+s.lng)<=ZONES_NEAR_MI){ ok=true; break; } }
        if(ok) near.push(L);
        else{ far.push(L); if(L._rep){ L._rep.status='skipped — outside territory'; L._rep.note=(L._rep.note?L._rep.note+' · ':'')+`>${ZONES_NEAR_MI} mi from any library sub`; } }
      }
    }
    ZONES_FAR_PENDING=far;
    const notes=[];
    if(nonCustomer) notes.push(`${nonCustomer} non-customer zone(s) skipped`);
    if(far.length) notes.push(`${far.length} outside your territory (&gt;${ZONES_NEAR_MI} mi from any library sub)`);
    if(iType<0) notes.push('no zone-type column — imported all zones');
    if(badCoord) notes.push(`${badCoord} with bad coordinates`);
    const farBtn = far.length?` <button class="small" data-zones-far>Review far zones (${far.length})</button>`:'';
    if(!near.length){
      setKmzStatus(`<b>Zones import:</b> no customer zones inside your territory in ${esc(f.name)}${notes.length?' · '+notes.join(' · '):''}.${farBtn}${KMZ_REPORT_BTN}`);
      return;
    }
    openKmzReview(near, [], null, 0, ` · ${near.length} customer zone(s) from ${esc(f.name)}${notes.length?' · '+notes.join(' · '):''}${farBtn}`);
  }catch(e){ setKmzStatus(`<b>Zones import failed:</b> ${esc(e.message)}`); }
}
const ZONES_NEAR_MI=75;
let ZONES_FAR_PENDING=[];

/* ---- Crew Setup Template import (managers fill the xlsx, dispatch imports it) ---- */
async function processCrewsFile(f){
  try{
    const grid=/\.csv$/i.test(f.name) ? parseCSV(await f.text()) : await parseXlsxGrid(await f.arrayBuffer());
    let hr=-1, iFirst=-1, iLast=-1, iMail=-1, iCode=-1, iLat=-1, iLng=-1, iZone=-1;
    for(let r=0;r<Math.min(12,grid.length);r++){
      const cells=(grid[r]||[]).map(c=>norm(c));
      const fi=cells.findIndex(c=>/first/.test(c));
      const la=cells.findIndex(c=>/lat/.test(c));
      const lo=cells.findIndex(c=>/(lon|lng)/.test(c));
      if(fi>=0 && la>=0 && lo>=0 && la!==lo){
        hr=r; iFirst=fi; iLat=la; iLng=lo;
        iLast=cells.findIndex(c=>/last/.test(c));
        iMail=cells.findIndex(c=>/mail/.test(c));
        iCode=cells.findIndex(c=>/servicer|f##|code/.test(c));
        iZone=cells.findIndex(c=>/zone|reference|label/.test(c));
        break;
      }
    }
    if(hr<0) throw new Error('Not the crew template — need First Name + Home Latitude/Longitude columns. First row seen: '+((grid[0]||[]).filter(Boolean).slice(0,6).join(', ')||'(empty)'));
    let added=0, updated=0, skipped=0, extraLocs=0;
    for(let r=hr+1;r<grid.length;r++){
      const row=grid[r]||[];
      const first=String(row[iFirst]==null?'':row[iFirst]).trim();
      if(!first) continue;
      if(/^example/i.test(first)){ skipped++; continue; }        // template's sample row
      const last=iLast>=0?String(row[iLast]==null?'':row[iLast]).trim():'';
      const email=iMail>=0?String(row[iMail]==null?'':row[iMail]).trim():'';
      const code=iCode>=0?String(row[iCode]==null?'':row[iCode]).trim():'';
      const label=iZone>=0?String(row[iZone]==null?'':row[iZone]).trim():'';
      const lat=parseFloat(row[iLat]), lng=parseFloat(row[iLng]);
      if(!isFinite(lat)||!isFinite(lng)){ skipped++; continue; }
      let c=CREWS.find(x=>norm(x.name)===norm(first) && norm(x.last||'')===norm(last));
      if(!c && code) c=CREWS.find(x=>norm(x.code||'')===norm(code));
      // same first name with no last name on file (prefilled-template rows) -> same person, fill it in
      if(!c) c=CREWS.find(x=>norm(x.name)===norm(first) && !String(x.last||'').trim());
      // same first name living at the same spot (<=0.5 mi) -> same person
      if(!c) c=CREWS.find(x=>norm(x.name)===norm(first) && isFinite(+x.lat) && haversineMi(+x.lat,+x.lng,lat,lng)<=0.5);
      if(c){
        c.name=first; c.last=last;
        if(email) c.email=email;
        if(code) c.code=code;
        // a second row for the same person is another known start location
        if(crewAddLoc(c,label,lat,lng) && crewLocs(c).length>1) extraLocs++;
        else { const L=crewLocs(c); const k=L.findIndex(x=>haversineMi(+x.lat,+x.lng,lat,lng)<=0.1); if(k>=0){ L[k].lat=lat; L[k].lng=lng; if(label) L[k].label=label; crewSetLoc(c,k); } }
        updated++;
      } else {
        const rec={name:first,last,email,code,lat,lng,active:true,locs:[{label:label||'Home',lat,lng}],locIdx:0};
        CREWS.push(rec);
        added++;
      }
    }
    if(!added && !updated) throw new Error('No usable crew rows found'+(skipped?` (${skipped} skipped — missing name or lat/long)`:'')+'.');
    persistCrews(); renderCrews();
    showToast(`Crews imported: ${added} added, ${updated} updated${extraLocs?`, ${extraLocs} extra start location(s)`:''}${skipped?`, ${skipped} skipped`:''}`);
  }catch(e){ showToast('Crew import failed: '+e.message); }
}
function matchSubForKmz(name, idx){
  let m=matchSub(name, idx);              // exact / alias / (KMZ shorter than library)
  if(m.sub) return m;
  m=matchSub(cleanNewName(name), idx);    // retry with stray chars / lot codes cleaned ("Parkview at Hamlin." / "Everbe 1A-3")
  if(m.sub) return m;
  const n=norm(name);                     // KMZ often longer ("... Phase 3") -> longest library prefix wins
  let best=null, bestLen=0;
  for(const s of SUBS) for(const c of [s.name, ...(s.aliases||[])]){ const nc=norm(c);
    if(nc && (n===nc || n.startsWith(nc+' ')) && nc.length>bestLen){ best=s; bestLen=nc.length; } }
  return best ? {sub:best, how:'phase'} : {sub:null, how:'miss'};
}
function stripPhase(n){ return String(n||'').replace(/\s+(phase|ph|sht|sheet|unit|pod|parcel|section|sec)\s*\d.*$/i,'').trim()||String(n||''); }
/* clean a KMZ-derived sub name: strip phase suffixes, image extensions, trailing
   digit-led lot/section codes ("Everbe 1A-10" -> "Everbe"), and stray separators */
function cleanNewName(s){
  let v=stripPhase(s)
    .replace(/\.(png|jpe?g|pdf|tiff?)$/i,'')
    .replace(/(\s+\d+[a-z]?(?:-\d+[a-z]?)?)+$/i,'')            // trailing digit-led codes: " 2", " 1A", " 1A-10"
    .replace(/^[\s\/\\\-_.,;:]+/,'').replace(/[\s\/\\\-_.,;:]+$/,'').trim();
  return v||String(s||'').trim();
}
function rnd(v){ return Math.round(Number(v)*1e6)/1e6; }
/* alias-confirm rule: fuzzy name match >= score AND pin within N miles */
const ALIAS_SCORE=0.70, ALIAS_MILES=1;
function haversineMi(lat1,lng1,lat2,lng2){
  const R=3958.8, toR=x=>x*Math.PI/180;
  const dLat=toR(lat2-lat1), dLng=toR(lng2-lng1);
  const a=Math.sin(dLat/2)**2 + Math.cos(toR(lat1))*Math.cos(toR(lat2))*Math.sin(dLng/2)**2;
  return 2*R*Math.asin(Math.sqrt(a));
}
/* ---- crawl/read cancellation ---- */

/* ---- noise filter: word list that marks non-subdivision KMZs (editable, persisted) ---- */
const K_KMZNOISE=RK+'kmznoise_v1';
const KMZNOISE_DEFAULT=['asbuilt','as built','benchmark','topo','bndy','boundary','control','flood','fema','easement','esmt','utility','utilities','drainage','lot','block','exhibit','detail','sketch','untitled','place marker'];
let KMZNOISE=load(K_KMZNOISE,KMZNOISE_DEFAULT);
function persistKmzNoise(){ save(K_KMZNOISE,KMZNOISE); }
const K_KMZNOISEPAT=RK+'kmznoisepat_v1';
let KMZNOISE_PATTERNS=load(K_KMZNOISEPAT,true);
/* Files with more than this many point-pins are reference databases (benchmark
   sets, monument lists), not subdivisions — their pins are dropped wholesale.
   Overlays (site plans) are never affected. 0 disables. */
/* Folder names the scan never descends into (segment match, case-insensitive). */
function isNoiseName(name){
  const cleaned=norm(String(name==null?'':name).replace(/\.(kmz|kml)$/i,'').replace(/[_\-.]/g,' ')).trim();
  const n=' '+cleaned+' ';
  if(KMZNOISE.some(w=>{ const t=norm(String(w).replace(/[_\-.]/g,' ')); return t && (n.includes(' '+t+' ')||n.includes(' '+t+'s ')); })) return true;
  if(KMZNOISE_PATTERNS){
    // road designators: I95, I-4, SR 417, US 27, CR 535, HWY 50, FL 46, Tpke ramps
    if(/(^| )(?:i|sr|us|cr|hwy|fl|tpke?) ?\d{1,4}( |$)/.test(cleaned)) return true;
    // code-like: one single token that contains digits ("xk29a", "2523077") — real
    // sub names are multi-word or digit-free, so lone digit-bearing tokens are refs/junk
    const toks=cleaned.split(' ').filter(Boolean);
    if(toks.length===1 && /\d/.test(toks[0]) && toks[0].length<=14) return true;
  }
  return false;
}
function openNoiseEditor(onSave){
  const root2=document.getElementById('modalRoot2');
  root2.innerHTML=`<div class="backdrop" style="z-index:70"><div class="modal" style="max-width:460px">
    <div class="mh"><h3>Noise filter words</h3>
      <div class="muted" style="font-size:12.5px;margin-top:4px">A file or map name containing any of these words (whole-word match) is treated as <b>noise</b>: matching <i>filenames</i> are skipped without being read, matching <i>map names</i> land in the collapsed noise list instead of the main suggestions. One word or phrase per line.</div></div>
    <div class="mb">
      <textarea id="nz_text" style="width:100%;min-height:220px;font:inherit;padding:8px 10px;border:1px solid var(--line);border-radius:8px">${esc(KMZNOISE.join('\n'))}</textarea>
      <label style="display:flex;gap:8px;align-items:flex-start;margin-top:10px;font-size:12.5px;cursor:pointer">
        <input type="checkbox" id="nz_pat" ${KMZNOISE_PATTERNS?'checked':''} style="margin-top:2px">
        <span>Also flag <b>road references</b> (I-95, SR 417, US 27, CR 535, HWY&hellip;) and <b>code-like names</b> &mdash; a single word containing digits, like &ldquo;xk29a&rdquo; or &ldquo;2523077&rdquo;</span></label>
      <button class="small" id="nz_reset" style="margin-top:8px">Restore defaults</button>
    </div>
    <div class="mf"><button id="nz_cancel">Cancel</button><button class="primary" id="nz_save">Save</button></div>
  </div></div>`;
  document.getElementById('nz_reset').onclick=()=>{ document.getElementById('nz_text').value=KMZNOISE_DEFAULT.join('\n'); document.getElementById('nz_pat').checked=true; };
  document.getElementById('nz_cancel').onclick=()=>root2.innerHTML='';
  document.getElementById('nz_save').onclick=()=>{
    KMZNOISE=document.getElementById('nz_text').value.split('\n').map(x=>x.trim()).filter(Boolean);
    KMZNOISE_PATTERNS=document.getElementById('nz_pat').checked;
    persistKmzNoise(); save(K_KMZNOISEPAT,KMZNOISE_PATTERNS);
    root2.innerHTML=''; showToast('Noise filter saved');
    if(onSave) onSave();
  };
}

/* ---- scan report: everything the last scan saw, downloadable as CSV ---- */
let LAST_SCAN_REPORT=[];
function exportScanReport(){
  if(!LAST_SCAN_REPORT.length){ showToast('No scan data yet — run a scan first'); return; }
  const cols=['folder','file','status','map name','kind','lat','lng','resolution','note'];
  const q=s=>'"'+String(s==null?'':s).replace(/"/g,'""')+'"';
  const lines=[cols.map(q).join(',')];
  for(const r of LAST_SCAN_REPORT) lines.push([r.folder,r.file,r.status,r.map,r.kind,r.lat,r.lng,r.resolution,r.note].map(q).join(','));
  download(`KMZ Scan Report ${todayStamp()}.csv`, lines.join('\n')+'\n', 'text/csv');
}
const KMZ_REPORT_BTN=` <button class="small" data-report style="margin-left:8px;vertical-align:middle">Scan report (CSV)</button>`;

/* ---- per-file parse cache: skip re-reading KMZs that haven't changed ---- */
// migrate pre-v20 cache entries that stored thousands of reference-db pins —
// they bloat localStorage and can block other saves (e.g. the file01 stash)
/* save the file01 stash; on a full store, drop the KMZ cache and retry once */
/* The day's file01, kept so jobs survive a refresh. It is the single biggest
   thing this tool stores, so it goes to IndexedDB and never near the shared
   5 MB bucket. LAST_IMPORT mirrors it in memory for anything reading it now. */
let LAST_IMPORT=null;
function saveLastImport(v){
  LAST_IMPORT=v;
  idbSet(K_LASTIMPORT,v)
    .then(()=>{ try{ localStorage.removeItem(K_LASTIMPORT); }catch(e){} })
    .catch(err=>{
      const txt=String(v&&v.text||'');
      if(txt.length>600000){          // no IndexedDB: never let one CSV eat the bucket
        showToast("Today's file works now, but it's too big for this browser to remember after you close it.",'warn');
        logMsg(`file01 stash skipped: ${Math.round(txt.length/1024)} KB, IndexedDB unavailable (${(err&&err.name)||err})`,'warn');
        return;
      }
      if(!save(K_LASTIMPORT,v))
        showToast('Browser storage is full — this file01 works now but won’t be remembered after closing','warn');
    });
}

/* Modern folder scan (Chrome/Edge): we crawl the tree ourselves — in parallel —
   with live progress, and only ever open .kmz/.kml. */
/* Ranged KMZ read: a KMZ is a ZIP with the index at the END. Read the tail to
   find doc.kml's exact byte span and read only that — a few KB instead of the
   whole multi-MB site-plan image. Falls back to a full read on anything odd. */
function setKmzStatus(html){
  const el=document.getElementById('kmzStatus'); if(!el) return;
  if(!html){ el.classList.add('hide'); el.innerHTML=''; return; }
  el.classList.remove('hide');
  el.innerHTML=`<span data-dismiss style="float:right;cursor:pointer;color:var(--muted);font-weight:700;margin-left:10px" title="dismiss">&times;</span>${html}`;
}
// delegated so Stop/dismiss clicks land even while the status re-renders during a scan
document.addEventListener('click',e=>{
  if(!e.target.closest||!e.target.closest('#kmzStatus')) return;
  else if(e.target.closest('[data-dismiss]')) setKmzStatus('');
  else if(e.target.closest('[data-noise-edit]')) openNoiseEditor();
  else if(e.target.closest('[data-report]')) exportScanReport();
});
document.addEventListener('click',e=>{
  if(!e.target.closest||!e.target.closest('[data-zones-far]')) return;
  if(ZONES_FAR_PENDING.length) openKmzReview(ZONES_FAR_PENDING, [], null, 0, ` · ${ZONES_FAR_PENDING.length} far zone(s) — outside your usual territory`);
  else showToast('No far zones pending — run a zones import first');
});
let kmzRows=[];
function openKmzReview(locs, errs, fileCount, noiseSkipped, refNote){
  refNote=refNote||'';
  const idx=buildIndex();
  const all=locs.map((L,i)=>{
    const m=matchSubForKmz(L.name, idx), sub=m.sub;
    const hasCoord = sub && subHasGeo(sub);
    const status = !sub ? 'new' : (hasCoord ? 'exists' : 'fill');
    const noise = status==='new' && isNoiseName(L.name);
    const newName=cleanNewName(L.name);
    let similar=null, aliasSuggest=null;
    if(status==='new' && !noise){
      const sc=scoreSubs(newName)[0]; if(sc && sc.score>=0.85) similar=sc;
      // one-click alias confirm: name >=0.70 similar AND pin within 1 mile of the library sub
      for(const c of scoreSubs(newName).filter(x=>x.score>=ALIAS_SCORE).slice(0,5)){
        const s=SUBS.find(x=>x.name===c.name);
        if(s && subHasGeo(s)){
          const d=haversineMi(L.lat,L.lng,+s.lat,+s.lng);
          if(d<=ALIAS_MILES){ aliasSuggest={name:s.name,score:c.score,dist:d}; break; }
        }
      }
    }
    return {...L, i, subName: sub?sub.name:null, status, noise, apply: status!=='exists' && !noise, newName, similar, aliasSuggest};
  });
  for(const r of all){ if(r._rep) r._rep.resolution =
    r.status==='exists' ? 'already in library: '+r.subName
    : r.status==='fill' ? 'fills blank sub: '+r.subName
    : r.noise ? 'new — flagged noise by map name'
    : 'new suggestion: '+r.newName; }
  // dedupe by resolved identity: same sub (or same new name) from multiple sheets -> one card
  const seen=new Set();
  kmzRows=[];
  let skipped=0;
  for(const r of all){
    const key = r.subName ? 'sub:'+norm(r.subName) : 'new:'+norm(r.newName);
    if(r.status==='exists'){ if(!seen.has(key)){ seen.add(key); skipped++; } continue; }  // already in library -> skip
    if(seen.has(key)) continue;
    seen.add(key);
    kmzRows.push(r);
  }
  const root=document.getElementById('modalRoot');
  const noiseFileNote = noiseSkipped?` · ${noiseSkipped} file(s) skipped by the noise filter`:'';
  if(!kmzRows.length){
    root.innerHTML='';
    setKmzStatus(`<b>Scan finished:</b> ${fileCount!=null?fileCount+' file(s) read · ':''}<b>${skipped}</b> sub${skipped===1?'':'s'} matched the library and were skipped${noiseFileNote}${refNote} &mdash; <b>nothing new to add</b>.${errs.length?` <span style="color:var(--warn)">(${errs.length} file(s) unreadable)</span>`:''}${KMZ_REPORT_BTN}`);
    return;
  }
  const cardHtml=r=>{
    const search=norm([r.newName,r.subName,r.name,r.src,r.dir].filter(Boolean).join(' '));
    return `<div class="review-card" data-kz="${r.i}" data-search="${esc(search)}">
    <div class="kz-grid">
      <div style="min-width:0">
        <div class="review-head">
          ${r.status==='new'
            ? `<span class="badge ok">new sub</span>${r.noise?'<span class="badge warn">noise?</span>':''}<input type="text" data-kzname="${r.i}" value="${esc(r.newName)}" style="flex:1;min-width:160px;font-weight:700">`
            : `<span class="badge warn">fill blank</span><span class="raw">${esc(r.subName)}</span>`}
          <label style="margin-left:auto;display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer">
            <input type="checkbox" data-kzapply="${r.i}" ${r.apply?'checked':''}> ${r.status==='new'?'create':'fill'}</label>
        </div>
        ${r.aliasSuggest?`<div style="font-size:11.5px;margin:2px 0 6px;padding:7px 9px;border:1px solid var(--warn);border-radius:8px;background:var(--warn-bg)">
            Matches <b>${esc(r.aliasSuggest.name)}</b> (${r.aliasSuggest.score.toFixed(2)} &middot; ${r.aliasSuggest.dist<0.1?'&lt;0.1':r.aliasSuggest.dist.toFixed(1)} mi away)
            <button class="small primary" data-kzalias="${r.i}" style="margin-left:8px">Same sub &mdash; save alias</button></div>`
          : r.similar?`<div style="font-size:11.5px;margin:2px 0 6px;color:var(--warn)"><b>Similar to existing sub:</b> ${esc(r.similar.name)} (${r.similar.score.toFixed(2)}) &mdash; possible typo/variant; rename to match instead of creating a duplicate</div>`:''}
        <div class="muted" style="font-size:11px">${r.dir?`<b>${esc(r.dir)}</b><br>`:''}${esc(r.src)}<br>map name: ${esc(r.name)}<br><span class="pin">${rnd(r.lat)}, ${rnd(r.lng)}</span></div>
      </div>
      <div id="kzmap_${r.i}" class="kz-mini">${mapAvailable()?'':'map needs internet — coordinates are still used'}</div>
    </div>
  </div>`;};
  let noiseOpen=false, aliasedN=0;
  function renderKz(){
    const mainRows=kmzRows.filter(r=>!r.noise), noiseRows=kmzRows.filter(r=>r.noise);
    setKmzStatus(`<b>Scan finished:</b> ${fileCount!=null?fileCount+' file(s) read · ':''}<b>${mainRows.length}</b> to review${noiseRows.length?` · ${noiseRows.length} more look like noise`:''} · <b>${skipped}</b> already in the library${noiseFileNote}${refNote}${errs.length?` · <span style="color:var(--warn)">${errs.length} unreadable</span>`:''}${KMZ_REPORT_BTN}`);
    root.innerHTML=`<div class="backdrop"><div class="modal" style="max-width:720px"><div class="mh"><h3>New subs found in KMZ scan</h3>
      <div class="muted" style="font-size:13px;margin-top:4px">${mainRows.length} suggestion(s) &middot; ${noiseRows.length} noise-filtered &middot; ${skipped} already in the library${aliasedN?` &middot; <b>${aliasedN} aliased</b>`:''}${noiseSkipped?` &middot; ${noiseSkipped} files skipped unread`:''}.
      Each pin is the center of the KMZ site plan &mdash; rename before creating if needed.</div>
      <div class="toolbar" style="margin:10px 0 0">
        <input type="search" id="kzFilter" class="grow" placeholder="Filter by name or folder&hellip;">
        <button class="small" id="kzCheckShown">Check shown</button>
        <button class="small" id="kzUncheckAll">Uncheck all</button>
        ${noiseRows.length?`<button class="small" id="kzNoiseToggle">${noiseOpen?'&#9660;':'&#9654;'} noise (${noiseRows.length})</button>`:''}
        <button class="small" data-noise-edit2>Noise words&hellip;</button>
        <button class="small" id="kzReport" title="CSV of everything this scan saw — handy for sharing">Scan report (CSV)</button>
      </div>
      ${errs.length?`<div class="muted" style="font-size:12px;margin-top:6px;color:var(--warn)">${errs.slice(0,4).map(esc).join('<br>')}${errs.length>4?`<br>(+${errs.length-4} more)`:''}</div>`:''}</div>
    <div class="mb" id="kzBody">
      ${mainRows.map(cardHtml).join('')||`<div class="muted" style="padding:14px;text-align:center">Everything left was caught by the noise filter — open the noise section below or edit the noise words.</div>`}
      ${noiseRows.length?`<div id="kzNoiseWrap" class="${noiseOpen?'':'hide'}">
        <div class="review-label" style="margin-top:14px">Noise-filtered (${noiseRows.length}) &mdash; unchecked by default; check any that are real subs</div>
        ${noiseRows.map(cardHtml).join('')}</div>`:''}
    </div>
    <div class="mf"><button id="kzCancel">Cancel</button><button class="primary" id="kzApply">Add checked to library</button></div>
  </div></div>`;
    // lazy mini maps: initialize only when a card scrolls into view
    if(mapAvailable()){
      const makeMap=el=>{
        if(el.dataset.inited) return; el.dataset.inited='1';
        const r=kmzRows.find(x=>('kzmap_'+x.i)===el.id); if(!r) return;
        el.textContent='';
        try{
          const mm=L.map(el,{zoomControl:true,attributionControl:false,dragging:true,scrollWheelZoom:true}).setView([r.lat,r.lng],14);
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(mm);
          L.circleMarker([r.lat,r.lng],{radius:8,color:'#fff',weight:2,fillColor:REGION_COLOR,fillOpacity:.95}).addTo(mm);
          setTimeout(()=>mm.invalidateSize(),60);
        }catch(e){ el.textContent='map failed to load — coordinates above are still used'; }
      };
      const targets=[...root.querySelectorAll('[id^=kzmap_]')];
      if(typeof IntersectionObserver==='undefined') targets.forEach(makeMap);
      else{
        const io=new IntersectionObserver(es=>es.forEach(en=>{ if(en.isIntersecting){ io.unobserve(en.target); makeMap(en.target); } }),
          {root:root.querySelector('.modal'), rootMargin:'250px'});
        targets.forEach(t=>io.observe(t));
      }
    }
    const visibleCards=()=>[...root.querySelectorAll('#kzBody .review-card')].filter(c=>c.style.display!=='none' && !c.closest('#kzNoiseWrap.hide'));
    document.getElementById('kzFilter').oninput=e=>{
      const q=norm(e.target.value);
      root.querySelectorAll('#kzBody .review-card').forEach(c=>{ c.style.display = !q||c.dataset.search.includes(q) ? '' : 'none'; });
    };
    document.getElementById('kzCheckShown').onclick=()=>{
      for(const c of visibleCards()){ const r=kmzRows.find(x=>x.i===+c.dataset.kz); if(r){ r.apply=true; const cb=c.querySelector('input[data-kzapply]'); if(cb) cb.checked=true; } }
    };
    document.getElementById('kzUncheckAll').onclick=()=>{
      kmzRows.forEach(r=>r.apply=false);
      root.querySelectorAll('input[data-kzapply]').forEach(cb=>cb.checked=false);
    };
    const nt=document.getElementById('kzNoiseToggle');
    if(nt) nt.onclick=()=>{ noiseOpen=!noiseOpen; const w=document.getElementById('kzNoiseWrap'); if(w) w.classList.toggle('hide',!noiseOpen); nt.innerHTML=(noiseOpen?'&#9660;':'&#9654;')+` noise (${kmzRows.filter(r=>r.noise).length})`; };
    root.querySelector('[data-noise-edit2]').onclick=()=>openNoiseEditor(()=>{
      kmzRows.forEach(r=>{ if(r.status==='new'){ r.noise=isNoiseName(r.name); if(r.noise) r.apply=false; } });
      renderKz();
    });
    root.querySelector('#kzBody').addEventListener('click',e=>{
      const ab=e.target.closest('[data-kzalias]'); if(!ab) return;
      const r=kmzRows.find(x=>x.i===+ab.dataset.kzalias); if(!r||!r.aliasSuggest) return;
      const s=SUBS.find(x=>x.name===r.aliasSuggest.name); if(!s){ showToast('Sub not found'); return; }
      if(!Array.isArray(s.aliases)) s.aliases=[];
      for(const a of [r.newName, r.name])
        if(a && norm(a)!==norm(s.name) && !s.aliases.some(x=>norm(x)===norm(a))) s.aliases.push(a);
      persistSubs(); renderSubs();
      if(r._rep) r._rep.resolution='alias saved → '+s.name;
      kmzRows=kmzRows.filter(x=>x!==r);
      aliasedN++;
      showToast(`Alias saved → ${s.name}`);
      if(!kmzRows.length){
        root.innerHTML='';
        setKmzStatus(`<b>Review done:</b> ${aliasedN} name(s) confirmed as aliases of existing subs — nothing left to add.${KMZ_REPORT_BTN}`);
        return;
      }
      renderKz();
    });
    root.querySelector('#kzBody').addEventListener('change',e=>{
      if(e.target.dataset.kzapply!=null){ const r=kmzRows.find(x=>x.i===+e.target.dataset.kzapply); if(r) r.apply=e.target.checked; }
      if(e.target.dataset.kzname!=null){ const r=kmzRows.find(x=>x.i===+e.target.dataset.kzname); if(r) r.newName=e.target.value; }
    });
    document.getElementById('kzReport').onclick=exportScanReport;
    document.getElementById('kzCancel').onclick=()=>root.innerHTML='';
    document.getElementById('kzApply').onclick=()=>applyKmz();
  }
  renderKz();
}
function applyKmz(){
  let filled=0, added=0;
  for(const r of kmzRows){
    if(!r.apply) continue;
    if(r.status==='new'){
      const nm=(r.newName||r.name||'').trim(); if(!nm) continue;
      const existing=SUBS.find(s=>norm(s.name)===norm(nm));
      if(existing){ if(!subHasGeo(existing)){ existing.lat=rnd(r.lat); existing.lng=rnd(r.lng); filled++; } }
      else { SUBS.push({name:nm, nickname:'', address:'(from KMZ)', lat:rnd(r.lat), lng:rnd(r.lng), aliases:[]}); added++; }
    } else {
      const sub=SUBS.find(s=>s.name===r.subName); if(!sub) continue;
      sub.lat=rnd(r.lat); sub.lng=rnd(r.lng); filled++;
    }
  }
  persistSubs(); document.getElementById('modalRoot').innerHTML=''; renderSubs();
  setKmzStatus(`<b>KMZ applied:</b> ${added} new sub${added===1?'':'s'} added · ${filled} blank coordinate${filled===1?'':'s'} filled.`);
  showToast(`KMZ applied: ${added} added, ${filled} filled`);
}
```

### HELPERS

```js
/* ============================ HELPERS ============================ */
function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
let toastT;
const TOAST_LOG=[]; // {t, msg, kind} newest first — reviewable via the Log button
function logMsg(msg,kind){ TOAST_LOG.unshift({t:new Date(),msg:String(msg),kind:kind||'info'}); if(TOAST_LOG.length>200) TOAST_LOG.length=200; }
function showToast(msg,kind){
  logMsg(msg,kind);
  const t=document.getElementById('toast');
  t.textContent=msg; t.className='toast show'+(kind==='warn'?' warn':kind==='err'?' err':'');
  clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove('show'),kind&&kind!=='info'?4200:2600);
}
function openToastLog(){
  const root=document.getElementById('modalRoot2');
  const fmt=d=>`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
  root.innerHTML=`<div class="backdrop"><div class="modal" style="max-width:640px"><div class="mh"><h3>Log</h3>
    <div class="muted" style="font-size:12px;margin-top:4px">Everything the tool has said this session, newest first.</div></div>
  <div class="mb">${TOAST_LOG.length?TOAST_LOG.map(e=>`<div style="display:flex;gap:10px;padding:6px 4px;border-bottom:1px solid var(--line);font-size:12.5px">
      <span class="pin" style="flex:0 0 62px;color:var(--muted)">${fmt(e.t)}</span>
      <span style="flex:1;${e.kind==='err'?'color:var(--err);font-weight:600':e.kind==='warn'?'color:#b45309;font-weight:600':''}">${esc(e.msg)}</span></div>`).join('')
    :'<div class="muted" style="padding:12px 0">Nothing yet.</div>'}</div>
  <div class="mf"><button id="tlClose">Close</button></div></div></div>`;
  document.getElementById('tlClose').onclick=()=>root.innerHTML='';
}
function download(name,text,type){ const b=new Blob([text],{type:type||'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),2000); }
```

### WIRING

```js
/* ============================ WIRING ============================ */
// tabs
// two top-level pages: Dispatch = the whole daily flow, Settings = subs + crews
const TAB_GROUPS={dispatch:['convert','bring'], crews:['crews'], subs:['subs'], settings:['settings']};
document.querySelectorAll('.tab').forEach(t=>t.onclick=()=>{
  document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
  t.classList.add('active');
  const show=new Set(TAB_GROUPS[t.dataset.tab]||[]);
  ['convert','bring','subs','crews','settings'].forEach(id=>document.getElementById('tab-'+id).classList.toggle('hide',!show.has(id)));
  if(t.dataset.tab==='settings') renderTasks();
  try{ save(K_UITAB,t.dataset.tab); }catch(e){}
});
// file / drop (file01 -> file02)
const drop=document.getElementById('drop'), fileInput=document.getElementById('file');
document.getElementById('pickBtn').onclick=()=>fileInput.click();
fileInput.onchange=e=>{ const f=e.target.files[0]; if(f) readFile(f); };
;['dragenter','dragover'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('drag');}));
;['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('drag');}));
drop.addEventListener('drop',e=>{ const f=e.dataTransfer.files[0]; if(f) readFile(f); });
function readFile(f){
  document.getElementById('fileName').textContent=f.name;
  const rd=new FileReader();
  rd.onload=()=>loadFile01ForReview(rd.result,f.name);
  rd.readAsText(f);
}
// jobs table interactions
document.getElementById('jobsBody').addEventListener('click',jobsClick);
document.getElementById('jobsHead').addEventListener('click',e=>{
  if(e.target.id==='jobsAll'){ const view=jobsView(); const allOn=view.length>0&&view.every(r=>jobsSel.has(r.id));
    if(allOn) view.forEach(r=>jobsSel.delete(r.id)); else view.forEach(r=>jobsSel.add(r.id)); renderJobs(); return; }
  const th=e.target.closest('th[data-sort]'); if(!th) return;
  const i=+th.dataset.sort;
  if(jobsSort.i===i) jobsSort.dir*=-1; else { jobsSort.i=i; jobsSort.dir=1; }
  renderJobs();
});
document.getElementById('removeSelBtn').onclick=()=>{
  if(!jobsSel.size){ showToast('Select rows first'); return; }
  jobsRows.forEach(r=>{ if(jobsSel.has(r.id)) r.removed=true; });
  const n=jobsSel.size; jobsSel.clear(); jobsAnchor=null; renderJobs(); persistTrim(); showToast(`Removed ${n} job(s)`);
};
document.getElementById('restoreBtn').onclick=()=>{ jobsRows.forEach(r=>r.removed=false); renderJobs(); persistTrim(); showToast('Restored'); };
document.getElementById('colsBtn').onclick=openColsModal;
document.getElementById('prioBtn').onclick=openPrioModal;   // jumps to Settings, where the task rows live
document.getElementById('genBtn').onclick=()=>{
  const kept=jobsRows.filter(r=>!r.removed).map(r=>r.cells);
  if(!kept.length){ showToast('No jobs left to send'); return; }
  runConvertRows(jobsHeader, kept, true); // one click: build + download
};

// Bring back (file03 -> file04)
(async function(){
  /* First: get every market's stashed file01 out of the shared 5 MB bucket.
     This is the space that was starving the subdivision libraries, and it is
     reclaimed the moment an existing user opens this build. */
  for(const p of ['r4m_','r4m_hou_','r4m_dfw_','r4m_asa_']){
    const k=p+'lastimport_v1';
    let raw=null; try{ raw=localStorage.getItem(k); }catch(e){}
    if(!raw) continue;
    let v=null; try{ v=JSON.parse(raw); }catch(e){ try{ localStorage.removeItem(k); }catch(e2){} continue; }
    try{ await idbSet(k,v); localStorage.removeItem(k);
         logMsg(`Moved ${p.replace(/_$/,'')||'FL'} file01 (${Math.round(raw.length/1024)} KB) out of browser settings storage`); }
    catch(e){ /* no IndexedDB here — leave it where it is rather than lose it */ }
  }
  await hydrateLibraries();     // libraries first: nothing may be written until they are read
  let stash=null;
  try{ stash=await idbGet(K_LASTIMPORT); }catch(e){}
  if(!stash) stash=load(K_LASTIMPORT,null);      // fallback path when IndexedDB is unavailable
  LAST_IMPORT=stash||null;
  if(stash && stash.text){
    setFile01(stash.text, stash.name||'file01.csv', true);
    // the day's jobs survive a refresh: restore the trim table quietly
    try{
      loadFile01ForReview(stash.text, stash.name||'file01.csv', true);
      const ts=load(K_TRIM,null);
      if(ts && Array.isArray(ts.wins)){ JOB_WINDOWS.clear(); for(const [k,v] of ts.wins) if(k&&v&&v.from&&v.to) JOB_WINDOWS.set(k,v); }
      if(ts && ts.name===(stash.name||'file01.csv') && Array.isArray(ts.removed) && ts.removed.length){
        const ids=new Set(ts.removed);
        jobsRows.forEach(r=>{ if(ids.has(r.id)) r.removed=true; });
        renderJobs();
      }
    }catch(e){ console.error(e); }
  }
  refreshStorageLine();
  wireTaskSettings(); renderTasks();
  // reopen the page that was in use
  const t0=load(K_UITAB,'dispatch');
  if(t0!=='dispatch'){ const el=document.querySelector(`.tab[data-tab="${t0}"]`); if(el) el.click(); }
})();
```

### STORAGE READOUT

```js
/* ===================== STORAGE READOUT =====================
   When a library "wipes itself" the real story is almost always in here, so
   make it something a manager can read out loud over the phone. */
const REGION_PREFIXES={'r4m_':'FL','r4m_hou_':'HOU','r4m_dfw_':'DFW','r4m_asa_':'ASA'};
function lsUsedBytes(){
  let n=0; try{ for(const k of Object.keys(localStorage)) n+=k.length+(localStorage.getItem(k)||'').length; }catch(e){}
  return n*2;                                  // localStorage counts UTF-16 code units
}
const kb=b=>b<1024?b+' B':Math.round(b/1024)+' KB';
async function storageReport(){
  const rows=[];
  try{
    for(const k of Object.keys(localStorage).sort()){
      const bytes=(k.length+(localStorage.getItem(k)||'').length)*2;
      const pre=Object.keys(REGION_PREFIXES).filter(p=>k.startsWith(p)).sort((a,b)=>b.length-a.length)[0];
      rows.push({key:k,bytes,market:pre?REGION_PREFIXES[pre]:'—'});
    }
  }catch(e){}
  const used=lsUsedBytes();
  let idbOk=false, idbNote='';
  try{ await idbOpen(); idbOk=true; }catch(e){ idbNote=(e&&e.name)||String(e); }
  // what each market actually holds, read from the db rather than assumed
  const libs=[];
  for(const [pre,name] of Object.entries(REGION_PREFIXES)){
    const one={market:name,subs:0,crews:0,jobKB:0};
    for(const what of ['subs','crews']) one[what]=(await storedLibrary(pre+what+'_v1')).length;
    let j=null; try{ j=await idbGet(pre+'lastimport_v1'); }catch(e){}
    one.jobKB=j&&j.text?Math.round(j.text.length/1024):0;
    libs.push(one);
  }
  let quota=0, usage=0;
  try{ const est=await navigator.storage.estimate(); quota=est.quota||0; usage=est.usage||0; }catch(e){}
  return {rows,used,idbOk,idbNote,quota,usage,libs};
}
async function refreshStorageLine(){
  const el=document.getElementById('storageLine'); if(!el) return;
  const r=await storageReport();
  const mine=r.libs.filter(x=>x.subs||x.crews).map(x=>`${x.market} ${x.subs}`).join(' · ');
  el.textContent=r.idbOk
    ? `Libraries in IndexedDB${r.quota?` (about ${Math.round(r.quota/1048576)} MB available)`:''}${mine?` — ${mine}`:''}. Settings ${kb(r.used)}.`
    : `IndexedDB is unavailable here — everything falls back to one ~5 MB bucket, currently ${kb(r.used)}.`;
}
document.getElementById('storageBtn').onclick=async()=>{
  const r=await storageReport();
  const big=r.rows.slice().sort((a,b)=>b.bytes-a.bytes);
  const root=document.getElementById('modalRoot2');
  root.innerHTML=`<div class="backdrop"><div class="modal" style="max-width:620px"><div class="mh"><h3>Storage</h3>
    <div class="muted" style="font-size:12px;margin-top:4px">The browser gives this tool one small bucket for settings and libraries
      (about 5 MB, shared by all four markets) and a much larger one for the day's job files.</div></div>
    <div class="mb">
      <p style="margin:0 0 10px"><b>Libraries &amp; job files:</b> ${r.idbOk?`IndexedDB${r.quota?`, about ${Math.round(r.quota/1048576)} MB available`:''}`:`<span style="color:var(--err)">IndexedDB unavailable (${r.idbNote}) — falling back to the small bucket</span>`}.<br>
      <b>Settings:</b> ${kb(r.used)} of about 5 MB.</p>
      <div class="tablewrap" style="margin-bottom:14px"><table>
        <thead><tr><th>Market</th><th style="width:90px">Subdivisions</th><th style="width:70px">Crews</th><th style="width:90px">Job file</th></tr></thead>
        <tbody>${r.libs.map(x=>`<tr><td>${x.market}</td><td>${x.subs||'—'}</td><td>${x.crews||'—'}</td><td>${x.jobKB?x.jobKB+' KB':'—'}</td></tr>`).join('')}</tbody>
      </table></div>
      <div class="muted" style="font-size:12px;margin-bottom:6px">Still in the small settings bucket:</div>
      <div class="tablewrap"><table>
        <thead><tr><th>What</th><th style="width:70px">Market</th><th style="width:80px">Size</th></tr></thead>
        <tbody>${big.map(x=>`<tr><td style="font-family:ui-monospace,monospace;font-size:12px">${x.key}</td><td>${x.market}</td><td>${kb(x.bytes)}</td></tr>`).join('')||'<tr><td colspan="3" class="muted">Nothing stored yet.</td></tr>'}</tbody>
      </table></div>
    </div>
    <div class="mf"><button id="stgClose">Close</button></div></div></div>`;
  root.querySelector('#stgClose').onclick=()=>root.innerHTML='';
};
const drop3=document.getElementById('drop3'), file3In=document.getElementById('file3');
document.getElementById('pick3Btn').onclick=()=>file3In.click();
file3In.onchange=e=>{ if(e.target.files.length) read3([...e.target.files]); e.target.value=''; };
;['dragenter','dragover'].forEach(ev=>drop3.addEventListener(ev,e=>{e.preventDefault();drop3.classList.add('drag');}));
;['dragleave','drop'].forEach(ev=>drop3.addEventListener(ev,e=>{e.preventDefault();drop3.classList.remove('drag');}));
drop3.addEventListener('drop',e=>{ if(e.dataTransfer.files.length) read3([...e.dataTransfer.files]); });
function read3(files){
  // several route exports (one per territory) merge into one file03:
  // keep the first file's header, drop the duplicate header line of the rest
  Promise.all(files.map(f=>new Promise((res,rej)=>{
    const rd=new FileReader(); rd.onload=()=>res({name:f.name,text:String(rd.result)}); rd.onerror=rej; rd.readAsText(f);
  }))).then(list=>{
    const parts=[list[0].text];
    for(let k=1;k<list.length;k++){
      const lines=list[k].text.split(/\r?\n/);
      if(lines.length && /svc job num/i.test(lines[0])) lines.shift();
      parts.push(lines.join('\n'));
    }
    file03Text=parts.map(p=>p.replace(/\n+$/,'')).join('\n');
    document.getElementById('file3Name').textContent=list.map(f=>f.name).join('  +  ');
    runReverse();
  }).catch(()=>showToast('Could not read those files'));
}
document.getElementById('f1pickBtn').onclick=()=>document.getElementById('f1file').click();
document.getElementById('f1file').onchange=e=>{ const f=e.target.files[0]; if(!f)return; const rd=new FileReader(); rd.onload=()=>{ setFile01(rd.result,f.name,false); if(file03Text) runReverse(); }; rd.readAsText(f); };
document.getElementById('download4Btn').onclick=download4;
document.getElementById('toastLogBtn').onclick=openToastLog;

// subs
document.getElementById('subSearch').oninput=renderSubs;
document.getElementById('addSubBtn').onclick=()=>editSubModal(-1);
/* ---- one door for every kind of import: work out what each file is ---- */
async function sniffSheet(f){            // 'crews' | 'zones' | null
  try{
    const grid = /\.csv$/i.test(f.name) ? parseCSV(await f.text()) : await parseXlsxGrid(await f.arrayBuffer());
    for(let r=0;r<Math.min(12,grid.length);r++){
      const cells=(grid[r]||[]).map(c=>norm(c));
      const la=cells.findIndex(c=>/lat/.test(c)), lo=cells.findIndex(c=>/(lon|lng)/.test(c));
      if(la<0||lo<0||la===lo) continue;
      if(cells.some(c=>/first/.test(c))) return 'crews';
      if(cells.some(c=>/name/.test(c))) return 'zones';
    }
  }catch(e){}
  return null;
}
async function routeImportFiles(files){
  const list=[...files]; if(!list.length) return;
  const json=list.filter(f=>/\.json$/i.test(f.name));
  const sheets=list.filter(f=>/\.(xlsx|csv)$/i.test(f.name));
  const other=list.filter(f=>!json.includes(f)&&!sheets.includes(f));
  document.getElementById('modalRoot').innerHTML='';
  for(const f of json){ const text=await f.text(); await importSetupJson(text,f.name); }
  for(const f of sheets){
    const kind=await sniffSheet(f);
    if(kind==='crews') await processCrewsFile(f);
    else if(kind==='zones') await processZonesFile(f);
    else showToast(`Couldn't tell what ${f.name} holds — it needs a header row with Latitude/Longitude`,'err');
  }
  if(other.length) showToast(`Skipped ${other.length} file(s) the tool doesn't read: ${other.map(f=>f.name).slice(0,3).join(', ')}`,'warn');
}
function openImportModal(){
  const root=document.getElementById('modalRoot');
  root.innerHTML=`<div class="backdrop"><div class="modal" style="max-width:560px"><div class="mh"><h3>Import</h3>
    <div class="muted" style="font-size:12.5px;margin-top:4px">Drop anything below &mdash; the tool identifies each file and sends it to the right place.</div></div>
  <div class="mb">
    <div id="impDrop" class="drop" style="margin-bottom:12px">
      <p style="margin:0 0 8px"><b>Drag &amp; drop files here</b>, or</p>
      <button class="primary" id="impPick">Choose file(s)&hellip;</button>
      <input type="file" id="impFiles" multiple accept=".json,.xlsx,.csv" class="hide">
    </div>
    <div class="muted" style="font-size:11.5px;margin-top:12px;line-height:1.7">
      <b>Setup / library JSON</b> &mdash; subdivisions and crews, routed to the market named inside<br>
      <b>Crew spreadsheet</b> &mdash; the manager template (First Name + Home Latitude/Longitude)<br>
      <b>Geotab zone export</b> &mdash; customer zones with centroids
    </div>
  </div>
  <div class="mf"><button id="impClose">Close</button></div></div></div>`;
  document.getElementById('impClose').onclick=()=>root.innerHTML='';
  document.getElementById('impPick').onclick=()=>document.getElementById('impFiles').click();
  document.getElementById('impFiles').onchange=e=>{ const fs=[...e.target.files]; e.target.value=''; routeImportFiles(fs); };
  const dz=document.getElementById('impDrop');
  ;['dragenter','dragover'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.add('drag');}));
  ;['dragleave','drop'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.remove('drag');}));
  dz.addEventListener('drop',e=>{ const fs=[...(e.dataTransfer.files||[])]; if(fs.length) routeImportFiles(fs); });
}
document.getElementById('importAllBtn').onclick=openImportModal;
document.getElementById('zonesFile').onchange=e=>{ const f=e.target.files[0]; e.target.value=''; if(f) processZonesFile(f); };
document.getElementById('crewsXlsFile').onchange=e=>{ const f=e.target.files[0]; e.target.value=''; if(f) processCrewsFile(f); };
// overflow menus (⋯) — Export/Import/Reset live here now
for(const [btn,menu] of [['subsMenuBtn','subsMenu'],['crewsMenuBtn','crewsMenu']]){
  document.getElementById(btn).onclick=e=>{ e.stopPropagation(); const m=document.getElementById(menu);
    document.querySelectorAll('.menu.open').forEach(x=>{ if(x!==m) x.classList.remove('open'); });
    m.classList.toggle('open'); };
}
document.querySelectorAll('.menu-wrap > button').forEach(b=>b.onclick=e=>{
  e.stopPropagation();
  const m=b.parentNode.querySelector('.menu'), was=m.classList.contains('open');
  document.querySelectorAll('.menu.open').forEach(x=>x.classList.remove('open'));
  m.classList.toggle('open',!was);
});
document.addEventListener('click',e=>{ if(!e.target.closest('.menu-wrap')) document.querySelectorAll('.menu.open').forEach(m=>m.classList.remove('open')); });
document.getElementById('exportSubs').onclick=()=>download('subdivisions.json',JSON.stringify(SUBS,null,2));
/* Merge helpers shared by the JSON importers. A file may carry subs, crews or
   both, and each record (or the file itself) may name its market. */
function regionKey(r,what){ return (r==='FL'?'r4m_':'r4m_'+r.toLowerCase()+'_')+what+'_v1'; }
/* Another market's library lives in IndexedDB too, so reading and writing it is
   asynchronous — a market not currently on screen is read straight from the db. */
async function readRegion(r,what,live){
  if(r===REGION) return live;
  const v=await storedLibrary(regionKey(r,what));
  return what==='subs' ? unpackSubs(v) : v;
}
async function writeRegion(r,what,arr,live){
  const key=regionKey(r,what), packed=what==='subs'?packSubs(arr):arr;
  let ok=false, after=0;
  try{
    await idbSet(key,packed);
    try{ localStorage.removeItem(key); }catch(e){}
    const back=await idbGet(key);
    after=Array.isArray(back)?back.length:0;
    ok=(after===arr.length);
  }catch(err){                                  // no IndexedDB here — try the small bucket
    ok=save(key,packed);
    try{ const raw=JSON.parse(localStorage.getItem(key)||'[]'); after=Array.isArray(raw)?raw.length:0; }catch(e){}
    ok=ok&&after===arr.length;
  }
  if(!ok){
    IMPORT_PROBLEMS.push(`${r} ${what}: kept ${after} of ${arr.length} — browser storage rejected the rest`);
    logMsg(`IMPORT NOT SAVED for ${r} ${what}: wrote ${arr.length}, stored ${after}`,'err');
  }
  STORED_N[key]=after;
  if(r===REGION){ if(what==='subs'){ SUBS=arr; renderSubs(); } else { CREWS=arr; renderCrews(); } }
}
let IMPORT_PROBLEMS=[];
async function mergeSubsInto(r,incoming){
  const cur=(await readRegion(r,'subs',SUBS)).slice();
  const by=new Map(cur.map(s=>[norm(s.name),s]));
  let added=0, filled=0;
  for(const raw of incoming){
    const s={name:String(raw.name||'').trim(),nickname:raw.nickname||'',address:raw.address||'',
      lat:raw.lat==null?null:raw.lat,lng:raw.lng==null?null:raw.lng,aliases:Array.isArray(raw.aliases)?raw.aliases:[]};
    if(!s.name) continue;
    const hit=by.get(norm(s.name));
    if(hit){ if(!subHasGeo(hit)&&s.lat!=null){ hit.lat=s.lat; hit.lng=s.lng; filled++; }
             if(!hit.address&&s.address) hit.address=s.address; }
    else { cur.push(s); by.set(norm(s.name),s); added++; }
  }
  await writeRegion(r,'subs',cur,SUBS);
  return {added,filled,total:cur.length};
}
async function mergeCrewsInto(r,incoming){
  const cur=(await readRegion(r,'crews',CREWS)).slice();
  let added=0, updated=0, locs=0;
  for(const raw of incoming){
    const first=String(raw.name||raw.first||'').trim(); if(!first) continue;
    const last=String(raw.last||'').trim(), code=String(raw.code||'').trim().toUpperCase();
    let list=Array.isArray(raw.locs)&&raw.locs.length ? raw.locs : (isFinite(+raw.lat)?[{label:'Home',lat:+raw.lat,lng:+raw.lng}]:[]);
    list=list.filter(x=>isFinite(+x.lat)&&isFinite(+x.lng)).map(x=>({label:String(x.label||'Home'),lat:+x.lat,lng:+x.lng}));
    if(!list.length) continue;
    let c=cur.find(x=>norm(x.name)===norm(first)&&norm(x.last||'')===norm(last));
    if(!c&&code) c=cur.find(x=>norm(x.code||'')===norm(code));
    if(c){
      c.name=first; c.last=last||c.last;
      if(raw.email) c.email=raw.email;
      if(code) c.code=code;
      for(const L of list) if(crewAddLoc(c,L.label,L.lat,L.lng)) locs++;
      updated++;
    } else {
      cur.push({name:first,last,email:raw.email||'',code,locs:list,locIdx:0,lat:list[0].lat,lng:list[0].lng,
                active:raw.active!==false});
      added++;
    }
  }
  await writeRegion(r,'crews',cur,CREWS);
  return {added,updated,locs,total:cur.length};
}
async function importSetupJson(text,fname){
  try{
    const data=JSON.parse(text);
    const known=Object.keys(REGION_DEFS);
    const pick=x=>known.includes(String(x&&x.region||'').toUpperCase())?String(x.region).toUpperCase():null;
    // Accepted shapes:
    //   [subs...]                         plain list  -> replaces the current region (legacy)
    //   [subs with region...]             tagged list -> merged into each named market
    //   {region?, subs:[...], crews:[...]} bundle     -> both libraries, per market
    let subsIn=[], crewsIn=[], bundle=false, fileRegion=null;
    if(Array.isArray(data)){
      // a bare list is subs unless the records look like crew records
      const crewish=data.filter(x=>x&&(x.code!==undefined||x.locs!==undefined||x.email!==undefined||x.last!==undefined)).length;
      const subish=data.filter(x=>x&&(x.aliases!==undefined||x.nickname!==undefined)).length;
      if(crewish>subish) crewsIn=data; else subsIn=data;
    }
    else if(data&&typeof data==='object'){
      bundle=true; fileRegion=pick(data);
      subsIn=Array.isArray(data.subs)?data.subs:[];
      crewsIn=Array.isArray(data.crews)?data.crews:[];
    } else throw 0;
    const anyTagged = bundle || subsIn.some(pick) || crewsIn.some(pick);
    if(!anyTagged && crewsIn.length && !subsIn.length){
      const r=await mergeCrewsInto(REGION,crewsIn);
      showToast(`Crews imported into ${REGION}: ${r.added} added, ${r.updated} updated${r.locs?`, ${r.locs} start location(s)`:''}`);
      return;
    }
    if(!anyTagged){
      SUBS=subsIn.map(x=>({name:String(x.name||'').trim(),nickname:x.nickname||'',address:x.address||'',
        lat:x.lat==null?null:x.lat,lng:x.lng==null?null:x.lng,aliases:Array.isArray(x.aliases)?x.aliases:[]}));
      persistSubs(); renderSubs();
      showToast('Imported '+SUBS.length+' subdivisions into '+REGION);
      return;
    }
    IMPORT_PROBLEMS=[];
    const groups={};
    const put=(arr,what)=>{ for(const x of arr){ const r=pick(x)||fileRegion||REGION;
      (groups[r]=groups[r]||{subs:[],crews:[]})[what].push(x); } };
    put(subsIn,'subs'); put(crewsIn,'crews');
    const parts=[];
    for(const r of Object.keys(groups)){
      const bits=[];
      if(groups[r].subs.length){ const s=await mergeSubsInto(r,groups[r].subs);
        bits.push(`${s.added} sub${s.added===1?'':'s'}`);
        logMsg(`Import → ${r} subs: ${s.added} added${s.filled?`, ${s.filled} coordinates filled`:''}, ${s.total} total`); }
      if(groups[r].crews.length){ const c=await mergeCrewsInto(r,groups[r].crews);
        bits.push(`${c.added} crew${c.added===1?'':'s'}`);
        logMsg(`Import → ${r} crews: ${c.added} added, ${c.updated} updated${c.locs?`, ${c.locs} start location(s)`:''}, ${c.total} total`); }
      parts.push(`${r} +${bits.join(' / ')}`);
    }
    if(IMPORT_PROBLEMS.length){
      showToast('Import could NOT be saved — '+IMPORT_PROBLEMS[0]+' (see Log). Free space and try again.','err');
    } else showToast('Imported: '+parts.join(' · '));
  }catch(err){ showToast(`Couldn't read ${fname||'that JSON file'}`,'err'); }
}
document.getElementById('importSubs').onchange=e=>{ const f=e.target.files[0]; if(!f)return;
  const rd=new FileReader(); rd.onload=()=>importSetupJson(rd.result,f.name); rd.readAsText(f); e.target.value=''; };
document.getElementById('resetSubs').onclick=()=>{ if(confirm('Reset the subdivision library to the original seed? Your changes will be lost.')){ SUBS=JSON.parse(JSON.stringify(REGION_SUBS_SEED)); persistSubs({force:true}); renderSubs(); showToast('Reset'); } };
/* A time window belongs to one order — "this slab has to be shot before the
   pour at 11" — so it is set on the jobs you pick, not on the kind of work.
   Keyed by Svc Job Num, which is the one field that survives the round trip. */
function openWindowModal(){
  if(!jobsHeader){ showToast('Load a Sage export first'); return; }
  const iSvc=findCol(jobsHeader,'Svc Job Num');
  if(iSvc<0){ showToast('This file has no Svc Job Num column','err'); return; }
  const rows=jobsRows.filter(r=>!r.removed && jobsSel.has(r.id));
  if(!rows.length){ showToast('Select the jobs that need a window first'); return; }
  const keys=rows.map(r=>String(r.cells[iSvc]||'').trim()).filter(Boolean);
  const cur=keys.map(k=>JOB_WINDOWS.get(k)).find(Boolean)||{from:'',to:''};
  const root=document.getElementById('modalRoot2');
  root.innerHTML=`<div class="backdrop"><div class="modal" style="max-width:460px">
    <div class="mh"><h3>Time window</h3><div class="muted" style="font-size:12px;margin-top:4px">
      ${keys.length} selected job${keys.length===1?'':'s'} must be visited between these times.
      Leave both blank to clear the window.</div></div>
    <div class="mb"><div class="row" style="gap:10px;align-items:center">
      <label class="muted" style="font-size:12.5px">From <input type="time" id="winF" value="${esc(cur.from)}"></label>
      <label class="muted" style="font-size:12.5px">To <input type="time" id="winT" value="${esc(cur.to)}"></label>
    </div></div>
    <div class="mf"><button id="winClear" style="margin-right:auto">Clear window</button>
      <button id="winCancel">Cancel</button><button class="primary" id="winOk">Apply</button></div></div></div>`;
  const close=()=>root.innerHTML='';
  root.querySelector('#winCancel').onclick=close;
  const apply=(f,t)=>{
    for(const k of keys){ if(f&&t) JOB_WINDOWS.set(k,{from:f,to:t}); else JOB_WINDOWS.delete(k); }
    persistTrim(); renderJobs(); close();
    showToast(f&&t?`${keys.length} job(s) set to ${f}–${t}`:`Window cleared on ${keys.length} job(s)`);
  };
  root.querySelector('#winClear').onclick=()=>apply('','');
  root.querySelector('#winOk').onclick=()=>{
    const f=root.querySelector('#winF').value, t=root.querySelector('#winT').value;
    if((f&&!t)||(t&&!f)){ showToast('A window needs both a start and an end','err'); return; }
    if(f&&t&&f>=t){ showToast('The end has to be after the start','err'); return; }
    apply(f,t);
  };
}
document.getElementById('winBtn').onclick=openWindowModal;
document.getElementById('crewMapBtn').onclick=()=>{
  if(!jobsHeader){ showToast('Load a Sage export first'); return; }
  toggleCrewMap();
};
document.getElementById('cmCap').oninput=()=>renderCrewMap(false);
const depotEl=document.getElementById('depotToggle');
depotEl.checked=DEPOTS_ON;
depotEl.onchange=()=>{ DEPOTS_ON=depotEl.checked; save(K_DEPOTS,DEPOTS_ON);
  showToast(DEPOTS_ON?'Crew depots ON — each working crew is appended as a Depot row'
                     :'Crew depots OFF — orders only, for territories'); };
document.getElementById('cmReset').onclick=()=>{
  if(!Object.keys(PREVIEW_STARTS).length){ showToast('Nothing moved'); return; }
  PREVIEW_STARTS={}; renderCrewMap(true); showToast('Back to each crew’s saved start');
};
/* A dragged pin is a what-if until it's asked for. Saving keeps it for good as
   another named start on that crew — their real home stays in the dropdown, so
   the manager can flip back to it any morning. Each pin is named on its own:
   moving three crews usually means three different places, not one. */
document.getElementById('cmSave').onclick=()=>{
  const moved=Object.keys(PREVIEW_STARTS);
  if(!moved.length){ showToast('Drag a start first'); return; }
  const root=document.getElementById('modalRoot2');
  const rows=moved.map(k=>{
    const c=CREWS[+k]||{}, p=PREVIEW_STARTS[k];
    const nm=`${c.name||''} ${c.last||''}`.trim()||c.code||`Crew ${+k+1}`;
    const away=isFinite(+c.lat)?haversineMi(+c.lat,+c.lng,p.lat,p.lng):null;
    return `<tr data-row="${k}">
      <td style="white-space:nowrap">${esc(nm)}<div class="muted" style="font-size:11px">
        ${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}${away!=null?` · ${away.toFixed(1)} mi from home`:''}</div></td>
      <td><input type="text" data-nm="${k}" value="Map start" placeholder="name this start"
        style="width:100%;padding:6px 8px;font:inherit;font-size:13px;border:1px solid var(--line);border-radius:8px"></td>
      <td style="width:34px"><input type="checkbox" data-keep="${k}" checked title="save this one"></td></tr>`;
  }).join('');
  root.innerHTML=`<div class="backdrop"><div class="modal" style="max-width:620px">
    <div class="mh"><h3>Keep these starts</h3>
      <div class="muted" style="font-size:12px;margin-top:4px">Each one is added to that crew as a named start location.
        Their real home stays where it is &mdash; switch between them from the crew list any time.</div></div>
    <div class="mb"><div class="tablewrap"><table>
      <thead><tr><th>Crew</th><th>Name this start</th><th></th></tr></thead><tbody>${rows}</tbody></table></div></div>
    <div class="mf"><button id="ssCancel">Cancel</button><button class="primary" id="ssOk">Save</button></div></div></div>`;
  root.querySelector('#ssCancel').onclick=()=>root.innerHTML='';
  root.querySelector('#ssOk').onclick=()=>{
    let n=0, skipped=0;
    for(const k of moved){
      if(!root.querySelector(`[data-keep="${k}"]`).checked){ skipped++; continue; }
      const label=root.querySelector(`[data-nm="${k}"]`).value.trim();
      if(!label){ skipped++; continue; }
      const c=CREWS[+k]; if(!c) continue;
      const p=PREVIEW_STARTS[k], L=crewLocs(c);
      const hit=L.findIndex(x=>norm(x.label)===norm(label));
      if(hit>=0){ L[hit].lat=p.lat; L[hit].lng=p.lng; crewSetLoc(c,hit); }
      else { L.push({label,lat:p.lat,lng:p.lng}); crewSetLoc(c,L.length-1); }
      delete PREVIEW_STARTS[k];
      n++;
    }
    persistCrews(); renderCrews(); root.innerHTML=''; renderCrewMap(false);
    showToast(n?`Kept ${n} start location${n===1?'':'s'}${skipped?` · ${skipped} left as a what-if`:''}`
               :'Nothing saved');
  };
};
document.getElementById('subsMapBtn').onclick=()=>toggleSubsMap();
document.getElementById('subsFoldBtn').onclick=()=>{
  SUBS_FOLDERS=!SUBS_FOLDERS; save(K_SUBFOLD,SUBS_FOLDERS);
  document.getElementById('subsFoldBtn').classList.toggle('primary',SUBS_FOLDERS);
  OPEN_FAMS.clear(); renderSubs();
  showToast(SUBS_FOLDERS?'Phases grouped into folders':'Flat list — every phase on its own row');
};
document.getElementById('subsSortBtn').onclick=()=>{
  SUBS_SORT=SUBS_SORT==='az'?'geo':'az';
  save(K_SUBSORT,SUBS_SORT);
  document.getElementById('subsSortBtn').innerHTML='Sort: '+(SUBS_SORT==='geo'?'Region':'A&ndash;Z');
document.getElementById('subsFoldBtn').classList.toggle('primary',SUBS_FOLDERS);
  renderSubs();
};
document.getElementById('subsSortBtn').innerHTML='Sort: '+(SUBS_SORT==='geo'?'Region':'A&ndash;Z');
const subsListEl=document.getElementById('subsList');
subsListEl.addEventListener('change',e=>{
  const t=e.target;
  if(t.dataset.f==null||t.dataset.i==null) return;
  const s=SUBS[+t.dataset.i]; if(!s) return;
  const v=t.value.trim();
  if(t.dataset.f==='name'){
    if(!v){ t.value=s.name; return; }
    if(norm(v)!==norm(s.name) && SUBS.some(x=>x!==s&&norm(x.name)===norm(v))){ showToast('That name already exists'); t.value=s.name; return; }
    s.name=v;
  } else s[t.dataset.f]=v;
  persistSubs(); renderSubs();
});
subsListEl.addEventListener('click',e=>{
  const fold=e.target.closest('[data-fam]');
  if(fold){ const k=fold.dataset.fam; if(OPEN_FAMS.has(k)) OPEN_FAMS.delete(k); else OPEN_FAMS.add(k); renderSubs(); return; }
  const t=e.target.closest('[data-geo],[data-adel],[data-aadd],[data-map],[data-del]');
  if(!t) return;
  if(t.dataset.geo!=null) return openGeoEditor(+t.dataset.geo);
  if(t.dataset.map!=null) return focusSubOnMap(+t.dataset.map);
  if(t.dataset.del!=null){ const i=+t.dataset.del; if(confirm('Delete "'+SUBS[i].name+'"?')){ SUBS.splice(i,1); persistSubs(); renderSubs(); } return; }
  if(t.dataset.adel!=null){ const i=+t.dataset.adel, ai=+t.dataset.ai; SUBS[i].aliases.splice(ai,1); persistSubs(); renderSubs(); return; }
  if(t.dataset.aadd!=null){
    const i=+t.dataset.aadd;
    const input=document.createElement('input');
    input.type='text'; input.className='alias-input'; input.placeholder='new alias…';
    t.replaceWith(input); input.focus();
    let committed=false; // Enter triggers blur too — commit exactly once
    const commit=()=>{
      if(committed) return; committed=true;
      const val=input.value.trim();
      if(val){ const s=SUBS[i];
        if(s){ if(!Array.isArray(s.aliases)) s.aliases=[];
          if(!s.aliases.some(a=>norm(a)===norm(val))){ s.aliases.push(val); persistSubs(); } } }
      renderSubs();
    };
    input.addEventListener('keydown',ev=>{ if(ev.key==='Enter'){ ev.preventDefault(); commit(); } else if(ev.key==='Escape'){ committed=true; renderSubs(); } });
    input.addEventListener('blur',commit);
    return;
  }
});

// crews
document.getElementById('crewSearch').oninput=renderCrews;
document.getElementById('addCrewBtn').onclick=()=>editCrewModal(-1);
document.getElementById('exportCrews').onclick=()=>download('crews.json',JSON.stringify(CREWS,null,2));
document.getElementById('importCrews').onchange=e=>{ const f=e.target.files[0]; if(!f)return; const rd=new FileReader(); rd.onload=()=>{ try{const d=JSON.parse(rd.result); if(!Array.isArray(d))throw 0; CREWS=d.map(x=>({name:x.name||'',last:x.last||'',code:x.code||'',email:x.email||'',lat:x.lat,lng:x.lng,active:x.active!==false})); persistCrews(); renderCrews(); showToast('Imported '+CREWS.length+' crews'); }catch(err){ showToast('Invalid JSON'); } }; rd.readAsText(f); e.target.value=''; };
document.getElementById('resetCrews').onclick=()=>{ if(confirm('Reset the crew library to the original seed?')){ CREWS=JSON.parse(JSON.stringify(REGION_CREWS_SEED)); persistCrews({force:true}); renderCrews(); showToast('Reset'); } };
document.getElementById('crewBody').addEventListener('change',e=>{
  const t=e.target;
  if(t.dataset.togglecrew!=null){ const i=+t.dataset.togglecrew; CREWS[i].active=t.checked; persistCrews(); renderCrews(); }
  if(t.dataset.crewloc!=null){ const c=CREWS[+t.dataset.crewloc]; crewSetLoc(c,+t.value); persistCrews(); renderCrews();
    showToast(`${c.name} ${c.last||''} starts from ${crewLocs(c)[+t.value].label}`.trim()); }
});
document.getElementById('crewBody').addEventListener('click',e=>{
  const t=e.target;
  if(t.dataset.editcrew!=null) return editCrewModal(+t.dataset.editcrew);
  if(t.dataset.delcrew!=null){ const i=+t.dataset.delcrew; if(confirm('Delete crew "'+CREWS[i].name+'"?')){ CREWS.splice(i,1); persistCrews(); renderCrews(); } }
});

// surface script errors instead of dying silently — shows the first error in a
// dismissible red bar so problems can be reported with the actual message
let _errShown=false;
window.addEventListener('error',ev=>{
  if(_errShown) return; _errShown=true;
  const d=document.createElement('div');
  d.style.cssText='position:fixed;left:12px;right:12px;bottom:12px;z-index:99;background:#fef2f2;border:1px solid #dc2626;color:#991b1b;border-radius:10px;padding:10px 14px;font-size:12.5px;display:flex;gap:10px;align-items:center;box-shadow:0 8px 24px rgba(0,0,0,.15)';
  d.innerHTML=`<b>Something broke:</b> <span style="flex:1;font-family:ui-monospace,Menlo,monospace">${esc(String(ev.message||'unknown error'))}${ev.lineno?' (line '+ev.lineno+')':''}</span>
    <button class="small" onclick="this.parentNode.remove()">Dismiss</button>`;
  document.body.appendChild(d);
});

// init
const APP_VERSION='v25 · 2026-09-09';
document.getElementById('appVer').textContent=APP_VERSION+' · '+REGION;
// region switcher: each region is its own workspace; a click stores the choice
// and reloads so the whole app boots into that region's storage
(function(){
  document.documentElement.style.setProperty('--brand',REGION_DEFS[REGION].c);
  document.documentElement.style.setProperty('--brand-d',REGION_DEFS[REGION].d);
  const bar=document.getElementById('regionBar');
  bar.innerHTML=Object.keys(REGION_DEFS).map(r=>
    `<div class="region${r===REGION?' active':''}" data-region="${r}"${r===REGION?` style="color:${REGION_DEFS[r].c}"`:''}>${r}</div>`).join('');
  bar.onclick=e=>{
    const t=e.target.closest('[data-region]');
    if(!t||t.dataset.region===REGION) return;
    try{ localStorage.setItem(K_REGION,t.dataset.region); }catch(err){}
    location.reload();
  };
})();
renderSubs(); renderCrews();
</script>
</body>
</html>
```


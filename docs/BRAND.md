# Logo and favicon

The mark is Delhi's own street plan: the two rings and radial roads of Connaught Place, with one marked point on the outer ring, the place being observed. Seven radials of uneven length keep it from reading as a ship's wheel. It is an original design for this project and carries the same MIT licence as the code.

## Files (`assets/`)

| File | Use |
|---|---|
| `favicon.svg` | Browser tab icon (navy tile). Also linked from every page. |
| `favicon-32.png`, `favicon.ico` (also at the repository root) | Fallbacks. The .ico holds 16, 32 and 48 px images. |
| `apple-touch-icon.png` (180 px) | iPhone and iPad home screen. Square, because iOS rounds the corners. |
| `icon-192.png`, `icon-512.png`, `site.webmanifest` | Android and installable-app icons. Full bleed, with the mark inside the maskable safe zone. |
| `logo-mark.svg` / `logo-mark.png` | The mark alone, no background. `logo-mark.svg` is for dark backgrounds (the site header uses it); `logo-mark-light.svg` and `logo-mark.png` are for white. |
| `logo.svg` / `logo.png` | Horizontal lockup, mark plus "Delhi Urban Safety Observatory", for light backgrounds. The PNG (1360 x 256) is the reliable one: the SVG uses live text, so it falls back to Arial or Segoe UI where IBM Plex Sans is not installed. |

## Colours

Navy `#1c2331` (also the header and the theme colour), amber `#e3a13b`, ivory `#f2f3f5`, rust `#d9654a` on navy and `#b14a34` on white.

## Use

Keep clear space of at least a quarter of the mark's width around it. Do not recolour it, stretch it or put it on a busy image. The header mark is built at page-build time from `assets/logo-mark.svg` (`scripts/build_site.js`), so changing that one file changes it everywhere after a rebuild.

## Regenerating

To change the design, edit `scripts/make_brand.js` and run it, then re-render the PNG sizes in the table (the .ico packs the 16, 32 and 48 px images). `test/branding.test.js` checks that every file exists at the size the pages declare.

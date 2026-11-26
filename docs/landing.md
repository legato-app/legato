# The landing's 3D scene

One Blender scene, built entirely by `scripts/landing/scene.py`: a phone, a desktop monitor and a laptop showing
Legato (the site's own screenshots, `site/public/shots`), with a gold note, a record, headphones and a sync wave
floating around them. Nothing is modelled by hand, so the renders can be made again at any time.

## What it makes

- **The website hero** (`site/components/DeviceScene.tsx`, Figma « Landing concept »): the page opens on the wide view
  of the three devices under the headline. Scrolling plays a camera move into the visitor's screen, square on; there
  the live demo takes the screen's place and the story goes on (`site/components/Story.tsx`).
  - A phone-sized window (under 1000 px) gets the phone's move, framed upright. Wider ones get their device from
    `site/components/device.ts`:
    - a battery that is running down or not full (Chromium) → the laptop (an Android tablet too);
    - anything else → the monitor.
  - 96 frames each, 1600×900 (the phone's 900×1600), a keyframe on every frame (`-g 1`) so the scroll's seeks land at
    once. Each is an MP4 (H.264), about half the size of its WebM (VP9) twin, the fallback.
  - The poster is the first frame, the wide view: the page's first look, and all that reduced motion shows. The film
    loads after the page (or at the first scroll).
  - The live interface rides the visitor's screen the whole way, sharper than any render: the film shows that screen
    dark, and `site/components/screens.json` (written by the render) holds its four corners in every frame, which the
    site maps the live window onto (`site/components/homography.ts`). The poster keeps every screen lit.
  - Files: `site/public/landing/{phone,monitor,laptop}-{dark,light}.{webm,mp4,webp}`.
  - The screens show `site/public/shots`, which predate the interface's latest words (« Your library », now
    « Library »). Re-capture the shots, then render again; nothing captures them yet.
  - The videos are laid on the page colour (`#131313` / `#FFFFFF`), not transparent, because Safari plays no WebM with
    alpha.
- **The README picture**: `site/public/landing/float-{dark,light}.svg`, picked through `<picture>`.
  - Each object is rendered alone (transparent), embedded as a WebP data URI, and floats by CSS `@keyframes`.
  - GitHub shows an SVG inside `<img>`: its CSS animation plays there, scripts and outside files don't.
  - About 80 KB a theme.

## Making them again

```
node scripts/landing/render.mjs [--samples 32] [--only hero|readme]
```

- Needs Blender 5 (`BLENDER` env var, else Steam's path) and `ffmpeg` on PATH.
- About 5 minutes on an RTX 3060 Ti with Eevee for the six moves (`--only hero`). Renders run one at a time; nothing
  else should load the GPU then.
- A release job could call the same command after the screenshots change, then commit `site/public/landing`.

For one still or the `.blend`:

```
blender -b -P scripts/landing/scene.py -- --variant dark --out render.png --scale 100 --blend scene.blend
```

Options: `--shot wide|phone|monitor|laptop`, `--frames 48`, `--size 2880x1200`, `--only "Phone,Vinyl"` (groups
named in the script), `--samples`, `--tex`.

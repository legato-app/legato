# The landing's 3D scene

One Blender scene, built entirely by `scripts/landing/scene.py`: a phone, a desktop monitor and a laptop showing
Legato (the site's own screenshots, `site/public/shots`), with a gold note, a record, headphones and a sync wave
floating around them. Nothing is modelled by hand, so the renders can be made again at any time.

## What it makes

- **The website hero** (`site/components/DeviceScene.tsx`): a two-second camera move from the three devices to the
  visitor's own, then it stays there.
  - The device is picked by `site/components/device.ts`:
    - Android → the phone;
    - a battery that is running down or not full (Chromium) → the laptop;
    - anything else → the monitor.
  - Each move is a WebM (VP9) with an MP4 (H.264) fallback, plus its last frame as a WebP poster. Reduced motion shows
    the poster only.
  - On a phone the scroll plays the move (the scene rises, then fades into the phone with the live demo), so the phone's
    files have a keyframe on every frame (`-g 1`, about 1 MB each); the others play once at load.
  - Files: `site/public/landing/{phone,monitor,laptop}-{dark,light}.{webm,mp4,webp}`.
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
- About 10 minutes on an RTX 3060 Ti with Eevee. Renders run one at a time; nothing else should load the GPU then.
- A release job could call the same command after the screenshots change, then commit `site/public/landing`.

For one still or the `.blend`:

```
blender -b -P scripts/landing/scene.py -- --variant dark --out render.png --scale 100 --blend scene.blend
```

Options: `--shot wide|phone|monitor|laptop`, `--frames 48`, `--size 2880x1200`, `--only "Phone,Vinyl"` (groups
named in the script), `--samples`, `--tex`.

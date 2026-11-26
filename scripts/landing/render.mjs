// The landing's renders, from scripts/landing/scene.py (docs/landing.md): the site hero's camera moves, one per device
// and theme (site/public/landing/<device>-<theme>.{webm,mp4,webp}), and the README's floating picture
// (site/public/landing/float-<theme>.svg). Needs Blender 5 (BLENDER, else Steam's) and ffmpeg on PATH.
//   node scripts/landing/render.mjs [--samples 32] [--only hero|readme]
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const scene = join(here, 'scene.py')
const out = join(here, '..', '..', 'site', 'public', 'landing')
const work = join(tmpdir(), 'legato-landing-render')
const blender = process.env.BLENDER ?? 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Blender\\blender.exe'
const option = (name, fallback) => {
  const at = process.argv.indexOf(`--${name}`)
  return at > 0 ? process.argv[at + 1] : fallback
}
const samples = option('samples', '32')
const only = option('only', '')

/** The page colour each theme's video is laid on (site/app/globals.css --bg): no alpha, Safari plays no WebM alpha. */
export const PAGE = { dark: '0x131313', light: '0xFFFFFF' }
export const DEVICES = ['phone', 'monitor', 'laptop']
/** README layers, back to front; each floats on its own (groups named in scene.py). Shadows stay still. */
export const LAYERS = [['Phone shadow', 'Monitor shadow', 'Laptop shadow'], ['Vinyl'], ['Monitor'], ['Phone'], ['Laptop'], ['Eighth note'], ['Headphones'], ['Sync']]
const HERO = { size: '1280x800', frames: 48, rate: 24 }
const README = { width: 1440, height: 600 }

const run = (command, args) => execFileSync(command, args, { stdio: ['ignore', 'ignore', 'inherit'] })
const render = (args) => run(blender, ['-b', '-P', scene, '--', '--samples', samples, '--scale', '100', ...args])
/** ffmpeg: `input` laid on the theme's page colour. */
const onPage = (theme, size) => ['-f', 'lavfi', '-i', `color=c=${PAGE[theme]}:s=${size}`, '-filter_complex', '[1][0]overlay=shortest=1,format=yuv420p']

function hero(theme, device) {
  const frames = join(work, `${theme}-${device}-`)
  render(['--variant', theme, '--shot', device, '--frames', String(HERO.frames), '--size', HERO.size, '--out', `${frames}####`])
  const input = ['-y', '-framerate', String(HERO.rate), '-i', `${frames}%04d.png`]
  const name = join(out, `${device}-${theme}`)
  // The phone's move is played by the scroll (site DeviceScene): a keyframe every frame, so a seek lands at once; a
  // little more compression keeps it near 1 MB. The others play once.
  const scrubbed = device === 'phone'
  const [webm, mp4] = scrubbed ? [['-g', '1', '-crf', '46'], ['-g', '1', '-crf', '30']] : [['-crf', '40'], ['-crf', '27']]
  run('ffmpeg', [...input, ...onPage(theme, HERO.size), '-c:v', 'libvpx-vp9', ...webm, '-b:v', '0', '-row-mt', '1', '-an', `${name}.webm`])
  run('ffmpeg', [...input, ...onPage(theme, HERO.size), '-c:v', 'libx264', ...mp4, '-preset', 'slow', '-movflags', '+faststart', '-an', `${name}.mp4`])
  const last = `${frames}${String(HERO.frames).padStart(4, '0')}.png`
  run('ffmpeg', ['-y', '-i', last, ...onPage(theme, HERO.size), '-frames:v', '1', '-c:v', 'libwebp', '-quality', '80', `${name}.webp`])
}

/** The README picture: each layer rendered alone (transparent), embedded as WebP, floated by CSS (plays in an <img>). */
export function floatingSvg(layers, { width, height }) {
  const images = layers.map((data, index) => `<image class="l${index}" href="data:image/webp;base64,${data}" width="${width}" height="${height}"/>`)
  const timing = layers.map((_, index) => (index === 0 ? '.l0{animation:none}' : `.l${index}{animation-duration:${5 + ((index * 1.3) % 3)}s;animation-delay:-${index * 0.7}s}`))
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`,
    '<style>@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}',
    `image{animation:float 6s ease-in-out infinite}${timing.join('')}`,
    '@media (prefers-reduced-motion:reduce){image{animation:none}}</style>',
    ...images,
    '</svg>',
  ].join('\n')
}

function readme(theme) {
  const layers = LAYERS.map((names, index) => {
    const png = join(work, `${theme}-layer-${index}.png`)
    const webp = png.replace(/png$/, 'webp')
    render(['--variant', theme, '--size', `${README.width * 2}x${README.height * 2}`, '--only', names.join(','), '--out', png])
    run('ffmpeg', ['-y', '-i', png, '-vf', `scale=${README.width}:-1`, '-c:v', 'libwebp', '-quality', '72', webp])
    return readFileSync(webp).toString('base64')
  })
  writeFileSync(join(out, `float-${theme}.svg`), floatingSvg(layers, README))
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  rmSync(work, { recursive: true, force: true })
  mkdirSync(work, { recursive: true })
  mkdirSync(out, { recursive: true })
  for (const theme of ['dark', 'light']) {
    if (only !== 'readme') DEVICES.forEach((device) => hero(theme, device))
    if (only !== 'hero') readme(theme)
  }
}

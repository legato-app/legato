<div align="center">

# Legato

**One library and one player for YouTube Music, Spotify, Apple Music and your own files.**

Windows 10 and 11 · free · no account of ours

[![Latest release](https://img.shields.io/github/v/release/legato-app/legato?label=release&color=7CB8FF&labelColor=0F0F0F)](https://github.com/legato-app/legato/releases/latest)
[![check](https://img.shields.io/github/actions/workflow/status/legato-app/legato/check.yml?branch=master&label=check&labelColor=0F0F0F)](https://github.com/legato-app/legato/actions/workflows/check.yml)
[![License: source-available](https://img.shields.io/badge/license-source--available-7CB8FF?labelColor=0F0F0F)](LICENSE)

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="site/public/landing/float-dark.svg">
  <img alt="Legato on a phone, a desktop monitor and a laptop, with a music note, a record, headphones and a sync wave floating around them" src="site/public/landing/float-light.svg">
</picture>

</div>

## Get it

Download `Legato_…_x64-setup.exe` from the [latest release](https://github.com/legato-app/legato/releases/latest) and run it.
For a small PC, releases that carry `Legato.Lite_…_x64-setup.exe` offer Legato Lite: the essentials, installed beside Legato.

## Editions and platforms

- **Legato Lite** (Windows): a lighter build with its own library. It leaves out the Live Editor, the visualizer, song
  fades, the Music Detector, Discord, plugins, listening rooms, the phone remote, the streaming overlay, the blind test,
  living-room mode, karaoke, podcasts and audiobooks.
- **Linux**: in progress. CI checks it on Linux, and the maintainers build a trial AppImage to test it on a real desktop;
  there is no release yet.
- **Android**: the APK is in the releases, as a Beta (the newest one is on the `beta` release). Connect Spotify opens
  Exportify in your browser, then takes the export file you saved. Not yet tried on a phone.
- **Backups**: Add from a backup (Settings › Library and storage) merges a backup file into your library, removing
  nothing. A backup made by this version or an older one works; a newer one is refused.

## Everything else is on the website

What it does, how each service plays, what leaves your PC, which file to download, Windows' SmartScreen warning,
Stable or Beta, the FAQ: **<https://legato-app.github.io/legato/>** (its source is `site/`).

## Community

Questions, ideas and news: [join the Discord](https://discord.gg/WsqAuCSxQU), or use
[GitHub Discussions](https://github.com/legato-app/legato/discussions).

## Contributing

Build from source, the checks and the conventions: [CONTRIBUTING.md](CONTRIBUTING.md) and [docs/](docs/README.md).

## License

Source-available, not open source. You may use the app for free. Issues and pull requests are welcome; changing the
code for any other purpose, or reusing any part of it in another project, requires the author's written permission.
See [LICENSE](LICENSE).

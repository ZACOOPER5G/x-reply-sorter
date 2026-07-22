# X Reply Sorter

No more rage bait decided by the algorithm. Automatically sort X/Twitter replies by Likes, Recent, or Relevant.

## How it works

1. Install the extension
2. Pick your preferred sort order in the popup
3. Every tweet you open sorts replies your way — automatically

Uses X's native `?sort_replies` query parameter on direct page loads and clicks X's own sort dropdown for in-app navigation. Nothing is injected into the page.

## Features

- **Instant** — sorts before the page renders on direct loads
- **Private** — zero data collection, no tracking, no analytics
- **Set and forget** — choose once, applies everywhere
- **Open source** — verify exactly what it does

## Install

<!-- [Add to Chrome](https://chrome.google.com/webstore/detail/x-reply-sorter/YOUR_EXTENSION_ID) -->

Or load unpacked from `build/chrome-mv3-prod` via `chrome://extensions`.

## Development

```bash
npm install
npm run dev       # Start dev server with hot reload
npm run build     # Production build
npm run package   # Package .zip for Chrome Web Store
```

Built with [Plasmo](https://www.plasmo.com/), React, and TypeScript.

## Support

- [Buy me a coffee](https://ko-fi.com/zacooper)
- [Sponsor on GitHub](https://github.com/sponsors/zacooper5g)
- [Report an issue](https://github.com/zacooper5g/x-reply-sorter/issues)

## Privacy

Zero data collection. Your sort preference is stored locally in your browser and never leaves your device. [Full privacy policy](https://zacooper5g.github.io/x-reply-sorter/privacy.html).

## License

MIT

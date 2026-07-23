# X Reply Sorter

> Chrome extension to sort X (Twitter) replies by likes, newest, or most relevant.

<!-- Uncomment once extension ID is assigned:
[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/EXTENSION_ID)](https://chrome.google.com/webstore/detail/EXTENSION_ID)
[![Chrome Web Store Users](https://img.shields.io/chrome-web-store/users/EXTENSION_ID)](https://chrome.google.com/webstore/detail/EXTENSION_ID)
[![Chrome Web Store Rating](https://img.shields.io/chrome-web-store/rating/EXTENSION_ID)](https://chrome.google.com/webstore/detail/EXTENSION_ID)
-->

## Install

<!-- [**Add to Chrome**](https://chrome.google.com/webstore/detail/EXTENSION_ID) (free) -->

Or load unpacked from `build/chrome-mv3-prod` via `chrome://extensions`.

## What It Does

Sort replies on any X.com tweet by:

- **Most Liked** — see the highest-engagement replies first
- **Newest** — see the most recent replies first
- **Most Relevant** — X's default algorithm

## Why

X doesn't let you choose how replies are sorted. The "best" replies are chosen by an algorithm you can't control. This extension gives you that control.

## How It Works

1. Install the extension
2. Pick your preferred sort order in the popup
3. Every tweet you open sorts replies your way — automatically

Uses X's native `?sort_replies` query parameter on direct page loads and clicks X's own sort dropdown for in-app navigation.

## Features

- **Instant** — sorts before the page renders on direct loads
- **Private** — zero data collection, no tracking, no analytics
- **Set and forget** — choose once, applies everywhere
- **Lightweight** — no impact on browser performance
- **Compatible** — works on Chrome, Edge, Brave, Arc, and all Chromium browsers

## Privacy

Zero data collection. Your sort preference is stored locally in your browser and never leaves your device. No accounts, no tracking, no network requests.

[Full privacy policy](https://zacooper5g.github.io/x-reply-sorter/privacy.html)

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

## Known Limitations

- On direct page loads, the `?sort_replies` param adds an extra history entry — pressing back once clears the param, requiring a second press to navigate away. Fix planned for a future release.

## License

MIT

# Tab Hoarders

Arc-style nested folders of saved URLs in the browser side panel. Chrome is the primary target; Helium is the secondary browser.

Product requirements: [docs/PRD.md](docs/PRD.md).

## Setup

Requires Node.js 22 or newer (`.nvmrc` pins 26).

```sh
nvm use
npm install
```

## Build and load

```sh
npm run build
```

Then load the extension:

1. Open `chrome://extensions` (or `helium://extensions`) and turn on **Developer mode**.
2. Click **Load unpacked** and choose the `.output/chrome-mv3` folder. It is hidden in Finder, so press **Cmd+Shift+G** in the picker and paste the full path.
3. After each rebuild, click the reload icon on the extension's card.

## Scripts

| Script | What it does |
|---|---|
| `npm run build` | Production build into `.output/chrome-mv3` |
| `npm run build:dev` | Development build into `.output/chrome-mv3-dev`. The panel adds buttons to load sample data or clear all data. |
| `npm run dev` | Dev build with hot reload (WXT also tries to launch a browser) |
| `npm run compile` | TypeScript type check |
| `npm test` | Unit tests (Vitest), once |
| `npm run test:watch` | Unit tests, re-run on every change |
| `npm run zip` | Package a zip for the store |

The production and development builds load as two separate extensions, each with its own storage.

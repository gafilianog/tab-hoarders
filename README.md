# Tab Hoarders

Arc-style nested folders of saved URLs in the browser side panel. Chrome is the primary target; Helium is the secondary browser.

Product requirements: [docs/PRD.md](docs/PRD.md). The MVP is complete; section 16 lists what it covers and what is carried forward.

## Features

- A side panel with a tree of folders nested to any depth, holding saved pages. Click the toolbar icon to open it.
- **Save tab** saves the current tab into the folder shown in the **to** dropdown. Right-clicking a web page and choosing **Save page to Tab Hoarders** saves it to the end of the top level.
- Clicking a saved page switches to a tab already showing that page, or opens a new tab.
- **Open all pages** on a folder opens every page in it and its subfolders as background tabs. More than 20 tabs asks first.
- Drag and drop to reorder rows and move them between folders, or use **Move to...** from a row's menu.
- Rename and delete from a row's menu (right-click or **⋯**). Deleting a page offers Undo for 8 seconds.
- Every change is saved at once and shows up in the panels of all open windows.
- Data stays in the browser profile. The extension makes no network requests and needs no access to websites.

## Keyboard

The tree is one Tab stop.

| Key | Action |
|---|---|
| ↑ ↓, Home, End | Move between rows |
| → | Open a folder, or step into an open one |
| ← | Close a folder, or step out to its parent |
| Enter or Space | Open a page or toggle a folder |
| F2 | Rename |
| Delete or Backspace | Delete |
| Shift+F10 | Open the row's menu |

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
| `npm run build:dev` | Development build into `.output/chrome-mv3-dev`. The panel adds buttons to load sample data, load a 1,000-page sample, or clear all data. |
| `npm run dev` | Dev build with hot reload (WXT also tries to launch a browser) |
| `npm run compile` | TypeScript type check |
| `npm test` | Unit tests (Vitest), once |
| `npm run test:watch` | Unit tests, re-run on every change |
| `npm run zip` | Package a zip for the store |

The production and development builds load as two separate extensions, each with its own storage.

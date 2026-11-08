import { defineConfig } from 'wxt';

// https://wxt.dev/api/reference/wxt/interfaces/inlineconfig.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Tab Hoarders',
    // The Side Panel API needs Chromium 114 or newer.
    minimum_chrome_version: '114',
    // favicon: show each saved page's icon from the browser's own favicon
    // cache, so the extension never fetches icons from the network.
    // tabs: read the current tab's URL and title to save it, and find an
    // already-open tab with a saved URL. Chrome shows this at install as
    // "Read your browsing history".
    // contextMenus: the right-click "Save page to Tab Hoarders" entry. It
    // adds no install warning.
    permissions: ['sidePanel', 'storage', 'favicon', 'tabs', 'contextMenus'],
    // Declaring an action gives the extension a toolbar icon. The background
    // script makes a click on that icon open the side panel.
    action: { default_title: 'Open Tab Hoarders' },
  },
});

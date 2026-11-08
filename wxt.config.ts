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
    permissions: ['sidePanel', 'storage', 'favicon'],
    // Declaring an action gives the extension a toolbar icon. The background
    // script makes a click on that icon open the side panel.
    action: { default_title: 'Open Tab Hoarders' },
  },
});

export default defineBackground(() => {
  // Make a click on the toolbar icon open the side panel. Chrome remembers
  // this setting, but setting it on every service worker start is cheap and
  // keeps it correct after an update.
  browser.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error: unknown) => console.error('setPanelBehavior failed', error));
});

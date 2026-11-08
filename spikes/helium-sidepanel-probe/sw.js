// Throwaway probe. Results are printed to the service worker console.
(async () => {
  console.log('PROBE typeof chrome.sidePanel =', typeof chrome.sidePanel);
  try {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    console.log('PROBE setPanelBehavior = ok');
  } catch (e) {
    console.log('PROBE setPanelBehavior = ERROR', e.message);
  }
  try {
    console.log('PROBE getOptions =', JSON.stringify(await chrome.sidePanel.getOptions({})));
  } catch (e) {
    console.log('PROBE getOptions = ERROR', e.message);
  }
})();

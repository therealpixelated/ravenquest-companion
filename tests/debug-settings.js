/**
 * Quick debug script to test settings.js loading
 */

const { _electron: electron } = require('playwright');
const path = require('path');

async function debug() {
  console.log('Launching Electron...');

  const electronApp = await electron.launch({
    args: [path.join(__dirname, '..', 'main.js')]
  });

  const window = await electronApp.firstWindow();

  // Capture all console messages
  window.on('console', (msg) => {
    console.log(`[${msg.type()}] ${msg.text()}`);
  });

  // Capture page errors
  window.on('pageerror', (error) => {
    console.log('[PAGE ERROR]', error.message);
  });

  await window.waitForLoadState('domcontentloaded');
  console.log('DOM loaded, waiting for scripts...');
  await window.waitForTimeout(2000);

  // Check what scripts loaded
  const scriptStatus = await window.evaluate(() => ({
    // Check if functions exist
    openSettings: typeof window.openSettings,
    closeSettings: typeof window.closeSettings,
    electronAPI: typeof window.electronAPI,
    uiHelpers: typeof window.uiHelpers,

    // Check DOM elements
    settingsOverlay: !!document.getElementById('settingsOverlay'),
    settingsBtn: !!document.querySelector('.settings-btn'),

    // Try to manually call openSettings
    canCallOpenSettings: false
  }));

  console.log('\n=== Script Status ===');
  console.log(JSON.stringify(scriptStatus, null, 2));

  // Try clicking the button manually
  console.log('\n=== Attempting to click settings button ===');
  try {
    await window.locator('.settings-btn').click();
    await window.waitForTimeout(500);

    const overlayActive = await window.evaluate(() => {
      const overlay = document.getElementById('settingsOverlay');
      return overlay ? overlay.classList.contains('active') : false;
    });
    console.log('Overlay active after click:', overlayActive);
  } catch (e) {
    console.log('Click failed:', e.message);
  }

  // Check if there's an error in loading settings.js specifically
  console.log('\n=== Checking script elements ===');
  const scripts = await window.evaluate(() => {
    const scriptTags = document.querySelectorAll('script');
    return Array.from(scriptTags).map((s) => ({
      src: s.src,
      loaded: !s.src || s.readyState !== 'loading'
    }));
  });
  console.log('Scripts:', scripts);

  await electronApp.close();
  console.log('\nDone!');
}

debug().catch(console.error);

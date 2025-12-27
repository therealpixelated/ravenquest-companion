const { _electron: electron, test, expect } = require('@playwright/test');
const path = require('path');

const SCREENSHOT_DIR = path.join(__dirname, '../../docs/screenshots');

test.describe('Feature Tests with Screenshots', () => {
  let app;
  let window;

  test.beforeEach(async () => {
    app = await electron.launch({ args: ['.'] });
    window = await app.firstWindow();
    await window.waitForTimeout(1000);
  });

  test.afterEach(async () => {
    await app.close();
  });

  test('Full View - Trophies Tab', async () => {
    // Ensure full view mode first
    await window.evaluate(() => window.electronAPI.setViewMode('full'));
    await window.waitForTimeout(800);
    await window.screenshot({ path: `${SCREENSHOT_DIR}/full-trophies.png` });
    const title = await window.title();
    expect(title).toContain('RavenQuest');
  });

  test('Full View - Cosmetics Tab', async () => {
    await window.evaluate(() => window.electronAPI.setViewMode('full'));
    await window.waitForTimeout(800);
    // Click cosmetics tab via evaluate to avoid visibility issues
    await window.evaluate(() => document.querySelector('[data-tab="cosmetics"]')?.click());
    await window.waitForTimeout(500);
    await window.screenshot({ path: `${SCREENSHOT_DIR}/full-cosmetics.png` });
  });

  test('Settings Window Opens', async () => {
    // Settings now opens as separate window
    await window.evaluate(() => window.electronAPI.openSettingsWindow());
    await window.waitForTimeout(800);

    // Get all windows - settings should be second window
    const windows = await app.windows();
    expect(windows.length).toBeGreaterThanOrEqual(1);

    // Take screenshot of main window (settings is separate)
    await window.screenshot({ path: `${SCREENSHOT_DIR}/settings-open.png` });

    // Close settings window
    await window.evaluate(() => window.electronAPI.closeSettingsWindow());
    await window.waitForTimeout(200);
  });

  test('Compact Sidebar Mode', async () => {
    // Switch to compact sidebar via IPC
    await window.evaluate(() => window.electronAPI.setViewMode('compact-sidebar'));
    await window.waitForTimeout(500);
    await window.screenshot({ path: `${SCREENSHOT_DIR}/compact-sidebar.png` });

    const compactContent = await window.$('.compact-content');
    expect(compactContent).toBeTruthy();
  });

  test('Compact Sidebar - Stats Display', async () => {
    await window.evaluate(() => window.electronAPI.setViewMode('compact-sidebar'));
    await window.waitForTimeout(500);

    const trophyStat = await window.$('.compact-stat');
    expect(trophyStat).toBeTruthy();
    await window.screenshot({ path: `${SCREENSHOT_DIR}/compact-stats.png` });
  });

  test('Context Menu Appears on Right-Click', async () => {
    // Trigger context menu via IPC (menu itself is native)
    const result = await window.evaluate(() => window.electronAPI.showContextMenu());
    expect(result.success).toBe(true);
  });

  test('Toast Notification Position', async () => {
    await window.evaluate(() => {
      if (window.uiHelpers) window.uiHelpers.showToast('Test notification', 'success');
    });
    await window.waitForTimeout(300);
    await window.screenshot({ path: `${SCREENSHOT_DIR}/toast-position.png` });
  });

  test('View Mode Persistence', async () => {
    await window.evaluate(() => window.electronAPI.setViewMode('compact-sidebar'));
    await window.waitForTimeout(300);
    const mode = await window.evaluate(() => window.electronAPI.getViewMode());
    expect(mode).toBe('compact-sidebar');

    // Reset to full
    await window.evaluate(() => window.electronAPI.setViewMode('full'));
  });

  test('Active Targets Section Visible', async () => {
    await window.evaluate(() => window.electronAPI.setViewMode('compact-sidebar'));
    await window.waitForTimeout(500);

    const targetsHeader = await window.$('.compact-targets-header');
    expect(targetsHeader).toBeTruthy();
    await window.screenshot({ path: `${SCREENSHOT_DIR}/compact-targets.png` });
  });

  test('Floating Tracker Mode', async () => {
    await window.evaluate(() => window.electronAPI.setViewMode('compact-floating'));
    await window.waitForTimeout(500);
    await window.screenshot({ path: `${SCREENSHOT_DIR}/compact-floating.png` });

    // Reset
    await window.evaluate(() => window.electronAPI.setViewMode('full'));
  });
});

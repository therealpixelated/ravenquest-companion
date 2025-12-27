/**
 * Electron GUI Tests using Playwright
 * Run with: npx playwright test tests/gui.test.js
 */

const { test, expect } = require('@playwright/test');
const { _electron: electron } = require('playwright');
const path = require('path');

let electronApp;
let window;

test.beforeAll(async () => {
  // Launch Electron app
  electronApp = await electron.launch({
    args: [path.join(__dirname, '..', 'main.js')],
    env: {
      ...process.env,
      NODE_ENV: 'test'
    }
  });

  // Wait for the first window
  window = await electronApp.firstWindow();

  // Wait for app to be ready
  await window.waitForLoadState('domcontentloaded');

  // Give extra time for scripts to initialize
  await window.waitForTimeout(1000);
});

test.afterAll(async () => {
  if (electronApp) {
    await electronApp.close();
  }
});

test.describe('App Launch', () => {
  test('should launch and show main window', async () => {
    const title = await window.title();
    expect(title).toBe('RavenQuest Companion');
  });

  test('should have navigation tabs', async () => {
    const trophiesTab = await window.locator('#trophies-tab');
    const cosmeticsTab = await window.locator('#cosmetics-tab');

    await expect(trophiesTab).toBeVisible();
    await expect(cosmeticsTab).toBeVisible();
  });

  test('should have settings button', async () => {
    const settingsBtn = await window.locator('.settings-btn');
    await expect(settingsBtn).toBeVisible();
  });
});

test.describe('Settings Panel', () => {
  test('settings button should be clickable', async () => {
    const settingsBtn = await window.locator('.settings-btn');

    // Check if openSettings function exists
    const hasOpenSettings = await window.evaluate(() => typeof window.openSettings === 'function');
    console.log('openSettings exists:', hasOpenSettings);

    // Check for JavaScript errors
    const errors = [];
    window.on('pageerror', (error) => {
      errors.push(error.message);
    });

    // Try clicking
    await settingsBtn.click();
    await window.waitForTimeout(500);

    if (errors.length > 0) {
      console.log('JavaScript errors:', errors);
    }

    // Check if overlay became active
    const overlay = await window.locator('#settingsOverlay');
    const hasActiveClass = await overlay.evaluate((el) => el.classList.contains('active'));
    console.log('Settings overlay has active class:', hasActiveClass);

    expect(hasActiveClass).toBe(true);
  });

  test('settings overlay should contain settings panel', async () => {
    // Ensure settings is open
    const overlay = await window.locator('#settingsOverlay');
    const isActive = await overlay.evaluate((el) => el.classList.contains('active'));

    if (!isActive) {
      await window.locator('.settings-btn').click();
      await window.waitForTimeout(500);
    }

    const settingsPanel = await window.locator('.settings-panel');
    await expect(settingsPanel).toBeVisible();
  });

  test('should close settings when clicking close button', async () => {
    // Ensure settings is open first
    const overlay = await window.locator('#settingsOverlay');
    let isActive = await overlay.evaluate((el) => el.classList.contains('active'));

    if (!isActive) {
      await window.locator('.settings-btn').click();
      await window.waitForTimeout(500);
    }

    // Click close button
    const closeBtn = await window.locator('.settings-close');
    await closeBtn.click();
    await window.waitForTimeout(300);

    isActive = await overlay.evaluate((el) => el.classList.contains('active'));
    expect(isActive).toBe(false);
  });
});

test.describe('Opacity Slider', () => {
  test('opacity slider should exist', async () => {
    const slider = await window.locator('#opacitySlider');
    await expect(slider).toBeVisible();
  });

  test('opacity slider should be functional', async () => {
    const slider = await window.locator('#opacitySlider');

    // Get initial value
    const initialValue = await slider.inputValue();
    console.log('Initial opacity value:', initialValue);

    // Try to change it
    await slider.fill('50');
    await window.waitForTimeout(300);

    const newValue = await slider.inputValue();
    console.log('New opacity value:', newValue);

    expect(newValue).toBe('50');
  });
});

test.describe('Tab Navigation', () => {
  test('should switch to cosmetics tab', async () => {
    const cosmeticsTab = await window.locator('#cosmetics-tab');
    await cosmeticsTab.click();
    await window.waitForTimeout(300);

    const isActive = await cosmeticsTab.evaluate((el) => el.classList.contains('active'));
    expect(isActive).toBe(true);
  });

  test('should switch back to trophies tab', async () => {
    const trophiesTab = await window.locator('#trophies-tab');
    await trophiesTab.click();
    await window.waitForTimeout(300);

    const isActive = await trophiesTab.evaluate((el) => el.classList.contains('active'));
    expect(isActive).toBe(true);
  });
});

test.describe('Debug: Check Window State', () => {
  test('check all global functions', async () => {
    const globals = await window.evaluate(() => ({
      openSettings: typeof window.openSettings,
      closeSettings: typeof window.closeSettings,
      updateSetting: typeof window.updateSetting,
      setViewMode: typeof window.setViewMode,
      updateOpacity: typeof window.updateOpacity,
      toggleHotkeyRecording: typeof window.toggleHotkeyRecording,
      electronAPI: typeof window.electronAPI,
      uiHelpers: typeof window.uiHelpers
    }));

    console.log('Global functions:', globals);

    expect(globals.openSettings).toBe('function');
    expect(globals.closeSettings).toBe('function');
    expect(globals.electronAPI).toBe('object');
  });

  test('check for console errors during load', async () => {
    const consoleMessages = [];
    const consoleErrors = [];

    window.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      } else {
        consoleMessages.push(msg.text());
      }
    });

    // Reload to capture errors
    await window.reload();
    await window.waitForLoadState('domcontentloaded');
    await window.waitForTimeout(2000);

    console.log('Console messages:', consoleMessages);
    console.log('Console errors:', consoleErrors);

    // We want zero errors ideally
    if (consoleErrors.length > 0) {
      console.warn('Found console errors:', consoleErrors);
    }
  });
});

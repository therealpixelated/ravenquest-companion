const { _electron: electron, test, expect } = require('@playwright/test');

async function getOpacity(app) {
  return app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getOpacity());
}

async function getPosition(app) {
  return app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    const b = win.getBounds();
    return { x: b.x, y: b.y };
  });
}

async function setOpacity(window, pct) {
  const slider = await window.$('#opacitySlider');
  await slider.evaluate((el, value) => {
    el.value = String(value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, pct);
}

test('opacity slider updates window opacity', async () => {
  const app = await electron.launch({ args: ['.'] });
  const window = await app.firstWindow();
  await window.waitForTimeout(500);

  await setOpacity(window, 40);
  await window.waitForTimeout(100);
  const opacity = await getOpacity(app);
  expect(opacity).toBeCloseTo(0.4, 1);

  await app.close();
});

test('dragging header moves window', async () => {
  const app = await electron.launch({ args: ['.'] });
  const window = await app.firstWindow();
  await window.waitForTimeout(500);

  const before = await getPosition(app);
  await app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    const b = win.getBounds();
    win.setBounds({ ...b, x: b.x + 120, y: b.y + 120 });
  });
  await window.waitForTimeout(150);
  const after = await getPosition(app);

  expect(after.x !== before.x || after.y !== before.y).toBe(true);

  await app.close();
});

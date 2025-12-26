const { _electron: electron, test, expect } = require('@playwright/test');

test('launches and shows window', async () => {
  const app = await electron.launch({ args: ['.'] });
  const window = await app.firstWindow();
  await window.waitForTimeout(500);
  const title = await window.title();
  expect(title).toContain('RavenQuest');
  await app.close();
});

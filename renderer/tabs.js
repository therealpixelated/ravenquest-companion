document.addEventListener('DOMContentLoaded', () => {
  const buttons = Array.from(document.querySelectorAll('.tab-button'));
  const sections = Array.from(document.querySelectorAll('.tab-section'));

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;

      // Close settings panel if open
      if (typeof window.closeSettings === 'function') {
        window.closeSettings();
      }

      buttons.forEach((b) => {
        const isActive = b === btn;
        b.classList.toggle('active', isActive);
        b.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });
      sections.forEach((sec) => {
        const isActive = sec.id === `tab-${target}`;
        sec.classList.toggle('active', isActive);
        sec.setAttribute('aria-hidden', isActive ? 'false' : 'true');
      });
      btn.focus();
    });
  });

  document.addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    const activeIndex = buttons.findIndex((b) => b.classList.contains('active'));
    const delta = e.key === 'ArrowRight' ? 1 : -1;
    const nextIndex = (activeIndex + delta + buttons.length) % buttons.length;
    buttons[nextIndex].click();
  });

  // Right-click context menu
  document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (window.electronAPI?.showContextMenu) {
      window.electronAPI.showContextMenu();
    }
  });
});

/**
 * settings.js - Thème, avatar, PIN via paramètres
 */
const Settings = (function () {
  const THEME_KEY = 'eneo_theme';

  function getTheme() {
    return Storage.getSetting(THEME_KEY, 'light');
  }

  function setTheme(theme) {
    Storage.setSetting(THEME_KEY, theme);
    document.documentElement.setAttribute('data-theme', theme);
  }

  function initTheme() {
    const theme = getTheme();
    document.documentElement.setAttribute('data-theme', theme);
    return theme;
  }

  function toggleTheme() {
    const current = getTheme();
    const next = current === 'dark' ? 'light' : 'dark';
    setTheme(next);
    return next;
  }

  function updateAvatarUI() {
    const src = Storage.getAvatar();
    document.querySelectorAll('#sidebar-avatar, #settings-avatar').forEach((el) => {
      el.src = src;
    });
  }

  function setAvatarFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        Storage.setAvatar(reader.result);
        updateAvatarUI();
        resolve(reader.result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function updateStorageInfo() {
    const el = document.getElementById('storage-info');
    if (!el) return;
    const est = await Storage.getStorageEstimate();
    const usage = est.usage || 0;
    const quota = est.quota || 0;
    const format = (bytes) => {
      if (bytes < 1024) return bytes + ' o';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' Ko';
      if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' Mo';
      return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' Go';
    };
    const allMedia = await Storage.getAllMedia();
    el.textContent = `${allMedia.length} média(s) · ${format(usage)} utilisés` +
      (quota ? ` / ${format(quota)}` : '');
  }

  return {
    getTheme,
    setTheme,
    initTheme,
    toggleTheme,
    updateAvatarUI,
    setAvatarFromFile,
    updateStorageInfo
  };
})();

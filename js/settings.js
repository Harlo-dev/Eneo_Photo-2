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

  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' o';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' Ko';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' Mo';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' Go';
  }

  function applyStorageUI({ usage, quota, mediaCount }) {
    const pct = quota > 0 ? Math.min(100, Math.round((usage / quota) * 100)) : 0;
    const left = quota > 0 ? Math.max(0, 100 - pct) : 100;
    const usageStr = formatBytes(usage);
    const quotaStr = quota ? formatBytes(quota) : '—';

    const info = document.getElementById('storage-info');
    if (info) {
      info.textContent = `${mediaCount} média(s) · ${usageStr} utilisés` +
        (quota ? ` / ${quotaStr}` : '');
    }

    const panelPct = document.getElementById('panel-storage-percent');
    const panelDetail = document.getElementById('panel-storage-detail');
    if (panelPct) panelPct.textContent = quota ? `${left}% restant` : 'Stockage local';
    if (panelDetail) {
      panelDetail.textContent = quota
        ? `${usageStr} sur ${quotaStr} utilisés`
        : `${usageStr} utilisés · ${mediaCount} fichier(s)`;
    }

    ['panel-storage-fill', 'settings-storage-fill'].forEach((id) => {
      const fill = document.getElementById(id);
      if (fill) fill.style.width = (quota ? pct : Math.min(mediaCount * 2, 100)) + '%';
    });
  }

  async function updateStorageInfo() {
    const est = await Storage.getStorageEstimate();
    const allMedia = await Storage.getAllMedia();
    applyStorageUI({
      usage: est.usage || 0,
      quota: est.quota || 0,
      mediaCount: allMedia.filter((m) => !m.isDeleted).length
    });
  }

  return {
    getTheme,
    setTheme,
    initTheme,
    toggleTheme,
    updateAvatarUI,
    setAvatarFromFile,
    updateStorageInfo,
    formatBytes
  };
})();

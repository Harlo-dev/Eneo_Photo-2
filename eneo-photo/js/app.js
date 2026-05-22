/**
 * app.js - Point d'entrée et orchestration Eneo Photo
 */
const App = (function () {
  let currentView = 'recent';
  let currentFilter = 'all';
  let currentAlbumId = null;
  let currentMedia = null;
  let pinMode = 'setup'; // setup | verify | change
  let pinBuffer = '';
  let pinConfirm = null;
  let pendingAction = null;

  const VIEW_TITLES = {
    recent: 'Récents',
    albums: 'Albums',
    archive: 'Archive',
    locked: 'Verrouillés',
    trash: 'Corbeille',
    settings: 'Paramètres'
  };

  async function init() {
    await Storage.openDB();
    Settings.initTheme();
    Settings.updateAvatarUI();
    initPINKeypad();
    bindEvents();

    if (!LockManager.hasPIN()) {
      showPINOverlay('setup');
    } else {
      document.getElementById('app').classList.remove('hidden');
      await refreshCurrentView();
    }
  }

  /* --- PIN UI --- */

  function initPINKeypad() {
    const keypad = document.getElementById('pin-keypad');
    keypad.innerHTML = '';
    const keys = ['1','2','3','4','5','6','7','8','9','','0','⌫'];
    keys.forEach((k) => {
      const btn = document.createElement('button');
      btn.className = 'pin-key' + (k === '' ? ' empty' : '');
      btn.textContent = k;
      if (k === '⌫') btn.addEventListener('click', () => pinBackspace());
      else if (k) btn.addEventListener('click', () => pinPress(k));
      keypad.appendChild(btn);
    });
  }

  function showPINOverlay(mode, action = null) {
    pinMode = mode;
    pendingAction = action;
    pinBuffer = '';
    pinConfirm = null;
    updatePINDots();

    const overlay = document.getElementById('pin-overlay');
    const title = document.getElementById('pin-title');
    const subtitle = document.getElementById('pin-subtitle');
    const cancel = document.getElementById('pin-cancel');

    overlay.classList.remove('hidden');

    if (mode === 'setup') {
      title.textContent = 'Configurer votre PIN';
      subtitle.textContent = 'Créez un code à 4 chiffres pour sécuriser vos médias';
      cancel.classList.add('hidden');
    } else if (mode === 'change') {
      title.textContent = 'Nouveau PIN';
      subtitle.textContent = 'Entrez votre nouveau code à 4 chiffres';
      cancel.classList.remove('hidden');
    } else {
      title.textContent = 'Entrez votre PIN';
      subtitle.textContent = 'Accès au contenu verrouillé';
      cancel.classList.remove('hidden');
    }
  }

  function hidePINOverlay() {
    document.getElementById('pin-overlay').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
  }

  function updatePINDots() {
    const dots = document.querySelectorAll('#pin-dots span');
    dots.forEach((d, i) => d.classList.toggle('filled', i < pinBuffer.length));
  }

  function pinPress(digit) {
    if (pinBuffer.length >= 4) return;
    pinBuffer += digit;
    updatePINDots();
    if (pinBuffer.length === 4) setTimeout(handlePINComplete, 200);
  }

  function pinBackspace() {
    pinBuffer = pinBuffer.slice(0, -1);
    updatePINDots();
  }

  async function handlePINComplete() {
    const pin = pinBuffer;
    pinBuffer = '';
    updatePINDots();

    if (pinMode === 'setup' || pinMode === 'change') {
      if (!pinConfirm) {
        pinConfirm = pin;
        document.getElementById('pin-subtitle').textContent = 'Confirmez votre code';
        return;
      }
      if (pin !== pinConfirm) {
        UIRenderer.showToast('Les codes ne correspondent pas');
        pinConfirm = null;
        document.getElementById('pin-subtitle').textContent = 'Créez un code à 4 chiffres';
        return;
      }
      await LockManager.setPIN(pin);
      LockManager.startSession();
      hidePINOverlay();
      if (pinMode === 'change') {
        UIRenderer.showToast('PIN modifié');
        return;
      }
      UIRenderer.showToast('PIN configuré');
      await refreshCurrentView();
      return;
    }

    const valid = await LockManager.verifyPIN(pin);
    if (!valid) {
      UIRenderer.showToast('PIN incorrect');
      return;
    }
    LockManager.startSession();
    hidePINOverlay();
    if (pendingAction) {
      await pendingAction();
      pendingAction = null;
    }
    await refreshCurrentView();
  }

  async function requirePIN(action) {
    if (LockManager.isSessionValid()) {
      await action();
      return;
    }
    showPINOverlay('verify', action);
  }

  /* --- Navigation --- */

  function navigateTo(view) {
    if (view === 'locked' && !LockManager.isSessionValid()) {
      showPINOverlay('verify', () => navigateTo('locked'));
      return;
    }

    currentView = view;
    currentAlbumId = null;

    document.querySelectorAll('.nav-item, .bottom-nav-item').forEach((el) => {
      el.classList.toggle('active', el.dataset.view === view);
    });

    document.querySelectorAll('.view-section').forEach((sec) => {
      sec.classList.remove('active');
    });

    const viewMap = {
      recent: 'view-recent',
      albums: 'view-albums',
      archive: 'view-archive',
      locked: 'view-locked',
      trash: 'view-trash',
      settings: 'view-settings'
    };

    document.getElementById(viewMap[view])?.classList.add('active');
    document.getElementById('view-title').textContent = VIEW_TITLES[view] || view;

    document.getElementById('filter-group').style.display =
      view === 'recent' ? 'flex' : 'none';

    document.getElementById('sidebar')?.classList.remove('open');
    refreshCurrentView();
  }

  async function refreshCurrentView() {
    switch (currentView) {
      case 'recent': await renderRecent(); break;
      case 'albums':
        if (currentAlbumId) await showAlbumDetail(currentAlbumId);
        else await renderAlbums();
        break;
      case 'archive': await renderArchive(); break;
      case 'locked': await renderLocked(); break;
      case 'trash': await renderTrash(); break;
      case 'settings': Settings.updateStorageInfo(); break;
    }
  }

  async function renderRecent() {
    const opts = { recentOnly: true };
    if (currentFilter !== 'all') opts.type = currentFilter;
    const media = await MediaManager.getAllMedia(opts);
    UIRenderer.clearGrid('grid-recent');
    UIRenderer.renderGrid('grid-recent', media, {
      onClick: (m) => openMedia(m)
    });
    UIRenderer.toggleEmpty('grid-recent', 'empty-recent', media.length === 0);
  }

  async function renderArchive() {
    const media = await MediaManager.getAllMedia({ archivedOnly: true });
    UIRenderer.clearGrid('grid-archive');
    UIRenderer.renderGrid('grid-archive', media, { onClick: openMedia });
    UIRenderer.toggleEmpty('grid-archive', 'empty-archive', media.length === 0);
  }

  async function renderLocked() {
    const media = await MediaManager.getAllMedia({ lockedOnly: true });
    const blurred = !LockManager.isSessionValid();
    UIRenderer.clearGrid('grid-locked');
    UIRenderer.renderGrid('grid-locked', media, {
      blurred,
      onClick: (m) => {
        if (m.isLocked && !LockManager.isSessionValid()) {
          requirePIN(() => openMedia(m));
        } else {
          openMedia(m);
        }
      }
    });
    UIRenderer.toggleEmpty('grid-locked', 'empty-locked', media.length === 0);
  }

  async function renderTrash() {
    const media = await TrashManager.getTrash();
    UIRenderer.clearGrid('grid-trash');
    UIRenderer.renderGrid('grid-trash', media, { onClick: openMedia });
    UIRenderer.toggleEmpty('grid-trash', 'empty-trash', media.length === 0);
    document.getElementById('trash-actions').classList.toggle('hidden', media.length === 0);
  }

  async function renderAlbums() {
    document.getElementById('view-album-detail')?.classList.remove('active');
    document.getElementById('album-detail-header')?.classList.add('hidden');
    const albums = await AlbumManager.getAlbumsWithCovers();
    UIRenderer.renderAlbums(
      albums,
      (album) => showAlbumDetail(album.id, album.name),
      async (id) => {
        await AlbumManager.deleteAlbum(id);
        UIRenderer.showToast('Album supprimé');
        await renderAlbums();
      }
    );
  }

  async function showAlbumDetail(albumId, name) {
    currentAlbumId = albumId;
    if (!name) {
      const album = await Storage.getAlbum(albumId);
      name = album?.name || 'Album';
    }
    document.getElementById('view-albums').classList.remove('active');
    const detailSec = document.getElementById('view-album-detail');
    detailSec.classList.add('active');
    const header = document.getElementById('album-detail-header');
    header.classList.remove('hidden');
    document.getElementById('album-detail-title').textContent = name;
    const media = await AlbumManager.getAlbumMedia(albumId);
    UIRenderer.clearGrid('grid-album');
    UIRenderer.renderGrid('grid-album', media, { onClick: openMedia });
  }

  /* --- Media viewer --- */

  async function openMedia(media) {
    if (media.isLocked && !LockManager.isSessionValid()) {
      currentMedia = media;
      requirePIN(() => openMedia(media));
      return;
    }
    currentMedia = media;
    UIRenderer.openMediaModal(media);
    UIRenderer.renderViewerActions(media, {
      lock: async () => {
        await requirePIN(async () => {
          await LockManager.lockMedia(media.id);
          UIRenderer.showToast('Média verrouillé');
          closeModalAndRefresh();
        });
      },
      unlock: async () => {
        await requirePIN(async () => {
          await LockManager.unlockMedia(media.id);
          UIRenderer.showToast('Média déverrouillé');
          closeModalAndRefresh();
        });
      },
      archive: async () => {
        await MediaManager.archiveMedia(media.id);
        UIRenderer.showToast('Archivé');
        closeModalAndRefresh();
      },
      unarchive: async () => {
        await MediaManager.unarchiveMedia(media.id);
        UIRenderer.showToast('Désarchivé');
        closeModalAndRefresh();
      },
      addToAlbum: () => showAddToAlbum(media.id),
      removeFromAlbum: async () => {
        await AlbumManager.removeMediaFromAlbum(media.id);
        UIRenderer.showToast('Retiré de l\'album');
        closeModalAndRefresh();
      },
      delete: async () => {
        await TrashManager.softDelete(media.id);
        UIRenderer.showToast('Déplacé vers la corbeille');
        closeModalAndRefresh();
      },
      restore: async () => {
        await TrashManager.restore(media.id);
        UIRenderer.showToast('Restauré');
        closeModalAndRefresh();
      },
      permanentDelete: async () => {
        if (confirm('Supprimer définitivement ?')) {
          await TrashManager.permanentDelete(media.id);
          UIRenderer.showToast('Supprimé définitivement');
          closeModalAndRefresh();
        }
      }
    });
  }

  function closeModalAndRefresh() {
    UIRenderer.closeMediaModal();
    currentMedia = null;
    refreshCurrentView();
  }

  async function showAddToAlbum(mediaId) {
    const albums = await Storage.getAlbums();
    UIRenderer.renderAlbumPicker(albums, async (albumId) => {
      await AlbumManager.addMediaToAlbum(mediaId, albumId);
      document.getElementById('add-album-modal').classList.add('hidden');
      UIRenderer.showToast('Ajouté à l\'album');
      closeModalAndRefresh();
    });
    document.getElementById('add-album-modal').classList.remove('hidden');
  }

  /* --- Upload --- */

  async function handleFiles(files) {
    if (!files.length) return;
    UIRenderer.showToast(`Import de ${files.length} fichier(s)...`);
    const uploaded = await MediaManager.uploadFiles(files);
    UIRenderer.showToast(`${uploaded.length} média(s) ajouté(s)`);
    await refreshCurrentView();
  }

  /* --- Events --- */

  function bindEvents() {
    document.querySelectorAll('[data-view]').forEach((el) => {
      el.addEventListener('click', () => navigateTo(el.dataset.view));
    });

    document.getElementById('upload-btn')?.addEventListener('click', () => {
      document.getElementById('file-input').click();
    });
    document.getElementById('empty-upload-btn')?.addEventListener('click', () => {
      document.getElementById('file-input').click();
    });

    document.getElementById('file-input')?.addEventListener('change', (e) => {
      handleFiles([...e.target.files]);
      e.target.value = '';
    });

    document.getElementById('screen-capture-btn')?.addEventListener('click', async () => {
      try {
        await MediaManager.captureScreen();
        UIRenderer.showToast('Capture ajoutée');
        await refreshCurrentView();
      } catch (err) {
        UIRenderer.showToast(err.message || 'Capture impossible');
      }
    });

    // Drag & drop
    const main = document.querySelector('.main-content');
    ['dragenter', 'dragover'].forEach((ev) => {
      main.addEventListener(ev, (e) => {
        e.preventDefault();
        document.getElementById('drop-overlay').classList.remove('hidden');
      });
    });
    ['dragleave', 'drop'].forEach((ev) => {
      main.addEventListener(ev, (e) => {
        e.preventDefault();
        if (ev === 'drop') handleFiles([...e.dataTransfer.files]);
        document.getElementById('drop-overlay').classList.add('hidden');
      });
    });

    document.getElementById('menu-toggle')?.addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('open');
    });

    document.querySelectorAll('.filter-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        if (currentView === 'recent') renderRecent();
      });
    });

    document.getElementById('modal-close')?.addEventListener('click', closeModalAndRefresh);
    document.getElementById('modal-backdrop')?.addEventListener('click', closeModalAndRefresh);

    document.getElementById('create-album-btn')?.addEventListener('click', () => {
      document.getElementById('album-modal').classList.remove('hidden');
      document.getElementById('album-name-input').value = '';
      document.getElementById('album-name-input').focus();
    });

    document.getElementById('album-save-btn')?.addEventListener('click', async () => {
      const name = document.getElementById('album-name-input').value.trim();
      if (!name) return;
      await AlbumManager.createAlbum(name);
      document.getElementById('album-modal').classList.add('hidden');
      UIRenderer.showToast('Album créé');
      await renderAlbums();
    });

    document.getElementById('album-cancel-btn')?.addEventListener('click', () => {
      document.getElementById('album-modal').classList.add('hidden');
    });
    document.getElementById('album-modal-backdrop')?.addEventListener('click', () => {
      document.getElementById('album-modal').classList.add('hidden');
    });

    document.getElementById('album-back-btn')?.addEventListener('click', () => {
      currentAlbumId = null;
      document.getElementById('view-album-detail').classList.remove('active');
      document.getElementById('view-albums').classList.add('active');
      renderAlbums();
    });

    document.getElementById('empty-trash-btn')?.addEventListener('click', async () => {
      if (confirm('Vider la corbeille définitivement ?')) {
        const n = await TrashManager.emptyTrash();
        UIRenderer.showToast(`${n} élément(s) supprimé(s)`);
        await renderTrash();
      }
    });

    document.getElementById('add-album-close')?.addEventListener('click', () => {
      document.getElementById('add-album-modal').classList.add('hidden');
    });
    document.getElementById('add-album-backdrop')?.addEventListener('click', () => {
      document.getElementById('add-album-modal').classList.add('hidden');
    });

    document.getElementById('pin-cancel')?.addEventListener('click', () => {
      document.getElementById('pin-overlay').classList.add('hidden');
      pinConfirm = null;
    });

    document.getElementById('theme-toggle')?.addEventListener('change', (e) => {
      Settings.setTheme(e.target.checked ? 'dark' : 'light');
    });

    document.getElementById('theme-toggle').checked = Settings.getTheme() === 'dark';

    document.getElementById('change-pin-btn')?.addEventListener('click', () => {
      pinMode = 'change';
      showPINOverlay('change');
    });

    document.getElementById('change-avatar-btn')?.addEventListener('click', () => {
      document.getElementById('avatar-input').click();
    });

    document.getElementById('avatar-input')?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) {
        await Settings.setAvatarFromFile(file);
        UIRenderer.showToast('Photo de profil mise à jour');
      }
      e.target.value = '';
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        UIRenderer.closeMediaModal();
        document.querySelectorAll('.modal').forEach((m) => {
          if (m.id !== 'pin-overlay') m.classList.add('hidden');
        });
      }
    });
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', () => App.init());

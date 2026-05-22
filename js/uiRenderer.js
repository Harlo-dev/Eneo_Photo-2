/**
 * uiRenderer.js - Rendu DOM ciblé, lazy loading, grilles
 */
const UIRenderer = (function () {
  const observerMap = new WeakMap();
  let lazyObserver = null;

  function initLazyObserver() {
    if (lazyObserver) return lazyObserver;
    lazyObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          const src = el.dataset.src;
          if (src) {
            if (el.tagName === 'IMG') el.src = src;
            else el.style.backgroundImage = `url(${src})`;
            el.classList.add('loaded');
            el.removeAttribute('data-src');
          }
          lazyObserver.unobserve(el);
        });
      },
      { rootMargin: '100px' }
    );
    return lazyObserver;
  }

  function createMediaElement(media, options = {}) {
    const { blurred = false, onClick, showActions = true } = options;
    const item = document.createElement('div');
    item.className = 'media-item lazy';
    item.dataset.id = media.id;
    if (options.uniform) item.dataset.title = media.name;

    const thumb = media.thumbnail || media.dataURL;
    if (media.type === 'video') {
      const img = document.createElement('img');
      img.alt = media.name;
      img.dataset.src = thumb;
      img.loading = 'lazy';
      item.appendChild(img);
      const indicator = document.createElement('span');
      indicator.className = 'video-indicator';
      indicator.textContent = '▶';
      item.appendChild(indicator);
    } else {
      const img = document.createElement('img');
      img.alt = media.name;
      img.dataset.src = thumb;
      img.loading = 'lazy';
      item.appendChild(img);
    }

    if (media.isLocked) {
      const lock = document.createElement('span');
      lock.className = 'lock-indicator';
      lock.textContent = '🔒';
      item.appendChild(lock);
    }

    if (blurred || (media.isLocked && !LockManager.isSessionValid())) {
      item.querySelector('img')?.style && (item.querySelector('img').style.filter = `blur(var(--blur-locked))`);
    }

    const imgEl = item.querySelector('img');
    if (imgEl) initLazyObserver().observe(imgEl);

    item.addEventListener('click', () => {
      if (onClick) onClick(media, item);
    });

    return item;
  }

  function renderGrid(containerId, mediaList, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const existingIds = new Set(
      [...container.querySelectorAll('.media-item')].map((el) => el.dataset.id)
    );
    const newIds = new Set(mediaList.map((m) => m.id));

    // Remove stale items
    container.querySelectorAll('.media-item').forEach((el) => {
      if (!newIds.has(el.dataset.id)) el.remove();
    });

    mediaList.forEach((media, index) => {
      if (existingIds.has(media.id)) return;
      const el = createMediaElement(media, options);
      if (!options.uniform) {
        if (index % 7 === 0) el.classList.add('wide');
        if (index % 11 === 0) el.classList.add('tall');
      }
      container.appendChild(el);
    });

    // Update order without full re-render
    const fragment = document.createDocumentFragment();
    mediaList.forEach((media) => {
      const el = container.querySelector(`[data-id="${media.id}"]`);
      if (el) fragment.appendChild(el);
    });
    container.appendChild(fragment);
  }

  function clearGrid(containerId) {
    const container = document.getElementById(containerId);
    if (container) container.innerHTML = '';
  }

  const FOLDER_ICONS = ['🗂️', '👤', '🎓', '📦', '📂', '⭐'];

  function renderFolderCards(containerId, albums, onAlbumClick, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    const { showAdd = false, onAdd, max = 8 } = options;
    const slice = albums.slice(0, max);

    slice.forEach((album, i) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = `folder-card tint-${i % 4}`;
      card.innerHTML = `
        <span class="folder-icon">${FOLDER_ICONS[i % FOLDER_ICONS.length]}</span>
        <span class="folder-name">${escapeHtml(album.name)}</span>
        <span class="folder-count">${album.count} fichier${album.count !== 1 ? 's' : ''}</span>
      `;
      card.addEventListener('click', () => onAlbumClick(album));
      container.appendChild(card);
    });

    if (showAdd && onAdd) {
      const add = document.createElement('button');
      add.type = 'button';
      add.className = 'folder-card folder-add';
      add.textContent = '+';
      add.title = 'Nouvel album';
      add.addEventListener('click', onAdd);
      container.appendChild(add);
    }
  }

  function renderSharedAlbums(albums, onAlbumClick) {
    const list = document.getElementById('shared-albums-list');
    if (!list) return;
    list.innerHTML = '';
    const slice = albums.slice(0, 4);
    if (!slice.length) {
      const empty = document.createElement('p');
      empty.className = 'storage-detail';
      empty.textContent = 'Aucun album pour le moment';
      list.appendChild(empty);
      return;
    }
    slice.forEach((album, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `shared-item shared-tint-${i % 4}`;
      btn.innerHTML = `
        <span>
          <span class="shared-item-name">${escapeHtml(album.name)}</span>
          <span class="shared-item-count">${album.count} élément${album.count !== 1 ? 's' : ''}</span>
        </span>
        <span>📁</span>
      `;
      btn.addEventListener('click', () => onAlbumClick(album));
      list.appendChild(btn);
    });
  }

  function renderAlbums(albums, onAlbumClick, onDelete) {
    const grid = document.getElementById('albums-grid');
    const foldersRow = document.getElementById('albums-folders-row');
    const empty = document.getElementById('empty-albums');
    if (!grid && !foldersRow) return;

    if (grid) grid.innerHTML = '';
    if (foldersRow) {
      renderFolderCards('albums-folders-row', albums, onAlbumClick, {
        showAdd: true,
        onAdd: () => document.getElementById('create-album-btn')?.click()
      });
    }

    if (!albums.length) {
      empty?.classList.remove('hidden');
      return;
    }
    empty?.classList.add('hidden');

    albums.forEach((album, index) => {
      const card = document.createElement('div');
      card.className = 'album-card';
      card.dataset.id = album.id;

      const cover = document.createElement('div');
      cover.className = 'album-cover';

      if (album.covers.length) {
        album.covers.forEach((src) => {
          const img = document.createElement('img');
          img.src = src;
          img.alt = '';
          cover.appendChild(img);
        });
        while (cover.children.length < 4 && cover.children.length > 0) {
          cover.appendChild(cover.children[0].cloneNode(true));
        }
      } else {
        const ph = document.createElement('div');
        ph.className = 'cover-placeholder';
        ph.textContent = '📁';
        ph.style.gridColumn = '1 / -1';
        ph.style.gridRow = '1 / -1';
        cover.appendChild(ph);
      }

      const info = document.createElement('div');
      info.className = 'album-info';
      info.innerHTML = `<h3>${escapeHtml(album.name)}</h3><span>${album.count} élément${album.count !== 1 ? 's' : ''}</span>`;

      card.appendChild(cover);
      card.appendChild(info);

      card.addEventListener('click', () => onAlbumClick(album));
      card.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (confirm(`Supprimer l'album "${album.name}" ?`)) onDelete(album.id);
      });

      grid.appendChild(card);
    });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function showToast(message) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  function toggleEmpty(containerId, emptyId, isEmpty) {
    const empty = document.getElementById(emptyId);
    if (empty) empty.classList.toggle('hidden', !isEmpty);
  }

  function renderViewerActions(media, handlers) {
    const actions = document.getElementById('viewer-actions');
    if (!actions) return;
    actions.innerHTML = '';

    const buttons = [];

    if (!media.isDeleted) {
      if (media.isLocked) {
        buttons.push({ label: '🔓 Déverrouiller', action: handlers.unlock });
      } else {
        buttons.push({ label: '🔒 Verrouiller', action: handlers.lock });
      }
      if (media.isArchived) {
        buttons.push({ label: '📤 Désarchiver', action: handlers.unarchive });
      } else {
        buttons.push({ label: '📦 Archiver', action: handlers.archive });
      }
      buttons.push({ label: '📁 Album', action: handlers.addToAlbum });
      if (media.albumId) {
        buttons.push({ label: '↩ Retirer album', action: handlers.removeFromAlbum });
      }
      buttons.push({ label: '🗑️ Supprimer', action: handlers.delete, danger: true });
    } else {
      buttons.push({ label: '↩ Restaurer', action: handlers.restore });
      buttons.push({ label: '❌ Supprimer définitivement', action: handlers.permanentDelete, danger: true });
    }

    buttons.forEach(({ label, action, danger }) => {
      const btn = document.createElement('button');
      btn.textContent = label;
      if (danger) btn.classList.add('danger');
      btn.addEventListener('click', action);
      actions.appendChild(btn);
    });
  }

  function openMediaModal(media) {
    const modal = document.getElementById('media-modal');
    const viewer = document.getElementById('viewer-media');
    const nameEl = document.getElementById('viewer-name');
    const dateEl = document.getElementById('viewer-date');

    viewer.innerHTML = '';
    const canView = !media.isLocked || LockManager.isSessionValid();

    if (canView) {
      if (media.type === 'video') {
        const video = document.createElement('video');
        video.src = media.dataURL;
        video.controls = true;
        video.autoplay = true;
        viewer.appendChild(video);
      } else {
        const img = document.createElement('img');
        img.src = media.dataURL;
        img.alt = media.name;
        viewer.appendChild(img);
      }
    } else {
      const img = document.createElement('img');
      img.src = media.thumbnail || media.dataURL;
      img.style.filter = 'blur(20px)';
      viewer.appendChild(img);
      const msg = document.createElement('p');
      msg.textContent = 'Contenu verrouillé — entrez votre PIN pour voir';
      msg.style.cssText = 'position:absolute;color:white;text-align:center;padding:20px;';
      viewer.style.position = 'relative';
      viewer.appendChild(msg);
    }

    nameEl.textContent = media.name;
    dateEl.textContent = new Date(media.dateAdded).toLocaleString('fr-FR');
    modal.classList.remove('hidden');
  }

  function closeMediaModal() {
    document.getElementById('media-modal')?.classList.add('hidden');
    const viewer = document.getElementById('viewer-media');
    if (viewer) {
      viewer.querySelector('video')?.pause();
      viewer.innerHTML = '';
    }
  }

  function renderAlbumPicker(albums, onSelect) {
    const picker = document.getElementById('album-picker');
    picker.innerHTML = '';
    albums.forEach((album) => {
      const item = document.createElement('div');
      item.className = 'album-picker-item';
      item.textContent = album.name;
      item.addEventListener('click', () => onSelect(album.id));
      picker.appendChild(item);
    });
  }

  return {
    renderGrid,
    clearGrid,
    renderAlbums,
    renderFolderCards,
    renderSharedAlbums,
    showToast,
    toggleEmpty,
    renderViewerActions,
    openMediaModal,
    closeMediaModal,
    renderAlbumPicker,
    createMediaElement
  };
})();

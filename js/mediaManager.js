/**
 * mediaManager.js - Upload, thumbnails, CRUD médias
 */
const MediaManager = (function () {
  const THUMB_MAX = 320;
  const THUMB_QUALITY = 0.75;

  function generateId() {
    return 'media_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
  }

  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function generateThumbnail(dataURL, type) {
    if (type === 'video') {
      return generateVideoThumbnail(dataURL);
    }
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        const ratio = Math.min(THUMB_MAX / width, THUMB_MAX / height, 1);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', THUMB_QUALITY));
      };
      img.onerror = () => resolve(dataURL);
      img.src = dataURL;
    });
  }

  function generateVideoThumbnail(dataURL) {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.onloadeddata = () => {
        video.currentTime = Math.min(1, video.duration * 0.1);
      };
      video.onseeked = () => {
        const canvas = document.createElement('canvas');
        let w = video.videoWidth;
        let h = video.videoHeight;
        const ratio = Math.min(THUMB_MAX / w, THUMB_MAX / h, 1);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(video, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', THUMB_QUALITY));
        URL.revokeObjectURL(video.src);
      };
      video.onerror = () => resolve(null);
      video.src = dataURL;
    });
  }

  async function processFile(file) {
    const type = file.type.startsWith('video/') ? 'video' : 'image';
    const dataURL = await readFileAsDataURL(file);
    const thumbnail = await generateThumbnail(dataURL, type);

    const media = {
      id: generateId(),
      type,
      name: file.name,
      dataURL,
      thumbnail: thumbnail || dataURL,
      dateAdded: Date.now(),
      albumId: null,
      isLocked: false,
      isArchived: false,
      isDeleted: false
    };

    await Storage.saveMedia(media);
    return media;
  }

  async function uploadFiles(files) {
    const results = [];
    for (const file of files) {
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) continue;
      try {
        const media = await processFile(file);
        results.push(media);
      } catch (err) {
        console.error('Upload error:', file.name, err);
      }
    }
    return results;
  }

  async function captureScreen() {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      throw new Error('Capture écran non supportée par ce navigateur');
    }
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    const track = stream.getVideoTracks()[0];
    const imageCapture = typeof ImageCapture !== 'undefined'
      ? new ImageCapture(track)
      : null;

    let blob;
    if (imageCapture) {
      blob = await imageCapture.takePhoto().catch(() => null);
    }
    if (!blob) {
      const video = document.createElement('video');
      video.srcObject = stream;
      await video.play();
      await new Promise((r) => setTimeout(r, 300));
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
      blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
    }

    track.stop();
    stream.getTracks().forEach((t) => t.stop());

    const file = new File([blob], `capture_${Date.now()}.png`, { type: 'image/png' });
    return processFile(file);
  }

  async function getAllMedia(options = {}) {
    const all = await Storage.getAllMedia();
    let filtered = all;

    if (!options.includeDeleted) {
      filtered = filtered.filter((m) => !m.isDeleted);
    }
    if (options.deletedOnly) {
      filtered = filtered.filter((m) => m.isDeleted);
    }
    if (options.archivedOnly) {
      filtered = filtered.filter((m) => m.isArchived && !m.isDeleted);
    }
    if (options.lockedOnly) {
      filtered = filtered.filter((m) => m.isLocked && !m.isDeleted);
    }
    if (options.recentOnly) {
      filtered = filtered.filter(
        (m) => !m.isArchived && !m.isLocked && !m.isDeleted
      );
    }
    if (options.type) {
      filtered = filtered.filter((m) => m.type === options.type);
    }
    if (options.albumId) {
      filtered = filtered.filter((m) => m.albumId === options.albumId);
    }

    filtered.sort((a, b) => b.dateAdded - a.dateAdded);
    return filtered;
  }

  async function archiveMedia(id) {
    return Storage.updateMedia(id, { isArchived: true });
  }

  async function unarchiveMedia(id) {
    return Storage.updateMedia(id, { isArchived: false });
  }

  async function setAlbum(id, albumId) {
    return Storage.updateMedia(id, { albumId });
  }

  return {
    uploadFiles,
    captureScreen,
    getAllMedia,
    archiveMedia,
    unarchiveMedia,
    setAlbum,
    generateThumbnail
  };
})();

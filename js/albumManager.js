/**
 * albumManager.js - Création et gestion des albums
 */
const AlbumManager = (function () {
  function generateId() {
    return 'album_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
  }

  async function createAlbum(name) {
    const album = {
      id: generateId(),
      name: name.trim(),
      dateCreated: Date.now(),
      coverIds: []
    };
    await Storage.saveAlbum(album);
    return album;
  }

  async function deleteAlbum(id) {
    const allMedia = await Storage.getAllMedia();
    for (const media of allMedia) {
      if (media.albumId === id) {
        await Storage.updateMedia(media.id, { albumId: null });
      }
    }
    await Storage.deleteAlbum(id);
  }

  async function getAlbumsWithCovers() {
    const albums = await Storage.getAlbums();
    const allMedia = await Storage.getAllMedia();
    albums.sort((a, b) => b.dateCreated - a.dateCreated);

    return albums.map((album) => {
      const media = allMedia
        .filter((m) => m.albumId === album.id && !m.isDeleted)
        .sort((a, b) => b.dateAdded - a.dateAdded);
      return {
        ...album,
        count: media.length,
        covers: media.slice(0, 4).map((m) => m.thumbnail || m.dataURL)
      };
    });
  }

  async function addMediaToAlbum(mediaId, albumId) {
    return Storage.updateMedia(mediaId, { albumId });
  }

  async function removeMediaFromAlbum(mediaId) {
    return Storage.updateMedia(mediaId, { albumId: null });
  }

  async function getAlbumMedia(albumId) {
    const all = await MediaManager.getAllMedia();
    return all.filter((m) => m.albumId === albumId);
  }

  return {
    createAlbum,
    deleteAlbum,
    getAlbumsWithCovers,
    addMediaToAlbum,
    removeMediaFromAlbum,
    getAlbumMedia
  };
})();

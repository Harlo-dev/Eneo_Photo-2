/**
 * trashManager.js - Suppression logique et corbeille
 */
const TrashManager = (function () {
  async function softDelete(id) {
    return Storage.updateMedia(id, {
      isDeleted: true,
      isArchived: false
    });
  }

  async function restore(id) {
    return Storage.updateMedia(id, { isDeleted: false });
  }

  async function permanentDelete(id) {
    return Storage.deleteMedia(id);
  }

  async function getTrash() {
    return MediaManager.getAllMedia({ deletedOnly: true });
  }

  async function emptyTrash() {
    const trash = await getTrash();
    for (const item of trash) {
      await permanentDelete(item.id);
    }
    return trash.length;
  }

  return {
    softDelete,
    restore,
    permanentDelete,
    getTrash,
    emptyTrash
  };
})();

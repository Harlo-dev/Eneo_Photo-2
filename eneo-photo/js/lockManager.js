/**
 * lockManager.js - Gestion PIN et verrouillage des médias
 */
const LockManager = (function () {
  const PIN_KEY = 'eneo_pin_hash';
  const SESSION_KEY = 'eneo_unlock_session';

  let sessionUnlocked = false;
  let sessionExpiry = 0;
  const SESSION_DURATION = 5 * 60 * 1000; // 5 minutes

  async function hashPIN(pin) {
    const encoder = new TextEncoder();
    const data = encoder.encode(pin + 'eneo-photo-salt');
    if (crypto.subtle) {
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }
    // Fallback simple hash
    let hash = 0;
    const str = pin + 'eneo-photo-salt';
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return 'fb_' + Math.abs(hash).toString(16);
  }

  async function setPIN(pin) {
    const hash = await hashPIN(pin);
    Storage.setSetting(PIN_KEY, hash);
    return true;
  }

  function hasPIN() {
    return !!Storage.getSetting(PIN_KEY);
  }

  async function verifyPIN(pin) {
    const stored = Storage.getSetting(PIN_KEY);
    if (!stored) return false;
    const hash = await hashPIN(pin);
    return hash === stored;
  }

  function startSession() {
    sessionUnlocked = true;
    sessionExpiry = Date.now() + SESSION_DURATION;
    sessionStorage.setItem(SESSION_KEY, String(sessionExpiry));
  }

  function isSessionValid() {
    if (sessionUnlocked && Date.now() < sessionExpiry) return true;
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored && Date.now() < parseInt(stored, 10)) {
      sessionUnlocked = true;
      sessionExpiry = parseInt(stored, 10);
      return true;
    }
    sessionUnlocked = false;
    return false;
  }

  function clearSession() {
    sessionUnlocked = false;
    sessionExpiry = 0;
    sessionStorage.removeItem(SESSION_KEY);
  }

  async function lockMedia(id) {
    return Storage.updateMedia(id, { isLocked: true });
  }

  async function unlockMedia(id) {
    return Storage.updateMedia(id, { isLocked: false });
  }

  return {
    hashPIN,
    setPIN,
    hasPIN,
    verifyPIN,
    startSession,
    isSessionValid,
    clearSession,
    lockMedia,
    unlockMedia
  };
})();

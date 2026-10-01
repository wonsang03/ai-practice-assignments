/**
 * 할 일에 붙인 사진을 저장합니다.
 *
 * 사진은 용량이 커서 localStorage(약 5MB 한도)에 넣으면 금방 가득 찹니다. 그래서 사진만
 * 브라우저의 IndexedDB에 Blob으로 따로 두고, 할 일에는 사진 id만 적어 둡니다.
 * 저장하기 전에 긴 변을 1600px로 줄이고 JPEG로 바꿔서 용량을 줄입니다(휴대폰 사진 기준 약 1/10).
 */
(function (root) {
  'use strict';

  const DB_NAME = 'personal-todo';
  const STORE = 'images';
  const MAX_SIDE = 1600;
  const QUALITY = 0.85;
  const MAX_INPUT_BYTES = 20 * 1024 * 1024;

  let dbPromise = null;
  const urlCache = new Map(); // id → objectURL

  function open() {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        if (!root.indexedDB) { reject(new Error('IndexedDB를 쓸 수 없어요')); return; }
        const req = root.indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      dbPromise.catch(() => { dbPromise = null; });
    }
    return dbPromise;
  }

  async function tx(mode, fn) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const store = t.objectStore(STORE);
      const result = fn(store);
      t.oncomplete = () => resolve(result && 'result' in result ? result.result : undefined);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error || new Error('저장 공간이 부족해요'));
    });
  }

  const put = (id, blob) => tx('readwrite', (s) => { s.put(blob, id); });
  const get = (id) => tx('readonly', (s) => s.get(id));
  const keys = () => tx('readonly', (s) => s.getAllKeys());
  const remove = (ids) => tx('readwrite', (s) => { for (const id of ids) s.delete(id); });

  async function available() {
    try {
      await open();
      return true;
    } catch {
      return false;
    }
  }

  function loadBitmap(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('이미지를 읽을 수 없어요')); };
      img.src = url;
    });
  }

  /** 큰 사진을 줄여서 JPEG Blob으로. GIF는 움직임이 사라지지 않게 그대로 둡니다. */
  async function shrink(file) {
    if (!file.type.startsWith('image/')) throw new Error('이미지 파일만 붙일 수 있어요');
    if (file.size > MAX_INPUT_BYTES) throw new Error('20MB보다 큰 사진은 붙일 수 없어요');
    if (file.type === 'image/gif') return file;
    const img = await loadBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    if (scale === 1 && file.size < 400 * 1024 && /jpeg|webp/.test(file.type)) return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; // 투명한 PNG를 JPEG로 바꿀 때 검게 변하지 않게
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY));
    if (!blob) throw new Error('이미지를 변환하지 못했어요');
    return blob;
  }

  /** 파일을 줄여서 저장하고 새 id를 돌려줍니다. */
  async function add(file, makeId) {
    const blob = await shrink(file);
    const id = makeId();
    await put(id, blob);
    return id;
  }

  /** 화면에 쓸 주소(objectURL). 같은 사진은 한 번만 만들어 재사용합니다. */
  async function url(id) {
    if (urlCache.has(id)) return urlCache.get(id);
    const blob = await get(id);
    if (!blob) return null;
    const objectUrl = URL.createObjectURL(blob);
    urlCache.set(id, objectUrl);
    return objectUrl;
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  async function dataUrlToBlob(dataUrl) {
    const res = await fetch(dataUrl);
    return res.blob();
  }

  /** 내보내기용: id 목록 → {id: data URL} */
  async function exportMany(ids) {
    const out = {};
    for (const id of ids) {
      const blob = await get(id);
      if (blob) out[id] = await blobToDataUrl(blob);
    }
    return out;
  }

  /** 가져오기용: {id: data URL} → 저장 */
  async function importMany(map) {
    for (const [id, dataUrl] of Object.entries(map)) {
      await put(id, await dataUrlToBlob(dataUrl));
      if (urlCache.has(id)) {
        URL.revokeObjectURL(urlCache.get(id));
        urlCache.delete(id);
      }
    }
  }

  /** 어떤 할 일에도 쓰이지 않는 사진을 지웁니다. */
  async function cleanup(usedIds) {
    const used = new Set(usedIds);
    const stale = (await keys()).filter((id) => !used.has(id));
    if (stale.length) await remove(stale);
    for (const id of stale) {
      if (urlCache.has(id)) URL.revokeObjectURL(urlCache.get(id));
      urlCache.delete(id);
    }
    return stale.length;
  }

  root.TodoImages = { available, add, url, exportMany, importMany, cleanup };
})(typeof self !== 'undefined' ? self : this);

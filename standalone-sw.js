const DB_NAME = 'vkbStandaloneData';
const DB_VERSION = 1;

self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

function readMedia(id) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      ['tasks', 'media', 'prompts', 'assets'].forEach(name => {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' });
      });
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('media', 'readonly');
      const get = tx.objectStore('media').get(id);
      get.onsuccess = () => resolve(get.result || null);
      get.onerror = () => reject(get.error);
      tx.oncomplete = () => db.close();
    };
  });
}

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (!url.pathname.startsWith('/__local_media/')) return;
  const id = decodeURIComponent(url.pathname.slice('/__local_media/'.length));
  event.respondWith((async () => {
    const media = await readMedia(id);
    if (!media) return new Response('Not found', { status: 404 });
    if (media.blob instanceof Blob) {
      const type = media.mimeType || media.blob.type || 'application/octet-stream';
      const range = event.request.headers.get('Range');
      if (range) {
        const match = range.match(/bytes=(\d+)-(\d*)/);
        const start = Math.min(media.blob.size - 1, Number(match?.[1] || 0));
        const requestedEnd = match?.[2] ? Number(match[2]) : media.blob.size - 1;
        const end = Math.min(media.blob.size - 1, Math.max(start, requestedEnd));
        return new Response(media.blob.slice(start, end + 1, type), {
          status: 206,
          headers: {
            'Content-Type': type,
            'Content-Range': `bytes ${start}-${end}/${media.blob.size}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': String(end - start + 1),
            'Cache-Control': 'no-store'
          }
        });
      }
      return new Response(media.blob, { headers: { 'Content-Type': type, 'Content-Length': String(media.blob.size), 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' } });
    }
    if (media.dataUrl) return fetch(media.dataUrl);
    return new Response('Not found', { status: 404 });
  })());
});

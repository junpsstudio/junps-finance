// Junps Finance — funciona sem internet: guarda a página e os ícones; a nuvem (Supabase) nunca passa por aqui
const CACHE = 'junps-v2.0.0';
const BASE = ['./', './index.html', './index.en.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png', './icons/favicon-32.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(BASE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
    const r = e.request; const u = new URL(r.url);
    if (r.method !== 'GET' || u.origin !== location.origin) return;           // nuvem, fontes e PDF: direto pela internet
    // página: tenta a versão nova primeiro; sem internet, usa a guardada
    if (r.mode === 'navigate' || u.pathname.endsWith('.html')) {
        e.respondWith(fetch(r).then(res => { const c = res.clone(); caches.open(CACHE).then(x => x.put(r, c)); return res; }).catch(() => caches.match(r).then(m => m || caches.match('./index.html'))));
        return;
    }
    e.respondWith(caches.match(r).then(m => m || fetch(r).then(res => { if (res.ok) { const c = res.clone(); caches.open(CACHE).then(x => x.put(r, c)); } return res; })));
});

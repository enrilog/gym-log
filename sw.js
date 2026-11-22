const shellUrl = new URL("index.html", self.registration.scope);
const cachePrefix = `gym-log-shell:${self.registration.scope}:`;
const cacheName = `${cachePrefix}1`;
const shellMarker = '<meta name="gym-log-app" content="1"';

async function fetchShell(request, cache, timeout) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(request, { cache: "reload", signal: controller.signal });
    const contentType = response.headers.get("content-type") || "";
    if (!response.ok || response.redirected || !contentType.includes("text/html") ||
        !(await response.clone().text()).includes(shellMarker)) {
      throw new Error("La respuesta no contiene gym-log");
    }
    await cache.put(shellUrl.href, response.clone());
    return response;
  } finally {
    clearTimeout(timer);
  }
}

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    await fetchShell(shellUrl.href, await caches.open(cacheName), 12000);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const retired = (await caches.keys()).filter(name => name.startsWith(cachePrefix) && name !== cacheName);
    await Promise.all(retired.map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || request.mode !== "navigate" || url.origin !== shellUrl.origin ||
      ![new URL("./", shellUrl).pathname, shellUrl.pathname].includes(url.pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    const saved = await cache.match(shellUrl.href);
    try {
      return await fetchShell(request, cache, saved ? 2500 : 12000);
    } catch {
      return saved || new Response("No se pudo abrir gym-log. Conéctate para preparar la copia sin conexión.", {
        status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" }
      });
    }
  })());
});

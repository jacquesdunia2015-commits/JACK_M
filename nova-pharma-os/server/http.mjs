// NOVA PHARMA OS — Petits utilitaires HTTP partagés par les routes.

export function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}

export function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > 2e6) { reject(new Error('payload trop volumineux')); req.destroy(); }
    });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch { reject(new Error('JSON invalide')); }
    });
    req.on('error', reject);
  });
}

/** Enregistre une route dans le tableau partagé du serveur.
 * `options.public` = true dispense la route de l'authentification
 * (ex. suivi de commande par le client, §25). */
export function route(routes, method, pattern, handler, options = {}) {
  routes.push({ method, pattern, handler, public: !!options.public });
}

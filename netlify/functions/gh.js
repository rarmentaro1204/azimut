/* Ponte verso la repo GitHub PRIVATA dei dati (offerte + impostazioni).
   Il token vive SOLO qui, come variabile d'ambiente di Netlify (GITHUB_TOKEN): il browser non lo vede mai,
   quindi ogni PC e ogni browser risulta collegato senza dover inserire nulla.
   Consente solo la repo GH_OWNER/GH_REPO e solo le operazioni usate dal configuratore (lettura e scrittura di file). */
const OWNER = () => process.env.GH_OWNER || 'rarmentaro1204';
const REPO = () => process.env.GH_REPO || 'ferretti-offerte';
const send = (statusCode, obj) => ({ statusCode, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(obj) });

exports.handler = async (event) => {
  const token = process.env.GITHUB_TOKEN;
  if (event.httpMethod === 'GET') return send(200, { configured: !!token, owner: OWNER(), repo: REPO() });   // stato (nessun dato riservato)
  if (event.httpMethod !== 'POST') return send(405, { message: 'Metodo non consentito' });
  if (!token) return send(503, { message: 'GITHUB_TOKEN non impostato su Netlify' });
  let req;
  try { req = JSON.parse(event.body || '{}'); } catch (e) { return send(400, { message: 'Richiesta non valida' }); }
  const method = String(req.method || 'GET').toUpperCase();
  const path = String(req.path || '');
  const base = `/repos/${OWNER()}/${REPO()}`;
  const readable = path === base || path.startsWith(base + '/contents/') || path.startsWith(base + '/git/trees/') || path.startsWith(base + '/git/blobs/');
  // scrittura solo nelle cartelle dei dati (mai sul codice del sito, anche se la repo fosse la stessa)
  const writable = path.startsWith(base + '/contents/offerte/') || path.startsWith(base + '/contents/config/');
  if (path.includes('..') || !(method === 'GET' ? readable : method === 'PUT' && writable)) return send(403, { message: 'Percorso non consentito' });
  try {
    const res = await fetch('https://api.github.com' + path, {
      method,
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'ferretti-configuratore', 'Content-Type': 'application/json' },
      body: method === 'PUT' ? (typeof req.body === 'string' ? req.body : JSON.stringify(req.body)) : undefined,
    });
    const text = await res.text();
    let body = null; try { body = text ? JSON.parse(text) : null; } catch (e) { body = { message: text.slice(0, 200) }; }
    return send(200, { status: res.status, body });
  } catch (e) {
    return send(502, { message: 'GitHub non raggiungibile' });
  }
};

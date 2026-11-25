export function send(res, status, payload, cache = 'no-store') {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': cache,
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(JSON.stringify(payload));
}

export function allow(req, res, method) {
  if (req.method === method) return true;
  res.setHeader('Allow', method);
  send(res, 405, { error: 'Method not allowed.' });
  return false;
}

export async function readJson(req) {
  const contentType = req.headers['content-type']?.split(';')[0]?.trim().toLowerCase();
  if (contentType !== 'application/json') throw new Error('Expected JSON');
  const limit = 4096;
  if (Number(req.headers['content-length']) > limit) throw new Error('Request too large');
  if (req.body !== undefined) {
    const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    if (Buffer.byteLength(raw) > limit) throw new Error('Request too large');
    return JSON.parse(raw);
  }
  const chunks = [];
  let size = 0;
  for await (const part of req.iterator({ destroyOnReturn: false })) {
    size += part.length;
    if (size > limit) throw new Error('Request too large');
    chunks.push(part);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

export async function upstream(url, options = {}, timeout = 5500) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(timeout) });
  if (!response.ok) throw Object.assign(new Error('Upstream error'), { status: response.status });
  return response.json();
}

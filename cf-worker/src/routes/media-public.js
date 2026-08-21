import { error } from '../utils/response.js';

/**
 * GET/HEAD público para objetos R2 — MEDIA_BASE_URL = https://<worker>/media
 * Só aceita chaves sob prefixo projects/ ou site/ (Hero em R2).
 *
 * Range (206) é obrigatório para <video>: o browser pede o fim do MP4
 * para ler o átomo `moov` sem baixar o arquivo inteiro.
 */
export async function handlePublicMedia(env, request, pathname) {
  const prefix = '/media/';
  if (!pathname.startsWith(prefix)) return error('Not found', 404);

  let key = decodeURIComponent(pathname.slice(prefix.length));
  if (!key || key.includes('..') || key.startsWith('/')) return error('Bad request', 400);
  if (!key.startsWith('projects/') && !key.startsWith('site/')) return error('Not found', 404);

  const meta = await env.MEDIA.head(key);
  if (!meta) return error('Not found', 404);

  const ct = meta.httpMetadata?.contentType || 'application/octet-stream';
  const cache = meta.httpMetadata?.cacheControl || 'public, max-age=31536000';
  const size = meta.size;
  const baseHeaders = {
    'Content-Type': ct,
    'Cache-Control': cache,
    'Access-Control-Allow-Origin': '*',
    'Accept-Ranges': 'bytes',
  };

  if (request.method === 'HEAD') {
    return new Response(null, {
      status: 200,
      headers: { ...baseHeaders, 'Content-Length': String(size) },
    });
  }

  const rangeHeader = request.headers.get('Range');
  const parsed = parseByteRange(rangeHeader, size);

  if (rangeHeader && !parsed) {
    return new Response(null, {
      status: 416,
      headers: {
        ...baseHeaders,
        'Content-Range': `bytes */${size}`,
      },
    });
  }

  if (parsed) {
    const length = parsed.end - parsed.start + 1;
    const obj = await env.MEDIA.get(key, {
      range: { offset: parsed.start, length },
    });
    if (!obj) return error('Not found', 404);
    return new Response(obj.body, {
      status: 206,
      headers: {
        ...baseHeaders,
        'Content-Length': String(length),
        'Content-Range': `bytes ${parsed.start}-${parsed.end}/${size}`,
      },
    });
  }

  const obj = await env.MEDIA.get(key);
  if (!obj) return error('Not found', 404);
  return new Response(obj.body, {
    status: 200,
    headers: { ...baseHeaders, 'Content-Length': String(size) },
  });
}

/** @returns {{ start: number, end: number } | null} */
export function parseByteRange(header, size) {
  if (!header || size <= 0) return null;
  const m = /^bytes=(\d*)-(\d*)$/i.exec(header.trim());
  if (!m) return null;

  if (m[1] === '' && m[2] === '') return null;

  if (m[1] === '') {
    const suffix = Number(m[2]);
    if (!Number.isFinite(suffix) || suffix <= 0) return null;
    return { start: Math.max(0, size - suffix), end: size - 1 };
  }

  const start = Number(m[1]);
  if (!Number.isFinite(start) || start < 0 || start >= size) return null;
  const end = m[2] === '' ? size - 1 : Number(m[2]);
  if (!Number.isFinite(end) || end < start) return null;
  return { start, end: Math.min(end, size - 1) };
}

import { json, error } from '../utils/response.js';
import { logAudit } from '../utils/audit.js';

export const SITE_SETTING_KEYS = [
  'hero_video',
  'hero_video_mobile',
  'home_about_photo_intro',
  'home_about_photo_respiro',
  'home_about_bg_mundo',
  'home_about_card_festivais',
  'home_about_card_arte',
  'home_about_card_corporativo',
  'home_about_photo_perspectivas',
  'home_about_photo_curupire',
  'home_about_servico_aftermovie',
  'home_about_servico_institucional',
  'home_about_servico_publicitario',
  'home_about_servico_motion',
  'home_about_servico_conteudo_mobile',
  'home_about_servico_fotografia',
  'home_footer_bg',
  'home_about_logos',
  'home_about_equipe',
];

/** Chaves cujo valor é JSON (array) em D1. */
export const JSON_SETTING_KEYS = new Set([
  'home_about_logos',
  'home_about_equipe',
]);

const ALLOWED_KEYS = new Set(SITE_SETTING_KEYS);
const KEY_LIST_SQL = SITE_SETTING_KEYS.map((k) => `'${k}'`).join(', ');

/** URL absoluta ou chave R2 relativa a MEDIA_BASE_URL. */
function mediaPublicUrl(base, keyOrUrl) {
  if (keyOrUrl == null || keyOrUrl === '') return null;
  const s = String(keyOrUrl);
  if (s.includes('://')) return s;
  const b = (base || '').replace(/\/$/, '');
  return b ? `${b}/${s}` : s;
}

function stripMediaBaseToKey(value, base) {
  if (value == null || value === '' || !base) return value;
  const s = String(value);
  const b = String(base).replace(/\/$/, '');
  if (s.startsWith(`${b}/`)) return s.slice(b.length + 1);
  return value;
}

function parseJsonArray(raw) {
  if (raw == null || raw === '') return [];
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(String(raw));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function resolveMediaFields(base, item, fields) {
  if (!item || typeof item !== 'object') return item;
  const out = { ...item };
  for (const field of fields) {
    if (out[field]) {
      out[field] = mediaPublicUrl(base, out[field]);
    }
  }
  return out;
}

function normalizeLogoItem(item) {
  if (!item || typeof item !== 'object') return null;
  const id = String(item.id || '').trim();
  const src = item.src == null || item.src === '' ? null : String(item.src).trim();
  const alt = item.alt == null ? '' : String(item.alt).trim();
  if (!id) return null;
  return { id, src, alt };
}

function normalizeInstagram(value) {
  if (value == null || value === '') return '';
  let v = String(value).trim();
  if (v === '') return '';
  if (v.startsWith('@')) v = v.slice(1);
  if (/^https?:\/\//i.test(v)) {
    try {
      const u = new URL(v);
      const host = u.hostname.replace(/^www\./i, '');
      if (host !== 'instagram.com') return null;
      const user = u.pathname.split('/').filter(Boolean)[0];
      if (!user || !/^[a-zA-Z0-9._]{1,30}$/.test(user)) return null;
      return `https://www.instagram.com/${user}/`;
    } catch {
      return null;
    }
  }
  if (!/^[a-zA-Z0-9._]{1,30}$/.test(v)) return null;
  return `https://www.instagram.com/${v}/`;
}

function normalizeEquipeItem(item) {
  if (!item || typeof item !== 'object') return null;
  const id = String(item.id || '').trim();
  const name = String(item.name || '').trim();
  const role = item.role == null ? '' : String(item.role).trim();
  const fact = item.fact == null ? '' : String(item.fact).trim();
  const photo = item.photo == null || item.photo === '' ? null : String(item.photo).trim();
  const instagramRaw = item.instagram == null ? '' : String(item.instagram).trim();
  const instagram = instagramRaw === '' ? '' : normalizeInstagram(instagramRaw);
  if (!id || !name) return null;
  if (instagramRaw !== '' && instagram === null) return null;
  return { id, name, role, fact, photo, instagram: instagram || '' };
}

function validateMediaRef(value, label) {
  if (value == null || value === '') return { ok: true, value: null };
  const v = String(value).trim();
  if (v === '') return { ok: true, value: null };
  if (v.includes('..')) return { ok: false, err: `invalid ${label}` };
  if (v.includes('://') && !/^https?:\/\//i.test(v)) return { ok: false, err: `invalid ${label} url` };
  if (!v.includes('://') && !v.startsWith('site/')) {
    return { ok: false, err: `${label} must start with site/ or be an absolute URL` };
  }
  return { ok: true, value: v };
}

function validateJsonSetting(key, rawValue, mediaBase) {
  const arr = parseJsonArray(rawValue);
  if (key === 'home_about_logos') {
    const out = [];
    for (const item of arr) {
      const logo = normalizeLogoItem(item);
      if (!logo) return { ok: false, err: 'invalid logo item' };
      const srcCheck = validateMediaRef(logo.src, 'logo src');
      if (!srcCheck.ok) return { ok: false, err: srcCheck.err };
      let src = srcCheck.value;
      if (src != null && !src.includes('://')) {
        src = stripMediaBaseToKey(src, mediaBase);
      }
      out.push({ id: logo.id, src, alt: logo.alt });
    }
    return { ok: true, value: out };
  }

  if (key === 'home_about_equipe') {
    const out = [];
    for (const item of arr) {
      const member = normalizeEquipeItem(item);
      if (!member) {
        const igRaw = item?.instagram != null ? String(item.instagram).trim() : '';
        if (igRaw && normalizeInstagram(igRaw) === null) {
          return { ok: false, err: 'invalid instagram username or url' };
        }
        return { ok: false, err: 'invalid equipe item' };
      }
      const photoCheck = validateMediaRef(member.photo, 'equipe photo');
      if (!photoCheck.ok) return { ok: false, err: photoCheck.err };
      let photo = photoCheck.value;
      if (photo != null && !photo.includes('://')) {
        photo = stripMediaBaseToKey(photo, mediaBase);
      }
      out.push({
        id: member.id,
        name: member.name,
        role: member.role,
        fact: member.fact,
        photo,
        instagram: member.instagram || '',
      });
    }
    return { ok: true, value: out };
  }

  return { ok: false, err: 'unsupported json setting' };
}

function exportJsonSetting(key, raw, base) {
  const arr = parseJsonArray(raw);
  if (key === 'home_about_logos') {
    return arr
      .map((item) => normalizeLogoItem(item))
      .filter(Boolean)
      .map((item) => ({
        id: item.id,
        src: item.src ? mediaPublicUrl(base, item.src) : null,
        alt: item.alt || '',
      }));
  }
  if (key === 'home_about_equipe') {
    return arr
      .map((item) => normalizeEquipeItem(item))
      .filter(Boolean)
      .map((item) => ({
        id: item.id,
        name: item.name,
        role: item.role || '',
        fact: item.fact || '',
        photo: item.photo ? mediaPublicUrl(base, item.photo) : null,
        instagram: item.instagram || '',
      }));
  }
  return [];
}

export async function handleSiteSettingsList(env) {
  const { results } = await env.DB.prepare(
    `SELECT key, value, updated_at FROM site_settings WHERE key IN (${KEY_LIST_SQL}) ORDER BY key`,
  ).all();

  const base = env.MEDIA_BASE_URL || '';
  const settings = (results || []).map((r) => {
    if (JSON_SETTING_KEYS.has(r.key)) {
      return {
        key: r.key,
        value: exportJsonSetting(r.key, r.value, base),
        updated_at: r.updated_at,
      };
    }
    return {
      key: r.key,
      value: mediaPublicUrl(base, r.value),
      updated_at: r.updated_at,
    };
  });

  return json({ settings });
}

export async function handleSiteSettingsExport(env) {
  const { results } = await env.DB.prepare(
    `SELECT key, value FROM site_settings WHERE key IN (${KEY_LIST_SQL})`,
  ).all();

  const base = env.MEDIA_BASE_URL || '';
  const byKey = new Map((results || []).map((r) => [r.key, r.value]));
  const out = {};
  for (const key of SITE_SETTING_KEYS) {
    const raw = byKey.get(key);
    if (raw === undefined) {
      out[key] = JSON_SETTING_KEYS.has(key) ? [] : null;
      continue;
    }
    if (JSON_SETTING_KEYS.has(key)) {
      out[key] = exportJsonSetting(key, raw, base);
    } else {
      out[key] = mediaPublicUrl(base, raw);
    }
  }

  return json(out);
}

function validateKeyValue(key, rawValue) {
  if (rawValue == null) return { ok: true, value: null };
  if (typeof rawValue !== 'string') return { ok: false, err: 'value must be string or null' };
  const v = String(rawValue).trim();
  if (v === '') return { ok: true, value: null };
  if (v.includes('..')) return { ok: false, err: 'invalid value' };
  if (v.includes('://') && !/^https?:\/\//i.test(v)) return { ok: false, err: 'invalid url' };
  if (!v.includes('://') && !v.startsWith('site/')) {
    return { ok: false, err: `${key} must start with site/ or be an absolute URL` };
  }
  return { ok: true, value: v };
}

export async function handleSiteSettingsPatch(key, request, env, ctx) {
  if (!ALLOWED_KEYS.has(key)) return error('Unknown setting key', 400);

  const data = await request.json().catch(() => ({}));
  const { value } = data;

  const mediaBase = env.MEDIA_BASE_URL || '';
  let storeVal;

  if (JSON_SETTING_KEYS.has(key)) {
    const v = validateJsonSetting(key, value, mediaBase);
    if (!v.ok) return error(v.err, 400);
    storeVal = JSON.stringify(v.value);
  } else {
    const v = validateKeyValue(key, value);
    if (!v.ok) return error(v.err, 400);
    storeVal = v.value;
    if (storeVal != null && storeVal !== '' && !storeVal.includes('://')) {
      storeVal = stripMediaBaseToKey(storeVal, mediaBase);
    }
  }

  await env.DB.prepare(
    `INSERT INTO site_settings (key, value, updated_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET
       value = excluded.value,
       updated_at = datetime('now')`,
  ).bind(key, storeVal).run();

  logAudit(ctx, env.DB, {
    action: 'site_settings',
    targetType: 'site',
    targetId: key,
    diff: { value: storeVal },
  });

  return json({ key, value: JSON_SETTING_KEYS.has(key) ? JSON.parse(storeVal) : storeVal, updated: true });
}

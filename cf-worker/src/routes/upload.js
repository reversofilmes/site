import { json, error } from '../utils/response.js';
import { logAudit } from '../utils/audit.js';
import { SLUG_PATH_RE } from '../utils/slug.js';

const MAX_SIZE = 25 * 1024 * 1024;
const ALLOWED_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
};

/** Upload types that map to R2 keys under site/ (no project slug). */
const SITE_UPLOAD_PREFIX = {
  hero_video: 'hero',
  hero_video_mobile: 'hero-mobile',
  home_about_photo_intro: 'home-about-intro',
  home_about_photo_respiro: 'home-about-respiro',
  home_about_bg_mundo: 'home-about-bg',
  home_about_card_festivais: 'home-about-card-festivais',
  home_about_card_arte: 'home-about-card-arte',
  home_about_card_corporativo: 'home-about-card-corporativo',
  home_about_photo_perspectivas: 'home-about-perspectivas',
  home_about_photo_curupire: 'home-about-curupire',
  home_about_servico_aftermovie: 'home-about-servico-aftermovie',
  home_about_servico_institucional: 'home-about-servico-institucional',
  home_about_servico_publicitario: 'home-about-servico-publicitario',
  home_about_servico_motion: 'home-about-servico-motion',
  home_about_servico_conteudo_mobile: 'home-about-servico-conteudo-mobile',
  home_about_servico_fotografia: 'home-about-servico-fotografia',
  home_footer_bg: 'home-footer-bg',
  home_about_logo: 'home-about-logo',
  home_about_equipe_photo: 'home-about-equipe-photo',
};

const SITE_VIDEO_TYPES = new Set(['hero_video', 'hero_video_mobile']);

function sanitizeKey(slug, type, ext) {
  const hash = crypto.randomUUID().slice(0, 8);
  const sitePrefix = SITE_UPLOAD_PREFIX[type];
  if (sitePrefix) {
    if (SITE_VIDEO_TYPES.has(type) && ext !== 'mp4' && ext !== 'webm') {
      throw new Error('Invalid video type for hero');
    }
    if (!SITE_VIDEO_TYPES.has(type) && !['jpg', 'png', 'webp', 'gif'].includes(ext)) {
      throw new Error('Invalid image type for site media');
    }
    return `site/${sitePrefix}-${hash}.${ext}`;
  }
  if (!SLUG_PATH_RE.test(slug)) throw new Error('Invalid slug');
  if (!['thumbnail', 'preview'].includes(type)) throw new Error('Invalid type');
  return `projects/${slug}/${type}-${hash}.${ext}`;
}

function isSiteUploadType(type) {
  return Object.prototype.hasOwnProperty.call(SITE_UPLOAD_PREFIX, type);
}

export async function handleUpload(request, env, ctx) {
  const contentType = request.headers.get('Content-Type') || '';

  let slug, type, file, fileType;

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    slug = formData.get('slug');
    type = formData.get('type');
    file = formData.get('file');
    if (!file || !(file instanceof File)) return error('No file provided', 400);
    fileType = file.type;

    if (file.size > MAX_SIZE) return error(`File exceeds ${MAX_SIZE / 1048576}MB limit`, 400);
  } else {
    return error('Content-Type must be multipart/form-data', 400);
  }

  if (!type) return error('type field required', 400);
  if (!isSiteUploadType(type) && !slug) {
    return error('slug and type fields required', 400);
  }

  const ext = ALLOWED_TYPES[fileType];
  if (!ext) return error(`File type ${fileType} not allowed`, 400);

  let key;
  try {
    key = sanitizeKey(isSiteUploadType(type) ? 'site' : slug, type, ext);
  } catch (e) {
    return error(e.message, 400);
  }

  const arrayBuffer = await file.arrayBuffer();
  await env.MEDIA.put(key, arrayBuffer, {
    httpMetadata: { contentType: fileType },
  });

  logAudit(ctx, env.DB, {
    action: 'upload', targetType: 'media', targetId: key,
    diff: { size: file.size, type: fileType },
  });

  return json({ key, url: `${env.MEDIA_BASE_URL}/${key}` }, 201);
}

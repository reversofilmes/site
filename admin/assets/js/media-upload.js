/**
 * Media upload validation & path helpers
 */
const MediaUpload = {
  MAX_SIZE: 25 * 1024 * 1024,
  IMG_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
  GIF_TYPES: ['image/gif', 'image/webp', 'image/png'],
  VID_TYPES: ['video/mp4', 'video/webm'],

  resolveMime(file) {
    if (file?.type) return file.type;
    const ext = String(file?.name || '').split('.').pop()?.toLowerCase();
    const map = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
      gif: 'image/gif',
      mp4: 'video/mp4',
      webm: 'video/webm',
    };
    return map[ext] || '';
  },

  validate(file, types) {
    if (!file || typeof file.size !== 'number') {
      throw new Error('Arquivo inválido para upload.');
    }
    const mime = this.resolveMime(file);
    if (!types.includes(mime)) {
      throw new Error(
        `Tipo ${mime || file.type || 'desconhecido'} não permitido. Aceitos: ${types.join(', ')}`,
      );
    }
    if (file.size > this.MAX_SIZE) {
      throw new Error(
        `Arquivo ${(file.size / 1048576).toFixed(1)} MB excede limite de 25 MB`,
      );
    }
  },

  preview(file) { return URL.createObjectURL(file); },
  revokePreview(url) { if (url) URL.revokeObjectURL(url); },

  /**
   * Redimensiona stills grandes no client. Fotos de 4–15 MB / 4–7k px
   * travam hover e carrossel — o card só precisa ~1400 px na maior aresta.
   */
  async resizeStill(file, opts) {
    const maxEdge = opts?.maxEdge || 1400;
    const quality = opts?.quality ?? 0.82;
    if (!file || !this.IMG_TYPES.includes(this.resolveMime(file))) {
      return { file, resized: false };
    }
    if (typeof createImageBitmap !== 'function') {
      return { file, resized: false };
    }

    let bitmap;
    try {
      bitmap = await createImageBitmap(file);
    } catch (_) {
      return { file, resized: false };
    }

    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const alreadySmall = scale >= 1 && file.size <= 450 * 1024;
    if (alreadySmall) {
      bitmap.close();
      return { file, resized: false };
    }

    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) {
      bitmap.close();
      return { file, resized: false };
    }
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();

    const mime = 'image/jpeg';
    const blob = await new Promise((resolve) => {
      canvas.toBlob(resolve, mime, quality);
    });
    if (!blob || (blob.size >= file.size && scale >= 1)) {
      return { file, resized: false };
    }

    const base = String(file.name || 'photo').replace(/\.[^.]+$/, '');
    const out = new File([blob], `${base}.jpg`, { type: mime });
    return { file: out, resized: true };
  },

  async downscaleImageElement(img, maxEdge) {
    if (!img || img.dataset.resized === '1') return null;
    const nw = img.naturalWidth || 0;
    const nh = img.naturalHeight || 0;
    if (nw <= maxEdge && nh <= maxEdge) {
      img.dataset.resized = '1';
      return null;
    }
    if (typeof createImageBitmap !== 'function') return null;

    let bitmap;
    try {
      bitmap = await createImageBitmap(img, {
        resizeWidth: nw >= nh ? maxEdge : Math.max(1, Math.round(nw * (maxEdge / nh))),
        resizeHeight: nh > nw ? maxEdge : Math.max(1, Math.round(nh * (maxEdge / nw))),
        resizeQuality: 'high',
      });
    } catch (_) {
      return null;
    }

    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) {
      bitmap.close();
      return null;
    }
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();

    const blob = await new Promise((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', 0.8);
    });
    if (!blob) return null;
    const url = URL.createObjectURL(blob);
    img.dataset.resized = '1';
    img.src = url;
    return url;
  },
};

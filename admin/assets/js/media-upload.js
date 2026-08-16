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
};

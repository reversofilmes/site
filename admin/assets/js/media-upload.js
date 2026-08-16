/**
 * Media upload validation & path helpers
 */
const MediaUpload = {
  MAX_SIZE: 25 * 1024 * 1024,
  IMG_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
  GIF_TYPES: ['image/gif', 'image/webp', 'image/png'],
  VID_TYPES: ['video/mp4', 'video/webm'],

  validate(file, types) {
    if (!types.includes(file.type)) {
      throw new Error(
        `Tipo ${file.type} não permitido. Aceitos: ${types.join(', ')}`,
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

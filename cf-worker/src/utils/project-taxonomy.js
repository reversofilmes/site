/** Categorias e tipos de serviço canónicos dos projetos. */
export const PROJECT_CATEGORIES = [
  'Festivais & Eventos',
  'Arte & Cultura',
  'Corporativo',
];

export const PROJECT_SERVICE_TYPES = [
  'Aftermovie & Reels',
  'Institucional',
  'Publicitário',
  'Motion & VFX',
  'Conteúdo Mobile',
  'Fotografia & GIFs',
];

const LEGACY_CATEGORY_TAGS = new Set([
  'FESTIVAIS & EVENTOS',
  'ARTE & CULTURA',
  'EVENTO CORPORATIVO',
  'EVENTOS',
]);

const LEGACY_CATEGORY_MAP = {
  'FESTIVAIS & EVENTOS': 'Festivais & Eventos',
  'ARTE & CULTURA': 'Arte & Cultura',
  'EVENTO CORPORATIVO': 'Corporativo',
  EVENTOS: 'Festivais & Eventos',
};

const LEGACY_SERVICE_MAP = {
  FOTOS: 'Fotografia & GIFs',
  MOBILE: 'Conteúdo Mobile',
  INSTITUCIONAL: 'Institucional',
  PUBLICITÁRIO: 'Publicitário',
  'ANIMAÇÃO & MOTION GRAPHICS': 'Motion & VFX',
  'EFEITOS VISUAIS': 'Motion & VFX',
  VFX: 'Motion & VFX',
  'MAKING OF': 'Aftermovie & Reels',
  DOCUMENTÁRIO: 'Institucional',
  'MIDIAS SOCIAIS': 'Conteúdo Mobile',
  ARTISTICOS: 'Aftermovie & Reels',
};

const CATEGORY_PRIORITY = [
  'Festivais & Eventos',
  'Arte & Cultura',
  'Corporativo',
];

const CORPORATE_LEGACY_TAGS = new Set([
  'INSTITUCIONAL',
  'PUBLICITÁRIO',
  'EVENTO CORPORATIVO',
  'MAKING OF',
  'DOCUMENTÁRIO',
]);

/**
 * Converte service_types legado (categorias + serviços misturados) para o novo modelo.
 * @param {unknown} raw — JSON string ou array
 * @returns {{ category: string | null, service_types: string[] }}
 */
export function migrateLegacyTaxonomy(raw) {
  let types = [];
  if (Array.isArray(raw)) {
    types = raw;
  } else if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      types = Array.isArray(parsed) ? parsed : [];
    } catch {
      types = [];
    }
  }

  const foundCategories = [];
  const foundServices = [];

  for (const item of types) {
    const tag = String(item || '').trim();
    if (!tag) continue;
    if (LEGACY_CATEGORY_TAGS.has(tag)) {
      const mapped = LEGACY_CATEGORY_MAP[tag];
      if (mapped) foundCategories.push(mapped);
      continue;
    }
    const svc = LEGACY_SERVICE_MAP[tag];
    if (svc) foundServices.push(svc);
  }

  let category = null;
  if (foundCategories.length > 0) {
    for (const preferred of CATEGORY_PRIORITY) {
      if (foundCategories.includes(preferred)) {
        category = preferred;
        break;
      }
    }
  } else {
    const hadCorporate = types.some((t) => CORPORATE_LEGACY_TAGS.has(String(t || '').trim()));
    if (hadCorporate) category = 'Corporativo';
  }

  let service_types = [...new Set(foundServices)];

  if (category === 'Festivais & Eventos' && service_types.length === 0) {
    service_types = ['Aftermovie & Reels'];
  }

  return { category, service_types };
}

export function isValidCategory(value) {
  if (value == null || value === '') return true;
  return PROJECT_CATEGORIES.includes(String(value));
}

export function normalizeServiceTypes(values) {
  if (!Array.isArray(values)) return [];
  return [...new Set(
    values
      .map((v) => String(v || '').trim())
      .filter((v) => v && PROJECT_SERVICE_TYPES.includes(v)),
  )];
}

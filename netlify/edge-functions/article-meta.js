// Aperçus de liens (WhatsApp, Facebook, Instagram, Google…)
// Les articles s'affichent en JavaScript, que les robots de partage ne lisent pas.
// Cette fonction Netlify lit l'en-tête de l'article sur GitHub et écrit
// le titre, le résumé et l'image directement dans la page envoyée.
const REPO = 'frdfoto20-sys/charles-media';
const BRANCH = 'main';
const SITE = 'https://charleslemedia.com';
const RAW = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/articles/`;

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Lecture simple des champs utiles de l'en-tête (title, description, cover, vignette)
function readFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return {};
  const out = {};
  const lines = m[1].split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const kv = lines[i].match(/^([a-z_]+):\s*(.*)$/i);
    if (!kv) continue;
    let val = kv[2];
    // Valeur sur plusieurs lignes (l'admin coupe les lignes longues)
    while (i + 1 < lines.length && /^\s+\S/.test(lines[i + 1]) && !/^\s+[a-z_]+:\s/i.test(lines[i + 1])) {
      val += ' ' + lines[++i].trim();
    }
    val = val.trim();
    if (/^["'].*["']$/.test(val)) val = val.slice(1, -1).replace(/\\"/g, '"').replace(/''/g, "'");
    out[kv[1]] = val;
  }
  return out;
}

const imageUrl = src => {
  if (!src) return `${SITE}/img/og-default.jpg`;
  if (/^https?:\/\//.test(src)) return src;
  return `${RAW}images/${encodeURIComponent(src.split('/').pop())}`;
};

export default async (request, context) => {
  const response = await context.next();
  const type = response.headers.get('content-type') || '';
  if (!type.includes('text/html')) return response;

  const url = new URL(request.url);
  const slug = decodeURIComponent(url.pathname.split('/').pop() || '');
  if (!slug.endsWith('.html')) return response;

  let meta;
  try {
    const r = await fetch(RAW + encodeURIComponent(slug));
    if (!r.ok) return response;
    meta = readFrontmatter(await r.text());
  } catch (e) {
    return response;
  }
  if (!meta.title) return response;

  const title = `${meta.title} — Charles le Média`;
  const desc = meta.description || '';
  const img = imageUrl(meta.vignette || meta.cover);
  const canonical = `${SITE}/articles/${encodeURI(slug)}`;

  let html = await response.text();
  // Retire les valeurs génériques de la page modèle
  html = html
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/\s*<meta property="og:[^>]*>/g, '')
    .replace(/\s*<meta name="twitter:card"[^>]*>/g, '');

  const tags = `
  <meta name="description" content="${esc(desc)}">
  <link rel="canonical" href="${esc(canonical)}">
  <meta property="og:site_name" content="Charles le Média">
  <meta property="og:locale" content="fr_FR">
  <meta property="og:type" content="article">
  <meta property="og:title" content="${esc(meta.title)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:url" content="${esc(canonical)}">
  <meta property="og:image" content="${esc(img)}">
  <meta name="twitter:card" content="summary_large_image">
`;
  html = html.replace('</head>', `${tags}</head>`);

  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.set('cache-control', 'public, max-age=0, must-revalidate');
  return new Response(html, { status: response.status, headers });
};

export const config = { path: '/articles/*' };

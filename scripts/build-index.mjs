// Génère articles/index.json (liste des articles pour la page d'accueil)
// et articles/sitemap.xml (sommaire pour Google).
// Lancé automatiquement par GitHub à chaque publication (voir .github/workflows/index-articles.yml).
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

const SITE = 'https://xn--charlesmdia-ibb.frdphoto.com';
const DIR = 'articles';

const months = { january: 0, february: 1, march: 2, april: 3, may: 4, june: 5, july: 6, august: 7,
  september: 8, october: 9, november: 10, december: 11 };

function toISODate(v) {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v || '').trim();
  const m = s.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (m && months[m[2].toLowerCase()] !== undefined) {
    return new Date(Date.UTC(+m[3], months[m[2].toLowerCase()], +m[1])).toISOString().slice(0, 10);
  }
  const d = new Date(s);
  return isNaN(d) ? null : d.toISOString().slice(0, 10);
}

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const articles = [];
for (const name of fs.readdirSync(DIR)) {
  if (!name.endsWith('.html')) continue;
  const text = fs.readFileSync(path.join(DIR, name), 'utf8');
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) continue;
  let meta;
  try { meta = yaml.load(m[1]) || {}; } catch (e) { console.warn('YAML invalide :', name, e.message); continue; }
  articles.push({
    slug: name,
    title: meta.title || '',
    category: meta.category || '',
    description: meta.description || '',
    date: meta.date instanceof Date ? meta.date.toISOString() : String(meta.date || ''),
    isoDate: toISODate(meta.date),
    readtime: meta.readtime != null ? String(meta.readtime) : '',
    featured: meta.featured === true || meta.featured === 'true',
    cover: meta.cover || '',
  });
}
articles.sort((a, b) => (b.isoDate || '').localeCompare(a.isoDate || ''));

fs.writeFileSync(path.join(DIR, 'index.json'), JSON.stringify(articles, null, 2) + '\n');

const latest = articles.map(a => a.isoDate).filter(Boolean).sort().pop();
const urls = [
  `  <url><loc>${SITE}/</loc>${latest ? `<lastmod>${latest}</lastmod>` : ''}</url>`,
  ...articles.map(a => `  <url><loc>${SITE}/articles/${esc(encodeURI(a.slug))}</loc>${a.isoDate ? `<lastmod>${a.isoDate}</lastmod>` : ''}</url>`),
  `  <url><loc>${SITE}/mentions-legales.html</loc></url>`,
];
fs.writeFileSync(path.join(DIR, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`);

console.log(`${articles.length} article(s) indexé(s).`);

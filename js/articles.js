// Page d'accueil : charge la liste des articles, construit « À la une », les séries,
// les filtres (seulement les catégories qui ont des articles) et la grille.
const REPO = 'frdfoto20-sys/charles-media';
const BRANCH = 'main';
const RAW = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/`;

// Les images envoyées depuis l'admin sont lues directement sur GitHub
function imgUrl(src) {
  if (!src) return '';
  if (/^https?:\/\//.test(src)) return src;
  const name = src.split('/').pop();
  return `${RAW}articles/images/${name}`;
}

const CATEGORY_TAGS = {
  'Économie': 'economie', 'Nature': 'nature', 'Politique': 'politique', 'Technologie': 'technologie',
  'Société': 'societe', 'Science': 'science', 'Culture': 'culture',
};

// Échappement du texte inséré dans le HTML
const h = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function parseFrontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { meta: {}, body: text };
  const fm = {};
  if (window.jsyaml) {
    try {
      const flat = (obj, prefix) => Object.entries(obj || {}).forEach(([k, v]) => {
        const key = prefix ? `${prefix}.${k}` : k;
        if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)) flat(v, key);
        else fm[key] = v instanceof Date ? v.toISOString() : String(v);
      });
      flat(window.jsyaml.load(match[1]), '');
      return { meta: fm, body: match[2] };
    } catch (e) { console.warn('YAML', e); }
  }
  return { meta: fm, body: match[2] };
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return isNaN(d) ? String(dateStr) : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

const articleHref = slug => `/articles/${slug}`;
const readLabel = (m, long) => m.readtime ? `${m.readtime} min${long ? ' de lecture' : ''}` : '';
const kicker = m => m.series ? `${m.series} · volet ${m.series_part || ''}` : (m.category || '');

function buildCard({ meta, slug }) {
  const tag = CATEGORY_TAGS[meta.category] || 'autre';
  const img = imgUrl(meta.vignette || meta.cover);
  return `
    <article class="article-card" data-tag="${tag}">
      ${img ? `<div class="card-media"><img src="${h(img)}" alt="" loading="lazy" decoding="async" width="640" height="400"></div>` : ''}
      <div class="card-body">
        <span class="kicker">${h(kicker(meta))}</span>
        <h3><a href="${articleHref(slug)}" class="card-link">${h(meta.title || 'Sans titre')}</a></h3>
        <p>${h(meta.description)}</p>
        <div class="article-meta">
          <span>${h(formatDate(meta.date))}</span>
          <span>${h(readLabel(meta))}</span>
        </div>
      </div>
    </article>`;
}

function renderFeatured(a) {
  const section = document.getElementById('featured-section');
  const card = document.getElementById('featured-card');
  if (!a || !section || !card) return;
  const img = imgUrl(a.meta.vignette || a.meta.cover);
  card.innerHTML = `
    ${img ? `<div class="featured-media"><img class="featured-img" src="${h(img)}" alt="" fetchpriority="high" width="800" height="600"></div>` : ''}
    <div class="featured-content">
      <span class="kicker">${h(kicker(a.meta))}</span>
      <h2><a href="${articleHref(a.slug)}" class="card-link">${h(a.meta.title || 'Sans titre')}</a></h2>
      <p>${h(a.meta.description)}</p>
      <div class="article-meta">
        <span>${h(formatDate(a.meta.date))}</span>
        <span>${h(readLabel(a.meta, true))}</span>
      </div>
      <span class="btn btn-primary" aria-hidden="true">Lire l'article</span>
    </div>`;
  section.hidden = false;
}

// Une série = au moins deux articles avec le même champ « series »
function renderSeries(articles) {
  const section = document.getElementById('series-section');
  if (!section) return;
  const groups = {};
  articles.forEach(a => { if (a.meta.series) (groups[a.meta.series] ||= []).push(a); });
  const blocks = Object.entries(groups).filter(([, list]) => list.length > 1).map(([name, list]) => {
    list.sort((x, y) => (+x.meta.series_part || 0) - (+y.meta.series_part || 0));
    const total = list.reduce((t, a) => t + (+a.meta.readtime || 0), 0);
    return `
      <div class="series-band">
        <div class="series-head">
          <span class="kicker">Série · ${list.length} volets</span>
          <h2>${h(name)}</h2>
          <p>À lire dans l'ordre${total ? `, environ ${total} minutes au total` : ''}.</p>
        </div>
        <ol class="series-list">
          ${list.map(a => `
            <li class="series-item">
              <a href="${articleHref(a.slug)}">
                <span class="series-num">Volet ${h(a.meta.series_part || '')}</span>
                <span class="series-title">${h(a.meta.title)}</span>
                <span class="series-time">${h(readLabel(a.meta))}</span>
              </a>
            </li>`).join('')}
        </ol>
      </div>`;
  });
  if (!blocks.length) return;
  section.innerHTML = blocks.join('');
  section.hidden = false;
}

// Filtres : n'affiche que les catégories présentes, et rien du tout s'il n'y en a qu'une
function renderFilters(articles) {
  const section = document.getElementById('filters-section');
  const box = document.getElementById('tag-filters');
  if (!section || !box) return;
  const cats = [...new Set(articles.map(a => a.meta.category).filter(Boolean))];
  if (cats.length < 2) return;
  box.innerHTML = `<button type="button" class="tag-btn" data-tag="all">Tous</button>` +
    cats.map(c => `<button type="button" class="tag-btn" data-tag="${CATEGORY_TAGS[c] || 'autre'}">${h(c)}</button>`).join('');
  section.hidden = false;
  if (typeof initFilters === 'function') initFilters();
}

// 1) Liste tenue à jour automatiquement par GitHub (rapide, sans limite)
async function fromIndex() {
  try {
    const v = Math.floor(Date.now() / 60000);
    const r = await fetch(`${RAW}articles/index.json?v=${v}`);
    if (!r.ok) return null;
    const list = await r.json();
    if (!Array.isArray(list)) return null;
    return list.map(a => ({
      slug: a.slug,
      meta: { ...a, featured: a.featured ? 'true' : 'false', date: a.isoDate ? `${a.isoDate}T12:00:00` : a.date },
    }));
  } catch (e) { return null; }
}

// 2) Secours : lecture directe du dossier sur GitHub (limitée à 60 visites/heure)
async function fromApi() {
  const res = await fetch(`https://api.github.com/repos/${REPO}/contents/articles?ref=${BRANCH}`);
  if (res.status === 404) return [];
  if (!res.ok) throw new Error('GitHub API error');
  const files = await res.json();
  const htmlFiles = files.filter(f => f.name.endsWith('.html') && f.type === 'file');
  return Promise.all(htmlFiles.map(async f => {
    const text = await (await fetch(f.download_url)).text();
    return { meta: parseFrontmatter(text).meta, slug: f.name };
  }));
}

async function loadArticles() {
  const grid = document.getElementById('articles-grid');
  const loading = document.getElementById('articles-loading');
  try {
    const articles = (await fromIndex()) || (await fromApi());
    if (!articles || articles.length === 0) {
      if (loading) loading.textContent = 'Aucun article publié pour le moment.';
      return;
    }
    articles.sort((a, b) => new Date(b.meta.date || 0) - new Date(a.meta.date || 0));
    if (loading) loading.remove();

    // À la une = le plus récent coché « Mettre à la une », sinon le plus récent
    const featured = articles.find(a => a.meta.featured === 'true') || articles[0];
    renderFeatured(featured);
    renderSeries(articles);

    const rest = articles.filter(a => a !== featured);
    grid.insertAdjacentHTML('beforeend', rest.map(buildCard).join(''));
    renderFilters(rest);
  } catch (e) {
    if (loading) loading.textContent = 'Impossible de charger les articles. Vérifiez votre connexion puis rechargez la page.';
    console.error(e);
  }
}

// Adresse officielle de la page d'accueil (suit automatiquement le nom de domaine)
(function () {
  if (location.pathname !== '/' && location.pathname !== '/index.html') return;
  const l = document.createElement('link');
  l.rel = 'canonical'; l.href = `${location.origin}/`;
  document.head.appendChild(l);
})();

loadArticles();

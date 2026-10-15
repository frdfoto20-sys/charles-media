// Charge les articles depuis GitHub API
const REPO = 'frdfoto20-sys/charles-media';
const BRANCH = 'main';

// Les images envoyées depuis l'admin sont lues directement sur GitHub
function imgUrl(src) {
  if (!src) return '';
  if (/^https?:\/\//.test(src)) return src;
  const name = src.split('/').pop();
  return `https://raw.githubusercontent.com/${REPO}/${BRANCH}/articles/images/${name}`;
}

const CATEGORY_IMAGES = {
  'Économie':    'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=600&q=80',
  'Nature':      'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=600&q=80',
  'Politique':   'https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=600&q=80',
  'Technologie': 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&q=80',
  'Société':     'https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=600&q=80',
  'Science':     'https://images.unsplash.com/photo-1507413245164-6160d8298b31?w=600&q=80',
  'Culture':     'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=600&q=80',
};

const CATEGORY_TAGS = {
  'Économie':    'economie',
  'Nature':      'nature',
  'Politique':   'politique',
  'Technologie': 'technologie',
  'Société':     'societe',
  'Science':     'science',
  'Culture':     'culture',
};

function parseFrontmatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const fm = {};
  match[1].split('\n').forEach(line => {
    const idx = line.indexOf(':');
    if (idx === -1) return;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    fm[key] = val;
  });
  return fm;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch(e) { return dateStr; }
}

function buildCard(meta, slug) {
  const tag = CATEGORY_TAGS[meta.category] || 'other';
  const img = imgUrl(meta.cover) || CATEGORY_IMAGES[meta.category] || CATEGORY_IMAGES['Culture'];
  const readtime = meta.readtime ? `· ${meta.readtime} min` : '';
  return `
    <article class="article-card" data-tag="${tag}">
      <img src="${img}" alt="${meta.title || ''}">
      <div class="card-body">
        <span class="category-tag">${meta.category || ''}</span>
        <h3>${meta.title || 'Sans titre'}</h3>
        <p>${meta.description || ''}</p>
        <div class="article-meta">
          <span>${formatDate(meta.date)}</span>
          <span>${readtime}</span>
        </div>
        <a href="/articles/${slug}" class="btn btn-primary" style="margin-top:1rem;display:inline-block;">Lire l'article</a>
      </div>
    </article>`;
}

async function loadArticles() {
  const grid = document.getElementById('articles-grid');
  const loading = document.getElementById('articles-loading');

  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/contents/articles?ref=${BRANCH}`);
    if (res.status === 404) {
      if (loading) loading.textContent = 'Aucun article publié pour le moment.';
      return;
    }
    if (!res.ok) throw new Error('GitHub API error');
    const files = await res.json();

    const htmlFiles = files.filter(f => f.name.endsWith('.html') && f.type === 'file');

    if (htmlFiles.length === 0) {
      if (loading) loading.textContent = 'Aucun article publié pour le moment.';
      return;
    }

    const articles = await Promise.all(htmlFiles.map(async f => {
      const r = await fetch(f.download_url);
      const text = await r.text();
      const meta = parseFrontmatter(text);
      return { meta, slug: f.name };
    }));

    // Trier par date décroissante
    articles.sort((a, b) => new Date(b.meta.date || 0) - new Date(a.meta.date || 0));

    if (loading) loading.remove();

    // Article à la une = le plus récent coché "Mettre à la une", sinon le plus récent
    const featured = articles.find(a => a.meta.featured === 'true') || articles[0];
    const featuredSection = document.getElementById('featured-section');
    const featuredCard = document.getElementById('featured-card');
    if (featured && featuredSection && featuredCard) {
      const fImg = imgUrl(featured.meta.cover) || CATEGORY_IMAGES[featured.meta.category] || CATEGORY_IMAGES['Culture'];
      const fReadtime = featured.meta.readtime ? `· ${featured.meta.readtime} min de lecture` : '';
      featuredCard.innerHTML = `
        <img class="featured-img" src="${fImg}" alt="${featured.meta.title || ''}">
        <div class="featured-content">
          <span class="category-tag">${featured.meta.category || ''}</span>
          <h2>${featured.meta.title || 'Sans titre'}</h2>
          <p>${featured.meta.description || ''}</p>
          <div class="article-meta">
            <span>${formatDate(featured.meta.date)}</span>
            <span>${fReadtime}</span>
          </div>
          <a href="/articles/${featured.slug}" class="btn btn-primary">Lire l'article</a>
        </div>`;
      featuredSection.style.display = '';
    }

    // Les autres articles dans la grille
    articles.filter(a => a !== featured).forEach(({ meta, slug }) => {
      grid.insertAdjacentHTML('beforeend', buildCard(meta, slug));
    });

    // Réactiver les filtres
    if (typeof initFilters === 'function') initFilters();

  } catch (e) {
    if (loading) loading.textContent = 'Impossible de charger les articles.';
    console.error(e);
  }
}

loadArticles();

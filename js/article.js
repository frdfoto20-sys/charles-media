// Page article : chargement, mise en forme, sommaire, partage, débat, série.
const REPO = 'frdfoto20-sys/charles-media';
const BRANCH = 'main';

// Les images envoyées depuis l'admin sont lues directement sur GitHub
function imgUrl(src) {
  if (!src) return '';
  if (/^https?:\/\//.test(src)) return src;
  const name = src.split('/').pop();
  return `https://raw.githubusercontent.com/${REPO}/${BRANCH}/articles/images/${name}`;
}


function parseFrontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { meta: {}, body: text };
  const fm = {};
  // Lecture YAML complète (l'admin coupe les longues lignes sur plusieurs lignes)
  if (window.jsyaml) {
    try {
      const flat = (obj, prefix) => Object.entries(obj || {}).forEach(([k, v]) => {
        const key = prefix ? `${prefix}.${k}` : k;
        if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)) flat(v, key);
        else fm[key] = v instanceof Date ? v.toISOString() : String(v);
      });
      const raw = window.jsyaml.load(match[1]) || {};
      flat(raw, '');
      return { meta: fm, body: match[2], raw };
    } catch (e) { console.warn('YAML', e); }
  }
  let parent = null;
  match[1].split(/\r?\n/).forEach(line => {
    const idx = line.indexOf(':');
    if (idx === -1) return;
    const indented = /^\s+/.test(line);
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    if (!indented) {
      parent = val === '' ? key : null;
      if (val !== '') fm[key] = val;
    } else if (parent) {
      fm[`${parent}.${key}`] = val;
    } else {
      fm[key] = val;
    }
  });
  return { meta: fm, body: match[2], raw: {} };
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch(e) { return dateStr; }
}

// Échappement du texte inséré dans le HTML
const h = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function buildDebate(meta) {
  let html = '';
  ['debate1', 'debate2'].forEach((key, qi) => {
    const q = meta[`${key}_question`] || meta[`${key}.question`];
    const opts = (meta[`${key}_options`] || meta[`${key}.options`] || 'Oui;Non;Ça dépend').split(';');
    if (!q) return;
    html += `<div class="debate-block">
      <p>${h(q)}</p>
      <div class="debate-options" role="group" data-q="${qi}">
        ${opts.map(o => `<button type="button" class="debate-btn" aria-pressed="false">${h(o.trim())}</button>`).join('')}
      </div>
      <p class="debate-note" role="status" aria-live="polite"></p>
    </div>`;
  });
  return html ? `<section class="debate-section" aria-label="Questions de débat"><h3>Et vous, qu'en pensez-vous ?</h3>${html}</section>` : '';
}

// Notes de bas de page : « texte[^1] » et, en fin d'article, « [^1]: source »
function extractFootnotes(md) {
  const defs = new Map();
  md = md.replace(/^\[\^([^\]\s]+)\]:\s*(.+(?:\n(?: {2,}|\t).+)*)\n?/gm, (m, id, text) => { defs.set(id, text.replace(/\n\s+/g, ' ')); return ''; });
  if (!defs.size) return { md, notes: '' };
  const order = [];
  md = md.replace(/\[\^([^\]\s]+)\]/g, (m, id) => {
    if (!defs.has(id)) return m;
    if (!order.includes(id)) order.push(id);
    const n = order.indexOf(id) + 1;
    return `<sup class="fn-ref"><a href="#note-${n}" id="appel-${n}" aria-label="Note ${n}">${n}</a></sup>`;
  });
  const items = order.map((id, i) => `<li id="note-${i + 1}">${window.marked ? marked.parseInline(defs.get(id)) : h(defs.get(id))} <a href="#appel-${i + 1}" class="fn-back" aria-label="Revenir au texte">↩</a></li>`);
  return { md, notes: `<section class="footnotes" aria-label="Notes"><h2>Notes</h2><ol>${items.join('')}</ol></section>` };
}

function renderBody(md) {
  if (!window.marked) return h(md);
  const fn = extractFootnotes(md);
  const html = marked.parse(fn.md) + fn.notes;
  return html
    // Images insérées dans le texte : les lire aussi sur GitHub
    .replace(/<img src="(?!https?:)([^"]+)"/g, (m, src) => `<img loading="lazy" decoding="async" src="${imgUrl(src)}"`)
    // Image avec un titre → figure légendée
    .replace(/<p>\s*(<img [^>]*?) title="([^"]*)"([^>]*)>\s*<\/p>/g, '<figure>$1$3><figcaption>$2</figcaption></figure>')
    // Retours à la ligne inutiles en fin d'intertitre
    .replace(/(?:\s*<br\s*\/?>)+\s*(<\/h[1-6]>)/g, '$1')
    // Tableaux : défilement horizontal sur téléphone
    .replace(/<table>/g, '<div class="table-wrap"><table>').replace(/<\/table>/g, '</table></div>')
    // Liens vers d'autres sites : ouverture dans un nouvel onglet
    .replace(/<a href="(https?:\/\/[^"]+)"/g, '<a href="$1" target="_blank" rel="noopener"');
}

// Encadré « Chiffres clés » (champ « chiffres » de l'admin)
function buildKeyFigures(raw) {
  const list = Array.isArray(raw && raw.chiffres) ? raw.chiffres.filter(c => c && c.valeur) : [];
  if (!list.length) return '';
  return `<aside class="key-figures" aria-label="Chiffres clés">
    <span class="kicker">L'essentiel en chiffres</span>
    <dl>${list.map(c => `<div><dt>${h(c.libelle || '')}</dt><dd>${h(c.valeur)}</dd></div>`).join('')}</dl>
  </aside>`;
}

// Débat : un seul choix par question. Le choix reste sur l'appareil du lecteur (il n'est envoyé nulle part).
function initDebate(container, slug) {
  const KEY = `debat:${slug}`;
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) {}
  const NOTE = 'Merci ! Votre réponse reste sur cet appareil. Pour en débattre, retrouvez-nous sur Instagram.';
  container.querySelectorAll('.debate-options').forEach(group => {
    const q = group.dataset.q;
    const btns = [...group.querySelectorAll('.debate-btn')];
    const note = group.parentElement.querySelector('.debate-note');
    const select = (btn, announce) => {
      const already = btn.getAttribute('aria-pressed') === 'true';
      btns.forEach(b => b.setAttribute('aria-pressed', 'false'));
      if (!already) btn.setAttribute('aria-pressed', 'true');   // un second appui annule le choix
      saved[q] = already ? null : btn.textContent;
      try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch (e) {}
      if (announce) note.textContent = already ? '' : NOTE;
    };
    btns.forEach(btn => {
      if (saved[q] === btn.textContent) btn.setAttribute('aria-pressed', 'true');
      btn.addEventListener('click', () => select(btn, true));
    });
  });
}

// Boutons de partage
const ICONS = {
  whatsapp: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.4.1-.2 0-.3 0-.5l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2s.2-1.1.2-1.2-.2-.2-.5-.3z"/></svg>',
  facebook: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M14 8V6.2c0-.8.2-1.2 1.4-1.2H17V2h-2.6C11.3 2 10 3.5 10 6v2H8v3h2v11h4V11h2.7l.3-3z"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
  share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="m7 8 5-5 5 5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg>',
};
function buildShare(title, top) {
  const url = location.href.split('#')[0];
  const text = `${title} — Charles le Média`;
  return `<div class="share-bar${top ? ' share-bar--top' : ''}" role="group" aria-label="Partager l'article">
    <span class="label">Partager</span>
    ${navigator.share ? `<button type="button" class="share-btn" data-share="native">${ICONS.share}<span class="txt">Partager…</span></button>` : ''}
    <a class="share-btn" href="https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}" target="_blank" rel="noopener">${ICONS.whatsapp}<span class="txt">WhatsApp</span></a>
    <a class="share-btn" href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}" target="_blank" rel="noopener">${ICONS.facebook}<span class="txt">Facebook</span></a>
    <button type="button" class="share-btn" data-share="copy">${ICONS.link}<span class="txt">Copier le lien</span></button>
    <span class="share-status" role="status" aria-live="polite"></span>
  </div>`;
}
function initShare(container, title) {
  container.querySelectorAll('[data-share]').forEach(btn => btn.addEventListener('click', async () => {
    const status = btn.closest('.share-bar').querySelector('.share-status');
    const url = location.href.split('#')[0];
    if (btn.dataset.share === 'native') {
      try { await navigator.share({ title, url }); } catch (e) { /* partage annulé */ }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      status.textContent = 'Lien copié.';
    } catch (e) {
      status.textContent = url; // à sélectionner à la main si la copie est refusée
    }
    setTimeout(() => { status.textContent = ''; }, 4000);
  }));
}

// Sommaire : construit à partir des intertitres (à partir de 3)
function buildToc(body) {
  const heads = [...body.querySelectorAll('h2')].filter(el => !el.closest('.footnotes'));
  if (heads.length < 3) return null;
  const used = new Set();
  const items = heads.map((el, i) => {
    let id = (el.textContent || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || `partie-${i + 1}`;
    while (used.has(id)) id += '-2';
    used.add(id);
    el.id = id;
    return `<li><a href="#${id}">${h(el.textContent)}</a></li>`;
  });
  const toc = document.createElement('details');
  toc.className = 'toc';
  if (window.matchMedia('(min-width: 900px)').matches) toc.open = true;
  toc.innerHTML = `<summary>Sommaire · ${heads.length} parties</summary><ol>${items.join('')}</ol>`;
  return toc;
}

// Liste des articles (pour la navigation dans une série)
async function loadIndex() {
  try {
    const r = await fetch(`https://raw.githubusercontent.com/${REPO}/${BRANCH}/articles/index.json?v=${Math.floor(Date.now() / 60000)}`);
    return r.ok ? await r.json() : [];
  } catch (e) { return []; }
}

function buildSeriesNav(meta, slug, index) {
  if (!meta.series) return '';
  const list = index.filter(a => a.series === meta.series)
    .sort((x, y) => (+x.series_part || 0) - (+y.series_part || 0));
  if (list.length < 2) return '';
  const pos = list.findIndex(a => a.slug === slug);
  const prev = list[pos - 1], next = list[pos + 1];
  const link = (a, dir, cls) => a ? `<a class="${cls}" href="/articles/${encodeURI(a.slug)}"><span class="dir">${dir}</span><span class="t">${h(a.title)}</span></a>` : '';
  return `
    <nav class="series-nav" aria-label="Série ${h(meta.series)}">
      <div class="series-band">
        <div class="series-head">
          <span class="kicker">Série · volet ${h(meta.series_part || pos + 1)} sur ${list.length}</span>
          <h2>${h(meta.series)}</h2>
        </div>
        <ol class="series-list">
          ${list.map(a => `
            <li class="series-item"${a.slug === slug ? ' aria-current="true"' : ''}>
              <a href="/articles/${encodeURI(a.slug)}">
                <span class="series-num">Volet ${h(a.series_part || '')}</span>
                <span class="series-title">${h(a.title)}</span>
                <span class="series-time">${a.readtime ? h(a.readtime) + ' min' : ''}</span>
              </a>
            </li>`).join('')}
        </ol>
        ${prev || next ? `<div class="series-pager">${link(prev, '← Volet précédent', 'prev')}${link(next, 'Volet suivant →', 'next')}</div>` : ''}
      </div>
    </nav>`;
}

const FOLLOW = `
  <aside class="follow-box">
    <p><strong>Cet article vous a intéressé ?</strong>Les prochains articles et les infographies sont annoncés sur les réseaux.</p>
    <div class="follow-actions">
    <a href="https://www.instagram.com/charleslemedia/" class="btn btn-primary" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>Suivre @charleslemedia</a>
    <a href="#" class="btn btn-outline" data-social="facebook" target="_blank" rel="noopener" hidden><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M14 8V6.2c0-.8.2-1.2 1.4-1.2H17V2h-2.6C11.3 2 10 3.5 10 6v2H8v3h2v11h4V11h2.7l.3-3z"/></svg>Facebook</a>
    </div>
  </aside>`;

// Barre de progression : suit le défilement du texte de l'article
function initProgress() {
  const bar = document.getElementById('read-progress');
  const body = document.querySelector('.article-body');
  if (!bar || !body) return;
  let ticking = false;
  const update = () => {
    const r = body.getBoundingClientRect();
    const total = r.height - window.innerHeight * .6;
    const done = Math.min(1, Math.max(0, (-r.top + window.innerHeight * .25) / Math.max(total, 1)));
    bar.style.transform = `scaleX(${done})`;
    ticking = false;
  };
  window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  window.addEventListener('resize', update, { passive: true });
  update();
}

async function loadArticle() {
  const container = document.getElementById('article-content');
  // Récupère le slug depuis l'URL : /articles/mon-article.html
  const slug = decodeURIComponent(window.location.pathname.split('/').pop());
  if (!slug || slug === 'article.html') {
    container.innerHTML = '<p>Article introuvable. <a href="/">Retour à l\'accueil</a></p>';
    return;
  }

  try {
    const [res, index] = await Promise.all([
      fetch(`https://raw.githubusercontent.com/${REPO}/${BRANCH}/articles/${encodeURIComponent(slug)}`),
      loadIndex(),
    ]);
    if (!res.ok) throw new Error('Article non trouvé');
    const { meta, body, raw } = parseFrontmatter(await res.text());

    document.title = `${meta.title || 'Article'} — Charles le Média`;
    const setMeta = (sel, make, attr, val) => {
      let el = document.head.querySelector(sel);
      if (!el) { el = make(); document.head.appendChild(el); }
      el.setAttribute(attr, val);
    };
    if (meta.description) setMeta('meta[name="description"]', () => Object.assign(document.createElement('meta'), { name: 'description' }), 'content', meta.description);
    setMeta('link[rel="canonical"]', () => Object.assign(document.createElement('link'), { rel: 'canonical' }), 'href', `${location.origin}/articles/${slug}`);

    const cover = meta.cover ? `<img class="cover-img" src="${h(imgUrl(meta.cover))}" alt="" fetchpriority="high">` : '';
    const readtime = meta.readtime ? `${meta.readtime} min de lecture` : '';
    const seriesTag = meta.series ? `<span class="series-tag">Série « ${h(meta.series)} » · volet ${h(meta.series_part || '')}</span>` : '';

    container.innerHTML = `
      <a href="/#articles" class="back-link">← Tous les articles</a>
      <div><span class="kicker">${h(meta.category || '')}</span>${seriesTag}</div>
      <h1>${h(meta.title || 'Sans titre')}</h1>
      ${meta.description ? `<p class="standfirst">${h(meta.description)}</p>` : ''}
      <div class="article-meta">
        <span>${h(formatDate(meta.date))}</span>
        <span>${h(readtime)}</span>
      </div>
      ${buildShare(meta.title || '', true)}
      ${cover}
      ${buildKeyFigures(raw)}
      <div class="article-body">${renderBody(body)}</div>
      ${buildShare(meta.title || '')}
      ${buildDebate(meta)}
      ${buildSeriesNav(meta, slug, index)}
      ${FOLLOW}
    `;

    const bodyEl = container.querySelector('.article-body');
    const toc = buildToc(bodyEl);
    if (toc) bodyEl.before(toc);

    initDebate(container, slug);

    initShare(container, meta.title || '');
    if (window.applySocial) window.applySocial();
    initProgress();
  } catch(e) {
    container.innerHTML = '<p>Impossible de charger cet article. Vérifiez votre connexion puis rechargez la page. <a href="/">Retour à l\'accueil</a></p>';
    console.error(e);
  }
}

loadArticle();

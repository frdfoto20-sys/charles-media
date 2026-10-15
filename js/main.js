/* Charles.média — JS principal */

/* ---- Débats ---- */
function toggleDebate(btn) {
  btn.closest('.debate-btns').querySelectorAll('.debate-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

/* ---- Filtres par catégorie ---- */
function setTag(btn) {
  document.querySelectorAll('.tag').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

/* ---- Sécurité : échappement HTML strict ---- */
function esc(s) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(String(s)));
  return d.innerHTML;
}

/* ---- Rate limiting commentaires (5 max par session) ---- */
const COMMENT_LIMIT = 5;
const COMMENT_KEY   = 'cm_count';
const COMMENT_TS    = 'cm_ts';
const WINDOW_MS     = 10 * 60 * 1000; // 10 minutes

function canComment() {
  const now   = Date.now();
  const since = parseInt(sessionStorage.getItem(COMMENT_TS) || '0');
  let count   = parseInt(sessionStorage.getItem(COMMENT_KEY) || '0');
  if (now - since > WINDOW_MS) { count = 0; sessionStorage.setItem(COMMENT_TS, now); }
  return count < COMMENT_LIMIT;
}

function incrementCount() {
  const count = parseInt(sessionStorage.getItem(COMMENT_KEY) || '0');
  sessionStorage.setItem(COMMENT_KEY, count + 1);
  if (!sessionStorage.getItem(COMMENT_TS)) sessionStorage.setItem(COMMENT_TS, Date.now());
}

/* ---- Validation stricte ---- */
const PSEUDO_MAX = 30;
const TEXT_MAX   = 1000;
const PSEUDO_RE  = /^[a-zA-ZÀ-ÿ0-9_\-\.]{2,30}$/;

function submitComment(e) {
  e.preventDefault();

  // Rate limit
  if (!canComment()) {
    showErr('err-text', 'Trop de commentaires envoyés. Réessaie dans quelques minutes.');
    return;
  }

  const pseudoRaw = document.getElementById('pseudo').value.trim();
  const ageRaw    = document.getElementById('age').value.trim();
  const textRaw   = document.getElementById('comment-text').value.trim();

  clearErrors();

  let ok = true;

  // Validation pseudo
  if (!pseudoRaw) {
    showErr('err-pseudo', 'Un pseudo est requis.'); ok = false;
  } else if (!PSEUDO_RE.test(pseudoRaw)) {
    showErr('err-pseudo', 'Pseudo invalide (2–30 caractères, lettres, chiffres, _ - . uniquement).'); ok = false;
  }

  // Validation âge
  const age = parseInt(ageRaw);
  if (!ageRaw || isNaN(age) || age < 13 || age > 120) {
    showErr('err-age', 'Âge requis (13 ans minimum).'); ok = false;
  }

  // Validation texte
  if (!textRaw) {
    showErr('err-text', 'Le commentaire ne peut pas être vide.'); ok = false;
  } else if (textRaw.length > TEXT_MAX) {
    showErr('err-text', `Commentaire trop long (max ${TEXT_MAX} caractères).`); ok = false;
  }

  if (!ok) return;

  // Insertion sécurisée (createTextNode — zéro innerHTML sur les données user)
  const list    = document.getElementById('comment-list');
  const wrapper = document.createElement('div');
  wrapper.className = 'comment';

  const avatar = document.createElement('div');
  avatar.className = 'comment-avatar';
  avatar.textContent = pseudoRaw.substring(0, 2).toUpperCase();

  const body   = document.createElement('div');
  const name   = document.createElement('span');
  name.className = 'comment-pseudo';
  name.textContent = pseudoRaw;

  const date   = document.createElement('span');
  date.className = 'comment-date';
  date.textContent = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

  const txt    = document.createElement('div');
  txt.className = 'comment-text';
  txt.textContent = textRaw; // createTextNode implicite — aucun HTML interprété

  body.appendChild(name);
  body.appendChild(date);
  body.appendChild(txt);
  wrapper.appendChild(avatar);
  wrapper.appendChild(body);
  list.insertBefore(wrapper, list.firstChild);

  incrementCount();

  // Reset
  document.getElementById('pseudo').value       = '';
  document.getElementById('age').value          = '';
  document.getElementById('comment-text').value = '';
}

function showErr(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent  = msg;
  el.style.display = 'block';
}

function clearErrors() {
  document.querySelectorAll('.form-error').forEach(el => {
    el.style.display = 'none';
    el.textContent   = '';
  });
}

/* ---- Effacer erreur à la saisie ---- */
document.addEventListener('DOMContentLoaded', () => {
  [['pseudo','err-pseudo'],['age','err-age'],['comment-text','err-text']].forEach(([id, errId]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => {
      const err = document.getElementById(errId);
      if (err) { err.style.display = 'none'; err.textContent = ''; }
    });
  });

  // Limiter la longueur des champs côté HTML aussi
  const pseudo = document.getElementById('pseudo');
  if (pseudo) pseudo.maxLength = PSEUDO_MAX;
  const txt = document.getElementById('comment-text');
  if (txt) txt.maxLength = TEXT_MAX;
});

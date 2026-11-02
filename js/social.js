// Réseaux sociaux du site.
// Page Facebook : coller son adresse ci-dessous (ex. 'https://www.facebook.com/charleslemedia').
// Tant que c'est vide, les liens Facebook restent cachés partout sur le site.
const SOCIAL = {
  facebook: '',
};

(function () {
  const apply = () => document.querySelectorAll('[data-social="facebook"]').forEach(el => {
    if (!SOCIAL.facebook) return;
    if (el.tagName === 'A') el.href = SOCIAL.facebook;
    el.querySelectorAll('a').forEach(a => { a.href = SOCIAL.facebook; });
    el.hidden = false;
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply);
  else apply();
  window.applySocial = apply; // pour les blocs ajoutés après coup (fin d'article)
})();

// Liens reçus par e-mail (invitation, mot de passe oublié, confirmation) : ils arrivent sur l'accueil.
// Le module de connexion Netlify n'est chargé que dans ce cas ; une fois connecté, direction l'admin.
(function () {
  if (!/(invite|recovery|confirmation|email_change)_token=/.test(location.hash)) return;
  // Chargement pendant la lecture de la page, pour que le module démarre normalement
  document.write('<script src="https://identity.netlify.com/v1/netlify-identity-widget.js"><\/script>');
  document.addEventListener('DOMContentLoaded', function () {
    var id = window.netlifyIdentity;
    if (id) id.on('login', function () { document.location.href = '/admin/'; });
  });
})();

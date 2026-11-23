/* Fallback global de imagens
 * Carregado no <head> de todas as páginas. Escuta erros de <img> na fase de
 * captura (eventos de erro não sobem pela árvore), então cobre imagens do HTML
 * e também as criadas depois via innerHTML (loja, blog, vídeos etc.).
 * Para usar outra imagem num caso específico: <img data-fallback-src="...">.
 * Para desativar numa imagem: <img data-no-fallback>.
 */
(function () {
  var PLACEHOLDER = 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
        '<stop offset="0" stop-color="#1a1a1a"/><stop offset="1" stop-color="#2a0a0a"/>' +
      '</linearGradient></defs>' +
      '<rect width="320" height="180" fill="url(#g)"/>' +
      '<text x="160" y="98" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="22" font-weight="800" fill="#ffffff" fill-opacity=".18">' +
        'FLLOYD<tspan fill="#8f0000" fill-opacity=".6">INN</tspan>' +
      '</text>' +
    '</svg>'
  );

  document.addEventListener('error', function (e) {
    var img = e.target;
    if (!img || img.tagName !== 'IMG' || img.hasAttribute('data-no-fallback')) return;

    var step = img.getAttribute('data-fallback-step') || '';
    var custom = img.getAttribute('data-fallback-src');

    if (custom && step === '') {
      img.setAttribute('data-fallback-step', 'custom');
      img.src = custom;
    } else if (step !== 'placeholder') {
      img.setAttribute('data-fallback-step', 'placeholder');
      img.src = PLACEHOLDER;
    }
  }, true);
})();

/* Analytics central do site (GA4 + Google Tag Manager)
 * Incluído no topo do <head> de todas as páginas:  <script src="js/analytics.js"></script>
 * Para mudar IDs ou estratégia, altere SÓ este arquivo.
 *
 * ATENÇÃO — LOAD_GTAG_DIRECT
 * O container GTM-TWBF6RH6 (versão publicada em 23/11/2026) NÃO tem uma "Google Tag"
 * (configuração GA4); tem apenas uma tag "GA4 Event" disparando em gtm.js/gtm.init.
 * Hoje, quem envia o page_view de verdade é o gtag.js direto abaixo.
 *   true  -> gtag.js envia page_view + GTM carrega (situação atual, segura).
 *   false -> só GTM. Use APENAS depois de criar no GTM uma "Google Tag" com o ID
 *            G-0VJ19JZXGY disparando em "Initialization - All Pages" e pausar/remover
 *            a tag "GA4 Event" atual — senão o GA4 deixa de receber page_view.
 */
(function (w, d) {
  var GA4_ID = 'G-0VJ19JZXGY';
  var GTM_ID = 'GTM-TWBF6RH6';
  var LOAD_GTAG_DIRECT = true;

  // Não registra acessos de teste (arquivo local / servidor de desenvolvimento).
  var host = w.location.hostname;
  if (w.location.protocol === 'file:' || host === 'localhost' || host === '127.0.0.1' || host === '') return;

  w.dataLayer = w.dataLayer || [];
  // gtag() global: as páginas podem enviar eventos com gtag('event', 'nome', {...}).
  w.gtag = w.gtag || function () { w.dataLayer.push(arguments); };

  function loadScript(src) {
    var s = d.createElement('script');
    s.async = true;
    s.src = src;
    (d.head || d.documentElement).appendChild(s);
  }

  // gtag() já existe e enfileira eventos no dataLayer; os scripts de terceiros só são baixados
  // depois do carregamento da página (ocioso) ou na 1ª interação — nada disso atrasa o 1º render.
  if (LOAD_GTAG_DIRECT) {
    w.gtag('js', new Date());
    w.gtag('config', GA4_ID);
  }
  var started = false;
  function start() {
    if (started) return;
    started = true;
    if (LOAD_GTAG_DIRECT) loadScript('https://www.googletagmanager.com/gtag/js?id=' + GA4_ID);
    w.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
    loadScript('https://www.googletagmanager.com/gtm.js?id=' + GTM_ID);
  }
  ['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach(function (ev) { w.addEventListener(ev, start, { once: true, passive: true }); });
  function whenIdle() { (w.requestIdleCallback || function (f) { return setTimeout(f, 1); })(start, { timeout: 4000 }); }
  if (d.readyState === 'complete') whenIdle(); else w.addEventListener('load', function () { setTimeout(whenIdle, 1500); });
})(window, document);

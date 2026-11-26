/* =====================================================================
 * Header e footer compartilhados — Flloydinn Gameplay
 *
 * Uso (carregar no <head>, SEM defer/async, depois do css/styles.css):
 *   <script src="js/layout.js"></script>
 *   ...
 *   <site-header></site-header>                 -> header padrão (menu em botões)
 *   <site-header variant="home"></site-header>  -> header do index (menu em texto + âncoras)
 *   <site-footer></site-footer>
 *   <site-footer note="• Canal TV experimental"></site-footer>
 *
 * Atributos opcionais:
 *   active="blog"  -> força o item ativo (por padrão é detectado pelo nome do arquivo)
 *   base="/"       -> prefixo dos links (o 404.html usa "/" porque pode abrir em qualquer URL)
 *
 * Por que custom elements: como o script já está carregado quando o navegador lê
 * <site-header>, o conteúdo é montado na hora (sem "pulo" de layout) e o footer
 * existe antes dos scripts das páginas rodarem.
 *
 * Para mudar o menu do site inteiro, edite só NAV / FOOTER_LINKS abaixo.
 * ===================================================================== */
(function () {
  'use strict';

  var NAV = [
    { id: 'inicio',    label: 'Início',    href: 'index.html', hideOnHome: true },
    { id: 'videos',    label: 'Vídeos',    href: 'videos.html' },
    { id: 'tv',        label: 'TV',        href: 'tv.html', drawerLabel: 'TV 24/7' },
    { id: 'blog',      label: 'Blog',      href: 'blog.html' },
    { id: 'jogos',     label: 'Jogos',     href: 'index.html#jogos', homeHref: '#jogos' },
    { id: 'loja',      label: 'Loja',      href: 'loja.html' },
    { id: 'agenda',    label: 'Agenda',    href: 'agenda.html' },
    { id: 'parcerias', label: 'Parcerias', href: 'parcerias.html' }
  ];
  var CONTACT = { label: 'Contato', href: 'index.html#contato', homeHref: '#contato' };
  var HOME_EXTRA_DRAWER = [{ label: 'Sobre', href: '#sobre' }]; // só na gaveta do index

  var FOOTER_LINKS = [
    { label: 'Sobre',   href: 'sobre.html' },
    { label: 'Canais',  href: 'canais.html' },
    { label: 'Cortes',  href: 'cortes.html' },
    { label: 'Arcade',  href: 'arcade.html' },
    { label: 'Setup',   href: 'setup.html' },
    { label: 'FAQ',     href: 'faq.html' },
    { label: 'YouTube', href: 'https://www.youtube.com/@flloydinn', external: true },
    { label: 'Esporte Clube', href: 'https://www.youtube.com/@flloydinnesporteclube', external: true }
  ];

  // arquivo -> item do menu que fica destacado
  var SECTION_OF = {
    '': 'inicio', 'index.html': 'inicio',
    'videos.html': 'videos', 'tv.html': 'tv',
    'blog.html': 'blog', 'post.html': 'blog',
    'arcade.html': 'jogos', 'loja.html': 'loja', 'agenda.html': 'agenda', 'parcerias.html': 'parcerias'
  };

  var BREAKPOINT = 860; // mesmo valor do @media em css/styles.css

  // ------------------------------------------------------------------
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function currentFile() {
    var parts = location.pathname.split('/');
    return decodeURIComponent(parts[parts.length - 1] || '');
  }
  function resolve(href, base) {
    if (/^(https?:|mailto:|#)/.test(href)) return href;
    return (base || '') + href;
  }
  function activeId(el) {
    return el.getAttribute('active') || SECTION_OF[currentFile()] || '';
  }

  // ------------------------------------------------------------------
  function renderHeader(el) {
    var home = el.getAttribute('variant') === 'home';
    var base = el.getAttribute('base') || '';
    var active = activeId(el);
    var uid = 'mobileDrawer';

    // Navbar única (padrão da home) em todas as páginas: marca + links em texto + botão Contato.
    // "Início" fica só na gaveta mobile (no desktop a marca já leva ao início).
    var items = NAV.filter(function (n) { return !n.hideOnHome; });
    function hrefOf(n) { return home && n.homeHref ? n.homeHref : resolve(n.href, base); }
    function current(n) { return n.id === active && !(home && n.id === 'inicio') ? ' aria-current="page"' : ''; }
    var contactHref = home ? CONTACT.homeHref : resolve(CONTACT.href, base);

    var menu = items.map(function (n) {
      return '<a href="' + esc(hrefOf(n)) + '"' + current(n) + '>' + esc(n.label) + '</a>';
    }).join('') + '<a class="btn btn--small" href="' + esc(contactHref) + '">' + esc(CONTACT.label) + '</a>';

    var first = home
      ? HOME_EXTRA_DRAWER
      : [{ label: 'Início', href: resolve('index.html', base) }];
    var drawer = first.map(function (n) {
      return '<a class="drawer-link" href="' + esc(n.href) + '">' + esc(n.label) + '</a>';
    }).join('') + items.map(function (n) {
      return '<a class="drawer-link" href="' + esc(hrefOf(n)) + '"' + current(n) + '>' + esc(n.drawerLabel || n.label) + '</a>';
    }).join('') + '<a class="btn" href="' + esc(contactHref) + '">' + esc(CONTACT.label) + '</a>';

    var brand = '<a class="brand" href="' + (home ? '#topo' : esc(resolve('index.html', base))) + '" aria-label="Flloydinn — ' + (home ? 'topo' : 'início') + '">' +
      '<span class="logo">Fll<span aria-hidden="true">o</span>y<span aria-hidden="true">d</span>inn</span></a>';

    el.innerHTML =
      '<header class="site-header' + (home ? ' site-header--home' : '') + '"' + (home ? ' id="topo"' : '') + '>' +
        '<div class="container nav">' +
          brand +
          '<nav class="menu" aria-label="Principal">' + menu + '</nav>' +
          '<button class="hamburger" type="button" aria-label="Abrir menu" aria-expanded="false" aria-controls="' + uid + '">' +
            '<span></span><span></span><span></span>' +
          '</button>' +
        '</div>' +
        '<nav class="mobile-drawer" id="' + uid + '" aria-label="Menu">' + drawer + '</nav>' +
      '</header>';

    bindDrawer(el);
  }

  function bindDrawer(el) {
    var btn = el.querySelector('.hamburger');
    var drawer = el.querySelector('.mobile-drawer');
    if (!btn || !drawer) return;
    function setOpen(open) {
      drawer.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    }
    btn.addEventListener('click', function () { setOpen(!drawer.classList.contains('open')); });
    drawer.addEventListener('click', function (e) { if (e.target.closest('a')) setOpen(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && drawer.classList.contains('open')) { setOpen(false); btn.focus(); }
    });
    document.addEventListener('click', function (e) {
      if (drawer.classList.contains('open') && !el.contains(e.target)) setOpen(false);
    });
    window.addEventListener('resize', function () { if (window.innerWidth > BREAKPOINT) setOpen(false); });
  }

  // ------------------------------------------------------------------
  function renderFooter(el) {
    var home = el.getAttribute('variant') === 'home';
    var base = el.getAttribute('base') || '';
    var note = el.getAttribute('note');
    var links = FOOTER_LINKS.map(function (l) {
      return '<a href="' + esc(l.external ? l.href : resolve(l.href, base)) + '"' +
        (l.external ? ' target="_blank" rel="noopener"' : '') + '>' + esc(l.label) + '</a>';
    }).join('');
    el.innerHTML =
      '<footer class="site-footer' + (home ? ' site-footer--home' : '') + '">' +
        '<div class="container site-footer__inner">' +
          '<p>© <span data-year>' + new Date().getFullYear() + '</span> Flloydinn Gameplay' + (note ? ' ' + esc(note) : '') + '</p>' +
          '<nav class="site-footer__links" aria-label="Rodapé">' + links + '</nav>' +
          (home ? '<a href="#topo" class="to-top" aria-label="Voltar ao topo">↑</a>' : '') +
        '</div>' +
      '</footer>';
  }

  // ------------------------------------------------------------------
  function upgrade(tag, render) {
    if (window.customElements && !customElements.get(tag)) {
      customElements.define(tag, class extends HTMLElement {
        connectedCallback() { if (!this.hasAttribute('data-rendered')) { this.setAttribute('data-rendered', ''); render(this); } }
      });
    } else if (!window.customElements) {
      // navegadores muito antigos: monta quando o HTML terminar de carregar
      document.addEventListener('DOMContentLoaded', function () {
        Array.prototype.forEach.call(document.getElementsByTagName(tag), function (el) {
          if (!el.hasAttribute('data-rendered')) { el.setAttribute('data-rendered', ''); render(el); }
        });
      });
    }
  }
  upgrade('site-header', renderHeader);
  upgrade('site-footer', renderFooter);

  // ------------------------------------------------------------------
  // Canal "Cortes do Flloydinn": PONTO ÚNICO = data/canais.json -> cortes.url
  // Vazio: selo "Em breve", sem link. Preenchido (https://...): troca o botão
  // [data-cortes-cta] por um link, remove os selos [data-cortes-soon] e inclui a
  // URL no sameAs da Organization (<script type="application/ld+json">).
  // ------------------------------------------------------------------
  function applyCortes() {
    var cta = document.querySelectorAll('[data-cortes-cta]');
    var ld = document.querySelectorAll('script[type="application/ld+json"]');
    if (!cta.length && !ld.length) return;
    fetch('data/canais.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      var url = d && d.cortes && typeof d.cortes.url === 'string' ? d.cortes.url.trim() : '';
      if (!/^https:\/\/(www\.)?(youtube\.com|youtu\.be)\/[^\s"'<>]+$/i.test(url)) return;
      Array.prototype.forEach.call(document.querySelectorAll('[data-cortes-soon]'), function (el) { el.remove(); });
      Array.prototype.forEach.call(cta, function (el) {
        var a = document.createElement('a');
        a.className = el.className; a.classList.remove('is-disabled');
        a.href = url; a.target = '_blank'; a.rel = 'noopener';
        a.textContent = el.getAttribute('data-label') || 'Ver no YouTube';
        a.setAttribute('aria-label', 'Ver o canal Cortes do Flloydinn no YouTube');
        el.replaceWith(a);
      });
      Array.prototype.forEach.call(ld, function (s) {
        try {
          var j = JSON.parse(s.textContent), changed = false;
          (j['@graph'] || [j]).forEach(function (n) {
            if (n && n['@type'] === 'Organization' && Array.isArray(n.sameAs) && n.sameAs.indexOf(url) < 0) {
              n.sameAs.push(url); changed = true;
              if (Array.isArray(n.subOrganization)) n.subOrganization.push({ '@type': 'Organization', '@id': 'https://flloydinn.netlify.app/#canal-cortes', name: (d.cortes && d.cortes.name) || 'Cortes do Flloydinn', url: url, sameAs: [url], parentOrganization: { '@id': 'https://flloydinn.netlify.app/#org' } });
            }
          });
          if (changed) s.textContent = JSON.stringify(j).replace(/</g, '\\u003c');
        } catch (e) { /* JSON-LD de outra página: ignora */ }
      });
    }).catch(function () { /* sem arquivo: mantém "Em breve" */ });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applyCortes); else applyCortes();

  // ------------------------------------------------------------------
  // PWA: registra o Service Worker (sw.js) só em https: ou localhost. Falhas nunca quebram a página.
  // ------------------------------------------------------------------
  (function registerSW() {
    var h = location.hostname;
    var secure = location.protocol === 'https:' || h === 'localhost' || h === '127.0.0.1';
    if (!secure || !('serviceWorker' in navigator)) return;
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(function () { /* sem SW: o site segue normal */ });
    });
  })();

  window.FlloydLayout = { NAV: NAV, FOOTER_LINKS: FOOTER_LINKS };
})();

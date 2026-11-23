/* =====================================================================
 * Engajamento 100% no navegador (sem backend) — Flloydinn
 *   - Favoritos (jogos e vídeos)            -> localStorage "fll_favs"
 *   - Histórico "Continuar explorando"       -> localStorage "fll_history"
 *   - Compartilhar / copiar link             -> navigator.share (celular) ou área de transferência + toast
 *
 * Uso por atributos (sem JS nas páginas):
 *   <button data-fav data-fav-type="game" data-fav-id="runner" data-fav-title="Neon Runner 3D"
 *           data-fav-url="runner.html" data-fav-img="assets/games/neon-runner.svg">Favoritar</button>
 *   <button data-share data-share-url="runner.html" data-share-title="Neon Runner 3D">Compartilhar</button>
 *   <section data-continue></section>   -> bloco "Continuar explorando" (some se não houver nada)
 * API: window.FlloydEngage = { toast, share, isFav, toggleFav, favs, history, clearHistory, renderContinue }
 * Carregar com defer em todas as páginas (inclusive jogos, que só registram a visita).
 * ===================================================================== */
(function () {
  'use strict';
  var FAV_KEY = 'fll_favs', HIST_KEY = 'fll_history', MAX_HIST = 12;
  var SITE = 'https://flloydinn.netlify.app/';

  // páginas que entram no histórico (título curto + tipo + imagem)
  var PAGES = {
    'asteroid.html': ['Space Courier 3D', 'game', 'assets/games/space-courier.svg'],
    'runner.html': ['Neon Runner 3D', 'game', 'assets/games/neon-runner.svg'],
    'drifter.html': ['Desert Drifter 3D', 'game', 'assets/games/desert-drifter.svg'],
    'minigolf.html': ['Galaxy MiniGolf 3D', 'game', 'assets/games/galaxy-minigolf.svg'],
    'wildlands-online.html': ['Wildlands Online', 'game', 'assets/games/wildlands-online.svg'],
    'arcade.html': ['Arcade', 'game', 'assets/games/arcade.svg'],
    'tv.html': ['TV 24/7', 'page'], 'videos.html': ['Vídeos', 'page'], 'cortes.html': ['Cortes e Shorts', 'page'],
    'blog.html': ['Blog', 'page'], 'loja.html': ['Loja', 'page'], 'agenda.html': ['Agenda', 'page'],
    'parcerias.html': ['Parcerias', 'page'], 'canais.html': ['Canais', 'page'], 'sobre.html': ['Sobre', 'page'],
    'faq.html': ['FAQ', 'page'], 'setup.html': ['Setup', 'page']
  };

  // ------------------------------------------------------------------ util
  function read(k) { try { var v = JSON.parse(localStorage.getItem(k) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
  function write(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function safeUrl(u) { u = String(u || ''); return /^(https:\/\/|[\w-]+\.html|#|\?)/.test(u) && !/^javascript:/i.test(u) ? u : '#'; }
  function safeImg(u) { u = String(u || ''); return /^(assets\/[\w\/.-]+|https:\/\/i\.ytimg\.com\/vi\/[\w-]{11}\/\w+\.jpg)$/.test(u) ? u : ''; }
  function absolute(u) { try { return new URL(u, location.href).href; } catch (e) { return location.href; } }
  function track(n, p) { try { if (window.gtag) window.gtag('event', n, p || {}); } catch (e) {} }

  // ------------------------------------------------------------------ toast
  var toastEl, toastTimer;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'fll-toast'; toastEl.setAttribute('role', 'status'); toastEl.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-on'); }, 2400);
  }

  // ------------------------------------------------------------------ compartilhar
  function copy(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (res, rej) {
      var t = document.createElement('textarea'); t.value = text; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
      document.body.appendChild(t); t.select();
      try { document.execCommand('copy') ? res() : rej(); } catch (e) { rej(e); } t.remove();
    });
  }
  function share(opts) {
    var url = absolute(opts.url || location.href), title = opts.title || document.title, text = opts.text || '';
    var mobile = window.matchMedia && matchMedia('(pointer: coarse)').matches;
    track('share', { content_type: opts.type || 'page', item_id: url });
    if (mobile && navigator.share) {
      return navigator.share({ title: title, text: text, url: url }).catch(function () {});
    }
    return copy(url).then(function () { toast('Link copiado: ' + title); }, function () { toast('Não deu para copiar. Link: ' + url); });
  }

  // ------------------------------------------------------------------ favoritos
  function favs() { return read(FAV_KEY); }
  function isFav(type, id) { return favs().some(function (f) { return f.type === type && f.id === id; }); }
  function toggleFav(item) {
    var list = favs(), i = -1;
    list.forEach(function (f, k) { if (f.type === item.type && f.id === item.id) i = k; });
    var on = i < 0;
    if (on) list.unshift({ type: item.type, id: String(item.id), title: String(item.title || item.id).slice(0, 120), url: safeUrl(item.url), img: safeImg(item.img), at: Date.now() });
    else list.splice(i, 1);
    write(FAV_KEY, list.slice(0, 60));
    syncFavButtons();
    renderContinue();
    toast(on ? 'Adicionado aos favoritos' : 'Removido dos favoritos');
    track(on ? 'add_to_wishlist' : 'remove_from_wishlist', { item_id: item.id, content_type: item.type });
    return on;
  }
  function syncFavButtons(root) {
    (root || document).querySelectorAll('[data-fav]').forEach(function (b) {
      var on = isFav(b.dataset.favType, b.dataset.favId);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.classList.toggle('is-fav', on);
      var label = b.querySelector('[data-fav-label]');
      if (label) label.textContent = on ? 'Favorito' : 'Favoritar';
      b.setAttribute('aria-label', (on ? 'Remover dos favoritos: ' : 'Favoritar: ') + (b.dataset.favTitle || ''));
    });
  }

  // ------------------------------------------------------------------ histórico
  function history() { return read(HIST_KEY); }
  function clearHistory() { write(HIST_KEY, []); renderContinue(); toast('Histórico limpo'); }
  function recordVisit() {
    var file = location.pathname.split('/').pop() || 'index.html';
    var meta = PAGES[file];
    if (!meta) return;
    var list = history().filter(function (h) { return h.url !== file; });
    list.unshift({ url: file, title: meta[0], type: meta[1], img: meta[2] || '', at: Date.now() });
    write(HIST_KEY, list.slice(0, MAX_HIST));
  }

  // ------------------------------------------------------------------ bloco "Continuar explorando"
  function ago(t) {
    var m = Math.round((Date.now() - t) / 60000);
    if (m < 1) return 'agora'; if (m < 60) return 'há ' + m + ' min';
    var h = Math.round(m / 60); if (h < 24) return 'há ' + h + ' h';
    var d = Math.round(h / 24); return 'há ' + d + (d === 1 ? ' dia' : ' dias');
  }
  function chip(item, sub) {
    var img = safeImg(item.img);
    return '<a class="cx-item" href="' + esc(safeUrl(item.url)) + '">' +
      (img ? '<img src="' + esc(img) + '" alt="" loading="lazy" width="96" height="54">' : '<span class="cx-ico" aria-hidden="true">▶</span>') +
      '<span class="cx-txt"><strong>' + esc(item.title) + '</strong><small>' + esc(sub) + '</small></span></a>';
  }
  function renderContinue() {
    document.querySelectorAll('[data-continue]').forEach(function (box) {
      var here = location.pathname.split('/').pop() || 'index.html';
      var hist = history().filter(function (h) { return h.url !== here; }).slice(0, 6);
      var fv = favs().slice(0, 6);
      if (!hist.length && !fv.length) { box.hidden = true; box.innerHTML = ''; return; }
      box.hidden = false;
      box.innerHTML =
        '<div class="container cx">' +
          '<div class="cx-head"><h2 class="cx-title">Continuar explorando</h2>' +
          (hist.length ? '<button type="button" class="cx-clear" data-clear-history>Limpar histórico</button>' : '') + '</div>' +
          (hist.length ? '<div class="cx-row" aria-label="Visitados recentemente">' + hist.map(function (h) { return chip(h, (h.type === 'game' ? 'Jogo • ' : '') + ago(h.at)); }).join('') + '</div>' : '') +
          (fv.length ? '<h3 class="cx-sub">Seus favoritos</h3><div class="cx-row" aria-label="Favoritos">' + fv.map(function (f) { return chip(f, f.type === 'game' ? 'Jogo favorito' : 'Vídeo favorito'); }).join('') + '</div>' : '') +
        '</div>';
    });
  }

  // ------------------------------------------------------------------ eventos (delegação)
  document.addEventListener('click', function (e) {
    var fb = e.target.closest('[data-fav]');
    if (fb) { e.preventDefault(); toggleFav({ type: fb.dataset.favType, id: fb.dataset.favId, title: fb.dataset.favTitle, url: fb.dataset.favUrl, img: fb.dataset.favImg }); return; }
    var sb = e.target.closest('[data-share]');
    if (sb) { e.preventDefault(); share({ url: sb.dataset.shareUrl, title: sb.dataset.shareTitle, text: sb.dataset.shareText, type: sb.dataset.shareType }); return; }
    if (e.target.closest('[data-clear-history]')) { clearHistory(); }
  });
  // favoritos/histórico alterados em outra aba
  window.addEventListener('storage', function (e) { if (e.key === FAV_KEY || e.key === HIST_KEY) { syncFavButtons(); renderContinue(); } });

  // ------------------------------------------------------------------ fuso: avisa quem está fora do horário de Brasília
  function tzNotes() {
    var els = document.querySelectorAll('[data-tz-note]');
    if (!els.length) return;
    var fmt = function (tz) { return new Date().toLocaleTimeString('pt-BR', { timeZone: tz, hour: '2-digit', minute: '2-digit' }); };
    var mine; try { mine = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) { return; }
    var here = fmt(mine), brt = fmt('America/Sao_Paulo');
    els.forEach(function (el) {
      if (here === brt) { el.hidden = true; return; }
      el.textContent = 'Você está em outro fuso: agora são ' + here + ' aí e ' + brt + ' em Brasília.';
      el.hidden = false;
    });
  }

  function init() { recordVisit(); syncFavButtons(); renderContinue(); tzNotes(); setInterval(tzNotes, 60000); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

  /** Cartão de estado vazio/carregando/erro no estilo do site.
   *  stateCard({ icon:'🎬', title, text, loading:false, actions:[{ label, href } | { label, id } , ...] }) -> HTML */
  function stateCard(o) {
    o = o || {};
    var acts = (o.actions || []).map(function (a, i) {
      var cls = 'btn btn--small' + (i > 0 ? ' btn--ghost' : '');
      return a.href ? '<a class="' + cls + '" href="' + esc(safeUrl(a.href)) + '"' + (/^https:/.test(a.href) ? ' target="_blank" rel="noopener"' : '') + '>' + esc(a.label) + '</a>'
                    : '<button type="button" class="' + cls + '"' + (a.id ? ' id="' + esc(a.id) + '"' : '') + '>' + esc(a.label) + '</button>';
    }).join('');
    return '<div class="state-card' + (o.loading ? ' state-card--loading' : '') + '" role="' + (o.loading ? 'status' : 'note') + '">' +
      '<span class="state-card__icon" aria-hidden="true">' + esc(o.icon || '🎬') + '</span>' +
      (o.title ? '<h3>' + esc(o.title) + '</h3>' : '') + (o.text ? '<p>' + esc(o.text) + '</p>' : '') +
      (acts ? '<div class="state-card__actions">' + acts + '</div>' : '') + '</div>';
  }

  // conteúdo criado depois (cards renderizados por JS) chama FlloydEngage.refresh()
  window.FlloydEngage = { toast: toast, share: share, isFav: isFav, toggleFav: toggleFav, favs: favs, history: history,
    clearHistory: clearHistory, renderContinue: renderContinue, stateCard: stateCard,
    refresh: function (root) { syncFavButtons(root); }, SITE: SITE };
})();

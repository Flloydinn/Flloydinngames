/* =====================================================================
 * Conquistas locais — Flloydinn (100% no navegador, sem login)
 *
 * Tudo fica em localStorage na chave "fll_conquistas" (JSON). Se o localStorage estiver
 * indisponível/bloqueado, as conquistas funcionam só nesta visita (memória) e nada quebra.
 * O módulo NUNCA altera placares ou recordes dos jogos: só observa eventos que eles informam.
 *
 * Uso nas páginas:
 *   <script src="js/conquistas.js" data-game="space"></script>   -> registra "jogou/abriu" ao carregar
 *       ids: space, runner, drifter, minigolf, wildlands (3D) • parry, aim, quiz (Arcade) • tv
 *   FlloydConquistas.record('space', 1200)    -> recorde novo registrado pelo jogo
 *   FlloydConquistas.event('crystal', total)  -> drifter: total de cristais
 *   FlloydConquistas.event('lap')             -> drifter: volta completa
 *   FlloydConquistas.render(elemento)         -> painel de medalhas (arcade.html)
 * ===================================================================== */
(function () {
  'use strict';
  var KEY = 'fll_conquistas';
  var GAMES_3D = ['space', 'runner', 'drifter', 'minigolf', 'wildlands'];
  var ARCADE = ['parry', 'aim', 'quiz'];
  var TV_SECONDS = 120;

  // ---------- armazenamento seguro ----------
  var memory = null;
  function load() {
    try {
      var raw = window.localStorage.getItem(KEY);
      var d = raw ? JSON.parse(raw) : null;
      if (d && typeof d === 'object') return norm(d);
    } catch (e) { /* bloqueado ou corrompido */ }
    return memory ? norm(memory) : norm({});
  }
  function norm(d) {
    return { u: obj(d.u), g: obj(d.g), r: obj(d.r), c: obj(d.c), tv: Number(d.tv) > 0 ? Number(d.tv) : 0 };
  }
  function obj(o) { return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; }
  function save(s) {
    memory = s;
    try { window.localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* segue em memória */ }
  }

  // ---------- definição das conquistas ----------
  var count = function (map, ids) { return ids.filter(function (id) { return map[id]; }).length; };
  var DEFS = [
    { id: 'primeiro-jogo', icon: '▶', name: 'Primeiros passos', desc: 'Abra qualquer jogo do Arcade.', test: function (s) { return Object.keys(s.g).length >= 1; } },
    { id: 'explorador-3d', icon: '🧭', name: 'Piloto de testes', desc: 'Experimente 3 dos 5 jogos 3D.', test: function (s) { return count(s.g, GAMES_3D) >= 3; }, prog: function (s) { return [count(s.g, GAMES_3D), 3]; } },
    { id: 'todos-3d', icon: '🎮', name: 'Coleção 3D', desc: 'Abra os 5 jogos 3D.', test: function (s) { return count(s.g, GAMES_3D) >= 5; }, prog: function (s) { return [count(s.g, GAMES_3D), 5]; } },
    { id: 'primeiro-recorde', icon: '🏁', name: 'Primeiro recorde', desc: 'Registre um recorde em qualquer jogo.', test: function (s) { return Object.keys(s.r).length >= 1; } },
    { id: 'recordista', icon: '🏆', name: 'Recordista', desc: 'Tenha recordes em 3 jogos diferentes.', test: function (s) { return Object.keys(s.r).length >= 3; }, prog: function (s) { return [Object.keys(s.r).length, 3]; } },
    { id: 'trio-arcade', icon: '🕹', name: 'Trio do Arcade', desc: 'Registre recorde no Parry, no Aim Trainer e no Boss Quiz.', test: function (s) { return count(s.r, ARCADE) >= 3; }, prog: function (s) { return [count(s.r, ARCADE), 3]; } },
    { id: 'cristais', icon: '💎', name: 'Caçador de cristais', desc: 'Colete 10 cristais no Desert Drifter.', test: function (s) { return (s.c.crystals || 0) >= 10; }, prog: function (s) { return [Math.min(s.c.crystals || 0, 10), 10]; } },
    { id: 'volta', icon: '⏱', name: 'Volta completa', desc: 'Complete uma volta no Desert Drifter.', test: function (s) { return (s.c.laps || 0) >= 1; } },
    { id: 'campo-golf', icon: '⛳', name: 'Curso completo', desc: 'Termine o curso do Galaxy MiniGolf.', test: function (s) { return !!s.r.minigolf; } },
    { id: 'tv-ligada', icon: '📺', name: 'Na telinha', desc: 'Visite a TV 24/7.', test: function (s) { return !!s.g.tv; } },
    { id: 'sessao-cinema', icon: '🎬', name: 'Sessão de cinema', desc: 'Fique 2 minutos com a TV 24/7 aberta.', test: function (s) { return s.tv >= TV_SECONDS; }, prog: function (s) { return [Math.min(Math.floor(s.tv), TV_SECONDS), TV_SECONDS]; } },
  ];
  DEFS.push({ id: 'lenda', icon: '👑', name: 'Lenda do Arcade', desc: 'Desbloqueie todas as outras conquistas.', test: function (s) { return DEFS.every(function (d) { return d.id === 'lenda' || s.u[d.id]; }); }, prog: function (s) { return [DEFS.filter(function (d) { return d.id !== 'lenda' && s.u[d.id]; }).length, DEFS.length - 1]; } });

  var listeners = [];
  function check(s) {
    var fresh = [];
    var changed = true;
    while (changed) { // "lenda" depende das demais
      changed = false;
      DEFS.forEach(function (d) {
        if (!s.u[d.id] && d.test(s)) { s.u[d.id] = new Date().toISOString().slice(0, 10); fresh.push(d); changed = true; }
      });
    }
    return fresh;
  }
  function commit(s, changedData) {
    var fresh = check(s);
    if (changedData || fresh.length) save(s);
    fresh.forEach(function (d) {
      toast(d);
      try { window.dispatchEvent(new CustomEvent('fll:conquista', { detail: { id: d.id, name: d.name } })); } catch (e) {}
      try { if (window.gtag) window.gtag('event', 'unlock_achievement', { achievement_id: d.id }); } catch (e) {}
    });
    if (fresh.length || changedData) listeners.forEach(function (fn) { try { fn(); } catch (e) {} });
  }

  // ---------- eventos ----------
  function play(game) {
    if (!game) return;
    var s = load(); var isNew = !s.g[game];
    if (isNew) s.g[game] = 1;
    commit(s, isNew);
  }
  function record(game, value) {
    if (!game) return;
    var s = load(); var changed = false;
    if (!s.g[game]) { s.g[game] = 1; changed = true; }
    if (value !== 0 && !s.r[game]) { s.r[game] = 1; changed = true; } // recorde 0 não conta
    commit(s, changed);
  }
  function event(name, value) {
    var s = load(); var changed = false;
    if (name === 'crystal') { var n = Math.max(Number(value) || 0, s.c.crystals || 0); if (n !== s.c.crystals) { s.c.crystals = n; changed = true; } }
    if (name === 'lap') { s.c.laps = (s.c.laps || 0) + 1; changed = true; }
    commit(s, changed);
  }

  // TV: soma só o tempo em que a aba está visível
  function watchTV() {
    var last = Date.now(), acc = 0;
    setInterval(function () {
      var now = Date.now(), dt = (now - last) / 1000; last = now;
      if (document.visibilityState !== 'visible' || dt > 5) return;
      var s = load(); if (s.u['sessao-cinema']) return;
      acc += dt;
      if (acc >= 5) { s.tv += acc; acc = 0; commit(s, true); }
    }, 1000);
  }

  // ---------- toast ----------
  var queue = [], showing = false;
  function injectCss() {
    if (document.getElementById('fll-conq-css')) return;
    var st = document.createElement('style'); st.id = 'fll-conq-css';
    st.textContent =
      '.fll-conq-toast{position:fixed;left:50%;top:58px;transform:translate(-50%,-8px);z-index:9999;display:flex;gap:.6rem;align-items:center;max-width:min(92vw,360px);' +
      'padding:.6rem .85rem;border-radius:.7rem;background:#141518;color:#fff;border:1px solid #2b2e35;border-left:3px solid #b31212;box-shadow:0 10px 30px rgba(0,0,0,.5);' +
      'opacity:0;pointer-events:none;font:600 .9rem/1.3 Inter,system-ui,sans-serif}' +
      '.fll-conq-toast.is-on{opacity:1;transform:translate(-50%,0);transition:opacity .25s ease,transform .25s ease}' +
      '.fll-conq-toast small{display:block;color:#a6a6ad;font-weight:400}' +
      '.fll-conq-toast .ic{font-size:1.4rem}' +
      '@media (prefers-reduced-motion:reduce){.fll-conq-toast.is-on{transition:none}}';
    document.head.appendChild(st);
  }
  function toast(d) { queue.push(d); if (!showing) next(); }
  function next() {
    var d = queue.shift(); if (!d) { showing = false; return; }
    showing = true; injectCss();
    var el = document.createElement('div');
    el.className = 'fll-conq-toast'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite');
    var ic = document.createElement('span'); ic.className = 'ic'; ic.setAttribute('aria-hidden', 'true'); ic.textContent = d.icon;
    var tx = document.createElement('span'); tx.textContent = 'Conquista desbloqueada: ' + d.name;
    var sm = document.createElement('small'); sm.textContent = d.desc; tx.appendChild(sm);
    el.appendChild(ic); el.appendChild(tx); document.body.appendChild(el);
    requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add('is-on'); }); });
    setTimeout(function () { el.classList.remove('is-on'); setTimeout(function () { el.remove(); next(); }, 300); }, 3200);
  }

  // ---------- painel (arcade.html) ----------
  function render(host) {
    if (!host) return;
    function draw() {
      var s = load();
      var done = DEFS.filter(function (d) { return s.u[d.id]; }).length, pct = Math.round(done / DEFS.length * 100);
      host.textContent = '';
      var head = el('div', 'ach-head');
      var t = el('p', 'ach-sum'); t.innerHTML = '<strong>' + done + '</strong> de ' + DEFS.length + ' conquistas <span class="meta">(' + pct + '%)</span>';
      var bar = el('div', 'ach-bar'); bar.setAttribute('role', 'progressbar'); bar.setAttribute('aria-valuemin', '0'); bar.setAttribute('aria-valuemax', String(DEFS.length)); bar.setAttribute('aria-valuenow', String(done)); bar.setAttribute('aria-label', 'Progresso das conquistas');
      var fill = el('span'); fill.style.width = pct + '%'; bar.appendChild(fill);
      var reset = el('button', 'btn btn--ghost btn--small'); reset.type = 'button'; reset.textContent = 'Zerar conquistas';
      reset.onclick = function () { if (window.confirm('Zerar as conquistas deste navegador? Os recordes dos jogos não são apagados.')) { api.reset(); } };
      head.appendChild(t); head.appendChild(reset);
      var grid = el('ul', 'ach-grid'); grid.setAttribute('aria-label', 'Lista de conquistas');
      DEFS.forEach(function (d) {
        var on = !!s.u[d.id];
        var li = el('li', 'ach' + (on ? ' is-on' : ''));
        var p = d.prog && !on ? d.prog(s) : null;
        li.innerHTML = '<span class="ach__ic" aria-hidden="true"></span><div><strong class="ach__n"></strong><span class="ach__d"></span><span class="ach__s"></span></div>';
        li.querySelector('.ach__ic').textContent = on ? d.icon : '🔒';
        li.querySelector('.ach__n').textContent = d.name;
        li.querySelector('.ach__d').textContent = d.desc;
        li.querySelector('.ach__s').textContent = on ? 'Desbloqueada em ' + s.u[d.id].split('-').reverse().join('/') : (p ? 'Progresso: ' + p[0] + '/' + p[1] : 'Bloqueada');
        grid.appendChild(li);
      });
      host.appendChild(head); host.appendChild(bar); host.appendChild(grid);
    }
    function el(tag, cls) { var e = document.createElement(tag); if (cls) e.className = cls; return e; }
    draw(); listeners.push(draw);
    window.addEventListener('storage', function (e) { if (e.key === KEY) draw(); });
  }

  var api = {
    DEFS: DEFS, play: play, record: record, event: event, render: render, watchTV: watchTV,
    state: load,
    unlocked: function () { var s = load(); return DEFS.filter(function (d) { return s.u[d.id]; }).map(function (d) { return d.id; }); },
    reset: function () { memory = null; try { window.localStorage.removeItem(KEY); } catch (e) {} listeners.forEach(function (fn) { try { fn(); } catch (e) {} }); },
    onChange: function (fn) { listeners.push(fn); },
  };
  window.FlloydConquistas = api;

  // registro automático pelo atributo data-game do <script>
  var me = document.currentScript;
  var game = me && me.getAttribute('data-game');
  if (game) {
    var go = function () { play(game); if (game === 'tv') watchTV(); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
  }
})();

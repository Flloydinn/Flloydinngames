/* Armazenamento seguro do Flloydinn.
 * Envolve o localStorage em try/catch (modo privado, política do navegador, cota cheia) e,
 * se ele estiver bloqueado, guarda os valores em memória enquanto a página estiver aberta.
 * Mesma assinatura do localStorage: FlloydStore.get(k) / set(k, v) / remove(k).
 * Precisa ser carregado antes dos scripts da página que o usam. */
(function () {
  var mem = {};
  function ls() { try { return window.localStorage; } catch (e) { return null; } }
  window.FlloydStore = {
    get: function (k) {
      try { var s = ls(); if (s) { var v = s.getItem(k); if (v !== null) return v; } } catch (e) {}
      return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null;
    },
    set: function (k, v) {
      v = String(v);
      try { var s = ls(); if (s) { s.setItem(k, v); delete mem[k]; return; } } catch (e) {}
      mem[k] = v;
    },
    remove: function (k) {
      delete mem[k];
      try { var s = ls(); if (s) s.removeItem(k); } catch (e) {}
    }
  };
})();

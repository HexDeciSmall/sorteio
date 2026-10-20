(function (root, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.RouletteCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  var MAX = { friends: 100, cards: 100, anime: 200, history: 300 };
  var FRIEND_DEFAULTS = ['Hex', 'KV', 'Cap', 'Nando', 'Turbo', 'Mary', 'Kris'];
  var LEGACY_FRIENDS = ['Lucas', 'Ana', 'Pedro', 'Marina', 'Rafael'];
  var ANIME_DEFAULTS = [
    'Fullmetal Alchemist: Brotherhood', 'Death Note', 'Haikyuu!!', 'Violet Evergarden',
    'Mob Psycho 100', 'Steins;Gate', 'Cowboy Bebop', 'Fruits Basket', 'Samurai Champloo', 'One Punch Man'
  ];
  var own = function (value, key) { return Object.prototype.hasOwnProperty.call(value, key); };
  var fail = function (message) { throw new Error(message); };

  function uid() {
    if (root.crypto && typeof root.crypto.randomUUID === 'function') return root.crypto.randomUUID();
    var bytes = new Uint8Array(12);
    if (root.crypto && typeof root.crypto.getRandomValues === 'function') {
      root.crypto.getRandomValues(bytes);
    } else {
      for (var i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    return 'r_' + Date.now().toString(36) + '_' + Array.from(bytes, function (n) {
      return n.toString(16).padStart(2, '0');
    }).join('');
  }

  function createState() {
    var friends = FRIEND_DEFAULTS.map(function (name) {
      return { id: uid(), name: name };
    });
    var cardSeeds = [
      ['Sem efeito', 'Assista ao anime sorteado normalmente.'],
      ['Episódio extra', 'Assista a um episódio a mais do que o combinado pelo grupo.'],
      ['Maratona', 'Combine com o grupo uma sessão com mais episódios.'],
      ['Vale troca', 'Você pode pedir uma troca de anime ao grupo.'],
      ['Modo crítico', 'Compartilhe com o grupo sua opinião sobre o anime da semana.'],
      ['Sem spoilers', 'Comente suas impressões sem revelar acontecimentos da história.']
    ];
    return {
      version: 1,
      friends: friends,
      cards: cardSeeds.map(function (seed) { return { id: uid(), name: seed[0], description: seed[1] }; }),
      anime: ANIME_DEFAULTS.map(function (name) { return { id: uid(), name: name, ownerId: null }; }),
      settings: { avoidFriends: true, avoidAnime: true, sound: true },
      used: { friends: [], anime: [] },
      current: { friend: null, card: null, anime: null },
      history: [],
      cycleRoundIds: []
    };
  }

  function migrateDefaults(state) {
    if (!state) return false;
    var changed = false;
    if (state.settings) {
      ['avoidFriends', 'avoidAnime'].forEach(function (key) {
        if (state.settings[key] === false) { state.settings[key] = true; changed = true; }
      });
    }
    if (!Array.isArray(state.friends) || !Array.isArray(state.anime) || state.friends.length !== LEGACY_FRIENDS.length || state.anime.length !== ANIME_DEFAULTS.length) return changed;
    if (!state.friends.every(function (friend, i) { return friend && friend.name === LEGACY_FRIENDS[i]; })) return changed;
    if (state.friends.some(function (friend) { return own(friend, 'anilistUsername') && friend.anilistUsername !== null; })) return changed;
    if (!state.anime.every(function (anime, i) { return anime && anime.name === ANIME_DEFAULTS[i] && anime.ownerId === state.friends[Math.floor(i / 2)].id; })) return changed;
    state.friends = FRIEND_DEFAULTS.map(function (name) { return { id: uid(), name: name }; });
    state.anime.forEach(function (anime) { anime.ownerId = null; });
    state.used.friends = [];
    state.current.friend = null;
    if (state.current.anime) state.current.anime = Object.assign({}, state.current.anime, { ownerId: null });
    return true;
  }

  function object(value, label) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail(label + ' deve ser um objeto.');
    var proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) fail(label + ' possui um formato inválido.');
    return value;
  }

  function field(value, key, label) {
    if (!own(value, key)) fail('Campo obrigatório ausente: ' + label + '.');
    return value[key];
  }

  function string(value, limit, label, allowEmpty) {
    if (typeof value !== 'string') fail(label + ' deve ser um texto.');
    var result = value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim();
    if (!allowEmpty && !result) fail(label + ' não pode ficar vazio.');
    if (result.length > limit) fail(label + ' deve ter no máximo ' + limit + ' caracteres.');
    return result;
  }

  function id(value, label) {
    if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(value)) fail(label + ' possui um identificador inválido.');
    return value;
  }

  function list(value, limit, label) {
    if (!Array.isArray(value)) fail(label + ' deve ser uma lista.');
    if (value.length > limit) fail(label + ' permite no máximo ' + limit + ' itens.');
    return value;
  }

  function normalizeAniListProfile(value) {
    if (value === null || value === undefined) return null;
    if (typeof value !== 'string') fail('O perfil do AniList deve ser um nome de usuário ou link.');
    var username = value.trim();
    if (!username) return null;
    if (username.length > 2048 || /[\u0000-\u001f\u007f]/.test(username)) fail('O perfil do AniList possui um formato inválido.');
    if (/^https:\/\//i.test(username)) {
      var url;
      try { url = new URL(username); } catch (error) { fail('O link do perfil do AniList é inválido.'); }
      if (url.protocol !== 'https:' || url.hostname !== 'anilist.co' || url.username || url.password || url.port) fail('Use um link HTTPS do domínio anilist.co para o perfil.');
      var path = url.pathname.match(/^\/(?:user\/([^/]+)(?:\/animelist)?|animelist\/([^/]+))\/?$/);
      if (!path) fail('Use o link do perfil ou da lista de animes do usuário no AniList.');
      try { username = decodeURIComponent(path[1] || path[2]); } catch (error) { fail('O nome de usuário do AniList no link é inválido.'); }
    }
    if (!/^[A-Za-z0-9_-]{1,60}$/.test(username)) fail('O usuário do AniList deve ter até 60 letras, números, hífens ou sublinhados, sem espaços.');
    return username;
  }

  function normalizeAnimeMetadata(value) {
    object(value, 'Os dados do anime');
    var malId = value.malId === undefined || value.malId === null ? null : value.malId;
    if (malId !== null && (!Number.isSafeInteger(malId) || malId < 1)) fail('O identificador do MyAnimeList deve ser um inteiro positivo.');
    var malScore = value.malScore === undefined || value.malScore === null ? null : value.malScore;
    if (malScore !== null && (typeof malScore !== 'number' || !Number.isFinite(malScore) || malScore < 0 || malScore > 10)) fail('A nota do MyAnimeList deve ser um número entre 0 e 10.');
    var coverUrl = null;
    if (value.coverUrl !== undefined && value.coverUrl !== null) {
      if (typeof value.coverUrl !== 'string') fail('O link da capa do anime deve ser um texto ou nulo.');
      var rawUrl = value.coverUrl.trim();
      if (!rawUrl || rawUrl.length > 2048 || /[\u0000-\u0020\u007f]/.test(rawUrl)) fail('O link da capa do anime é inválido.');
      var url;
      try { url = new URL(rawUrl); } catch (error) { fail('O link da capa do anime é inválido.'); }
      if (url.protocol !== 'https:' || url.hostname !== 'cdn.myanimelist.net' || url.username || url.password || url.port) fail('A capa deve usar um link HTTPS do domínio cdn.myanimelist.net.');
      url.hash = '';
      coverUrl = url.href;
    }
    return { malId: malId, coverUrl: coverUrl, malScore: malScore, malUrl: malId === null ? null : 'https://myanimelist.net/anime/' + malId };
  }

  function entry(value, type, label) {
    object(value, label);
    var result = {
      id: id(field(value, 'id', label + '.id'), label),
      name: string(field(value, 'name', label + '.name'), type === 'anime' ? 200 : 80, label + ': nome', false)
    };
    if (type === 'friends' && own(value, 'anilistUsername')) result.anilistUsername = normalizeAniListProfile(value.anilistUsername);
    if (type === 'cards') result.description = string(field(value, 'description', label + '.description'), 300, label + ': descrição', true);
    if (type === 'anime') {
      var ownerId = field(value, 'ownerId', label + '.ownerId');
      result.ownerId = ownerId === null ? null : id(ownerId, label + ': indicação');
      if (['malId', 'coverUrl', 'malScore', 'malUrl'].some(function (key) { return own(value, key); })) Object.assign(result, normalizeAnimeMetadata(value));
    }
    return result;
  }

  function unique(entries, label) {
    var seen = new Set();
    entries.forEach(function (item) {
      if (seen.has(item.id)) fail(label + ' contém identificadores repetidos.');
      seen.add(item.id);
    });
    return seen;
  }

  function normalizeState(input) {
    object(input, 'O arquivo');
    if (field(input, 'version', 'version') !== 1) fail('Versão de arquivo incompatível. Use uma exportação da versão 1.');
    var state = { version: 1 };
    var labels = { friends: 'Amigos', cards: 'Cartas', anime: 'Animes' };
    var ids = {};
    ['friends', 'cards', 'anime'].forEach(function (key) {
      state[key] = list(field(input, key, key), MAX[key], labels[key]).map(function (item, i) {
        return entry(item, key, labels[key] + ' — item ' + (i + 1));
      });
      ids[key] = unique(state[key], labels[key]);
      var names = new Set();
      state[key].forEach(function (item) {
        var name = item.name.normalize('NFC').replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
        if (names.has(name)) fail(labels[key] + ' contém nomes repetidos. Remova a duplicata para manter chances iguais.');
        names.add(name);
      });
    });
    var ownerCounts = new Map();
    var malIds = new Set();
    state.anime.forEach(function (item) {
      if (item.malId !== undefined && item.malId !== null) {
        if (malIds.has(item.malId)) fail('A lista contém o mesmo anime do MyAnimeList mais de uma vez.');
        malIds.add(item.malId);
      }
      if (item.ownerId !== null && !ids.friends.has(item.ownerId)) fail('O anime "' + item.name + '" está vinculado a um amigo que não existe.');
      if (item.ownerId !== null) {
        var count = (ownerCounts.get(item.ownerId) || 0) + 1;
        if (count > 2) fail('Cada amigo pode indicar no máximo 2 animes.');
        ownerCounts.set(item.ownerId, count);
      }
    });
    var settings = object(field(input, 'settings', 'settings'), 'Configurações');
    state.settings = {};
    ['avoidFriends', 'avoidAnime', 'sound'].forEach(function (key) {
      var value = field(settings, key, 'settings.' + key);
      if (typeof value !== 'boolean') fail('A configuração ' + key + ' deve ser verdadeira ou falsa.');
      state.settings[key] = value;
    });
    state.settings.avoidFriends = true;
    state.settings.avoidAnime = true;
    var used = object(field(input, 'used', 'used'), 'Itens já sorteados');
    state.used = {};
    ['friends', 'anime'].forEach(function (key) {
      var seen = new Set();
      state.used[key] = list(field(used, key, 'used.' + key), MAX[key], 'Itens já sorteados: ' + labels[key]).map(function (value) {
        id(value, 'Item já sorteado');
        if (!ids[key].has(value)) fail('A lista de ' + labels[key].toLowerCase() + ' já sorteados contém um item que não existe.');
        if (seen.has(value)) fail('A lista de itens já sorteados contém identificadores repetidos.');
        seen.add(value);
        return value;
      });
    });
    state.history = list(field(input, 'history', 'history'), MAX.history, 'Histórico').map(function (value, i) {
      var label = 'Histórico — rodada ' + (i + 1);
      object(value, label);
      var at = string(field(value, 'at', label + '.at'), 40, label + ': data', false);
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(at) || !Number.isFinite(Date.parse(at))) fail(label + ' possui uma data inválida.');
      return {
        id: id(field(value, 'id', label + '.id'), label),
        at: new Date(at).toISOString(),
        friend: entry(field(value, 'friend', label + '.friend'), 'friends', label + ': amigo'),
        card: entry(field(value, 'card', label + '.card'), 'cards', label + ': carta'),
        anime: entry(field(value, 'anime', label + '.anime'), 'anime', label + ': anime')
      };
    });
    var historyIds = unique(state.history, 'Histórico');
    if (own(input, 'cycleRoundIds')) {
      var cycleIds = new Set();
      state.cycleRoundIds = list(input.cycleRoundIds, MAX.history, 'Resultados deste ciclo').map(function (value) {
        id(value, 'Resultado deste ciclo');
        if (!historyIds.has(value)) fail('Os resultados deste ciclo contêm uma rodada que não existe no histórico.');
        if (cycleIds.has(value)) fail('Os resultados deste ciclo contêm rodadas repetidas.');
        cycleIds.add(value);
        return value;
      });
      var cycleFriends = new Set();
      var cycleAnime = new Set();
      state.history.forEach(function (record) {
        if (!cycleIds.has(record.id)) return;
        if (cycleFriends.has(record.friend.id) || cycleAnime.has(record.anime.id)) fail('Os resultados deste ciclo repetem um amigo ou anime.');
        cycleFriends.add(record.friend.id);
        cycleAnime.add(record.anime.id);
      });
    } else {
      state.cycleRoundIds = inferCycleRoundIds(state);
    }
    cycleRecords(state).forEach(function (record) {
      [['friends', record.friend.id], ['anime', record.anime.id]].forEach(function (pair) {
        if (ids[pair[0]].has(pair[1]) && !state.used[pair[0]].includes(pair[1])) state.used[pair[0]].push(pair[1]);
      });
    });
    var current = object(field(input, 'current', 'current'), 'Sorteio atual');
    state.current = {};
    [['friend', 'friends'], ['card', 'cards'], ['anime', 'anime']].forEach(function (pair) {
      var value = field(current, pair[0], 'current.' + pair[0]);
      if (value === null) { state.current[pair[0]] = null; return; }
      var choice = entry(value, pair[1], 'Sorteio atual: ' + pair[0]);
      var original = state[pair[1]].find(function (item) { return item.id === choice.id; });
      if (!original) fail('O sorteio atual contém um item que não existe mais.');
      if (!available(state, pair[1]).some(function (item) { return item.id === choice.id; })) {
        var legacyRepeatAllowed = !own(input, 'cycleRoundIds') && ((pair[1] === 'friends' && settings.avoidFriends === false) || (pair[1] === 'anime' && settings.avoidAnime === false));
        if (!legacyRepeatAllowed) fail('O sorteio atual contém uma opção que já participou deste ciclo.');
        state.current[pair[0]] = null;
        return;
      }
      state.current[pair[0]] = Object.assign({}, original);
    });
    return state;
  }

  function inferCycleRoundIds(state) {
    var friends = new Set(state.used.friends);
    var anime = new Set(state.used.anime);
    var seenFriends = new Set();
    var seenAnime = new Set();
    var result = [];
    for (var i = state.history.length - 1; i >= 0; i--) {
      var record = state.history[i];
      if (!friends.has(record.friend.id) || !anime.has(record.anime.id) || seenFriends.has(record.friend.id) || seenAnime.has(record.anime.id)) continue;
      result.push(record.id);
      seenFriends.add(record.friend.id);
      seenAnime.add(record.anime.id);
    }
    return result.reverse();
  }

  function cycleRecords(state) {
    var ids = new Set(state.cycleRoundIds || inferCycleRoundIds(state));
    return state.history.filter(function (record) { return ids.has(record.id); });
  }

  function available(state, key) {
    if (!['friends', 'cards', 'anime'].includes(key)) fail('Roleta inválida.');
    if (key === 'cards') return state.cards.slice();
    var used = new Set(state.used[key]);
    return state[key].filter(function (item) { return !used.has(item.id); });
  }

  function secureIndex(length) {
    if (!Number.isInteger(length) || length < 1 || length > 4294967296) fail('A quantidade de opções deve ser um inteiro positivo.');
    if (root.crypto && typeof root.crypto.getRandomValues === 'function') {
      var buffer = new Uint32Array(1);
      var limit = 4294967296 - (4294967296 % length);
      do { root.crypto.getRandomValues(buffer); } while (buffer[0] >= limit);
      return buffer[0] % length;
    }
    return Math.floor(Math.random() * length);
  }

  function pick(state, key, excludedId) {
    var pool = available(state, key);
    if (excludedId !== undefined && excludedId !== null) pool = pool.filter(function (item) { return item.id !== excludedId; });
    return pool.length ? pool[secureIndex(pool.length)] : null;
  }

  function rejectAnime(state) {
    if (!state.current.anime) return null;
    var rejected = Object.assign({}, state.current.anime);
    state.current.anime = null;
    return rejected;
  }

  function clearCurrent(state) {
    state.current = { friend: null, card: null, anime: null };
  }

  function commitRound(state) {
    var selections = {};
    [['friend', 'friends'], ['card', 'cards'], ['anime', 'anime']].forEach(function (pair) {
      var choice = state.current[pair[0]];
      if (!choice || typeof choice.id !== 'string') fail('Gire as três roletas antes de salvar a rodada.');
      var original = state[pair[1]].find(function (item) { return item.id === choice.id; });
      if (!original) fail('Uma opção sorteada foi removida. Faça um novo sorteio.');
      if (!available(state, pair[1]).some(function (item) { return item.id === choice.id; })) fail('Uma opção sorteada já participou deste ciclo. Faça um novo sorteio.');
      selections[pair[0]] = Object.assign({}, original);
    });
    var record = { id: uid(), at: new Date().toISOString(), friend: selections.friend, card: selections.card, anime: selections.anime };
    var cycleIds = state.cycleRoundIds || inferCycleRoundIds(state);
    state.history.push(record);
    cycleIds.push(record.id);
    if (state.history.length > MAX.history) state.history.splice(0, state.history.length - MAX.history);
    var historyIds = new Set(state.history.map(function (item) { return item.id; }));
    state.cycleRoundIds = cycleIds.filter(function (value) { return historyIds.has(value); });
    if (!state.used.friends.includes(selections.friend.id)) state.used.friends.push(selections.friend.id);
    if (!state.used.anime.includes(selections.anime.id)) state.used.anime.push(selections.anime.id);
    clearCurrent(state);
    return record;
  }

  function removeRound(state, recordId) {
    var activeIds = state.cycleRoundIds || inferCycleRoundIds(state);
    if (!activeIds.includes(recordId)) return null;
    var record = state.history.find(function (item) { return item.id === recordId; });
    if (!record) return null;
    state.history = state.history.filter(function (item) { return item.id !== recordId; });
    state.cycleRoundIds = activeIds.filter(function (value) { return value !== recordId; });
    var remaining = cycleRecords(state);
    [['friends', 'friend'], ['anime', 'anime']].forEach(function (pair) {
      var removedId = record[pair[1]].id;
      if (!remaining.some(function (item) { return item[pair[1]].id === removedId; })) {
        state.used[pair[0]] = state.used[pair[0]].filter(function (value) { return value !== removedId; });
      }
    });
    return record;
  }

  function resetCycle(state) {
    state.used = { friends: [], anime: [] };
    state.cycleRoundIds = [];
    clearCurrent(state);
  }

  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, function (character) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
    });
  }

  function wheelTarget(currentDegrees, index, count, turns) {
    if (turns === undefined) turns = 5;
    if (!Number.isFinite(currentDegrees) || !Number.isInteger(count) || count < 1 || !Number.isInteger(index) || index < 0 || index >= count || !Number.isInteger(turns) || turns < 0) fail('Parâmetros de rotação inválidos.');
    var modulo = function (value) { return ((value % 360) + 360) % 360; };
    var target = modulo(-(index + 0.5) * 360 / count);
    return currentDegrees + turns * 360 + modulo(target - modulo(currentDegrees));
  }

  return { uid: uid, createState: createState, migrateDefaults: migrateDefaults, normalizeState: normalizeState, normalizeAniListProfile: normalizeAniListProfile, normalizeAnimeMetadata: normalizeAnimeMetadata, available: available, secureIndex: secureIndex, pick: pick, rejectAnime: rejectAnime, commitRound: commitRound, removeRound: removeRound, cycleRecords: cycleRecords, clearCurrent: clearCurrent, resetCycle: resetCycle, escapeHtml: escapeHtml, wheelTarget: wheelTarget };
});

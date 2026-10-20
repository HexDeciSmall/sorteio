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
  var CARD_DEFAULTS = [
    ['Sem efeito', 'Assista ao anime sorteado normalmente.'],
    ['Episódio extra', 'Assista a um episódio a mais do que o combinado pelo grupo.'],
    ['Maratona', 'Combine com o grupo uma sessão com mais episódios.'],
    ['Vale troca', 'Você pode pedir uma troca de anime ao grupo.'],
    ['Modo crítico', 'Compartilhe com o grupo sua opinião sobre o anime da semana.'],
    ['Sem spoilers', 'Comente suas impressões sem revelar acontecimentos da história.']
  ];
  var EFFECT_TYPES = ['none', 'remove_anime', 'remove_owner', 'infernal'];
  var STANDARD_CARDS = [
    { name: 'Nem a Pau', description: 'Pode remover um anime na sua vez.', effect: 'remove_anime' },
    { name: 'Preconceito', description: 'Remove as indicações de um colega na sua vez.', effect: 'remove_owner' },
    { name: 'Sem Efeito', description: 'Nada Acontece', effect: 'none' },
    { name: 'Sem Efeito', description: 'Nada Acontece', effect: 'none' },
    { name: 'Sem Efeito', description: 'Nada Acontece', effect: 'none' },
    { name: 'Sem Efeito', description: 'Nada Acontece', effect: 'none' },
    { name: 'Infernizar', description: 'Adiciona Hand Shakers, Gamers, Rent a Girlfriend e Terra Formars assim que seu anime for decidido.', effect: 'infernal' }
  ];
  var INFERNAL_ANIME = [
    { name: 'Hand Shakers', malId: 32981, coverUrl: 'https://cdn.myanimelist.net/images/anime/7/83395.jpg', malScore: 5.23, aliases: ['Hand Shakers'] },
    { name: 'Gamers', malId: 34280, coverUrl: 'https://cdn.myanimelist.net/images/anime/4/86828.jpg', malScore: 6.72, aliases: ['Gamers', 'Gamers!'] },
    { name: 'Rent a Girlfriend', malId: 40839, coverUrl: 'https://cdn.myanimelist.net/images/anime/1902/128382.jpg', malScore: 6.8, aliases: ['Rent a Girlfriend', 'Rent-a-Girlfriend', 'Kanojo, Okarishimasu', 'Kanojo Okarishimasu'] },
    { name: 'Terra Formars', malId: 22687, coverUrl: 'https://cdn.myanimelist.net/images/anime/2/67117.jpg', malScore: 6.98, aliases: ['Terra Formars'] }
  ];
  INFERNAL_ANIME.forEach(function (anime) { Object.freeze(anime.aliases); Object.freeze(anime); });
  Object.freeze(INFERNAL_ANIME);
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
    return {
      version: 1,
      friends: friends,
      cards: STANDARD_CARDS.map(function (card) { return Object.assign({ id: uid() }, card); }),
      anime: [],
      settings: { avoidFriends: true, avoidAnime: true, sound: true },
      used: { friends: [], anime: [] },
      current: { friend: null, card: null, anime: null },
      history: [],
      cycleRoundIds: [],
      cardDefaultsVersion: 1,
      turnEffect: emptyTurnEffect()
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
    if (!Array.isArray(state.friends) || !Array.isArray(state.cards) || !Array.isArray(state.anime)) return changed;
    var hasProfiles = state.friends.some(function (friend) { return friend && friend.anilistUsername !== undefined && friend.anilistUsername !== null; });
    var legacyNames = state.friends.length === LEGACY_FRIENDS.length && state.friends.every(function (friend, i) { return friend && friend.name === LEGACY_FRIENDS[i]; });
    var animeNames = state.anime.length === ANIME_DEFAULTS.length && state.anime.every(function (anime, i) { return anime && anime.name === ANIME_DEFAULTS[i]; });
    var hasMetadata = state.anime.some(function (anime) { return anime && ['malId', 'coverUrl', 'malScore', 'malUrl'].some(function (key) { return own(anime, key); }); });
    var legacyOwners = legacyNames && animeNames && state.anime.every(function (anime, i) { return anime.ownerId === state.friends[Math.floor(i / 2)].id; });
    if (legacyOwners && !hasProfiles && !hasMetadata) {
      state.friends = FRIEND_DEFAULTS.map(function (name) { return { id: uid(), name: name }; });
      state.used.friends = [];
      state.current.friend = null;
      changed = true;
    }
    if (animeNames && !hasMetadata && ((!hasProfiles && legacyOwners) || state.anime.every(function (anime) { return anime.ownerId === null; }))) {
      var animeIds = new Set(state.anime.map(function (anime) { return anime.id; }));
      state.anime = [];
      state.used.anime = state.used.anime.filter(function (value) { return !animeIds.has(value); });
      if (state.current.anime && animeIds.has(state.current.anime.id)) state.current.anime = null;
      changed = true;
    }
    if (state.cards.length === CARD_DEFAULTS.length && state.cards.every(function (card, i) { return card && card.name === CARD_DEFAULTS[i][0] && card.description === CARD_DEFAULTS[i][1] && (!card.effect || card.effect === 'none'); })) {
      var cardIds = new Set(state.cards.map(function (card) { return card.id; }));
      state.cards = [];
      if (state.current.card && cardIds.has(state.current.card.id)) state.current.card = null;
      changed = true;
    }
    if (state.cardDefaultsVersion !== 1) {
      if (!state.cards.length) addStandardCards(state);
      state.cardDefaultsVersion = 1;
      changed = true;
    }
    if (changed) prepareTurnEffect(state);
    return changed;
  }

  function normalizedName(value) {
    return value.normalize('NFC').replace(/\s+/g, ' ').trim().toLocaleLowerCase('pt-BR');
  }

  function addStandardCards(state) {
    var existing = new Map();
    state.cards.forEach(function (card) {
      var key = normalizedName(card.name) + ':' + cardEffect(card);
      existing.set(key, (existing.get(key) || 0) + 1);
    });
    var needed = new Map();
    var additions = STANDARD_CARDS.filter(function (card) {
      var key = normalizedName(card.name) + ':' + card.effect;
      var count = (needed.get(key) || 0) + 1;
      needed.set(key, count);
      return count > (existing.get(key) || 0);
    });
    if (state.cards.length + additions.length > MAX.cards) fail('Não há espaço para adicionar as cartas padrão. O limite é de 100 cartas.');
    additions.forEach(function (card) { state.cards.push(Object.assign({ id: uid() }, card)); });
    state.cardDefaultsVersion = 1;
    return additions.length;
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
    if (type === 'cards') {
      result.description = string(field(value, 'description', label + '.description'), 300, label + ': descrição', true);
      result.effect = own(value, 'effect') ? value.effect : 'none';
      if (!EFFECT_TYPES.includes(result.effect)) fail(label + ': efeito de carta inválido.');
    }
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
    state.cardDefaultsVersion = own(input, 'cardDefaultsVersion') ? input.cardDefaultsVersion : 0;
    if (state.cardDefaultsVersion !== 0 && state.cardDefaultsVersion !== 1) fail('Versão de cartas padrão inválida.');
    var labels = { friends: 'Amigos', cards: 'Cartas', anime: 'Animes' };
    var ids = {};
    ['friends', 'cards', 'anime'].forEach(function (key) {
      state[key] = list(field(input, key, key), MAX[key], labels[key]).map(function (item, i) {
        return entry(item, key, labels[key] + ' — item ' + (i + 1));
      });
      ids[key] = unique(state[key], labels[key]);
      var names = new Set();
      state[key].forEach(function (item) {
        var name = normalizedName(item.name);
        if (key !== 'cards' && names.has(name)) fail(labels[key] + ' contém nomes repetidos. Remova a duplicata para manter chances iguais.');
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
      var record = {
        id: id(field(value, 'id', label + '.id'), label),
        at: new Date(at).toISOString(),
        friend: entry(field(value, 'friend', label + '.friend'), 'friends', label + ': amigo'),
        card: entry(field(value, 'card', label + '.card'), 'cards', label + ': carta'),
        anime: entry(field(value, 'anime', label + '.anime'), 'anime', label + ': anime')
      };
      if (own(value, 'addedInfernalAnime')) {
        if (record.card.effect !== 'infernal') fail(label + ': adições de Infernizar exigem a carta correspondente.');
        record.addedInfernalAnime = list(value.addedInfernalAnime, 4, label + ': animes adicionados').map(function (anime) {
          var added = entry(anime, 'anime', label + ': anime adicionado');
          if (added.ownerId !== null || !INFERNAL_ANIME.some(function (seed) { return seed.malId === added.malId; })) fail(label + ': anime adicionado por Infernizar inválido.');
          return added;
        });
        unique(record.addedInfernalAnime, label + ': animes adicionados');
      }
      return record;
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
      if (!baseAvailable(state, pair[1]).some(function (item) { return item.id === choice.id; })) {
        var legacyRepeatAllowed = !own(input, 'cycleRoundIds') && ((pair[1] === 'friends' && settings.avoidFriends === false) || (pair[1] === 'anime' && settings.avoidAnime === false));
        if (!legacyRepeatAllowed) fail('O sorteio atual contém uma opção que já participou deste ciclo.');
        state.current[pair[0]] = null;
        return;
      }
      state.current[pair[0]] = Object.assign({}, original);
    });
    state.turnEffect = emptyTurnEffect();
    if (own(input, 'turnEffect')) {
      var turn = object(input.turnEffect, 'Efeito desta vez');
      var cardId = field(turn, 'cardId', 'turnEffect.cardId');
      var friendId = field(turn, 'friendId', 'turnEffect.friendId');
      var resolved = field(turn, 'resolved', 'turnEffect.resolved');
      if (typeof resolved !== 'boolean') fail('A resolução do efeito deve ser verdadeira ou falsa.');
      var turnType = own(turn, 'type') ? turn.type : cardEffect(state.current.card);
      if (!EFFECT_TYPES.includes(turnType)) fail('O efeito desta vez é inválido.');
      var excluded = list(field(turn, 'excludedAnimeIds', 'turnEffect.excludedAnimeIds'), MAX.anime, 'Exclusões desta vez').map(function (value) { return id(value, 'Anime excluído desta vez'); });
      if (new Set(excluded).size !== excluded.length) fail('As exclusões desta vez contêm animes repetidos.');
      if (!resolved && excluded.length) fail('Um efeito pendente não pode excluir animes.');
      state.turnEffect = { cardId: cardId === null ? null : id(cardId, 'Carta do efeito'), friendId: friendId === null ? null : id(friendId, 'Amigo do efeito'), type: turnType, resolved: resolved, excludedAnimeIds: excluded };
    }
    prepareTurnEffect(state);
    if (state.current.anime && effectInfo(state).excludedAnimeIds.includes(state.current.anime.id)) state.current.anime = null;
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

  function baseAvailable(state, key) {
    if (!['friends', 'cards', 'anime'].includes(key)) fail('Roleta inválida.');
    if (key === 'cards') return state.cards.slice();
    var used = new Set(state.used[key]);
    return state[key].filter(function (item) { return !used.has(item.id); });
  }

  function emptyTurnEffect() {
    return { cardId: null, friendId: null, type: 'none', resolved: false, excludedAnimeIds: [] };
  }

  function cardEffect(card) {
    var type = card && card.effect !== undefined ? card.effect : 'none';
    if (!EFFECT_TYPES.includes(type)) fail('Efeito de carta inválido.');
    return type;
  }

  function turnContext(state) {
    var current = state.current || {};
    return {
      friend: current.friend && state.friends.find(function (item) { return item.id === current.friend.id; }),
      card: current.card && state.cards.find(function (item) { return item.id === current.card.id; })
    };
  }

  function preparedTurnEffect(state) {
    var context = turnContext(state);
    if (!context.friend || !context.card) return emptyTurnEffect();
    var type = cardEffect(context.card);
    var previous = state.turnEffect || emptyTurnEffect();
    var matches = previous.cardId === context.card.id && previous.friendId === context.friend.id && previous.type === type;
    var automatic = type === 'none' || type === 'infernal';
    var result = { cardId: context.card.id, friendId: context.friend.id, type: type, resolved: automatic || (matches && previous.resolved === true), excludedAnimeIds: [] };
    if (automatic || !matches || !result.resolved) return result;
    var pool = baseAvailable(state, 'anime');
    var ids = new Set(pool.map(function (item) { return item.id; }));
    result.excludedAnimeIds = (previous.excludedAnimeIds || []).filter(function (value) { return ids.has(value); });
    var invalidOwner = false;
    if (type === 'remove_owner' && result.excludedAnimeIds.length) {
      var excludedIds = new Set(result.excludedAnimeIds);
      var excludedAnime = pool.filter(function (anime) { return excludedIds.has(anime.id); });
      var owner = excludedAnime[0].ownerId;
      invalidOwner = owner === null || !state.friends.some(function (friend) { return friend.id === owner; }) || excludedAnime.some(function (anime) { return anime.ownerId !== owner; }) || pool.some(function (anime) { return anime.ownerId === owner && !excludedIds.has(anime.id); });
    }
    if (invalidOwner || (type === 'remove_anime' && result.excludedAnimeIds.length > 1) || (pool.length && result.excludedAnimeIds.length >= pool.length)) {
      result.resolved = false;
      result.excludedAnimeIds = [];
    }
    return result;
  }

  function effectInfo(state) {
    var turn = preparedTurnEffect(state);
    return { type: turn.type, pending: turn.cardId !== null && !turn.resolved, excludedAnimeIds: turn.excludedAnimeIds.slice() };
  }

  function prepareTurnEffect(state) {
    state.turnEffect = preparedTurnEffect(state);
    if (state.current.anime && state.turnEffect.excludedAnimeIds.includes(state.current.anime.id)) state.current.anime = null;
    return effectInfo(state);
  }

  function applyTurnEffect(state, targetId) {
    var turn = preparedTurnEffect(state);
    if (!turn.cardId || !turn.friendId || (turn.type !== 'remove_anime' && turn.type !== 'remove_owner')) fail('Esta vez não possui um efeito de remoção pendente.');
    if (turn.resolved) fail('O efeito desta carta já foi usado nesta vez.');
    var excluded = [];
    if (targetId !== null) {
      id(targetId, 'Alvo do efeito');
      var pool = baseAvailable(state, 'anime');
      if (turn.type === 'remove_anime') {
        if (!pool.some(function (item) { return item.id === targetId; })) fail('Escolha um anime disponível para remover nesta vez.');
        excluded = [targetId];
      } else {
        if (!state.friends.some(function (friend) { return friend.id === targetId; })) fail('Escolha um colega que possui indicações disponíveis.');
        excluded = pool.filter(function (item) { return item.ownerId === targetId; }).map(function (item) { return item.id; });
        if (!excluded.length) fail('Esse colega não possui indicações disponíveis nesta vez.');
      }
      if (pool.length - excluded.length < 1) fail('O efeito não pode remover a última opção de anime disponível.');
    }
    turn.resolved = true;
    turn.excludedAnimeIds = excluded;
    state.turnEffect = turn;
    if (state.current.anime && excluded.includes(state.current.anime.id)) state.current.anime = null;
    return effectInfo(state);
  }

  function available(state, key) {
    var pool = baseAvailable(state, key);
    if (key !== 'anime') return pool;
    var excluded = new Set(effectInfo(state).excludedAnimeIds);
    return pool.filter(function (item) { return !excluded.has(item.id); });
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
    state.turnEffect = emptyTurnEffect();
  }

  function aliasKey(value) {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]/g, '');
  }

  function infernalAdditions(state) {
    return INFERNAL_ANIME.filter(function (seed) {
      var aliases = new Set(seed.aliases.map(aliasKey));
      return !state.anime.some(function (anime) { return anime.malId === seed.malId || aliases.has(aliasKey(anime.name)); });
    }).map(function (seed) {
      return Object.assign({ id: uid(), name: seed.name, ownerId: null }, normalizeAnimeMetadata(seed));
    });
  }

  function commitRound(state) {
    if (effectInfo(state).pending) fail('Resolva o efeito da carta antes de confirmar o anime.');
    var selections = {};
    [['friend', 'friends'], ['card', 'cards'], ['anime', 'anime']].forEach(function (pair) {
      var choice = state.current[pair[0]];
      if (!choice || typeof choice.id !== 'string') fail('Gire as três roletas antes de salvar a rodada.');
      var original = state[pair[1]].find(function (item) { return item.id === choice.id; });
      if (!original) fail('Uma opção sorteada foi removida. Faça um novo sorteio.');
      if (!available(state, pair[1]).some(function (item) { return item.id === choice.id; })) fail('Uma opção sorteada já participou deste ciclo. Faça um novo sorteio.');
      selections[pair[0]] = Object.assign({}, original);
    });
    selections.card.effect = cardEffect(selections.card);
    var additions = selections.card.effect === 'infernal' ? infernalAdditions(state) : [];
    if (state.anime.length + additions.length > MAX.anime) fail('Não há espaço para os animes de Infernizar. O limite é de 200 animes; remova opções antes de confirmar.');
    var record = { id: uid(), at: new Date().toISOString(), friend: selections.friend, card: selections.card, anime: selections.anime };
    if (selections.card.effect === 'infernal') record.addedInfernalAnime = additions.map(function (item) { return Object.assign({}, item); });
    var cycleIds = state.cycleRoundIds || inferCycleRoundIds(state);
    state.history.push(record);
    cycleIds.push(record.id);
    if (state.history.length > MAX.history) state.history.splice(0, state.history.length - MAX.history);
    var historyIds = new Set(state.history.map(function (item) { return item.id; }));
    state.cycleRoundIds = cycleIds.filter(function (value) { return historyIds.has(value); });
    if (!state.used.friends.includes(selections.friend.id)) state.used.friends.push(selections.friend.id);
    if (!state.used.anime.includes(selections.anime.id)) state.used.anime.push(selections.anime.id);
    additions.forEach(function (item) { state.anime.push(item); });
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
    if (record.addedInfernalAnime && record.addedInfernalAnime.length) {
      var removableIds = new Set();
      record.addedInfernalAnime.forEach(function (snapshot) {
        var anime = state.anime.find(function (item) { return item.id === snapshot.id; });
        if (!anime || state.used.anime.includes(snapshot.id) || (state.current.anime && state.current.anime.id === snapshot.id) || state.history.some(function (item) { return item.anime.id === snapshot.id; })) return;
        var unchanged = false;
        try { unchanged = JSON.stringify(entry(anime, 'anime', 'Anime atual')) === JSON.stringify(entry(snapshot, 'anime', 'Anime adicionado')); } catch (error) { unchanged = false; }
        if (unchanged) removableIds.add(snapshot.id);
      });
      state.anime = state.anime.filter(function (anime) { return !removableIds.has(anime.id); });
      prepareTurnEffect(state);
    }
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

  return { uid: uid, createState: createState, migrateDefaults: migrateDefaults, addStandardCards: addStandardCards, normalizeState: normalizeState, normalizeAniListProfile: normalizeAniListProfile, normalizeAnimeMetadata: normalizeAnimeMetadata, effectInfo: effectInfo, prepareTurnEffect: prepareTurnEffect, applyTurnEffect: applyTurnEffect, INFERNAL_ANIME: INFERNAL_ANIME, available: available, secureIndex: secureIndex, pick: pick, rejectAnime: rejectAnime, commitRound: commitRound, removeRound: removeRound, cycleRecords: cycleRecords, clearCurrent: clearCurrent, resetCycle: resetCycle, escapeHtml: escapeHtml, wheelTarget: wheelTarget };
});

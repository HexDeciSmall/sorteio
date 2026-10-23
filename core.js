(function (root, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.RouletteCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  var MAX = { friends: 100, cards: 100, anime: 200, history: 300 };
  var FRIEND_DEFAULTS = ['Hex', 'KV', 'Cap', 'Nando', 'Turbo', 'Mary', 'Kris', 'Kyoka'];
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
  var SPECIAL_TYPES = ['swap_result', 'mutual', 'king', 'free_pick'];
  var EFFECT_TYPES = ['none', 'remove_anime', 'remove_owner', 'infernal'].concat(SPECIAL_TYPES);
  var STANDARD_CARDS = [
    { name: 'Nem a Pau', description: 'Pode remover um anime na sua vez.', effect: 'remove_anime' },
    { name: 'Preconceito', description: 'Remove as indicações de um colega na sua vez.', effect: 'remove_owner' },
    { name: 'Sem Efeito', description: 'Nada Acontece', effect: 'none' },
    { name: 'Sem Efeito', description: 'Nada Acontece', effect: 'none' },
    { name: 'Sem Efeito', description: 'Nada Acontece', effect: 'none' },
    { name: 'Sem Efeito', description: 'Nada Acontece', effect: 'none' },
    { name: 'Infernizar', description: 'Adiciona Hand Shakers, Gamers, Rent a Girlfriend e Terra Formars assim que seu anime for decidido.', effect: 'infernal' },
    { name: 'Sofra Imbecil', description: 'Pode manter seu anime ou trocá-lo com um resultado já confirmado neste ciclo.', effect: 'swap_result' },
    { name: 'Destruição Mutua Assegurada', description: 'Escolha outro colega para assistir Rent a Girlfriend juntos em call.', effect: 'mutual' },
    { name: 'O Rei mandou', description: 'Escolha outro colega que ainda não rodou e reserve um anime da roleta para ele.', effect: 'king' },
    { name: 'To fora dessa', description: 'Escolha livremente um anime, filme ou OVA para assistir.', effect: 'free_pick' }
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
      return defaultFriend(name);
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
      cardDefaultsVersion: 2,
      profileDefaultsVersion: 8,
      turnEffect: emptyTurnEffect(),
      specialEffect: null
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
      state.friends = FRIEND_DEFAULTS.map(defaultFriend);
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
    if (!state.cardDefaultsVersion) {
      if (!state.cards.length) addStandardCards(state);
      else state.cardDefaultsVersion = 1;
      changed = true;
    }
    if (state.cardDefaultsVersion < 2) {
      var missingSpecial = STANDARD_CARDS.filter(function (card) { return SPECIAL_TYPES.includes(card.effect) && !state.cards.some(function (item) { return cardEffect(item) === card.effect; }); });
      if (state.cards.length + missingSpecial.length <= MAX.cards) {
        missingSpecial.forEach(function (card) { state.cards.push(Object.assign({ id: uid() }, card)); });
        state.cardDefaultsVersion = 2;
        changed = true;
      }
    }
    var profileVersion = state.profileDefaultsVersion === undefined ? 0 : state.profileDefaultsVersion;
    if (profileVersion < 1) {
      var hex = state.friends.find(function (friend) { return normalizedName(friend.name) === 'hex'; });
      if (hex && !hex.anilistUsername) {
        hex.anilistUsername = 'HexDSmall';
        if (state.current.friend && state.current.friend.id === hex.id) state.current.friend.anilistUsername = 'HexDSmall';
      }
    }
    if (profileVersion < 2) {
      var turbo = state.friends.find(function (friend) { return normalizedName(friend.name) === 'turbo'; });
      if (turbo && !turbo.anilistUsername) {
        turbo.anilistUsername = 'Turbomob';
        if (state.current.friend && state.current.friend.id === turbo.id) state.current.friend.anilistUsername = 'Turbomob';
      }
    }
    if (profileVersion < 3) {
      var mary = state.friends.find(function (friend) { return normalizedName(friend.name) === 'mary'; });
      if (mary && !mary.anilistUsername) {
        mary.anilistUsername = 'Katupiry';
        if (state.current.friend && state.current.friend.id === mary.id) state.current.friend.anilistUsername = 'Katupiry';
      }
    }
    if (profileVersion < 4) {
      var kris = state.friends.find(function (friend) { return normalizedName(friend.name) === 'kris'; });
      if (kris && !kris.anilistUsername) {
        kris.anilistUsername = 'KrismonKalamity';
        if (state.current.friend && state.current.friend.id === kris.id) state.current.friend.anilistUsername = 'KrismonKalamity';
      }
      state.profileDefaultsVersion = 4;
      changed = true;
    }
    if (profileVersion < 5) {
      var kyoka = state.friends.find(function (friend) { return normalizedName(friend.name) === 'kyoka'; });
      if (!kyoka && state.friends.length < MAX.friends) {
        kyoka = defaultFriend('Kyoka');
        state.friends.push(kyoka);
        changed = true;
      }
      if (kyoka) {
        if (!kyoka.anilistUsername) {
          kyoka.anilistUsername = 'Kycks';
          if (state.current.friend && state.current.friend.id === kyoka.id) state.current.friend.anilistUsername = 'Kycks';
        }
        state.profileDefaultsVersion = 5;
        changed = true;
      }
    }
    if (profileVersion < 6) {
      var cap = state.friends.find(function (friend) { return normalizedName(friend.name) === 'cap'; });
      if (cap && !cap.anilistUsername) {
        cap.anilistUsername = 'CapKiyo';
        if (state.current.friend && state.current.friend.id === cap.id) state.current.friend.anilistUsername = 'CapKiyo';
        changed = true;
      }
      if (state.profileDefaultsVersion >= 5) {
        state.profileDefaultsVersion = 6;
        changed = true;
      }
    }
    if (profileVersion < 7) {
      var kv = state.friends.find(function (friend) { return normalizedName(friend.name) === 'kv'; });
      if (kv && !kv.anilistUsername) {
        kv.anilistUsername = 'knvcria';
        if (state.current.friend && state.current.friend.id === kv.id) state.current.friend.anilistUsername = 'knvcria';
        changed = true;
      }
      if (state.profileDefaultsVersion >= 6) { state.profileDefaultsVersion = 7; changed = true; }
    }
    if (profileVersion < 8) {
      var nando = state.friends.find(function (friend) { return normalizedName(friend.name) === 'nando'; });
      if (nando && !nando.anilistUsername) {
        nando.anilistUsername = 'nandolrv';
        if (state.current.friend && state.current.friend.id === nando.id) state.current.friend.anilistUsername = 'nandolrv';
        changed = true;
      }
      if (state.profileDefaultsVersion >= 7) { state.profileDefaultsVersion = 8; changed = true; }
    }
    if (changed) prepareTurnEffect(state);
    return changed;
  }

  function defaultFriend(name) {
    var friend = { id: uid(), name: name };
    if (name === 'Hex') friend.anilistUsername = 'HexDSmall';
    if (name === 'KV') friend.anilistUsername = 'knvcria';
    if (name === 'Cap') friend.anilistUsername = 'CapKiyo';
    if (name === 'Nando') friend.anilistUsername = 'nandolrv';
    if (name === 'Turbo') friend.anilistUsername = 'Turbomob';
    if (name === 'Mary') friend.anilistUsername = 'Katupiry';
    if (name === 'Kris') friend.anilistUsername = 'KrismonKalamity';
    if (name === 'Kyoka') friend.anilistUsername = 'Kycks';
    return friend;
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
    state.cardDefaultsVersion = 2;
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

  function copy(value) { return JSON.parse(JSON.stringify(value)); }

  function idList(value, limit, label) {
    var result = list(value, limit, label).map(function (value) { return id(value, label); });
    if (new Set(result).size !== result.length) fail(label + ' contém identificadores repetidos.');
    return result;
  }

  function specialPayload(type, value) {
    if (value === null) return null;
    object(value, 'Escolha da carta');
    if (type === 'swap_result') return { recordId: value.recordId === null ? null : id(field(value, 'recordId', 'recordId'), 'Resultado para troca') };
    if (type === 'mutual') return { friendId: id(field(value, 'friendId', 'friendId'), 'Colega escolhido') };
    if (type === 'king') return { friendId: id(field(value, 'friendId', 'friendId'), 'Colega escolhido'), animeId: id(field(value, 'animeId', 'animeId'), 'Anime reservado') };
    if (type === 'free_pick') return { name: string(field(value, 'name', 'name'), 200, 'Nome do anime escolhido', false), animeId: value.animeId === null || value.animeId === undefined ? null : id(value.animeId, 'Anime escolhido') };
    fail('Carta especial inválida.');
  }

  function normalizeSpecialDraft(value) {
    if (value === null || value === undefined) return null;
    object(value, 'Escolha da carta especial');
    if (!SPECIAL_TYPES.includes(value.type)) fail('Tipo de carta especial inválido.');
    if (typeof value.resolved !== 'boolean') fail('A resolução da carta especial deve ser verdadeira ou falsa.');
    var result = { cardId: id(value.cardId, 'Carta especial'), friendId: id(value.friendId, 'Dono da carta especial'), type: value.type, resolved: value.resolved, payload: specialPayload(value.type, value.payload), forcedAnime: null };
    if (!result.resolved && result.payload !== null) fail('Uma carta especial pendente não pode ter escolha confirmada.');
    if (value.forcedAnime !== undefined && value.forcedAnime !== null) result.forcedAnime = entry(value.forcedAnime, 'anime', 'Anime definido pela carta');
    if (result.forcedAnime && (!result.resolved || !['mutual', 'free_pick'].includes(result.type) || !result.payload)) fail('Anime definido pela carta especial inválido.');
    if (result.type === 'mutual' && result.forcedAnime && !isRentAnime(result.forcedAnime)) fail('A carta de destruição mútua deve definir Rent a Girlfriend.');
    if (result.type === 'free_pick' && result.forcedAnime && result.payload.animeId === null && (result.forcedAnime.name !== result.payload.name || result.forcedAnime.ownerId !== null)) fail('A escolha livre não corresponde ao anime definido.');
    return result;
  }

  function normalizeRecordSpecial(record, value, label) {
    ['effectGroupId', 'effectRevisionId'].forEach(function (key) { if (own(value, key)) record[key] = id(value[key], label + ': vínculo do efeito'); });
    if (own(value, 'effectNote')) record.effectNote = string(value.effectNote, 500, label + ': observação', true);
    if (own(value, 'relatedRoundIds')) record.relatedRoundIds = idList(value.relatedRoundIds, MAX.friends, label + ': resultados ligados');
    if (!own(value, 'special')) return;
    var special = object(value.special, label + ': efeito especial');
    if (!SPECIAL_TYPES.includes(special.type) || special.type !== record.card.effect || record.effectGroupId !== record.id) fail(label + ': vínculo de carta especial inválido.');
    record.special = {
      type: special.type,
      dependsOn: idList(special.dependsOn, MAX.friends, label + ': dependências'),
      createdRecordIds: idList(special.createdRecordIds, MAX.friends, label + ': resultados criados'),
      changes: list(special.changes, MAX.friends, label + ': alterações').map(function (change) {
        object(change, label + ': alteração');
        return { recordId: id(change.recordId, 'Resultado alterado'), beforeAnime: entry(change.beforeAnime, 'anime', 'Anime anterior'), afterAnime: entry(change.afterAnime, 'anime', 'Anime substituto'), beforeNote: change.beforeNote === null ? null : string(change.beforeNote, 500, 'Observação anterior', true), beforeRevisionId: change.beforeRevisionId === null ? null : id(change.beforeRevisionId, 'Efeito anterior') };
      })
    };
    unique(record.special.changes.map(function (change) { return { id: change.recordId }; }), label + ': alterações');
    if (record.special.dependsOn.includes(record.id) || record.special.createdRecordIds.includes(record.id)) fail(label + ': o efeito não pode depender de si mesmo.');
  }

  function normalizeState(input) {
    object(input, 'O arquivo');
    if (field(input, 'version', 'version') !== 1) fail('Versão de arquivo incompatível. Use uma exportação da versão 1.');
    var state = { version: 1 };
    state.cardDefaultsVersion = own(input, 'cardDefaultsVersion') ? input.cardDefaultsVersion : 0;
    if (![0, 1, 2].includes(state.cardDefaultsVersion)) fail('Versão de cartas padrão inválida.');
    state.profileDefaultsVersion = own(input, 'profileDefaultsVersion') ? input.profileDefaultsVersion : 0;
    if (![0, 1, 2, 3, 4, 5, 6, 7, 8].includes(state.profileDefaultsVersion)) fail('Versão de perfis padrão inválida.');
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
      normalizeRecordSpecial(record, value, label);
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
    validateCycleEffects(state);
    cycleRecords(state).forEach(function (record) {
      [['friends', record.friend.id], ['anime', record.anime.id]].forEach(function (pair) {
        if (ids[pair[0]].has(pair[1]) && !state.used[pair[0]].includes(pair[1])) state.used[pair[0]].push(pair[1]);
      });
    });
    state.specialEffect = normalizeSpecialDraft(input.specialEffect);
    var current = object(field(input, 'current', 'current'), 'Sorteio atual');
    state.current = {};
    [['friend', 'friends'], ['card', 'cards'], ['anime', 'anime']].forEach(function (pair) {
      var value = field(current, pair[0], 'current.' + pair[0]);
      if (value === null) { state.current[pair[0]] = null; return; }
      var choice = entry(value, pair[1], 'Sorteio atual: ' + pair[0]);
      var original = state[pair[1]].find(function (item) { return item.id === choice.id; });
      if (!original && pair[0] === 'anime' && state.specialEffect && state.specialEffect.forcedAnime && state.specialEffect.forcedAnime.id === choice.id) {
        state.current.anime = choice;
        return;
      }
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
    var specialInfo = specialEffectInfo(state);
    if (state.current.anime && !state.anime.some(function (anime) { return anime.id === state.current.anime.id; }) && (!specialInfo.forcedAnime || specialInfo.forcedAnime.id !== state.current.anime.id)) fail('A escolha externa não corresponde à carta especial atual.');
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

  function sameAnime(left, right) {
    return JSON.stringify(entry(left, 'anime', 'Anime do resultado')) === JSON.stringify(entry(right, 'anime', 'Anime do resultado'));
  }

  function validateCycleEffects(state) {
    var active = cycleRecords(state);
    var positions = new Map(active.map(function (record, index) { return [record.id, index]; }));
    var records = new Map(active.map(function (record) { return [record.id, record]; }));
    var friends = new Set();
    var anime = new Set();
    active.forEach(function (record, index) {
      if (friends.has(record.friend.id) || anime.has(record.anime.id)) fail('Os resultados deste ciclo repetem um amigo ou anime.');
      friends.add(record.friend.id); anime.add(record.anime.id);
      if (record.effectGroupId && record.effectGroupId !== record.id) {
        var parent = records.get(record.effectGroupId);
        if (!parent || !parent.special || !parent.special.createdRecordIds.includes(record.id) || positions.get(parent.id) >= index) fail('Um resultado ligado perdeu a carta que o criou.');
      }
      if (record.effectRevisionId && !records.has(record.effectRevisionId)) fail('Um resultado alterado perdeu o efeito que o modificou.');
      if (!record.special) return;
      var special = record.special;
      if (record.effectGroupId !== record.id || special.type !== record.card.effect || special.changes.length > 1 || special.createdRecordIds.length > 1) fail('Os vínculos de uma carta especial são inválidos.');
      if (special.dependsOn.some(function (value) { return !positions.has(value) || positions.get(value) >= index; })) fail('Uma carta especial possui uma dependência ausente ou fora de ordem.');
      if (special.createdRecordIds.some(function (value) { return !records.has(value) || records.get(value).effectGroupId !== record.id || positions.get(value) <= index; })) fail('Uma carta especial perdeu seu resultado adicional.');
      if (special.changes.some(function (change) { return !special.dependsOn.includes(change.recordId) || change.beforeRevisionId && !special.dependsOn.includes(change.beforeRevisionId); })) fail('Uma substituição de anime perdeu a dependência do resultado anterior.');
      if (special.type === 'swap_result' && special.createdRecordIds.length || special.type === 'free_pick' && (special.changes.length || special.createdRecordIds.length) || special.type === 'king' && special.changes.length || special.type === 'mutual' && special.changes.length && special.createdRecordIds.length) fail('Os resultados ligados não correspondem ao efeito desta carta.');
    });
    var projected = new Map(active.map(function (record) { return [record.id, { anime: copy(record.anime), revision: record.effectRevisionId || null }]; }));
    for (var i = active.length - 1; i >= 0; i--) {
      var principal = active[i];
      if (!principal.special) continue;
      principal.special.changes.forEach(function (change) {
        var target = projected.get(change.recordId);
        if (!target || target.revision !== principal.id || !sameAnime(target.anime, change.afterAnime)) fail('O histórico de alterações de uma carta especial está inconsistente.');
        if (principal.special.type === 'swap_result' && !sameAnime(projected.get(principal.id).anime, change.beforeAnime)) fail('Os animes de uma troca estão inconsistentes.');
        target.anime = copy(change.beforeAnime);
        target.revision = change.beforeRevisionId;
      });
    }
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

  function specialCandidates(state, type, friendId) {
    var anime = baseAvailable(state, 'anime');
    var friends = type === 'mutual' ? state.friends.filter(function (friend) { return friend.id !== friendId; }) : baseAvailable(state, 'friends').filter(function (friend) { return friend.id !== friendId; });
    return { friends: friends, anime: anime, records: cycleRecords(state).filter(function (record) { return record.friend.id !== friendId; }) };
  }

  function preparedSpecialEffect(state) {
    var context = turnContext(state);
    if (!context.friend || !context.card || !SPECIAL_TYPES.includes(cardEffect(context.card))) return null;
    var type = cardEffect(context.card);
    var fresh = { cardId: context.card.id, friendId: context.friend.id, type: type, resolved: false, payload: null, forcedAnime: null };
    var old = state.specialEffect;
    if (!old || old.cardId !== fresh.cardId || old.friendId !== fresh.friendId || old.type !== type || !old.resolved) return fresh;
    var candidates = specialCandidates(state, type, fresh.friendId);
    var payload = old.payload;
    var valid = false;
    if (type === 'swap_result') valid = !!payload && (payload.recordId === null || candidates.records.some(function (record) { return record.id === payload.recordId; }));
    if (type === 'mutual') valid = payload === null ? !candidates.friends.length : candidates.friends.some(function (friend) { return friend.id === payload.friendId; }) && !!old.forcedAnime && isRentAnime(old.forcedAnime);
    if (type === 'king') valid = payload === null ? !candidates.friends.length || candidates.anime.length < 2 : candidates.friends.some(function (friend) { return friend.id === payload.friendId; }) && candidates.anime.length >= 2 && candidates.anime.some(function (anime) { return anime.id === payload.animeId; });
    if (type === 'free_pick') valid = !!payload && !!old.forcedAnime && (payload.animeId === null ? old.forcedAnime.name === payload.name && old.forcedAnime.ownerId === null : candidates.anime.some(function (anime) { return anime.id === payload.animeId && old.forcedAnime.id === anime.id; }));
    if (valid && old.forcedAnime && state.anime.some(function (anime) { return anime.id === old.forcedAnime.id; }) && !candidates.anime.some(function (anime) { return anime.id === old.forcedAnime.id; })) valid = false;
    if (!valid) return fresh;
    fresh.resolved = true;
    fresh.payload = copy(payload);
    fresh.forcedAnime = old.forcedAnime ? copy(old.forcedAnime) : null;
    if (fresh.forcedAnime) {
      var original = state.anime.find(function (anime) { return anime.id === fresh.forcedAnime.id; });
      if (original) {
        if (type === 'mutual' && !isRentAnime(original)) return { cardId: fresh.cardId, friendId: fresh.friendId, type: type, resolved: false, payload: null, forcedAnime: null };
        fresh.forcedAnime = copy(original);
      } else if (type === 'mutual' && (fresh.forcedAnime.malId !== 40839 || fresh.forcedAnime.ownerId !== null)) return { cardId: fresh.cardId, friendId: fresh.friendId, type: type, resolved: false, payload: null, forcedAnime: null };
      if (cycleRecords(state).some(function (record) { return record.anime.id === fresh.forcedAnime.id; })) return { cardId: fresh.cardId, friendId: fresh.friendId, type: type, resolved: false, payload: null, forcedAnime: null };
    }
    return fresh;
  }

  function specialEffectInfo(state) {
    var draft = preparedSpecialEffect(state);
    var context = turnContext(state);
    var currentAnime = state.current.anime;
    var friendValid = !!context.friend && baseAvailable(state, 'friends').some(function (friend) { return friend.id === context.friend.id; });
    var animeValid = !!currentAnime && (draft && draft.forcedAnime ? currentAnime.id === draft.forcedAnime.id : available(state, 'anime').some(function (anime) { return anime.id === currentAnime.id; }));
    var ordinary = friendValid && !!context.card && animeValid;
    if (!draft) return { type: 'none', pending: false, resolved: true, canSpinAnime: true, canConfirm: ordinary && !effectInfo(state).pending, canSkip: false, forcedAnime: null, draft: null, candidates: { friends: [], anime: [], records: [] } };
    var candidates = specialCandidates(state, draft.type, draft.friendId);
    var pending = !draft.resolved && (draft.type !== 'swap_result' || !!state.current.anime);
    var forced = draft.forcedAnime;
    var canSpin = draft.type === 'swap_result' || draft.resolved && !forced;
    return { type: draft.type, pending: pending, resolved: draft.resolved, canSpinAnime: canSpin, canConfirm: ordinary && draft.resolved && (!forced || state.current.anime.id === forced.id), canSkip: draft.type === 'swap_result' || draft.type === 'mutual' && !candidates.friends.length || draft.type === 'king' && (!candidates.friends.length || candidates.anime.length < 2), forcedAnime: forced ? copy(forced) : null, draft: draft.payload ? copy(draft.payload) : null, candidates: copy(candidates) };
  }

  function synchronizeSpecialEffect(state) {
    var previous = state.specialEffect;
    var draft = preparedSpecialEffect(state);
    if (previous && previous.forcedAnime && (!draft || !draft.forcedAnime) && state.current.anime && state.current.anime.id === previous.forcedAnime.id) state.current.anime = null;
    state.specialEffect = draft;
    if (draft && draft.forcedAnime) state.current.anime = copy(draft.forcedAnime);
  }

  function resetSpecialEffect(state) {
    var previous = state.specialEffect;
    if (previous && previous.forcedAnime && state.current.anime && state.current.anime.id === previous.forcedAnime.id) state.current.anime = null;
    state.specialEffect = null;
    synchronizeSpecialEffect(state);
    return specialEffectInfo(state);
  }

  function isRentAnime(anime) {
    return anime.malId === 40839 || !anime.malId && INFERNAL_ANIME[2].aliases.some(function (alias) { return aliasKey(alias) === aliasKey(anime.name); });
  }

  function rentAnime(state) {
    var seed = INFERNAL_ANIME[2];
    var availableRent = baseAvailable(state, 'anime').find(isRentAnime);
    return availableRent ? copy(availableRent) : Object.assign({ id: uid(), name: seed.name, ownerId: null }, normalizeAnimeMetadata(seed));
  }

  function applySpecialEffect(state, value) {
    var draft = preparedSpecialEffect(state);
    if (!draft) fail('Escolha um amigo e uma carta especial antes de usar o efeito.');
    var payload = specialPayload(draft.type, value);
    var candidates = specialCandidates(state, draft.type, draft.friendId);
    var forced = null;
    if (draft.type === 'swap_result') {
      if (!state.current.anime) fail('Sorteie seu anime antes de decidir a troca.');
      if (!payload || payload.recordId !== null && !candidates.records.some(function (record) { return record.id === payload.recordId; })) fail('Escolha um resultado deste ciclo ou mantenha seu anime.');
    } else if (draft.type === 'mutual') {
      if (payload === null) { if (candidates.friends.length) fail('Escolha outro colega para usar esta carta.'); }
      else {
        if (!candidates.friends.some(function (friend) { return friend.id === payload.friendId; })) fail('Escolha outro colega para assistir Rent a Girlfriend.');
        forced = rentAnime(state);
      }
    } else if (draft.type === 'king') {
      if (payload === null) { if (candidates.friends.length && candidates.anime.length >= 2) fail('Escolha um colega e um anime disponível para usar esta carta.'); }
      else if (!candidates.friends.some(function (friend) { return friend.id === payload.friendId; }) || candidates.anime.length < 2 || !candidates.anime.some(function (anime) { return anime.id === payload.animeId; })) fail('O Rei precisa de outro colega que ainda não rodou e pelo menos dois animes disponíveis.');
    } else if (draft.type === 'free_pick') {
      if (!payload) fail('Informe o anime, filme ou OVA que deseja assistir.');
      if (payload.animeId !== null) {
        forced = candidates.anime.find(function (anime) { return anime.id === payload.animeId; });
        if (!forced) fail('Esse anime não está disponível na roleta.');
        forced = copy(forced);
        payload.name = forced.name;
      } else {
        var sameName = candidates.anime.find(function (anime) { return normalizedName(anime.name) === normalizedName(payload.name); });
        if (sameName) { payload.animeId = sameName.id; payload.name = sameName.name; forced = copy(sameName); }
        else forced = { id: uid(), name: payload.name, ownerId: null };
      }
    }
    draft.resolved = true;
    draft.payload = payload;
    draft.forcedAnime = forced;
    var previous = state.specialEffect;
    if (previous && previous.forcedAnime && state.current.anime && state.current.anime.id === previous.forcedAnime.id) state.current.anime = null;
    state.specialEffect = draft;
    if (forced) state.current.anime = copy(forced);
    if (draft.type === 'king' && payload && state.current.anime && state.current.anime.id === payload.animeId) state.current.anime = null;
    return specialEffectInfo(state);
  }

  function preparedTurnEffect(state) {
    var context = turnContext(state);
    if (!context.friend || !context.card) return emptyTurnEffect();
    var type = cardEffect(context.card);
    var previous = state.turnEffect || emptyTurnEffect();
    var matches = previous.cardId === context.card.id && previous.friendId === context.friend.id && previous.type === type;
    var automatic = type === 'none' || type === 'infernal' || SPECIAL_TYPES.includes(type);
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
    synchronizeSpecialEffect(state);
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
    var special = preparedSpecialEffect(state);
    if (special && special.type === 'king' && special.resolved && special.payload) pool = pool.filter(function (item) { return item.id !== (key === 'friends' ? special.payload.friendId : key === 'anime' ? special.payload.animeId : null); });
    if (key !== 'anime') return pool;
    var excluded = new Set(effectInfo(state).excludedAnimeIds);
    return pool.filter(function (item) { return !excluded.has(item.id); });
  }

  function shuffleList(state, key) {
    if (!['friends', 'cards', 'anime'].includes(key)) fail('Só é possível embaralhar os nomes, as cartas ou os animes.');
    var pool = available(state, key);
    if (pool.length < 2) return false;
    var original = pool.slice();
    for (var i = pool.length - 1; i > 0; i--) {
      var target = secureIndex(i + 1);
      var item = pool[i]; pool[i] = pool[target]; pool[target] = item;
    }
    if (pool.every(function (item, index) { return item === original[index]; })) {
      var first = pool[0]; pool[0] = pool[1]; pool[1] = first;
    }
    var ids = new Set(pool.map(function (item) { return item.id; }));
    var cursor = 0;
    state[key].forEach(function (item, index) {
      if (ids.has(item.id)) state[key][index] = pool[cursor++];
    });
    return true;
  }

  function clearAnime(state) {
    var count = state.anime.length;
    state.anime.length = 0;
    state.used.anime.length = 0;
    state.current.anime = null;
    prepareTurnEffect(state);
    return count;
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
    if (key === 'anime' && !specialEffectInfo(state).canSpinAnime) fail('Resolva esta carta antes de girar o anime. O anime definido pela carta não pode ser sorteado novamente.');
    var pool = available(state, key);
    if (excludedId !== undefined && excludedId !== null) pool = pool.filter(function (item) { return item.id !== excludedId; });
    return pool.length ? pool[secureIndex(pool.length)] : null;
  }

  function rejectAnime(state) {
    if (specialEffectInfo(state).forcedAnime) fail('O anime definido por esta carta não pode ser recusado. Altere a escolha da carta antes de confirmar.');
    if (!state.current.anime) return null;
    var rejected = Object.assign({}, state.current.anime);
    state.current.anime = null;
    return rejected;
  }

  function clearCurrent(state) {
    state.current = { friend: null, card: null, anime: null };
    state.turnEffect = emptyTurnEffect();
    state.specialEffect = null;
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

  function publishState(state, staged) {
    if (JSON.stringify(state.current) === JSON.stringify(staged.current)) staged.current = state.current;
    var history = new Map(state.history.map(function (record) { return [record.id, record]; }));
    staged.history = staged.history.map(function (record) {
      var original = history.get(record.id);
      if (!original) return record;
      Object.keys(original).forEach(function (key) { if (!own(record, key)) delete original[key]; });
      Object.assign(original, record);
      return original;
    });
    ['friends', 'cards', 'anime'].forEach(function (key) {
      var originals = new Map(state[key].map(function (item) { return [item.id, item]; }));
      staged[key] = staged[key].map(function (item) { return originals.get(item.id) || item; });
    });
    Object.assign(state, staged);
  }

  function reconcileConsumption(state, beforeRecords, beforeUsed) {
    var after = cycleRecords(state);
    [['friends', 'friend'], ['anime', 'anime']].forEach(function (pair) {
      var previous = new Set(beforeRecords.map(function (record) { return record[pair[1]].id; }));
      var extant = new Set(state[pair[0]].map(function (item) { return item.id; }));
      var stillUsed = new Set(after.map(function (record) { return record[pair[1]].id; }));
      var result = beforeUsed[pair[0]].filter(function (value) { return extant.has(value) && (!previous.has(value) || stillUsed.has(value)); });
      after.forEach(function (record) { if (extant.has(record[pair[1]].id) && !result.includes(record[pair[1]].id)) result.push(record[pair[1]].id); });
      state.used[pair[0]] = result;
    });
  }

  function makeRecord(friend, card, anime, at) {
    return { id: uid(), at: at, friend: copy(friend), card: copy(card), anime: copy(anime) };
  }

  function commitRound(state) {
    var staged = copy(state);
    prepareTurnEffect(staged);
    if (effectInfo(staged).pending || specialEffectInfo(staged).pending) fail('Resolva o efeito da carta antes de confirmar o anime.');
    var special = preparedSpecialEffect(staged);
    if (special && !special.resolved) fail('Resolva o efeito da carta antes de confirmar o anime.');
    var selections = {};
    [['friend', 'friends'], ['card', 'cards'], ['anime', 'anime']].forEach(function (pair) {
      var choice = staged.current[pair[0]];
      if (!choice || typeof choice.id !== 'string') fail('Gire as três roletas antes de salvar a rodada.');
      var forced = pair[0] === 'anime' && special && special.forcedAnime && special.forcedAnime.id === choice.id;
      var original = staged[pair[1]].find(function (item) { return item.id === choice.id; });
      if (forced && !original) { selections.anime = entry(special.forcedAnime, 'anime', 'Anime definido pela carta'); return; }
      if (!original) fail('Uma opção sorteada foi removida. Faça um novo sorteio.');
      if (!available(staged, pair[1]).some(function (item) { return item.id === choice.id; })) fail('Uma opção sorteada já participou deste ciclo. Faça um novo sorteio.');
      selections[pair[0]] = entry(original, pair[1], 'Opção sorteada');
    });
    selections.card.effect = cardEffect(selections.card);
    var additions = selections.card.effect === 'infernal' ? infernalAdditions(staged) : [];
    if (staged.anime.length + additions.length > MAX.anime) fail('Não há espaço para os animes de Infernizar. O limite é de 200 animes; remova opções antes de confirmar.');
    var beforeRecords = copy(cycleRecords(staged));
    var beforeUsed = copy(staged.used);
    var record = makeRecord(selections.friend, selections.card, selections.anime, new Date().toISOString());
    var related = [];
    if (special) {
      record.effectGroupId = record.id;
      record.relatedRoundIds = [];
      record.special = { type: special.type, dependsOn: [], createdRecordIds: [], changes: [] };
      var payload = special.payload;
      var targetRecord = null;
      var targetFriend = null;
      if (special.type === 'swap_result' && payload.recordId !== null) targetRecord = cycleRecords(staged).find(function (item) { return item.id === payload.recordId; });
      if (special.type === 'mutual' && payload) {
        targetFriend = staged.friends.find(function (friend) { return friend.id === payload.friendId; });
        targetRecord = cycleRecords(staged).find(function (item) { return item.friend.id === payload.friendId; });
      }
      if (targetRecord) {
        record.special.dependsOn.push(targetRecord.id);
        if (targetRecord.effectRevisionId && targetRecord.effectRevisionId !== targetRecord.id && !record.special.dependsOn.includes(targetRecord.effectRevisionId)) record.special.dependsOn.push(targetRecord.effectRevisionId);
        var replacement = special.type === 'swap_result' ? copy(selections.anime) : Object.assign({ id: uid(), name: INFERNAL_ANIME[2].name, ownerId: null }, normalizeAnimeMetadata(INFERNAL_ANIME[2]));
        record.special.changes.push({ recordId: targetRecord.id, beforeAnime: copy(targetRecord.anime), afterAnime: copy(replacement), beforeNote: own(targetRecord, 'effectNote') ? targetRecord.effectNote : null, beforeRevisionId: targetRecord.effectRevisionId || null });
        if (special.type === 'swap_result') {
          record.anime = copy(targetRecord.anime);
          record.effectNote = 'Trocou o anime com ' + targetRecord.friend.name + '.';
          targetRecord.effectNote = 'Anime trocado com ' + record.friend.name + ' por Sofra Imbecil.';
        } else {
          record.effectNote = 'Assistir Rent a Girlfriend juntos em call com ' + targetRecord.friend.name + '.';
          targetRecord.effectNote = 'Assistir Rent a Girlfriend juntos em call com ' + record.friend.name + ', por Destruição Mutua Assegurada.';
        }
        targetRecord.anime = replacement;
        targetRecord.effectRevisionId = record.id;
        record.relatedRoundIds.push(targetRecord.id);
      } else if (special.type === 'mutual' && payload) {
        var partnerAnime = Object.assign({ id: uid(), name: INFERNAL_ANIME[2].name, ownerId: null }, normalizeAnimeMetadata(INFERNAL_ANIME[2]));
        var partner = makeRecord(targetFriend, selections.card, partnerAnime, record.at);
        partner.effectGroupId = record.id;
        partner.effectNote = 'Assistir Rent a Girlfriend juntos em call com ' + record.friend.name + ', por Destruição Mutua Assegurada.';
        related.push(partner);
        record.effectNote = 'Assistir Rent a Girlfriend juntos em call com ' + targetFriend.name + '.';
      } else if (special.type === 'king' && payload) {
        var assignedFriend = staged.friends.find(function (friend) { return friend.id === payload.friendId; });
        var assignedAnime = staged.anime.find(function (anime) { return anime.id === payload.animeId; });
        var assigned = makeRecord(assignedFriend, selections.card, assignedAnime, record.at);
        assigned.effectGroupId = record.id;
        assigned.effectNote = 'Anime escolhido por ' + record.friend.name + ' com O Rei mandou.';
        related.push(assigned);
        record.effectNote = 'Escolheu ' + assignedAnime.name + ' para ' + assignedFriend.name + '.';
      } else if (special.type === 'free_pick') record.effectNote = special.payload.animeId === null ? 'Escolha livre, fora da roleta.' : 'Escolheu um anime disponível na roleta.';
      else if (special.type === 'swap_result') record.effectNote = 'Manteve o anime sorteado.';
      else record.effectNote = 'Carta sem outro alvo disponível; continuou o sorteio normal.';
      related.forEach(function (item) { record.special.createdRecordIds.push(item.id); record.relatedRoundIds.push(item.id); });
    }
    if (selections.card.effect === 'infernal') record.addedInfernalAnime = additions.map(function (item) { return Object.assign({}, item); });
    var cycleIds = staged.cycleRoundIds || inferCycleRoundIds(staged);
    staged.history.push(record);
    cycleIds.push(record.id);
    related.forEach(function (item) { staged.history.push(item); cycleIds.push(item.id); });
    if (staged.history.length > MAX.history) staged.history.splice(0, staged.history.length - MAX.history);
    var historyIds = new Set(staged.history.map(function (item) { return item.id; }));
    staged.cycleRoundIds = cycleIds.filter(function (value) { return historyIds.has(value); });
    additions.forEach(function (item) { staged.anime.push(item); });
    reconcileConsumption(staged, beforeRecords, beforeUsed);
    clearCurrent(staged);
    validateCycleEffects(staged);
    publishState(state, staged);
    return state.history.find(function (item) { return item.id === record.id; });
  }

  function removalInfo(state, recordId) {
    var active = cycleRecords(state);
    var source = active.find(function (record) { return record.id === recordId; });
    if (!source) return { count: 0, recordIds: [] };
    var ids = new Set([recordId, source.effectGroupId || recordId]);
    var changed = true;
    while (changed) {
      changed = false;
      active.forEach(function (record) {
        var dependent = record.special && (record.special.dependsOn.some(function (value) { return ids.has(value); }) || record.special.changes.some(function (change) { return ids.has(change.recordId); }));
        if (ids.has(record.id) || record.effectGroupId && ids.has(record.effectGroupId) || dependent) {
          [record.id, record.effectGroupId].concat(record.special ? record.special.createdRecordIds : []).forEach(function (value) { if (value && !ids.has(value)) { ids.add(value); changed = true; } });
        }
      });
      var projected = new Map(active.map(function (record) { return [record.id, record.anime.id]; }));
      var restored = new Set();
      for (var index = active.length - 1; index >= 0; index--) {
        var undo = active[index];
        if (!ids.has(undo.id) || !undo.special) continue;
        undo.special.changes.forEach(function (change) {
          if (!ids.has(change.recordId)) { projected.set(change.recordId, change.beforeAnime.id); restored.add(change.recordId); }
        });
      }
      var claims = new Map();
      active.forEach(function (record) {
        if (ids.has(record.id)) return;
        var animeId = projected.get(record.id);
        var prior = claims.get(animeId);
        if (!prior) { claims.set(animeId, record); return; }
        if (!restored.has(prior.id) && !restored.has(record.id)) return;
        var loser = restored.has(record.id) && !restored.has(prior.id) ? prior : record;
        [loser.id, loser.effectGroupId].forEach(function (value) { if (value && !ids.has(value)) { ids.add(value); changed = true; } });
        if (loser === prior) claims.set(animeId, record);
      });
    }
    var result = active.filter(function (record) { return ids.has(record.id); }).map(function (record) { return record.id; });
    return { count: result.length, recordIds: result };
  }

  function removeRound(state, recordId) {
    var info = removalInfo(state, recordId);
    if (!info.count) return null;
    var original = state.history.find(function (record) { return record.id === recordId; });
    var staged = copy(state);
    var before = copy(cycleRecords(staged));
    var beforeUsed = copy(staged.used);
    var ids = new Set(info.recordIds);
    var removed = staged.history.filter(function (record) { return ids.has(record.id); });
    for (var i = staged.history.length - 1; i >= 0; i--) {
      var undo = staged.history[i];
      if (!ids.has(undo.id) || !undo.special) continue;
      undo.special.changes.forEach(function (change) {
        var target = staged.history.find(function (record) { return record.id === change.recordId; });
        if (!target || ids.has(target.id)) return;
        target.anime = copy(change.beforeAnime);
        if (change.beforeNote === null) delete target.effectNote; else target.effectNote = change.beforeNote;
        if (change.beforeRevisionId === null) delete target.effectRevisionId; else target.effectRevisionId = change.beforeRevisionId;
      });
    }
    staged.history = staged.history.filter(function (record) { return !ids.has(record.id); });
    staged.cycleRoundIds = (staged.cycleRoundIds || []).filter(function (value) { return !ids.has(value); });
    reconcileConsumption(staged, before, beforeUsed);
    removed.forEach(function (record) {
      if (!record.addedInfernalAnime || !record.addedInfernalAnime.length) return;
      var removableIds = new Set();
      record.addedInfernalAnime.forEach(function (snapshot) {
        var anime = staged.anime.find(function (item) { return item.id === snapshot.id; });
        if (!anime || staged.used.anime.includes(snapshot.id) || (staged.current.anime && staged.current.anime.id === snapshot.id) || staged.history.some(function (item) { return item.anime.id === snapshot.id; })) return;
        var unchanged = false;
        try { unchanged = JSON.stringify(entry(anime, 'anime', 'Anime atual')) === JSON.stringify(entry(snapshot, 'anime', 'Anime adicionado')); } catch (error) { unchanged = false; }
        if (unchanged) removableIds.add(snapshot.id);
      });
      staged.anime = staged.anime.filter(function (anime) { return !removableIds.has(anime.id); });
    });
    if (staged.current.friend && staged.used.friends.includes(staged.current.friend.id)) staged.current.friend = null;
    if (staged.current.anime && staged.used.anime.includes(staged.current.anime.id)) staged.current.anime = null;
    prepareTurnEffect(staged);
    validateCycleEffects(staged);
    publishState(state, staged);
    return original;
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

  return { uid: uid, createState: createState, migrateDefaults: migrateDefaults, addStandardCards: addStandardCards, normalizeState: normalizeState, normalizeAniListProfile: normalizeAniListProfile, normalizeAnimeMetadata: normalizeAnimeMetadata, effectInfo: effectInfo, prepareTurnEffect: prepareTurnEffect, applyTurnEffect: applyTurnEffect, specialEffectInfo: specialEffectInfo, applySpecialEffect: applySpecialEffect, resetSpecialEffect: resetSpecialEffect, removalInfo: removalInfo, INFERNAL_ANIME: INFERNAL_ANIME, available: available, shuffleList: shuffleList, clearAnime: clearAnime, secureIndex: secureIndex, pick: pick, rejectAnime: rejectAnime, commitRound: commitRound, removeRound: removeRound, cycleRecords: cycleRecords, clearCurrent: clearCurrent, resetCycle: resetCycle, escapeHtml: escapeHtml, wheelTarget: wheelTarget };
});

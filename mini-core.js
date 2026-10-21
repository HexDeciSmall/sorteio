(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.SorteioMiniCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var START_DATE = '2026-10-20';
  var DATASET_ID = 'mini-2026-10-20-v1';
  var LIMITS = { characters: 3, anidle: 22 };
  var own = function (value, key) { return Object.prototype.hasOwnProperty.call(value, key); };
  var clone = function (value) { return JSON.parse(JSON.stringify(value)); };
  var fail = function (message) {
    var error = new Error(message);
    error.code = 'cloud/invalid-argument';
    Object.defineProperty(error, 'sorteioCloudError', { value: true });
    throw error;
  };

  function object(value, label) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail(label + ' possui formato inválido.');
    var proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) fail(label + ' possui formato inválido.');
    return value;
  }

  function cleanText(value, max, label, optional) {
    if (optional && (value === undefined || value === null)) return '';
    if (typeof value !== 'string') fail(label + ' deve ser um texto.');
    var result = value.normalize('NFC').trim();
    if ((!optional && !result) || result.length > max || /[\u0000-\u001f\u007f]/.test(result)) fail(label + ' possui formato inválido.');
    return result;
  }

  function normalized(value) {
    return String(value || '').normalize('NFKD').replace(/\p{M}+/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
  }

  function tokens(value) { return normalized(value).split(' ').filter(Boolean).sort().join(' '); }

  function strings(value, max, label) {
    if (!Array.isArray(value) || value.length > max) fail(label + ' deve ser uma lista válida.');
    var seen = new Set();
    return value.map(function (item) { return cleanText(item, 300, label); }).filter(function (item) {
      var key = normalized(item);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function mediaId(value, label) {
    if (!Number.isSafeInteger(value) || value < 1) fail(label + ' possui identificador inválido.');
    return value;
  }

  function imageUrl(value) {
    if (!value) return null;
    var text = cleanText(value, 2048, 'A imagem');
    try {
      var url = new URL(text);
      if (url.protocol !== 'https:' || !['s4.anilist.co', 's3.anilist.co', 'cdn.myanimelist.net'].includes(url.hostname) || url.username || url.password || url.port) fail('A imagem precisa usar um endereço do catálogo.');
      url.hash = '';
      return url.href;
    } catch (_) { fail('A imagem possui endereço inválido.'); }
  }

  function nullableNumber(value, min, max, label, integer) {
    if (value === null || value === undefined) return null;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) fail(label + ' possui valor inválido.');
    return value;
  }

  function randomIndex(seed) {
    var value = 2166136261;
    for (var index = 0; index < seed.length; index++) value = Math.imul(value ^ seed.charCodeAt(index), 16777619) >>> 0;
    return function (length) {
      value = (value + 0x6D2B79F5) >>> 0;
      var mixed = Math.imul(value ^ value >>> 15, 1 | value);
      mixed ^= mixed + Math.imul(mixed ^ mixed >>> 7, 61 | mixed);
      return Math.floor(((mixed ^ mixed >>> 14) >>> 0) / 4294967296 * length);
    };
  }

  function createEngine(settings) {
    object(settings, 'A configuração do desafio');
    var D = settings.D;
    if (!D || typeof D.validateDate !== 'function' || typeof D.streak !== 'function' || typeof D.todayKey !== 'function') fail('O calendário dos desafios não foi carregado.');
    var input = object(settings.dataset, 'O catálogo dos desafios');
    if (input.version !== 1 || input.id !== DATASET_ID || input.startDate !== START_DATE) fail('A edição dos desafios é incompatível.');
    D.validateDate(input.startDate);
    if (!Array.isArray(input.anime) || input.anime.length < 4 || input.anime.length > 10000 || !Array.isArray(input.characters) || input.characters.length < 4 || input.characters.length > 30000) fail('O catálogo precisa de pelo menos quatro animes e quatro personagens.');
    var anime = input.anime.map(function (item) {
      object(item, 'Um anime');
      return {
        id: mediaId(item.id, 'O anime'), malId: item.malId == null ? null : mediaId(item.malId, 'O anime no MAL'),
        title: cleanText(item.title, 300, 'O título'), aliases: strings(item.aliases || [], 100, 'Os títulos alternativos'),
        coverUrl: imageUrl(item.coverUrl), year: nullableNumber(item.year, 1900, 2199, 'O ano', true),
        studios: strings(item.studios || [], 30, 'Os estúdios'), source: cleanText(item.source, 100, 'A origem', true) || null,
        score: nullableNumber(item.score, 0, 10, 'A nota', false), genres: strings(item.genres || [], 100, 'Os gêneros'),
        tags: strings(item.tags || [], 100, 'As categorias'), episodes: nullableNumber(item.episodes, 1, 100000, 'Os episódios', true),
        format: cleanText(item.format, 80, 'O formato', true) || null
      };
    }).sort(function (a, b) { return a.id - b.id; });
    var animeById = new Map(anime.map(function (item) { return [item.id, item]; }));
    if (animeById.size !== anime.length) fail('O catálogo contém animes repetidos.');
    var characters = input.characters.map(function (item) {
      object(item, 'Um personagem');
      var primary = mediaId(item.animeId, 'A obra do personagem');
      var ids = item.animeIds === undefined ? [primary] : item.animeIds;
      if (!Array.isArray(ids) || !ids.length || ids.length > 100) fail('As obras do personagem possuem formato inválido.');
      ids = Array.from(new Set([primary].concat(ids.map(function (id) { return mediaId(id, 'A obra do personagem'); }))));
      if (!animeById.has(primary)) fail('A obra principal do personagem não está no catálogo.');
      return {
        id: mediaId(item.id, 'O personagem'), name: cleanText(item.name, 200, 'O nome do personagem'),
        aliases: strings(item.aliases || [], 100, 'Os nomes alternativos'), imageUrl: imageUrl(item.imageUrl),
        animeId: primary, animeIds: ids, animeTitle: cleanText(item.animeTitle || animeById.get(primary).title, 300, 'A obra do personagem'),
        animeAliases: strings(item.animeAliases || [], 300, 'Os nomes das obras')
      };
    }).sort(function (a, b) { return a.id - b.id; });
    if (new Set(characters.map(function (item) { return item.id; })).size !== characters.length) fail('O catálogo contém personagens repetidos.');
    var generatedAt = cleanText(input.generatedAt, 80, 'A data do catálogo', true) || null;
    var generationCache = new Map();

    function validMode(mode) {
      if (!own(LIMITS, mode)) fail('Escolha um modo de desafio válido.');
      return mode;
    }

    function openDate(mode, date, today) {
      validMode(mode);
      D.validateDate(date);
      today = D.validateDate(today || D.todayKey());
      if (date < START_DATE) fail('O calendário começa em 20/10/2026.');
      if (date > today) fail('Esse desafio ainda não foi liberado.');
      return today;
    }

    function targets(mode, date) {
      var key = mode + '|' + date;
      if (generationCache.has(key)) return generationCache.get(key);
      var next = randomIndex(DATASET_ID + '|' + key);
      var selected;
      if (mode === 'anidle') selected = { targetAnime: anime[next(anime.length)] };
      else {
        var pool = characters.slice();
        for (var index = pool.length - 1; index > 0; index--) {
          var other = next(index + 1);
          var item = pool[index]; pool[index] = pool[other]; pool[other] = item;
        }
        var picked = [];
        var works = new Set();
        pool.forEach(function (item) {
          if (picked.length < 4 && !works.has(item.animeId)) { picked.push(item); works.add(item.animeId); }
        });
        if (picked.length < 4) pool.forEach(function (item) { if (picked.length < 4 && !picked.includes(item)) picked.push(item); });
        selected = { characters: picked };
      }
      generationCache.set(key, selected);
      if (generationCache.size > 128) generationCache.delete(generationCache.keys().next().value);
      return selected;
    }

    function nameMatches(answer, item) {
      var value = normalized(answer);
      if (!value) return false;
      var sorted = tokens(answer);
      return [item.name].concat(item.aliases).some(function (alias) { return value === normalized(alias) || sorted === tokens(alias); });
    }

    function animeMatches(answer, item) {
      if (answer.animeId !== null && item.animeIds.includes(answer.animeId)) return true;
      var value = normalized(answer.animeText);
      if (!value) return false;
      var aliases = [item.animeTitle].concat(item.animeAliases);
      item.animeIds.forEach(function (id) { var show = animeById.get(id); if (show) aliases = aliases.concat([show.title], show.aliases); });
      return aliases.some(function (alias) { return value === normalized(alias); });
    }

    function answer(value) {
      object(value, 'Uma resposta');
      var id = value.animeId === undefined || value.animeId === null ? null : mediaId(value.animeId, 'A resposta do anime');
      return { character: cleanText(value.character, 200, 'O nome respondido', true), animeId: id, animeText: cleanText(value.animeText, 300, 'A obra respondida', true) };
    }

    function actionValue(action, mode, requiresId) {
      object(action, 'A jogada');
      var result;
      if (action.kind === 'giveup') result = { kind: 'giveup' };
      else if (mode === 'characters' && action.kind === 'characters') {
        if (!Array.isArray(action.answers) || action.answers.length !== 4) fail('Envie uma resposta para cada um dos quatro personagens.');
        result = { kind: 'characters', answers: action.answers.map(answer) };
        if (!result.answers.some(function (entry) { return entry.character || entry.animeText || entry.animeId !== null; })) fail('Preencha pelo menos uma resposta antes de enviar.');
      } else if (mode === 'anidle' && action.kind === 'anime') {
        var id = mediaId(action.animeId, 'O palpite');
        if (!animeById.has(id)) fail('Escolha um anime disponível no catálogo.');
        result = { kind: 'anime', animeId: id };
      } else fail('Essa jogada não pertence ao desafio selecionado.');
      if (requiresId) {
        if (typeof action.id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(action.id)) fail('O identificador da jogada é inválido.');
      }
      return result;
    }

    function attemptValue(value, mode) {
      object(value, 'Uma tentativa salva');
      if (value.giveup === true) return { giveup: true };
      var action = actionValue(mode === 'characters' ? { kind: 'characters', answers: value.answers } : { kind: 'anime', animeId: value.animeId }, mode, false);
      return mode === 'characters' ? { answers: action.answers } : { animeId: action.animeId };
    }

    function attemptAction(attempt, mode) {
      if (attempt.giveup === true) return { kind: 'giveup' };
      return mode === 'characters' ? { kind: 'characters', answers: attempt.answers } : { kind: 'anime', animeId: attempt.animeId };
    }

    function initialDay(mode, date) {
      var selected = targets(mode, date);
      var day = { version: 1, mode: mode, date: date, datasetId: DATASET_ID, attempts: [], completed: false, gaveUp: false, score: 0, wins: 0, attemptsUsed: 0 };
      if (mode === 'characters') day.characters = selected.characters.map(function (item) { return { target: item, characterGuess: '', animeGuess: '', animeId: null, characterCorrect: false, animeCorrect: false }; });
      else day.targetAnime = selected.targetAnime;
      return day;
    }

    function play(day, attempt) {
      if (day.completed) fail('Você já terminou esse desafio diário.');
      if (attempt.giveup === true) { day.gaveUp = true; day.completed = true; day.attempts.push(attempt); return; }
      if (day.mode === 'characters') {
        var newResponse = false;
        attempt.answers.forEach(function (entry, index) {
          var card = day.characters[index];
          if (!card.characterCorrect && entry.character) {
            newResponse = true;
            card.characterGuess = entry.character;
            card.characterCorrect = nameMatches(entry.character, card.target);
          }
          if (!card.animeCorrect && (entry.animeId !== null || entry.animeText)) {
            newResponse = true;
            card.animeGuess = entry.animeText || (animeById.has(entry.animeId) ? animeById.get(entry.animeId).title : 'Anime #' + entry.animeId);
            card.animeId = entry.animeId;
            card.animeCorrect = animeMatches(entry, card.target);
          }
        });
        if (!newResponse) fail('Preencha pelo menos uma resposta que ainda não foi acertada.');
        day.score = day.characters.reduce(function (total, card) { return total + Number(card.characterCorrect) + Number(card.animeCorrect); }, 0);
        day.wins = day.characters.filter(function (card) { return card.characterCorrect && card.animeCorrect; }).length;
      } else {
        if (day.attempts.some(function (previous) { return previous.animeId === attempt.animeId; })) fail('Esse anime já foi tentado. Escolha outro.');
        if (attempt.animeId === day.targetAnime.id) { day.wins = 1; day.score = LIMITS.anidle - day.attemptsUsed; }
      }
      day.attempts.push(attempt);
      day.attemptsUsed++;
      day.completed = day.attemptsUsed >= LIMITS[day.mode] || (day.mode === 'characters' ? day.score === 8 : day.wins === 1);
    }

    function compact(day, requests) {
      return { version: 1, mode: day.mode, date: day.date, dateNumber: Number(day.date.replace(/-/g, '')), month: day.date.slice(0, 7), datasetId: DATASET_ID, attempts: clone(day.attempts), completed: day.completed, score: day.score, wins: day.wins, requests: clone(requests) };
    }

    function read(raw, mode, date, today) {
      openDate(mode, date, today);
      var day = initialDay(mode, date);
      var requests = [];
      if (raw !== null && raw !== undefined) {
        object(raw, 'O progresso salvo');
        if (raw.version !== 1 || raw.mode !== mode || raw.date !== date || raw.datasetId !== DATASET_ID || raw.month !== date.slice(0, 7) || raw.dateNumber !== Number(date.replace(/-/g, ''))) fail('O progresso pertence a outro desafio ou edição.');
        if (!Array.isArray(raw.attempts) || raw.attempts.length > LIMITS[mode] + 1 || !Array.isArray(raw.requests) || raw.requests.length !== raw.attempts.length || raw.requests.length > 23) fail('As tentativas salvas possuem formato inválido.');
        var ids = new Set();
        var fingerprints = new Set();
        raw.attempts.forEach(function (entry, index) {
          var attempt = attemptValue(entry, mode);
          var request = object(raw.requests[index], 'Uma solicitação salva');
          var fingerprint = JSON.stringify(attemptAction(attempt, mode));
          if (typeof request.id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(request.id) || ids.has(request.id) || request.fingerprint !== fingerprint || fingerprints.has(fingerprint)) fail('O histórico de solicitações do desafio é inválido.');
          ids.add(request.id); fingerprints.add(fingerprint);
          play(day, attempt);
          requests.push({ id: request.id, fingerprint: fingerprint });
        });
        if (raw.score !== day.score || raw.wins !== day.wins || raw.completed !== day.completed) fail('O resumo salvo não corresponde às tentativas desse desafio.');
      }
      return { record: compact(day, requests), day: clone(day) };
    }

    function apply(raw, mode, date, action, today) {
      var result = read(raw, mode, date, today);
      var value = actionValue(action, mode, true);
      var fingerprint = JSON.stringify(value);
      var repeated = result.record.requests.find(function (request) { return request.id === action.id; });
      if (repeated) {
        if (repeated.fingerprint !== fingerprint) fail('Essa solicitação já foi usada para outra jogada.');
        result.changed = false;
        return result;
      }
      if (result.record.requests.some(function (request) { return request.fingerprint === fingerprint; })) { result.changed = false; return result; }
      var attempt = value.kind === 'giveup' ? { giveup: true } : mode === 'characters' ? { answers: value.answers } : { animeId: value.animeId };
      play(result.day, attempt);
      result.record.requests.push({ id: action.id, fingerprint: fingerprint });
      result.record = compact(result.day, result.record.requests);
      result.changed = true;
      return result;
    }

    function compareNumber(value, target) {
      return { value: value, direction: value === null || target === null ? 'unknown' : target > value ? 'higher' : target < value ? 'lower' : 'equal' };
    }

    function compareSet(values, target) {
      var wanted = new Set(target.map(normalized));
      var items = values.map(function (value) { return { value: value, match: wanted.has(normalized(value)) }; });
      var matched = items.filter(function (item) { return item.match; }).length;
      var status = !values.length || !target.length ? 'unknown' : matched === values.length && matched === wanted.size ? 'equal' : matched ? 'partial' : 'miss';
      return { items: items, status: status };
    }

    function publicAnime(item) { return { id: item.id, title: item.title, coverUrl: item.coverUrl, year: item.year }; }

    function compareAnime(guessId, targetId) {
      var guess = animeById.get(mediaId(guessId, 'O palpite'));
      var target = animeById.get(mediaId(targetId, 'O anime do desafio'));
      if (!guess || !target) fail('O anime não está disponível no catálogo.');
      return {
        anime: publicAnime(guess), correct: guess.id === target.id,
        year: compareNumber(guess.year, target.year), score: compareNumber(guess.score, target.score),
        studios: compareSet(guess.studios, target.studios), genres: compareSet(guess.genres, target.genres), tags: compareSet(guess.tags, target.tags),
        source: { value: guess.source, status: !guess.source || !target.source ? 'unknown' : normalized(guess.source) === normalized(target.source) ? 'equal' : 'miss' }
      };
    }

    function inferred(rows) {
      var result = { year: { min: null, max: null, exact: null }, score: { min: null, max: null, exact: null }, studios: [], source: null, genres: [], tags: [] };
      rows.forEach(function (row) {
        ['year', 'score'].forEach(function (field) {
          var point = row[field]; var bound = result[field];
          if (point.direction === 'equal') bound.exact = point.value;
          if (point.direction === 'higher') bound.min = bound.min === null ? point.value : Math.max(bound.min, point.value);
          if (point.direction === 'lower') bound.max = bound.max === null ? point.value : Math.min(bound.max, point.value);
        });
        ['studios', 'genres', 'tags'].forEach(function (field) {
          row[field].items.filter(function (item) { return item.match; }).forEach(function (item) { if (!result[field].some(function (value) { return normalized(value) === normalized(item.value); })) result[field].push(item.value); });
        });
        if (row.source.status === 'equal') result.source = row.source.value;
      });
      return result;
    }

    function view(day) {
      object(day, 'O desafio');
      validMode(day.mode);
      var result = { mode: day.mode, date: day.date, datasetId: DATASET_ID, completed: day.completed, gaveUp: day.gaveUp, score: day.score, wins: day.wins, attemptsUsed: day.attemptsUsed, maxAttempts: LIMITS[day.mode], remaining: LIMITS[day.mode] - day.attemptsUsed, canSubmit: !day.completed, maxScore: day.mode === 'characters' ? 8 : 22 };
      if (day.mode === 'characters') {
        result.cards = day.characters.map(function (card, index) {
          return { slot: index, imageUrl: card.target.imageUrl, characterGuess: card.characterGuess, animeGuess: card.animeGuess, animeId: card.animeId, characterCorrect: card.characterCorrect, animeCorrect: card.animeCorrect, characterName: day.completed ? card.target.name : null, animeTitle: day.completed ? card.target.animeTitle : null };
        });
      } else {
        result.guesses = day.attempts.filter(function (attempt) { return !attempt.giveup; }).map(function (attempt) { return compareAnime(attempt.animeId, day.targetAnime.id); });
        result.summary = inferred(result.guesses);
        result.hints = { format: day.attemptsUsed >= 11 || day.completed ? day.targetAnime.format : null, episodes: day.attemptsUsed >= 11 || day.completed ? day.targetAnime.episodes : null, coverUrl: day.attemptsUsed >= 17 || day.completed ? day.targetAnime.coverUrl : null };
        result.answer = day.completed ? clone(day.targetAnime) : null;
      }
      return clone(result);
    }

    function summary(day) {
      return { completed: day.completed === true, score: day.score, wins: day.wins, attemptsUsed: day.attemptsUsed, maxAttempts: LIMITS[validMode(day.mode)], maxScore: day.mode === 'characters' ? 8 : 22 };
    }

    function response(day, days, today) {
      today = openDate(day.mode, day.date, today);
      var source = days && !Array.isArray(days) && days.days ? days.days : days;
      var list = Array.isArray(source) ? source : source && typeof source === 'object' ? Object.keys(source).map(function (date) { return Object.assign({ date: date }, source[date]); }) : [];
      if (list.length > 10000) fail('Há dias demais no calendário.');
      var indexed = new Map();
      list.forEach(function (entry) {
        object(entry, 'Um dia do calendário');
        if (entry.mode && entry.mode !== day.mode) return;
        D.validateDate(entry.date);
        if (entry.date < START_DATE || entry.date > today) return;
        indexed.set(entry.date, { date: entry.date, completed: entry.completed === true, started: entry.started === true || (Array.isArray(entry.attempts) && entry.attempts.length > 0) || entry.completed === true });
      });
      indexed.set(day.date, { date: day.date, completed: day.completed, started: day.attempts.length > 0 });
      var dates = Array.from(indexed.values()).sort(function (a, b) { return a.date.localeCompare(b.date); });
      var state = { version: 1, days: {} };
      dates.forEach(function (entry) { state.days[entry.date] = { completed: entry.completed }; });
      return { today: today, startDate: START_DATE, day: view(day), streak: D.streak(state, today), days: dates };
    }

    function searchAnime(query, limit) {
      var term = normalized(cleanText(query, 300, 'A pesquisa', true));
      limit = limit === undefined ? 8 : limit;
      if (!Number.isInteger(limit) || limit < 1 || limit > 50) fail('O limite da pesquisa é inválido.');
      if (!term) return [];
      var compactTerm = term.replace(/ /g, '');
      return anime.map(function (item) {
        var names = [item.title].concat(item.aliases).map(normalized);
        var rank = names.reduce(function (best, name) {
          var value = name === term ? 0 : name.startsWith(term) ? 1 : name.includes(term) || name.replace(/ /g, '').includes(compactTerm) ? 2 : term.split(' ').every(function (word) { return name.includes(word); }) ? 3 : Infinity;
          return Math.min(best, value);
        }, Infinity);
        return { item: item, rank: rank };
      }).filter(function (match) { return Number.isFinite(match.rank); }).sort(function (a, b) { return a.rank - b.rank || a.item.title.localeCompare(b.item.title, 'pt-BR') || a.item.id - b.item.id; }).slice(0, limit).map(function (match) { return publicAnime(match.item); });
    }

    function datasetInfo() { return { version: 1, id: DATASET_ID, startDate: START_DATE, generatedAt: generatedAt, source: 'AniList', animeCount: anime.length, characterCount: characters.length }; }

    return { read: read, apply: apply, view: view, response: response, searchAnime: searchAnime, compareAnime: compareAnime, summary: summary, datasetInfo: datasetInfo };
  }

  return { START_DATE: START_DATE, DATASET_ID: DATASET_ID, createEngine: createEngine, normalizeText: normalized };
});

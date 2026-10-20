(function (root, factory) {
  'use strict';
  var core = typeof module === 'object' && module.exports ? require('./guessr-core.js') : root.GuessrCore;
  var api = factory(core);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.DailyGuessr = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (G) {
  'use strict';

  var ROUNDS = 5;
  var MAX_DAYS = 10000;
  var DAY_MS = 86400000;
  var cache = new WeakMap();
  var own = function (value, key) { return Object.prototype.hasOwnProperty.call(value, key); };
  var fail = function (message) { throw new Error(message); };
  var copy = function (value) { return JSON.parse(JSON.stringify(value)); };

  function object(value, label) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail(label + ' possui formato inválido.');
    var proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) fail(label + ' possui formato inválido.');
    return value;
  }

  function identifier(value, label) {
    if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(value)) fail(label + ' possui identificador inválido.');
    return value;
  }

  function validateDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail('Escolha uma data válida.');
    var parts = value.split('-').map(Number);
    if (parts[0] < 2000 || parts[0] > 2199) fail('Escolha uma data entre 2000 e 2199.');
    var date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    if (date.toISOString().slice(0, 10) !== value) fail('Escolha uma data válida.');
    return value;
  }

  function todayKey(now) {
    var date = now === undefined ? new Date() : new Date(now);
    if (!Number.isFinite(date.getTime())) fail('O relógio informou uma data inválida.');
    var pieces = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
    var values = {};
    pieces.forEach(function (piece) { values[piece.type] = piece.value; });
    return validateDate(values.year + '-' + values.month + '-' + values.day);
  }

  function addDays(date, amount) {
    validateDate(date);
    if (!Number.isSafeInteger(amount) || Math.abs(amount) > 80000) fail('O intervalo de datas é inválido.');
    return validateDate(new Date(new Date(date + 'T00:00:00Z').getTime() + amount * DAY_MS).toISOString().slice(0, 10));
  }

  function normalizeFriends(value) {
    if (!Array.isArray(value) || value.length < 2 || value.length > 100) fail('O desafio diário precisa de pelo menos dois colegas.');
    var friends = value.map(function (friend) {
      object(friend, 'Colega do desafio');
      var name = typeof friend.name === 'string' ? friend.name.trim() : '';
      if (!name || name.length > 80 || /[\u0000-\u001f\u007f]/.test(name)) fail('O nome de um colega do desafio é inválido.');
      return { id: identifier(friend.id, 'Colega do desafio'), name: name };
    }).sort(function (a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; });
    if (new Set(friends.map(function (friend) { return friend.id; })).size !== friends.length || new Set(friends.map(function (friend) { return friend.name.normalize('NFC').toLocaleLowerCase('pt-BR'); })).size !== friends.length) fail('Há colegas repetidos nas pistas diárias.');
    return friends;
  }

  function validateDataset(dataset) {
    object(dataset, 'As pistas diárias');
    var saved = cache.get(dataset);
    if (saved) return saved;
    if (dataset.version !== 1) fail('Versão das pistas diárias incompatível.');
    var startDate = validateDate(dataset.startDate);
    var friends = normalizeFriends(dataset.friends);
    if (own(dataset, 'editions')) {
      if (!Array.isArray(dataset.editions) || !dataset.editions.length || dataset.editions.length > 1000) fail('O arquivo de desafios precisa de uma lista válida de edições.');
      var ids = new Set();
      var previous = null;
      var roster = new Map(friends.map(function (friend) { return [friend.id, friend.name]; }));
      var editions = dataset.editions.map(function (edition, index) {
        object(edition, 'A edição diária');
        var from = validateDate(edition.from);
        if (index === 0 && from !== startDate) fail('A primeira edição precisa começar na data inicial do calendário.');
        if (previous !== null && from <= previous) fail('As edições precisam estar em ordem, sem datas repetidas.');
        object(edition.dataset, 'As pistas da edição');
        if (own(edition.dataset, 'editions')) fail('Uma edição precisa conter uma base de pistas, sem outros arquivos de edições.');
        var prepared = validateDataset(edition.dataset);
        if (prepared.startDate !== from) fail('A data da edição precisa ser igual ao início de sua base de pistas.');
        if (ids.has(prepared.id)) fail('Cada edição diária precisa de um identificador diferente.');
        ids.add(prepared.id);
        prepared.friends.forEach(function (friend) {
          if (!roster.has(friend.id) || roster.get(friend.id) !== friend.name) fail('Os colegas de uma edição não correspondem aos nomes do calendário.');
        });
        previous = from;
        return { from: from, dataset: prepared };
      });
      var archive = { startDate: startDate, friends: friends, editions: editions };
      cache.set(dataset, archive);
      return archive;
    }
    var datasetId = identifier(dataset.id, 'A edição do desafio');
    var available = new Set(friends.map(function (friend) { return friend.id; }));
    var profiles = G.eligibleProfiles(dataset.profiles).filter(function (profile) { return available.has(profile.friendId); }).map(function (profile) {
      profile.entries.sort(function (a, b) { return a.mediaId - b.mediaId; });
      return profile;
    }).sort(function (a, b) { return a.friendId < b.friendId ? -1 : a.friendId > b.friendId ? 1 : 0; });
    if (profiles.length < 2) fail('O desafio diário precisa de dois perfis com pelo menos três animes avaliados.');
    if (new Set(profiles.map(function (profile) { return profile.username.toLowerCase(); })).size !== profiles.length) fail('Os colegas do desafio precisam de perfis diferentes.');
    var result = { id: datasetId, startDate: startDate, friends: friends, profiles: profiles, dates: new Map() };
    cache.set(dataset, result);
    return result;
  }

  function seededIndex(seed) {
    var value = 2166136261;
    for (var i = 0; i < seed.length; i++) value = Math.imul(value ^ seed.charCodeAt(i), 16777619) >>> 0;
    return function (length) {
      value = (value + 0x6D2B79F5) >>> 0;
      var mixed = Math.imul(value ^ value >>> 15, 1 | value);
      mixed ^= mixed + Math.imul(mixed ^ mixed >>> 7, 61 | mixed);
      return Math.floor(((mixed ^ mixed >>> 14) >>> 0) / 4294967296 * length);
    };
  }

  function openDate(date, dataset, today) {
    validateDate(date);
    today = validateDate(today || todayKey());
    var prepared = validateDataset(dataset);
    if (date < prepared.startDate) fail('O calendário começa em ' + prepared.startDate.split('-').reverse().join('/') + '.');
    if (date > today) fail('Esse desafio ainda não foi liberado.');
    if (prepared.editions) {
      for (var index = prepared.editions.length - 1; index >= 0; index--) {
        if (prepared.editions[index].from <= date) return prepared.editions[index].dataset;
      }
      fail('Não há uma edição disponível para esta data.');
    }
    return prepared;
  }

  function generatedRounds(date, prepared) {
    if (prepared.dates.has(date)) return copy(prepared.dates.get(date));
    var randomIndex = seededIndex('daily-v1|' + prepared.id + '|' + date);
    var game = G.createGame();
    var rounds = [];
    for (var i = 0; i < ROUNDS; i++) {
      var round = G.createRound(game, prepared.profiles, prepared.friends, { randomIndex: randomIndex, roundId: 'daily_' + date + '_' + (i + 1) });
      if (round.preview) fail('O desafio diário não pode usar o modo de prévia.');
      rounds.push(copy(round));
      G.submitGuess(game, round.targetId);
    }
    prepared.dates.set(date, rounds);
    if (prepared.dates.size > 128) prepared.dates.delete(prepared.dates.keys().next().value);
    return copy(rounds);
  }

  function createState() {
    return { version: 1, days: {} };
  }

  function emptyProgress(prepared) {
    return { datasetId: prepared.id, index: 0, guesses: [[], [], [], [], []], completed: false };
  }

  function materialize(progress, date, prepared) {
    object(progress, 'O progresso diário');
    if (progress.datasetId !== prepared.id) fail('O progresso pertence a outra edição do desafio. Mantenha o arquivo original de pistas para continuar.');
    if (!Number.isSafeInteger(progress.index) || progress.index < 0 || progress.index >= ROUNDS) fail('A rodada diária salva é inválida.');
    if (!Array.isArray(progress.guesses) || progress.guesses.length !== ROUNDS) fail('O desafio precisa de cinco rodadas salvas.');
    var rounds = generatedRounds(date, prepared);
    rounds.forEach(function (round, index) {
      var guesses = progress.guesses[index];
      if (!Array.isArray(guesses) || guesses.length > 3) fail('As tentativas diárias salvas são inválidas.');
      if (index > progress.index && guesses.length) fail('Há tentativas em uma rodada que ainda não começou.');
      var game = G.createGame();
      game.round = round;
      guesses.forEach(function (guess) { G.submitGuess(game, identifier(guess, 'Tentativa diária')); });
      rounds[index] = game.round;
      if (index < progress.index && !game.round.finished) fail('Uma rodada foi pulada no desafio diário.');
    });
    var completed = rounds.every(function (round) { return round.finished; });
    return { date: date, datasetId: prepared.id, index: progress.index, rounds: rounds, completed: completed };
  }

  function compact(day) {
    return { datasetId: day.datasetId, index: day.index, guesses: day.rounds.map(function (round) { return round.guessedIds.slice(); }), completed: day.completed };
  }

  function normalizeState(input, dataset, today) {
    object(input, 'O diário salvo');
    if (input.version !== 1) fail('Versão do diário incompatível.');
    validateDataset(dataset);
    var days = object(input.days, 'Os dias salvos');
    var dates = Object.keys(days);
    if (dates.length > MAX_DAYS) fail('Há dias demais no diário salvo.');
    var next = createState();
    dates.sort().forEach(function (date) {
      var prepared = openDate(date, dataset, today);
      next.days[date] = compact(materialize(days[date], date, prepared));
    });
    return next;
  }

  function stateDays(state) {
    object(state, 'O diário');
    if (state.version !== 1) fail('Versão do diário incompatível.');
    return object(state.days, 'Os dias salvos');
  }

  function readDay(state, date, dataset, today) {
    var days = stateDays(state);
    var prepared = openDate(date, dataset, today);
    if (!own(days, date) && Object.keys(days).length >= MAX_DAYS) fail('O diário atingiu o limite de dias salvos.');
    return materialize(own(days, date) ? days[date] : emptyProgress(prepared), date, prepared);
  }

  function ensureDay(state, date, dataset, today) {
    var day = readDay(state, date, dataset, today);
    state.days[date] = compact(day);
    return day;
  }

  function currentRound(day) {
    return day && day.rounds ? day.rounds[day.index] : null;
  }

  function submitGuess(state, date, friendId, dataset, today) {
    var day = readDay(state, date, dataset, today);
    if (day.completed) fail('Você já terminou esse desafio diário.');
    var game = G.createGame();
    game.round = currentRound(day);
    var result = G.submitGuess(game, friendId);
    day.rounds[day.index] = game.round;
    day.completed = day.rounds.every(function (round) { return round.finished; });
    state.days[date] = compact(day);
    result.day = day;
    return result;
  }

  function nextRound(state, date, dataset, today) {
    var day = readDay(state, date, dataset, today);
    if (day.completed) fail('Você já terminou as cinco rodadas desse dia.');
    if (!currentRound(day).finished) fail('Termine a rodada antes de seguir para a próxima.');
    day.index++;
    state.days[date] = compact(day);
    return day;
  }

  function summary(day) {
    var rounds = day && Array.isArray(day.rounds) ? day.rounds : [];
    return {
      completed: rounds.length === ROUNDS && rounds.every(function (round) { return round.finished; }),
      score: rounds.reduce(function (total, round) { return total + round.points; }, 0),
      wins: rounds.filter(function (round) { return round.finished && round.correct; }).length,
      roundsFinished: rounds.filter(function (round) { return round.finished; }).length,
      totalRounds: ROUNDS
    };
  }

  function streak(state, today) {
    var days = stateDays(state);
    today = validateDate(today || todayKey());
    var completed = Object.keys(days).filter(function (date) { return validateDate(date) <= today && days[date].completed === true; }).sort();
    var best = 0;
    var length = 0;
    var previous = null;
    completed.forEach(function (date) {
      length = previous && addDays(previous, 1) === date ? length + 1 : 1;
      best = Math.max(best, length);
      previous = date;
    });
    var present = new Set(completed);
    var end = present.has(today) ? today : addDays(today, -1);
    var current = 0;
    while (present.has(end)) { current++; end = addDays(end, -1); }
    return { current: current, best: best };
  }

  return { ROUNDS: ROUNDS, createState: createState, normalizeState: normalizeState, validateDataset: validateDataset, validateDate: validateDate, todayKey: todayKey, dateKey: todayKey, addDays: addDays, ensureDay: ensureDay, currentRound: currentRound, submitGuess: submitGuess, nextRound: nextRound, summary: summary, streak: streak };
});

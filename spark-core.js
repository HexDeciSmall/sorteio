(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.SorteioSparkGame = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var START = '2026-10-20';
  var EDITION = '2026-10-21-cap-kv-v1';
  var NANDO_EDITION = '2026-10-24-nando-v1';
  var copy = function (value) { return JSON.parse(JSON.stringify(value)); };
  function fail(code, message) { var error = new Error(message); error.code = 'cloud/' + code; throw error; }
  function plain(value) { return !!value && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value)); }
  function validId(value) { return typeof value === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(value); }
  function requestId(value) { return typeof value === 'string' && /^[A-Za-z0-9_-]{8,80}$/.test(value); }

  function createArchive(settings) {
    if (!settings || !settings.D || !settings.base || !settings.cap || !settings.kv) fail('invalid-argument', 'As pistas do desafio não foram carregadas.');
    var D = settings.D;
    var base = copy(settings.base);
    var updated = Object.assign({}, base, { id: EDITION, startDate: '2026-10-21', profiles: base.profiles.concat(copy(settings.cap), copy(settings.kv)) });
    var archive = { version: 1, startDate: START, friends: base.friends, editions: [{ from: START, dataset: base }, { from: updated.startDate, dataset: updated }] };
    if (Object.prototype.hasOwnProperty.call(settings, 'nando')) {
      var nando = settings.nando;
      if (!plain(nando) || nando.friendId !== 'daily_nando' || nando.name !== 'Nando' || nando.username !== 'nandolrv') fail('invalid-argument', 'O perfil de Nando nas pistas diárias é inválido.');
      var next = Object.assign({}, updated, { id: NANDO_EDITION, startDate: '2026-10-24', profiles: updated.profiles.concat(copy(nando)) });
      if (!D.validateDataset(next).profiles.some(function (profile) { return profile.friendId === 'daily_nando' && profile.username === 'nandolrv'; })) fail('invalid-argument', 'O perfil de Nando precisa de pelo menos três animes avaliados.');
      archive.editions.push({ from: next.startDate, dataset: next });
    }
    D.validateDataset(archive);
    return archive;
  }

  function createEngine(settings) {
    if (!settings || !settings.G) fail('invalid-argument', 'As pistas do desafio não foram carregadas.');
    var D = settings.D;
    var archive = createArchive(settings);

    function checkedDate(date, today) {
      try { D.validateDate(date); D.validateDate(today); } catch (_) { fail('invalid-argument', 'Escolha uma data válida.'); }
      if (date < START) fail('invalid-argument', 'O calendário começa em 20/10/2026.');
      if (date > today) fail('failed-precondition', 'Esse desafio ainda não foi liberado.');
    }
    function serial(day, requests) {
      var summary = D.summary(day);
      return { version: 1, date: day.date, dateNumber: Number(day.date.replace(/-/g, '')), month: day.date.slice(0, 7), datasetId: day.datasetId, index: day.index,
        guesses: day.rounds.map(function (round) { return { ids: round.guessedIds.slice() }; }), completed: day.completed, score: summary.score, wins: summary.wins, requests: copy(requests) };
    }
    function read(raw, date, today) {
      checkedDate(date, today);
      var state = D.createState();
      var requests = [];
      if (raw !== null && raw !== undefined) {
        if (!plain(raw) || raw.version !== 1 || raw.date !== date || raw.dateNumber !== Number(date.replace(/-/g, '')) || raw.month !== date.slice(0, 7) || !Array.isArray(raw.guesses) || raw.guesses.length !== 5 || !Array.isArray(raw.requests) || raw.requests.length > 19) fail('failed-precondition', 'O progresso desse desafio está inconsistente.');
        var ids = new Set();
        requests = raw.requests.map(function (entry) {
          if (!plain(entry) || !requestId(entry.id) || ids.has(entry.id) || typeof entry.fingerprint !== 'string' || entry.fingerprint.length > 120) fail('failed-precondition', 'O histórico de tentativas desse desafio está inconsistente.');
          var fingerprint;
          try { fingerprint = JSON.parse(entry.fingerprint); } catch (_) { fail('failed-precondition', 'O histórico de tentativas desse desafio está inconsistente.'); }
          if (!Array.isArray(fingerprint) || fingerprint.length !== 3 || !['guess', 'next'].includes(fingerprint[0]) || !Number.isInteger(fingerprint[1]) || fingerprint[1] < 0 || fingerprint[1] > 4 || (fingerprint[0] === 'guess' ? !validId(fingerprint[2]) : fingerprint[2] !== null) || JSON.stringify(fingerprint) !== entry.fingerprint) fail('failed-precondition', 'O histórico de tentativas desse desafio está inconsistente.');
          ids.add(entry.id);
          return { id: entry.id, fingerprint: entry.fingerprint };
        });
        var guesses = raw.guesses.map(function (entry) {
          if (!plain(entry) || !Array.isArray(entry.ids) || entry.ids.length > 3 || !entry.ids.every(validId)) fail('failed-precondition', 'As tentativas salvas estão inconsistentes.');
          return entry.ids.slice();
        });
        if (requests.length !== guesses.reduce(function (total, list) { return total + list.length; }, 0) + raw.index) fail('failed-precondition', 'O histórico de tentativas desse desafio está incompleto.');
        state.days[date] = { datasetId: raw.datasetId, index: raw.index, guesses: guesses, completed: raw.completed };
      }
      var day;
      try { state = D.normalizeState(state, archive, today); day = D.ensureDay(state, date, archive, today); }
      catch (_) { fail('failed-precondition', 'As tentativas salvas não correspondem ao desafio.'); }
      var record = serial(day, requests);
      if (raw && (raw.completed !== record.completed || raw.score !== record.score || raw.wins !== record.wins)) fail('failed-precondition', 'O resultado salvo não corresponde às tentativas do desafio.');
      return { record: record, day: day };
    }
    function apply(raw, date, action, today) {
      if (!plain(action) || !['guess', 'next'].includes(action.kind) || !Number.isInteger(action.index) || action.index < 0 || action.index > 4 || !requestId(action.id) || action.kind === 'guess' && !validId(action.friendId)) fail('invalid-argument', 'A tentativa informada é inválida.');
      var current = read(raw, date, today);
      var fingerprint = JSON.stringify([action.kind, action.index, action.kind === 'guess' ? action.friendId : null]);
      var previous = current.record.requests.find(function (entry) { return entry.id === action.id; });
      if (previous) {
        if (previous.fingerprint !== fingerprint) fail('already-exists', 'Esta solicitação já foi usada para outra tentativa.');
        return { record: current.record, day: current.day, changed: false };
      }
      if (current.day.completed) fail('failed-precondition', 'Você já terminou esse desafio diário.');
      if (action.index !== current.day.index) fail('failed-precondition', 'Sua partida foi atualizada. Recarregue o desafio para continuar.');
      var round = current.day.rounds[current.day.index];
      if (action.kind === 'guess' && round.guessedIds.includes(action.friendId)) fail('already-exists', 'Esse nome já foi tentado nesta rodada.');
      var state = D.createState();
      state.days[date] = { datasetId: current.record.datasetId, index: current.record.index, guesses: current.record.guesses.map(function (entry) { return entry.ids.slice(); }), completed: current.record.completed };
      var day;
      try { day = action.kind === 'guess' ? D.submitGuess(state, date, action.friendId, archive, today).day : D.nextRound(state, date, archive, today); }
      catch (error) { fail('failed-precondition', error.message); }
      current.record.requests.push({ id: action.id, fingerprint: fingerprint });
      if (current.record.requests.length > 19) fail('failed-precondition', 'O desafio atingiu o limite de tentativas.');
      return { record: serial(day, current.record.requests), day: day, changed: true };
    }
    function redact(day) {
      return { date: day.date, datasetId: day.datasetId, index: day.index, completed: day.completed, rounds: day.rounds.map(function (round, index) {
        var opened = index <= day.index;
        var revealed = opened && round.finished;
        return { id: round.id, clues: opened ? copy(round.clues) : [], options: opened ? copy(round.options) : [], guessedIds: opened ? round.guessedIds.slice() : [], finished: opened && round.finished, correct: opened && round.correct, points: opened ? round.points : 0, preview: false,
          targetId: revealed ? round.targetId : null, targetName: revealed ? round.targetName : null, username: revealed ? round.username : null };
      }) };
    }
    function response(day, days, today) {
      checkedDate(day.date, today);
      if (!Array.isArray(days)) fail('invalid-argument', 'O calendário salvo é inválido.');
      var progress = {};
      var metadata = days.map(function (entry) {
        if (!plain(entry)) fail('failed-precondition', 'O calendário salvo é inválido.');
        checkedDate(entry.date, today);
        if (typeof entry.completed !== 'boolean' || typeof entry.started !== 'boolean' || Object.prototype.hasOwnProperty.call(progress, entry.date)) fail('failed-precondition', 'O calendário salvo é inválido.');
        progress[entry.date] = { completed: entry.completed };
        return { date: entry.date, completed: entry.completed, started: entry.started };
      }).sort(function (a, b) { return a.date.localeCompare(b.date); });
      return { today: today, startDate: START, day: redact(day), streak: D.streak({ version: 1, days: progress }, today), days: metadata };
    }
    return Object.freeze({ read: read, apply: apply, redact: redact, response: response });
  }
  return Object.freeze({ createEngine: createEngine, createArchive: createArchive });
});

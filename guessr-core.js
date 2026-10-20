(function (root, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.GuessrCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  var STATUSES = ['CURRENT', 'PLANNING', 'COMPLETED', 'DROPPED', 'PAUSED', 'REPEATING'];
  var MAX_RECENT = 12;
  var MAX_TOTAL = 1000000000;
  var fail = function (message) { throw new Error(message); };
  var own = function (value, key) { return Object.prototype.hasOwnProperty.call(value, key); };

  function object(value, label) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail(label + ' deve ser um objeto.');
    var proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) fail(label + ' possui formato inválido.');
    return value;
  }

  function text(value, max, label) {
    if (typeof value !== 'string') fail(label + ' deve ser um texto.');
    var result = value.trim();
    if (!result || result.length > max || /[\u0000-\u001f\u007f]/.test(result)) fail(label + ' possui formato inválido.');
    return result;
  }

  function id(value, label) {
    if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(value)) fail(label + ' possui identificador inválido.');
    return value;
  }

  function integer(value, max, label) {
    if (!Number.isSafeInteger(value) || value < 0 || value > max) fail(label + ' possui valor inválido.');
    return value;
  }

  function mediaId(value) {
    if (!Number.isSafeInteger(value) || value < 1) fail('O anime possui identificador inválido.');
    return value;
  }

  function array(value, max, label) {
    if (!Array.isArray(value) || value.length > max) fail(label + ' deve ser uma lista de até ' + max + ' itens.');
    return value;
  }

  function username(value) {
    if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,60}$/.test(value.trim())) return null;
    return value.trim();
  }

  function cover(value) {
    if (typeof value !== 'string' || value.length > 2048 || /[\u0000-\u0020\u007f]/.test(value)) return null;
    try {
      var url = new URL(value);
      if (url.protocol !== 'https:' || !['s4.anilist.co', 's3.anilist.co', 'cdn.myanimelist.net'].includes(url.hostname) || url.username || url.password || url.port) return null;
      url.hash = '';
      return url.href;
    } catch (error) { return null; }
  }

  function normalizeEntry(value) {
    object(value, 'Anime avaliado');
    var score = value.score;
    if (typeof score !== 'number' || !Number.isFinite(score) || score <= 0 || score > 10) fail('A pista precisa de uma nota real entre 0 e 10.');
    score = Math.round(score * 10) / 10;
    if (!score) fail('A pista precisa de uma nota real maior que zero.');
    var status = typeof value.status === 'string' ? value.status.trim().toUpperCase() : '';
    if (!STATUSES.includes(status)) fail('A pista possui status do AniList inválido.');
    return {
      mediaId: mediaId(value.mediaId), name: text(value.name, 200, 'Título do anime'),
      coverUrl: cover(value.coverUrl), score: score, status: status,
      malId: value.malId === null || value.malId === undefined ? null : mediaId(value.malId)
    };
  }

  function eligibleProfiles(profiles) {
    var seen = new Set();
    return array(profiles, 100, 'Perfis do Guessr').map(function (profile) {
      object(profile, 'Perfil do Guessr');
      var friendId = id(profile.friendId, 'Amigo do perfil');
      if (seen.has(friendId)) fail('O mesmo amigo possui mais de uma lista no Guessr.');
      seen.add(friendId);
      var name = text(profile.name, 80, 'Nome do amigo');
      var user = username(profile.username);
      var ids = new Set();
      var entries = [];
      array(profile.entries, 10000, 'Animes avaliados').forEach(function (raw) {
        var entry;
        try { entry = normalizeEntry(raw); } catch (error) { return; }
        if (ids.has(entry.mediaId)) return;
        ids.add(entry.mediaId);
        entries.push(entry);
      });
      return { friendId: friendId, name: name, username: user, entries: entries };
    }).filter(function (profile) { return profile.username !== null && profile.entries.length >= 3; });
  }

  function optionsList(value) {
    var ids = new Set();
    var names = new Set();
    var options = array(value, 100, 'Nomes do Guessr').map(function (friend) {
      object(friend, 'Opção do Guessr');
      var option = { id: id(friend.id, 'Amigo'), name: text(friend.name, 80, 'Nome do amigo') };
      var name = option.name.normalize('NFC').toLocaleLowerCase('pt-BR');
      if (ids.has(option.id) || names.has(name)) fail('As opções do Guessr contêm amigos repetidos.');
      ids.add(option.id);
      names.add(name);
      return option;
    });
    if (!options.length) fail('Adicione os nomes dos amigos antes de jogar o Guessr.');
    return options;
  }

  function secureIndex(length) {
    if (root.crypto && typeof root.crypto.getRandomValues === 'function') {
      var buffer = new Uint32Array(1);
      var limit = 4294967296 - (4294967296 % length);
      do { root.crypto.getRandomValues(buffer); } while (buffer[0] >= limit);
      return buffer[0] % length;
    }
    return Math.floor(Math.random() * length);
  }

  function uid() {
    if (root.crypto && typeof root.crypto.randomUUID === 'function') return root.crypto.randomUUID();
    var bytes = new Uint8Array(12);
    if (root.crypto && typeof root.crypto.getRandomValues === 'function') root.crypto.getRandomValues(bytes);
    else for (var i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    return 'g_' + Date.now().toString(36) + '_' + Array.from(bytes, function (value) { return value.toString(16).padStart(2, '0'); }).join('');
  }

  function shuffled(value, randomIndex) {
    var result = value.slice();
    for (var i = result.length - 1; i > 0; i--) {
      var j = randomIndex(i + 1);
      var item = result[i]; result[i] = result[j]; result[j] = item;
    }
    return result;
  }

  function trioKey(clues) {
    return clues.map(function (entry) { return entry.mediaId; }).sort(function (a, b) { return a - b; }).join(',');
  }

  function sameEvaluation(a, b) {
    return a && b && a.mediaId === b.mediaId && a.score === b.score && a.status === b.status;
  }

  function distinctiveClues(target, profiles) {
    var others = profiles.filter(function (profile) { return profile.friendId !== target.friendId; });
    if (!others.length) return null;
    var candidates = target.entries.map(function (entry) {
      var differences = [];
      others.forEach(function (profile, index) {
        if (!sameEvaluation(entry, profile.index.get(entry.mediaId))) differences.push(index);
      });
      return { entry: entry, differences: differences };
    }).filter(function (candidate) { return candidate.differences.length; });
    var uncovered = new Set(others.map(function (_, index) { return index; }));
    var selected = [];
    for (var slot = 0; slot < 3 && uncovered.size; slot++) {
      var best = null;
      var bestCount = 0;
      candidates.forEach(function (candidate) {
        if (selected.includes(candidate.entry)) return;
        var count = candidate.differences.filter(function (index) { return uncovered.has(index); }).length;
        if (count > bestCount) { best = candidate; bestCount = count; }
      });
      if (!best) return null;
      selected.push(best.entry);
      best.differences.forEach(function (index) { uncovered.delete(index); });
    }
    return uncovered.size ? null : selected;
  }

  function candidateFor(target, profiles, recent, randomIndex) {
    var tried = new Set();
    var fallback = null;
    var entries = target.entries;
    var indexes = [0, 1, 2];
    for (var attempt = 0; attempt < 120; attempt++) {
      var clues;
      if (attempt < 72) {
        var chosen = new Set();
        var pool = entries.map(function (_, i) { return i; });
        for (var slot = 0; slot < 3; slot++) {
          var pick = randomIndex(pool.length);
          chosen.add(pool[pick]);
          pool.splice(pick, 1);
        }
        clues = Array.from(chosen, function (index) { return entries[index]; });
      } else {
        clues = indexes.map(function (index) { return entries[index]; });
        if (indexes[2] + 1 < entries.length) indexes[2]++;
        else if (indexes[1] + 2 < entries.length) { indexes[1]++; indexes[2] = indexes[1] + 1; }
        else if (indexes[0] + 3 < entries.length) { indexes[0]++; indexes[1] = indexes[0] + 1; indexes[2] = indexes[1] + 1; }
        else indexes = null;
      }
      var key = trioKey(clues);
      if (!tried.has(key)) {
        tried.add(key);
        var ambiguous = profiles.some(function (profile) {
          return profile.friendId !== target.friendId && clues.every(function (clue) { return sameEvaluation(clue, profile.index.get(clue.mediaId)); });
        });
        if (!ambiguous) {
          if (!recent.includes(key)) return { target: target, clues: clues, key: key };
          if (!fallback) fallback = { target: target, clues: clues, key: key };
        }
      }
      if (attempt >= 72 && indexes === null) break;
    }
    var distinctive = distinctiveClues(target, profiles);
    if (distinctive) {
      for (var offset = 0; offset < 13; offset++) {
        var guided = distinctive.slice();
        for (var fill = 0; guided.length < 3 && fill < entries.length; fill++) {
          var entry = entries[(offset + fill) % entries.length];
          if (!guided.includes(entry)) guided.push(entry);
        }
        var guidedKey = trioKey(guided);
        if (tried.has(guidedKey)) continue;
        tried.add(guidedKey);
        var guidedAmbiguous = profiles.some(function (profile) {
          return profile.friendId !== target.friendId && guided.every(function (clue) { return sameEvaluation(clue, profile.index.get(clue.mediaId)); });
        });
        if (!guidedAmbiguous) {
          var guidedCandidate = { target: target, clues: guided, key: guidedKey };
          if (!recent.includes(guidedKey)) return guidedCandidate;
          if (!fallback) fallback = guidedCandidate;
        }
      }
    }
    return fallback;
  }

  function createGame() {
    return { version: 1, score: 0, stats: { rounds: 0, wins: 0, misses: 0, previews: 0 }, round: null, recent: [], lastTargetId: null };
  }

  function normalizeGame(input) {
    object(input, 'O jogo salvo');
    if (input.version !== 1) fail('Versão do Guessr incompatível.');
    var stats = object(input.stats, 'Estatísticas do Guessr');
    var game = { version: 1, score: integer(input.score, MAX_TOTAL, 'Pontuação'), stats: {}, round: null, recent: [], lastTargetId: input.lastTargetId === null ? null : id(input.lastTargetId, 'Último alvo') };
    ['rounds', 'wins', 'misses', 'previews'].forEach(function (key) { game.stats[key] = integer(stats[key], MAX_TOTAL, 'Estatística ' + key); });
    if (game.stats.wins > game.stats.rounds) fail('As estatísticas do Guessr estão inconsistentes.');
    game.recent = array(input.recent, MAX_RECENT, 'Trios recentes').map(function (key) {
      if (typeof key !== 'string' || !/^\d+,\d+,\d+$/.test(key)) fail('O histórico recente do Guessr é inválido.');
      var ids = key.split(',').map(function (value) { return mediaId(Number(value)); });
      if (new Set(ids).size !== 3 || ids.slice().sort(function (a, b) { return a - b; }).join(',') !== key) fail('O histórico recente do Guessr é inválido.');
      return key;
    });
    if (input.round === null) return game;
    var raw = object(input.round, 'Rodada do Guessr');
    var options = optionsList(raw.options);
    var targetId = id(raw.targetId, 'Alvo da rodada');
    var target = options.find(function (option) { return option.id === targetId; });
    if (!target) fail('O alvo do Guessr não aparece entre as opções.');
    var user = username(raw.username);
    if (!user) fail('O alvo do Guessr precisa de um perfil válido.');
    var clues = array(raw.clues, 3, 'Pistas do Guessr').map(normalizeEntry);
    if (clues.length !== 3 || new Set(clues.map(function (clue) { return clue.mediaId; })).size !== 3) fail('A rodada precisa de três animes diferentes e avaliados.');
    var guesses = array(raw.guessedIds, 3, 'Tentativas do Guessr').map(function (value) {
      id(value, 'Tentativa');
      if (!options.some(function (option) { return option.id === value; })) fail('Uma tentativa do Guessr não existe nas opções.');
      return value;
    });
    if (new Set(guesses).size !== guesses.length || guesses.slice(0, -1).includes(targetId)) fail('As tentativas do Guessr estão inconsistentes.');
    var correct = guesses.length > 0 && guesses[guesses.length - 1] === targetId;
    var finished = correct || guesses.length >= 3 || guesses.length >= options.length;
    if (typeof raw.preview !== 'boolean' || raw.correct !== correct || raw.finished !== finished) fail('O resultado salvo do Guessr está inconsistente.');
    var points = correct && !raw.preview ? 4 - guesses.length : 0;
    if (raw.points !== points) fail('A pontuação da rodada do Guessr está inconsistente.');
    game.round = { id: id(raw.id, 'Rodada'), targetId: targetId, targetName: target.name, username: user, clues: clues, options: options, guessedIds: guesses, finished: finished, correct: correct, points: points, preview: raw.preview };
    return game;
  }

  function replaceGame(game, next) {
    Object.keys(game).forEach(function (key) { delete game[key]; });
    Object.assign(game, next);
  }

  function createRound(game, profiles, friends, settings) {
    var next = normalizeGame(game);
    settings = settings || {};
    var indexSource = typeof settings.randomIndex === 'function' ? settings.randomIndex : secureIndex;
    var randomIndex = function (length) {
      var result = indexSource(length);
      if (!Number.isSafeInteger(result) || result < 0 || result >= length) fail('O sorteio do Guessr retornou uma posição inválida.');
      return result;
    };
    if (next.round && !next.round.finished) fail('Termine a rodada atual ou reinicie o Guessr antes de começar outra.');
    var options = optionsList(friends);
    var optionIds = new Set(options.map(function (option) { return option.id; }));
    var eligible = eligibleProfiles(profiles).filter(function (profile) { return optionIds.has(profile.friendId); });
    if (!eligible.length) fail('Vincule um perfil com pelo menos três animes avaliados para abrir a prévia do Guessr.');
    eligible.forEach(function (profile) { profile.index = new Map(profile.entries.map(function (entry) { return [entry.mediaId, entry]; })); });
    var preferred = eligible.filter(function (profile) { return eligible.length === 1 || profile.friendId !== next.lastTargetId; });
    var groups = [shuffled(preferred, randomIndex), shuffled(eligible.filter(function (profile) { return profile.friendId === next.lastTargetId && eligible.length > 1; }), randomIndex)];
    var candidate = null;
    for (var groupIndex = 0; groupIndex < groups.length && !candidate; groupIndex++) {
      var fallback = null;
      for (var i = 0; i < groups[groupIndex].length; i++) {
        var found = candidateFor(groups[groupIndex][i], eligible, next.recent, randomIndex);
        if (found && !next.recent.includes(found.key)) { candidate = found; break; }
        if (found && !fallback) fallback = found;
      }
      if (!candidate) candidate = fallback;
    }
    if (!candidate) fail('As listas têm avaliações iguais nas pistas disponíveis. Atualize as listas ou vincule outro perfil para criar uma rodada sem ambiguidade.');
    var target = options.find(function (option) { return option.id === candidate.target.friendId; });
    next.round = { id: settings.roundId === undefined ? uid() : id(settings.roundId, 'Rodada'), targetId: target.id, targetName: target.name, username: candidate.target.username, clues: candidate.clues.map(function (clue) { return Object.assign({}, clue); }), options: options, guessedIds: [], finished: false, correct: false, points: 0, preview: eligible.length === 1 };
    next.lastTargetId = target.id;
    next.recent.push(candidate.key);
    if (next.recent.length > MAX_RECENT) next.recent.splice(0, next.recent.length - MAX_RECENT);
    replaceGame(game, next);
    return game.round;
  }

  function submitGuess(game, friendId) {
    var next = normalizeGame(game);
    var round = next.round;
    if (!round) fail('Comece uma rodada do Guessr antes de escolher um nome.');
    if (round.finished) fail('Esta rodada do Guessr já terminou. Comece a próxima.');
    if (!round.options.some(function (option) { return option.id === friendId; })) fail('Escolha um dos nomes disponíveis.');
    if (round.guessedIds.includes(friendId)) fail('Esse nome já foi tentado nesta rodada.');
    round.guessedIds.push(friendId);
    round.correct = friendId === round.targetId;
    round.finished = round.correct || round.guessedIds.length >= 3 || round.guessedIds.length >= round.options.length;
    round.points = round.correct && !round.preview ? 4 - round.guessedIds.length : 0;
    if (!round.preview && !round.correct) next.stats.misses++;
    if (round.finished) {
      if (round.preview) next.stats.previews++;
      else {
        next.stats.rounds++;
        if (round.correct) next.stats.wins++;
        next.score += round.points;
      }
    }
    next = normalizeGame(next);
    replaceGame(game, next);
    return { correct: game.round.correct, finished: game.round.finished, points: game.round.points, remaining: Math.max(0, 3 - game.round.guessedIds.length), preview: game.round.preview };
  }

  function restart(game) {
    object(game, 'O jogo');
    replaceGame(game, createGame());
    return game;
  }

  function clearScore(game) {
    var next = normalizeGame(game);
    next.score = 0;
    next.stats = createGame().stats;
    replaceGame(game, next);
    return game;
  }

  return { createGame: createGame, normalizeGame: normalizeGame, loadGame: normalizeGame, eligibleProfiles: eligibleProfiles, createRound: createRound, submitGuess: submitGuess, restart: restart, clearScore: clearScore };
});

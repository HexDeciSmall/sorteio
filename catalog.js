(function (root, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.AnimeServices = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  // Tenrai preserves Jikan's MAL catalog schema after Jikan's public service ended.
  // Keep the service endpoint in source; imported group data cannot change it.
  var JIKAN = 'https://api.tenrai.org/v1/anime';
  var ANILIST = 'https://graphql.anilist.co';
  var TIMEOUT = 10000;
  var searchCache = new Map();
  var ratingCache = new Map();
  var mediaCache = new Map();
  var publicListCache = new Map();
  var queues = {
    jikan: { tail: Promise.resolve(), nextAt: 0, delay: 1100 },
    anilist: { tail: Promise.resolve(), nextAt: 0, delay: 2200 }
  };
  var labels = {
    CURRENT: 'Assistindo', PLANNING: 'Quero assistir', COMPLETED: 'Concluído',
    DROPPED: 'Abandonado', PAUSED: 'Pausado', REPEATING: 'Reassistindo'
  };

  function serviceError(code, message, status, data) {
    var error = new Error(message);
    error.code = code;
    if (status) error.status = status;
    if (data) error.data = data;
    return error;
  }

  function abortError() {
    var error = new Error('Consulta cancelada.');
    error.name = 'AbortError';
    return error;
  }

  function checkAbort(signal) {
    if (signal && signal.aborted) throw abortError();
  }

  function abortable(promise, signal) {
    if (!signal) return promise;
    if (signal.aborted) return Promise.reject(abortError());
    return new Promise(function (resolve, reject) {
      function cancel() { cleanup(); reject(abortError()); }
      function cleanup() { signal.removeEventListener('abort', cancel); }
      signal.addEventListener('abort', cancel, { once: true });
      Promise.resolve(promise).then(function (result) { cleanup(); resolve(result); }, function (error) { cleanup(); reject(error); });
    });
  }

  function pause(ms, signal) {
    if (ms <= 0) { checkAbort(signal); return Promise.resolve(); }
    return new Promise(function (resolve, reject) {
      checkAbort(signal);
      var timer = root.setTimeout(function () { cleanup(); resolve(); }, ms);
      function cancel() { root.clearTimeout(timer); cleanup(); reject(abortError()); }
      function cleanup() { if (signal) signal.removeEventListener('abort', cancel); }
      if (signal) signal.addEventListener('abort', cancel, { once: true });
    });
  }

  function enqueue(provider, signal, task) {
    var queue = queues[provider];
    var pending = queue.tail.then(async function () {
      checkAbort(signal);
      await pause(queue.nextAt - Date.now(), signal);
      checkAbort(signal);
      queue.nextAt = Date.now() + queue.delay;
      return task();
    });
    queue.tail = pending.catch(function () {});
    return abortable(pending, signal);
  }

  function copy(value) { return JSON.parse(JSON.stringify(value)); }

  function cacheGet(cache, key) {
    var entry = cache.get(key);
    if (!entry) return null;
    if (entry.expires <= Date.now()) { cache.delete(key); return null; }
    cache.delete(key);
    cache.set(key, entry);
    return copy(entry.value);
  }

  function cacheSet(cache, key, value, ttl, max) {
    cache.delete(key);
    cache.set(key, { value: copy(value), expires: Date.now() + ttl });
    while (cache.size > max) cache.delete(cache.keys().next().value);
  }

  function text(value, max) {
    return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : '';
  }

  function id(value) { return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 && value <= 2147483647 ? value : null; }
  function integer(value) { return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 1000000 ? value : null; }
  function score(value) { return typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 10 ? value : null; }

  function cover(value) {
    if (typeof value !== 'string' || value.length > 2048) return null;
    try {
      var url = new URL(value);
      return url.protocol === 'https:' && url.hostname === 'cdn.myanimelist.net' && !url.username && !url.password && !url.port ? url.href : null;
    } catch (_) { return null; }
  }

  function mediaUrl(value, mediaId) {
    try {
      if (typeof value !== 'string' || value.length > 2048) throw new Error('URL inválida');
      var url = new URL(value);
      if (url.protocol === 'https:' && url.hostname === 'anilist.co' && !url.username && !url.password && !url.port && /^\/anime\/\d+(?:\/[^?#]*)?\/?$/.test(url.pathname)) return url.href;
    } catch (_) {}
    return mediaId ? 'https://anilist.co/anime/' + mediaId : null;
  }

  async function requestJSON(provider, url, options, signal) {
    return enqueue(provider, signal, async function () {
      if (typeof root.fetch !== 'function') throw serviceError('network', 'Este navegador não permite consultar o catálogo.');
      var controller = new root.AbortController();
      var timedOut = false;
      var timer = root.setTimeout(function () { timedOut = true; controller.abort(); }, TIMEOUT);
      function cancel() { controller.abort(); }
      if (signal) signal.addEventListener('abort', cancel, { once: true });
      try {
        checkAbort(signal);
        var init = Object.assign({}, options, { signal: controller.signal });
        var response = await abortable(root.fetch(url, init), controller.signal);
        var data;
        try { data = await abortable(response.json(), controller.signal); }
        catch (error) {
          if (error.name === 'AbortError') throw error;
          if (response.status === 429) throw serviceError('busy', 'O serviço está ocupado. Aguarde um pouco e tente novamente.', 429);
          throw serviceError('response', 'O serviço enviou uma resposta inválida. Tente novamente.');
        }
        if (response.status === 429) throw serviceError('busy', 'O serviço está ocupado. Aguarde um pouco e tente novamente.', 429, data);
        if (!response.ok) throw serviceError('http', 'Não foi possível consultar o serviço agora. Tente novamente.', response.status, data);
        if (!data || typeof data !== 'object') throw serviceError('response', 'O serviço enviou uma resposta inválida. Tente novamente.');
        return data;
      } catch (error) {
        if (signal && signal.aborted) throw abortError();
        if (timedOut) throw serviceError('timeout', 'A consulta demorou demais. Tente novamente.');
        if (error.code) throw error;
        throw serviceError('network', 'Não foi possível conectar ao serviço. Verifique sua conexão e tente novamente.');
      } finally {
        root.clearTimeout(timer);
        if (signal) signal.removeEventListener('abort', cancel);
      }
    });
  }

  async function searchAnime(query, options) {
    var signal = options && options.signal;
    checkAbort(signal);
    var normalized = text(query, 200);
    if (normalized.length < 2) return [];
    var key = normalized.toLocaleLowerCase();
    var cached = cacheGet(searchCache, key);
    if (cached) return cached;
    var response = await requestJSON('jikan', JIKAN + '?q=' + encodeURIComponent(normalized) + '&limit=8', { method: 'GET', headers: { Accept: 'application/json' } }, signal);
    if (!Array.isArray(response.data)) throw serviceError('response', 'Não foi possível ler os animes encontrados. Tente novamente.');
    var seen = new Set();
    var results = [];
    response.data.slice(0, 100).forEach(function (item) {
      if (!item || results.length >= 8) return;
      var malId = id(item.mal_id);
      var name = text(item.title, 200) || text(item.title_english, 200);
      if (!malId || !name || seen.has(malId)) return;
      seen.add(malId);
      var images = item.images || {};
      var jpg = images.jpg || {};
      var webp = images.webp || {};
      results.push({
        name: name, malId: malId,
        coverUrl: cover(jpg.image_url) || cover(webp.image_url) || cover(jpg.large_image_url),
        malScore: score(item.score), malUrl: 'https://myanimelist.net/anime/' + malId,
        year: integer(item.year) && item.year <= 9999 ? item.year : null,
        episodes: integer(item.episodes), type: text(item.type, 24) || null
      });
    });
    checkAbort(signal);
    cacheSet(searchCache, key, results, 10 * 60 * 1000, 100);
    return copy(results);
  }

  function gqlErrors(payload) { return payload && Array.isArray(payload.errors) ? payload.errors : []; }

  function isPrivate(errors, status) {
    return status === 401 || status === 403 || errors.some(function (error) {
      var code = error && (error.status || (error.extensions && error.extensions.status));
      return code === 401 || code === 403 || /private|unauthori[sz]ed|forbidden|permission/i.test(String(error && error.message || ''));
    });
  }

  function isNotFound(errors, status) {
    return status === 404 || (errors.length > 0 && errors.every(function (error) {
      var code = error && (error.status || (error.extensions && error.extensions.status));
      return code === 404 || /not\s*found/i.test(String(error && error.message || ''));
    }));
  }

  function hasRateLimit(errors) {
    return errors.some(function (error) {
      return error && (error.status === 429 || (error.extensions && error.extensions.status === 429) || /rate.?limit|too many requests/i.test(String(error.message || '')));
    });
  }

  async function graphql(query, variables, signal) {
    var payload = await requestJSON('anilist', ANILIST, {
      method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: query, variables: variables })
    }, signal);
    if (hasRateLimit(gqlErrors(payload))) throw serviceError('busy', 'O AniList está ocupado. Aguarde um pouco e tente novamente.', 429);
    return payload;
  }

  function statusLabel(status) { return labels[status] || ''; }

  async function getFriendRating(username, malId, options) {
    var signal = options && options.signal;
    checkAbort(signal);
    var name = typeof username === 'string' ? username.trim() : '';
    var profileUrl = 'https://anilist.co/user/' + encodeURIComponent(name);
    var result = { kind: 'unavailable', score: null, status: null, episodes: null, profileUrl: profileUrl, mediaUrl: null };
    if (!/^[a-zA-Z0-9_-]{1,60}$/.test(name) || !id(malId)) {
      result.message = 'Informe um usuário do AniList e selecione um anime do catálogo.';
      return result;
    }
    var cacheKey = name.toLocaleLowerCase() + ':' + malId;
    var cached = cacheGet(ratingCache, cacheKey);
    if (cached) return cached;
    var mapping = cacheGet(mediaCache, String(malId));
    var verifiedUser = null;
    try {
      if (!mapping) {
        var initial = await graphql('query FriendAnime($username: String!, $malId: Int!) { User(name: $username) { id name } Media(idMal: $malId, type: ANIME) { id siteUrl } }', { username: name, malId: malId }, signal);
        var initialErrors = gqlErrors(initial);
        if (initialErrors.length || !initial.data || !initial.data.User || !id(initial.data.User.id)) {
          if (isPrivate(initialErrors)) result.message = 'O perfil ou a lista não está disponível publicamente.';
          else if (initial.data && initial.data.User && id(initial.data.User.id)) {
            result.message = isNotFound(initialErrors) && !initial.data.Media ? 'Este anime não foi encontrado no AniList.' : 'Não foi possível consultar o AniList agora. Tente novamente.';
          } else result.message = 'Não foi possível encontrar esse perfil público no AniList.';
          return result;
        }
        verifiedUser = initial.data.User;
        var media = initial.data.Media;
        if (!media || !id(media.id)) {
          result.message = 'Este anime não foi encontrado no AniList.';
          return result;
        }
        mapping = { id: media.id, url: mediaUrl(media.siteUrl, media.id) };
        cacheSet(mediaCache, String(malId), mapping, 24 * 60 * 60 * 1000, 200);
      }
      result.mediaUrl = mapping.url;
      var payload;
      try {
        payload = await graphql('query FriendRating($username: String!, $mediaId: Int!) { User(name: $username) { id name } MediaList(userName: $username, mediaId: $mediaId, type: ANIME) { score(format: POINT_10_DECIMAL) status progress } }', { username: name, mediaId: mapping.id }, signal);
      } catch (error) {
        if (error.name === 'AbortError') throw error;
        if (!isPrivate(gqlErrors(error.data), error.status) && isNotFound(gqlErrors(error.data), error.status)) {
          if (!verifiedUser) {
            var verification = await graphql('query PublicFriend($username: String!) { User(name: $username) { id name } }', { username: name }, signal);
            if (!gqlErrors(verification).length && verification.data && verification.data.User && id(verification.data.User.id)) verifiedUser = verification.data.User;
          }
          if (!verifiedUser) throw error;
          payload = { data: { User: verifiedUser, MediaList: null } };
        } else { throw error; }
      }
      var errors = gqlErrors(payload);
      if (isPrivate(errors)) {
        result.message = 'O perfil ou a lista não está disponível publicamente.';
        return result;
      }
      var data = payload.data || {};
      var user = data && data.User;
      if (!user && verifiedUser && isNotFound(errors)) user = verifiedUser;
      if (!user || !id(user.id)) {
        result.message = 'Não foi possível encontrar esse perfil público no AniList.';
        return result;
      }
      var canonical = text(user.name, 60);
      if (canonical) result.profileUrl = 'https://anilist.co/user/' + encodeURIComponent(canonical);
      var entry = data.MediaList;
      if (errors.length && (!isNotFound(errors) || entry)) {
        result.message = 'Não foi possível consultar a lista pública do AniList.';
        return result;
      }
      if (!Object.prototype.hasOwnProperty.call(data, 'MediaList') && !isNotFound(errors)) {
        result.message = 'O AniList enviou uma resposta incompleta. Tente novamente.';
        return result;
      }
      if (!entry) {
        result.kind = 'not-listed';
        result.message = 'Não consta na lista pública.';
      } else {
        if (typeof entry !== 'object' || (entry.score !== null && entry.score !== undefined && (typeof entry.score !== 'number' || !Number.isFinite(entry.score) || entry.score < 0 || entry.score > 10))) {
          result.message = 'O AniList enviou uma nota inválida. Tente novamente.';
          return result;
        }
        result.score = score(entry.score);
        result.status = Object.prototype.hasOwnProperty.call(labels, entry.status) ? entry.status : null;
        result.episodes = integer(entry.progress);
        result.kind = result.score === null ? 'unrated' : 'rated';
      }
      checkAbort(signal);
      cacheSet(ratingCache, cacheKey, result, 5 * 60 * 1000, 200);
      return copy(result);
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      if (isPrivate(gqlErrors(error.data), error.status)) result.message = 'O perfil ou a lista não está disponível publicamente.';
      else result.message = error.message || 'Não foi possível consultar o AniList agora. Tente novamente.';
      return result;
    }
  }

  function publicListCover(value) {
    if (typeof value !== 'string' || value.length > 2048 || /[\u0000-\u0020\u007f]/.test(value)) return null;
    try {
      var url = new URL(value);
      if (url.protocol !== 'https:' || !['s4.anilist.co', 'cdn.myanimelist.net'].includes(url.hostname) || url.username || url.password || url.port) return null;
      url.hash = '';
      return url.href;
    } catch (_) { return null; }
  }

  async function getPublicAnimeList(username, options) {
    var signal = options && options.signal;
    checkAbort(signal);
    var name = typeof username === 'string' ? username.trim() : '';
    if (!/^[a-zA-Z0-9_-]{1,60}$/.test(name)) throw serviceError('invalid', 'Informe um usuário válido do AniList, com até 60 letras, números, hífens ou sublinhados.');
    var key = name.toLocaleLowerCase();
    var cached = cacheGet(publicListCache, key);
    if (cached) return cached;
    var entries = new Map();
    var query = 'query PublicAnimeList($username: String!, $chunk: Int!) { MediaListCollection(userName: $username, type: ANIME, chunk: $chunk, perChunk: 500) { hasNextChunk user { name } lists { entries { mediaId score(format: POINT_10_DECIMAL) status private media { id idMal isAdult title { romaji english } coverImage { large } } } } } }';
    try {
      for (var chunk = 1; chunk <= 20; chunk++) {
        var payload = await graphql(query, { username: name, chunk: chunk }, signal);
        var errors = gqlErrors(payload);
        if (errors.length) {
          if (isPrivate(errors)) throw serviceError('private', 'O perfil ou a lista de animes não está disponível publicamente.');
          if (isNotFound(errors)) throw serviceError('not-found', 'Não foi possível encontrar essa lista pública no AniList.');
          throw serviceError('response', 'O AniList não conseguiu carregar a lista completa. Tente novamente.');
        }
        var collection = payload.data && payload.data.MediaListCollection;
        if (!collection || typeof collection !== 'object' || !Array.isArray(collection.lists) || typeof collection.hasNextChunk !== 'boolean') {
          throw serviceError('response', 'O AniList enviou uma lista incompleta ou indisponível. Tente novamente.');
        }
        var canonical = collection.user && collection.user.name;
        if (typeof canonical === 'string' && /^[a-zA-Z0-9_-]{1,60}$/.test(canonical)) name = canonical;
        collection.lists.forEach(function (group) {
          if (!group || !Array.isArray(group.entries)) throw serviceError('response', 'O AniList enviou uma lista incompleta. Tente novamente.');
          group.entries.forEach(function (entry) {
            if (!entry || typeof entry !== 'object' || entry.private !== false) return;
            var media = entry.media;
            if (!media || typeof media !== 'object' || media.isAdult !== false || !id(entry.mediaId) || !id(media.id) || entry.mediaId !== media.id || !Object.prototype.hasOwnProperty.call(labels, entry.status)) return;
            var value = score(entry.score);
            if (value === null) return;
            value = Math.round((value + Number.EPSILON) * 10) / 10;
            if (value <= 0) return;
            var title = media.title;
            var titleName = title && (text(title.english, 200) || text(title.romaji, 200));
            if (!titleName || entries.has(media.id)) return;
            entries.set(media.id, {
              mediaId: media.id, malId: id(media.idMal), name: titleName,
              coverUrl: publicListCover(media.coverImage && media.coverImage.large),
              score: value, status: entry.status
            });
          });
        });
        if (!collection.hasNextChunk) {
          checkAbort(signal);
          var result = { username: name, entries: Array.from(entries.values()), profileUrl: 'https://anilist.co/user/' + encodeURIComponent(name) };
          cacheSet(publicListCache, key, result, 5 * 60 * 1000, 20);
          return copy(result);
        }
      }
      throw serviceError('limit', 'Esta lista é grande demais para carregar por completo agora. Tente outro perfil.');
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      if (isPrivate(gqlErrors(error.data), error.status)) throw serviceError('private', 'O perfil ou a lista de animes não está disponível publicamente.');
      if (isNotFound(gqlErrors(error.data), error.status)) throw serviceError('not-found', 'Não foi possível encontrar essa lista pública no AniList.');
      throw error;
    }
  }

  return {
    searchAnime: searchAnime, getFriendRating: getFriendRating, getPublicAnimeList: getPublicAnimeList, statusLabel: statusLabel,
    catalogProvider: 'Tenrai (compatível com Jikan)', catalogUrl: 'https://tenrai.org/'
  };
});

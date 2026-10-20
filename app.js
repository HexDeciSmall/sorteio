(function () {
  'use strict';
  const C = window.RouletteCore;
  const S = window.AnimeServices;
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const html = C.escapeHtml;
  const keyMap = { friends: 'friend', cards: 'card', anime: 'anime' };
  const storageKey = 'otaku-roll.v1';
  const accents = ['#ae98ed', '#e3c175', '#f38c64', '#83b9a6', '#8aaedb'];
  let storageAvailable = true;
  let loadError = false;
  let state;
  try {
    const stored = localStorage.getItem(storageKey);
    state = stored ? C.normalizeState(JSON.parse(stored)) : C.createState();
    if (stored) C.migrateDefaults(state);
  } catch (error) {
    state = C.createState();
    loadError = true;
    storageAvailable = false;
  }
  let busy = false;
  let editorTab = 'friends';
  let editingId = null;
  let confirmCallback = null;
  let toastTimer;
  let audio;
  let storageWarningShown = false;
  let catalogSelection = null;
  let catalogResults = [];
  let searchTimer;
  let searchController;
  let searchGeneration = 0;
  let ratingController;
  let ratingSignature = '';
  let groupLoaded = false;
  const failedCovers = new Set();
  const degrees = { friends: 0, cards: 0, anime: 0 };
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function icon(name) { return '<svg aria-hidden="true"><use href="#i-' + name + '"/></svg>'; }
  function scoreText(value) { return typeof value === 'number' ? value.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + '/10' : 'Sem nota'; }
  function posterSource(url) { return url && !failedCovers.has(url) ? url : 'poster-placeholder.svg'; }
  function posterImage(url, className) { return '<img class="' + className + '" src="' + html(posterSource(url)) + '" data-poster-url="' + html(url || '') + '" alt="" loading="lazy" referrerpolicy="no-referrer">'; }
  function canonicalName(value) { return value.normalize('NFC').replace(/\s+/g, ' ').trim().toLocaleLowerCase('pt-BR'); }

  function cancelAnimeSearch(clear = true) {
    clearTimeout(searchTimer);
    searchGeneration++;
    if (searchController) searchController.abort();
    searchController = null;
    $('#search-anime').disabled = false;
    if (clear) {
      catalogResults = [];
      $('#anime-search-results').replaceChildren();
      $('#anime-search-results').hidden = true;
      $('#anime-search-status').textContent = '';
      $('#anime-search-status').classList.remove('is-error');
    }
  }
  function renderCatalogSelection() {
    const panel = $('#anime-selection');
    panel.hidden = editorTab !== 'anime' || !catalogSelection;
    if (!catalogSelection) { panel.replaceChildren(); return; }
    panel.innerHTML = posterImage(catalogSelection.coverUrl, 'catalog-cover') + '<div><strong>' + html(catalogSelection.name) + '</strong><small>★ ' + scoreText(catalogSelection.malScore) + ' · MyAnimeList</small></div><button type="button" id="clear-anime-selection" class="icon-button" aria-label="Remover vínculo com o MAL">' + icon('close') + '</button>';
  }
  async function searchAnimeCatalog() {
    if (editorTab !== 'anime' || !$('#editor-dialog').open) return;
    const query = $('#entry-name').value.trim();
    cancelAnimeSearch();
    if (query.length < 2) { $('#anime-search-status').textContent = 'Digite pelo menos 2 caracteres.'; return; }
    const generation = searchGeneration;
    searchController = new AbortController();
    const controller = searchController;
    $('#search-anime').disabled = true;
    $('#anime-search-status').textContent = 'Buscando no MyAnimeList…';
    try {
      const results = await S.searchAnime(query, { signal: controller.signal });
      if (generation !== searchGeneration || controller.signal.aborted || editorTab !== 'anime' || !$('#editor-dialog').open) return;
      catalogResults = results;
      $('#anime-search-results').innerHTML = results.map((item, i) => '<li><button type="button" class="catalog-option" data-catalog-index="' + i + '">' + posterImage(item.coverUrl, 'catalog-cover') + '<span class="catalog-info"><strong>' + html(item.name) + '</strong><small class="catalog-meta">★ ' + scoreText(item.malScore) + ' MAL' + (item.type ? ' · ' + html(item.type) : '') + (item.year ? ' · ' + item.year : '') + (item.episodes ? ' · ' + item.episodes + ' ep.' : '') + '</small></span><span class="catalog-add">Selecionar</span></button></li>').join('');
      $('#anime-search-results').hidden = !results.length;
      $('#anime-search-status').textContent = results.length ? results.length + ' resultados. Selecione um anime.' : 'Nenhum anime encontrado. Tente outro nome ou cadastre manualmente.';
    } catch (error) {
      if (error.name === 'AbortError' || generation !== searchGeneration) return;
      $('#anime-search-status').textContent = (error.message || 'Busca indisponível agora.') + ' Você pode cadastrar manualmente.';
      $('#anime-search-status').classList.add('is-error');
    } finally {
      if (generation === searchGeneration) { $('#search-anime').disabled = false; searchController = null; }
    }
  }
  function selectCatalogAnime(index) {
    const item = catalogResults[index];
    if (!item || editorTab !== 'anime') return;
    const existing = state.anime.find((anime) => anime.malId === item.malId || canonicalName(anime.name) === canonicalName(item.name));
    if (existing && existing.id !== editingId) editEntry(existing.id);
    catalogSelection = { ...C.normalizeAnimeMetadata(item), name: item.name };
    $('#entry-name').value = item.name;
    cancelAnimeSearch();
    renderCatalogSelection();
    $('#entry-owner').focus({ preventScroll: true });
  }

  function ratingText(result) {
    if (!result) return 'Consultando…';
    const status = result.status ? ' · ' + S.statusLabel(result.status) : '';
    if (result.kind === 'rated') return scoreText(result.score) + status;
    if (result.kind === 'unrated') return 'Sem nota' + status;
    return result.message || (result.kind === 'not-listed' ? 'Não consta na lista pública.' : 'Consulta indisponível.');
  }
  function renderCardEffect() {
    const info = C.effectInfo(state);
    const type = state.current.card && state.current.card.effect || 'none';
    const panel = $('#card-effect');
    const controls = $('#card-effect-controls');
    const message = $('#card-effect-message');
    panel.hidden = !state.current.card || type === 'none';
    controls.hidden = true;
    if (panel.hidden) return;
    if (type === 'infernal') { message.textContent = 'Os quatro animes entram na roleta depois de confirmar o seu anime.'; return; }
    if (!state.current.friend) { message.textContent = 'Sorteie um nome para usar esta carta.'; return; }
    if (!info.pending) {
      const removed = info.excludedAnimeIds.map((id) => state.anime.find((anime) => anime.id === id)).filter(Boolean);
      message.textContent = removed.length ? 'Fora só nesta vez: ' + removed.map((anime) => anime.name).join(', ') + '.' : 'Efeito dispensado nesta vez.';
      return;
    }
    controls.hidden = false;
    const pool = state.anime.filter((anime) => !state.used.anime.includes(anime.id));
    const select = $('#card-effect-target');
    const previous = select.value;
    let options;
    if (type === 'remove_anime') {
      $('#card-effect-target-label').textContent = 'Anime para retirar nesta vez';
      options = pool.length > 1 ? pool.map((anime) => ({ id: anime.id, label: anime.name })) : [];
      message.textContent = 'Escolha um anime para ficar fora do seu sorteio.';
    } else {
      $('#card-effect-target-label').textContent = 'Indicações de qual colega?';
      options = state.friends.map((friend) => ({ id: friend.id, label: friend.name, count: pool.filter((anime) => anime.ownerId === friend.id).length })).filter((friend) => friend.count > 0 && friend.count < pool.length).map((friend) => ({ id: friend.id, label: friend.label + ' · ' + friend.count + (friend.count === 1 ? ' anime' : ' animes') }));
      message.textContent = 'As indicações desse colega ficam fora só nesta vez.';
    }
    if (!options.length) message.textContent = 'Não há opções para retirar sem esvaziar a roleta. Use “Não usar” para continuar.';
    select.innerHTML = '<option value="">Selecione…</option>' + options.map((option) => '<option value="' + option.id + '">' + html(option.label) + '</option>').join('');
    if (options.some((option) => option.id === previous)) select.value = previous;
    select.disabled = busy || !options.length;
    $('#apply-card-effect').disabled = busy || !select.value;
    $('#apply-card-effect').textContent = state.current.anime ? 'Aplicar' : 'Aplicar e girar';
    $('#skip-card-effect').disabled = busy;
  }
  function syncAnimeDetails() {
    const anime = state.current.anime;
    const signature = anime ? JSON.stringify([anime.id, anime.malId, state.friends.map((item) => [item.id, item.name, item.anilistUsername])]) : '';
    $('#anime-details').hidden = !anime;
    $('#group-ratings').hidden = !anime || !anime.malId || !state.friends.length;
    if (!anime) {
      if (ratingController) ratingController.abort();
      ratingController = null; ratingSignature = ''; groupLoaded = false;
      $('#group-ratings-list').replaceChildren();
      $('#group-ratings-list').setAttribute('aria-busy', 'false');
      $('#retry-group-ratings').hidden = true;
      return;
    }
    const cover = $('#anime-cover');
    const coverUrl = posterSource(anime.coverUrl);
    if (cover.getAttribute('src') !== coverUrl) cover.src = coverUrl;
    cover.dataset.posterUrl = anime.coverUrl || '';
    cover.alt = 'Capa de ' + anime.name;
    cover.referrerPolicy = 'no-referrer';
    $('#anime-mal-link').hidden = !anime.malId;
    $('#anime-mal-link').href = anime.malId ? 'https://myanimelist.net/anime/' + anime.malId : 'https://myanimelist.net/';
    $('#anime-mal-score').textContent = anime.malId ? '★ ' + scoreText(anime.malScore) + ' · MAL' : 'Sem dados do MAL';
    $('#link-current-anime').hidden = !!anime.malId;
    $('#link-current-anime').disabled = busy;
    const owner = state.friends.find((item) => item.id === anime.ownerId);
    $('#anime-owner').textContent = owner ? 'Indicado por ' + owner.name : '';
    $('#anime-owner').hidden = !owner;
    $('#anime-rating-hint').hidden = !!anime.malId;
    if (signature === ratingSignature) return;
    if (ratingController) ratingController.abort();
    ratingController = new AbortController();
    ratingSignature = signature; groupLoaded = false;
    $('#group-ratings-list').replaceChildren();
    $('#group-ratings-list').setAttribute('aria-busy', 'false');
    $('#retry-group-ratings').hidden = true;
    if (anime.malId) loadGroupRatings();
  }
  async function loadGroupRatings() {
    if (groupLoaded || !state.current.anime || !state.current.anime.malId) return;
    groupLoaded = true;
    const anime = state.current.anime;
    const friends = state.friends.slice();
    const signature = ratingSignature;
    const controller = ratingController;
    $('#retry-group-ratings').hidden = true;
    let failed = false;
    $('#group-ratings-list').innerHTML = friends.map((friend) => '<li data-rating-friend="' + friend.id + '">' + (friend.anilistUsername ? '<a class="rating-friend" href="https://anilist.co/user/' + encodeURIComponent(friend.anilistUsername) + '/" target="_blank" rel="noopener noreferrer" title="Perfil do AniList de ' + html(friend.name) + '">' + html(friend.name) + ' ↗</a>' : '<strong class="rating-friend">' + html(friend.name) + '</strong>') + '<span class="rating-value">' + (friend.anilistUsername ? 'Consultando…' : 'Sem perfil') + '</span></li>').join('');
    $('#group-ratings-list').setAttribute('aria-busy', String(friends.some((friend) => friend.anilistUsername)));
    for (const friend of friends) {
      if (!controller || controller.signal.aborted || signature !== ratingSignature) return;
      if (!friend.anilistUsername) continue;
      try {
        const result = await S.getFriendRating(friend.anilistUsername, anime.malId, { signal: controller.signal });
        if (controller.signal.aborted || signature !== ratingSignature) return;
        if (result.kind === 'unavailable') failed = true;
        const row = $('#group-ratings-list').querySelector('[data-rating-friend="' + friend.id + '"]');
        if (row) { row.lastElementChild.textContent = ratingText(result); row.classList.toggle('is-error', result.kind === 'unavailable'); }
      } catch (error) {
        if (error.name === 'AbortError') return;
        if (controller.signal.aborted || signature !== ratingSignature) return;
        failed = true;
        const row = $('#group-ratings-list').querySelector('[data-rating-friend="' + friend.id + '"]');
        if (row) { row.lastElementChild.textContent = 'Consulta indisponível.'; row.classList.add('is-error'); }
      }
    }
    if (signature === ratingSignature && controller && !controller.signal.aborted) {
      $('#retry-group-ratings').hidden = !failed;
      $('#group-ratings-list').setAttribute('aria-busy', 'false');
    }
  }
  function toast(message, error = false) {
    clearTimeout(toastTimer);
    const box = $('#toast');
    const modal = [...document.querySelectorAll('dialog[open]')].pop();
    (modal || document.body).append(box);
    box.textContent = message;
    box.className = 'show' + (error ? ' toast-error' : '');
    toastTimer = setTimeout(() => box.className = '', 5000);
  }
  function persist() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
      storageAvailable = true;
    } catch (error) {
      storageAvailable = false;
      if (!storageWarningShown) {
        storageWarningShown = true;
        toast('O navegador não permitiu salvar. Exporte seus dados antes de sair.', true);
      }
    }
    $('#storage-status').textContent = storageAvailable ? 'Salvo neste navegador' : 'Sem salvamento local · exporte seus dados';
    document.dispatchEvent(new Event('sorteio:state-changed'));
  }
  function displayDate(at, short = false) {
    return new Intl.DateTimeFormat('pt-BR', short ? { day: '2-digit', month: 'short' } : { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(at));
  }
  function avatar(friend) {
    const color = accents[(friend.name.codePointAt(0) || 0) % accents.length];
    return '<span class="avatar" style="--avatar-color:' + color + '">' + html(friend.name.slice(0, 2).toLocaleUpperCase('pt-BR')) + '</span>';
  }
  function emptyState(title, description, symbol = 'dice') {
    return '<div class="empty-state"><span class="empty-icon">' + icon(symbol) + '</span><div><strong>' + title + '</strong><p>' + description + '</p></div></div>';
  }
  function renderWheel(key) {
    const items = C.available(state, key);
    const colors = {
      friends: [['#a992e0', '#20172c'], ['#655284', '#fff5ff'], ['#c5b1ed', '#20172c'], ['#80669e', '#fff5ff'], ['#4e3e65', '#fff5ff']],
      cards: [['#e0bc73', '#2d2316'], ['#8b7043', '#fff7e7'], ['#c6a363', '#2d2316'], ['#695236', '#fff7e7'], ['#e9ce92', '#2d2316'], ['#a88b53', '#221a11']],
      anime: [['#ea885b', '#311a13'], ['#9c503b', '#fff5ed'], ['#d6a080', '#311a13'], ['#713e34', '#fff5ed'], ['#c86646', '#fff5ed']]
    }[key];
    const rotor = $('#rotor-' + key);
    let svg = '<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">';
    if (!items.length) svg += '<circle cx="150" cy="150" r="148" fill="#29282e" stroke="#45424d" stroke-width="1"/><circle cx="150" cy="150" r="116" fill="none" stroke="#45424d" stroke-dasharray="2 8"/>';
    items.forEach((item, i) => {
      const start = -90 + i * 360 / items.length;
      const end = -90 + (i + 1) * 360 / items.length;
      const rad = (angle) => angle * Math.PI / 180;
      const x1 = 150 + 148 * Math.cos(rad(start));
      const y1 = 150 + 148 * Math.sin(rad(start));
      const x2 = 150 + 148 * Math.cos(rad(end));
      const y2 = 150 + 148 * Math.sin(rad(end));
      const color = colors[i % colors.length];
      if (items.length === 1) svg += '<circle cx="150" cy="150" r="148" fill="' + color[0] + '"/>';
      else svg += '<path d="M150 150 L' + x1 + ' ' + y1 + ' A148 148 0 ' + (end - start > 180 ? 1 : 0) + ' 1 ' + x2 + ' ' + y2 + ' Z" fill="' + color[0] + '" stroke="#17151b" stroke-opacity=".3" stroke-width="1.2"/>';
      if (items.length <= 30 || i % Math.ceil(items.length / 24) === 0) {
        const mid = (start + end) / 2;
        const x = 150 + 92 * Math.cos(rad(mid));
        const y = 150 + 92 * Math.sin(rad(mid));
        const angle = mid + (Math.cos(rad(mid)) < -0.01 ? 180 : 0);
        const maxLength = items.length > 12 ? 11 : 18;
        const label = item.name.length > maxLength ? item.name.slice(0, maxLength - 1) + '…' : item.name;
        svg += '<text x="' + x + '" y="' + y + '" dy=".35em" text-anchor="middle" transform="rotate(' + angle + ' ' + x + ' ' + y + ')" fill="' + color[1] + '" font-family="Arial,sans-serif" font-size="' + (items.length > 12 ? 9 : 10.5) + '" font-weight="700">' + html(label) + '</text>';
      }
    });
    svg += '<circle cx="150" cy="150" r="147" fill="none" stroke="white" stroke-opacity=".12" stroke-width="2"/></svg>';
    rotor.innerHTML = svg;
    rotor.style.transition = 'none';
    const selected = state.current[keyMap[key]];
    const index = selected ? items.findIndex((item) => item.id === selected.id) : -1;
    degrees[key] = index >= 0 ? C.wheelTarget(0, index, items.length, 0) : 0;
    rotor.style.transform = 'rotate(' + degrees[key] + 'deg)';
    $('#stage-' + key).classList.toggle('is-empty', !items.length);
    $('#count-' + key).textContent = items.length;
    $('#stage-' + key).setAttribute('aria-label', 'Roleta com ' + items.length + ' opções disponíveis');
    renderResult(key);
  }
  function renderResult(key, spinning = false) {
    const result = $('#result-' + key);
    const choice = state.current[keyMap[key]];
    const pool = C.available(state, key);
    result.classList.toggle('has-result', !!choice);
    if (spinning) result.innerHTML = '<strong>Girando…</strong>';
    else if (choice) {
      result.innerHTML = '<strong title="' + html(choice.name) + '">' + html(choice.name) + '</strong>' + (key === 'cards' && choice.description ? '<small>' + html(choice.description) + '</small>' : '');
    } else if (!pool.length) {
      const hasEntries = state[key].length > 0;
      result.innerHTML = '<strong>' + (hasEntries ? 'Fim do ciclo' : 'Sem opções') + '</strong>';
    } else result.innerHTML = '<strong aria-label="Nenhum resultado">—</strong>';
  }
  function renderControls() {
    C.prepareTurnEffect(state);
    const effect = C.effectInfo(state);
    const filled = Object.values(state.current).filter(Boolean).length;
    const ready = filled === 3 && !effect.pending;
    const main = $('#draw-round');
    $('.draw-actions').hidden = ready || effect.pending;
    main.disabled = busy || ready || effect.pending || ['friends', 'cards', 'anime'].some((key) => !state.current[keyMap[key]] && !C.available(state, key).length);
    main.innerHTML = icon(busy ? 'refresh' : 'dice') + (busy ? ' Girando…' : filled && !ready ? ' Completar' : ' Girar tudo');
    $$('[data-spin]').forEach((button) => button.disabled = busy || (ready && button.dataset.spin !== 'anime') || (effect.pending && button.dataset.spin === 'anime') || !C.available(state, button.dataset.spin).length);
    $$('[data-edit], [data-view], #manage-all, [data-delete-result]').forEach((button) => button.disabled = busy);
    $$('[data-section]').forEach((button) => button.disabled = busy);
    $('#reset-cycle').disabled = busy || !(state.used.friends.length || state.used.anime.length || C.cycleRecords(state).length || filled);
    $('#anime-decision').hidden = !state.current.anime;
    $('#spin-anime').hidden = !!state.current.anime;
    $('#confirm-anime').disabled = busy || !ready;
    $('#reject-anime').disabled = busy || effect.pending || !state.current.anime;
    $('#anime-confirm-hint').hidden = !state.current.anime || ready || busy;
    $('#anime-confirm-hint').textContent = effect.pending ? 'Resolva a carta antes de confirmar.' : 'Sorteie também o nome e a carta.';
    $('#sound-toggle').setAttribute('aria-pressed', String(state.settings.sound));
    $('#sound-toggle').setAttribute('aria-label', state.settings.sound ? 'Desativar som' : 'Ativar som');
    $('#sound-toggle').title = state.settings.sound ? 'Desativar som' : 'Ativar som';
    $('#sound-toggle').innerHTML = icon(state.settings.sound ? 'volume' : 'mute');
    renderCardEffect();
    syncAnimeDetails();
  }
  function renderHistory() {
    const records = [...state.history].reverse();
    $('#history-nav-count').textContent = records.length;
    $('#history-nav-count').hidden = !records.length;
    $('#history-total').textContent = records.length + (records.length === 1 ? ' resultado' : ' resultados');
    $('#clear-history').disabled = busy || !records.length;
    $('#copy-history').disabled = !records.length;
    $('#history-list').innerHTML = records.length ? '<div class="history-table"><div class="history-head"><span>NOME</span><span>ANIME</span><span>CARTA</span><span>DATA</span></div>' + records.map((record) => '<div class="history-row"><div class="recent-person">' + avatar(record.friend) + '<strong>' + html(record.friend.name) + '</strong></div><div class="history-anime"><strong>' + html(record.anime.name) + '</strong></div><div><span class="history-card">' + html(record.card.name) + '</span><small class="history-effect">' + html(record.card.description) + '</small></div><time datetime="' + record.at + '">' + displayDate(record.at) + '</time></div>').join('') + '</div>' : emptyState('Nenhum resultado salvo.', 'Sorteie e confirme o anime para registrar um resultado.', 'clock');
  }
  function resultLine(record) {
    return record.friend.name + ' — ' + record.anime.name + ' (' + (record.card.description || record.card.name) + ')';
  }
  function renderCycleResults() {
    const records = C.cycleRecords(state);
    $('#round-results-list').innerHTML = records.map((record) => '<li class="round-result" data-result-id="' + record.id + '"><div class="round-result-text"><strong class="result-friend">' + html(record.friend.name) + '</strong> — <span class="result-anime">' + html(record.anime.name) + '</span> <span class="result-effect">(' + html(record.card.description || record.card.name) + ')</span></div><button class="icon-button delete-result" data-delete-result="' + record.id + '" aria-label="Excluir resultado de ' + html(record.friend.name) + '" title="Excluir resultado"' + (busy ? ' disabled' : '') + '>' + icon('trash') + '</button></li>').join('');
    $('#results-progress').textContent = records.length + ' / ' + state.friends.length;
    $('#results-empty').hidden = !!records.length;
    $('#copy-results').disabled = !records.length || busy;
  }
  function renderAll() {
    C.prepareTurnEffect(state);
    ['friends', 'cards', 'anime'].forEach(renderWheel);
    renderControls();
    renderHistory();
    renderCycleResults();
  }
  function tone(frequency, duration = 0.04, volume = 0.025) {
    if (!state.settings.sound) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(volume, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
      oscillator.connect(gain); gain.connect(audio.destination);
      oscillator.start(); oscillator.stop(audio.currentTime + duration);
    } catch (error) { /* Sound is optional when the browser blocks audio. */ }
  }
  function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
  async function animateSpin(key, excludedAnimeId) {
    C.prepareTurnEffect(state);
    if (key === 'anime' && C.effectInfo(state).pending) throw new Error('Escolha o efeito da carta antes de girar o anime.');
    const pool = C.available(state, key);
    const choice = C.pick(state, key, key === 'anime' ? excludedAnimeId : undefined);
    if (!choice) throw new Error(excludedAnimeId ? 'Não há outro anime disponível. Adicione outro anime ou gire novamente.' : 'Esta roleta ficou sem opções. Adicione itens ou limpe os resultados para iniciar outro ciclo.');
    const index = pool.findIndex((item) => item.id === choice.id);
    const rotor = $('#rotor-' + key);
    const card = $('[data-wheel="' + key + '"]');
    const duration = reducedMotion.matches ? 80 : 2900;
    state.current[keyMap[key]] = null;
    renderResult(key, true);
    syncAnimeDetails();
    card.classList.add('is-spinning');
    rotor.style.transition = reducedMotion.matches ? 'none' : 'transform ' + duration + 'ms cubic-bezier(.12,.62,.12,1)';
    rotor.getBoundingClientRect();
    degrees[key] = C.wheelTarget(degrees[key], index, pool.length, 5 + C.secureIndex(3));
    rotor.style.transform = 'rotate(' + degrees[key] + 'deg)';
    let tickTimer;
    if (!reducedMotion.matches) {
      let count = 0;
      tickTimer = setInterval(() => { count++; tone(340 + count * 7); }, 140);
    }
    try { await sleep(duration + 40); } finally { clearInterval(tickTimer); card.classList.remove('is-spinning'); }
    state.current[keyMap[key]] = { ...choice };
    C.prepareTurnEffect(state);
    renderResult(key);
    tone(740, 0.16, 0.04);
    $('#spin-announcer').textContent = (key === 'friends' ? 'Amigo sorteado: ' : key === 'cards' ? 'Carta sorteada: ' : 'Anime sorteado: ') + choice.name;
    persist();
  }
  async function runSpins(keys, excludedAnimeId) {
    if (busy) return;
    busy = true;
    document.body.setAttribute('aria-busy', 'true');
    renderControls();
    renderCycleResults();
    tone(250, 0.03, 0.001);
    try {
      for (const key of keys) {
        C.prepareTurnEffect(state);
        if (key === 'anime' && C.effectInfo(state).pending) break;
        await animateSpin(key, excludedAnimeId); renderControls();
      }
    } catch (error) { toast(error.message, true); }
    finally {
      busy = false; document.body.removeAttribute('aria-busy'); renderAll();
      (C.effectInfo(state).pending ? $('#card-effect-target').disabled ? $('#skip-card-effect') : $('#card-effect-target') : Object.values(state.current).every(Boolean) ? $('#confirm-anime') : $('#draw-round').disabled ? $('#reset-cycle') : $('#draw-round')).focus({ preventScroll: true });
    }
  }
  function confetti() {
    if (reducedMotion.matches) return;
    const box = $('#confetti');
    box.innerHTML = Array.from({ length: 38 }, (_, i) => '<span class="confetti-piece" style="--x:' + C.secureIndex(100) + 'vw;--delay:' + (i % 7) * 0.04 + 's;--color:' + accents[i % accents.length] + ';--rotation:' + C.secureIndex(360) + 'deg"></span>').join('');
    setTimeout(() => box.replaceChildren(), 3000);
  }
  function confirmAction(title, description, action, label = 'Confirmar') {
    if (busy) return;
    $('#confirm-title').textContent = title;
    $('#confirm-description').textContent = description;
    $('#confirm-action').textContent = label;
    confirmCallback = action;
    $('#confirm-dialog').showModal();
  }
  function setView(view) {
    if (busy) return;
    if (view === 'history') $('#history-dialog').showModal();
    else if ($('#history-dialog').open) $('#history-dialog').close();
  }
  function resetEntryForm() {
    cancelAnimeSearch();
    editingId = null;
    catalogSelection = null;
    $('#entry-form').reset();
    renderCatalogSelection();
    $('#entry-submit').innerHTML = icon('plus') + ' Adicionar';
    $('#cancel-edit').hidden = true;
  }
  function renderEditor() {
    const isFriends = editorTab === 'friends';
    const isCards = editorTab === 'cards';
    const descriptions = { friends: 'Adicione ou altere os participantes.', cards: 'Edite cartas, efeitos e penalidades.', anime: 'Até 2 indicações por pessoa.' };
    const labels = { friends: ['Nome', 'Ex.: Hex', 'PARTICIPANTES'], cards: ['Carta', 'Ex.: Episódio extra', 'CARTAS'], anime: ['Anime', 'Ex.: Cowboy Bebop', 'ANIMES'] };
    $$('[data-tab]').forEach((tab) => { const active = tab.dataset.tab === editorTab; tab.setAttribute('aria-selected', String(active)); tab.tabIndex = active ? 0 : -1; });
    ['friends', 'cards', 'anime'].forEach((key) => $('#tab-count-' + key).textContent = state[key].length);
    $('#editor-panel').setAttribute('aria-labelledby', 'tab-' + editorTab);
    $('#editor-description').textContent = descriptions[editorTab];
    $('#entry-name-label').textContent = labels[editorTab][0];
    $('#entry-name').placeholder = labels[editorTab][1];
    $('#entry-name').maxLength = editorTab === 'anime' ? 200 : 80;
    $('#list-label').textContent = labels[editorTab][2] + ' (' + state[editorTab].length + ')';
    $('#owner-field').hidden = isFriends || isCards;
    $('#profile-field').hidden = !isFriends;
    $('#description-field').hidden = !isCards;
    $('#effect-field').hidden = !isCards;
    $('#add-standard-cards').hidden = !isCards;
    $('#anime-search-tools').hidden = isFriends || isCards;
    $('#catalog-source').hidden = isFriends || isCards;
    renderCatalogSelection();
    $('#entry-owner').innerHTML = '<option value="">Sem indicação</option>' + state.friends.map((friend) => {
      const count = state.anime.filter((anime) => anime.ownerId === friend.id && anime.id !== editingId).length;
      return '<option value="' + friend.id + '"' + (count >= 2 ? ' disabled' : '') + '>' + html(friend.name) + ' · ' + count + '/2 indicações</option>';
    }).join('');
    $('#entry-list').innerHTML = state[editorTab].length ? state[editorTab].map((item, i) => {
      const owner = editorTab === 'anime' ? state.friends.find((friend) => friend.id === item.ownerId) : null;
      const sub = isFriends ? state.anime.filter((anime) => anime.ownerId === item.id).length + '/2 animes indicados' + (item.anilistUsername ? ' · AniList @' + item.anilistUsername : '') : isCards ? item.description || 'Sem efeito descrito' : (owner ? 'Indicação de ' + owner.name : 'Sem indicação') + (item.malId ? ' · ★ ' + scoreText(item.malScore) + ' MAL' : '');
      const used = editorTab !== 'cards' && state.used[editorTab].includes(item.id);
      const entryImage = editorTab === 'anime' && item.malId ? posterImage(item.coverUrl, 'entry-cover') : '<span class="entry-avatar" style="--avatar-color:' + accents[i % accents.length] + '">' + (isFriends ? html(item.name.slice(0, 2).toLocaleUpperCase('pt-BR')) : icon(isCards ? 'card' : 'play')) + '</span>';
      return '<div class="entry-row">' + entryImage + '<div class="entry-info"><strong>' + html(item.name) + '</strong><small>' + html(sub) + '</small></div>' + (used ? '<span class="entry-used">Já saiu</span>' : '') + '<div class="entry-actions"><button class="icon-button" data-entry-edit="' + item.id + '" aria-label="Editar ' + html(item.name) + '">' + icon('edit') + '</button><button class="icon-button" data-entry-delete="' + item.id + '" aria-label="Remover ' + html(item.name) + '">' + icon('trash') + '</button></div></div>';
    }).join('') : emptyState('Lista vazia.', 'Adicione uma opção acima.', 'plus');
  }
  function openEditor(key = 'friends') {
    if (busy) return;
    editorTab = key;
    resetEntryForm();
    renderEditor();
    $('#editor-dialog').showModal();
  }
  function reconcileCurrent() {
    C.prepareTurnEffect(state);
    ['friends', 'cards', 'anime'].forEach((key) => {
      const selected = state.current[keyMap[key]];
      if (!selected) return;
      const valid = C.available(state, key).find((item) => item.id === selected.id);
      state.current[keyMap[key]] = valid ? { ...valid } : null;
    });
    C.prepareTurnEffect(state);
  }
  function saveEntry(event) {
    event.preventDefault();
    const name = $('#entry-name').value.normalize('NFC').replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim();
    if (!name) { toast('Digite um nome para adicionar à roleta.', true); $('#entry-name').focus(); return; }
    if (name.length > (editorTab === 'anime' ? 200 : 80)) { toast('Esse nome ficou longo demais. Reduza para ' + (editorTab === 'anime' ? 200 : 80) + ' caracteres.', true); return; }
    const list = state[editorTab];
    const max = editorTab === 'anime' ? 200 : 100;
    if (!editingId && list.length >= max) { toast('Esta lista permite até ' + max + ' opções.', true); return; }
    if (editorTab !== 'cards' && list.some((item) => item.id !== editingId && canonicalName(item.name) === canonicalName(name))) { toast('Esse nome já está na lista. Edite a opção existente.', true); return; }
    const item = { id: editingId || C.uid(), name };
    if (editorTab === 'friends') {
      try {
        const username = C.normalizeAniListProfile($('#entry-profile').value);
        if (username) item.anilistUsername = username;
      } catch (error) { toast(error.message, true); $('#entry-profile').focus(); return; }
    }
    if (editorTab === 'cards') { item.description = $('#entry-description').value.trim(); item.effect = $('#entry-effect').value; }
    if (editorTab === 'anime') {
      item.ownerId = $('#entry-owner').value || null;
      if (item.ownerId && state.anime.filter((anime) => anime.ownerId === item.ownerId && anime.id !== editingId).length >= 2) { toast('Esse amigo já tem 2 indicações. Escolha outro ou edite uma indicação.', true); return; }
      if (catalogSelection) {
        if (state.anime.some((anime) => anime.id !== editingId && anime.malId === catalogSelection.malId)) { toast('Este anime do MAL já está na lista. Edite a opção existente.', true); return; }
        Object.assign(item, C.normalizeAnimeMetadata(catalogSelection));
      }
    }
    if (editingId) list.splice(list.findIndex((entry) => entry.id === editingId), 1, item);
    else list.push(item);
    reconcileCurrent(); persist(); renderAll(); resetEntryForm(); renderEditor();
    $('#entry-name').focus();
    toast('Lista atualizada.');
  }
  function editEntry(id) {
    const item = state[editorTab].find((entry) => entry.id === id);
    if (!item) return;
    cancelAnimeSearch();
    editingId = id;
    catalogSelection = editorTab === 'anime' && item.malId ? { ...C.normalizeAnimeMetadata(item), name: item.name } : null;
    renderEditor();
    $('#entry-name').value = item.name;
    if (editorTab === 'friends') $('#entry-profile').value = item.anilistUsername || '';
    if (editorTab === 'cards') { $('#entry-description').value = item.description; $('#entry-effect').value = item.effect || 'none'; }
    if (editorTab === 'anime') $('#entry-owner').value = item.ownerId || '';
    $('#entry-submit').innerHTML = icon('check') + ' Salvar alteração';
    $('#cancel-edit').hidden = false;
    $('#entry-name').focus();
    $('#entry-name').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  function removeEntry(id) {
    const item = state[editorTab].find((entry) => entry.id === id);
    if (!item) return;
    confirmAction('Remover ' + item.name + '?', editorTab === 'friends' ? 'As indicações deste amigo continuarão na lista como animes sem indicação. O histórico será mantido.' : 'A opção sairá da roleta. Os resultados já salvos continuarão no histórico.', () => {
      state[editorTab] = state[editorTab].filter((entry) => entry.id !== id);
      if (editorTab !== 'cards') state.used[editorTab] = state.used[editorTab].filter((value) => value !== id);
      if (editorTab === 'friends') state.anime.forEach((anime) => { if (anime.ownerId === id) anime.ownerId = null; });
      reconcileCurrent(); persist(); renderAll(); resetEntryForm(); renderEditor(); toast('Opção removida da roleta.');
    }, 'Remover opção');
  }
  function downloadData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = 'sorteio-' + new Date().toLocaleDateString('sv-SE') + '.json';
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('Dados exportados.');
  }
  async function importFile(event) {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error('O arquivo deve ter no máximo 2 MB.');
      let imported;
      try { imported = C.normalizeState(JSON.parse(await file.text())); C.migrateDefaults(imported); }
      catch (error) { throw new Error(error instanceof SyntaxError ? 'O arquivo não é um JSON válido.' : error.message); }
      confirmAction('Importar dados do clube?', 'Serão carregados ' + imported.friends.length + ' amigos, ' + imported.cards.length + ' cartas, ' + imported.anime.length + ' animes e ' + imported.history.length + ' resultados. Isso substitui os dados deste navegador. Exporte os atuais antes de continuar se quiser guardá-los.', () => {
        state = imported; persist(); renderAll(); resetEntryForm(); renderEditor(); toast('Dados importados.');
      }, 'Importar e substituir');
    } catch (error) { toast('Não foi possível importar: ' + error.message, true); }
  }

  $('#draw-round').addEventListener('click', () => runSpins(['friends', 'cards', 'anime'].filter((key) => !state.current[keyMap[key]])));
  function useCardEffect(targetId) {
    if (busy) return;
    try {
      C.applyTurnEffect(state, targetId);
      persist(); renderAll();
      if (!state.current.anime && C.available(state, 'anime').length) runSpins(['anime']);
    } catch (error) { toast(error.message, true); }
  }
  $('#card-effect-target').addEventListener('change', () => $('#apply-card-effect').disabled = busy || !$('#card-effect-target').value);
  $('#apply-card-effect').addEventListener('click', () => { const targetId = $('#card-effect-target').value; if (targetId) useCardEffect(targetId); });
  $('#skip-card-effect').addEventListener('click', () => useCardEffect(null));
  $$('[data-spin]').forEach((button) => button.addEventListener('click', () => runSpins([button.dataset.spin])));
  $('#confirm-anime').addEventListener('click', () => {
    if (busy || !Object.values(state.current).every(Boolean)) return;
    try {
      const record = C.commitRound(state);
      persist(); renderAll();
      $('#spin-announcer').textContent = resultLine(record);
      const finished = !C.available(state, 'friends').length;
      if (finished) confetti();
      const animeExhausted = !C.available(state, 'anime').length;
      const added = record.addedInfernalAnime || [];
      toast(added.length ? 'Resultado confirmado. Infernizar adicionou ' + added.length + (added.length === 1 ? ' anime.' : ' animes.') : record.card.effect === 'infernal' ? 'Resultado confirmado. Os quatro animes já estavam cadastrados.' : finished ? 'Todos já foram sorteados.' : animeExhausted ? 'Resultado confirmado. Adicione mais animes para continuar.' : 'Resultado confirmado.');
      ($('#draw-round').disabled ? $('#reset-cycle') : $('#draw-round')).focus({ preventScroll: true });
    } catch (error) { toast(error.message, true); }
  });
  $('#reject-anime').addEventListener('click', () => {
    if (busy) return;
    const rejected = C.rejectAnime(state);
    if (!rejected) return;
    persist(); renderAll();
    runSpins(['anime'], rejected.id);
  });
  $('#round-results-list').addEventListener('click', (event) => {
    const button = event.target.closest('[data-delete-result]');
    if (!button || busy) return;
    const record = C.cycleRecords(state).find((item) => item.id === button.dataset.deleteResult);
    if (!record) return;
    confirmAction('Excluir resultado de ' + record.friend.name + '?', 'Esta atribuição será removida. O nome e o anime voltam às roletas se ainda estiverem cadastrados.' + ((record.addedInfernalAnime || []).length ? ' Animes adicionados por esta carta também sairão se ainda não foram usados, alterados ou escolhidos em outra rodada.' : ''), () => {
      C.removeRound(state, record.id);
      persist(); renderAll();
      toast('Resultado excluído.');
    }, 'Excluir resultado');
  });
  $('#reset-cycle').addEventListener('click', () => confirmAction('Limpar resultados?', 'A lista abaixo e as escolhas ainda não confirmadas serão limpas. Todos os nomes e animes voltarão às roletas para um novo ciclo. O histórico será mantido.', () => { C.resetCycle(state); persist(); renderAll(); toast('Resultados limpos.'); }, 'Limpar resultados'));
  $('#sound-toggle').addEventListener('click', () => { state.settings.sound = !state.settings.sound; persist(); renderControls(); if (state.settings.sound) tone(540, 0.1); });
  $$('[data-view]').forEach((button) => button.addEventListener('click', () => setView(button.dataset.view)));
  $('.brand').addEventListener('click', (event) => { event.preventDefault(); setView('draw'); });
  $$('[data-edit]').forEach((button) => button.addEventListener('click', () => openEditor(button.dataset.edit)));
  $('#manage-all').addEventListener('click', () => openEditor('friends'));
  $$('[data-close]').forEach((button) => button.addEventListener('click', () => $('#' + button.dataset.close).close()));
  $$('dialog').forEach((dialog) => {
    dialog.addEventListener('close', () => { if (dialog.contains($('#toast'))) document.body.append($('#toast')); });
    dialog.addEventListener('click', (event) => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); } });
  });
  $('#confirm-action').addEventListener('click', () => { const action = confirmCallback; confirmCallback = null; $('#confirm-dialog').close(); if (action) action(); });
  $('#confirm-dialog').addEventListener('close', () => confirmCallback = null);
  $$('[data-tab]').forEach((tab) => tab.addEventListener('click', () => { editorTab = tab.dataset.tab; resetEntryForm(); renderEditor(); }));
  $('.editor-tabs').addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const tabs = $$('[data-tab]');
    const current = tabs.findIndex((tab) => tab.dataset.tab === editorTab);
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (current + (event.key === 'ArrowLeft' ? -1 : 1) + tabs.length) % tabs.length;
    tabs[index].click(); tabs[index].focus();
  });
  $('#entry-form').addEventListener('submit', saveEntry);
  $('#search-anime').addEventListener('click', searchAnimeCatalog);
  $('#entry-name').addEventListener('input', () => {
    if (editorTab !== 'anime') return;
    cancelAnimeSearch();
    if ($('#entry-name').value.trim().length >= 2) searchTimer = setTimeout(searchAnimeCatalog, 650);
  });
  $('#entry-name').addEventListener('keydown', (event) => {
    if (editorTab !== 'anime') return;
    if (event.key === 'Enter' && !catalogSelection) { event.preventDefault(); searchAnimeCatalog(); }
    if (event.key === 'Escape') cancelAnimeSearch();
  });
  $('#anime-search-results').addEventListener('click', (event) => {
    const option = event.target.closest('[data-catalog-index]');
    if (option) selectCatalogAnime(Number(option.dataset.catalogIndex));
  });
  $('#anime-selection').addEventListener('click', (event) => {
    if (!event.target.closest('#clear-anime-selection')) return;
    catalogSelection = null;
    renderCatalogSelection();
  });
  $('#editor-dialog').addEventListener('close', () => cancelAnimeSearch());
  document.addEventListener('error', (event) => {
    const image = event.target;
    if (!(image instanceof HTMLImageElement) || !image.dataset.posterUrl) return;
    failedCovers.add(image.dataset.posterUrl);
    image.dataset.posterUrl = '';
    image.src = 'poster-placeholder.svg';
  }, true);
  $('#retry-group-ratings').addEventListener('click', () => { groupLoaded = false; loadGroupRatings(); });
  $('#link-current-anime').addEventListener('click', () => {
    if (busy || !state.current.anime) return;
    const id = state.current.anime.id;
    openEditor('anime'); editEntry(id); searchAnimeCatalog();
  });
  $('#cancel-edit').addEventListener('click', () => { resetEntryForm(); renderEditor(); });
  $('#add-standard-cards').addEventListener('click', () => {
    if (busy) return;
    try {
      const added = C.addStandardCards(state);
      reconcileCurrent(); persist(); renderAll(); renderEditor();
      toast(added ? 'Cartas padrão adicionadas.' : 'As cartas padrão já estão na lista.');
    } catch (error) { toast(error.message, true); }
  });
  $('#entry-list').addEventListener('click', (event) => { const edit = event.target.closest('[data-entry-edit]'); const remove = event.target.closest('[data-entry-delete]'); if (edit) editEntry(edit.dataset.entryEdit); if (remove) removeEntry(remove.dataset.entryDelete); });
  $('#export-data').addEventListener('click', downloadData);
  $('#import-data').addEventListener('click', () => $('#import-file').click());
  $('#import-file').addEventListener('change', importFile);
  $('#clear-history').addEventListener('click', () => confirmAction('Limpar o histórico?', 'O histórico e os resultados abaixo serão apagados. Nomes e animes já sorteados continuam fora das roletas até reiniciar o ciclo. Exporte os dados antes se quiser guardá-los.', () => { state.history = []; state.cycleRoundIds = []; persist(); renderHistory(); renderCycleResults(); toast('Histórico limpo.'); }, 'Limpar histórico'));
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); toast('Resultados copiados! É só colar no grupo.'); }
    catch (error) {
      const field = document.createElement('textarea'); field.value = text; field.style.cssText = 'position:fixed;top:0;left:0;opacity:0'; (document.querySelector('dialog[open]') || document.body).append(field); field.select();
      const copied = document.execCommand('copy'); field.remove();
      toast(copied ? 'Resultados copiados! É só colar no grupo.' : 'O navegador bloqueou a cópia. Use a opção Exportar dados.', !copied);
    }
  }
  $('#copy-history').addEventListener('click', () => copyText('SORTEIO\n\n' + state.history.map(resultLine).join('\n')));
  $('#copy-results').addEventListener('click', () => copyText(C.cycleRecords(state).map(resultLine).join('\n')));
  window.SorteioApp = Object.freeze({
    getFriends: () => state.friends.map((friend) => ({ ...friend })),
    openProfiles: () => openEditor('friends'),
    isBusy: () => busy,
    confirm: confirmAction
  });
  renderAll();
  if (!loadError) persist();
  else {
    $('#storage-status').textContent = 'Não foi possível carregar os dados locais';
    toast('Não foi possível carregar seus dados. Exemplos temporários foram abertos; o arquivo anterior foi preservado até a próxima edição.', true);
  }
})();

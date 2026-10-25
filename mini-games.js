(function () {
  'use strict';
  const C = window.SorteioCloud;
  const D = window.DailyGuessr;
  const A = window.SorteioApp;
  const escape = window.RouletteCore.escapeHtml;
  const $ = (selector) => document.querySelector(selector);
  const online = window.SORTEIO_FIREBASE && window.SORTEIO_FIREBASE.enabled === true;
  const localKey = 'sorteio.mini.v1';
  const labels = { characters: 'Personagens', anidle: 'Anidle' };
  const sources = { MANGA: 'Mangá', LIGHT_NOVEL: 'Light novel', ORIGINAL: 'Original', VISUAL_NOVEL: 'Visual novel', WEB_MANGA: 'Mangá web', NOVEL: 'Romance', VIDEO_GAME: 'Jogo', OTHER: 'Outro', WEB_NOVEL: 'Romance web', COMIC: 'HQ', PICTURE_BOOK: 'Livro ilustrado', MULTIMEDIA_PROJECT: 'Multimídia' };
  const genres = { Action: 'Ação', Adventure: 'Aventura', Comedy: 'Comédia', Fantasy: 'Fantasia', Horror: 'Terror', Music: 'Música', Mystery: 'Mistério', Psychological: 'Psicológico', 'Sci-Fi': 'Ficção científica', 'Slice of Life': 'Cotidiano', Sports: 'Esportes', Supernatural: 'Sobrenatural', Thriller: 'Suspense' };
  let mode = null;
  let active = false;
  let date = D.todayKey();
  const dates = {};
  let current = null;
  let meta = null;
  let engine = null;
  let engineTask = null;
  let loading = false;
  let generation = 0;
  let pending = null;
  let message = '';
  let messageError = false;
  let localWarning = '';
  let localState = { version: 1, days: {} };
  let drafts = [];
  let selectedAnime = null;
  let observedUid = C.snapshot().member?.uid || null;
  let anidleBindCleanup = null;
  const available = () => !online || C.snapshot().configured && C.snapshot().ready && !!C.snapshot().member;
  const today = () => D.todayKey();
  try {
    const saved = localStorage.getItem(localKey);
    if (saved) { const parsed = JSON.parse(saved); if (parsed.version !== 1 || !parsed.days || typeof parsed.days !== 'object' || Array.isArray(parsed.days)) throw Error(); localState = parsed; }
  } catch (_) { localWarning = 'O progresso local anterior não pôde ser carregado.'; }
  function key(game = mode, day = date) { return game + '_' + day; }
  function saveLocal(record) {
    localState.days[key()] = record;
    try { localStorage.setItem(localKey, JSON.stringify(localState)); localWarning = ''; }
    catch (_) { localWarning = 'O navegador não permitiu salvar. Este progresso dura apenas nesta aba.'; }
  }
  function metadata() {
    return Object.entries(localState.days).filter(([, row]) => row && row.mode === mode && typeof row.completed === 'boolean').map(([, row]) => ({ date: row.date, completed: row.completed, started: Array.isArray(row.attempts) && row.attempts.length > 0 }));
  }
  function loadEngine() {
    if (!engineTask) engineTask = (async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30000);
      try {
        const responses = await Promise.all([
          fetch('mini-data.json?v=mini-2026-10-20-v1', { signal: controller.signal }),
          fetch('character-levels.json?v=characters-2026-10-24-v3', { signal: controller.signal }),
          fetch('mini-expanded.json?v=mini-2026-10-25-v4', { signal: controller.signal }),
          fetch('character-levels-expanded.json?v=characters-2026-10-25-v4', { signal: controller.signal })
        ]);
        if (!responses[0].ok) throw Error('Não foi possível carregar o catálogo dos desafios.');
        if (!responses[1].ok) throw Error('Não foi possível carregar os níveis de personagens. Atualize a página e tente novamente.');
        if (!responses[2].ok || !responses[3].ok) throw Error('Não foi possível carregar o catálogo ampliado. Atualize a página e tente novamente.');
        const [dataset, characterLevels, expandedDataset, expandedLevels] = await Promise.all(responses.map((response) => response.json()));
        engine = window.SorteioMiniCore.createEngine({ dataset, D, characterLevels, expansion: { dataset: expandedDataset, characterLevels: expandedLevels } });
        return engine;
      } finally { clearTimeout(timer); }
    })().catch((error) => { engineTask = null; throw error; });
    return engineTask;
  }
  function header(game = mode) {
    if (!labels[game]) return;
    $('#guessr-title').textContent = labels[game];
    $('#guessr-intro').textContent = game === 'characters' ? 'Acerte o nome e a obra. Responda só o que souber.' : 'Descubra o anime pelas pistas de cada palpite.';
    $('#guessr-mode').hidden = false;
    $('#guessr-mode').textContent = 'Diário';
    $('#guessr-profiles').hidden = true;
  }
  function updateLocation() {
    if (!active || $('#guessr-view').hidden) return;
    try { history.replaceState(null, '', '#guessr-' + (mode === 'characters' ? 'personagens' : 'anidle') + '/' + date); } catch (_) { /* The game still works without history. */ }
  }
  function accept(response) {
    const wasCompleted = current?.completed;
    meta = response; current = response.day; date = current.date; dates[mode] = date;
    drafts = []; selectedAnime = null;
    message = ''; messageError = false;
    updateLocation();
    if (current.completed && !wasCompleted) document.dispatchEvent(new CustomEvent('sorteio:daily-completed'));
  }
  async function loadDay(nextDate) {
    if (!active || loading) return;
    if (pending) { await play(pending); return; }
    try { D.validateDate(nextDate); if (nextDate < '2026-10-20' || nextDate > today()) nextDate = today(); }
    catch (_) { nextDate = today(); }
    date = nextDate; dates[mode] = date; drafts = []; current = null; meta = null;
    const token = ++generation;
    message = ''; messageError = false;
    if (!available()) { render(); updateLocation(); return; }
    loading = true; render();
    try {
      const game = await loadEngine();
      if (token !== generation) return;
      const response = online ? await C.getMiniDay(mode, date) : game.response(game.read(localState.days[key()] || null, mode, date, today()).day, metadata(), today());
      if (token === generation) accept(response);
    } catch (error) {
      if (token === generation) { message = location.protocol === 'file:' ? 'Abra o desafio pelo endereço do GitHub Pages.' : error.name === 'AbortError' ? 'O catálogo demorou para carregar. Tente novamente.' : error.message || 'Não foi possível abrir o desafio.'; messageError = true; }
    } finally { if (token === generation) { loading = false; render(); } }
  }
  async function play(action) {
    if (!active || loading || !current || !available()) return;
    const token = generation;
    const before = current.attemptsUsed;
    const beforeLevel = current.levelIndex;
    const beforeLevelCompleted = current.levelCompleted;
    const wasCompleted = current.completed;
    const request = action.id ? action : { ...action, id: crypto.randomUUID() };
    pending = request; loading = true; message = ''; messageError = false; render();
    try {
      let response;
      if (online) response = await C.playMini(mode, date, request);
      else {
        const result = engine.apply(localState.days[key()] || null, mode, date, request, today());
        if (result.changed) saveLocal(result.record);
        response = engine.response(result.day, metadata(), today());
      }
      if (token === generation) { pending = null; accept(response); }
    } catch (error) {
      if (token !== generation) return;
      if (online) {
        try {
          const response = await C.getMiniDay(mode, date);
          if (token !== generation) return;
          pending = null; accept(response);
          if (response.day.attemptsUsed > before || response.day.completed && !wasCompleted || response.day.levelIndex !== beforeLevel || response.day.levelCompleted && !beforeLevelCompleted) { message = 'Progresso recuperado.'; return; }
          if (response.day.attemptsUsed === before && request.kind === 'characters' && response.day.levelIndex === beforeLevel) drafts = request.answers.map((answer) => ({ character: answer.character, animeText: answer.animeText, animeId: answer.animeId }));
        } catch (_) { /* Keep the exact request ID available for retry. */ }
      } else pending = null;
      message = error.message || 'Não foi possível salvar o palpite.'; messageError = true;
    } finally {
      if (token === generation) { loading = false; render(); }
    }
  }
  function activate(game) {
    if (!labels[game]) return;
    active = true; mode = game; generation++; loading = false; pending = null; drafts = []; current = null; meta = null;
    const linked = location.hash.match(new RegExp('^#guessr-' + (game === 'characters' ? 'personagens' : 'anidle') + '/(\\d{4}-\\d{2}-\\d{2})$'));
    header(); loadDay(linked ? linked[1] : dates[game] || today());
  }
  function deactivate() {
    if (!active) return;
    active = false; generation++; loading = false; pending = null;
  }
  function bindSearch(input, popup, select, kind = 'anime') {
    const names = kind === 'character';
    let options = [];
    let index = -1;
    let blurTimer;
    function close() { popup.hidden = true; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); index = -1; }
    function choose(number) {
      const option = options[number];
      if (!option || !names && mode === 'anidle' && current?.guesses?.some((guess) => guess.anime.id === option.id)) return;
      clearTimeout(blurTimer);
      input.value = names ? option.name : option.title; select(option); input.focus(); close();
    }
    function paint() {
      popup.hidden = false; input.setAttribute('aria-expanded', 'true');
      popup.innerHTML = options.length ? options.map((anime, i) => {
        if (names) return '<button type="button" role="option" tabindex="-1" class="mini-suggestion' + (index === i ? ' is-active' : '') + '" id="' + popup.id + '-' + i + '" data-choice="' + i + '" aria-selected="' + String(i === index) + '"><span><strong>' + escape(anime.name) + '</strong>' + (anime.matchedAlias ? '<small>' + escape(anime.matchedAlias) + '</small>' : '') + '</span></button>';
        const used = mode === 'anidle' && current?.guesses?.some((guess) => guess.anime.id === anime.id);
        const detail = mode === 'anidle' ? (used ? 'Já tentado' : '') : (anime.year || 'Ano não informado');
        return '<button type="button" role="option" tabindex="-1" class="mini-suggestion' + (index === i ? ' is-active' : '') + '" id="' + popup.id + '-' + i + '" data-choice="' + i + '" aria-selected="' + String(i === index) + '"' + (used ? ' aria-disabled="true"' : '') + '><img src="' + escape(anime.coverUrl || 'poster-placeholder.svg') + '" alt="" referrerpolicy="no-referrer" loading="lazy"><span><strong>' + escape(anime.title) + '</strong>' + (detail ? '<small>' + escape(String(detail)) + '</small>' : '') + '</span></button>';
      }).join('') : '<p class="mini-search-empty">' + (names ? 'Nenhum personagem encontrado.' : 'Nenhum anime encontrado no catálogo do desafio.') + '</p>';
      if (index >= 0) input.setAttribute('aria-activedescendant', popup.id + '-' + index); else input.removeAttribute('aria-activedescendant');
    }
    function search() {
      if (!engine || input.value.trim().length < (names ? 1 : 2) || input.disabled) { close(); return; }
      options = names ? engine.searchCharacters(input.value, 8) : engine.searchAnime(input.value, 8, { mode, date }); index = -1; paint();
    }
    function keydown(event) {
      if (event.key === 'Escape') { close(); return; }
      if (popup.hidden || !options.length) return;
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); index = index < 0 ? event.key === 'ArrowDown' ? 0 : options.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length; paint(); }
      else if (event.key === 'Enter' && index >= 0) { event.preventDefault(); choose(index); }
    }
    function click(event) { const button = event.target.closest('[data-choice]'); if (button) choose(Number(button.dataset.choice)); }
    function blur() { blurTimer = setTimeout(close, 150); }
    input.addEventListener('input', search); input.addEventListener('focus', search); input.addEventListener('keydown', keydown); input.addEventListener('blur', blur); popup.addEventListener('click', click);
    return () => { clearTimeout(blurTimer); input.removeEventListener('input', search); input.removeEventListener('focus', search); input.removeEventListener('keydown', keydown); input.removeEventListener('blur', blur); popup.removeEventListener('click', click); close(); };
  }
  function renderCharacters() {
    if (!current?.cards) return;
    const hasLevels = Array.isArray(current.levels) && current.levels.length > 1;
    const levelClosed = current.completed || current.levelCompleted;
    const levelAttempts = current.levelAttemptsUsed ?? current.attemptsUsed;
    const levels = $('#mini-character-levels');
    levels.hidden = !hasLevels;
    levels.innerHTML = hasLevels ? current.levels.map((level) => '<li class="' + (level.index === current.levelIndex && !current.completed ? 'is-active ' : '') + (level.completed ? 'is-complete' : '') + '"' + (level.index === current.levelIndex && !current.completed ? ' aria-current="step"' : '') + '><span>' + (level.index + 1) + '</span><strong>' + escape(level.name) + '</strong><small>' + (level.completed ? level.score + ' / ' + level.maxScore : '4 personagens') + '</small></li>').join('') : '';
    $('#mini-character-cards').innerHTML = current.cards.map((card, i) => {
      const draft = drafts[i] || {};
      const character = card.characterCorrect ? card.characterGuess : draft.character ?? card.characterGuess;
      const anime = card.animeCorrect ? card.animeGuess : draft.animeText ?? card.animeGuess;
      const disabled = levelClosed || loading || !!pending;
      const position = current.completed ? i + 1 : (hasLevels ? current.levelIndex * 4 : 0) + i + 1;
      const field = (type, value, correct, placeholder) => {
        const popup = 'mini-' + type + '-options-' + i;
        return '<div class="mini-character-field' + (correct ? ' is-correct' : levelAttempts && value ? ' is-wrong' : '') + '"><label class="sr-only" for="mini-' + type + '-' + i + '">' + placeholder + ' ' + position + '</label><input id="mini-' + type + '-' + i + '" data-slot="' + i + '" data-field="' + type + '" value="' + escape(value || '') + '" placeholder="' + placeholder + '" maxlength="200" autocomplete="off" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="' + popup + '"' + (disabled || correct ? ' disabled' : '') + '>' + (correct ? '<span class="mini-field-mark" aria-label="Correto">✓</span>' : '') + '<div id="' + popup + '" class="mini-suggestions' + (type === 'name' ? ' mini-name-suggestions' : '') + '" role="listbox" aria-label="' + (type === 'name' ? 'Personagens encontrados' : 'Animes encontrados') + '" hidden></div></div>';
      };
      const group = hasLevels && current.completed && i % 4 === 0 ? '<h3 class="mini-character-group">' + escape(current.levels[Math.floor(i / 4)].name) + '</h3>' : '';
      return group + '<article class="mini-character-card"><div class="mini-character-image"><img src="' + escape(card.imageUrl || 'poster-placeholder.svg') + '" alt="Personagem ' + position + '" referrerpolicy="no-referrer"><span>' + String(position).padStart(2, '0') + '</span></div>' + field('name', character, card.characterCorrect, 'Nome do personagem') + field('work', anime, card.animeCorrect, 'Anime / obra') + (levelClosed ? '<div class="mini-character-answer"><strong>' + escape(card.characterName) + '</strong><span>' + escape(card.animeTitle) + '</span></div>' : '') + '</article>';
    }).join('');
    current.cards.forEach((card, i) => {
      const nameInput = $('#mini-name-' + i);
      if (!nameInput.disabled) bindSearch(nameInput, $('#mini-name-options-' + i), (character) => { drafts[i] = { ...(drafts[i] || {}), character: character.name }; }, 'character');
      const input = $('#mini-work-' + i);
      if (!input.disabled) bindSearch(input, $('#mini-work-options-' + i), (anime) => { drafts[i] = { ...(drafts[i] || {}), animeText: anime.title, animeId: anime.id }; });
    });
  }
  function source(value) { return sources[value] || value || '—'; }
  function genre(value) { return genres[value] || value; }
  function numeric(cell, decimal) {
    const formatted = cell.value === null ? '—' : Number(cell.value).toLocaleString('pt-BR', { useGrouping: false, maximumFractionDigits: decimal ? 1 : 0 });
    const direction = { higher: '↑', lower: '↓', equal: '✓', unknown: '' }[cell.direction];
    const title = { higher: 'A resposta tem um valor maior', lower: 'A resposta tem um valor menor', equal: 'Valor correto', unknown: 'Sem dados para comparar' }[cell.direction];
    return '<div class="mini-numeric mini-match-' + cell.direction + '" title="' + title + '"><span>' + formatted + '</span><span class="mini-direction" aria-label="' + title + '">' + direction + '</span></div>';
  }
  function attributes(cell, translate) {
    if (!cell?.items?.length) return '<span class="mini-match-unknown">—</span>';
    return '<div class="mini-attribute-list mini-status-' + cell.status + '" title="' + (cell.status === 'partial' ? 'Coincidência parcial' : cell.status === 'equal' ? 'Todos coincidem' : '') + '">' + cell.items.map((item) => '<span class="mini-match-' + (item.match ? 'equal' : 'miss') + '">' + escape(translate ? genre(item.value) : item.value) + '</span>').join('') + '</div>';
  }
  function bound(value, decimal) {
    const number = (v) => Number(v).toLocaleString('pt-BR', { useGrouping: false, maximumFractionDigits: decimal ? 1 : 0 });
    if (value.exact !== null) return '<span class="mini-match-equal">' + number(value.exact) + ' ✓</span>';
    return [value.min !== null ? '&gt; ' + number(value.min) : '', value.max !== null ? '&lt; ' + number(value.max) : ''].filter(Boolean).join('<br>') || '—';
  }
  function known(values, translate) { return values.length ? '<div class="mini-attribute-list">' + values.map((value) => '<span class="mini-match-equal">' + escape(translate ? genre(value) : value) + '</span>').join('') + '</div>' : '—'; }
  function renderAnidle() {
    const guesses = current.guesses || [];
    const summary = current.summary;
    $('#mini-anime-input').disabled = loading || current.completed || !!pending;
    $('#mini-anime-submit').disabled = loading || current.completed || !!pending || !selectedAnime;
    $('#mini-anime-input').value = selectedAnime?.title || '';
    $('#mini-anime-options').hidden = true;
    $('#mini-anime-input').setAttribute('aria-expanded', 'false');
    $('#mini-anidle-form').hidden = current.completed;
    $('#mini-anidle-giveup').hidden = current.completed;
    $('#mini-anidle-giveup').disabled = loading || !!pending;
    $('#mini-guesses-wrap').hidden = !guesses.length;
    $('#mini-anidle-guesses').innerHTML = guesses.slice().reverse().map((row, i) => '<tr><td><div class="mini-comp-title mini-match-' + (row.correct ? 'equal' : 'miss') + '"><img src="' + escape(row.anime.coverUrl || 'poster-placeholder.svg') + '" alt="" loading="lazy" referrerpolicy="no-referrer"><span><strong>' + escape(row.anime.title) + '</strong><small>Palpite ' + (guesses.length - i) + (row.correct ? ' · Acertou ✓' : '') + '</small></span></div></td><td>' + numeric(row.year) + '</td><td>' + attributes(row.studios) + '</td><td class="mini-match-' + row.source.status + '">' + escape(source(row.source.value)) + '</td><td>' + numeric(row.score, true) + '</td><td>' + attributes(row.genres, true) + '</td><td>' + attributes(row.tags) + '</td></tr>').join('');
    $('#mini-summary-body').innerHTML = '<tr><td><span class="mini-match-unknown">Pistas encontradas</span></td><td>' + bound(summary.year) + '</td><td>' + known(summary.studios) + '</td><td class="mini-match-equal">' + escape(source(summary.source)) + '</td><td>' + bound(summary.score, true) + '</td><td>' + known(summary.genres, true) + '</td><td>' + known(summary.tags) + '</td></tr>';
    $('#mini-anidle-summary').hidden = !$('#mini-summary-toggle').checked;
    const hints = current.hints;
    $('#mini-hint-status').textContent = current.completed ? '' : current.attemptsUsed < 11 ? 'Primeira dica em ' + (11 - current.attemptsUsed) + ' palpites' : current.attemptsUsed < 17 ? 'Capa em ' + (17 - current.attemptsUsed) + ' palpites' : 'Todas as dicas liberadas';
    $('#mini-hints').hidden = !hints.format && !hints.coverUrl;
    $('#mini-hints').innerHTML = (hints.coverUrl ? '<img src="' + escape(hints.coverUrl) + '" alt="Capa da resposta" referrerpolicy="no-referrer">' : '') + '<span>' + (current.answer ? '<strong>' + escape(current.answer.title) + '</strong><br>' : '') + (hints.format ? escape(hints.format) : '') + (hints.episodes ? ' · ' + hints.episodes + ' episódios' : '') + '</span>';
    if (anidleBindCleanup) anidleBindCleanup();
    anidleBindCleanup = bindSearch($('#mini-anime-input'), $('#mini-anime-options'), (anime) => { selectedAnime = anime; $('#mini-anime-submit').disabled = loading || current.completed || !!pending; });
  }
  function render() {
    if (!active) return;
    header();
    const state = C.snapshot();
    const gate = !available();
    $('#mini-login-gate').hidden = !gate;
    $('#mini-login-message').textContent = state.error || (!state.configured ? 'O modo online ainda não foi configurado.' : !state.ready ? 'Conectando…' : 'Entre para jogar o desafio diário.');
    $('#mini-login-gate button').hidden = !state.configured || !state.ready;
    $('#mini-daily-toolbar').hidden = gate;
    $('#mini-board').hidden = gate || !current;
    $('#mini-date').value = date; $('#mini-date').max = today(); $('#mini-date').disabled = loading || !!pending;
    $('#mini-today').hidden = date === today(); $('#mini-today').disabled = loading || !!pending;
    const notice = [message, online ? '' : localWarning, loading ? 'Carregando desafio…' : ''].filter(Boolean).join(' ');
    $('#mini-notice').textContent = notice; $('#mini-notice').hidden = !notice; $('#mini-notice').classList.toggle('is-error', messageError || !!localWarning);
    $('#mini-games').setAttribute('aria-busy', String(loading));
    $('#mini-retry').hidden = gate || loading || !messageError; $('#mini-retry').textContent = pending ? 'Recuperar progresso' : current ? 'Atualizar desafio' : 'Tentar novamente';
    const streak = meta?.streak || { current: 0, best: 0 };
    $('#mini-streak').textContent = streak.current; $('#mini-best').textContent = streak.best; $('#mini-streak-unit').textContent = streak.current === 1 ? 'dia' : 'dias';
    if (!current) return;
    const characterLevels = mode === 'characters' && Array.isArray(current.levels) && current.levels.length > 1;
    const attempts = characterLevels ? current.levelAttemptsUsed : current.attemptsUsed;
    $('#mini-attempts').textContent = current.completed ? 'Desafio encerrado' : characterLevels && current.levelCompleted ? current.levelName + ' concluído' : (characterLevels ? current.levelName + ' · ' : '') + 'Tentativa ' + Math.min(current.maxAttempts, attempts + 1) + ' / ' + current.maxAttempts;
    $('#mini-progress').textContent = mode === 'characters' ? current.score + ' / ' + current.maxScore + ' pontos' : current.attemptsUsed + ' / 22 palpites';
    $('#mini-character-form').hidden = mode !== 'characters'; $('#mini-anidle-panel').hidden = mode !== 'anidle';
    if (mode === 'characters') {
      renderCharacters();
      $('#mini-character-submit').hidden = current.completed || !!current.levelCompleted; $('#mini-character-submit').disabled = loading || !!pending;
      $('#mini-character-next').hidden = !characterLevels || current.completed || !current.levelCompleted;
      $('#mini-character-next').disabled = loading || !!pending;
      $('#mini-character-next').textContent = 'Próximo nível' + (characterLevels && current.levels[current.levelIndex + 1] ? ': ' + current.levels[current.levelIndex + 1].name : '');
      $('#mini-character-giveup').hidden = current.completed; $('#mini-character-giveup').disabled = loading || !!pending;
    } else renderAnidle();
    $('#mini-finished').hidden = !current.completed;
    $('#mini-finished-title').textContent = mode === 'characters' ? current.score === current.maxScore ? 'Todos os campos certos!' : 'Desafio concluído' : current.wins ? 'Anime encontrado!' : 'Era ' + current.answer?.title;
    $('#mini-finished-description').textContent = mode === 'characters' ? current.wins + '/' + (current.totalCharacters || 4) + ' personagens completos · ' + current.score + '/' + current.maxScore + ' pontos' : current.score + '/22 pontos · ' + current.attemptsUsed + (current.attemptsUsed === 1 ? ' palpite' : ' palpites');
    $('#mini-ranking').hidden = !online;
  }
  $('#mini-character-cards').addEventListener('input', (event) => {
    const input = event.target.closest('[data-field]'); if (!input) return;
    const slot = Number(input.dataset.slot); drafts[slot] = { ...(drafts[slot] || {}) };
    if (input.dataset.field === 'name') drafts[slot].character = input.value;
    else { drafts[slot].animeText = input.value; drafts[slot].animeId = null; }
  });
  $('#mini-character-cards').addEventListener('error', (event) => { if (event.target.tagName === 'IMG') event.target.parentElement.classList.add('mini-image-error'); }, true);
  $('#mini-character-form').addEventListener('submit', (event) => {
    event.preventDefault(); if (!current || loading || current.completed || current.levelCompleted || pending) return;
    const answers = current.cards.map((card, i) => {
      const animeText = $('#mini-work-' + i).value;
      const draft = drafts[i];
      const animeId = !animeText.trim() ? null : draft && Object.hasOwn(draft, 'animeId') ? (draft.animeText === animeText ? draft.animeId : null) : card.animeGuess === animeText ? card.animeId ?? null : null;
      return { character: $('#mini-name-' + i).value, animeText, animeId };
    });
    play({ kind: 'characters', answers, ...(Number.isInteger(current.levelIndex) ? { levelIndex: current.levelIndex } : {}) });
  });
  $('#mini-character-next').addEventListener('click', () => {
    if (current?.levelCompleted && !current.completed && !loading && !pending) play({ kind: 'next_level', levelIndex: current.levelIndex });
  });
  $('#mini-anime-input').addEventListener('input', () => { selectedAnime = null; $('#mini-anime-submit').disabled = true; });
  $('#mini-anidle-form').addEventListener('submit', (event) => { event.preventDefault(); if (selectedAnime && !loading && !current?.completed && !pending) play({ kind: 'anime', animeId: selectedAnime.id }); });
  function giveup() {
    if (!current || loading || current.completed || pending) return;
    const description = mode === 'characters' && current.totalCharacters === 12 ? 'Os três níveis serão encerrados, as respostas reveladas e o resultado salvo. Você poderá revisar este dia pelo calendário.' : 'As respostas serão reveladas e o resultado será salvo. Você poderá revisar este dia pelo calendário.';
    A.confirm('Encerrar o desafio de hoje?', description, () => play({ kind: 'giveup' }), 'Encerrar desafio');
  }
  $('#mini-character-giveup').addEventListener('click', giveup); $('#mini-anidle-giveup').addEventListener('click', giveup);
  $('#mini-date').addEventListener('change', () => loadDay($('#mini-date').value)); $('#mini-today').addEventListener('click', () => loadDay(today()));
  $('#mini-retry').addEventListener('click', () => pending ? play(pending) : loadDay(date));
  $('#mini-summary-toggle').addEventListener('change', () => { $('#mini-anidle-summary').hidden = !$('#mini-summary-toggle').checked; });
  $('#mini-ranking').addEventListener('click', () => { window.SorteioAccount.selectGame(mode); document.querySelector('[data-section="ranking"]').click(); });
  C.subscribe((state) => {
    const uid = state.member?.uid || null;
    if (uid !== observedUid) {
      observedUid = uid; generation++; loading = false; pending = null; current = null; meta = null; drafts = [];
      if (active && uid) loadDay(date);
    }
    if (active) render();
  });
  document.addEventListener('visibilitychange', () => {
    const editing = mode === 'characters' ? drafts.some((draft) => draft && (draft.character || draft.animeText)) : !!$('#mini-anime-input').value.trim();
    if (!document.hidden && active && !loading && available() && !editing) loadDay(date);
  });
  let observedToday = today();
  setInterval(() => { const next = today(); if (next !== observedToday) { observedToday = next; if (active && !loading && available()) loadDay(date); } }, 60000);
  window.SorteioMiniUI = Object.freeze({ activate, deactivate, header });
})();

(function () {
  'use strict';
  const A = window.SorteioApp;
  const G = window.GuessrCore;
  const S = window.AnimeServices;
  const D = window.DailyGuessr;
  const html = window.RouletteCore.escapeHtml;
  const $ = (selector) => document.querySelector(selector);
  const key = 'sorteio.guessr.v1';
  let game;
  let loading = false;
  let loadController;
  let generation = 0;
  let loadedProfiles = [];
  let loadedKey = '';
  let loadedAt = 0;
  let progress = '';
  let message = '';
  let messageIsError = false;
  let storageMessage = '';
  const dailyKey = 'sorteio.guessr.daily.v1';
  let guessrMode = location.hash.startsWith('#guessr-diario') ? 'daily' : 'free';
  let selectedDate = D.todayKey();
  const linkedDate = location.hash.match(/^#guessr-diario\/(\d{4}-\d{2}-\d{2})$/);
  if (linkedDate) { try { selectedDate = D.validateDate(linkedDate[1]); } catch (error) { /* Use today for an invalid link. */ } }
  let dailyDataset = null;
  let dailyState = null;
  let dailyView = null;
  let dailyLoading = false;
  let dailyMessage = '';
  let dailyMessageIsError = false;
  let dailyStorageMessage = '';
  let reviewIndex = null;
  let calendarMonth = selectedDate.slice(0, 7);
  const signature = (friends) => JSON.stringify(friends.map((friend) => [friend.id, friend.name, friend.anilistUsername || '']).sort((a, b) => a[0].localeCompare(b[0])));
  let friendsKey = signature(A.getFriends());
  try {
    const stored = localStorage.getItem(key);
    game = stored ? G.normalizeGame(JSON.parse(stored)) : G.createGame();
  } catch (error) {
    game = G.createGame();
    storageMessage = 'O progresso anterior do Guessr não pôde ser carregado.';
  }

  function persist() {
    try { localStorage.setItem(key, JSON.stringify(game)); storageMessage = ''; }
    catch (error) { storageMessage = 'O navegador não permitiu salvar o placar.'; }
  }
  function persistDaily() {
    try { localStorage.setItem(dailyKey, JSON.stringify(dailyState)); dailyStorageMessage = ''; }
    catch (error) { dailyStorageMessage = 'O navegador não permitiu salvar o desafio diário.'; }
  }
  function updateLocation() {
    try { history.replaceState(null, '', guessrMode === 'daily' ? '#guessr-diario/' + selectedDate : '#guessr'); } catch (error) { /* Navigation still works without history. */ }
  }
  function setSection(next) {
    if (A.isBusy()) return;
    $('#draw-view').hidden = next !== 'draw';
    $('#guessr-view').hidden = next !== 'guessr';
    document.querySelectorAll('[data-section]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.section === next)));
    if (next === 'guessr') {
      updateLocation(); render();
      if (guessrMode === 'daily' && !dailyView && !dailyLoading) loadDaily(selectedDate);
    } else { try { history.replaceState(null, '', '#roletas'); } catch (error) { /* The active tab still works when history is unavailable. */ } }
  }
  function score(value) { return value.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '/10'; }
  function formatDay(date, options = { day: 'numeric', month: 'short', year: 'numeric' }) {
    return new Intl.DateTimeFormat('pt-BR', { ...options, timeZone: 'UTC' }).format(new Date(date + 'T12:00:00Z'));
  }
  function renderDailyPanel() {
    $('#daily-date-label').textContent = formatDay(selectedDate);
    $('#daily-today').hidden = selectedDate === D.todayKey();
    $('#daily-today').disabled = dailyLoading;
    $('#daily-calendar-open').disabled = dailyLoading || !dailyDataset;
    const streak = dailyState ? D.streak(dailyState, D.todayKey()) : { current: 0, best: 0 };
    $('#daily-streak').textContent = streak.current;
    $('#daily-streak-unit').textContent = streak.current === 1 ? 'dia' : 'dias';
    $('#daily-best').textContent = streak.best;
    const summary = dailyView ? D.summary(dailyView) : null;
    $('#daily-progress').innerHTML = Array.from({ length: 5 }, (_, i) => {
      const round = dailyView && dailyView.rounds[i];
      const current = !!dailyView && !dailyView.completed && dailyView.index === i;
      const selected = !!dailyView && (reviewIndex === null ? dailyView.index : reviewIndex) === i;
      const reviewing = selected && !current;
      const available = !!round && (round.finished || current);
      return '<li><button class="daily-round-dot' + (round && round.finished ? ' is-complete' : '') + (current ? ' is-current' : '') + (reviewing ? ' is-review' : '') + '" data-daily-round="' + i + '"' + (!available || dailyLoading ? ' disabled' : '') + ' aria-label="Rodada ' + (i + 1) + (round && round.finished ? ', concluída' : current ? ', atual' : '') + '" aria-pressed="' + String(selected) + '">' + (i + 1) + '</button></li>';
    }).join('');
    $('#daily-summary').hidden = !summary || !summary.completed;
    $('#daily-summary').textContent = summary && summary.completed ? 'Desafio concluído · ' + summary.wins + '/5 acertos · ' + summary.score + '/15 pontos' : '';
  }
  function render() {
    const daily = guessrMode === 'daily';
    const friends = daily && dailyDataset ? dailyDataset.friends : A.getFriends();
    const configured = friends.filter((friend) => friend.anilistUsername);
    const round = daily ? dailyView && dailyView.rounds[reviewIndex === null ? dailyView.index : reviewIndex] : game.round;
    const preview = !daily && (round ? round.preview : configured.length === 1);
    const shownLoading = daily ? dailyLoading : loading;
    const summary = dailyView ? D.summary(dailyView) : { score: 0, wins: 0, completed: false };
    const reviewing = daily && reviewIndex !== null && dailyView && reviewIndex !== dailyView.index;
    $('#guessr-title').textContent = daily ? 'Desafio diário' : 'De quem são essas notas?';
    $('#guessr-intro').textContent = daily ? 'Cinco rodadas. Três tentativas por rodada.' : 'Três animes. Três tentativas.';
    $('#daily-panel').hidden = !daily;
    $('#guessr-profiles').hidden = daily;
    $('#guessr-clear-score').hidden = daily;
    document.querySelectorAll('[data-guessr-mode]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.guessrMode === guessrMode)));
    if (daily) renderDailyPanel();
    $('#guessr-mode').hidden = !preview;
    $('#guessr-score').textContent = daily ? summary.score : game.score;
    $('#guessr-wins').textContent = daily ? summary.wins + ' / 5' : game.stats.wins + ' / ' + game.stats.rounds;
    $('#guessr-attempts').textContent = round ? (round.finished ? 'Rodada encerrada' : (3 - round.guessedIds.length) + ((3 - round.guessedIds.length) === 1 ? ' tentativa' : ' tentativas')) : '3 tentativas';
    const notice = (daily ? [dailyMessage, dailyStorageMessage] : [preview ? 'Prévia sem pontuação. São necessários dois perfis com pelo menos três animes avaliados para valer pontos.' : '', !configured.length ? 'Vincule os perfis do AniList em Perfis para começar.' : '', message, storageMessage]).filter(Boolean).join(' ');
    $('#guessr-notice').hidden = !notice;
    $('#guessr-notice').textContent = notice;
    $('#guessr-notice').classList.toggle('is-error', daily ? dailyMessageIsError || !!dailyStorageMessage : messageIsError || !!storageMessage);
    $('#guessr-view').setAttribute('aria-busy', String(shownLoading));
    $('#guessr-next').disabled = daily ? dailyLoading || summary.completed || !reviewing && !!round && !round.finished : loading || !!round && !round.finished || !configured.length;
    $('#guessr-next').hidden = daily ? summary.completed || !reviewing && !!round && !round.finished && !dailyLoading : !!round && !round.finished && !loading;
    $('#guessr-next').textContent = daily ? dailyLoading ? 'Carregando desafio…' : reviewing ? 'Continuar desafio' : dailyMessageIsError ? 'Tentar novamente' : round ? 'Próxima rodada' : 'Começar desafio' : loading ? progress || 'Carregando pistas…' : round && !round.finished ? 'Rodada em andamento' : round ? 'Próxima rodada' : messageIsError ? 'Tentar novamente' : 'Carregar pistas';
    $('#guessr-clear-score').disabled = loading || !(game.score || game.stats.rounds || game.stats.misses || game.stats.previews);
    $('#guessr-clues').innerHTML = round ? round.clues.map((clue, i) => '<article class="guessr-clue"><div class="guessr-poster"><img src="' + html(clue.coverUrl || 'poster-placeholder.svg') + '" data-poster-url="' + html(clue.coverUrl || '') + '" alt="Capa de ' + html(clue.name) + '" loading="lazy" referrerpolicy="no-referrer"><span class="guessr-clue-number">0' + (i + 1) + '</span></div><div class="guessr-clue-info"><h2 title="' + html(clue.name) + '">' + html(clue.name) + '</h2><div class="guessr-clue-meta"><strong class="guessr-clue-score">★ ' + score(clue.score) + '</strong><span class="guessr-status status-' + clue.status.toLowerCase() + '">' + html(S.statusLabel(clue.status)) + '</span></div></div></article>').join('') : [1, 2, 3].map((i) => '<div class="guessr-clue guessr-placeholder" aria-hidden="true"><div class="guessr-poster"><span>0' + i + '</span></div><div class="guessr-clue-info"><strong>Anime ' + i + '</strong><small>Nota e status</small></div></div>').join('');
    const options = round ? round.options : friends;
    $('#guessr-options').innerHTML = options.map((friend) => {
      const guessed = !!round && round.guessedIds.includes(friend.id);
      const correct = !!round && round.finished && round.targetId === friend.id;
      return '<button class="guessr-option' + (correct ? ' is-correct' : guessed ? ' is-wrong' : '') + '" data-guess="' + friend.id + '"' + (!round || round.finished || shownLoading || guessed ? ' disabled' : '') + ' aria-label="' + html(friend.name + (correct ? ', resposta correta' : guessed ? ', palpite incorreto' : '')) + '"><span>' + html(friend.name) + '</span>' + (correct ? '<span aria-hidden="true">✓</span>' : guessed ? '<span aria-hidden="true">×</span>' : '') + '</button>';
    }).join('');
    const feedback = $('#guessr-feedback');
    feedback.className = 'guessr-feedback' + (round && round.finished ? round.correct ? ' is-correct' : ' is-wrong' : '');
    if (shownLoading) feedback.textContent = daily ? 'Carregando desafio…' : progress || 'Carregando pistas…';
    else if (!round) feedback.textContent = daily ? 'Carregue o desafio para começar.' : 'Carregue as pistas para começar.';
    else if (round.finished) feedback.textContent = (round.correct ? 'Acertou! Era ' : 'Era ') + round.targetName + '.' + (round.preview ? ' Prévia sem pontuação.' : round.correct ? ' +' + round.points + (round.points === 1 ? ' ponto.' : ' pontos.') : daily && summary.completed ? ' Desafio concluído.' : ' Tente novamente na próxima rodada.');
    else if (round.guessedIds.length) feedback.textContent = 'Esse nome não era. Restam ' + (3 - round.guessedIds.length) + ((3 - round.guessedIds.length) === 1 ? ' tentativa.' : ' tentativas.');
    else feedback.textContent = 'Quem deu essas notas?';
    $('#guessr-reveal').hidden = !round || !round.finished;
    if (round && round.finished) {
      $('#guessr-reveal').href = 'https://anilist.co/user/' + encodeURIComponent(round.username) + '/';
      $('#guessr-reveal').textContent = 'Ver perfil de ' + round.targetName + ' no AniList ↗';
    } else { $('#guessr-reveal').removeAttribute('href'); $('#guessr-reveal').textContent = ''; }
  }
  async function loadDaily(date) {
    if (dailyLoading) return;
    dailyLoading = true; dailyMessage = ''; dailyMessageIsError = false; render();
    try {
      if (!dailyDataset) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15000);
        try {
          const responses = await Promise.all([
            fetch('daily-data.json?v=2026-10-20-v1', { signal: controller.signal }),
            fetch('daily-cap.json?v=2026-10-21-cap-v1', { signal: controller.signal })
          ]);
          if (responses.some((response) => !response.ok)) throw new Error('Não foi possível carregar a base dos desafios.');
          const [original, cap] = await Promise.all(responses.map((response) => response.json()));
          if (cap.friendId !== 'daily_cap' || cap.name !== 'Cap' || !cap.username || cap.username.toLowerCase() !== 'capkiyo') throw new Error('O perfil de Cap nas pistas diárias é inválido.');
          const updated = { ...original, id: '2026-10-21-cap-v1', startDate: '2026-10-21', profiles: original.profiles.concat(cap) };
          const archive = { version: 1, startDate: original.startDate, friends: original.friends, editions: [
            { from: original.startDate, dataset: original },
            { from: updated.startDate, dataset: updated }
          ] };
          D.validateDataset(archive);
          dailyDataset = archive;
        } finally { clearTimeout(timer); }
      }
      if (!dailyState) {
        let stored = null;
        try { stored = localStorage.getItem(dailyKey); }
        catch (error) { dailyStorageMessage = 'O navegador não permitiu carregar o progresso salvo.'; }
        dailyState = stored ? D.normalizeState(JSON.parse(stored), dailyDataset, D.todayKey()) : D.createState();
      }
      const today = D.todayKey();
      date = D.validateDate(date);
      if (date < dailyDataset.startDate || date > today) date = today;
      const view = D.ensureDay(dailyState, date, dailyDataset, today);
      selectedDate = date; dailyView = view; reviewIndex = null;
      calendarMonth = date.slice(0, 7);
      persistDaily();
      if (guessrMode === 'daily') updateLocation();
    } catch (error) {
      dailyMessage = location.protocol === 'file:' ? 'Abra o desafio diário pelo link do site no GitHub Pages.' : error.name === 'AbortError' ? 'O desafio demorou para carregar. Tente novamente.' : (error.message || 'Não foi possível carregar o desafio agora.');
      dailyMessageIsError = true;
    } finally { dailyLoading = false; render(); }
  }
  function nextDailyRound() {
    if (dailyLoading) return;
    if (!dailyView) { loadDaily(selectedDate); return; }
    if (reviewIndex !== null && reviewIndex !== dailyView.index) { reviewIndex = null; render(); return; }
    try {
      dailyView = D.nextRound(dailyState, selectedDate, dailyDataset, D.todayKey());
      reviewIndex = null; dailyMessage = ''; dailyMessageIsError = false;
      persistDaily(); render();
    } catch (error) { dailyMessage = error.message; dailyMessageIsError = true; render(); }
  }
  function renderCalendar() {
    const today = D.todayKey();
    const first = calendarMonth + '-01';
    const monthDate = new Date(first + 'T12:00:00Z');
    const monthLength = new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth() + 1, 0)).getUTCDate();
    const offset = (monthDate.getUTCDay() + 6) % 7;
    $('#daily-calendar-month').textContent = formatDay(first, { month: 'long', year: 'numeric' });
    $('#daily-month-prev').disabled = !dailyDataset || calendarMonth <= dailyDataset.startDate.slice(0, 7);
    $('#daily-month-next').disabled = calendarMonth >= today.slice(0, 7);
    let cells = '<span class="daily-calendar-pad" aria-hidden="true"></span>'.repeat(offset);
    for (let number = 1; number <= monthLength; number++) {
      const date = calendarMonth + '-' + String(number).padStart(2, '0');
      const entry = dailyState && dailyState.days[date];
      const complete = !!entry && entry.completed;
      const started = !!entry && entry.guesses.some((guesses) => guesses.length);
      const disabled = !dailyDataset || date < dailyDataset.startDate || date > today;
      const label = formatDay(date, { day: 'numeric', month: 'long', year: 'numeric' }) + (complete ? ', concluído' : started ? ', em andamento' : '') + (date === today ? ', hoje' : '');
      cells += '<button class="daily-day' + (complete ? ' is-complete' : started ? ' is-progress' : '') + (date === selectedDate ? ' is-selected' : '') + (date === today ? ' is-today' : '') + '" data-daily-date="' + date + '" aria-label="' + html(label) + '" aria-pressed="' + String(date === selectedDate) + '"' + (disabled ? ' disabled' : '') + '>' + number + '</button>';
    }
    $('#daily-calendar-grid').innerHTML = cells;
  }
  function openCalendar() {
    if (!dailyDataset || dailyLoading) return;
    calendarMonth = selectedDate.slice(0, 7); renderCalendar();
    $('#daily-calendar-dialog').showModal();
  }
  function moveCalendar(delta) {
    const current = new Date(calendarMonth + '-01T12:00:00Z');
    current.setUTCMonth(current.getUTCMonth() + delta);
    const next = current.toISOString().slice(0, 7);
    if (next < dailyDataset.startDate.slice(0, 7) || next > D.todayKey().slice(0, 7)) return;
    calendarMonth = next; renderCalendar();
  }
  async function nextRound() {
    if (loading || game.round && !game.round.finished) return;
    const friends = A.getFriends();
    const currentKey = signature(friends);
    const configured = friends.filter((friend) => friend.anilistUsername);
    if (!configured.length) { message = 'Adicione pelo menos um perfil público do AniList.'; messageIsError = true; render(); return; }
    const users = configured.map((friend) => friend.anilistUsername.toLowerCase());
    if (new Set(users).size !== users.length) { message = 'Cada colega precisa de um perfil diferente para o Guessr.'; messageIsError = true; render(); return; }
    const localGeneration = ++generation;
    if (loadController) loadController.abort();
    const controller = new AbortController();
    loadController = controller;
    loading = true; message = ''; messageIsError = false; progress = 'Carregando pistas…'; render();
    let omissionNote = '';
    try {
      let profiles = loadedProfiles;
      if (loadedKey !== currentKey || Date.now() - loadedAt >= 5 * 60 * 1000) {
        profiles = [];
        const omitted = [];
        for (let i = 0; i < configured.length; i++) {
          if (controller.signal.aborted || localGeneration !== generation) return;
          progress = 'Carregando ' + (i + 1) + ' de ' + configured.length + ' perfis…'; render();
          const friend = configured[i];
          let data;
          try { data = await S.getPublicAnimeList(friend.anilistUsername, { signal: controller.signal }); }
          catch (error) {
            if (error.name === 'AbortError') throw error;
            if (['private', 'not-found', 'invalid'].includes(error.code)) { omitted.push(friend.name + (error.code === 'private' ? ' (lista privada)' : ' (perfil não encontrado)')); continue; }
            throw new Error('Não foi possível carregar a lista de ' + friend.name + '. ' + error.message);
          }
          if (data.entries.length < 3) { omitted.push(friend.name + ' (menos de três animes avaliados)'); continue; }
          profiles.push({ friendId: friend.id, name: friend.name, username: data.username, entries: data.entries });
        }
        if (controller.signal.aborted || localGeneration !== generation || currentKey !== signature(A.getFriends())) return;
        omissionNote = omitted.length ? 'Ficam fora desta rodada: ' + omitted.join(', ') + '.' : '';
        loadedProfiles = profiles; loadedKey = omitted.length ? '' : currentKey; loadedAt = Date.now();
      }
      if (controller.signal.aborted || localGeneration !== generation) return;
      G.createRound(game, profiles, friends); message = omissionNote; persist();
    } catch (error) {
      if (error.name === 'AbortError' || localGeneration !== generation) return;
      message = (error.message || 'Não foi possível carregar o Guessr agora. Tente novamente.') + (omissionNote ? ' ' + omissionNote : ''); messageIsError = true;
    } finally {
      if (localGeneration === generation) { loading = false; loadController = null; progress = ''; render(); }
    }
  }

  document.querySelectorAll('[data-section]').forEach((button) => button.addEventListener('click', () => setSection(button.dataset.section)));
  $('.brand').addEventListener('click', () => setSection('draw'));
  $('#guessr-next').addEventListener('click', () => guessrMode === 'daily' ? nextDailyRound() : nextRound());
  document.querySelectorAll('[data-guessr-mode]').forEach((button) => button.addEventListener('click', () => {
    if (A.isBusy() || button.dataset.guessrMode === guessrMode) return;
    guessrMode = button.dataset.guessrMode;
    if (loading) {
      generation++;
      if (loadController) loadController.abort();
      loadController = null; loading = false; progress = '';
    }
    updateLocation(); render();
    if (guessrMode === 'daily' && !dailyView && !dailyLoading) loadDaily(selectedDate);
  }));
  $('#daily-calendar-open').addEventListener('click', openCalendar);
  $('#daily-today').addEventListener('click', () => loadDaily(D.todayKey()));
  $('#daily-calendar-today').addEventListener('click', () => { $('#daily-calendar-dialog').close(); loadDaily(D.todayKey()); });
  $('#daily-month-prev').addEventListener('click', () => moveCalendar(-1));
  $('#daily-month-next').addEventListener('click', () => moveCalendar(1));
  $('#daily-calendar-grid').addEventListener('click', (event) => {
    const button = event.target.closest('[data-daily-date]');
    if (!button || button.disabled) return;
    $('#daily-calendar-dialog').close(); loadDaily(button.dataset.dailyDate);
  });
  $('#daily-progress').addEventListener('click', (event) => {
    const button = event.target.closest('[data-daily-round]');
    if (!button || button.disabled || !dailyView) return;
    const index = Number(button.dataset.dailyRound);
    if (!Number.isInteger(index) || index < 0 || index >= 5 || !(dailyView.rounds[index].finished || index === dailyView.index)) return;
    reviewIndex = index === dailyView.index ? null : index; render();
  });
  $('#guessr-profiles').addEventListener('click', () => A.openProfiles());
  $('#guessr-options').addEventListener('click', (event) => {
    const button = event.target.closest('[data-guess]');
    if (!button || button.disabled || (guessrMode === 'daily' ? dailyLoading : loading)) return;
    if (guessrMode === 'daily') {
      if (!dailyView || reviewIndex !== null && reviewIndex !== dailyView.index) return;
      try {
        const result = D.submitGuess(dailyState, selectedDate, button.dataset.guess, dailyDataset, D.todayKey());
        dailyView = result.day; dailyMessage = ''; dailyMessageIsError = false;
        persistDaily(); render();
      } catch (error) { dailyMessage = error.message; dailyMessageIsError = true; render(); }
      return;
    }
    try { G.submitGuess(game, button.dataset.guess); message = ''; messageIsError = false; persist(); render(); }
    catch (error) { message = error.message; messageIsError = true; render(); }
  });
  $('#guessr-clear-score').addEventListener('click', () => {
    if (loading) return;
    A.confirm('Zerar o placar do Guessr?', 'Os pontos e as estatísticas serão zerados. A rodada atual será mantida.', () => { G.clearScore(game); persist(); render(); }, 'Zerar placar');
  });
  document.addEventListener('sorteio:state-changed', () => {
    const nextKey = signature(A.getFriends());
    if (nextKey === friendsKey) return;
    friendsKey = nextKey;
    generation++;
    if (loadController) loadController.abort();
    loadController = null; loading = false; progress = ''; loadedProfiles = []; loadedKey = '';
    message = game.round && !game.round.finished ? 'Os perfis atualizados serão usados na próxima rodada.' : '';
    messageIsError = false;
    if (guessrMode === 'free') render();
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && guessrMode === 'daily') render();
  });
  let observedToday = D.todayKey();
  setInterval(() => {
    const today = D.todayKey();
    if (today === observedToday) return;
    observedToday = today;
    if (guessrMode === 'daily') render();
  }, 60000);
  render();
  setSection(location.hash.startsWith('#guessr') ? 'guessr' : 'draw');
})();

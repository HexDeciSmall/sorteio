(function () {
  'use strict';
  const A = window.SorteioApp;
  const G = window.GuessrCore;
  const S = window.AnimeServices;
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
  function setSection(next) {
    if (A.isBusy()) return;
    $('#draw-view').hidden = next !== 'draw';
    $('#guessr-view').hidden = next !== 'guessr';
    document.querySelectorAll('[data-section]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.section === next)));
    try { history.replaceState(null, '', next === 'guessr' ? '#guessr' : '#roletas'); } catch (error) { /* The active tab still works when history is unavailable. */ }
    if (next === 'guessr') render();
  }
  function score(value) { return value.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '/10'; }
  function render() {
    const friends = A.getFriends();
    const configured = friends.filter((friend) => friend.anilistUsername);
    const round = game.round;
    const preview = round ? round.preview : configured.length === 1;
    $('#guessr-mode').hidden = !preview;
    $('#guessr-score').textContent = game.score;
    $('#guessr-wins').textContent = game.stats.wins + ' / ' + game.stats.rounds;
    $('#guessr-attempts').textContent = round ? (round.finished ? 'Rodada encerrada' : (3 - round.guessedIds.length) + ((3 - round.guessedIds.length) === 1 ? ' tentativa' : ' tentativas')) : '3 tentativas';
    const notice = [preview ? 'Prévia sem pontuação. São necessários dois perfis com pelo menos três animes avaliados para valer pontos.' : '', !configured.length ? 'Vincule os perfis do AniList em Perfis para começar.' : '', message, storageMessage].filter(Boolean).join(' ');
    $('#guessr-notice').hidden = !notice;
    $('#guessr-notice').textContent = notice;
    $('#guessr-notice').classList.toggle('is-error', messageIsError || !!storageMessage);
    $('#guessr-view').setAttribute('aria-busy', String(loading));
    $('#guessr-next').disabled = loading || !!round && !round.finished || !configured.length;
    $('#guessr-next').hidden = !!round && !round.finished && !loading;
    $('#guessr-next').textContent = loading ? progress || 'Carregando pistas…' : round && !round.finished ? 'Rodada em andamento' : round ? 'Próxima rodada' : messageIsError ? 'Tentar novamente' : 'Carregar pistas';
    $('#guessr-clear-score').disabled = loading || !(game.score || game.stats.rounds || game.stats.misses || game.stats.previews);
    $('#guessr-clues').innerHTML = round ? round.clues.map((clue, i) => '<article class="guessr-clue"><div class="guessr-poster"><img src="' + html(clue.coverUrl || 'poster-placeholder.svg') + '" data-poster-url="' + html(clue.coverUrl || '') + '" alt="Capa de ' + html(clue.name) + '" loading="lazy" referrerpolicy="no-referrer"><span class="guessr-clue-number">0' + (i + 1) + '</span></div><div class="guessr-clue-info"><h2 title="' + html(clue.name) + '">' + html(clue.name) + '</h2><div class="guessr-clue-meta"><strong class="guessr-clue-score">★ ' + score(clue.score) + '</strong><span class="guessr-status status-' + clue.status.toLowerCase() + '">' + html(S.statusLabel(clue.status)) + '</span></div></div></article>').join('') : [1, 2, 3].map((i) => '<div class="guessr-clue guessr-placeholder" aria-hidden="true"><div class="guessr-poster"><span>0' + i + '</span></div><div class="guessr-clue-info"><strong>Anime ' + i + '</strong><small>Nota e status</small></div></div>').join('');
    const options = round ? round.options : friends;
    $('#guessr-options').innerHTML = options.map((friend) => {
      const guessed = !!round && round.guessedIds.includes(friend.id);
      const correct = !!round && round.finished && round.targetId === friend.id;
      return '<button class="guessr-option' + (correct ? ' is-correct' : guessed ? ' is-wrong' : '') + '" data-guess="' + friend.id + '"' + (!round || round.finished || loading || guessed ? ' disabled' : '') + ' aria-label="' + html(friend.name + (correct ? ', resposta correta' : guessed ? ', palpite incorreto' : '')) + '"><span>' + html(friend.name) + '</span>' + (correct ? '<span aria-hidden="true">✓</span>' : guessed ? '<span aria-hidden="true">×</span>' : '') + '</button>';
    }).join('');
    const feedback = $('#guessr-feedback');
    feedback.className = 'guessr-feedback' + (round && round.finished ? round.correct ? ' is-correct' : ' is-wrong' : '');
    if (loading) feedback.textContent = progress || 'Carregando pistas…';
    else if (!round) feedback.textContent = 'Carregue as pistas para começar.';
    else if (round.finished) feedback.textContent = (round.correct ? 'Acertou! Era ' : 'Era ') + round.targetName + '.' + (round.preview ? ' Prévia sem pontuação.' : round.correct ? ' +' + round.points + (round.points === 1 ? ' ponto.' : ' pontos.') : ' Tente novamente na próxima rodada.');
    else if (round.guessedIds.length) feedback.textContent = 'Esse nome não era. Restam ' + (3 - round.guessedIds.length) + ((3 - round.guessedIds.length) === 1 ? ' tentativa.' : ' tentativas.');
    else feedback.textContent = 'Quem deu essas notas?';
    $('#guessr-reveal').hidden = !round || !round.finished;
    if (round && round.finished) {
      $('#guessr-reveal').href = 'https://anilist.co/user/' + encodeURIComponent(round.username) + '/';
      $('#guessr-reveal').textContent = 'Ver perfil de ' + round.targetName + ' no AniList ↗';
    } else { $('#guessr-reveal').removeAttribute('href'); $('#guessr-reveal').textContent = ''; }
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
  $('#guessr-next').addEventListener('click', nextRound);
  $('#guessr-profiles').addEventListener('click', () => A.openProfiles());
  $('#guessr-options').addEventListener('click', (event) => {
    const button = event.target.closest('[data-guess]');
    if (!button || button.disabled || loading) return;
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
    render();
  });
  render();
  setSection(location.hash === '#guessr' ? 'guessr' : 'draw');
})();

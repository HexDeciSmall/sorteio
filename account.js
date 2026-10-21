(function () {
  'use strict';
  const C = window.SorteioCloud;
  const $ = (selector) => document.querySelector(selector);
  const escape = window.RouletteCore.escapeHtml;
  let state = C.snapshot();
  let busy = false;
  let rankType = 'daily';
  let rankingGame = 'notes';
  const rankingGames = { notes: { name: 'Notas diárias', max: 15, wins: 'Acertos' }, characters: { name: 'Personagens', max: 8, wins: 'Completos' }, anidle: { name: 'Anidle', max: 22, wins: 'Vitórias' } };
  let rankGeneration = 0;
  let accountGeneration = 0;
  const today = window.DailyGuessr.todayKey();
  let rankingToday = today;
  $('#ranking-date').value = today;
  $('#ranking-date').max = today;
  $('#ranking-date').min = '2026-10-20';
  $('#ranking-month').value = today.slice(0, 7);
  $('#ranking-month').max = today.slice(0, 7);
  $('#ranking-month').min = '2026-10';
  function notice(message, error = false, selector = '#account-notice') {
    $(selector).textContent = message;
    $(selector).classList.toggle('is-error', error);
  }
  function eligible() { return state.configured && state.ready && state.member; }
  function gateMessage() {
    return !state.configured ? 'O modo online ainda não foi configurado.' : !state.ready ? 'Conectando…' : !state.member ? 'Entre para ver o ranking do grupo.' : '';
  }
  function renderAccount() {
    const member = state.member;
    $('#account-label').textContent = member ? member.name : 'Entrar';
    $('#account-title').textContent = member ? 'Minha conta' : 'Entrar';
    $('#login-form').hidden = !!member || !state.configured;
    $('#account-profile').hidden = !member;
    $('#password-title').textContent = 'Trocar senha';
    if (member) {
      $('#account-name').textContent = member.name;
      $('#account-username').textContent = '@' + member.username;
      $('#password-username').value = member.username;
    }
    $('#account-dialog').querySelectorAll('form button, form input, #account-logout').forEach((element) => { element.disabled = busy || !state.ready; });
    if (!state.configured) notice(gateMessage());
  }
  function open() {
    notice(state.error || (!state.configured || !state.ready ? gateMessage() : ''));
    renderAccount();
    if (!$('#account-dialog').open) $('#account-dialog').showModal();
  }
  async function runAccount(action, success, authTransition = false) {
    if (busy) return;
    const token = accountGeneration;
    busy = true; notice(''); renderAccount();
    try {
      const result = await action();
      if (token !== accountGeneration && !authTransition) return;
      if (success) success(result);
    } catch (error) { if (token === accountGeneration || authTransition) notice(error.message || 'Não foi possível concluir. Tente novamente.', true); }
    finally { busy = false; renderAccount(); }
  }
  async function renderRanking() {
    const selectedGame = rankingGames[rankingGame];
    $('#ranking-description').textContent = selectedGame.name + ' · até ' + selectedGame.max + ' pontos por dia';
    $('#ranking-wins-label').textContent = selectedGame.wins;
    document.querySelectorAll('[data-ranking-game]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.rankingGame === rankingGame)));
    const currentDay = window.DailyGuessr.todayKey();
    if ($('#ranking-date').value === rankingToday) $('#ranking-date').value = currentDay;
    if ($('#ranking-month').value === rankingToday.slice(0, 7)) $('#ranking-month').value = currentDay.slice(0, 7);
    $('#ranking-date').max = currentDay;
    $('#ranking-month').max = currentDay.slice(0, 7);
    rankingToday = currentDay;
    const request = ++rankGeneration;
    $('#ranking-table-wrap').hidden = true;
    $('#ranking-rows').replaceChildren();
    $('#ranking-footnote').hidden = true;
    $('#ranking-login').hidden = eligible() || !state.configured || !state.ready;
    $('#ranking-login').textContent = 'Entrar';
    $('#ranking-refresh').disabled = !eligible();
    document.querySelectorAll('[data-ranking-type]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.rankingType === rankType)));
    $('#ranking-date').hidden = rankType !== 'daily';
    $('#ranking-month').hidden = rankType !== 'monthly';
    if (!eligible()) { notice(gateMessage(), false, '#ranking-notice'); return; }
    notice('Carregando ranking…', false, '#ranking-notice');
    const period = rankType === 'daily' ? $('#ranking-date').value : $('#ranking-month').value;
    if (!period) { notice('Escolha um período.', false, '#ranking-notice'); return; }
    try {
      const result = await C.getRankings({ game: rankingGame, type: rankType, ...(rankType === 'daily' ? { date: period } : { month: period }) });
      if (request !== rankGeneration) return;
      let position = 0;
      let previous;
      $('#ranking-rows').innerHTML = result.rows.map((row, index) => {
        if (!previous || row.score !== previous.score || row.wins !== previous.wins) position = index + 1;
        previous = row;
        return '<tr' + (row.uid === result.selfUid ? ' class="is-self"' : '') + '><td>' + position + 'º</td><th scope="row">' + escape(row.name) + (row.uid === result.selfUid ? '<span class="ranking-you">você</span>' : '') + '</th><td class="ranking-points">' + row.score + '</td><td>' + row.wins + '</td><td>' + row.daysCompleted + '</td></tr>';
      }).join('');
      $('#ranking-table-wrap').hidden = !result.rows.length;
      $('#ranking-footnote').hidden = false;
      notice(result.rows.length ? '' : 'Nenhum desafio concluído neste período.', false, '#ranking-notice');
    } catch (error) { if (request === rankGeneration) notice(error.message || 'Não foi possível carregar o ranking.', true, '#ranking-notice'); }
  }
  document.querySelectorAll('#account-open, [data-account-open]').forEach((button) => button.addEventListener('click', open));
  $('#login-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const username = $('#login-username').value.trim();
    const password = $('#login-password').value;
    runAccount(() => C.login(username, password), () => {
      $('#login-password').value = '';
      $('#account-dialog').close();
    }, true);
  });
  $('#password-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const current = $('#password-current').value;
    const password = $('#password-new').value;
    if (password !== $('#password-confirm').value) { notice('As novas senhas precisam ser iguais.', true); return; }
    if (password === current) { notice('Escolha uma senha diferente da atual.', true); return; }
    runAccount(() => C.changePassword(current, password), () => {
      $('#password-form').reset();
      notice('Senha alterada. Sua conta está pronta.');
    });
  });
  $('#account-logout').addEventListener('click', () => runAccount(() => C.logout(), () => $('#account-dialog').close(), true));
  $('#account-dialog').addEventListener('close', () => { $('#login-password').value = ''; $('#password-form').reset(); });
  $('#ranking-refresh').addEventListener('click', renderRanking);
  $('#ranking-date').addEventListener('change', renderRanking);
  $('#ranking-month').addEventListener('change', renderRanking);
  document.querySelectorAll('[data-ranking-type]').forEach((button) => button.addEventListener('click', () => { rankType = button.dataset.rankingType; renderRanking(); }));
  document.querySelectorAll('[data-ranking-game]').forEach((button) => button.addEventListener('click', () => { rankingGame = button.dataset.rankingGame; renderRanking(); }));
  C.subscribe((snapshot) => {
    const oldUid = state.member && state.member.uid;
    state = snapshot;
    if (oldUid !== (state.member && state.member.uid)) {
      accountGeneration++;
    }
    renderAccount();
    if (state.error) notice(state.error, true);
    if (!$('#ranking-view').hidden) renderRanking();
    document.dispatchEvent(new CustomEvent('sorteio:account-changed'));
  });
  document.addEventListener('sorteio:daily-completed', () => { rankGeneration++; });
  window.SorteioAccount = Object.freeze({ open, renderRanking, selectGame(value) { if (Object.hasOwn(rankingGames, value)) rankingGame = value; } });
  C.init().catch((error) => notice(error.message, true));
})();

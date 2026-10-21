function createCloudClient(host, sdk) {
  const friends = Object.freeze({hex:'Hex',kv:'KV',cap:'Cap',nando:'Nando',turbo:'Turbo',mary:'Mary',kris:'Kris',kyoka:'Kyoka'});
  const listeners = new Set();
  const state = { configured: false, ready: false, user: null, member: null, error: '' };
  let auth = null;
  let db = null;
  let enginePromise = null;
  let calendarCache = null;
  let initPromise = null;
  let finishInitial = null;
  let authGeneration = 0;
  let actionGeneration = 0;
  let blockedAuth = false;
  let credentialBusy = false;
  let sessionUid = null;
  let sessionTask = null;
  let sessionSettled = false;
  let pendingSignOut = null;

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function clientError(message, code) {
    const error = new Error(message);
    error.code = code;
    Object.defineProperty(error, 'sorteioCloudError', { value: true });
    return error;
  }

  function snapshot() { return clone(state); }

  function emit() {
    listeners.forEach((listener) => { try { listener(snapshot()); } catch (_) { /* Consumer errors cannot interrupt session cleanup. */ } });
  }

  function subscribe(listener) {
    if (typeof listener !== 'function') throw clientError('Informe uma função para acompanhar a sessão.', 'cloud/invalid-argument');
    listeners.add(listener);
    try { listener(snapshot()); } catch (_) { /* Consumer callback. */ }
    return () => listeners.delete(listener);
  }

  function translated(error, context = '') {
    if (error && error.sorteioCloudError) return error;
    const code = typeof error?.code === 'string' ? error.code.replace(/^(auth|functions)\//, '') : '';
    if (error && typeof error.code === 'string' && error.code.startsWith('cloud/')) return error;
    const reason = error?.details?.reason;
    if (reason === 'password-change-required') return clientError('Troque sua senha temporária antes de continuar.', 'cloud/password-change-required');
    if (reason === 'member-required' || (context === 'sessionGet' && ['permission-denied', 'not-found'].includes(code))) return clientError('Seu usuário não está autorizado ou foi desativado. Procure o administrador.', 'cloud/member-unavailable');
    if (reason === 'admin-required') return clientError('Somente administradores podem realizar esta ação.', 'cloud/permission-denied');
    if (['invalid-credential', 'invalid-login-credentials', 'wrong-password', 'user-not-found', 'invalid-email'].includes(code)) return clientError(context === 'changePassword' ? 'A senha atual está incorreta.' : 'Usuário ou senha incorretos.', 'auth/invalid-credentials');
    if (code === 'user-disabled') return clientError('Este acesso foi desativado. Procure o administrador.', 'auth/user-disabled');
    if (['unauthenticated', 'user-token-expired', 'invalid-user-token'].includes(code)) return clientError('Sua sessão expirou. Entre novamente.', 'cloud/unauthenticated');
    if (['too-many-requests', 'resource-exhausted'].includes(code)) return clientError('O limite de solicitações foi atingido. Aguarde a renovação da cota gratuita e tente novamente.', 'cloud/too-many-requests');
    if (['network-request-failed', 'unavailable', 'deadline-exceeded', 'internal', 'cancelled'].includes(code)) return clientError('Não foi possível conectar ao serviço. Tente novamente em instantes.', 'cloud/unavailable');
    if (code === 'permission-denied') return clientError('Não foi possível salvar ou ler o jogo. Confira as regras do banco e a data do dispositivo.', 'cloud/permission-denied');
    if (code === 'already-exists') return clientError('Esse nome de usuário já está cadastrado.', 'cloud/already-exists');
    if (code === 'not-found') return clientError(context.startsWith('admin') ? 'Esse participante não foi encontrado.' : 'Esse desafio ainda não está disponível.', 'cloud/not-found');
    if (['weak-password', 'password-does-not-meet-requirements'].includes(code)) return clientError('A nova senha não atende à política de segurança do projeto.', 'auth/weak-password');
    if (['requires-recent-login', 'failed-precondition'].includes(code)) return clientError(context === 'changePassword' ? 'Confirme sua senha atual e tente a troca novamente.' : 'A rodada ou sua sessão mudou. Atualize o desafio e tente novamente.', 'cloud/failed-precondition');
    if (code === 'invalid-argument') return clientError('Revise os dados informados e tente novamente.', 'cloud/invalid-argument');
    return clientError('Não foi possível concluir esta ação. Tente novamente.', 'cloud/operation-failed');
  }

  function normalizedUsername(value) {
    const username = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (!/^[a-z0-9_-]{2,24}$/.test(username)) throw clientError('Use um nome de usuário com 2 a 24 letras, números, hífens ou sublinhados.', 'cloud/invalid-argument');
    return username;
  }

  function safeText(value, limit, label) {
    const text = typeof value === 'string' ? value.trim() : '';
    if (!text || text.length > limit || /[\u0000-\u001f\u007f]/.test(text)) throw clientError(label + ' inválido.', 'cloud/invalid-argument');
    return text;
  }

  function identifier(value, label, max = 128) {
    if (typeof value !== 'string' || !new RegExp('^[A-Za-z0-9_-]{1,' + max + '}$').test(value)) throw clientError(label + ' inválido.', 'cloud/invalid-argument');
    return value;
  }

  function dateValue(value, optional = false) {
    if (optional && value === undefined) return undefined;
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw clientError('Informe uma data válida.', 'cloud/invalid-argument');
    const parsed = new Date(value + 'T00:00:00Z');
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw clientError('Informe uma data válida.', 'cloud/invalid-argument');
    return value;
  }

  function roundPayload(date, roundIndex, requestId) {
    if (!Number.isInteger(roundIndex) || roundIndex < 0 || roundIndex > 4) throw clientError('Escolha uma rodada válida.', 'cloud/invalid-argument');
    return { date: dateValue(date), roundIndex, requestId: identifier(requestId, 'Identificador da solicitação') };
  }

  function configuration() {
    const config = host.SORTEIO_FIREBASE;
    if (!config || config.enabled !== true) return null;
    const firebase = config.firebase;
    if (!firebase || !['apiKey','authDomain','projectId','appId'].every((key) => typeof firebase[key] === 'string' && firebase[key].trim() && firebase[key].length <= 300 && !/[\u0000-\u0020\u007f]/.test(firebase[key]))) throw clientError('Complete a configuração pública do Firebase.', 'cloud/invalid-config');
    if (!/^[A-Za-z0-9.-]+$/.test(firebase.authDomain) || !/^[a-z][a-z0-9-]{4,61}[a-z0-9]$/.test(firebase.projectId)) throw clientError('Confira o domínio e o projeto na configuração do Firebase.', 'cloud/invalid-config');
    let emulators = null;
    if (config.emulators?.enabled === true) {
      if (!['localhost','127.0.0.1'].includes(host.location?.hostname)) throw clientError('Os emuladores só podem ser usados em um endereço local.', 'cloud/invalid-config');
      const authUrl = new URL(config.emulators.authUrl || 'http://127.0.0.1:9099');
      const firestoreHost = config.emulators.firestoreHost || '127.0.0.1';
      const firestorePort = config.emulators.firestorePort || 8080;
      if (authUrl.protocol !== 'http:' || !['localhost','127.0.0.1'].includes(authUrl.hostname) || authUrl.username || authUrl.password || authUrl.pathname !== '/' || authUrl.search || authUrl.hash || !['localhost','127.0.0.1'].includes(firestoreHost) || !Number.isInteger(firestorePort) || firestorePort < 1 || firestorePort > 65535) throw clientError('Use apenas endereços locais válidos para os emuladores.', 'cloud/invalid-config');
      emulators = {authUrl: authUrl.origin, firestoreHost, firestorePort};
    }
    return {firebase: Object.fromEntries(['apiKey','authDomain','projectId','appId'].map((key) => [key,firebase[key]])), emulators};
  }
  function memberFromAuth(user) {
    const email = String(user.email || '').toLowerCase();
    const username = email.split('@')[0];
    if (!Object.hasOwn(friends, username) || email !== username + '@usuarios.sorteio.invalid') throw clientError('Essa conta não pertence ao grupo. Confira o cadastro no Firebase.', 'cloud/member-unavailable');
    return {uid:user.uid,username,name:friends[username],isAdmin:false,mustChangePassword:false};
  }

  function settleInitial() {
    if (state.ready && finishInitial) { const finish = finishInitial; finishInitial = null; finish(snapshot()); }
  }

  function sessionChanged() { return clientError('Sua sessão mudou. Entre novamente para continuar.', 'cloud/session-changed'); }

  function assertAction(action, uid) {
    if (action !== actionGeneration || blockedAuth || auth?.currentUser?.uid !== uid) throw sessionChanged();
  }

  function signOutAuth() {
    if (!pendingSignOut) {
      const task = Promise.resolve().then(() => sdk.signOut(auth));
      pendingSignOut = task;
      task.finally(() => { if (pendingSignOut === task) pendingSignOut = null; }).catch(() => {});
    }
    return pendingSignOut;
  }

  async function invalidateSession(error) {
    authGeneration++;
    blockedAuth = true;
    sessionUid = null;
    sessionTask = null;
    sessionSettled = false;
    state.user = null;
    state.member = null;
    state.ready = true;
    state.error = error?.message || '';
    emit();
    settleInitial();
    try { await signOutAuth(); } catch (_) { /* Local state remains signed out. */ }
  }

  function loadSession(user, force = false) {
    if (!user) {
      authGeneration++;
      sessionUid = null;
      sessionTask = null;
      sessionSettled = false;
      state.user = null;
      state.member = null;
      state.ready = true;
      emit();
      settleInitial();
      return Promise.resolve(snapshot());
    }
    if (blockedAuth) {
      if (auth.currentUser?.uid === user.uid) void signOutAuth().catch(() => {});
      return Promise.reject(sessionChanged());
    }
    if (sessionUid === user.uid && sessionTask && (!force || !sessionSettled)) return sessionTask;
    const generation = ++authGeneration;
    sessionUid = user.uid;
    sessionSettled = false;
    state.user = { uid: user.uid };
    state.member = null;
    state.ready = false;
    state.error = '';
    emit();
    const task = (async () => {
      try {
        const member = memberFromAuth(user);
        if (generation !== authGeneration || blockedAuth || auth.currentUser?.uid !== user.uid) throw sessionChanged();
        state.member = member;
        state.ready = true;
        state.error = '';
        emit();
        return snapshot();
      } catch (error) {
        if (generation !== authGeneration || blockedAuth || auth.currentUser?.uid !== user.uid) throw sessionChanged();
        const safe = translated(error, 'sessionGet');
        if (['cloud/member-unavailable', 'cloud/unauthenticated', 'auth/user-disabled'].includes(safe.code)) await invalidateSession(safe);
        else { state.member = null; state.ready = true; state.error = safe.message; emit(); }
        throw safe;
      } finally {
        if (generation === authGeneration) sessionSettled = true;
        settleInitial();
      }
    })();
    sessionTask = task;
    task.catch(() => {});
    return task;
  }

  function init() {
    if (initPromise) return initPromise;
    initPromise = (async () => {
      let config;
      try { config = configuration(); } catch (error) { state.ready = true; state.error = translated(error).message; emit(); return snapshot(); }
      if (!config) { state.ready = true; emit(); return snapshot(); }
      try {
        if (!sdk) sdk = await loadFirebase();
        const existing = sdk.getApps().find((app) => app.name === 'sorteio-spark');
        if (existing && existing.options.projectId !== config.firebase.projectId) throw clientError('Recarregue a página após alterar o projeto Firebase.', 'cloud/invalid-config');
        const app = existing || sdk.initializeApp(config.firebase, 'sorteio-spark');
        auth = sdk.getAuth(app);
        db = sdk.getFirestore(app);
        if (config.emulators) {
          sdk.connectAuthEmulator(auth, config.emulators.authUrl, { disableWarnings: true });
          sdk.connectFirestoreEmulator(db, config.emulators.firestoreHost, config.emulators.firestorePort);
        }
        state.configured = true;
        emit();
        return await new Promise((resolve) => {
          finishInitial = resolve;
          sdk.onAuthStateChanged(auth, (user) => { loadSession(user).catch(() => {}); }, (error) => {
            state.ready = true; state.member = null; state.error = translated(error).message; emit(); settleInitial();
          });
        });
      } catch (error) {
        state.configured = false;
        state.ready = true;
        state.error = translated(error).message;
        emit();
        return snapshot();
      }
    })();
    return initPromise;
  }

  async function authenticated({ admin = false, passwordChange = false } = {}) {
    await init();
    if (!state.configured) throw clientError(state.error || 'O serviço online ainda não foi configurado.', 'cloud/not-configured');
    if (!state.ready && sessionTask) await sessionTask;
    if (!state.user || !state.member || blockedAuth) throw clientError(state.error || 'Entre com seu usuário e senha para continuar.', 'cloud/unauthenticated');
    if (state.member.mustChangePassword && !passwordChange) throw clientError('Troque sua senha temporária antes de continuar.', 'cloud/password-change-required');
    if (admin && !state.member.isAdmin) throw clientError('Somente administradores podem realizar esta ação.', 'cloud/permission-denied');
    if (!auth.currentUser || auth.currentUser.uid !== state.user.uid) throw sessionChanged();
    return auth.currentUser;
  }

  async function request(operation) {
    const user = await authenticated();
    const generation = authGeneration;
    try {
      const data = await operation(user);
      if (generation !== authGeneration || blockedAuth || auth.currentUser?.uid !== user.uid) throw sessionChanged();
      return clone(data);
    } catch (error) {
      if (generation !== authGeneration || blockedAuth || auth.currentUser?.uid !== user.uid) throw sessionChanged();
      const safe = translated(error, 'database');
      if (safe.code === 'cloud/password-change-required' && state.member) { state.member.mustChangePassword = true; emit(); }
      if (error?.details?.reason === 'admin-required' && state.member) { state.member.isAdmin = false; emit(); }
      if (['cloud/member-unavailable', 'cloud/unauthenticated', 'auth/user-disabled'].includes(safe.code)) await invalidateSession(safe);
      throw safe;
    }
  }

  async function login(value, password) {
    await init();
    if (pendingSignOut) await pendingSignOut.catch(() => {});
    if (!state.configured) throw clientError(state.error || 'O serviço online ainda não foi configurado.', 'cloud/not-configured');
    const username = normalizedUsername(value);
    if (!Object.hasOwn(friends, username)) throw clientError('Use o usuário de um colega do grupo.', 'cloud/invalid-argument');
    if (typeof password !== 'string' || !password.length || password.length > 4096) throw clientError('Informe sua senha.', 'cloud/invalid-argument');
    if (credentialBusy) throw clientError('Aguarde a operação de acesso em andamento.', 'cloud/busy');
    if (state.member) throw clientError('Saia da conta atual antes de entrar com outro usuário.', 'cloud/already-signed-in');
    const action = ++actionGeneration;
    credentialBusy = true;
    blockedAuth = false;
    state.ready = false;
    state.error = '';
    emit();
    try {
      const credential = await sdk.signInWithEmailAndPassword(auth, username + '@usuarios.sorteio.invalid', password);
      assertAction(action, credential.user.uid);
      await loadSession(credential.user, true);
      assertAction(action, credential.user.uid);
      return snapshot();
    } catch (error) {
      const safe = translated(error, 'login');
      if (action === actionGeneration && !blockedAuth) { state.ready = true; state.error = safe.message; emit(); }
      throw safe;
    } finally { credentialBusy = false; }
  }

  async function logout() {
    if (!initPromise || !auth) await init();
    actionGeneration++;
    authGeneration++;
    blockedAuth = true;
    sessionUid = null;
    sessionTask = null;
    calendarCache = null;
    state.user = null;
    state.member = null;
    state.ready = true;
    state.error = '';
    emit();
    settleInitial();
    if (auth) {
      try { await signOutAuth(); } catch (error) { const safe = translated(error, 'logout'); state.error = safe.message; emit(); throw safe; }
    }
    return snapshot();
  }

  async function changePassword(currentPassword, newPassword) {
    const user = await authenticated();
    if (typeof currentPassword !== 'string' || !currentPassword.length) throw clientError('Informe sua senha atual.', 'cloud/invalid-argument');
    if (typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 128) throw clientError('A nova senha deve ter entre 8 e 128 caracteres.', 'cloud/invalid-argument');
    if (credentialBusy) throw clientError('Aguarde a operação de acesso em andamento.', 'cloud/busy');
    const action = ++actionGeneration;
    credentialBusy = true;
    try {
      await sdk.reauthenticateWithCredential(user, sdk.EmailAuthProvider.credential(user.email, currentPassword));
      assertAction(action,user.uid);
      await sdk.updatePassword(user,newPassword);
      assertAction(action,user.uid);
      await sdk.getIdToken(user,true);
      assertAction(action,user.uid);
      return {member:clone(state.member)};
    } catch (error) { throw translated(error,'changePassword'); }
    finally { credentialBusy=false; }
  }
  function engine() {
    if (!enginePromise) enginePromise=(async () => {
      const controller=new AbortController();
      const timer=setTimeout(()=>controller.abort(),15000);
      try {
        const responses=await Promise.all(['daily-data.json?v=2026-10-20-v1','daily-cap.json?v=2026-10-21-cap-v1','daily-kv.json?v=2026-10-21-cap-kv-v1'].map((file)=>host.fetch(file,{signal:controller.signal})));
        if (responses.some((response)=>!response.ok)) throw clientError('Não foi possível carregar as pistas.', 'cloud/unavailable');
        const [base,cap,kv]=await Promise.all(responses.map((response)=>response.json()));
        return host.SorteioSparkGame.createEngine({G:host.GuessrCore,D:host.DailyGuessr,base,cap,kv});
      } finally {clearTimeout(timer);}
    })().catch((error)=>{enginePromise=null;throw error;});
    return enginePromise;
  }
  function todayKey() { return host.DailyGuessr.todayKey(); }
  function gameRef(username,date) { return sdk.doc(db,'sparkPlayers',username,'days',date); }
  function scoreRef(username,date) { return sdk.doc(db,'sparkScores',date+'_'+username); }
  async function calendar(username,refresh=false) {
    if (!refresh && calendarCache?.username===username) return clone(calendarCache.days);
    const result=await sdk.getDocs(sdk.query(sdk.collection(db,'sparkPlayers',username,'days'),sdk.limit(10000)));
    const days=result.docs.map((document)=>{
      const raw=document.data();
      const date=dateValue(raw.date);
      if(date!==document.id || typeof raw.completed!=='boolean' || !Array.isArray(raw.guesses)) throw clientError('O progresso salvo está inconsistente.', 'cloud/invalid-response');
      return {date,completed:raw.completed,started:raw.guesses.some((row)=>Array.isArray(row.ids)&&row.ids.length>0)};
    }).sort((a,b)=>a.date.localeCompare(b.date));
    if(state.member?.username===username) calendarCache={username,days};
    return clone(days);
  }
  async function response(game,day,username,refresh=false) {
    const days=await calendar(username,refresh);
    const entry={date:day.date,completed:day.completed,started:day.rounds.some((round)=>round.guessedIds.length>0)};
    const index=days.findIndex((item)=>item.date===day.date);
    if(index<0)days.push(entry);else days[index]=entry;
    days.sort((a,b)=>a.date.localeCompare(b.date));
    if(state.member?.username===username) calendarCache={username,days:clone(days)};
    return game.response(day,days,todayKey());
  }
  async function getDay(date) {
    if(date!==undefined)dateValue(date);
    return request(async(user)=>{
      const member=memberFromAuth(user);
      const game=await engine();
      const selected=date===undefined?todayKey():date;
      const stored=await sdk.getDoc(gameRef(member.username,selected));
      const {day}=game.read(stored.exists()?stored.data():null,selected,todayKey());
      return response(game,day,member.username,true);
    });
  }
  async function mutate(date,action) {
    dateValue(date);
    roundPayload(date,action.index,action.id);
    return request(async(user)=>{
      const member=memberFromAuth(user);
      const game=await engine();
      const today=todayKey();
      const ref=gameRef(member.username,date);
      const ledger=scoreRef(member.username,date);
      let result;
      try { result=await sdk.runTransaction(db,async(transaction)=>{
        const stored=await transaction.get(ref);
        const changed=game.apply(stored.exists()?stored.data():null,date,action,today);
        if(!changed.changed)return changed;
        let score=null;
        if(changed.day.completed) score=await transaction.get(ledger);
        if(score?.exists())throw clientError('Esse resultado já foi registrado.', 'cloud/already-exists');
        const record={...changed.record,username:member.username,name:member.name,updatedAt:sdk.serverTimestamp()};
        transaction.set(ref,record);
        if(changed.day.completed)transaction.set(ledger,{version:1,date,month:record.month,dateNumber:record.dateNumber,username:member.username,name:member.name,score:record.score,wins:record.wins,daysCompleted:1,savedAt:sdk.serverTimestamp()});
        return changed;
      }); } catch (error) {
        // A simultaneous completion can commit before Firestore retries this request.
        // Confirm that this exact action was saved before reporting it as successful.
        if(!['permission-denied','aborted','unavailable','deadline-exceeded','failed-precondition'].includes(error.code))throw error;
        try {
          const saved=await sdk.getDocFromServer(ref);
          if(!saved.exists())throw error;
          const replay=game.apply(saved.data(),date,action,today);
          if(replay.changed)throw error;
          if(replay.day.completed){const entry=await sdk.getDocFromServer(ledger);if(!entry.exists()||entry.data().score!==replay.record.score||entry.data().wins!==replay.record.wins)throw error;}
          result=replay;
        } catch (_) {throw error;}
      }
      return response(game,result.day,member.username);
    });
  }
  async function guess(date,friendId,index,id) { return mutate(date,{kind:'guess',friendId:identifier(friendId,'Amigo',80),index,id}); }
  async function next(date,index,id) { return mutate(date,{kind:'next',index,id}); }
  async function getRankings(query={}) {
    if(!['daily','monthly'].includes(query.type))throw clientError('Escolha o ranking diário ou mensal.', 'cloud/invalid-argument');
    const today=todayKey();
    const period=query.type==='daily'?dateValue(query.date===undefined?today:query.date):query.month===undefined?today.slice(0,7):query.month;
    if(typeof period!=='string' || (query.type==='monthly'&&!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) || period<'2026-10'+(query.type==='daily'?'-20':'') || period>(query.type==='daily'?today:today.slice(0,7)))throw clientError('Escolha um período disponível.', 'cloud/invalid-argument');
    return request(async(user)=>{
      const member=memberFromAuth(user);
      const result=await sdk.getDocs(sdk.query(sdk.collection(db,'sparkScores'),sdk.where(query.type==='daily'?'date':'month','==',period),sdk.limit(300)));
      const totals=new Map();
      result.docs.forEach((document)=>{
        const row=document.data();
        if(!Object.hasOwn(friends,row.username)||!Number.isInteger(row.score)||row.score<0||row.score>15||!Number.isInteger(row.wins)||row.wins<0||row.wins>5||document.id!==row.date+'_'+row.username||row.daysCompleted!==1)throw clientError('O ranking salvo está inconsistente.', 'cloud/invalid-response');
        const entry=totals.get(row.username)||{uid:row.username,username:row.username,name:friends[row.username],score:0,wins:0,daysCompleted:0,streak:0};
        entry.score+=row.score;entry.wins+=row.wins;entry.daysCompleted++;
        totals.set(row.username,entry);
      });
      const rows=[...totals.values()].sort((a,b)=>b.score-a.score||b.wins-a.wins||a.name.localeCompare(b.name,'pt-BR'));
      let previous,position=0;
      rows.forEach((row,index)=>{if(!previous||row.score!==previous.score||row.wins!==previous.wins)position=index+1;row.position=position;previous=row;});
      return {type:query.type,period,rows,selfUid:member.username};
    });
  }
  return Object.freeze({init,subscribe,snapshot,login,logout,changePassword,getDay,guess,next,getRankings});
}

async function loadFirebase() {
  const modules = await Promise.all([
    import('https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js'),
    import('https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js')
  ]);
  return Object.assign({}, ...modules);
}
if (typeof module === 'object' && module.exports) module.exports = {createCloudClient};
else if (typeof window !== 'undefined') window.SorteioCloud = createCloudClient(window);

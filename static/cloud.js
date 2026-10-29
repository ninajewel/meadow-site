/* Dependency-free Supabase REST + OAuth PKCE adapter. No administrator keys here. */
window.MeadowCloud = (() => {
  const config = window.MEADOW_CONFIG || {mode: 'local'};
  const enabled = config.mode === 'supabase';
  const SECTIONS = ['Good News Grows Here','The Curious Mind','Tomorrow’s World','The Creative Corner','The Culture Club','The Kindness Chronicles','A Little Bit of Magic'];
  const SESSION = 'meadow.auth.v1', VERIFIER = 'meadow.pkce.v1';
  let session = null, refreshing = null;
  function locked(message = 'Please unlock your Meadow.') { const e = new Error(message); e.status = 401; return e; }
  function clean() { session = null; sessionStorage.removeItem(SESSION); }
  function validate() {
    const u = new URL(config.supabaseUrl);
    if (u.protocol !== 'https:' || !/^[a-z0-9-]+\.supabase\.co$/.test(u.hostname) || u.pathname !== '/' || u.username || u.password || u.search || u.hash) throw Error('Invalid Supabase project URL.');
    const key = config.publishableKey || '';
    if (!key.startsWith('sb_publishable_')) {
      let role;
      try { role = JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).role; } catch (_) {}
      if (role !== 'anon') throw Error('Only a Supabase publishable or legacy anon key belongs in the website.');
    }
  }
  async function request(path, body, auth = false) {
    const r = await fetch(config.supabaseUrl.replace(/\/$/,'') + path, {
      method: 'POST', headers: {'Content-Type':'application/json', apikey:config.publishableKey, ...(auth ? {Authorization:'Bearer '+session.access_token} : {})}, body:JSON.stringify(body), cache:'no-store'
    });
    const text = await r.text(); let data;
    try { data = text ? JSON.parse(text) : null; } catch (_) { throw Error('The private service returned an unexpected response.'); }
    if (!r.ok) {
      if (r.status === 401) { clean(); throw locked('Your session has expired. Please sign in again.'); }
      const e = new Error(r.status === 403 || data?.code === '42501' ? 'This account is not registered as the owner of The Meadow.' : data?.message || data?.msg || data?.error_description || 'The private service could not complete that request.');
      e.status = r.status; throw e;
    }
    return data;
  }
  function save(data) {
    if (!data?.access_token || !data?.refresh_token) throw Error('Sign-in did not return a valid session.');
    session = {access_token:data.access_token,refresh_token:data.refresh_token,expires_at:data.expires_at || Math.floor(Date.now()/1000)+data.expires_in};
    // Only authentication lives in this tab. Preferences and notes are in Supabase.
    sessionStorage.setItem(SESSION,JSON.stringify(session));
  }
  async function ready() {
    if (!session) throw locked();
    if (session.expires_at < Date.now()/1000+60) {
      if (!refreshing) refreshing = request('/auth/v1/token?grant_type=refresh_token',{refresh_token:session.refresh_token}).then(save).catch(e=>{if(e.status===400 || e.status===401){clean();throw locked('Your session has expired. Please sign in again.')}throw e}).finally(()=>{refreshing=null;});
      await refreshing;
    }
  }
  async function rpc(name, args = {}) { await ready(); return request('/rest/v1/rpc/'+name,args,true); }
  const b64 = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  async function login() {
    const verifier = b64(crypto.getRandomValues(new Uint8Array(48)));
    sessionStorage.setItem(VERIFIER,JSON.stringify({value:verifier,created:Date.now()}));
    const challenge = b64(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))));
    const redirect = new URL(location.href); redirect.search = ''; redirect.hash = '';
    const u = new URL(config.supabaseUrl.replace(/\/$/,'')+'/auth/v1/authorize');
    u.search = new URLSearchParams({provider:'github',redirect_to:redirect.href,code_challenge:challenge,code_challenge_method:'s256'});
    location.assign(u.href);
  }
  async function init() {
    if (!enabled) return;
    validate();
    try { session = JSON.parse(sessionStorage.getItem(SESSION)); } catch (_) { clean(); }
    const params = new URLSearchParams(location.search);
    const code = params.get('code'), error = params.get('error_description') || params.get('error');
    if (code || error) {
      history.replaceState({},'',location.pathname);
      if (error) { sessionStorage.removeItem(VERIFIER); throw Error('GitHub sign-in was not completed. Please try again.'); }
      let verifier; try { verifier=JSON.parse(sessionStorage.getItem(VERIFIER)); } catch (_) {}
      sessionStorage.removeItem(VERIFIER);
      if (!verifier || Date.now()-verifier.created>600000) throw Error('Sign-in expired or was opened in a different tab. Start again from this page.');
      save(await request('/auth/v1/token?grant_type=pkce',{auth_code:code,code_verifier:verifier.value}));
    }
  }
  function workflowUrl() {
    const repo = config.generatorRepository || '';
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw Error('The generator repository has not been configured.');
    return 'https://github.com/'+repo+'/actions/workflows/daily.yml';
  }
  async function api(path, data) {
    const u = new URL(path,location.origin);
    const action = u.pathname.split('/').pop();
    if (action === 'login') return login();
    if (action === 'logout') {
      try { if (session) { await ready(); await request('/auth/v1/logout',{},true); } } finally { clean(); }
      return {ok:true};
    }
    if (action === 'state') {
      const s = await rpc('meadow_state',{p_day:u.searchParams.get('day') || null});
      s.sections = SECTIONS;
      s.feedback = s.feedback.map(f=>({...f,payload:f.payload ? JSON.stringify(f.payload) : null}));
      return s;
    }
    if (action === 'backup') return rpc('meadow_export');
    if (['vote','feedback','delete-feedback','settings','reset'].includes(action)) return rpc('meadow_action',{p_action:action,p_body:data});
    throw Error('This action is not available in the static website.');
  }
  return {enabled,init,api,workflowUrl};
})();

import type {CacheVersions} from "./data-cache";

// Keep the version check in-memory and scoped to the logged-in school/user.
// Every hard reload checks the server once against the persistent local snapshot.
// Within a live session, navigation reuses the same answer for four minutes.
const VERSION_TTL_MS = 4 * 60 * 1000;
type State={at:number;value:CacheVersions|null;pending:Promise<CacheVersions>|null};
const states=new Map<string,State>();
const inFlight=new Map<string,Promise<unknown>>();

export function loadCacheVersions(
  scope:string, fetcher:()=>Promise<CacheVersions>, force=false
):Promise<CacheVersions>{
  let state=states.get(scope);
  if(!state){state={at:0,value:null,pending:null};states.set(scope,state)}
  if(state.pending)return state.pending;
  if(!force&&state.value&&Date.now()-state.at<VERSION_TTL_MS)return Promise.resolve(state.value);
  const active=state;
  const pending=fetcher().then(value=>{
    // Null/invalid responses must not validate stale user data.
    if(!value||typeof value!=="object")throw new Error("CACHE_VERSIONS_INVALID");
    active.value=value;
    active.at=Date.now();
    return value;
  }).finally(()=>{active.pending=null});
  active.pending=pending;
  return pending;
}

export function coalesceCachePull<T>(scope:string,domain:string,fetcher:()=>Promise<T>):Promise<T>{
  const key=scope+"|"+domain;
  const running=inFlight.get(key);
  if(running)return running as Promise<T>;
  const pending=fetcher().finally(()=>{inFlight.delete(key)});
  inFlight.set(key,pending);
  return pending;
}

// Call this on an explicit update or after mutations, not on ordinary navigation.
export function expireCacheVersion(scope:string){
  const state=states.get(scope);
  if(state)state.at=0;
}

// Stop background database polling if a browser window is left open unattended.
// Explicit user operations still request fresh data normally.
const IDLE_POLL_PAUSE_MS=4*60*1000;
let lastInteractionAt=Date.now();
if(typeof window!=="undefined"){
  const markActive=()=>{lastInteractionAt=Date.now()};
  let lastMotionAt=0;
  window.addEventListener("pointerdown",markActive,{passive:true});
  window.addEventListener("keydown",markActive);
  window.addEventListener("touchstart",markActive,{passive:true});
  window.addEventListener("pointermove",()=>{
    if(Date.now()-lastMotionAt>15000){lastMotionAt=Date.now();markActive()}
  },{passive:true});
  window.addEventListener("focus",markActive);
  document.addEventListener("visibilitychange",()=>{
    if(document.visibilityState==="visible")markActive();
  });
}
export function isAppActive(){
  return typeof document!=="undefined"&&document.visibilityState==="visible"
    &&Date.now()-lastInteractionAt<IDLE_POLL_PAUSE_MS;
}

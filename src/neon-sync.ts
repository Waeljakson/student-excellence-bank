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

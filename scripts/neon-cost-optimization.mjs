import {readFileSync,writeFileSync} from "node:fs";
const patchApp=function patchApp(s){
  if(!s.includes('import {loadCacheVersions,coalesceCachePull} from "./neon-sync";')){
    const mark='import { readDataCache, writeDataCache, sameCacheVersion, type CacheVersions } from "./data-cache";';
    if(!s.includes(mark))throw Error("App cache import missing");
    s=s.replace(mark,mark+'\nimport {loadCacheVersions,coalesceCachePull} from "./neon-sync";');
  }
  const start=s.indexOf('  async function syncData(keys:Array<"dashboard"|"students"|"rules"|"checks"|"rankings"|"rewards"|"admin">');
  const end=s.indexOf('\n  useEffect(()=>{',start);
  if(start<0||end<0)throw Error("App sync region missing");
  const newBlock=`  // NEON_EFFICIENT_SYNC_V4: persistent snapshots + one version query per user/session window.
  // Only sections with new revision tokens are transferred; changed sections are isolated.
  async function syncData(keys:Array<"dashboard"|"students"|"rules"|"checks"|"rankings"|"rewards"|"admin">,force=false){
    const wanted=keys.filter(k=>k!=="admin"||isAdmin);
    if(!wanted.length){setLoading(false);return}
    setError("");
    let currentVersions:CacheVersions|null=null;
    const updates:Record<string,unknown>={};
    const revised:CacheVersions={};
    function hasData(data:any,key:string){
      return key==="admin"
        ?Array.isArray(data?.users)&&Array.isArray(data?.staff)&&Array.isArray(data?.adminClasses)
        :data?.[key]!==undefined;
    }
    async function fetchDomain(key:string):Promise<Record<string,unknown>>{
      if(key==="dashboard")return {dashboard:await rpc<Dashboard>("api_dashboard")};
      if(key==="students")return {students:await rpc<Student[]>("api_students")};
      if(key==="rules")return {rules:await rpc<Rule[]>("api_point_rules")};
      if(key==="checks")return {checks:await rpc<Check[]>("api_recent_checks")};
      if(key==="rankings")return {rankings:await rpc<Rankings>("api_rankings")};
      if(key==="rewards")return {rewards:await rpc<Reward[]>("api_rewards")};
      if(key==="admin"&&isAdmin){
        const [users,staff,adminClasses]=await Promise.all([
          rpc<ManagedUser[]>("api_managed_users"),rpc<StaffMember[]>("api_staff_directory"),
          rpc<AdminClass[]>("api_admin_classes")
        ]);
        return {users,staff,adminClasses};
      }
      return {};
    }
    async function pull(key:string){
      const fresh=await coalesceCachePull(cacheScope,key,()=>fetchDomain(key));
      Object.assign(updates,fresh);
      if(fresh.dashboard!==undefined)setDashboard(fresh.dashboard as Dashboard);
      if(Array.isArray(fresh.students))setStudents(fresh.students as Student[]);
      if(Array.isArray(fresh.rules))setRules(fresh.rules as Rule[]);
      if(Array.isArray(fresh.checks))setChecks(fresh.checks as Check[]);
      if(fresh.rankings!==undefined)setRankings(fresh.rankings as Rankings);
      if(Array.isArray(fresh.rewards))setRewards(fresh.rewards as Reward[]);
      if(Array.isArray(fresh.users))setUsers(fresh.users as ManagedUser[]);
      if(Array.isArray(fresh.staff))setStaff(fresh.staff as StaffMember[]);
      if(Array.isArray(fresh.adminClasses))setAdminClasses(fresh.adminClasses as AdminClass[]);
      if(currentVersions)revised[key]=currentVersions[key];
    }
    function commitUpdates(){
      if(!Object.keys(updates).length)return;
      const latest=readDataCache<any>(cacheScope);
      writeDataCache(cacheScope,
        {...(latest?.versions||{}),...revised},
        {...(latest?.data||{}),...updates});
    }
    try{
      // First entry compares the local snapshot with Neon; subsequent tab switches
      // within four minutes reuse the authenticated revision response in memory.
      currentVersions=await loadCacheVersions(cacheScope,()=>rpc<CacheVersions>("api_cache_versions"),force);
      const latest=readDataCache<any>(cacheScope);
      const changed=wanted.filter(key=>force||!hasData(latest?.data,key)||
        typeof currentVersions?.[key]!=="string"||
        !sameCacheVersion(latest?.versions||{},currentVersions||{},key));
      await Promise.all(changed.map(pull));
      commitUpdates();
    }catch(e){
      // Keep the last successful snapshot if version validation temporarily fails.
      // On a cold start (or manual force), still try only the requested sections.
      const latest=readDataCache<any>(cacheScope);
      const missing=wanted.filter(key=>force||!hasData(latest?.data,key));
      if(missing.length){
        currentVersions=null;
        try{await Promise.all(missing.map(pull));commitUpdates()}
        catch(inner){setError(niceError(inner))}
      }else if(force){setError(niceError(e))}
    }finally{setLoading(false)}
  }
`;
  s=s.slice(0,start)+newBlock+s.slice(end);
  s=s.replace('if(tab==="dashboard")void syncData(["dashboard","checks"],true);','if(tab==="dashboard")void syncData(["dashboard","checks"]);');
  // Hide-when-inactive status polling to avoid waking expensive DB computations.
  s=s.replace('    loadIndicators();const timer=window.setInterval(loadIndicators,15000);',
   '    loadIndicators();const timer=window.setInterval(()=>{if(document.visibilityState==="visible")loadIndicators()},90000);');
  return s;
};
const path="src/App.tsx";
const old=readFileSync(path,"utf8");
const next=patchApp(old);
if(next!==old)writeFileSync(path,next);
console.log("neon-cost-optimization: version-based and deduplicated tab sync ready");

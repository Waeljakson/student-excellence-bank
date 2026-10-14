import {readFileSync,writeFileSync} from "node:fs";
const patchApp=function patchApp(s){
  if(!s.includes('from "./neon-sync";')){
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
  if(!s.includes('if(tab==="dashboard")void syncData(["dashboard","checks"]);')){
    s=s.replace('    if(tab==="checks")void syncData(["students","rules","checks"]);','    if(tab==="dashboard")void syncData(["dashboard","checks"]);\n    else if(tab==="checks")void syncData(["students","rules","checks"]);');
  }
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

const optimizeFile=function optimizeFile(path,s){
  if(path==="src/NotificationCenter.tsx"){
    const old=`  useEffect(()=>{
    void load();
    const timer=window.setInterval(()=>void load(),45000);
    const onFocus=()=>void load();
    const onVisible=()=>{if(document.visibilityState==="visible")void load()};
    window.addEventListener("focus",onFocus);
    document.addEventListener("visibilitychange",onVisible);
    return()=>{window.clearInterval(timer);window.removeEventListener("focus",onFocus);document.removeEventListener("visibilitychange",onVisible)};
  },[]);`;
    const next=`  useEffect(()=>{
    let lastPoll=0;
    let active=true;
    let checking=false;
    const refresh=async(force=false)=>{
      if(!active||checking||(!force&&document.visibilityState!=="visible"))return;
      if(!force&&Date.now()-lastPoll<180000)return;
      lastPoll=Date.now();
      checking=true;
      try{await load()}finally{checking=false}
    };
    void refresh(true);
    const timer=window.setInterval(()=>void refresh(),180000);
    const onFocus=()=>void refresh();
    const onVisible=()=>{if(document.visibilityState==="visible")void refresh()};
    window.addEventListener("focus",onFocus);
    document.addEventListener("visibilitychange",onVisible);
    return()=>{active=false;window.clearInterval(timer);window.removeEventListener("focus",onFocus);document.removeEventListener("visibilitychange",onVisible)};
  },[]);`;
    if(s.includes(old))s=s.replace(old,next);
    else if(!s.includes("let lastPoll=0;"))throw Error("NotificationCenter marker missing");
  }
  if(path==="src/GuidanceRedemptionCenter.tsx"){
    const old=`  useEffect(() => {
    load();
    const t = window.setInterval(load, 15000);
    return () => window.clearInterval(t);
  }, []);`;
    const next=`  useEffect(() => {
    void load();
    // Pending requests refresh at a moderate rate, only while this tab is visible.
    const t = window.setInterval(()=>{if(document.visibilityState==="visible")void load()},60000);
    return () => window.clearInterval(t);
  }, []);`;
    if(s.includes(old))s=s.replace(old,next);
    else if(!s.includes("Pending requests refresh at a moderate rate"))throw Error("GuidanceRedemptionCenter marker missing");
  }
  if(path==="src/StudentExitAnalytics.tsx"){
    const old='  useEffect(()=>{void load();const t=window.setInterval(()=>void load(),60000);return()=>window.clearInterval(t)},[days]);';
    const next='  useEffect(()=>{void load();const t=window.setInterval(()=>{if(document.visibilityState==="visible")void load()},120000);return()=>window.clearInterval(t)},[days]);';
    if(s.includes(old))s=s.replace(old,next);
    else if(!s.includes('setInterval(()=>{if(isAppActive())void load()},120000)') && !s.includes('setInterval(()=>{if(document.visibilityState==="visible")void load()},120000)'))throw Error("StudentExitAnalytics marker missing");
  }
  if(path==="src/StudentPortal.tsx"){
    const old=`    let active=true;
    const refresh=async()=>{if(active)await loadRecognition()};
    void refresh();
    const onFocus=()=>void refresh();
    const onVisible=()=>{if(document.visibilityState==="visible")void refresh()};`;
    const next=`    let active=true;
    let checking=false;
    let lastCheck=0;
    const refresh=async(force=false)=>{
      if(!active||checking||(!force&&document.visibilityState!=="visible"))return;
      if(!force&&Date.now()-lastCheck<120000)return;
      lastCheck=Date.now();
      checking=true;
      try{await loadRecognition()}finally{checking=false}
    };
    void refresh(true);
    const onFocus=()=>void refresh();
    const onVisible=()=>{if(document.visibilityState==="visible")void refresh()};`;
    if(s.includes(old))s=s.replace(old,next);
    else if(!s.includes("let lastCheck=0;"))throw Error("StudentPortal marker missing");
  }
  return s;
};
for(const file of ["src/NotificationCenter.tsx","src/GuidanceRedemptionCenter.tsx","src/StudentExitAnalytics.tsx","src/StudentPortal.tsx"]){
  const before=readFileSync(file,"utf8");
  const after=optimizeFile(file,before);
  if(after!==before)writeFileSync(file,after);
}
console.log("neon-cost-optimization: background polling bounded to visible tabs");

const addRefresh=function addRefresh(s){
  if(s.includes("// NEON_IDLE_REFRESH_V4"))return s;
  const marker=`  async function refreshStudents(){await syncData(["students","rankings","dashboard"],true)}`;
  if(!s.includes(marker))throw Error("Tab refresh marker missing");
  const addition=`  // NEON_IDLE_REFRESH_V4: revalidate only the currently visible data domain.
  // No network read occurs when the page is hidden; returning to a tab checks
  // version tokens (rather than downloading all rows) after the four-minute TTL.
  useEffect(()=>{
    const visibleDomains=():Array<"dashboard"|"students"|"rules"|"checks"|"rankings"|"rewards"|"admin">=>{
      if(tab==="dashboard")return ["dashboard","checks"];
      if(tab==="checks")return ["students","rules","checks"];
      if(["students","referrals","student-evaluations","behavioral"].includes(tab))return ["students"];
      if(tab==="rankings")return ["rankings"];
      if(tab==="rewards")return ["rewards"];
      if(tab==="admin"&&isAdmin)return ["admin"];
      return [];
    };
    const refresh=()=>{
      if(document.visibilityState!=="visible")return;
      const keys=visibleDomains();
      if(keys.length)void syncData(keys);
    };
    const timer=window.setInterval(refresh,240000);
    document.addEventListener("visibilitychange",refresh);
    return()=>{window.clearInterval(timer);document.removeEventListener("visibilitychange",refresh)};
  },[tab,cacheScope]);

`;
  return s.replace(marker,addition+marker);
};
{
  const before=readFileSync("src/App.tsx","utf8");
  const after=addRefresh(before);
  if(before!==after)writeFileSync("src/App.tsx",after);
}

const patchIdle=function patchIdle(path,s){
  if(path==="src/App.tsx"){
    s=s.replace('import {loadCacheVersions,coalesceCachePull} from "./neon-sync";',
                'import {loadCacheVersions,coalesceCachePull,isAppActive} from "./neon-sync";');
    s=s.replace('if(document.visibilityState==="visible")loadIndicators()', 'if(isAppActive())loadIndicators()');
    s=s.replace('      if(document.visibilityState!=="visible")return;\n      const keys=visibleDomains();',
                '      if(!isAppActive())return;\n      const keys=visibleDomains();');
  }else{
    if(!s.includes('import {isAppActive} from "./neon-sync";')){
      const firstImport=s.indexOf('\n');
      if(firstImport<0)throw Error("Missing imports");
      s=s.slice(0,firstImport+1)+'import {isAppActive} from "./neon-sync";\n'+s.slice(firstImport+1);
    }
    if(path==="src/NotificationCenter.tsx"){
      s=s.replace('(!force&&document.visibilityState!=="visible")','(!force&&!isAppActive())');
    }else if(path==="src/GuidanceRedemptionCenter.tsx"){
      s=s.replace('if(document.visibilityState==="visible")void load()', 'if(isAppActive())void load()');
    }else if(path==="src/StudentExitAnalytics.tsx"){
      s=s.replace('if(document.visibilityState==="visible")void load()', 'if(isAppActive())void load()');
    }else if(path==="src/StudentPortal.tsx"){
      s=s.replace('(!force&&document.visibilityState!=="visible")','(!force&&!isAppActive())');
    }
  }
  return s;
};
for(const file of ["src/App.tsx","src/NotificationCenter.tsx","src/GuidanceRedemptionCenter.tsx","src/StudentExitAnalytics.tsx","src/StudentPortal.tsx"]){
  const before=readFileSync(file,"utf8");
  const after=patchIdle(file,before);
  if(before!==after)writeFileSync(file,after);
}
console.log("neon-cost-optimization: idle browsers do not keep compute awake");

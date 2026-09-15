import { readFileSync, writeFileSync } from "node:fs";

const appPath = "src/App.tsx";
const compPath = "src/KhameesnaCompetition.tsx";

let app = readFileSync(appPath, "utf8");
let comp = readFileSync(compPath, "utf8");

if (comp.includes("export default function KhameesnaCompetition(){")) {
  comp = comp.replace(
    "export default function KhameesnaCompetition(){",
    "export default function KhameesnaCompetition({isSuperAdmin=false}:{isSuperAdmin?:boolean}){"
  );
}

if (comp.includes('data.can_manage&&<div className="kh-admin-controls no-print">')) {
  comp = comp.replace(
    'data.can_manage&&<div className="kh-admin-controls no-print">',
    '(isSuperAdmin||data.can_manage===true)&&<div className="kh-admin-controls no-print">'
  );
}

if (!comp.includes("isSuperAdmin||data.can_manage===true")) {
  throw new Error("khameesna-admin-control-fix: management visibility marker missing");
}

app = app.replaceAll(
  '<KhameesnaCompetition/>',
  '<KhameesnaCompetition isSuperAdmin={profile.roles?.includes("SUPER_ADMIN")===true}/>'
);

if (!app.includes('KhameesnaCompetition isSuperAdmin={profile.roles?.includes("SUPER_ADMIN")===true}')) {
  throw new Error("khameesna-admin-control-fix: app invocation marker missing");
}

writeFileSync(compPath, comp);
writeFileSync(appPath, app);

import { readFileSync, writeFileSync } from "node:fs";

const path = "src/StudentEvaluationReports.tsx";
let src = readFileSync(path, "utf8");

if (!src.includes("const canCreate = canVice || canGuidance;")) {
  const marker = "  const canAdmin = canVice || canGuidance;";
  if (!src.includes(marker)) throw new Error("evaluation-guidance: canAdmin marker missing");
  src = src.replace(marker, marker + "\n  const canCreate = canVice || canGuidance;");
}

src = src.replace(
  'isTeacher && !canAdmin ? "REQUESTS" : canVice ? "NEW" : "REPORTS",',
  'isTeacher && !canAdmin ? "REQUESTS" : canCreate ? "NEW" : "REPORTS",',
);

src = src.replace(
  '{canVice && (\n            <button className={tab === "NEW" ? "active" : ""} onClick={() => setTab("NEW")}>',
  '{canCreate && (\n            <button className={tab === "NEW" ? "active" : ""} onClick={() => setTab("NEW")}>',
);

src = src.replace(
  '{tab === "NEW" && canVice && (',
  '{tab === "NEW" && canCreate && (',
);

writeFileSync(path, src);

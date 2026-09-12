import { readFileSync, writeFileSync } from "node:fs";

const appPath = "src/App.tsx";
let src = readFileSync(appPath, "utf8");

// Keep the navigation label compact.
src = src.replace('["redemption","استبدال النقاط","⇄"]', '["redemption","الاستبدال","⇄"]');

// engagement-upgrade.mjs used an old guard and could append the redemption page
// again on every build. Remove every rendered copy, then insert exactly one.
const redemptionRender = '{tab==="redemption"&&profile.roles?.includes("GUIDANCE_COUNSELOR")&&<GuidanceRedemptionCenter/>}';
const referralRender = '{tab==="referrals"&&<ReferralCenter roles={profile.roles} students={students} profileName={profile.name||""}/>}';

src = src.split(redemptionRender).join("");
if (!src.includes(referralRender)) {
  throw new Error("Could not find referral render anchor while deduplicating redemption page");
}
src = src.replace(referralRender, `${referralRender} ${redemptionRender}`);

writeFileSync(appPath, src);

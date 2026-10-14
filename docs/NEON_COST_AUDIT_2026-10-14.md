# Neon Cost Audit — Student Excellence Bank
Date: 2026-10-14

## Baseline and diagnosis
Live Neon project metadata was inspected without changing business data.
- Project compute: minimum 0.25 CU / maximum 8 CU.
- Production compute `suspend_timeout_seconds = 0` (idle autosuspend disabled).
- Project reported `active_time_seconds = 259592`, `compute_time_seconds = 71976`, and `data_transfer_bytes = 3658389975` at inspection. These are usage counters, **not** an invoice.
- Postgres cumulative statistics show significant repeated table scans. Those are lifetime counters, not per-API costs, and cannot identify a bill total.
- The existing `api_cache_versions` hashes table data to compare domain versions, but the UI previously fetched it on every tab visit and forcibly reloaded the dashboard.
- Staff referral/behavior status refreshed every 15s, notifications every 45s, the redemption queue every 15s and exit analytics every 60s, whether useful or not.

## Implemented (frontend only)
1. `src/neon-sync.ts`: per-school, per-user version coalescing; 4-minute in-memory validation TTL; duplicate in-flight domain requests are collapsed into one.
2. `src/App.tsx`: persistent localStorage snapshots are shown immediately, and the Neon version response is compared to saved revisions before pulling a domain. Only changed/missing domains are fetched; unchanged cached domains are never downloaded on ordinary tab navigation. Manual update and mutation handlers force fresh reads.
3. Visibility and activity checks suspend background polling when browsers are hidden or idle for four minutes. Explicit actions still work and fetch normally. Active tabs revalidate every four minutes.
4. Polling frequencies: referrals/behavior 15s -> 90s, notifications 45s -> 180s, redemption queue 15s -> 60s, exit analytics 60s -> 120s. Polling is paused when the browser is inactive.
5. Student recognition lookups are debounced across focus/visibility transitions (120s).
6. `scripts/neon-cost-optimization.mjs` reapplies these changes following legacy prebuild source regeneration; `scripts/multischool-upgrade.mjs` no longer duplicates the school-brand import.

## Existing safe cache contract
- Persistent user/school-scoped cache retains section responses and version hashes for at most 14 days (existing `src/data-cache.ts`).
- On the next sign-in or hard refresh the server versions are checked again; missing/changed sections are fetched.
- The comparison is currently **domain-level**, not **row-level**. A changed student record may cause the whole students domain to reload; a true record-level delta endpoint requires a separate reviewed database change. Never use `students.updated_at` alone to track wallets, because balances depend on ledger transactions.
- Cache is not authorization. All actual reads/writes remain subject to Neon RPC school/role security.
- Shared devices retain the authenticated user's local cache in browser storage until expiry or site-data clearing; consider that in school-device policies.

## Highest-impact pending operational setting
The production Neon compute's idle autosuspend is disabled. Consider setting **Scale to Zero / Suspend after inactivity = 300 seconds** on the production compute. This should save idle CU-hours overnight and during inactive periods. It can add a brief cold-start latency to the next API call, so verify login reliability and the school uptime requirement. **This setting was NOT changed automatically.**

Avoid disabling or resizing the production compute without a rollback plan and monitoring. Caps on max CU should be decided from actual latency/CPU metrics.

## Measurement and acceptance
- Compare the same school usage periods, preferably 7 days before and 7 days after the deployment, in the Neon dashboard (CU-hours, active time, data transferred, API activity, storage).
- Verify two separate staff accounts and both schools remain isolated. Verify student balance/check issuance, class transfers, reward redemption and parental recognition update after explicit changes.
- Verify navigation with no changes does not fetch whole domains; changes from another browser appear on active screens after the 4-minute validation window or the manual refresh button.
- Confirm that a hidden or unattended browser does not generate periodic reads.
- Check first operation after a compute cold start if Scale to Zero is manually enabled.
- Keep real-time safety-critical operations (marking students absent/returned, check issuance, account writes) on fresh RPCs.

## Important distinction
Reducing read frequency and data transfer lowers load but does not guarantee a proportional invoice reduction. With autosuspend disabled, compute can remain billed while idle. Actual savings depend on Neon plan, CU-hours, data transfer and other project usage.

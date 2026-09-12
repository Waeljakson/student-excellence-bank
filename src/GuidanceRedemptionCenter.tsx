import { useEffect, useMemo, useState } from "react";
import { niceError, rpc } from "./client";
import "./engagement.css";

type RequestRow = {
  id: string;
  reward_id: string;
  reward_name: string;
  reward_description?: string | null;
  stock?: number | null;
  points_cost: number;
  status: "PENDING" | "APPROVED" | "FULFILLED" | "REJECTED" | "CANCELLED";
  requested_at: string;
  fulfilled_at?: string | null;
  notes?: string | null;
  student_id: string;
  student_no: string;
  student_name: string;
  grade_name: string;
  class_name: string;
  balance: number;
  processed_by?: string | null;
};

type Data = {
  is_open: boolean;
  opened_at?: string | null;
  min_points: number;
  requests: RequestRow[];
};

const fmt = (v?: string | null) =>
  v
    ? new Date(v).toLocaleString("ar-SA", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "—";

const statusLabel = (s: string) =>
  ({
    PENDING: "طلب هدية جديد",
    APPROVED: "معتمد",
    FULFILLED: "تم تسليم الهدية",
    REJECTED: "مرفوض",
    CANCELLED: "ملغي",
  } as Record<string, string>)[s] || s;

export default function GuidanceRedemptionCenter() {
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [filter, setFilter] = useState<"PENDING" | "HISTORY">("PENDING");

  async function load() {
    try {
      setData(await rpc<Data>("api_guidance_redemption_center"));
    } catch (e) {
      setMsg(niceError(e));
    }
  }

  useEffect(() => {
    load();
    const t = window.setInterval(load, 15000);
    return () => window.clearInterval(t);
  }, []);

  const pending = useMemo(
    () => data?.requests.filter((x) => x.status === "PENDING" || x.status === "APPROVED") || [],
    [data],
  );
  const history = useMemo(
    () => data?.requests.filter((x) => x.status !== "PENDING" && x.status !== "APPROVED") || [],
    [data],
  );

  async function windowAction(action: "OPEN" | "CLOSE") {
    if (
      action === "CLOSE" &&
      !window.confirm("إغلاق متجر الاستبدال الآن؟ لن يستطيع الطلاب إرسال طلبات هدايا جديدة، لكن الطلبات الحالية ستظل موجودة لديك.")
    )
      return;
    setBusy(action);
    setMsg("");
    try {
      await rpc("api_guidance_set_redemption_window", { p_action: action });
      setMsg(
        action === "OPEN"
          ? `تم فتح متجر الهدايا للطلاب المؤهلين ابتداءً من ${data?.min_points || 50} نقطة.`
          : "تم إغلاق متجر الهدايا أمام الطلبات الجديدة.",
      );
      await load();
    } catch (e) {
      setMsg(niceError(e));
    } finally {
      setBusy("");
    }
  }

  async function fulfill(r: RequestRow) {
    if (!window.confirm(`تأكيد تسليم «${r.reward_name}» للطالب ${r.student_name} مقابل ${r.points_cost} نقطة؟ سيتم خصم النقاط الآن من محفظته.`))
      return;
    setBusy(r.id);
    setMsg("");
    try {
      const result = await rpc<any>("api_guidance_fulfill_redemption", { p_redemption_id: r.id });
      setMsg(`تم تسليم «${result.reward_name || r.reward_name}» وخصم ${result.points} نقطة. الرصيد الجديد: ${result.new_balance} نقطة.`);
      await load();
    } catch (e) {
      setMsg(niceError(e));
    } finally {
      setBusy("");
    }
  }

  async function reject(r: RequestRow) {
    const note = window.prompt(`سبب رفض طلب «${r.reward_name}» — اختياري`, "");
    if (note === null) return;
    setBusy(r.id + "r");
    setMsg("");
    try {
      await rpc("api_guidance_reject_redemption", { p_redemption_id: r.id, p_note: note || null });
      setMsg("تم رفض طلب الهدية دون خصم أي نقاط.");
      await load();
    } catch (e) {
      setMsg(niceError(e));
    } finally {
      setBusy("");
    }
  }

  if (!data)
    return (
      <>
        <header className="topbar redemption-topbar">
          <div>
            <h1>طلبات متجر الهدايا</h1>
            <p>جارٍ تحميل الطلبات...</p>
          </div>
        </header>
        <main className="content redemption-guidance-page">
          <div className="panel empty">جارٍ التحميل...</div>
        </main>
      </>
    );

  const rows = filter === "PENDING" ? pending : history;

  return (
    <>
      <header className="topbar redemption-topbar">
        <div>
          <h1>استبدال النقاط بالهدايا</h1>
          <p>فتح وإغلاق متجر الهدايا ومتابعة طلبات الطلاب وتأكيد التسليم</p>
        </div>
        <span className={`redemption-header-state ${data.is_open ? "open" : "closed"}`}>
          {data.is_open ? "المتجر مفتوح" : "المتجر مغلق"}
        </span>
      </header>

      <main className="content redemption-guidance-page">
        <section className={`panel redemption-control-hero ${data.is_open ? "open" : "closed"}`}>
          <div className="redemption-control-copy">
            <span className="eyebrow">التحكم في متجر الهدايا</span>
            <h2>{data.is_open ? "الطلاب يستطيعون طلب الهدايا المتاحة" : "طلبات الهدايا متوقفة حاليًا"}</h2>
            <p>
              أقل هدية تبدأ من {data.min_points || 50} نقطة. فتح المتجر لا يخصم أي نقاط؛ الخصم والمخزون يتغيران فقط عند تأكيد تسليم الهدية للطالب.
            </p>
            {data.opened_at && data.is_open && <small>تم الفتح: {fmt(data.opened_at)}</small>}
          </div>

          <div className="redemption-control-actions">
            {data.is_open ? (
              <button className="btn danger" disabled={!!busy} onClick={() => windowAction("CLOSE")}>
                إغلاق متجر الهدايا
              </button>
            ) : (
              <button className="btn primary" disabled={!!busy} onClick={() => windowAction("OPEN")}>
                فتح متجر الهدايا
              </button>
            )}
            <div className="redemption-pending-count">
              <b>{pending.length}</b>
              <span>طلب هدية بانتظار التسليم</span>
            </div>
          </div>
        </section>

        <section className="redemption-tabs" aria-label="تصفية طلبات الهدايا">
          <button className={filter === "PENDING" ? "active" : ""} onClick={() => setFilter("PENDING")}>
            الطلبات الحالية <span>{pending.length}</span>
          </button>
          <button className={filter === "HISTORY" ? "active" : ""} onClick={() => setFilter("HISTORY")}>
            سجل الهدايا <span>{history.length}</span>
          </button>
        </section>

        <section className="redemption-request-list">
          {rows.length ? (
            rows.map((r) => (
              <article className={`panel guidance-redemption-card ${r.status.toLowerCase()}`} key={r.id}>
                <div className="guidance-redemption-person">
                  <div>
                    <span className={`redemption-status ${r.status.toLowerCase()}`}>{statusLabel(r.status)}</span>
                    <h3>{r.student_name}</h3>
                    <p>{r.grade_name} — فصل {r.class_name} · رقم الطالب {r.student_no}</p>
                    <p><b>الهدية المطلوبة: {r.reward_name}</b>{r.reward_description ? ` — ${r.reward_description}` : ""}</p>
                  </div>
                  <div className="guidance-redemption-amount">
                    <small>تكلفة الهدية</small>
                    <strong>{r.points_cost}</strong>
                    <span>نقطة</span>
                  </div>
                </div>

                <div className="guidance-redemption-meta">
                  <span><small>الرصيد الحالي</small><b>{r.balance} نقطة</b></span>
                  <span><small>مخزون الهدية</small><b>{r.stock == null ? "غير محدود" : `${r.stock} متاح`}</b></span>
                  <span><small>تاريخ الطلب</small><b>{fmt(r.requested_at)}</b></span>
                  {r.fulfilled_at && <span><small>تاريخ التسليم</small><b>{fmt(r.fulfilled_at)}</b></span>}
                </div>

                {(r.status === "PENDING" || r.status === "APPROVED") && (
                  <div className="guidance-redemption-actions">
                    <button className="btn primary" disabled={busy === r.id || r.balance < r.points_cost || r.stock === 0} onClick={() => fulfill(r)}>
                      {busy === r.id ? "جارٍ الخصم..." : "تم تسليم الهدية — خصم النقاط"}
                    </button>
                    <button className="btn ghost" disabled={busy === r.id + "r"} onClick={() => reject(r)}>رفض الطلب</button>
                    {r.balance < r.points_cost && <small>رصيد الطالب الحالي أقل من تكلفة الهدية.</small>}
                    {r.stock === 0 && <small>نفد مخزون هذه الهدية؛ لا يمكن تأكيد التسليم.</small>}
                  </div>
                )}

                {r.status !== "PENDING" && r.status !== "APPROVED" && (
                  <div className="redemption-history-note">
                    <b>{statusLabel(r.status)} — {r.reward_name}</b>
                    <span>{r.notes || "—"}{r.processed_by && r.processed_by !== "—" ? ` · ${r.processed_by}` : ""}</span>
                  </div>
                )}
              </article>
            ))
          ) : (
            <div className="panel empty">{filter === "PENDING" ? "لا توجد طلبات هدايا معلقة حاليًا." : "لا يوجد سجل هدايا سابق حتى الآن."}</div>
          )}
        </section>

        {msg && <div className="notice sticky-note">{msg}</div>}
      </main>
    </>
  );
}

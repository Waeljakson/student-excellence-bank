-- 2026-10-07
-- Reliable student recognition payload: medals + achievement point rewards.
-- Also repairs any missing behavioral medal/20-point reward without duplicating existing ledger rows.

BEGIN;

-- Repair any missing +20 behavioral winner bonus.
INSERT INTO public.wallet_transactions(
  school_id,student_id,transaction_type,points_delta,actor_user_id,
  reference_type,reference_id,note
)
SELECT
  w.school_id,w.student_id,'BONUS',20,w.published_by,
  'BEHAVIORAL_EXCELLENCE_WINNER',w.cycle_id,
  'مكافأة الفوز في برنامج التميز السلوكي — 20 نقطة تميز'
FROM public.behavioral_excellence_winners w
WHERE NOT EXISTS(
  SELECT 1
  FROM public.wallet_transactions wt
  WHERE wt.student_id=w.student_id
    AND wt.reference_type='BEHAVIORAL_EXCELLENCE_WINNER'
    AND wt.reference_id=w.cycle_id
)
ON CONFLICT (student_id,reference_type,reference_id)
  WHERE reference_type='BEHAVIORAL_EXCELLENCE_WINNER'
DO NOTHING;

-- Repair any missing behavioral medals, preserving original publication date.
DO $repair_behavioral_medals$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT w.*,c.title_ar
    FROM public.behavioral_excellence_winners w
    JOIN public.behavioral_excellence_cycles c ON c.id=w.cycle_id
  LOOP
    PERFORM public.ensure_student_medal(
      r.school_id,
      r.student_id,
      COALESCE(r.title_ar,'التميز السلوكي'),
      'ميدالية التميز السلوكي — المركز '||r.grade_rank::text||' على مستوى الصف',
      '★',
      'BEHAVIORAL',
      'BEHAVIORAL_EXCELLENCE',
      r.cycle_id,
      r.published_by,
      r.published_at
    );
  END LOOP;
END;
$repair_behavioral_medals$;

CREATE OR REPLACE FUNCTION public.api_student_recognition()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $student_recognition$
DECLARE
  v_auth uuid;
  v_student public.students%ROWTYPE;
BEGIN
  v_auth:=NULLIF(auth.user_id(),'')::uuid;

  SELECT *
  INTO v_student
  FROM public.students
  WHERE auth_user_id=v_auth
    AND is_active=true
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'STUDENT_ACCOUNT_REQUIRED';
  END IF;

  RETURN jsonb_build_object(
    'medals',public.student_medals_json(v_student.id),
    'achievement_rewards',COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id',wt.id,
          'serial_no',
            CASE wt.reference_type
              WHEN 'BEHAVIORAL_EXCELLENCE_WINNER' THEN 'مكافأة التميز السلوكي'
              WHEN 'COMPETITION_WINNER' THEN 'مكافأة الفوز في مسابقة'
              ELSE 'مكافأة إنجاز'
            END,
          'points',wt.points_delta,
          'reason',COALESCE(NULLIF(wt.note,''),
            CASE wt.reference_type
              WHEN 'BEHAVIORAL_EXCELLENCE_WINNER' THEN 'الفوز في برنامج التميز السلوكي'
              WHEN 'COMPETITION_WINNER' THEN 'الفوز في مسابقة مدرسية'
              ELSE 'مكافأة إنجاز'
            END
          ),
          'status','BONUS',
          'approval_status','NOT_REQUIRED',
          'issued_at',wt.created_at,
          'rule_name',
            CASE wt.reference_type
              WHEN 'BEHAVIORAL_EXCELLENCE_WINNER' THEN
                COALESCE(
                  (SELECT c.title_ar
                   FROM public.behavioral_excellence_cycles c
                   WHERE c.id=wt.reference_id),
                  'التميز السلوكي'
                )
              WHEN 'COMPETITION_WINNER' THEN
                COALESCE(
                  (SELECT ca.title_ar
                   FROM public.competition_announcements ca
                   WHERE ca.id=wt.reference_id),
                  'فوز في مسابقة'
                )
              ELSE 'مكافأة إنجاز'
            END,
          'issuer_name',COALESCE(au.full_name_ar,'إدارة المدرسة'),
          'source','ACHIEVEMENT'
        )
        ORDER BY wt.created_at DESC
      )
      FROM public.wallet_transactions wt
      LEFT JOIN public.app_users au ON au.id=wt.actor_user_id
      WHERE wt.student_id=v_student.id
        AND wt.points_delta>0
        AND wt.reference_type IN (
          'BEHAVIORAL_EXCELLENCE_WINNER',
          'COMPETITION_WINNER'
        )
    ),'[]'::jsonb)
  );
END;
$student_recognition$;

GRANT EXECUTE ON FUNCTION public.api_student_recognition() TO authenticated;


-- Keep medals and achievement rewards inside the main student portal payload.
-- This removes any dependency on a second authenticated RPC after the portal has loaded.
CREATE OR REPLACE FUNCTION public.api_student_portal()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public','neon_auth','pg_temp'
AS $student_portal_with_recognition$
DECLARE
  v_auth uuid;
  v_student public.students%ROWTYPE;
  v_points integer;
  v_value numeric;
  v_avatar text;
BEGIN
  v_auth:=NULLIF(auth.user_id(),'')::uuid;

  SELECT *
  INTO v_student
  FROM public.students
  WHERE auth_user_id=v_auth
    AND is_active=true
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'STUDENT_ACCOUNT_REQUIRED';
  END IF;

  SELECT image
  INTO v_avatar
  FROM neon_auth."user"
  WHERE id=v_auth;

  SELECT
    COALESCE(b.points_balance,0)::int,
    (COALESCE(b.points_balance,0)*sch.point_value_sar)::numeric(10,2)
  INTO v_points,v_value
  FROM public.schools sch
  LEFT JOIN public.student_wallet_balances b ON b.student_id=v_student.id
  WHERE sch.id=v_student.school_id;

  RETURN jsonb_build_object(
    'school_id',v_student.school_id,
    'school_name',(SELECT name_ar FROM public.schools WHERE id=v_student.school_id),
    'school_code',(SELECT code FROM public.schools WHERE id=v_student.school_id),
    'student',(
      SELECT jsonb_build_object(
        'id',st.id,
        'student_no',st.student_no,
        'name',st.full_name_ar,
        'grade_name',g.name_ar,
        'class_name',c.name_ar,
        'points',v_points,
        'value_sar',v_value,
        'avatar',v_avatar
      )
      FROM public.students st
      JOIN public.classes c ON c.id=st.class_id
      JOIN public.grades g ON g.id=c.grade_id
      WHERE st.id=v_student.id
    ),
    'checks',COALESCE((
      SELECT jsonb_agg(to_jsonb(x) ORDER BY x.issued_at DESC)
      FROM (
        SELECT
          ec.id,
          ec.serial_no,
          ec.points,
          ec.reason_ar AS reason,
          ec.status::text AS status,
          ec.approval_status::text AS approval_status,
          ec.issued_at,
          ec.reversed_at,
          ec.reversal_reason,
          pr.name_ar AS rule_name,
          COALESCE(au.full_name_ar,'إدارة المدرسة') AS issuer_name
        FROM public.excellence_checks ec
        JOIN public.point_rules pr ON pr.id=ec.rule_id
        LEFT JOIN public.app_users au ON au.id=ec.issued_by
        WHERE ec.student_id=v_student.id
        ORDER BY ec.issued_at DESC
        LIMIT 100
      ) x
    ),'[]'::jsonb),
    'medals',public.student_medals_json(v_student.id),
    'achievement_rewards',COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id',wt.id,
          'serial_no',
            CASE wt.reference_type
              WHEN 'BEHAVIORAL_EXCELLENCE_WINNER' THEN 'مكافأة التميز السلوكي'
              WHEN 'COMPETITION_WINNER' THEN 'مكافأة الفوز في مسابقة'
              ELSE 'مكافأة إنجاز'
            END,
          'points',wt.points_delta,
          'reason',COALESCE(NULLIF(wt.note,''),
            CASE wt.reference_type
              WHEN 'BEHAVIORAL_EXCELLENCE_WINNER' THEN 'الفوز في برنامج التميز السلوكي'
              WHEN 'COMPETITION_WINNER' THEN 'الفوز في مسابقة مدرسية'
              ELSE 'مكافأة إنجاز'
            END
          ),
          'status','BONUS',
          'approval_status','NOT_REQUIRED',
          'issued_at',wt.created_at,
          'rule_name',
            CASE wt.reference_type
              WHEN 'BEHAVIORAL_EXCELLENCE_WINNER' THEN
                COALESCE(
                  (SELECT c.title_ar
                   FROM public.behavioral_excellence_cycles c
                   WHERE c.id=wt.reference_id),
                  'التميز السلوكي'
                )
              WHEN 'COMPETITION_WINNER' THEN
                COALESCE(
                  (SELECT ca.title_ar
                   FROM public.competition_announcements ca
                   WHERE ca.id=wt.reference_id),
                  'فوز في مسابقة'
                )
              ELSE 'مكافأة إنجاز'
            END,
          'issuer_name',COALESCE(au2.full_name_ar,'إدارة المدرسة'),
          'source','ACHIEVEMENT'
        )
        ORDER BY wt.created_at DESC
      )
      FROM public.wallet_transactions wt
      LEFT JOIN public.app_users au2 ON au2.id=wt.actor_user_id
      WHERE wt.student_id=v_student.id
        AND wt.points_delta>0
        AND wt.reference_type IN (
          'BEHAVIORAL_EXCELLENCE_WINNER',
          'COMPETITION_WINNER'
        )
    ),'[]'::jsonb),
    'announcements',COALESCE((
      SELECT jsonb_agg(to_jsonb(a) ORDER BY a.starts_at ASC)
      FROM (
        SELECT
          id,title_ar,body_ar,starts_at,ends_at,
          COALESCE(announcement_type,'GENERAL') AS announcement_type,
          COALESCE(criteria,'[]'::jsonb) AS criteria,
          COALESCE(target_class_ids,'[]'::jsonb) AS target_class_ids,
          reward_ar,banner_style
        FROM public.competition_announcements
        WHERE school_id=v_student.school_id
          AND is_published=true
          AND deleted_at IS NULL
          AND COALESCE(announcement_type,'GENERAL')<>'POINT_REDEMPTION_WINDOW'
          AND (ends_at IS NULL OR ends_at>=now())
          AND (COALESCE(announcement_type,'GENERAL')='TARGETED_COMPETITION' OR starts_at<=now())
          AND (COALESCE(announcement_type,'GENERAL')<>'TARGETED_COMPETITION' OR target_class_ids ? v_student.class_id::text)
        ORDER BY starts_at ASC
      ) a
    ),'[]'::jsonb),
    'followup_notes',COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id',n.id,
          'subject_ar',n.subject_ar,
          'note_kind',n.note_kind,
          'category_ar',n.category_ar,
          'note_text',n.note_text,
          'note_date',n.note_date,
          'teacher_name',au3.full_name_ar
        )
        ORDER BY n.note_date DESC,n.created_at DESC
      )
      FROM public.student_followup_notes n
      JOIN public.app_users au3 ON au3.id=n.teacher_user_id
      WHERE n.student_id=v_student.id
    ),'[]'::jsonb),
    'competitions','[]'::jsonb
  );
END;
$student_portal_with_recognition$;

GRANT EXECUTE ON FUNCTION public.api_student_portal() TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
SELECT pg_notify('pgrst','reload schema');

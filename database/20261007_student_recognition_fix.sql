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

COMMIT;

NOTIFY pgrst, 'reload schema';
SELECT pg_notify('pgrst','reload schema');

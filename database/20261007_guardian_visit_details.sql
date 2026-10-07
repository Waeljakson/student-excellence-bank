-- 2026-10-07
-- Add detailed guardian portal visitors to the existing cached api_dashboard RPC.

BEGIN;

CREATE OR REPLACE FUNCTION public.api_dashboard()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $dashboard_guardian_visitors$
DECLARE
  v_auth uuid;
  v_app uuid;
  v_school uuid;
  v_students bigint;
  v_guardian_unique bigint;
  v_can_view_guardian_details boolean:=false;
BEGIN
  v_auth:=NULLIF(auth.user_id(),'')::uuid;

  SELECT id,school_id
  INTO v_app,v_school
  FROM public.app_users
  WHERE auth_user_id=v_auth AND is_active=true
  LIMIT 1;

  IF v_app IS NULL THEN
    RAISE EXCEPTION 'APPROVAL_REQUIRED';
  END IF;

  v_can_view_guardian_details:=EXISTS(
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id=v_app
      AND ur.role='SUPER_ADMIN'
  );

  SELECT COUNT(*)
  INTO v_students
  FROM public.students
  WHERE school_id=v_school AND is_active=true;

  SELECT COUNT(DISTINCT entity_id)
  INTO v_guardian_unique
  FROM public.audit_logs
  WHERE school_id=v_school
    AND action='GUARDIAN_PORTAL_VISIT';

  RETURN jsonb_build_object(
    'students',v_students,
    'today_points',(
      SELECT COALESCE(SUM(points),0)
      FROM public.excellence_checks
      WHERE school_id=v_school
        AND status IN ('ISSUED','REDEEMED')
        AND issued_at::date=current_date
    ),
    'month_checks',(
      SELECT COUNT(*)
      FROM public.excellence_checks
      WHERE school_id=v_school
        AND issued_at>=date_trunc('month',now())
    ),
    'reinforced_students',(
      SELECT COUNT(DISTINCT student_id)
      FROM public.wallet_transactions
      WHERE school_id=v_school
        AND transaction_type IN ('EARN','BONUS')
        AND created_at>=date_trunc('month',now())
    ),
    'point_value_sar',(
      SELECT point_value_sar
      FROM public.schools
      WHERE id=v_school
    ),
    'guardian_unique_visitors',v_guardian_unique,
    'guardian_visits_today',(
      SELECT COUNT(*)
      FROM public.audit_logs
      WHERE school_id=v_school
        AND action='GUARDIAN_PORTAL_VISIT'
        AND (created_at AT TIME ZONE 'Asia/Riyadh')::date=(now() AT TIME ZONE 'Asia/Riyadh')::date
    ),
    'guardian_total_visits',(
      SELECT COUNT(*)
      FROM public.audit_logs
      WHERE school_id=v_school
        AND action='GUARDIAN_PORTAL_VISIT'
    ),
    'guardian_coverage_pct',
      CASE
        WHEN v_students>0 THEN ROUND((v_guardian_unique::numeric*100)/v_students,1)
        ELSE 0
      END,
    'guardian_visit_details',
      CASE WHEN v_can_view_guardian_details THEN
        COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object(
              'student_id',s.id,
              'student_no',s.student_no,
              'student_name',s.full_name_ar,
              'grade_name',g.name_ar,
              'class_name',c.name_ar,
              'guardian_name',COALESCE(NULLIF(trim(gd.full_name_ar),''),'ولي أمر الطالب'),
              'guardian_mobile',gd.mobile,
              'visit_count',v.visit_count,
              'today_visits',v.today_visits,
              'first_visit_at',v.first_visit_at,
              'last_visit_at',v.last_visit_at
            )
            ORDER BY v.last_visit_at DESC
          )
          FROM (
            SELECT
              al.entity_id,
              COUNT(*)::int AS visit_count,
              COUNT(*) FILTER (
                WHERE (al.created_at AT TIME ZONE 'Asia/Riyadh')::date=(now() AT TIME ZONE 'Asia/Riyadh')::date
              )::int AS today_visits,
              MIN(al.created_at) AS first_visit_at,
              MAX(al.created_at) AS last_visit_at
            FROM public.audit_logs al
            WHERE al.school_id=v_school
              AND al.action='GUARDIAN_PORTAL_VISIT'
              AND al.entity_type='student'
            GROUP BY al.entity_id
          ) v
          JOIN public.students s
            ON s.id::text=v.entity_id
           AND s.school_id=v_school
          JOIN public.classes c ON c.id=s.class_id
          JOIN public.grades g ON g.id=c.grade_id
          LEFT JOIN LATERAL (
            SELECT gu.full_name_ar,gu.mobile
            FROM public.student_guardians sg
            JOIN public.guardians gu ON gu.id=sg.guardian_id
            WHERE sg.student_id=s.id
              AND gu.school_id=v_school
            ORDER BY sg.is_primary DESC,gu.created_at ASC
            LIMIT 1
          ) gd ON true
        ),'[]'::jsonb)
      ELSE '[]'::jsonb END
  );
END;
$dashboard_guardian_visitors$;

GRANT EXECUTE ON FUNCTION public.api_dashboard() TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
SELECT pg_notify('pgrst','reload schema');

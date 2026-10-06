-- 2026-10-06
-- Scope referrals and follow-up notebook by formal role + assigned school stage/classes.

BEGIN;

CREATE OR REPLACE FUNCTION public.api_student_referrals(
  p_status text DEFAULT 'OPEN'::text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $referral_scope$
DECLARE
  v_auth uuid;
  v_user uuid;
  v_school uuid;
  v_job text;
  v_teacher boolean:=false;
  v_vice boolean:=false;
  v_guidance boolean:=false;
BEGIN
  v_auth:=NULLIF(auth.user_id(),'')::uuid;

  SELECT id,school_id
  INTO v_user,v_school
  FROM public.app_users
  WHERE auth_user_id=v_auth AND is_active=true
  LIMIT 1;

  IF v_user IS NULL THEN RAISE EXCEPTION 'APP_USER_REQUIRED'; END IF;
  IF COALESCE(p_status,'OPEN') NOT IN ('OPEN','COMPLETED','ALL') THEN
    RAISE EXCEPTION 'REFERRAL_STATUS_INVALID';
  END IF;

  SELECT sd.job_title_ar
  INTO v_job
  FROM public.staff_directory sd
  WHERE sd.linked_app_user_id=v_user AND sd.is_active=true
  ORDER BY sd.updated_at DESC NULLS LAST
  LIMIT 1;

  -- Formal staff job wins over additional technical/admin roles.
  IF v_job IS NOT NULL THEN
    v_teacher:=v_job='معلم';
    v_vice:=v_job ILIKE '%وكيل%';
    v_guidance:=v_job='الموجه الطلابي';
  ELSE
    SELECT
      EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=v_user AND role='TEACHER'),
      EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=v_user AND role='VICE_PRINCIPAL'),
      EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=v_user AND role='GUIDANCE_COUNSELOR')
    INTO v_teacher,v_vice,v_guidance;
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC)
    FROM (
      SELECT
        r.id,r.referral_no,r.target_role,
        CASE
          WHEN ret.guidance_returned_at IS NOT NULL
            AND ret.guidance_returned_at > COALESCE(fwd.forwarded_at,'epoch'::timestamptz)
            THEN 'عاد للمعلم'
          WHEN r.target_role='VICE_PRINCIPAL' THEN 'وكيل المدرسة'
          WHEN r.target_role='GUIDANCE_COUNSELOR' THEN 'الموجه الطلابي'
          ELSE r.target_role
        END AS target_label,
        (ret.guidance_returned_at IS NOT NULL
          AND ret.guidance_returned_at > COALESCE(fwd.forwarded_at,'epoch'::timestamptz)
        ) AS returned_to_teacher,
        r.subject_ar,r.incident_date,r.violation_text,r.violation_category,
        CASE r.violation_category WHEN 'EDUCATIONAL' THEN 'تعليمية' ELSE 'سلوكية' END AS violation_category_label,
        r.occurrence_type,
        CASE r.occurrence_type WHEN 'FIRST' THEN 'أول مرة' ELSE 'مكررة' END AS occurrence_label,
        r.violation_explanation,
        r.teacher_action_1,r.teacher_action_date_1,
        r.teacher_action_2,r.teacher_action_date_2,
        r.teacher_action_3,r.teacher_action_date_3,
        r.status,r.deducted_points,r.deduction_note,r.deducted_at,
        r.completion_note,r.completed_at,r.created_at,
        s.id AS student_id,s.student_no,s.full_name_ar AS student_name,
        g.name_ar AS grade_name,c.name_ar AS class_name,
        creator.full_name_ar AS teacher_name,
        deductor.full_name_ar AS deducted_by_name,
        completer.full_name_ar AS completed_by_name,
        COALESCE(w.points_balance,0)::int AS wallet_points,
        ret.guidance_return_note,ret.guidance_returned_at,ret.guidance_returned_by_name
      FROM public.student_referrals r
      JOIN public.students s ON s.id=r.student_id
      JOIN public.classes c ON c.id=r.class_id
      JOIN public.grades g ON g.id=c.grade_id
      JOIN public.app_users creator ON creator.id=r.created_by
      LEFT JOIN public.app_users deductor ON deductor.id=r.deducted_by
      LEFT JOIN public.app_users completer ON completer.id=r.completed_by
      LEFT JOIN public.student_wallet_balances w
        ON w.student_id=r.student_id AND w.school_id=r.school_id
      LEFT JOIN LATERAL (
        SELECT
          al.after_json->>'note' AS guidance_return_note,
          al.created_at AS guidance_returned_at,
          actor.full_name_ar AS guidance_returned_by_name
        FROM public.audit_logs al
        LEFT JOIN public.app_users actor ON actor.id=al.actor_user_id
        WHERE al.school_id=r.school_id
          AND al.entity_type='student_referral'
          AND al.entity_id=r.id::text
          AND al.action='RETURN_STUDENT_REFERRAL_TO_TEACHER'
        ORDER BY al.created_at DESC
        LIMIT 1
      ) ret ON true
      LEFT JOIN LATERAL (
        SELECT max(al.created_at) AS forwarded_at
        FROM public.audit_logs al
        WHERE al.school_id=r.school_id
          AND al.entity_type='student_referral'
          AND al.entity_id=r.id::text
          AND al.action='FORWARD_RETURNED_REFERRAL_TO_VICE'
      ) fwd ON true
      WHERE r.school_id=v_school
        AND r.archive_deleted_at IS NULL
        AND (COALESCE(p_status,'OPEN')='ALL' OR r.status=p_status)
        AND (
          (v_teacher AND r.created_by=v_user)
          OR (
            v_vice
            AND r.target_role='VICE_PRINCIPAL'
            AND EXISTS(
              SELECT 1
              FROM public.teacher_class_assignments tca
              WHERE tca.user_id=v_user
                AND tca.class_id=r.class_id
                AND tca.is_active=true
            )
          )
          OR (
            v_guidance
            AND r.target_role='GUIDANCE_COUNSELOR'
            AND NOT (
              ret.guidance_returned_at IS NOT NULL
              AND ret.guidance_returned_at > COALESCE(fwd.forwarded_at,'epoch'::timestamptz)
            )
          )
        )
    ) x
  ),'[]'::jsonb);
END;
$referral_scope$;

CREATE OR REPLACE FUNCTION public.api_teacher_followup_data()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $followup_scope$
DECLARE
  v_auth uuid:=NULLIF(auth.user_id(),'')::uuid;
  v_user uuid;
  v_school uuid;
  v_job text;
  v_teacher boolean:=false;
  v_vice boolean:=false;
  v_global_monitor boolean:=false;
  v_can_monitor boolean:=false;
BEGIN
  SELECT id,school_id
  INTO v_user,v_school
  FROM public.app_users
  WHERE auth_user_id=v_auth AND is_active=true
  LIMIT 1;

  IF v_user IS NULL THEN RAISE EXCEPTION 'APP_USER_REQUIRED'; END IF;

  SELECT sd.job_title_ar
  INTO v_job
  FROM public.staff_directory sd
  WHERE sd.linked_app_user_id=v_user AND sd.is_active=true
  ORDER BY sd.updated_at DESC NULLS LAST
  LIMIT 1;

  -- Formal role has priority so a guidance counselor who is also SUPER_ADMIN
  -- remains a guidance counselor for operational scope.
  IF v_job IS NOT NULL THEN
    v_teacher:=v_job='معلم';
    v_vice:=v_job ILIKE '%وكيل%';
    v_global_monitor:=v_job='الموجه الطلابي';
  ELSE
    v_teacher:=EXISTS(
      SELECT 1 FROM public.user_roles
      WHERE user_id=v_user AND role='TEACHER'
    );
    v_vice:=EXISTS(
      SELECT 1 FROM public.user_roles
      WHERE user_id=v_user AND role='VICE_PRINCIPAL'
    );
    v_global_monitor:=EXISTS(
      SELECT 1 FROM public.user_roles
      WHERE user_id=v_user
        AND role IN ('SUPER_ADMIN','GUIDANCE_COUNSELOR')
    );
  END IF;

  v_can_monitor:=v_global_monitor OR v_vice;

  RETURN jsonb_build_object(
    'can_monitor',v_can_monitor,
    'achievement',public.api_teacher_achievement_stats(),
    'students',COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id',s.id,
        'student_no',s.student_no,
        'name',s.full_name_ar,
        'class_id',s.class_id,
        'grade_name',g.name_ar,
        'class_name',c.name_ar
      ) ORDER BY g.name_ar,c.name_ar,s.full_name_ar)
      FROM public.students s
      JOIN public.classes c ON c.id=s.class_id
      JOIN public.grades g ON g.id=c.grade_id
      WHERE s.school_id=v_school
        AND s.is_active=true
        AND (
          v_global_monitor
          OR EXISTS(
            SELECT 1
            FROM public.teacher_class_assignments tca
            WHERE tca.user_id=v_user
              AND tca.class_id=s.class_id
              AND tca.is_active=true
          )
        )
    ),'[]'::jsonb),
    'notes',COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id',n.id,
        'student_id',n.student_id,
        'student_no',s.student_no,
        'student_name',s.full_name_ar,
        'class_id',n.class_id,
        'grade_name',g.name_ar,
        'class_name',c.name_ar,
        'teacher_user_id',n.teacher_user_id,
        'teacher_name',COALESCE(
          au.full_name_ar,
          (
            SELECT sd.full_name_ar
            FROM public.staff_directory sd
            WHERE sd.linked_app_user_id=n.teacher_user_id
              AND sd.is_active=true
            ORDER BY sd.updated_at DESC NULLS LAST
            LIMIT 1
          ),
          '—'
        ),
        'subject_ar',n.subject_ar,
        'note_kind',n.note_kind,
        'category_ar',n.category_ar,
        'note_text',n.note_text,
        'note_date',n.note_date,
        'created_at',n.created_at
      ) ORDER BY n.created_at DESC)
      FROM public.student_followup_notes n
      JOIN public.students s ON s.id=n.student_id
      JOIN public.classes c ON c.id=n.class_id
      JOIN public.grades g ON g.id=c.grade_id
      LEFT JOIN public.app_users au ON au.id=n.teacher_user_id
      WHERE n.school_id=v_school
        AND n.created_at>now()-interval '90 days'
        AND (
          v_global_monitor
          OR (
            v_vice
            AND EXISTS(
              SELECT 1
              FROM public.teacher_class_assignments tca
              WHERE tca.user_id=v_user
                AND tca.class_id=n.class_id
                AND tca.is_active=true
            )
          )
          OR (v_teacher AND n.teacher_user_id=v_user)
        )
    ),'[]'::jsonb)
  );
END;
$followup_scope$;

GRANT EXECUTE ON FUNCTION public.api_student_referrals(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.api_teacher_followup_data() TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
SELECT pg_notify('pgrst','reload schema');

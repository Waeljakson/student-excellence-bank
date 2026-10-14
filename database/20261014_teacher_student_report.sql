-- 2026-10-14: read-only, teacher/student interaction report.
-- Teacher access is self-only; authorized school leaders may select a teacher.
CREATE OR REPLACE FUNCTION public.api_teacher_student_report(
  p_teacher_user_id uuid DEFAULT NULL,
  p_class_id uuid DEFAULT NULL,
  p_student_id uuid DEFAULT NULL,
  p_from_date date DEFAULT NULL,
  p_to_date date DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $body$
DECLARE
  v_auth uuid;
  v_user uuid;
  v_school uuid;
  v_teacher uuid;
  v_job text;
  v_admin boolean := false;
  v_teacher_role boolean := false;
  v_teacher_name text;
  v_subject text;
  v_result jsonb;
BEGIN
  v_auth:=NULLIF(NULLIF(auth.user_id(),''),'anonymous')::uuid;
  IF v_auth IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  SELECT id,school_id INTO v_user,v_school FROM public.app_users
    WHERE auth_user_id=v_auth AND is_active=true LIMIT 1;
  IF v_user IS NULL THEN RAISE EXCEPTION 'APP_USER_REQUIRED'; END IF;
  SELECT job_title_ar INTO v_job FROM public.staff_directory
    WHERE school_id=v_school AND linked_app_user_id=v_user AND is_active=true
    ORDER BY updated_at DESC NULLS LAST LIMIT 1;
  v_teacher_role:=COALESCE(v_job='معلم',false) OR (v_job IS NULL AND EXISTS(
    SELECT 1 FROM public.user_roles WHERE user_id=v_user AND role='TEACHER'));
  v_admin:=(v_job IS DISTINCT FROM 'معلم') AND EXISTS(
    SELECT 1 FROM public.user_roles WHERE user_id=v_user
      AND role IN ('SUPER_ADMIN','SCHOOL_ADMIN','PRINCIPAL','GUIDANCE_COUNSELOR'));
  IF NOT v_teacher_role AND NOT v_admin THEN RAISE EXCEPTION 'TEACHER_REPORT_ACCESS_DENIED'; END IF;
  IF p_from_date IS NOT NULL AND p_to_date IS NOT NULL AND p_from_date>p_to_date THEN
    RAISE EXCEPTION 'REPORT_DATE_RANGE_INVALID';
  END IF;
  IF NOT v_admin THEN
    IF p_teacher_user_id IS NOT NULL AND p_teacher_user_id<>v_user THEN
      RAISE EXCEPTION 'TEACHER_REPORT_ACCESS_DENIED';
    END IF;
    v_teacher:=v_user;
  ELSE
    v_teacher:=p_teacher_user_id;
  END IF;
  IF v_teacher IS NOT NULL THEN
    SELECT au.full_name_ar,
      COALESCE(NULLIF(sd.teaching_subject_ar,''),NULLIF(sd.specialty_ar,''),'—')
    INTO v_teacher_name,v_subject
    FROM public.app_users au
    LEFT JOIN LATERAL (
      SELECT teaching_subject_ar,specialty_ar,job_title_ar FROM public.staff_directory
      WHERE school_id=v_school AND linked_app_user_id=au.id AND is_active=true
      ORDER BY updated_at DESC NULLS LAST LIMIT 1
    ) sd ON true
    WHERE au.id=v_teacher AND au.school_id=v_school AND au.is_active=true
      AND (sd.job_title_ar='معلم' OR (sd.job_title_ar IS NULL AND EXISTS(
        SELECT 1 FROM public.user_roles WHERE user_id=au.id AND role='TEACHER')));
    IF v_teacher_name IS NULL THEN RAISE EXCEPTION 'TEACHER_REPORT_TEACHER_NOT_FOUND'; END IF;
  END IF;
  IF p_class_id IS NOT NULL AND (v_teacher IS NULL OR NOT EXISTS(
    SELECT 1 FROM public.teacher_class_assignments t
    JOIN public.classes c ON c.id=t.class_id
    JOIN public.grades g ON g.id=c.grade_id
    JOIN public.departments d ON d.id=g.department_id
    WHERE t.school_id=v_school AND d.school_id=v_school
      AND t.user_id=v_teacher AND t.is_active=true AND t.class_id=p_class_id
  )) THEN RAISE EXCEPTION 'TEACHER_REPORT_CLASS_FORBIDDEN'; END IF;
  IF p_student_id IS NOT NULL AND (v_teacher IS NULL OR NOT EXISTS(
    SELECT 1 FROM public.students s
    JOIN public.teacher_class_assignments t ON t.school_id=s.school_id
      AND t.class_id=s.class_id AND t.user_id=v_teacher AND t.is_active=true
    WHERE s.id=p_student_id AND s.school_id=v_school AND s.is_active=true
      AND (p_class_id IS NULL OR s.class_id=p_class_id)
  )) THEN RAISE EXCEPTION 'TEACHER_REPORT_STUDENT_FORBIDDEN'; END IF;

  WITH eligible AS (
    SELECT s.id,s.student_no,s.full_name_ar AS student_name,s.class_id,
           c.name_ar AS class_name,g.name_ar AS grade_name
    FROM public.students s
    JOIN public.classes c ON c.id=s.class_id
    JOIN public.grades g ON g.id=c.grade_id
    JOIN public.teacher_class_assignments t ON t.class_id=s.class_id
      AND t.user_id=v_teacher AND t.school_id=v_school AND t.is_active=true
    WHERE s.school_id=v_school AND s.is_active=true
      AND (p_class_id IS NULL OR s.class_id=p_class_id)
      AND (p_student_id IS NULL OR s.id=p_student_id)
  ), events AS (
    SELECT r.id AS source_id,r.student_id,r.created_at AS event_at,
      'REFERRAL'::text AS category,'تحويل طالب'::text AS title,
      concat_ws(' — ',NULLIF(r.violation_text,''),NULLIF(r.violation_explanation,''),
        NULLIF(r.teacher_action_1,''),NULLIF(r.teacher_action_2,''),
        NULLIF(r.teacher_action_3,''),NULLIF(r.completion_note,'')) AS detail,
      r.subject_ar AS subject,r.status::text AS status,
      NULL::integer AS points,NULL::integer AS effective_points
    FROM public.student_referrals r
    WHERE r.school_id=v_school AND r.created_by=v_teacher AND r.archive_deleted_at IS NULL
    UNION ALL
    SELECT n.id,n.student_id,
      COALESCE(n.note_date::timestamp AT TIME ZONE 'Asia/Riyadh',n.created_at),
      'FOLLOWUP',CASE n.note_kind WHEN 'POSITIVE' THEN 'متابعة إيجابية'
        WHEN 'NEGATIVE' THEN 'متابعة سلبية' WHEN 'HOMEWORK' THEN 'متابعة واجبات'
        ELSE 'ملاحظة عامة' END,
      concat_ws(' — ',NULLIF(n.category_ar,''),NULLIF(n.note_text,'')),
      n.subject_ar,n.note_kind,NULL::integer,NULL::integer
    FROM public.student_followup_notes n
    WHERE n.school_id=v_school AND n.teacher_user_id=v_teacher
    UNION ALL
    SELECT ec.id,ec.student_id,ec.issued_at,'CHECK',
      COALESCE(pr.name_ar,'شيك تميز'),
      concat_ws(' — ',NULLIF(ec.reason_ar,''),NULLIF(ec.serial_no,'')),
      NULL::text,concat(ec.status::text,' / ',ec.approval_status::text),
      ec.points,
      CASE WHEN ec.status::text NOT IN ('CANCELLED','REVERSED')
        AND ec.approval_status::text<>'REJECTED' THEN ec.points ELSE 0 END
    FROM public.excellence_checks ec
    LEFT JOIN public.point_rules pr ON pr.id=ec.rule_id
    WHERE ec.school_id=v_school AND ec.issued_by=v_teacher
    UNION ALL
    SELECT er.id,r.student_id,COALESCE(er.responded_at,r.requested_at),
      'EVALUATION_REPORT','تقرير تقييم '||COALESCE(r.report_no,''),
      concat_ws(' — ',
        CASE WHEN er.responded_at IS NULL THEN 'لم يُستكمل التقييم' ELSE 'تم إرسال التقييم' END,
        CASE er.academic_rating WHEN 'EXCELLENT' THEN 'تحصيلي: ممتاز'
          WHEN 'VERY_GOOD' THEN 'تحصيلي: جيد جدًا' WHEN 'GOOD' THEN 'تحصيلي: جيد'
          WHEN 'WEAK' THEN 'تحصيلي: ضعيف' END,
        CASE er.behavior_rating WHEN 'EXCELLENT' THEN 'سلوكي: ممتاز'
          WHEN 'VERY_GOOD' THEN 'سلوكي: جيد جدًا' WHEN 'GOOD' THEN 'سلوكي: جيد'
          WHEN 'WEAK' THEN 'سلوكي: ضعيف' END,NULLIF(er.notes,'')),
      er.subject_ar,CASE WHEN er.responded_at IS NULL THEN 'PENDING' ELSE 'COMPLETED' END,
      NULL::integer,NULL::integer
    FROM public.student_evaluation_responses er
    JOIN public.student_evaluation_reports r ON r.id=er.report_id AND r.school_id=v_school
    WHERE er.school_id=v_school AND er.teacher_user_id=v_teacher
    UNION ALL
    SELECT pe.id,pe.student_id,COALESCE(pe.submitted_at,pe.updated_at),
      'PERIODIC_EVALUATION',COALESCE(cy.title_ar,'تقييم دوري'),
      concat_ws(' — ',
        CASE pe.academic_rating WHEN 'EXCELLENT' THEN 'تحصيلي: ممتاز'
          WHEN 'VERY_GOOD' THEN 'تحصيلي: جيد جدًا' WHEN 'GOOD' THEN 'تحصيلي: جيد'
          WHEN 'WEAK' THEN 'تحصيلي: ضعيف' ELSE NULLIF(pe.academic_rating,'') END,
        CASE pe.behavior_rating WHEN 'EXCELLENT' THEN 'سلوكي: ممتاز'
          WHEN 'VERY_GOOD' THEN 'سلوكي: جيد جدًا' WHEN 'GOOD' THEN 'سلوكي: جيد'
          WHEN 'WEAK' THEN 'سلوكي: ضعيف' ELSE NULLIF(pe.behavior_rating,'') END,
        NULLIF(pe.notes,'')),
      pe.subject_ar,'COMPLETED',NULL::integer,NULL::integer
    FROM public.periodic_student_evaluations pe
    LEFT JOIN public.periodic_evaluation_cycles cy ON cy.id=pe.cycle_id
    WHERE pe.school_id=v_school AND pe.teacher_user_id=v_teacher
    UNION ALL
    SELECT bn.id,bn.student_id,bn.created_at,
      'BEHAVIORAL','ترشيح للتميز السلوكي','ترشيح المعلم للطالب في التميز السلوكي',
      NULL::text,'NOMINATED',NULL::integer,NULL::integer
    FROM public.behavioral_excellence_nominations bn
    WHERE bn.school_id=v_school AND bn.teacher_user_id=v_teacher
    UNION ALL
    SELECT ab.id,ab.student_id,ab.marked_at,'ABSENCE','تسجيل غياب حصة',
      concat_ws(' — ','الحصة '||ab.lesson_no,to_char(ab.school_day,'YYYY-MM-DD')),
      ab.subject_ar,'ABSENT',NULL::integer,NULL::integer
    FROM public.student_lesson_absence_events ab
    WHERE ab.school_id=v_school AND ab.teacher_user_id=v_teacher
    UNION ALL
    SELECT ex.id,ex.student_id,ex.created_at,'CLASS_EXIT','استئذان أثناء الحصة',
      concat_ws(' — ','الحصة '||ex.lesson_no,
        CASE WHEN ex.exited_at IS NULL THEN 'لم يسجل خروج'
          WHEN ex.returned_at IS NULL THEN 'لم يسجل عودة'
          ELSE 'عاد إلى الحصة' END),
      ex.subject_ar,CASE WHEN ex.returned_at IS NOT NULL THEN 'RETURNED'
        WHEN ex.exited_at IS NOT NULL THEN 'OUT' ELSE 'NOT_EXITED' END,
      NULL::integer,NULL::integer
    FROM public.student_class_exit_events ex
    WHERE ex.school_id=v_school AND ex.teacher_user_id=v_teacher
  ), filtered AS (
    SELECT e.source_id,e.event_at,e.category,e.title,e.detail,e.subject,e.status,
      e.points,e.effective_points,s.id AS student_id,s.student_no,s.student_name,
      s.class_id,s.class_name,s.grade_name
    FROM events e JOIN eligible s ON s.id=e.student_id
    WHERE (p_from_date IS NULL OR (e.event_at AT TIME ZONE 'Asia/Riyadh')::date>=p_from_date)
      AND (p_to_date IS NULL OR (e.event_at AT TIME ZONE 'Asia/Riyadh')::date<=p_to_date)
  )
  SELECT jsonb_build_object(
    'can_select_teacher',v_admin,
    'teacher',CASE WHEN v_teacher IS NULL THEN NULL ELSE jsonb_build_object(
      'id',v_teacher,'name',v_teacher_name,'subject',v_subject) END,
    'teachers',CASE WHEN v_admin THEN COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id',au.id,'name',au.full_name_ar,
        'subject',COALESCE(NULLIF(sd.teaching_subject_ar,''),NULLIF(sd.specialty_ar,''),'—'))
        ORDER BY au.full_name_ar)
      FROM public.app_users au
      LEFT JOIN LATERAL (
        SELECT teaching_subject_ar,specialty_ar,job_title_ar
        FROM public.staff_directory
        WHERE linked_app_user_id=au.id AND school_id=v_school AND is_active=true
        ORDER BY updated_at DESC NULLS LAST LIMIT 1
      ) sd ON true
      WHERE au.school_id=v_school AND au.is_active=true
        AND (sd.job_title_ar='معلم' OR (sd.job_title_ar IS NULL AND EXISTS(
          SELECT 1 FROM public.user_roles ur WHERE ur.user_id=au.id AND ur.role='TEACHER')))
    ),'[]'::jsonb) ELSE '[]'::jsonb END,
    'classes',COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id',c.id,'label',g.name_ar||' / فصل '||c.name_ar)
        ORDER BY g.sort_order,c.name_ar)
      FROM public.teacher_class_assignments t
      JOIN public.classes c ON c.id=t.class_id
      JOIN public.grades g ON g.id=c.grade_id
      WHERE t.user_id=v_teacher AND t.school_id=v_school AND t.is_active=true
    ),'[]'::jsonb),
    'students',COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id',s.id,'name',s.full_name_ar,
        'student_no',s.student_no,'class_id',s.class_id,
        'class_name',c.name_ar,'grade_name',g.name_ar)
        ORDER BY g.sort_order,c.name_ar,s.full_name_ar)
      FROM public.students s
      JOIN public.teacher_class_assignments t ON t.class_id=s.class_id
        AND t.school_id=v_school AND t.user_id=v_teacher AND t.is_active=true
      JOIN public.classes c ON c.id=s.class_id
      JOIN public.grades g ON g.id=c.grade_id
      WHERE s.school_id=v_school AND s.is_active=true
        AND (p_class_id IS NULL OR s.class_id=p_class_id)
    ),'[]'::jsonb),
    'activities',COALESCE((
      SELECT jsonb_agg(to_jsonb(f) ORDER BY f.event_at DESC,f.source_id)
      FROM filtered f
    ),'[]'::jsonb),
    'summary',jsonb_build_object(
      'events',(SELECT count(*) FROM filtered),
      'students',(SELECT count(DISTINCT student_id) FROM filtered),
      'valid_points',(SELECT COALESCE(sum(effective_points),0) FROM filtered),
      'referrals',(SELECT count(*) FROM filtered WHERE category='REFERRAL'),
      'followup',(SELECT count(*) FROM filtered WHERE category='FOLLOWUP'),
      'checks',(SELECT count(*) FROM filtered WHERE category='CHECK'),
      'evaluations',(SELECT count(*) FROM filtered WHERE category IN ('EVALUATION_REPORT','PERIODIC_EVALUATION')),
      'other',(SELECT count(*) FROM filtered WHERE category IN ('BEHAVIORAL','ABSENCE','CLASS_EXIT'))
    ),
    'student_stats',COALESCE((
      SELECT jsonb_agg(to_jsonb(st) ORDER BY st.student_name)
      FROM (
        SELECT student_id,student_name,student_no,class_id,class_name,grade_name,
          count(*)::integer AS events,
          count(*) FILTER(WHERE category='REFERRAL')::integer AS referrals,
          count(*) FILTER(WHERE category='FOLLOWUP')::integer AS followup,
          count(*) FILTER(WHERE category='CHECK')::integer AS checks,
          count(*) FILTER(WHERE category IN ('EVALUATION_REPORT','PERIODIC_EVALUATION'))::integer AS evaluations,
          COALESCE(sum(effective_points),0)::integer AS valid_points
        FROM filtered
        GROUP BY student_id,student_name,student_no,class_id,class_name,grade_name
      ) st
    ),'[]'::jsonb)
  ) INTO v_result;
  RETURN v_result;
END;
$body$;
REVOKE ALL ON FUNCTION public.api_teacher_student_report(uuid,uuid,uuid,date,date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.api_teacher_student_report(uuid,uuid,uuid,date,date) TO authenticated;
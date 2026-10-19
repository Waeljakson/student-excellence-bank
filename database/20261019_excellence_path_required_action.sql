-- 2026-10-19: require a brief description of the teacher's action in
-- every Excellence Path before/after assessment, at both DB and RPC levels.
-- Existing row check: the production table had zero rows when this migration was added.

ALTER TABLE public.student_excellence_path
  ADD CONSTRAINT student_excellence_path_note_required
  CHECK (char_length(btrim(note)) > 0);

CREATE OR REPLACE FUNCTION public.api_excellence_path_save(
  p_record_id uuid DEFAULT NULL,
  p_student_id uuid DEFAULT NULL,
  p_subject_ar text DEFAULT NULL,
  p_test_type text DEFAULT NULL,
  p_semester integer DEFAULT NULL,
  p_period integer DEFAULT NULL,
  p_max_score numeric DEFAULT NULL,
  p_before_score numeric DEFAULT NULL,
  p_after_score numeric DEFAULT NULL,
  p_note text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $body$
DECLARE
  v_auth uuid;
  v_user uuid;
  v_school uuid;
  v_year uuid;
  v_class uuid;
  v_existing record;
  v_row public.student_excellence_path%ROWTYPE;
BEGIN
  v_auth:=NULLIF(NULLIF(auth.user_id(),''),'anonymous')::uuid;
  IF v_auth IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  SELECT id,school_id INTO v_user,v_school FROM public.app_users
    WHERE auth_user_id=v_auth AND is_active=true LIMIT 1;
  IF v_user IS NULL THEN RAISE EXCEPTION 'APP_USER_REQUIRED'; END IF;
  IF NOT (
    EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=v_user AND role='TEACHER')
    OR EXISTS(SELECT 1 FROM public.staff_directory
       WHERE school_id=v_school AND linked_app_user_id=v_user AND is_active=true AND job_title_ar='معلم')
  ) THEN RAISE EXCEPTION 'EXCELLENCE_PATH_TEACHER_REQUIRED'; END IF;
  SELECT id INTO v_year FROM public.academic_years
    WHERE school_id=v_school AND is_current=true ORDER BY starts_on DESC NULLS LAST LIMIT 1;
  IF v_year IS NULL THEN RAISE EXCEPTION 'CURRENT_ACADEMIC_YEAR_NOT_FOUND'; END IF;

  IF p_student_id IS NULL OR NOT EXISTS(
    SELECT 1 FROM public.students s
      JOIN public.classes c ON c.id=s.class_id AND c.academic_year_id=v_year
      JOIN public.grades g ON g.id=c.grade_id
      JOIN public.departments d ON d.id=g.department_id AND d.school_id=v_school
      JOIN public.teacher_class_assignments t ON t.class_id=s.class_id
        AND t.user_id=v_user AND t.school_id=v_school AND t.is_active=true
    WHERE s.id=p_student_id AND s.school_id=v_school AND s.is_active=true AND c.is_active=true
  ) THEN RAISE EXCEPTION 'EXCELLENCE_PATH_STUDENT_FORBIDDEN'; END IF;
  SELECT class_id INTO v_class FROM public.students WHERE id=p_student_id AND school_id=v_school;
  -- Every before/after assessment must document what the teacher did.
  IF NULLIF(btrim(COALESCE(p_note,'')), '') IS NULL THEN
    RAISE EXCEPTION 'EXCELLENCE_PATH_ACTION_REQUIRED';
  END IF;
  IF p_test_type IS NULL OR p_test_type NOT IN ('PERIOD_TEST','SHORT_TEST','DIAGNOSTIC','FINAL','OTHER')
    OR p_semester IS NULL OR p_semester NOT IN (1,2)
    OR p_period IS NULL OR p_period NOT IN (1,2)
    OR p_subject_ar IS NULL OR char_length(trim(p_subject_ar)) NOT BETWEEN 1 AND 120
    OR p_max_score IS NULL OR p_max_score<=0 OR p_max_score>10000
    OR p_before_score IS NULL OR p_before_score<0 OR p_before_score>p_max_score
    OR p_after_score IS NULL OR p_after_score<0 OR p_after_score>p_max_score
    OR char_length(COALESCE(p_note,''))>1000
  THEN RAISE EXCEPTION 'EXCELLENCE_PATH_INVALID_SCORES'; END IF;

  IF p_record_id IS NOT NULL THEN
    SELECT id,school_id,teacher_user_id,student_id INTO v_existing
      FROM public.student_excellence_path
      WHERE id=p_record_id FOR UPDATE;
    IF NOT FOUND OR v_existing.school_id<>v_school OR v_existing.teacher_user_id<>v_user
      OR v_existing.student_id<>p_student_id THEN
      RAISE EXCEPTION 'EXCELLENCE_PATH_EDIT_FORBIDDEN';
    END IF;
    UPDATE public.student_excellence_path SET
      class_id=v_class,subject_ar=trim(p_subject_ar),test_type=p_test_type,
      semester=p_semester,period=p_period,max_score=p_max_score,
      before_score=p_before_score,after_score=p_after_score,note=COALESCE(trim(p_note),''),
      updated_at=now()
      WHERE id=p_record_id RETURNING * INTO v_row;
  ELSE
    INSERT INTO public.student_excellence_path (
      school_id,academic_year_id,class_id,student_id,teacher_user_id,
      subject_ar,test_type,semester,period,max_score,before_score,after_score,note
    ) VALUES (
      v_school,v_year,v_class,p_student_id,v_user,trim(p_subject_ar),
      p_test_type,p_semester,p_period,p_max_score,p_before_score,p_after_score,COALESCE(trim(p_note),'')
    ) RETURNING * INTO v_row;
  END IF;

  RETURN jsonb_build_object(
    'id',v_row.id,
    'difference',v_row.after_score-v_row.before_score,
    'change_percent',CASE WHEN v_row.before_score>0
      THEN round((v_row.after_score-v_row.before_score)*100/v_row.before_score,2)
      ELSE NULL END,
    'percentage_points',round((v_row.after_score-v_row.before_score)*100/v_row.max_score,2),
    'status',CASE WHEN v_row.after_score>v_row.before_score THEN 'POSITIVE'
      WHEN v_row.after_score<v_row.before_score THEN 'NEGATIVE' ELSE 'STABLE' END
  );
END;
$body$;

NOTIFY pgrst,'reload schema';

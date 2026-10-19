-- 01: طريق التفوق — compare student test scores before and after improvement.
CREATE TABLE IF NOT EXISTS public.student_excellence_path (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id),
  academic_year_id uuid NOT NULL REFERENCES public.academic_years(id),
  class_id uuid NOT NULL REFERENCES public.classes(id),
  student_id uuid NOT NULL REFERENCES public.students(id),
  teacher_user_id uuid NOT NULL REFERENCES public.app_users(id),
  subject_ar text NOT NULL CHECK (char_length(trim(subject_ar)) BETWEEN 1 AND 120),
  test_type text NOT NULL CHECK (test_type IN ('PERIOD_TEST','SHORT_TEST','DIAGNOSTIC','FINAL','OTHER')),
  semester integer NOT NULL CHECK (semester IN (1,2)),
  period integer NOT NULL CHECK (period IN (1,2)),
  max_score numeric(7,2) NOT NULL DEFAULT 100 CHECK (max_score > 0 AND max_score <= 10000),
  before_score numeric(7,2) NOT NULL CHECK (before_score >= 0),
  after_score numeric(7,2) NOT NULL CHECK (after_score >= 0),
  note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT excellence_path_before_max CHECK (before_score <= max_score),
  CONSTRAINT excellence_path_after_max CHECK (after_score <= max_score)
);
CREATE INDEX IF NOT EXISTS idx_excellence_path_school_year
  ON public.student_excellence_path(school_id,academic_year_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_excellence_path_teacher_student
  ON public.student_excellence_path(teacher_user_id,student_id,created_at DESC);

-- MIGRATION_SPLIT_4418 --

-- 02: scoped read RPC. One call fetches a teacher's roster and history; no frequent polling.
CREATE OR REPLACE FUNCTION public.api_excellence_path_data()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $body$
DECLARE
  v_auth uuid;
  v_user uuid;
  v_school uuid;
  v_year uuid;
  v_year_name text;
  v_teacher boolean := false;
  v_admin boolean := false;
  v_subject text;
  v_result jsonb;
BEGIN
  v_auth:=NULLIF(NULLIF(auth.user_id(),''),'anonymous')::uuid;
  IF v_auth IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  SELECT id,school_id INTO v_user,v_school FROM public.app_users
   WHERE auth_user_id=v_auth AND is_active=true LIMIT 1;
  IF v_user IS NULL THEN RAISE EXCEPTION 'APP_USER_REQUIRED'; END IF;

  v_teacher:=EXISTS(SELECT 1 FROM public.user_roles
    WHERE user_id=v_user AND role='TEACHER')
    OR EXISTS(SELECT 1 FROM public.staff_directory
    WHERE school_id=v_school AND linked_app_user_id=v_user AND is_active=true AND job_title_ar='معلم');
  v_admin:=EXISTS(SELECT 1 FROM public.user_roles
    WHERE user_id=v_user AND role IN ('SUPER_ADMIN','SCHOOL_ADMIN','PRINCIPAL','GUIDANCE_COUNSELOR'));
  IF NOT v_teacher AND NOT v_admin THEN RAISE EXCEPTION 'EXCELLENCE_PATH_ACCESS_DENIED'; END IF;

  SELECT id,name INTO v_year,v_year_name FROM public.academic_years
   WHERE school_id=v_school AND is_current=true ORDER BY starts_on DESC NULLS LAST LIMIT 1;
  IF v_year IS NULL THEN RAISE EXCEPTION 'CURRENT_ACADEMIC_YEAR_NOT_FOUND'; END IF;
  SELECT COALESCE(NULLIF(teaching_subject_ar,''),NULLIF(specialty_ar,''),'')
    INTO v_subject FROM public.staff_directory
    WHERE school_id=v_school AND linked_app_user_id=v_user AND is_active=true
    ORDER BY updated_at DESC NULLS LAST LIMIT 1;

  SELECT jsonb_build_object(
    'academic_year',v_year_name,
    'can_manage',v_teacher,
    'can_monitor',v_admin,
    'teacher_id',v_user,
    'default_subject',COALESCE(v_subject,''),
    'students',COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id',s.id,'name',s.full_name_ar,'student_no',s.student_no,
        'class_id',c.id,'class_name',c.name_ar,'grade_name',g.name_ar)
        ORDER BY g.sort_order,c.name_ar,s.full_name_ar)
      FROM public.students s
      JOIN public.classes c ON c.id=s.class_id AND c.academic_year_id=v_year
      JOIN public.grades g ON g.id=c.grade_id
      WHERE s.school_id=v_school AND s.is_active=true AND c.is_active=true
        AND (v_admin OR EXISTS(
          SELECT 1 FROM public.teacher_class_assignments t
          WHERE t.user_id=v_user AND t.school_id=v_school AND t.class_id=s.class_id AND t.is_active=true))
    ),'[]'::jsonb),
    'records',COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id',r.id,'student_id',r.student_id,'student_name',s.full_name_ar,
        'student_no',s.student_no,'class_id',r.class_id,
        'class_name',c.name_ar,'grade_name',g.name_ar,
        'teacher_id',r.teacher_user_id,'teacher_name',au.full_name_ar,
        'subject',r.subject_ar,'test_type',r.test_type,
        'semester',r.semester,'period',r.period,
        'max_score',r.max_score,'before_score',r.before_score,'after_score',r.after_score,
        'difference',r.after_score-r.before_score,
        'change_percent',CASE WHEN r.before_score>0
          THEN round((r.after_score-r.before_score)*100/r.before_score,2)
          ELSE NULL END,
        'percentage_points',round((r.after_score-r.before_score)*100/r.max_score,2),
        'status',CASE WHEN r.after_score>r.before_score THEN 'POSITIVE'
          WHEN r.after_score<r.before_score THEN 'NEGATIVE' ELSE 'STABLE' END,
        'note',r.note,'created_at',r.created_at,'updated_at',r.updated_at)
        ORDER BY r.updated_at DESC,r.id)
      FROM public.student_excellence_path r
      JOIN public.students s ON s.id=r.student_id AND s.school_id=r.school_id
      JOIN public.classes c ON c.id=r.class_id
      JOIN public.grades g ON g.id=c.grade_id
      JOIN public.app_users au ON au.id=r.teacher_user_id AND au.school_id=r.school_id
      WHERE r.school_id=v_school AND r.academic_year_id=v_year
        AND (v_admin OR r.teacher_user_id=v_user)
    ),'[]'::jsonb)
  ) INTO v_result;
  RETURN v_result;
END;
$body$;

-- MIGRATION_SPLIT_4418 --

-- 03: creator-only save/update. Teacher must be assigned to the student's live class.
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

-- MIGRATION_SPLIT_4418 --

-- 04: remove anonymous exposure; authenticated access is still role/school scoped in the RPCs.
REVOKE ALL ON TABLE public.student_excellence_path FROM PUBLIC;
REVOKE ALL ON FUNCTION public.api_excellence_path_data() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.api_excellence_path_data() TO authenticated;
REVOKE ALL ON FUNCTION public.api_excellence_path_save(uuid,uuid,text,text,integer,integer,numeric,numeric,numeric,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.api_excellence_path_save(uuid,uuid,text,text,integer,integer,numeric,numeric,numeric,text) TO authenticated;
NOTIFY pgrst,'reload schema';

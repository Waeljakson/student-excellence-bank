-- 2026-10-05
-- Per-school feature switch for classroom exit/lesson attendance module.

BEGIN;

CREATE TABLE IF NOT EXISTS public.school_feature_settings (
  school_id uuid PRIMARY KEY REFERENCES public.schools(id) ON DELETE CASCADE,
  student_exit_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.app_users(id)
);

INSERT INTO public.school_feature_settings(school_id,student_exit_enabled)
SELECT s.id,
       CASE
         WHEN s.name_ar ILIKE '%الندى%' THEN true
         WHEN s.name_ar ILIKE '%الشعلة%' THEN false
         ELSE false
       END
FROM public.schools s
ON CONFLICT (school_id) DO NOTHING;

-- Explicit requested state: Al-Shaala off, Al-Nada on.
UPDATE public.school_feature_settings fs
SET student_exit_enabled=false,updated_at=now()
FROM public.schools s
WHERE s.id=fs.school_id AND s.name_ar ILIKE '%الشعلة%' AND fs.updated_by IS NULL;

UPDATE public.school_feature_settings fs
SET student_exit_enabled=true,updated_at=now()
FROM public.schools s
WHERE s.id=fs.school_id AND s.name_ar ILIKE '%الندى%' AND fs.updated_by IS NULL;

CREATE OR REPLACE FUNCTION public.api_student_exit_feature_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $feature_status$
DECLARE
  v_auth uuid;
  v_actor uuid;
  v_school uuid;
  v_school_name text;
  v_enabled boolean:=false;
BEGIN
  v_auth:=NULLIF(auth.user_id(),'')::uuid;

  SELECT au.id,au.school_id,s.name_ar
  INTO v_actor,v_school,v_school_name
  FROM public.app_users au
  JOIN public.schools s ON s.id=au.school_id
  WHERE au.auth_user_id=v_auth AND au.is_active=true
  LIMIT 1;

  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'APP_USER_REQUIRED';
  END IF;

  SELECT COALESCE(fs.student_exit_enabled,false)
  INTO v_enabled
  FROM public.school_feature_settings fs
  WHERE fs.school_id=v_school;

  RETURN jsonb_build_object(
    'school_id',v_school,
    'school_name',v_school_name,
    'student_exit_enabled',COALESCE(v_enabled,false)
  );
END;
$feature_status$;

CREATE OR REPLACE FUNCTION public.api_admin_set_student_exit_feature(
  p_enabled boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $set_feature$
DECLARE
  v_auth uuid;
  v_actor uuid;
  v_school uuid;
  v_school_name text;
BEGIN
  v_auth:=NULLIF(auth.user_id(),'')::uuid;

  SELECT au.id,au.school_id,s.name_ar
  INTO v_actor,v_school,v_school_name
  FROM public.app_users au
  JOIN public.schools s ON s.id=au.school_id
  WHERE au.auth_user_id=v_auth AND au.is_active=true
  LIMIT 1;

  IF v_actor IS NULL OR NOT EXISTS(
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id=v_actor
      AND ur.role IN ('SUPER_ADMIN','SCHOOL_ADMIN')
  ) THEN
    RAISE EXCEPTION 'SYSTEM_ADMIN_REQUIRED';
  END IF;

  INSERT INTO public.school_feature_settings(
    school_id,student_exit_enabled,updated_at,updated_by
  ) VALUES(
    v_school,COALESCE(p_enabled,false),now(),v_actor
  )
  ON CONFLICT (school_id) DO UPDATE
  SET student_exit_enabled=EXCLUDED.student_exit_enabled,
      updated_at=now(),
      updated_by=v_actor;

  INSERT INTO public.audit_logs(
    school_id,actor_user_id,action,entity_type,entity_id,after_json
  ) VALUES(
    v_school,v_actor,
    CASE WHEN COALESCE(p_enabled,false) THEN 'ENABLE_STUDENT_EXIT_FEATURE' ELSE 'DISABLE_STUDENT_EXIT_FEATURE' END,
    'school_feature_settings',v_school::text,
    jsonb_build_object('student_exit_enabled',COALESCE(p_enabled,false),'school_name',v_school_name)
  );

  RETURN jsonb_build_object(
    'ok',true,
    'school_id',v_school,
    'school_name',v_school_name,
    'student_exit_enabled',COALESCE(p_enabled,false)
  );
END;
$set_feature$;

-- Gate the teacher data endpoint and expose the current feature state.
CREATE OR REPLACE FUNCTION public.api_teacher_student_exit_data()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $teacher_exit_data$
DECLARE
  v_auth uuid;
  v_actor uuid;
  v_school uuid;
  v_enabled boolean:=false;
  v_followup jsonb;
  v_students jsonb;
  v_today date := (now() AT TIME ZONE 'Asia/Riyadh')::date;
  v_lesson int := public.mishkat_lesson_no_at(now());
  v_subject text;
BEGIN
  v_auth:=NULLIF(auth.user_id(),'')::uuid;

  SELECT au.id,au.school_id
  INTO v_actor,v_school
  FROM public.app_users au
  WHERE au.auth_user_id=v_auth AND au.is_active=true
  LIMIT 1;

  IF v_actor IS NULL OR NOT EXISTS(
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id=v_actor AND ur.role='TEACHER'
  ) THEN
    RAISE EXCEPTION 'TEACHER_REQUIRED';
  END IF;

  SELECT COALESCE(fs.student_exit_enabled,false)
  INTO v_enabled
  FROM public.school_feature_settings fs
  WHERE fs.school_id=v_school;

  IF NOT COALESCE(v_enabled,false) THEN
    RETURN jsonb_build_object(
      'feature_enabled',false,
      'today',v_today,
      'current_lesson_no',v_lesson,
      'teacher_subject_ar',NULL,
      'students','[]'::jsonb,
      'events','[]'::jsonb,
      'absences','[]'::jsonb
    );
  END IF;

  SELECT COALESCE(NULLIF(trim(sd.teaching_subject_ar),''),NULLIF(trim(sd.specialty_ar),''),'الحصة الدراسية')
  INTO v_subject
  FROM public.staff_directory sd
  WHERE sd.linked_app_user_id=v_actor
  LIMIT 1;
  v_subject:=COALESCE(v_subject,'الحصة الدراسية');

  v_followup:=public.api_teacher_followup_data();
  v_students:=COALESCE(v_followup->'students','[]'::jsonb);

  RETURN jsonb_build_object(
    'feature_enabled',true,
    'today',v_today,
    'current_lesson_no',v_lesson,
    'teacher_subject_ar',v_subject,
    'students',v_students,
    'events',COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id',e.id,'student_id',e.student_id,'class_id',e.class_id,
        'lesson_no',e.lesson_no,
        'subject_ar',COALESCE(NULLIF(trim(e.subject_ar),''),NULLIF(trim(sd.teaching_subject_ar),''),NULLIF(trim(sd.specialty_ar),''),'الحصة الدراسية'),
        'exited_at',e.exited_at,'returned_at',e.returned_at,
        'duration_minutes',round((extract(epoch FROM (COALESCE(e.returned_at,now())-e.exited_at))/60.0)::numeric,1),
        'teacher_name',au.full_name_ar
      ) ORDER BY e.exited_at DESC)
      FROM public.student_class_exit_events e
      JOIN public.app_users au ON au.id=e.teacher_user_id
      LEFT JOIN public.staff_directory sd ON sd.linked_app_user_id=e.teacher_user_id
      WHERE e.school_id=v_school AND e.school_day=v_today
        AND EXISTS(
          SELECT 1 FROM jsonb_array_elements(v_students) x
          WHERE NULLIF(x->>'id','')::uuid=e.student_id
        )
    ),'[]'::jsonb),
    'absences',COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id',a.id,'student_id',a.student_id,'class_id',a.class_id,
        'lesson_no',a.lesson_no,
        'subject_ar',COALESCE(NULLIF(trim(a.subject_ar),''),NULLIF(trim(sd.teaching_subject_ar),''),NULLIF(trim(sd.specialty_ar),''),'الحصة الدراسية'),
        'teacher_name',au.full_name_ar,'marked_at',a.marked_at
      ) ORDER BY a.marked_at DESC)
      FROM public.student_lesson_absence_events a
      JOIN public.app_users au ON au.id=a.teacher_user_id
      LEFT JOIN public.staff_directory sd ON sd.linked_app_user_id=a.teacher_user_id
      WHERE a.school_id=v_school AND a.school_day=v_today
        AND EXISTS(
          SELECT 1 FROM jsonb_array_elements(v_students) x
          WHERE NULLIF(x->>'id','')::uuid=a.student_id
        )
    ),'[]'::jsonb)
  );
END;
$teacher_exit_data$;

-- Helper used by write actions.
CREATE OR REPLACE FUNCTION public.student_exit_feature_enabled_for_school(p_school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $feature_enabled$
  SELECT COALESCE((
    SELECT fs.student_exit_enabled
    FROM public.school_feature_settings fs
    WHERE fs.school_id=p_school_id
  ),false);
$feature_enabled$;

CREATE OR REPLACE FUNCTION public.enforce_student_exit_feature_enabled()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $feature_guard$
DECLARE
  v_school uuid;
BEGIN
  v_school:=COALESCE(NEW.school_id,OLD.school_id);
  IF NOT public.student_exit_feature_enabled_for_school(v_school) THEN
    RAISE EXCEPTION 'STUDENT_EXIT_FEATURE_DISABLED';
  END IF;
  RETURN COALESCE(NEW,OLD);
END;
$feature_guard$;

DROP TRIGGER IF EXISTS student_class_exit_feature_guard ON public.student_class_exit_events;
CREATE TRIGGER student_class_exit_feature_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.student_class_exit_events
FOR EACH ROW EXECUTE FUNCTION public.enforce_student_exit_feature_enabled();

DROP TRIGGER IF EXISTS student_lesson_absence_feature_guard ON public.student_lesson_absence_events;
CREATE TRIGGER student_lesson_absence_feature_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.student_lesson_absence_events
FOR EACH ROW EXECUTE FUNCTION public.enforce_student_exit_feature_enabled();

GRANT EXECUTE ON FUNCTION public.api_student_exit_feature_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.api_admin_set_student_exit_feature(boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.student_exit_feature_enabled_for_school(uuid) TO authenticated;

REVOKE ALL ON TABLE public.school_feature_settings FROM anonymous,authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
SELECT pg_notify('pgrst','reload schema');

-- 2026-10-05
-- Automatic lesson detection + subject-aware exits + per-lesson absence tracking.
-- Based on the uploaded intermediate/secondary timetable (week 1, term 1, 1448H).

BEGIN;

CREATE OR REPLACE FUNCTION public.mishkat_lesson_no_at(p_at timestamptz DEFAULT now())
RETURNS int
LANGUAGE plpgsql
STABLE
SET search_path TO 'public','pg_temp'
AS $lesson_clock$
DECLARE
  v_time time := (p_at AT TIME ZONE 'Asia/Riyadh')::time;
BEGIN
  IF v_time >= time '07:00' AND v_time < time '07:45' THEN RETURN 1; END IF;
  IF v_time >= time '07:45' AND v_time < time '08:30' THEN RETURN 2; END IF;
  IF v_time >= time '08:30' AND v_time < time '09:15' THEN RETURN 3; END IF;
  IF v_time >= time '09:40' AND v_time < time '10:20' THEN RETURN 4; END IF;
  IF v_time >= time '10:20' AND v_time < time '11:00' THEN RETURN 5; END IF;
  IF v_time >= time '11:00' AND v_time < time '11:40' THEN RETURN 6; END IF;
  RETURN NULL;
END;
$lesson_clock$;

ALTER TABLE public.student_class_exit_events
  ADD COLUMN IF NOT EXISTS subject_ar text;

CREATE TABLE IF NOT EXISTS public.student_lesson_absence_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  teacher_user_id uuid NOT NULL REFERENCES public.app_users(id),
  lesson_no int NOT NULL CHECK (lesson_no BETWEEN 1 AND 6),
  subject_ar text,
  school_day date NOT NULL DEFAULT ((now() AT TIME ZONE 'Asia/Riyadh')::date),
  marked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(school_day, student_id, lesson_no)
);

CREATE INDEX IF NOT EXISTS student_lesson_absence_events_school_day_idx
  ON public.student_lesson_absence_events(school_id, school_day DESC, lesson_no);

CREATE INDEX IF NOT EXISTS student_lesson_absence_events_student_day_idx
  ON public.student_lesson_absence_events(student_id, school_day DESC, lesson_no);

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

  SELECT COALESCE(NULLIF(trim(sd.teaching_subject_ar),''),NULLIF(trim(sd.specialty_ar),''),'الحصة الدراسية')
  INTO v_subject
  FROM public.staff_directory sd
  WHERE sd.linked_app_user_id=v_actor
  LIMIT 1;
  v_subject:=COALESCE(v_subject,'الحصة الدراسية');

  v_followup:=public.api_teacher_followup_data();
  v_students:=COALESCE(v_followup->'students','[]'::jsonb);

  RETURN jsonb_build_object(
    'today',v_today,
    'current_lesson_no',v_lesson,
    'teacher_subject_ar',v_subject,
    'students',v_students,
    'events',COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id',e.id,
        'student_id',e.student_id,
        'class_id',e.class_id,
        'lesson_no',e.lesson_no,
        'subject_ar',COALESCE(NULLIF(trim(e.subject_ar),''),NULLIF(trim(sd.teaching_subject_ar),''),NULLIF(trim(sd.specialty_ar),''),'الحصة الدراسية'),
        'exited_at',e.exited_at,
        'returned_at',e.returned_at,
        'duration_minutes',round((extract(epoch FROM (COALESCE(e.returned_at,now())-e.exited_at))/60.0)::numeric,1),
        'teacher_name',au.full_name_ar
      ) ORDER BY e.exited_at DESC)
      FROM public.student_class_exit_events e
      JOIN public.app_users au ON au.id=e.teacher_user_id
      LEFT JOIN public.staff_directory sd ON sd.linked_app_user_id=e.teacher_user_id
      WHERE e.school_id=v_school
        AND e.school_day=v_today
        AND EXISTS(
          SELECT 1
          FROM jsonb_array_elements(v_students) x
          WHERE NULLIF(x->>'id','')::uuid=e.student_id
        )
    ),'[]'::jsonb),
    'absences',COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id',a.id,
        'student_id',a.student_id,
        'class_id',a.class_id,
        'lesson_no',a.lesson_no,
        'subject_ar',COALESCE(NULLIF(trim(a.subject_ar),''),NULLIF(trim(sd.teaching_subject_ar),''),NULLIF(trim(sd.specialty_ar),''),'الحصة الدراسية'),
        'teacher_name',au.full_name_ar,
        'marked_at',a.marked_at
      ) ORDER BY a.marked_at DESC)
      FROM public.student_lesson_absence_events a
      JOIN public.app_users au ON au.id=a.teacher_user_id
      LEFT JOIN public.staff_directory sd ON sd.linked_app_user_id=a.teacher_user_id
      WHERE a.school_id=v_school
        AND a.school_day=v_today
        AND EXISTS(
          SELECT 1
          FROM jsonb_array_elements(v_students) x
          WHERE NULLIF(x->>'id','')::uuid=a.student_id
        )
    ),'[]'::jsonb)
  );
END;
$teacher_exit_data$;

CREATE OR REPLACE FUNCTION public.api_teacher_student_exit_action(
  p_student_id uuid,
  p_action text,
  p_lesson_no int DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $teacher_exit_action$
DECLARE
  v_auth uuid;
  v_actor uuid;
  v_school uuid;
  v_action text:=upper(trim(COALESCE(p_action,'')));
  v_followup jsonb;
  v_student public.students%ROWTYPE;
  v_event public.student_class_exit_events%ROWTYPE;
  v_now timestamptz:=now();
  v_minutes numeric;
  v_current_lesson int:=public.mishkat_lesson_no_at(now());
  v_lesson int;
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

  SELECT COALESCE(NULLIF(trim(sd.teaching_subject_ar),''),NULLIF(trim(sd.specialty_ar),''),'الحصة الدراسية')
  INTO v_subject
  FROM public.staff_directory sd
  WHERE sd.linked_app_user_id=v_actor
  LIMIT 1;
  v_subject:=COALESCE(v_subject,'الحصة الدراسية');

  UPDATE public.student_class_exit_events
  SET returned_at=exited_at
  WHERE school_id=v_school
    AND returned_at IS NULL
    AND school_day < (v_now AT TIME ZONE 'Asia/Riyadh')::date;

  v_followup:=public.api_teacher_followup_data();

  IF NOT EXISTS(
    SELECT 1
    FROM jsonb_array_elements(COALESCE(v_followup->'students','[]'::jsonb)) x
    WHERE NULLIF(x->>'id','')::uuid=p_student_id
  ) THEN
    RAISE EXCEPTION 'TEACHER_STUDENT_ACCESS_DENIED';
  END IF;

  SELECT * INTO v_student
  FROM public.students
  WHERE id=p_student_id AND school_id=v_school AND is_active=true
  LIMIT 1;

  IF NOT FOUND THEN RAISE EXCEPTION 'STUDENT_NOT_FOUND'; END IF;

  IF v_action='EXIT' THEN
    IF v_current_lesson IS NULL THEN
      RAISE EXCEPTION 'NO_ACTIVE_LESSON';
    END IF;
    v_lesson:=v_current_lesson;

    SELECT * INTO v_event
    FROM public.student_class_exit_events
    WHERE student_id=p_student_id AND returned_at IS NULL
    ORDER BY exited_at DESC
    LIMIT 1
    FOR UPDATE;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'ok',true,'status','ALREADY_OUT','event_id',v_event.id,
        'student_id',p_student_id,'exited_at',v_event.exited_at,
        'lesson_no',v_event.lesson_no,'subject_ar',v_event.subject_ar
      );
    END IF;

    INSERT INTO public.student_class_exit_events(
      school_id,student_id,class_id,teacher_user_id,lesson_no,subject_ar,school_day,exited_at
    ) VALUES(
      v_school,v_student.id,v_student.class_id,v_actor,v_lesson,v_subject,
      (v_now AT TIME ZONE 'Asia/Riyadh')::date,v_now
    )
    RETURNING * INTO v_event;

    INSERT INTO public.audit_logs(
      school_id,actor_user_id,action,entity_type,entity_id,after_json
    ) VALUES(
      v_school,v_actor,'STUDENT_CLASS_EXIT','student_class_exit',v_event.id::text,
      jsonb_build_object('student_id',p_student_id,'lesson_no',v_lesson,'subject_ar',v_subject,'exited_at',v_now)
    );

    RETURN jsonb_build_object(
      'ok',true,'status','OUT','event_id',v_event.id,
      'student_id',p_student_id,'exited_at',v_event.exited_at,
      'lesson_no',v_lesson,'subject_ar',v_subject
    );

  ELSIF v_action='RETURN' THEN
    SELECT * INTO v_event
    FROM public.student_class_exit_events
    WHERE student_id=p_student_id AND returned_at IS NULL
    ORDER BY exited_at DESC
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok',true,'status','ALREADY_IN','student_id',p_student_id);
    END IF;

    UPDATE public.student_class_exit_events
    SET returned_at=v_now
    WHERE id=v_event.id
    RETURNING * INTO v_event;

    v_minutes:=round((extract(epoch FROM (v_event.returned_at-v_event.exited_at))/60.0)::numeric,1);

    INSERT INTO public.audit_logs(
      school_id,actor_user_id,action,entity_type,entity_id,after_json
    ) VALUES(
      v_school,v_actor,'STUDENT_CLASS_RETURN','student_class_exit',v_event.id::text,
      jsonb_build_object(
        'student_id',p_student_id,'lesson_no',v_event.lesson_no,'subject_ar',v_event.subject_ar,
        'exited_at',v_event.exited_at,'returned_at',v_event.returned_at,
        'duration_minutes',v_minutes
      )
    );

    RETURN jsonb_build_object(
      'ok',true,'status','IN','event_id',v_event.id,
      'student_id',p_student_id,'returned_at',v_event.returned_at,
      'duration_minutes',v_minutes,'lesson_no',v_event.lesson_no,'subject_ar',v_event.subject_ar
    );
  END IF;

  RAISE EXCEPTION 'STUDENT_EXIT_ACTION_INVALID';
END;
$teacher_exit_action$;

CREATE OR REPLACE FUNCTION public.api_teacher_student_absence_action(
  p_student_id uuid,
  p_action text DEFAULT 'MARK'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $teacher_absence_action$
DECLARE
  v_auth uuid;
  v_actor uuid;
  v_school uuid;
  v_action text:=upper(trim(COALESCE(p_action,'MARK')));
  v_followup jsonb;
  v_student public.students%ROWTYPE;
  v_event public.student_lesson_absence_events%ROWTYPE;
  v_now timestamptz:=now();
  v_today date:=(now() AT TIME ZONE 'Asia/Riyadh')::date;
  v_lesson int:=public.mishkat_lesson_no_at(now());
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

  IF v_lesson IS NULL THEN
    RAISE EXCEPTION 'NO_ACTIVE_LESSON';
  END IF;

  SELECT COALESCE(NULLIF(trim(sd.teaching_subject_ar),''),NULLIF(trim(sd.specialty_ar),''),'الحصة الدراسية')
  INTO v_subject
  FROM public.staff_directory sd
  WHERE sd.linked_app_user_id=v_actor
  LIMIT 1;
  v_subject:=COALESCE(v_subject,'الحصة الدراسية');

  v_followup:=public.api_teacher_followup_data();
  IF NOT EXISTS(
    SELECT 1
    FROM jsonb_array_elements(COALESCE(v_followup->'students','[]'::jsonb)) x
    WHERE NULLIF(x->>'id','')::uuid=p_student_id
  ) THEN
    RAISE EXCEPTION 'TEACHER_STUDENT_ACCESS_DENIED';
  END IF;

  SELECT * INTO v_student
  FROM public.students
  WHERE id=p_student_id AND school_id=v_school AND is_active=true
  LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'STUDENT_NOT_FOUND'; END IF;

  IF v_action='UNMARK' THEN
    DELETE FROM public.student_lesson_absence_events
    WHERE school_id=v_school AND student_id=p_student_id
      AND school_day=v_today AND lesson_no=v_lesson
    RETURNING * INTO v_event;

    RETURN jsonb_build_object(
      'ok',true,'status','PRESENT','student_id',p_student_id,
      'lesson_no',v_lesson,'subject_ar',v_subject
    );
  END IF;

  INSERT INTO public.student_lesson_absence_events(
    school_id,student_id,class_id,teacher_user_id,lesson_no,subject_ar,school_day,marked_at
  ) VALUES(
    v_school,v_student.id,v_student.class_id,v_actor,v_lesson,v_subject,v_today,v_now
  )
  ON CONFLICT (school_day,student_id,lesson_no) DO UPDATE
  SET teacher_user_id=EXCLUDED.teacher_user_id,
      subject_ar=EXCLUDED.subject_ar,
      marked_at=EXCLUDED.marked_at
  RETURNING * INTO v_event;

  INSERT INTO public.audit_logs(
    school_id,actor_user_id,action,entity_type,entity_id,after_json
  ) VALUES(
    v_school,v_actor,'STUDENT_LESSON_ABSENT','student_lesson_absence',v_event.id::text,
    jsonb_build_object('student_id',p_student_id,'lesson_no',v_lesson,'subject_ar',v_subject,'marked_at',v_now)
  );

  RETURN jsonb_build_object(
    'ok',true,'status','ABSENT','id',v_event.id,'student_id',p_student_id,
    'lesson_no',v_lesson,'subject_ar',v_subject,'marked_at',v_now
  );
END;
$teacher_absence_action$;

CREATE OR REPLACE FUNCTION public.api_guardian_student_exit_today(
  p_student_id uuid,
  p_student_no text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $guardian_exit_today$
DECLARE
  v_student public.students%ROWTYPE;
  v_today date := (now() AT TIME ZONE 'Asia/Riyadh')::date;
BEGIN
  SELECT * INTO v_student
  FROM public.students
  WHERE id=p_student_id
    AND student_no=trim(COALESCE(p_student_no,''))
    AND is_active=true
  LIMIT 1;

  IF NOT FOUND THEN RAISE EXCEPTION 'STUDENT_NOT_FOUND'; END IF;

  RETURN jsonb_build_object(
    'today',v_today,
    'exit_count',(
      SELECT count(*) FROM public.student_class_exit_events e
      WHERE e.student_id=v_student.id AND e.school_day=v_today
    ),
    'absence_count',(
      SELECT count(*) FROM public.student_lesson_absence_events a
      WHERE a.student_id=v_student.id AND a.school_day=v_today
    ),
    'currently_out',EXISTS(
      SELECT 1 FROM public.student_class_exit_events e
      WHERE e.student_id=v_student.id AND e.school_day=v_today AND e.returned_at IS NULL
    ),
    'total_minutes',COALESCE((
      SELECT round(sum(extract(epoch FROM (COALESCE(e.returned_at,now())-e.exited_at))/60.0)::numeric,1)
      FROM public.student_class_exit_events e
      WHERE e.student_id=v_student.id AND e.school_day=v_today
    ),0),
    'events',COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id',e.id,
        'lesson_no',e.lesson_no,
        'subject_ar',COALESCE(NULLIF(trim(e.subject_ar),''),NULLIF(trim(sd.teaching_subject_ar),''),NULLIF(trim(sd.specialty_ar),''),'الحصة الدراسية'),
        'exited_at',e.exited_at,
        'returned_at',e.returned_at,
        'duration_minutes',round((extract(epoch FROM (COALESCE(e.returned_at,now())-e.exited_at))/60.0)::numeric,1),
        'teacher_name',au.full_name_ar
      ) ORDER BY e.exited_at DESC)
      FROM public.student_class_exit_events e
      JOIN public.app_users au ON au.id=e.teacher_user_id
      LEFT JOIN public.staff_directory sd ON sd.linked_app_user_id=e.teacher_user_id
      WHERE e.student_id=v_student.id AND e.school_day=v_today
    ),'[]'::jsonb),
    'absences',COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id',a.id,
        'lesson_no',a.lesson_no,
        'subject_ar',COALESCE(NULLIF(trim(a.subject_ar),''),NULLIF(trim(sd.teaching_subject_ar),''),NULLIF(trim(sd.specialty_ar),''),'الحصة الدراسية'),
        'teacher_name',au.full_name_ar,
        'marked_at',a.marked_at
      ) ORDER BY a.lesson_no,a.marked_at)
      FROM public.student_lesson_absence_events a
      JOIN public.app_users au ON au.id=a.teacher_user_id
      LEFT JOIN public.staff_directory sd ON sd.linked_app_user_id=a.teacher_user_id
      WHERE a.student_id=v_student.id AND a.school_day=v_today
    ),'[]'::jsonb)
  );
END;
$guardian_exit_today$;

REVOKE ALL ON TABLE public.student_lesson_absence_events FROM anonymous,authenticated;
GRANT EXECUTE ON FUNCTION public.api_teacher_student_exit_data() TO authenticated;
GRANT EXECUTE ON FUNCTION public.api_teacher_student_exit_action(uuid,text,int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.api_teacher_student_absence_action(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.api_guardian_student_exit_today(uuid,text) TO anonymous,authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
SELECT pg_notify('pgrst','reload schema');

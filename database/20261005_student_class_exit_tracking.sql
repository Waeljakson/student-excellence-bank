-- 2026-10-05
-- Student classroom exit / return tracking for teachers and guardian daily attendance.
-- School-scoped, audit logged, and safe for multi-school use.

BEGIN;

CREATE TABLE IF NOT EXISTS public.student_class_exit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  teacher_user_id uuid NOT NULL REFERENCES public.app_users(id),
  lesson_no int NOT NULL CHECK (lesson_no BETWEEN 1 AND 10),
  school_day date NOT NULL DEFAULT ((now() AT TIME ZONE 'Asia/Riyadh')::date),
  exited_at timestamptz NOT NULL DEFAULT now(),
  returned_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (returned_at IS NULL OR returned_at >= exited_at)
);

CREATE INDEX IF NOT EXISTS student_class_exit_events_student_day_idx
  ON public.student_class_exit_events(student_id, school_day DESC, exited_at DESC);

CREATE INDEX IF NOT EXISTS student_class_exit_events_teacher_day_idx
  ON public.student_class_exit_events(teacher_user_id, school_day DESC, exited_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS student_class_exit_events_one_open_idx
  ON public.student_class_exit_events(student_id)
  WHERE returned_at IS NULL;

CREATE OR REPLACE FUNCTION public.api_teacher_student_exit_data()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $$
DECLARE
  v_auth uuid;
  v_actor uuid;
  v_school uuid;
  v_followup jsonb;
  v_students jsonb;
  v_today date := (now() AT TIME ZONE 'Asia/Riyadh')::date;
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

  v_followup:=public.api_teacher_followup_data();
  v_students:=COALESCE(v_followup->'students','[]'::jsonb);

  RETURN jsonb_build_object(
    'today',v_today,
    'students',v_students,
    'events',COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id',e.id,
        'student_id',e.student_id,
        'class_id',e.class_id,
        'lesson_no',e.lesson_no,
        'exited_at',e.exited_at,
        'returned_at',e.returned_at,
        'duration_minutes',round((extract(epoch FROM (COALESCE(e.returned_at,now())-e.exited_at))/60.0)::numeric,1),
        'teacher_name',au.full_name_ar
      ) ORDER BY e.exited_at DESC)
      FROM public.student_class_exit_events e
      JOIN public.app_users au ON au.id=e.teacher_user_id
      WHERE e.school_id=v_school
        AND e.school_day=v_today
        AND EXISTS(
          SELECT 1
          FROM jsonb_array_elements(v_students) x
          WHERE NULLIF(x->>'id','')::uuid=e.student_id
        )
    ),'[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.api_teacher_student_exit_action(
  p_student_id uuid,
  p_action text,
  p_lesson_no int
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $$
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

  -- Close forgotten open exits from previous school days at zero additional minutes.
  -- This prevents a stale record from blocking a new day's attendance.
  UPDATE public.student_class_exit_events
  SET returned_at=exited_at
  WHERE school_id=v_school
    AND returned_at IS NULL
    AND school_day < (v_now AT TIME ZONE 'Asia/Riyadh')::date;

  IF p_lesson_no IS NULL OR p_lesson_no<1 OR p_lesson_no>10 THEN
    RAISE EXCEPTION 'LESSON_NUMBER_REQUIRED';
  END IF;

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
        'lesson_no',v_event.lesson_no
      );
    END IF;

    INSERT INTO public.student_class_exit_events(
      school_id,student_id,class_id,teacher_user_id,lesson_no,school_day,exited_at
    ) VALUES(
      v_school,v_student.id,v_student.class_id,v_actor,p_lesson_no,
      (v_now AT TIME ZONE 'Asia/Riyadh')::date,v_now
    )
    RETURNING * INTO v_event;

    INSERT INTO public.audit_logs(
      school_id,actor_user_id,action,entity_type,entity_id,after_json
    ) VALUES(
      v_school,v_actor,'STUDENT_CLASS_EXIT','student_class_exit',v_event.id::text,
      jsonb_build_object('student_id',p_student_id,'lesson_no',p_lesson_no,'exited_at',v_now)
    );

    RETURN jsonb_build_object(
      'ok',true,'status','OUT','event_id',v_event.id,
      'student_id',p_student_id,'exited_at',v_event.exited_at,
      'lesson_no',v_event.lesson_no
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
        'student_id',p_student_id,'lesson_no',v_event.lesson_no,
        'exited_at',v_event.exited_at,'returned_at',v_event.returned_at,
        'duration_minutes',v_minutes
      )
    );

    RETURN jsonb_build_object(
      'ok',true,'status','IN','event_id',v_event.id,
      'student_id',p_student_id,'returned_at',v_event.returned_at,
      'duration_minutes',v_minutes,'lesson_no',v_event.lesson_no
    );
  END IF;

  RAISE EXCEPTION 'STUDENT_EXIT_ACTION_INVALID';
END;
$$;

CREATE OR REPLACE FUNCTION public.api_guardian_student_exit_today(
  p_student_id uuid,
  p_student_no text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $$
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
        'exited_at',e.exited_at,
        'returned_at',e.returned_at,
        'duration_minutes',round((extract(epoch FROM (COALESCE(e.returned_at,now())-e.exited_at))/60.0)::numeric,1),
        'teacher_name',au.full_name_ar
      ) ORDER BY e.exited_at DESC)
      FROM public.student_class_exit_events e
      JOIN public.app_users au ON au.id=e.teacher_user_id
      WHERE e.student_id=v_student.id AND e.school_day=v_today
    ),'[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON TABLE public.student_class_exit_events FROM anonymous,authenticated;
GRANT EXECUTE ON FUNCTION public.api_teacher_student_exit_data() TO authenticated;
GRANT EXECUTE ON FUNCTION public.api_teacher_student_exit_action(uuid,text,int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.api_guardian_student_exit_today(uuid,text) TO anonymous,authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;

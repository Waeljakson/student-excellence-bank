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


CREATE OR REPLACE FUNCTION public.api_admin_student_exit_analytics(
  p_days int DEFAULT 7
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $exit_analytics$
DECLARE
  v_auth uuid;
  v_actor uuid;
  v_school uuid;
  v_days int:=LEAST(30,GREATEST(1,COALESCE(p_days,7)));
  v_today date:=(now() AT TIME ZONE 'Asia/Riyadh')::date;
  v_from date;
  v_total_students int:=0;
  v_exit_events int:=0;
  v_unique_students int:=0;
  v_total_minutes numeric:=0;
  v_currently_out int:=0;
BEGIN
  v_auth:=NULLIF(auth.user_id(),'')::uuid;

  SELECT au.id,au.school_id
  INTO v_actor,v_school
  FROM public.app_users au
  WHERE au.auth_user_id=v_auth AND au.is_active=true
  LIMIT 1;

  IF v_actor IS NULL OR NOT EXISTS(
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id=v_actor
      AND ur.role IN ('SUPER_ADMIN','GUIDANCE_COUNSELOR')
  ) THEN
    RAISE EXCEPTION 'EXIT_ANALYTICS_ACCESS_REQUIRED';
  END IF;

  v_from:=v_today-(v_days-1);

  SELECT count(*)::int
  INTO v_total_students
  FROM public.students s
  WHERE s.school_id=v_school AND s.is_active=true;

  SELECT
    count(*)::int,
    count(DISTINCT e.student_id)::int,
    COALESCE(round(sum(
      extract(epoch FROM (
        CASE
          WHEN e.returned_at IS NOT NULL THEN e.returned_at
          WHEN e.school_day=v_today THEN now()
          ELSE e.exited_at
        END-e.exited_at
      ))/60.0
    )::numeric,1),0)
  INTO v_exit_events,v_unique_students,v_total_minutes
  FROM public.student_class_exit_events e
  WHERE e.school_id=v_school
    AND e.school_day BETWEEN v_from AND v_today;

  SELECT count(*)::int
  INTO v_currently_out
  FROM public.student_class_exit_events e
  WHERE e.school_id=v_school
    AND e.school_day=v_today
    AND e.returned_at IS NULL;

  RETURN jsonb_build_object(
    'period_days',v_days,
    'from_date',v_from,
    'to_date',v_today,
    'total_students',v_total_students,
    'exit_events',v_exit_events,
    'unique_students',v_unique_students,
    'student_exit_rate_pct',CASE WHEN v_total_students>0 THEN round((v_unique_students::numeric/v_total_students::numeric)*100,1) ELSE 0 END,
    'avg_exits_per_day',round(v_exit_events::numeric/v_days,1),
    'avg_exits_per_exiting_student',CASE WHEN v_unique_students>0 THEN round(v_exit_events::numeric/v_unique_students,1) ELSE 0 END,
    'total_minutes',v_total_minutes,
    'avg_minutes_per_exit',CASE WHEN v_exit_events>0 THEN round(v_total_minutes/v_exit_events,1) ELSE 0 END,
    'currently_out',v_currently_out,

    'currently_out_students',COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'student_id',s.id,
        'student_name',s.full_name_ar,
        'student_no',s.student_no,
        'grade_name',g.name_ar,
        'class_name',c.name_ar,
        'lesson_no',e.lesson_no,
        'teacher_name',au.full_name_ar,
        'exited_at',e.exited_at,
        'current_minutes',round((extract(epoch FROM (now()-e.exited_at))/60.0)::numeric,1)
      ) ORDER BY e.exited_at)
      FROM public.student_class_exit_events e
      JOIN public.students s ON s.id=e.student_id
      LEFT JOIN public.classes c ON c.id=e.class_id
      LEFT JOIN public.grades g ON g.id=c.grade_id
      LEFT JOIN public.app_users au ON au.id=e.teacher_user_id
      WHERE e.school_id=v_school
        AND e.school_day=v_today
        AND e.returned_at IS NULL
    ),'[]'::jsonb),

    'top_students',COALESCE((
      SELECT jsonb_agg(to_jsonb(x) ORDER BY x.exit_count DESC,x.total_minutes DESC,x.student_name)
      FROM (
        SELECT
          s.id AS student_id,
          s.full_name_ar AS student_name,
          s.student_no,
          g.name_ar AS grade_name,
          c.name_ar AS class_name,
          count(*)::int AS exit_count,
          round(sum(extract(epoch FROM (
            CASE
              WHEN e.returned_at IS NOT NULL THEN e.returned_at
              WHEN e.school_day=v_today THEN now()
              ELSE e.exited_at
            END-e.exited_at
          ))/60.0)::numeric,1) AS total_minutes,
          round(avg(extract(epoch FROM (
            CASE
              WHEN e.returned_at IS NOT NULL THEN e.returned_at
              WHEN e.school_day=v_today THEN now()
              ELSE e.exited_at
            END-e.exited_at
          ))/60.0)::numeric,1) AS avg_minutes
        FROM public.student_class_exit_events e
        JOIN public.students s ON s.id=e.student_id
        LEFT JOIN public.classes c ON c.id=e.class_id
        LEFT JOIN public.grades g ON g.id=c.grade_id
        WHERE e.school_id=v_school
          AND e.school_day BETWEEN v_from AND v_today
        GROUP BY s.id,s.full_name_ar,s.student_no,g.name_ar,c.name_ar
        ORDER BY exit_count DESC,total_minutes DESC,s.full_name_ar
        LIMIT 15
      ) x
    ),'[]'::jsonb),

    'classes',COALESCE((
      SELECT jsonb_agg(to_jsonb(x) ORDER BY x.exit_rate_pct DESC,x.exit_count DESC,x.grade_name,x.class_name)
      FROM (
        SELECT
          c.id AS class_id,
          g.name_ar AS grade_name,
          c.name_ar AS class_name,
          (SELECT count(*)::int FROM public.students st WHERE st.class_id=c.id AND st.school_id=v_school AND st.is_active=true) AS student_count,
          count(DISTINCT e.student_id)::int AS unique_students,
          count(*)::int AS exit_count,
          CASE
            WHEN (SELECT count(*) FROM public.students st WHERE st.class_id=c.id AND st.school_id=v_school AND st.is_active=true)>0
            THEN round(
              count(DISTINCT e.student_id)::numeric /
              (SELECT count(*)::numeric FROM public.students st WHERE st.class_id=c.id AND st.school_id=v_school AND st.is_active=true) * 100
            ,1)
            ELSE 0
          END AS exit_rate_pct,
          round(sum(extract(epoch FROM (
            CASE
              WHEN e.returned_at IS NOT NULL THEN e.returned_at
              WHEN e.school_day=v_today THEN now()
              ELSE e.exited_at
            END-e.exited_at
          ))/60.0)::numeric,1) AS total_minutes,
          round(avg(extract(epoch FROM (
            CASE
              WHEN e.returned_at IS NOT NULL THEN e.returned_at
              WHEN e.school_day=v_today THEN now()
              ELSE e.exited_at
            END-e.exited_at
          ))/60.0)::numeric,1) AS avg_minutes
        FROM public.student_class_exit_events e
        JOIN public.classes c ON c.id=e.class_id
        LEFT JOIN public.grades g ON g.id=c.grade_id
        WHERE e.school_id=v_school
          AND e.school_day BETWEEN v_from AND v_today
        GROUP BY c.id,g.name_ar,c.name_ar
      ) x
    ),'[]'::jsonb),

    'daily',COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'day',d.day,
        'exit_count',COALESCE(a.exit_count,0),
        'unique_students',COALESCE(a.unique_students,0),
        'total_minutes',COALESCE(a.total_minutes,0)
      ) ORDER BY d.day)
      FROM generate_series(v_from,v_today,'1 day'::interval) d(day)
      LEFT JOIN (
        SELECT
          e.school_day,
          count(*)::int AS exit_count,
          count(DISTINCT e.student_id)::int AS unique_students,
          round(sum(extract(epoch FROM (
            CASE
              WHEN e.returned_at IS NOT NULL THEN e.returned_at
              WHEN e.school_day=v_today THEN now()
              ELSE e.exited_at
            END-e.exited_at
          ))/60.0)::numeric,1) AS total_minutes
        FROM public.student_class_exit_events e
        WHERE e.school_id=v_school
          AND e.school_day BETWEEN v_from AND v_today
        GROUP BY e.school_day
      ) a ON a.school_day=d.day::date
    ),'[]'::jsonb),

    'lessons',COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'lesson_no',n.lesson_no,
        'exit_count',COALESCE(a.exit_count,0),
        'unique_students',COALESCE(a.unique_students,0),
        'avg_minutes',COALESCE(a.avg_minutes,0)
      ) ORDER BY n.lesson_no)
      FROM generate_series(1,10) n(lesson_no)
      LEFT JOIN (
        SELECT
          e.lesson_no,
          count(*)::int AS exit_count,
          count(DISTINCT e.student_id)::int AS unique_students,
          round(avg(extract(epoch FROM (
            CASE
              WHEN e.returned_at IS NOT NULL THEN e.returned_at
              WHEN e.school_day=v_today THEN now()
              ELSE e.exited_at
            END-e.exited_at
          ))/60.0)::numeric,1) AS avg_minutes
        FROM public.student_class_exit_events e
        WHERE e.school_id=v_school
          AND e.school_day BETWEEN v_from AND v_today
        GROUP BY e.lesson_no
      ) a ON a.lesson_no=n.lesson_no
    ),'[]'::jsonb)
  );
END;
$exit_analytics$;

GRANT EXECUTE ON FUNCTION public.api_admin_student_exit_analytics(int) TO authenticated;

REVOKE ALL ON TABLE public.student_class_exit_events FROM anonymous,authenticated;
GRANT EXECUTE ON FUNCTION public.api_teacher_student_exit_data() TO authenticated;
GRANT EXECUTE ON FUNCTION public.api_teacher_student_exit_action(uuid,text,int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.api_guardian_student_exit_today(uuid,text) TO anonymous,authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;

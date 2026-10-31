-- Phase 2: messages & excellence levels; non-destructive migration.
-- Published messages are school scoped, expiration limited, read via RPC only.
CREATE TABLE IF NOT EXISTS public.phase2_messages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 school_id uuid NOT NULL REFERENCES public.schools(id),
 title_ar text NOT NULL CHECK (length(trim(title_ar)) BETWEEN 3 AND 120),
 body_ar text NOT NULL CHECK (length(trim(body_ar)) BETWEEN 3 AND 1500),
 kind text NOT NULL DEFAULT 'GENERAL' CHECK(kind IN ('GENERAL','CONGRATULATION','ALERT')),
 audience text NOT NULL DEFAULT 'SCHOOL' CHECK(audience IN ('SCHOOL','CLASS','STUDENT')),
 class_id uuid REFERENCES public.classes(id),
 student_id uuid REFERENCES public.students(id),
 status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','PUBLISHED','ARCHIVED')),
 duration_days integer NOT NULL DEFAULT 3 CHECK(duration_days BETWEEN 1 AND 30),
 published_at timestamptz,
 expires_at timestamptz,
 created_by uuid NOT NULL REFERENCES public.app_users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT phase2_message_audience_target CHECK (
 (audience='SCHOOL' AND class_id IS NULL AND student_id IS NULL) OR
 (audience='CLASS' AND class_id IS NOT NULL AND student_id IS NULL) OR
 (audience='STUDENT' AND class_id IS NULL AND student_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS phase2_messages_live_idx ON public.phase2_messages(school_id,status,published_at DESC) WHERE status='PUBLISHED';
CREATE INDEX IF NOT EXISTS phase2_messages_admin_idx ON public.phase2_messages(school_id,created_at DESC);
REVOKE ALL ON public.phase2_messages FROM PUBLIC,authenticated;

CREATE OR REPLACE FUNCTION public.api_phase2_admin_data()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_school uuid;
BEGIN
 v_school:=public.phase2_admin_school();
 RETURN jsonb_build_object(
 'school_id',v_school,'school_name',(SELECT name_ar FROM public.schools WHERE id=v_school),
 'messages',COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC)
 FROM (SELECT id,title_ar,body_ar,kind,audience,class_id,student_id,status,duration_days,published_at,expires_at,created_at
 FROM public.phase2_messages WHERE school_id=v_school ORDER BY created_at DESC LIMIT 100) x),'[]'::jsonb),
 'classes',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',c.id,'name',g.name_ar||' — '||c.name_ar) ORDER BY g.name_ar,c.name_ar)
 FROM public.classes c JOIN public.grades g ON g.id=c.grade_id JOIN public.departments dep ON dep.id=g.department_id JOIN public.academic_years ay ON ay.id=c.academic_year_id WHERE dep.school_id=v_school AND ay.school_id=v_school AND c.is_active),'[]'::jsonb),
 'students',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',s.id,'name',s.full_name_ar,'no',s.student_no) ORDER BY s.full_name_ar)
 FROM public.students s WHERE s.school_id=v_school AND s.is_active),'[]'::jsonb)
 );
END
$function$;

CREATE OR REPLACE FUNCTION public.api_phase2_guardian_experience(p_student_no text, p_school_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_student public.students%ROWTYPE;
BEGIN
 SELECT s.* INTO v_student FROM public.students s JOIN public.schools sch ON sch.id=s.school_id
 WHERE s.student_no=trim(p_student_no) AND s.is_active AND sch.is_active AND upper(sch.code)=upper(trim(p_school_code)) LIMIT 1;
 IF NOT FOUND THEN RAISE EXCEPTION 'STUDENT_NOT_FOUND';END IF;
 RETURN jsonb_build_object('school_id',v_student.school_id,'student_id',v_student.id,
  'level',public.phase2_level_for_student(v_student.id),
  'messages',public.phase2_visible_messages(v_student.school_id,v_student.id,v_student.class_id));
END
$function$;

CREATE OR REPLACE FUNCTION public.api_phase2_save_draft(p_id uuid, p_title text, p_body text, p_kind text, p_audience text, p_target_id uuid, p_duration_days integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_school uuid;v_user uuid;v_id uuid;v_class uuid;v_student uuid;
BEGIN
 v_school:=public.phase2_admin_school();
 SELECT id INTO v_user FROM public.app_users WHERE auth_user_id=NULLIF(NULLIF(auth.user_id(),''),'anonymous')::uuid
 AND school_id=v_school AND is_active LIMIT 1;
 IF length(trim(COALESCE(p_title,''))) NOT BETWEEN 3 AND 120 OR
 length(trim(COALESCE(p_body,''))) NOT BETWEEN 3 AND 1500 THEN RAISE EXCEPTION 'PHASE2_INVALID_CONTENT'; END IF;
 IF p_kind NOT IN ('GENERAL','CONGRATULATION','ALERT') OR
 p_audience NOT IN ('SCHOOL','CLASS','STUDENT') OR p_kind IS NULL OR p_audience IS NULL THEN RAISE EXCEPTION 'PHASE2_INVALID_AUDIENCE';END IF;
 IF COALESCE(p_duration_days,0) NOT BETWEEN 1 AND 30 THEN RAISE EXCEPTION 'PHASE2_INVALID_DURATION';END IF;
 IF p_audience='SCHOOL' AND p_target_id IS NOT NULL THEN RAISE EXCEPTION 'PHASE2_INVALID_TARGET'; END IF;
 IF p_audience='CLASS' THEN
  SELECT c.id INTO v_class FROM public.classes c JOIN public.grades g ON g.id=c.grade_id JOIN public.departments dep ON dep.id=g.department_id JOIN public.academic_years ay ON ay.id=c.academic_year_id WHERE c.id=p_target_id AND dep.school_id=v_school AND ay.school_id=v_school AND c.is_active;
  IF v_class IS NULL THEN RAISE EXCEPTION 'PHASE2_INVALID_TARGET'; END IF;
 ELSIF p_audience='STUDENT' THEN
  SELECT id INTO v_student FROM public.students WHERE id=p_target_id AND school_id=v_school AND is_active;
  IF v_student IS NULL THEN RAISE EXCEPTION 'PHASE2_INVALID_TARGET'; END IF;
 END IF;
 IF p_id IS NOT NULL THEN
  UPDATE public.phase2_messages SET title_ar=trim(p_title),body_ar=trim(p_body),kind=p_kind,
   audience=p_audience,class_id=v_class,student_id=v_student,duration_days=p_duration_days,updated_at=now()
  WHERE id=p_id AND school_id=v_school AND status='DRAFT' RETURNING id INTO v_id;
  IF v_id IS NULL THEN RAISE EXCEPTION 'PHASE2_DRAFT_ONLY'; END IF;
 ELSE
  INSERT INTO public.phase2_messages(school_id,title_ar,body_ar,kind,audience,class_id,student_id,duration_days,created_by)
  VALUES(v_school,trim(p_title),trim(p_body),p_kind,p_audience,v_class,v_student,p_duration_days,v_user) RETURNING id INTO v_id;
 END IF;
 RETURN jsonb_build_object('id',v_id,'status','DRAFT');
END
$function$;

CREATE OR REPLACE FUNCTION public.api_phase2_set_message_status(p_id uuid, p_action text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_school uuid;v_row public.phase2_messages%ROWTYPE;
BEGIN
 v_school:=public.phase2_admin_school();
 SELECT * INTO v_row FROM public.phase2_messages WHERE id=p_id AND school_id=v_school FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'PHASE2_MESSAGE_NOT_FOUND'; END IF;
 IF p_action='PUBLISH' AND v_row.status='DRAFT' THEN
  IF v_row.audience='CLASS' AND NOT EXISTS(SELECT 1 FROM public.classes c JOIN public.grades g ON g.id=c.grade_id JOIN public.departments dep ON dep.id=g.department_id JOIN public.academic_years ay ON ay.id=c.academic_year_id WHERE c.id=v_row.class_id AND dep.school_id=v_school AND ay.school_id=v_school AND c.is_active) THEN RAISE EXCEPTION 'PHASE2_INVALID_TARGET';END IF;
  IF v_row.audience='STUDENT' AND NOT EXISTS(SELECT 1 FROM public.students WHERE id=v_row.student_id AND school_id=v_school AND is_active) THEN RAISE EXCEPTION 'PHASE2_INVALID_TARGET'; END IF;
  UPDATE public.phase2_messages SET status='PUBLISHED',published_at=now(),expires_at=now()+make_interval(days=>v_row.duration_days),updated_at=now() WHERE id=p_id;
 ELSIF p_action='ARCHIVE' AND v_row.status IN ('DRAFT','PUBLISHED') THEN
  UPDATE public.phase2_messages SET status='ARCHIVED',updated_at=now() WHERE id=p_id;
 ELSE RAISE EXCEPTION 'PHASE2_INVALID_STATUS_CHANGE'; END IF;
 RETURN jsonb_build_object('id',p_id,'status',CASE WHEN p_action='PUBLISH' THEN 'PUBLISHED' ELSE 'ARCHIVED' END);
END
$function$;

CREATE OR REPLACE FUNCTION public.api_phase2_student_experience()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_student public.students%ROWTYPE;v_auth uuid;
BEGIN
 v_auth:=NULLIF(NULLIF(auth.user_id(),''),'anonymous')::uuid;
 IF v_auth IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED';END IF;
 SELECT * INTO v_student FROM public.students WHERE auth_user_id=v_auth AND is_active LIMIT 1;
 IF NOT FOUND THEN RAISE EXCEPTION 'STUDENT_ACCOUNT_REQUIRED';END IF;
 RETURN jsonb_build_object('school_id',v_student.school_id,'student_id',v_student.id,
 'level',public.phase2_level_for_student(v_student.id),
 'messages',public.phase2_visible_messages(v_student.school_id,v_student.id,v_student.class_id));
END
$function$;

CREATE OR REPLACE FUNCTION public.phase2_admin_school()
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_auth uuid;v_user uuid;v_school uuid;
BEGIN
 v_auth:=NULLIF(NULLIF(auth.user_id(),''),'anonymous')::uuid;
 IF v_auth IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
 SELECT id,school_id INTO v_user,v_school FROM public.app_users WHERE auth_user_id=v_auth AND is_active LIMIT 1;
 IF v_user IS NULL OR NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=v_user
 AND role::text IN ('SUPER_ADMIN','SCHOOL_ADMIN','PRINCIPAL','GUIDANCE_COUNSELOR'))
 THEN RAISE EXCEPTION 'PHASE2_ADMIN_REQUIRED'; END IF;
 RETURN v_school;
END
$function$;

CREATE OR REPLACE FUNCTION public.phase2_level_for_student(p_student uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE earned bigint;points_bal bigint;v_school uuid;v_title text;v_min int;v_next int;v_next_name text;
BEGIN
 SELECT school_id INTO v_school FROM public.students WHERE id=p_student AND is_active LIMIT 1;
 IF v_school IS NULL THEN RETURN '{}'::jsonb; END IF;
 SELECT COALESCE(SUM(points_delta),0)::bigint INTO earned
 FROM public.wallet_transactions WHERE student_id=p_student AND school_id=v_school AND transaction_type::text IN ('EARN','BONUS','REVERSE');
 earned:=GREATEST(0,earned);
 SELECT COALESCE(points_balance,0) INTO points_bal FROM public.student_wallet_balances WHERE student_id=p_student AND school_id=v_school;
 points_bal:=COALESCE(points_bal,0);
 SELECT x.title,x.threshold INTO v_title,v_min FROM (VALUES
   (0,'بداية التميز'),(50,'البرونزي'),(100,'الفضي'),(200,'الذهبي'),
   (350,'البلاتيني'),(500,'الماسي'),(750,'سفير التميز')) x(threshold,title)
 WHERE x.threshold<=earned ORDER BY x.threshold DESC LIMIT 1;
 SELECT x.title,x.threshold INTO v_next_name,v_next FROM (VALUES
   (50,'البرونزي'),(100,'الفضي'),(200,'الذهبي'),(350,'البلاتيني'),
   (500,'الماسي'),(750,'سفير التميز')) x(threshold,title)
 WHERE x.threshold>earned ORDER BY x.threshold LIMIT 1;
 RETURN jsonb_build_object('name',v_title,'earned',earned,'balance',points_bal,
  'threshold',v_min,'next_name',v_next_name,'next_threshold',v_next,
  'remaining',CASE WHEN v_next IS NULL THEN 0 ELSE v_next-earned END,
  'percent',CASE WHEN v_next IS NULL THEN 100 ELSE GREATEST(0,LEAST(100,round(100.0*(earned-v_min)/NULLIF(v_next-v_min,0)))) END,
  'levels',jsonb_build_array(jsonb_build_object('name','البرونزي','points',50),
   jsonb_build_object('name','الفضي','points',100),jsonb_build_object('name','الذهبي','points',200),
   jsonb_build_object('name','البلاتيني','points',350),jsonb_build_object('name','الماسي','points',500),
   jsonb_build_object('name','سفير التميز','points',750)));
END
$function$;

CREATE OR REPLACE FUNCTION public.phase2_visible_messages(p_school uuid, p_student uuid, p_class uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
 SELECT COALESCE(jsonb_agg(to_jsonb(m) ORDER BY m.published_at DESC),'[]'::jsonb)
 FROM (
  SELECT id,title_ar,body_ar,kind,audience,published_at,expires_at FROM public.phase2_messages
  WHERE school_id=p_school AND status='PUBLISHED' AND published_at<=now() AND expires_at>now()
  AND ((audience='SCHOOL') OR (audience='CLASS' AND class_id=p_class)
    OR (audience='STUDENT' AND student_id=p_student))
  ORDER BY published_at DESC LIMIT 30
 ) m
$function$;

REVOKE ALL ON FUNCTION public.phase2_level_for_student(uuid),public.phase2_visible_messages(uuid,uuid,uuid),public.phase2_admin_school() FROM PUBLIC,authenticated;
GRANT EXECUTE ON FUNCTION public.api_phase2_admin_data(),public.api_phase2_save_draft(uuid,text,text,text,text,uuid,integer),public.api_phase2_set_message_status(uuid,text),public.api_phase2_guardian_experience(text,text),public.api_phase2_student_experience() TO PUBLIC,authenticated;

-- 2026-10-06
-- Enforce vice-principal class/stage scope on referral actions and notifications.

BEGIN;

CREATE OR REPLACE FUNCTION public.api_referral_deduct_points(
  p_referral_id uuid,
  p_points integer,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $deduct_scoped$
DECLARE
  v_auth uuid;
  v_user uuid;
  v_school uuid;
  v_job text;
  v_vice boolean:=false;
  v_guidance boolean:=false;
  v_ref public.student_referrals%ROWTYPE;
  v_balance integer;
BEGIN
  v_auth:=NULLIF(auth.user_id(),'')::uuid;
  SELECT id,school_id INTO v_user,v_school
  FROM public.app_users
  WHERE auth_user_id=v_auth AND is_active=true
  LIMIT 1;
  IF v_user IS NULL THEN RAISE EXCEPTION 'APP_USER_REQUIRED'; END IF;

  SELECT job_title_ar INTO v_job
  FROM public.staff_directory
  WHERE linked_app_user_id=v_user AND is_active=true
  ORDER BY updated_at DESC NULLS LAST
  LIMIT 1;

  IF v_job IS NOT NULL THEN
    v_vice:=v_job ILIKE '%وكيل%';
    v_guidance:=v_job='الموجه الطلابي';
  ELSE
    SELECT
      EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=v_user AND role='VICE_PRINCIPAL'),
      EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=v_user AND role='GUIDANCE_COUNSELOR')
    INTO v_vice,v_guidance;
  END IF;

  SELECT * INTO v_ref
  FROM public.student_referrals
  WHERE id=p_referral_id AND school_id=v_school
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'REFERRAL_NOT_FOUND'; END IF;
  IF v_ref.status<>'OPEN' THEN RAISE EXCEPTION 'REFERRAL_ALREADY_COMPLETED'; END IF;

  IF v_vice THEN
    IF v_ref.target_role<>'VICE_PRINCIPAL'
       OR NOT EXISTS(
         SELECT 1
         FROM public.teacher_class_assignments tca
         WHERE tca.user_id=v_user
           AND tca.class_id=v_ref.class_id
           AND tca.is_active=true
       )
    THEN
      RAISE EXCEPTION 'REFERRAL_STAGE_SCOPE_REQUIRED';
    END IF;
  ELSIF v_guidance THEN
    IF v_ref.target_role<>'GUIDANCE_COUNSELOR' THEN
      RAISE EXCEPTION 'REFERRAL_RECIPIENT_REQUIRED';
    END IF;
  ELSE
    RAISE EXCEPTION 'REFERRAL_RECIPIENT_REQUIRED';
  END IF;

  IF p_points IS NULL OR p_points<1 THEN RAISE EXCEPTION 'DEDUCTION_POINTS_INVALID'; END IF;
  IF v_ref.deducted_points>0 THEN RAISE EXCEPTION 'DEDUCTION_ALREADY_APPLIED'; END IF;

  SELECT COALESCE(points_balance,0)::int INTO v_balance
  FROM public.student_wallet_balances
  WHERE student_id=v_ref.student_id AND school_id=v_school;
  v_balance:=COALESCE(v_balance,0);

  IF p_points>v_balance THEN RAISE EXCEPTION 'INSUFFICIENT_STUDENT_POINTS'; END IF;

  INSERT INTO public.wallet_transactions(
    school_id,student_id,transaction_type,points_delta,actor_user_id,
    reference_type,reference_id,note
  )
  VALUES(
    v_school,v_ref.student_id,'CORRECTION',-p_points,v_user,
    'STUDENT_REFERRAL',v_ref.id,
    COALESCE(NULLIF(btrim(COALESCE(p_note,'')),''),'خصم نقاط بناءً على التحويل '||v_ref.referral_no)
  );

  UPDATE public.student_referrals
  SET deducted_points=p_points,
      deduction_note=COALESCE(NULLIF(btrim(COALESCE(p_note,'')),''),'خصم نقاط بناءً على التحويل'),
      deducted_by=v_user,
      deducted_at=now(),
      updated_at=now()
  WHERE id=v_ref.id;

  INSERT INTO public.audit_logs(
    school_id,actor_user_id,action,entity_type,entity_id,before_json,after_json
  )
  VALUES(
    v_school,v_user,'REFERRAL_DEDUCT_POINTS','student_referral',v_ref.id::text,
    jsonb_build_object('wallet_points',v_balance),
    jsonb_build_object('deducted_points',p_points,'wallet_points',v_balance-p_points)
  );

  RETURN jsonb_build_object(
    'ok',true,'referral_id',v_ref.id,'deducted_points',p_points,'new_balance',v_balance-p_points
  );
END;
$deduct_scoped$;

CREATE OR REPLACE FUNCTION public.api_complete_student_referral(
  p_referral_id uuid,
  p_completion_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $complete_scoped$
DECLARE
  v_auth uuid;
  v_user uuid;
  v_school uuid;
  v_job text;
  v_vice boolean:=false;
  v_guidance boolean:=false;
  v_ref public.student_referrals%ROWTYPE;
  v_note text;
  v_student_name text;
BEGIN
  v_auth:=NULLIF(auth.user_id(),'')::uuid;
  SELECT id,school_id INTO v_user,v_school
  FROM public.app_users
  WHERE auth_user_id=v_auth AND is_active=true
  LIMIT 1;
  IF v_user IS NULL THEN RAISE EXCEPTION 'APP_USER_REQUIRED'; END IF;

  SELECT job_title_ar INTO v_job
  FROM public.staff_directory
  WHERE linked_app_user_id=v_user AND is_active=true
  ORDER BY updated_at DESC NULLS LAST
  LIMIT 1;

  IF v_job IS NOT NULL THEN
    v_vice:=v_job ILIKE '%وكيل%';
    v_guidance:=v_job='الموجه الطلابي';
  ELSE
    SELECT
      EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=v_user AND role='VICE_PRINCIPAL'),
      EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=v_user AND role='GUIDANCE_COUNSELOR')
    INTO v_vice,v_guidance;
  END IF;

  SELECT * INTO v_ref
  FROM public.student_referrals
  WHERE id=p_referral_id AND school_id=v_school
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'REFERRAL_NOT_FOUND'; END IF;
  IF v_ref.status<>'OPEN' THEN RAISE EXCEPTION 'REFERRAL_ALREADY_COMPLETED'; END IF;

  IF v_vice THEN
    IF v_ref.target_role<>'VICE_PRINCIPAL'
       OR NOT EXISTS(
         SELECT 1
         FROM public.teacher_class_assignments tca
         WHERE tca.user_id=v_user
           AND tca.class_id=v_ref.class_id
           AND tca.is_active=true
       )
    THEN
      RAISE EXCEPTION 'REFERRAL_STAGE_SCOPE_REQUIRED';
    END IF;
  ELSIF v_guidance THEN
    IF v_ref.target_role<>'GUIDANCE_COUNSELOR' THEN
      RAISE EXCEPTION 'REFERRAL_RECIPIENT_REQUIRED';
    END IF;
  ELSE
    RAISE EXCEPTION 'REFERRAL_RECIPIENT_REQUIRED';
  END IF;

  v_note:=COALESCE(NULLIF(btrim(COALESCE(p_completion_note,'')),''),'تم اللازم واتخاذ الإجراء المناسب.');
  SELECT full_name_ar INTO v_student_name
  FROM public.students
  WHERE id=v_ref.student_id;

  UPDATE public.student_referrals
  SET status='COMPLETED',
      completion_note=v_note,
      completed_by=v_user,
      completed_at=now(),
      updated_at=now()
  WHERE id=v_ref.id;

  INSERT INTO public.notifications(
    school_id,recipient_user_id,title_ar,body_ar,type
  )
  VALUES(
    v_school,v_ref.created_by,
    'نتيجة تحويل الطالب',
    'تم إنهاء التحويل '||v_ref.referral_no||' للطالب '||COALESCE(v_student_name,'—')||'. نتيجة الإجراء: '||v_note,
    'STUDENT_REFERRAL_COMPLETED'
  );

  INSERT INTO public.audit_logs(
    school_id,actor_user_id,action,entity_type,entity_id,after_json
  )
  VALUES(
    v_school,v_user,'COMPLETE_STUDENT_REFERRAL','student_referral',v_ref.id::text,
    jsonb_build_object(
      'status','COMPLETED',
      'completion_note',v_note,
      'deducted_points',v_ref.deducted_points,
      'teacher_notified',true
    )
  );

  RETURN jsonb_build_object(
    'ok',true,'referral_id',v_ref.id,'status','COMPLETED','completed_at',now(),'teacher_notified',true
  );
END;
$complete_scoped$;

CREATE OR REPLACE FUNCTION public.api_forward_returned_referral_to_vice(
  p_referral_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $forward_scoped$
DECLARE
  v_auth uuid;
  v_user uuid;
  v_school uuid;
  v_job text;
  v_teacher boolean:=false;
  v_ref public.student_referrals%ROWTYPE;
  v_returned boolean:=false;
BEGIN
  v_auth:=NULLIF(auth.user_id(),'')::uuid;
  SELECT id,school_id INTO v_user,v_school
  FROM public.app_users
  WHERE auth_user_id=v_auth AND is_active=true
  LIMIT 1;
  IF v_user IS NULL THEN RAISE EXCEPTION 'APP_USER_REQUIRED'; END IF;

  SELECT job_title_ar INTO v_job
  FROM public.staff_directory
  WHERE linked_app_user_id=v_user AND is_active=true
  ORDER BY updated_at DESC NULLS LAST
  LIMIT 1;

  IF v_job IS NOT NULL THEN
    v_teacher:=v_job='معلم';
  ELSE
    v_teacher:=EXISTS(
      SELECT 1 FROM public.user_roles
      WHERE user_id=v_user AND role='TEACHER'
    );
  END IF;

  IF NOT v_teacher THEN RAISE EXCEPTION 'TEACHER_REFERRAL_REQUIRED'; END IF;

  SELECT * INTO v_ref
  FROM public.student_referrals
  WHERE id=p_referral_id AND school_id=v_school
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'REFERRAL_NOT_FOUND'; END IF;
  IF v_ref.status<>'OPEN' THEN RAISE EXCEPTION 'REFERRAL_ALREADY_COMPLETED'; END IF;
  IF v_ref.created_by<>v_user THEN RAISE EXCEPTION 'REFERRAL_OWNER_REQUIRED'; END IF;
  IF v_ref.target_role<>'GUIDANCE_COUNSELOR' THEN RAISE EXCEPTION 'REFERRAL_NOT_RETURNED_TO_TEACHER'; END IF;

  SELECT EXISTS(
    SELECT 1
    FROM public.audit_logs al
    WHERE al.school_id=v_school
      AND al.entity_type='student_referral'
      AND al.entity_id=v_ref.id::text
      AND al.action='RETURN_STUDENT_REFERRAL_TO_TEACHER'
      AND al.created_at > COALESCE((
        SELECT max(f.created_at)
        FROM public.audit_logs f
        WHERE f.school_id=v_school
          AND f.entity_type='student_referral'
          AND f.entity_id=v_ref.id::text
          AND f.action='FORWARD_RETURNED_REFERRAL_TO_VICE'
      ),'epoch'::timestamptz)
  ) INTO v_returned;

  IF NOT v_returned THEN RAISE EXCEPTION 'REFERRAL_NOT_RETURNED_TO_TEACHER'; END IF;

  UPDATE public.student_referrals
  SET target_role='VICE_PRINCIPAL',updated_at=now()
  WHERE id=v_ref.id;

  -- Notify only the vice principal whose assigned classes include this referral class.
  INSERT INTO public.notifications(
    school_id,recipient_user_id,title_ar,body_ar,type
  )
  SELECT DISTINCT
    v_school,
    au.id,
    'تحويل طالب للوكيل',
    'تم تحويل الطالب في التحويل '||v_ref.referral_no||' إليك بعد إعادته من الموجه الطلابي.',
    'STUDENT_REFERRAL_TO_VICE'
  FROM public.app_users au
  LEFT JOIN public.staff_directory sd
    ON sd.linked_app_user_id=au.id AND sd.is_active=true
  WHERE au.school_id=v_school
    AND au.is_active=true
    AND (
      sd.job_title_ar ILIKE '%وكيل%'
      OR EXISTS(
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id=au.id AND ur.role='VICE_PRINCIPAL'
      )
    )
    AND EXISTS(
      SELECT 1
      FROM public.teacher_class_assignments tca
      WHERE tca.user_id=au.id
        AND tca.class_id=v_ref.class_id
        AND tca.is_active=true
    );

  INSERT INTO public.audit_logs(
    school_id,actor_user_id,action,entity_type,entity_id,before_json,after_json
  )
  VALUES(
    v_school,v_user,'FORWARD_RETURNED_REFERRAL_TO_VICE','student_referral',v_ref.id::text,
    jsonb_build_object('target_role',v_ref.target_role,'routing_state','RETURNED_TO_TEACHER'),
    jsonb_build_object('target_role','VICE_PRINCIPAL','routing_state','WITH_VICE_PRINCIPAL')
  );

  RETURN jsonb_build_object(
    'ok',true,'referral_id',v_ref.id,'target_role','VICE_PRINCIPAL','forwarded_at',now()
  );
END;
$forward_scoped$;

GRANT EXECUTE ON FUNCTION public.api_referral_deduct_points(uuid,integer,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.api_complete_student_referral(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.api_forward_returned_referral_to_vice(uuid) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
SELECT pg_notify('pgrst','reload schema');

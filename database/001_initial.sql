-- بنك التميز الطلابي — مدارس المشكاة الأهلية
-- PostgreSQL / Neon initial schema v1
-- Authentication is provided by Neon Auth (better-auth); app_users links to neon_auth user ids.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE app_role AS ENUM (
  'SUPER_ADMIN','SCHOOL_ADMIN','PRINCIPAL','VICE_PRINCIPAL',
  'GUIDANCE_COUNSELOR','TEACHER','REWARD_OFFICER','STUDENT','GUARDIAN'
);
CREATE TYPE check_status AS ENUM ('PENDING','ISSUED','REDEEMED','CANCELLED','EXPIRED','REVERSED');
CREATE TYPE transaction_type AS ENUM ('EARN','REDEEM','REVERSE','BONUS','CORRECTION');
CREATE TYPE approval_status AS ENUM ('NOT_REQUIRED','PENDING','APPROVED','REJECTED');
CREATE TYPE competition_status AS ENUM ('DRAFT','ACTIVE','FROZEN','APPROVED','CLOSED');
CREATE TYPE reward_redemption_status AS ENUM ('PENDING','APPROVED','FULFILLED','REJECTED','CANCELLED');
CREATE TYPE metric_source AS ENUM ('AUTO_POINTS','MANUAL_PERCENT','MANUAL_SCORE','DEDUCTION');

-- =============== SCHOOL STRUCTURE ===============
CREATE TABLE schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar text NOT NULL,
  code text UNIQUE NOT NULL,
  point_value_sar numeric(10,2) NOT NULL DEFAULT 2.00 CHECK(point_value_sar >= 0),
  logo_url text,
  guidance_logo_url text,
  rights_holder_ar text NOT NULL DEFAULT 'مدارس المشكاة الأهلية',
  developer_credit_ar text NOT NULL DEFAULT 'برمجة وتنفيذ: محمد صلاح الدين محمد الجمل',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE academic_years (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  starts_on date,
  ends_on date,
  is_current boolean NOT NULL DEFAULT false,
  UNIQUE(school_id, name)
);

CREATE TABLE terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year_id uuid NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  name text NOT NULL,
  starts_on date,
  ends_on date,
  is_current boolean NOT NULL DEFAULT false,
  UNIQUE(academic_year_id, name)
);

CREATE TABLE departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name_ar text NOT NULL,
  gender text CHECK(gender IN ('BOYS','GIRLS','MIXED')) DEFAULT 'BOYS',
  UNIQUE(school_id, name_ar)
);

CREATE TABLE grades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  name_ar text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  UNIQUE(department_id, name_ar)
);

CREATE TABLE classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grade_id uuid NOT NULL REFERENCES grades(id) ON DELETE CASCADE,
  academic_year_id uuid NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  name_ar text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  UNIQUE(grade_id, academic_year_id, name_ar)
);

-- =============== USERS & STUDENTS ===============
CREATE TABLE app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  auth_user_id uuid UNIQUE,
  full_name_ar text NOT NULL,
  email text,
  mobile text,
  employee_no text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(school_id, email)
);

CREATE TABLE user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  department_id uuid REFERENCES departments(id) ON DELETE CASCADE,
  class_id uuid REFERENCES classes(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX user_roles_unique_scope_idx
ON user_roles(user_id, role, COALESCE(department_id,'00000000-0000-0000-0000-000000000000'::uuid), COALESCE(class_id,'00000000-0000-0000-0000-000000000000'::uuid));

CREATE TABLE students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_no text NOT NULL,
  full_name_ar text NOT NULL,
  class_id uuid NOT NULL REFERENCES classes(id),
  auth_user_id uuid UNIQUE,
  photo_url text,
  is_active boolean NOT NULL DEFAULT true,
  joined_at date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(school_id, student_no)
);
CREATE INDEX students_class_idx ON students(class_id, is_active);

CREATE TABLE guardians (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  full_name_ar text NOT NULL,
  mobile text,
  email text,
  auth_user_id uuid UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE student_guardians (
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  guardian_id uuid NOT NULL REFERENCES guardians(id) ON DELETE CASCADE,
  relationship text,
  is_primary boolean NOT NULL DEFAULT false,
  PRIMARY KEY(student_id, guardian_id)
);

-- =============== POINT RULES / CHECKS ===============
CREATE TABLE reward_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name_ar text NOT NULL,
  icon_key text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  UNIQUE(school_id, name_ar)
);

CREATE TABLE point_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  category_id uuid REFERENCES reward_categories(id),
  name_ar text NOT NULL,
  description_ar text,
  default_points int NOT NULL CHECK(default_points > 0),
  min_points int NOT NULL DEFAULT 1 CHECK(min_points > 0),
  max_points int NOT NULL CHECK(max_points >= min_points),
  requires_approval boolean NOT NULL DEFAULT false,
  is_mega boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  CHECK(default_points BETWEEN min_points AND max_points),
  UNIQUE(school_id, name_ar)
);

CREATE TABLE point_rule_allowed_roles (
  rule_id uuid NOT NULL REFERENCES point_rules(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  PRIMARY KEY(rule_id, role)
);

CREATE TABLE issuer_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  term_id uuid NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
  monthly_limit int NOT NULL CHECK(monthly_limit >= 0),
  is_unlimited boolean NOT NULL DEFAULT false,
  UNIQUE(user_id, term_id)
);

CREATE SEQUENCE excellence_check_serial_seq START 1000;

CREATE TABLE excellence_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id),
  rule_id uuid REFERENCES point_rules(id),
  points int NOT NULL CHECK(points > 0),
  reason_ar text NOT NULL,
  issued_by uuid NOT NULL REFERENCES app_users(id),
  approval_status approval_status NOT NULL DEFAULT 'NOT_REQUIRED',
  approved_by uuid REFERENCES app_users(id),
  approved_at timestamptz,
  status check_status NOT NULL DEFAULT 'ISSUED',
  qr_nonce uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  serial_no text NOT NULL UNIQUE DEFAULT ('EX-' || to_char(current_date,'YYYY') || '-' || lpad(nextval('excellence_check_serial_seq')::text, 7, '0')),
  notes text,
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  redeemed_at timestamptz,
  reversed_at timestamptz,
  reversal_reason text
);
CREATE INDEX checks_student_idx ON excellence_checks(student_id, issued_at DESC);
CREATE INDEX checks_issuer_idx ON excellence_checks(issued_by, issued_at DESC);
CREATE INDEX checks_qr_idx ON excellence_checks(qr_nonce);

-- Ledger is authoritative. Balance is SUM(points_delta), never a manually editable balance field.
CREATE TABLE wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id),
  transaction_type transaction_type NOT NULL,
  points_delta int NOT NULL CHECK(points_delta <> 0),
  check_id uuid REFERENCES excellence_checks(id),
  actor_user_id uuid REFERENCES app_users(id),
  reference_type text,
  reference_id uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX wallet_student_idx ON wallet_transactions(student_id, created_at DESC);
CREATE UNIQUE INDEX wallet_one_earn_per_check_idx ON wallet_transactions(check_id)
WHERE check_id IS NOT NULL AND transaction_type='EARN';

CREATE VIEW student_wallet_balances AS
SELECT school_id, student_id, COALESCE(SUM(points_delta),0)::bigint AS points_balance
FROM wallet_transactions
GROUP BY school_id, student_id;

-- Prevent history tampering. Corrections are new ledger rows; existing rows are immutable.
CREATE FUNCTION prevent_wallet_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'wallet_transactions is append-only';
END; $$;
CREATE TRIGGER wallet_no_update BEFORE UPDATE OR DELETE ON wallet_transactions
FOR EACH ROW EXECUTE FUNCTION prevent_wallet_mutation();

-- =============== REWARDS / STORE ===============
CREATE TABLE rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name_ar text NOT NULL,
  description_ar text,
  cost_points int NOT NULL CHECK(cost_points > 0),
  cash_value_sar numeric(10,2) CHECK(cash_value_sar IS NULL OR cash_value_sar >= 0),
  stock int CHECK(stock IS NULL OR stock >= 0),
  image_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id),
  reward_id uuid NOT NULL REFERENCES rewards(id),
  points_cost int NOT NULL CHECK(points_cost > 0),
  quantity int NOT NULL DEFAULT 1 CHECK(quantity > 0),
  status reward_redemption_status NOT NULL DEFAULT 'PENDING',
  requested_at timestamptz NOT NULL DEFAULT now(),
  approved_by uuid REFERENCES app_users(id),
  fulfilled_by uuid REFERENCES app_users(id),
  fulfilled_at timestamptz,
  notes text
);
CREATE INDEX redemptions_student_idx ON redemptions(student_id, requested_at DESC);

-- =============== BADGES / LEVELS ===============
CREATE TABLE levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name_ar text NOT NULL,
  min_points int NOT NULL CHECK(min_points >= 0),
  icon_key text,
  sort_order int NOT NULL DEFAULT 0,
  UNIQUE(school_id, name_ar)
);

CREATE TABLE badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name_ar text NOT NULL,
  description_ar text,
  icon_key text,
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE student_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  badge_id uuid NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  awarded_by uuid REFERENCES app_users(id),
  awarded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(student_id, badge_id)
);

-- =============== CHALLENGES ===============
CREATE TABLE challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  term_id uuid REFERENCES terms(id),
  name_ar text NOT NULL,
  description_ar text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  reward_points int NOT NULL DEFAULT 0 CHECK(reward_points >= 0),
  created_by uuid REFERENCES app_users(id),
  is_active boolean NOT NULL DEFAULT true,
  CHECK(ends_at > starts_at)
);

CREATE TABLE challenge_participants (
  challenge_id uuid NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  progress numeric(8,2) NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  PRIMARY KEY(challenge_id, student_id)
);

-- =============== KHAMEESNA GHAIR / CLASS COMPETITIONS ===============
CREATE TABLE competitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  term_id uuid NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
  name_ar text NOT NULL,
  slug text NOT NULL,
  description_ar text,
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  reward_text_ar text NOT NULL DEFAULT 'رحلة ترفيهية يوم الخميس للفصل المتميز',
  status competition_status NOT NULL DEFAULT 'DRAFT',
  prevent_consecutive_winner boolean NOT NULL DEFAULT false,
  minimum_attendance_pct numeric(5,2) DEFAULT 95.00,
  maximum_serious_violations int DEFAULT 0,
  created_by uuid REFERENCES app_users(id),
  approved_by uuid REFERENCES app_users(id),
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK(ends_on >= starts_on),
  UNIQUE(school_id, term_id, slug)
);

CREATE TABLE competition_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  metric_key text NOT NULL,
  label_ar text NOT NULL,
  source metric_source NOT NULL,
  weight numeric(5,2) NOT NULL CHECK(weight >= 0 AND weight <= 100),
  max_score numeric(8,2) NOT NULL DEFAULT 100 CHECK(max_score > 0),
  sort_order int NOT NULL DEFAULT 0,
  UNIQUE(competition_id, metric_key)
);

CREATE TABLE competition_class_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES classes(id),
  student_count int NOT NULL DEFAULT 0 CHECK(student_count >= 0),
  raw_points int NOT NULL DEFAULT 0,
  avg_points numeric(10,2) NOT NULL DEFAULT 0,
  serious_violations int NOT NULL DEFAULT 0 CHECK(serious_violations >= 0),
  eligible boolean NOT NULL DEFAULT true,
  ineligible_reason text,
  final_score numeric(8,3),
  rank int,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(competition_id, class_id)
);

CREATE TABLE competition_metric_values (
  entry_id uuid NOT NULL REFERENCES competition_class_entries(id) ON DELETE CASCADE,
  metric_id uuid NOT NULL REFERENCES competition_metrics(id) ON DELETE CASCADE,
  raw_value numeric(10,3) NOT NULL DEFAULT 0,
  normalized_score numeric(10,3) NOT NULL DEFAULT 0,
  weighted_score numeric(10,3) NOT NULL DEFAULT 0,
  note text,
  PRIMARY KEY(entry_id, metric_id)
);

CREATE TABLE competition_winners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid NOT NULL UNIQUE REFERENCES competitions(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES classes(id),
  final_score numeric(8,3) NOT NULL,
  approved_by uuid NOT NULL REFERENCES app_users(id),
  approved_at timestamptz NOT NULL DEFAULT now(),
  trip_date date,
  trip_title_ar text DEFAULT 'خميسنا غير',
  notes text
);

CREATE TABLE annual_class_league (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year_id uuid NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  championship_points int NOT NULL DEFAULT 0,
  wins int NOT NULL DEFAULT 0,
  second_places int NOT NULL DEFAULT 0,
  third_places int NOT NULL DEFAULT 0,
  UNIQUE(academic_year_id, class_id)
);

-- =============== NOTIFICATIONS / AUDIT ===============
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  recipient_user_id uuid REFERENCES app_users(id) ON DELETE CASCADE,
  recipient_student_id uuid REFERENCES students(id) ON DELETE CASCADE,
  title_ar text NOT NULL,
  body_ar text NOT NULL,
  type text NOT NULL DEFAULT 'INFO',
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
  id bigserial PRIMARY KEY,
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES app_users(id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  before_json jsonb,
  after_json jsonb,
  ip inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_school_time_idx ON audit_logs(school_id, created_at DESC);

-- =============== TRANSACTIONAL FUNCTIONS ===============
CREATE OR REPLACE FUNCTION student_points_balance(p_student_id uuid)
RETURNS bigint LANGUAGE sql STABLE AS $$
  SELECT COALESCE(SUM(points_delta),0)::bigint
  FROM wallet_transactions WHERE student_id = p_student_id;
$$;

CREATE OR REPLACE FUNCTION issue_excellence_check(
  p_school_id uuid,
  p_student_id uuid,
  p_rule_id uuid,
  p_points int,
  p_reason_ar text,
  p_issued_by uuid,
  p_notes text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_rule point_rules%ROWTYPE;
  v_check_id uuid;
  v_requires_approval boolean;
BEGIN
  SELECT * INTO v_rule FROM point_rules WHERE id=p_rule_id AND school_id=p_school_id AND is_active=true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Point rule not found or inactive'; END IF;
  IF p_points < v_rule.min_points OR p_points > v_rule.max_points THEN
    RAISE EXCEPTION 'Points outside allowed range';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN point_rule_allowed_roles ar ON ar.role=ur.role AND ar.rule_id=p_rule_id
    WHERE ur.user_id=p_issued_by
  ) THEN
    RAISE EXCEPTION 'Issuer is not allowed to use this point rule';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM students s WHERE s.id=p_student_id AND s.school_id=p_school_id AND s.is_active=true) THEN
    RAISE EXCEPTION 'Student not found or inactive';
  END IF;

  v_requires_approval := v_rule.requires_approval;
  INSERT INTO excellence_checks(
    school_id,student_id,rule_id,points,reason_ar,issued_by,approval_status,status,notes
  ) VALUES (
    p_school_id,p_student_id,p_rule_id,p_points,p_reason_ar,p_issued_by,
    CASE WHEN v_requires_approval THEN 'PENDING'::approval_status ELSE 'NOT_REQUIRED'::approval_status END,
    CASE WHEN v_requires_approval THEN 'PENDING'::check_status ELSE 'ISSUED'::check_status END,
    p_notes
  ) RETURNING id INTO v_check_id;

  IF NOT v_requires_approval THEN
    INSERT INTO wallet_transactions(school_id,student_id,transaction_type,points_delta,check_id,actor_user_id,note)
    VALUES(p_school_id,p_student_id,'EARN',p_points,v_check_id,p_issued_by,p_reason_ar);
  END IF;

  INSERT INTO audit_logs(school_id,actor_user_id,action,entity_type,entity_id,after_json)
  VALUES(p_school_id,p_issued_by,'ISSUE_CHECK','excellence_check',v_check_id::text,
    jsonb_build_object('student_id',p_student_id,'points',p_points,'reason',p_reason_ar));
  RETURN v_check_id;
END; $$;

CREATE OR REPLACE FUNCTION approve_excellence_check(p_check_id uuid, p_approved_by uuid)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_check excellence_checks%ROWTYPE;
BEGIN
  SELECT * INTO v_check FROM excellence_checks WHERE id=p_check_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Check not found'; END IF;
  IF v_check.approval_status <> 'PENDING' THEN RAISE EXCEPTION 'Check is not pending approval'; END IF;
  UPDATE excellence_checks SET approval_status='APPROVED', status='ISSUED', approved_by=p_approved_by, approved_at=now()
  WHERE id=p_check_id;
  INSERT INTO wallet_transactions(school_id,student_id,transaction_type,points_delta,check_id,actor_user_id,note)
  VALUES(v_check.school_id,v_check.student_id,'EARN',v_check.points,v_check.id,p_approved_by,v_check.reason_ar);
  INSERT INTO audit_logs(school_id,actor_user_id,action,entity_type,entity_id)
  VALUES(v_check.school_id,p_approved_by,'APPROVE_CHECK','excellence_check',p_check_id::text);
END; $$;

CREATE OR REPLACE FUNCTION reverse_excellence_check(p_check_id uuid, p_actor uuid, p_reason text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_check excellence_checks%ROWTYPE;
BEGIN
  SELECT * INTO v_check FROM excellence_checks WHERE id=p_check_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Check not found'; END IF;
  IF v_check.status NOT IN ('ISSUED','REDEEMED') THEN RAISE EXCEPTION 'Check cannot be reversed in current state'; END IF;
  IF EXISTS(SELECT 1 FROM wallet_transactions WHERE check_id=p_check_id AND transaction_type='EARN') THEN
    INSERT INTO wallet_transactions(school_id,student_id,transaction_type,points_delta,check_id,actor_user_id,note)
    VALUES(v_check.school_id,v_check.student_id,'REVERSE',-v_check.points,NULL,p_actor,'عكس شيك: '||COALESCE(p_reason,''));
  END IF;
  UPDATE excellence_checks SET status='REVERSED', reversed_at=now(), reversal_reason=p_reason WHERE id=p_check_id;
  INSERT INTO audit_logs(school_id,actor_user_id,action,entity_type,entity_id,after_json)
  VALUES(v_check.school_id,p_actor,'REVERSE_CHECK','excellence_check',p_check_id::text,jsonb_build_object('reason',p_reason));
END; $$;

CREATE OR REPLACE FUNCTION redeem_reward(p_student_id uuid, p_reward_id uuid, p_quantity int, p_actor uuid)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
  v_reward rewards%ROWTYPE;
  v_cost int;
  v_balance bigint;
  v_redemption_id uuid;
BEGIN
  IF p_quantity <= 0 THEN RAISE EXCEPTION 'Quantity must be positive'; END IF;
  SELECT * INTO v_reward FROM rewards WHERE id=p_reward_id AND is_active=true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reward not found or inactive'; END IF;
  v_cost := v_reward.cost_points * p_quantity;
  v_balance := student_points_balance(p_student_id);
  IF v_balance < v_cost THEN RAISE EXCEPTION 'Insufficient points'; END IF;
  IF v_reward.stock IS NOT NULL AND v_reward.stock < p_quantity THEN RAISE EXCEPTION 'Insufficient reward stock'; END IF;

  INSERT INTO redemptions(school_id,student_id,reward_id,points_cost,quantity,status,approved_by,fulfilled_by,fulfilled_at)
  VALUES(v_reward.school_id,p_student_id,p_reward_id,v_cost,p_quantity,'FULFILLED',p_actor,p_actor,now())
  RETURNING id INTO v_redemption_id;

  INSERT INTO wallet_transactions(school_id,student_id,transaction_type,points_delta,actor_user_id,reference_type,reference_id,note)
  VALUES(v_reward.school_id,p_student_id,'REDEEM',-v_cost,p_actor,'redemption',v_redemption_id,'استبدال مكافأة: '||v_reward.name_ar);

  IF v_reward.stock IS NOT NULL THEN UPDATE rewards SET stock=stock-p_quantity WHERE id=p_reward_id; END IF;
  INSERT INTO audit_logs(school_id,actor_user_id,action,entity_type,entity_id,after_json)
  VALUES(v_reward.school_id,p_actor,'REDEEM_REWARD','redemption',v_redemption_id::text,jsonb_build_object('points',v_cost,'quantity',p_quantity));
  RETURN v_redemption_id;
END; $$;

-- =============== SEED: MISHKAT DEFAULTS ===============
INSERT INTO schools(name_ar,code,point_value_sar,logo_url,guidance_logo_url)
VALUES('مدارس المشكاة الأهلية','MISHKAT',2.00,'/school-logo.png','/guidance-logo.png');

WITH s AS (SELECT id FROM schools WHERE code='MISHKAT')
INSERT INTO academic_years(school_id,name,is_current)
SELECT id,'1448 هـ',true FROM s;

WITH s AS (SELECT id FROM schools WHERE code='MISHKAT')
INSERT INTO departments(school_id,name_ar,gender)
SELECT id,'متوسطة مشكاة الشعلة','BOYS' FROM s
UNION ALL SELECT id,'ثانوية مشكاة الشعلة','BOYS' FROM s;

WITH s AS (SELECT id FROM schools WHERE code='MISHKAT')
INSERT INTO reward_categories(school_id,name_ar,icon_key,sort_order)
SELECT id,'الواجبات','book-check',1 FROM s
UNION ALL SELECT id,'المشاركة','hand-up',2 FROM s
UNION ALL SELECT id,'السلوك الإيجابي','heart',3 FROM s
UNION ALL SELECT id,'الحضور والانضباط','calendar-check',4 FROM s
UNION ALL SELECT id,'التحسن الدراسي','trend-up',5 FROM s
UNION ALL SELECT id,'المبادرات والأنشطة','sparkles',6 FROM s
UNION ALL SELECT id,'تميز إداري','crown',7 FROM s;

WITH s AS (SELECT id FROM schools WHERE code='MISHKAT'),
cat AS (SELECT id,name_ar,school_id FROM reward_categories WHERE school_id=(SELECT id FROM s))
INSERT INTO point_rules(school_id,category_id,name_ar,default_points,min_points,max_points,requires_approval,is_mega,sort_order)
SELECT s.id,(SELECT id FROM cat WHERE name_ar='الواجبات'),'إنجاز الواجب',2,1,2,false,false,1 FROM s
UNION ALL SELECT s.id,(SELECT id FROM cat WHERE name_ar='المشاركة'),'مشاركة متميزة',2,1,3,false,false,2 FROM s
UNION ALL SELECT s.id,(SELECT id FROM cat WHERE name_ar='السلوك الإيجابي'),'سلوك إيجابي متميز',5,3,5,false,false,3 FROM s
UNION ALL SELECT s.id,(SELECT id FROM cat WHERE name_ar='الحضور والانضباط'),'حضور وانضباط متميز',5,3,5,false,false,4 FROM s
UNION ALL SELECT s.id,(SELECT id FROM cat WHERE name_ar='التحسن الدراسي'),'تحسن دراسي ملحوظ',5,5,10,false,false,5 FROM s
UNION ALL SELECT s.id,(SELECT id FROM cat WHERE name_ar='المبادرات والأنشطة'),'مبادرة أو نشاط متميز',10,5,15,false,false,6 FROM s
UNION ALL SELECT s.id,(SELECT id FROM cat WHERE name_ar='تميز إداري'),'شيك التميز العملاق',40,40,40,false,true,7 FROM s;

INSERT INTO point_rule_allowed_roles(rule_id,role)
SELECT pr.id, r.role::app_role
FROM point_rules pr
CROSS JOIN LATERAL unnest(
  CASE WHEN pr.is_mega
    THEN ARRAY['PRINCIPAL','VICE_PRINCIPAL','GUIDANCE_COUNSELOR']::text[]
    ELSE ARRAY['PRINCIPAL','VICE_PRINCIPAL','GUIDANCE_COUNSELOR','TEACHER']::text[]
  END
) AS r(role);

WITH s AS (SELECT id FROM schools WHERE code='MISHKAT')
INSERT INTO levels(school_id,name_ar,min_points,icon_key,sort_order)
SELECT id,'مبتدئ',0,'seedling',1 FROM s
UNION ALL SELECT id,'متميز',20,'star',2 FROM s
UNION ALL SELECT id,'برونزي',50,'medal-bronze',3 FROM s
UNION ALL SELECT id,'فضي',100,'medal-silver',4 FROM s
UNION ALL SELECT id,'ذهبي',200,'medal-gold',5 FROM s
UNION ALL SELECT id,'بلاتيني',350,'gem',6 FROM s
UNION ALL SELECT id,'سفير التميز',500,'crown',7 FROM s;

WITH s AS (SELECT id FROM schools WHERE code='MISHKAT')
INSERT INTO rewards(school_id,name_ar,description_ar,cost_points,cash_value_sar,stock)
SELECT id,'قسيمة بقيمة 20 ريال','قسيمة مكافأة معتمدة من المدرسة',10,20,NULL FROM s
UNION ALL SELECT id,'قسيمة بقيمة 50 ريال','قسيمة مكافأة معتمدة من المدرسة',25,50,NULL FROM s
UNION ALL SELECT id,'شهادة تميز إلكترونية','شهادة باسم الطالب من بنك التميز',10,NULL,NULL FROM s
UNION ALL SELECT id,'هدية مدرسية','هدية من متجر التميز',15,NULL,100 FROM s;

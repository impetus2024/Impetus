


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."attendance_status" AS ENUM (
    'present',
    'absent'
);


ALTER TYPE "public"."attendance_status" OWNER TO "postgres";


CREATE TYPE "public"."five_s_answer_scale" AS ENUM (
    'rarely',
    'sometimes',
    'frequently',
    'always'
);


ALTER TYPE "public"."five_s_answer_scale" OWNER TO "postgres";


CREATE TYPE "public"."five_s_category" AS ENUM (
    'speed',
    'stamina',
    'strength',
    'spirit',
    'skill'
);


ALTER TYPE "public"."five_s_category" OWNER TO "postgres";


CREATE TYPE "public"."gate_pass_action" AS ENUM (
    'check_in',
    'check_out'
);


ALTER TYPE "public"."gate_pass_action" OWNER TO "postgres";


CREATE TYPE "public"."user_role" AS ENUM (
    'super_admin',
    'centre_admin',
    'coach',
    'medical',
    'parent'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."five_s_results_snapshot_previous"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if new.score is distinct from old.score then
    new.previous_score := old.score;
    new.previous_recorded_at := old.recorded_at;
    new.recorded_at := now();
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."five_s_results_snapshot_previous"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_auth_user_sync"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.profiles (id, role, centre_id, full_name, email)
  values (
    new.id,
    coalesce((new.raw_app_meta_data ->> 'role')::public.user_role, 'parent'),
    nullif(new.raw_app_meta_data ->> 'centre_id', '')::uuid,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.email
  )
  on conflict (id) do update set
    role = excluded.role,
    centre_id = excluded.centre_id,
    full_name = excluded.full_name,
    email = excluded.email;
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_auth_user_sync"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_role_escalation"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if private.user_role() = 'centre_admin'
     and (new.role is distinct from old.role or new.centre_id is distinct from old.centre_id) then
    raise exception 'Only a super admin can change a profile''s role or centre.';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."prevent_role_escalation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."age_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "centre_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."age_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."attendance" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "batch_id" "uuid" NOT NULL,
    "player_id" "uuid" NOT NULL,
    "attendance_date" "date" NOT NULL,
    "status" "public"."attendance_status" NOT NULL,
    "marked_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."attendance" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."batches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "centre_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "head_coach_id" "uuid" NOT NULL,
    "player_type_id" "uuid",
    "age_category_id" "uuid" NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."batches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."centres" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "contact_number" "text" NOT NULL,
    "email" "text" NOT NULL,
    "logo_path" "text",
    "country" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "five_s_window_start" "date",
    "five_s_window_end" "date",
    CONSTRAINT "five_s_window_valid_range" CHECK ((("five_s_window_start" IS NULL) OR ("five_s_window_end" IS NULL) OR ("five_s_window_end" >= "five_s_window_start")))
);


ALTER TABLE "public"."centres" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."five_s_category_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "player_id" "uuid" NOT NULL,
    "category" "public"."five_s_category" NOT NULL,
    "centre_id" "uuid" NOT NULL,
    "remarks" "text" NOT NULL,
    "recorded_by" "uuid" NOT NULL,
    "recorded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."five_s_category_notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."five_s_group_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "player_id" "uuid" NOT NULL,
    "category" "public"."five_s_category" NOT NULL,
    "group_name" "text" NOT NULL,
    "centre_id" "uuid" NOT NULL,
    "remarks" "text" NOT NULL,
    "recorded_by" "uuid" NOT NULL,
    "recorded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."five_s_group_notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."five_s_question_responses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "player_id" "uuid" NOT NULL,
    "question_id" "uuid" NOT NULL,
    "centre_id" "uuid" NOT NULL,
    "answer" "public"."five_s_answer_scale" NOT NULL,
    "recorded_by" "uuid" NOT NULL,
    "recorded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."five_s_question_responses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."five_s_questions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "category" "public"."five_s_category" NOT NULL,
    "section" "text" NOT NULL,
    "question" "text" NOT NULL,
    "display_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."five_s_questions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."five_s_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "player_id" "uuid" NOT NULL,
    "centre_id" "uuid" NOT NULL,
    "published_by" "uuid" NOT NULL,
    "published_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."five_s_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."five_s_results" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "player_id" "uuid" NOT NULL,
    "test_id" "uuid" NOT NULL,
    "centre_id" "uuid" NOT NULL,
    "score" numeric(6,2) NOT NULL,
    "recorded_by" "uuid" NOT NULL,
    "recorded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "vo2_max" numeric(6,2),
    "remarks" "text",
    "previous_score" numeric(6,2),
    "previous_recorded_at" timestamp with time zone
);


ALTER TABLE "public"."five_s_results" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."five_s_tests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "category" "public"."five_s_category" NOT NULL,
    "name" "text" NOT NULL,
    "unit" "text" NOT NULL,
    "display_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "group_name" "text",
    "is_required" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."five_s_tests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."gate_pass_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "player_id" "uuid" NOT NULL,
    "centre_id" "uuid" NOT NULL,
    "action" "public"."gate_pass_action" NOT NULL,
    "reason" "text" NOT NULL,
    "performed_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."gate_pass_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."injuries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "player_id" "uuid" NOT NULL,
    "centre_id" "uuid" NOT NULL,
    "date_of_injury" "date" NOT NULL,
    "activity_type" "text",
    "body_region" "text",
    "nature" "text",
    "cause" "text",
    "treating_person" "text",
    "initial_treatment" "text",
    "description" "text",
    "report_doc_path" "text",
    "reported_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."injuries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."packages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "centre_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "player_type_id" "uuid",
    "price" numeric(10,2) NOT NULL,
    "duration" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."packages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."parent_player_links" (
    "parent_id" "uuid" NOT NULL,
    "player_id" "uuid" NOT NULL,
    "centre_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."parent_player_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "centre_id" "uuid" NOT NULL,
    "player_id" "uuid" NOT NULL,
    "package_id" "uuid",
    "amount" numeric(10,2) NOT NULL,
    "payment_date" "date" NOT NULL,
    "notes" "text",
    "recorded_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."player_types" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "centre_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."player_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."players" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "centre_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "date_of_birth" "date" NOT NULL,
    "age_category_id" "uuid",
    "email" "text",
    "contact_number" "text",
    "player_type_id" "uuid",
    "package_id" "uuid",
    "batch_id" "uuid",
    "gender" "text",
    "blood_group" "text",
    "height_cm" numeric(5,2),
    "weight_kg" numeric(5,2),
    "birth_mark" "text",
    "medical_condition" "text",
    "food_allergy" "text",
    "aiff_number" "text",
    "passport_number_encrypted" "text",
    "aadhaar_number_encrypted" "text",
    "aadhaar_doc_path" "text",
    "medical_records_path" "text",
    "profile_picture_path" "text",
    "father_name" "text",
    "mother_name" "text",
    "parent_email" "text" NOT NULL,
    "parent_contact_number" "text",
    "address_line1" "text",
    "address_line2" "text",
    "country" "text",
    "state" "text",
    "city" "text",
    "pincode" "text",
    "is_checked_in" boolean DEFAULT false NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."players" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "role" "public"."user_role" NOT NULL,
    "centre_id" "uuid",
    "full_name" "text" DEFAULT ''::"text" NOT NULL,
    "email" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "centre_required_for_staff" CHECK (((("role" = ANY (ARRAY['centre_admin'::"public"."user_role", 'coach'::"public"."user_role", 'medical'::"public"."user_role"])) AND ("centre_id" IS NOT NULL)) OR ("role" = ANY (ARRAY['super_admin'::"public"."user_role", 'parent'::"public"."user_role"]))))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staff_profiles" (
    "profile_id" "uuid" NOT NULL,
    "date_of_birth" "date",
    "contact_number" "text",
    "address_line1" "text",
    "address_line2" "text",
    "country" "text",
    "state" "text",
    "city" "text",
    "pincode" "text",
    "date_of_joining" "date",
    "aadhaar_doc_path" "text",
    "birth_certificate_path" "text",
    "profile_picture_path" "text",
    "other_documents_path" "text"
);


ALTER TABLE "public"."staff_profiles" OWNER TO "postgres";


ALTER TABLE ONLY "public"."age_categories"
    ADD CONSTRAINT "age_categories_centre_id_name_key" UNIQUE ("centre_id", "name");



ALTER TABLE ONLY "public"."age_categories"
    ADD CONSTRAINT "age_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_batch_id_player_id_attendance_date_key" UNIQUE ("batch_id", "player_id", "attendance_date");



ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."batches"
    ADD CONSTRAINT "batches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."centres"
    ADD CONSTRAINT "centres_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."five_s_category_notes"
    ADD CONSTRAINT "five_s_category_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."five_s_category_notes"
    ADD CONSTRAINT "five_s_category_notes_player_id_category_key" UNIQUE ("player_id", "category");



ALTER TABLE ONLY "public"."five_s_group_notes"
    ADD CONSTRAINT "five_s_group_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."five_s_group_notes"
    ADD CONSTRAINT "five_s_group_notes_player_id_category_group_name_key" UNIQUE ("player_id", "category", "group_name");



ALTER TABLE ONLY "public"."five_s_question_responses"
    ADD CONSTRAINT "five_s_question_responses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."five_s_question_responses"
    ADD CONSTRAINT "five_s_question_responses_player_id_question_id_key" UNIQUE ("player_id", "question_id");



ALTER TABLE ONLY "public"."five_s_questions"
    ADD CONSTRAINT "five_s_questions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."five_s_reports"
    ADD CONSTRAINT "five_s_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."five_s_reports"
    ADD CONSTRAINT "five_s_reports_player_id_key" UNIQUE ("player_id");



ALTER TABLE ONLY "public"."five_s_results"
    ADD CONSTRAINT "five_s_results_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."five_s_results"
    ADD CONSTRAINT "five_s_results_player_id_test_id_key" UNIQUE ("player_id", "test_id");



ALTER TABLE ONLY "public"."five_s_tests"
    ADD CONSTRAINT "five_s_tests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gate_pass_logs"
    ADD CONSTRAINT "gate_pass_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."injuries"
    ADD CONSTRAINT "injuries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."packages"
    ADD CONSTRAINT "packages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."parent_player_links"
    ADD CONSTRAINT "parent_player_links_pkey" PRIMARY KEY ("parent_id", "player_id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."player_types"
    ADD CONSTRAINT "player_types_centre_id_name_key" UNIQUE ("centre_id", "name");



ALTER TABLE ONLY "public"."player_types"
    ADD CONSTRAINT "player_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."players"
    ADD CONSTRAINT "players_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_profiles"
    ADD CONSTRAINT "staff_profiles_pkey" PRIMARY KEY ("profile_id");



CREATE INDEX "age_categories_centre_id_idx" ON "public"."age_categories" USING "btree" ("centre_id");



CREATE INDEX "attendance_batch_id_idx" ON "public"."attendance" USING "btree" ("batch_id");



CREATE INDEX "attendance_marked_by_idx" ON "public"."attendance" USING "btree" ("marked_by");



CREATE INDEX "attendance_player_id_idx" ON "public"."attendance" USING "btree" ("player_id");



CREATE INDEX "batches_age_category_id_idx" ON "public"."batches" USING "btree" ("age_category_id");



CREATE INDEX "batches_centre_id_idx" ON "public"."batches" USING "btree" ("centre_id");



CREATE INDEX "batches_head_coach_id_idx" ON "public"."batches" USING "btree" ("head_coach_id");



CREATE INDEX "batches_player_type_id_idx" ON "public"."batches" USING "btree" ("player_type_id");



CREATE INDEX "five_s_category_notes_centre_id_idx" ON "public"."five_s_category_notes" USING "btree" ("centre_id");



CREATE INDEX "five_s_category_notes_player_id_idx" ON "public"."five_s_category_notes" USING "btree" ("player_id");



CREATE INDEX "five_s_category_notes_recorded_by_idx" ON "public"."five_s_category_notes" USING "btree" ("recorded_by");



CREATE INDEX "five_s_group_notes_centre_id_idx" ON "public"."five_s_group_notes" USING "btree" ("centre_id");



CREATE INDEX "five_s_group_notes_player_id_idx" ON "public"."five_s_group_notes" USING "btree" ("player_id");



CREATE INDEX "five_s_group_notes_recorded_by_idx" ON "public"."five_s_group_notes" USING "btree" ("recorded_by");



CREATE INDEX "five_s_question_responses_centre_id_idx" ON "public"."five_s_question_responses" USING "btree" ("centre_id");



CREATE INDEX "five_s_question_responses_player_id_idx" ON "public"."five_s_question_responses" USING "btree" ("player_id");



CREATE INDEX "five_s_question_responses_question_id_idx" ON "public"."five_s_question_responses" USING "btree" ("question_id");



CREATE INDEX "five_s_question_responses_recorded_by_idx" ON "public"."five_s_question_responses" USING "btree" ("recorded_by");



CREATE INDEX "five_s_reports_centre_id_idx" ON "public"."five_s_reports" USING "btree" ("centre_id");



CREATE INDEX "five_s_results_centre_id_idx" ON "public"."five_s_results" USING "btree" ("centre_id");



CREATE INDEX "five_s_results_player_id_idx" ON "public"."five_s_results" USING "btree" ("player_id");



CREATE INDEX "five_s_results_recorded_by_idx" ON "public"."five_s_results" USING "btree" ("recorded_by");



CREATE INDEX "five_s_results_test_id_idx" ON "public"."five_s_results" USING "btree" ("test_id");



CREATE INDEX "gate_pass_logs_centre_id_idx" ON "public"."gate_pass_logs" USING "btree" ("centre_id");



CREATE INDEX "gate_pass_logs_performed_by_idx" ON "public"."gate_pass_logs" USING "btree" ("performed_by");



CREATE INDEX "gate_pass_logs_player_id_idx" ON "public"."gate_pass_logs" USING "btree" ("player_id");



CREATE INDEX "injuries_centre_id_idx" ON "public"."injuries" USING "btree" ("centre_id");



CREATE INDEX "injuries_player_id_idx" ON "public"."injuries" USING "btree" ("player_id");



CREATE INDEX "injuries_reported_by_idx" ON "public"."injuries" USING "btree" ("reported_by");



CREATE INDEX "packages_centre_id_idx" ON "public"."packages" USING "btree" ("centre_id");



CREATE INDEX "packages_player_type_id_idx" ON "public"."packages" USING "btree" ("player_type_id");



CREATE INDEX "parent_player_links_centre_id_idx" ON "public"."parent_player_links" USING "btree" ("centre_id");



CREATE INDEX "parent_player_links_parent_id_idx" ON "public"."parent_player_links" USING "btree" ("parent_id");



CREATE INDEX "parent_player_links_player_id_idx" ON "public"."parent_player_links" USING "btree" ("player_id");



CREATE INDEX "payments_centre_id_idx" ON "public"."payments" USING "btree" ("centre_id");



CREATE INDEX "payments_package_id_idx" ON "public"."payments" USING "btree" ("package_id");



CREATE INDEX "payments_player_id_idx" ON "public"."payments" USING "btree" ("player_id");



CREATE INDEX "payments_recorded_by_idx" ON "public"."payments" USING "btree" ("recorded_by");



CREATE INDEX "player_types_centre_id_idx" ON "public"."player_types" USING "btree" ("centre_id");



CREATE INDEX "players_age_category_id_idx" ON "public"."players" USING "btree" ("age_category_id");



CREATE INDEX "players_batch_id_idx" ON "public"."players" USING "btree" ("batch_id");



CREATE INDEX "players_centre_id_idx" ON "public"."players" USING "btree" ("centre_id");



CREATE INDEX "players_created_by_idx" ON "public"."players" USING "btree" ("created_by");



CREATE INDEX "players_package_id_idx" ON "public"."players" USING "btree" ("package_id");



CREATE INDEX "players_parent_email_idx" ON "public"."players" USING "btree" ("parent_email");



CREATE INDEX "players_player_type_id_idx" ON "public"."players" USING "btree" ("player_type_id");



CREATE INDEX "profiles_centre_id_idx" ON "public"."profiles" USING "btree" ("centre_id");



CREATE OR REPLACE TRIGGER "prevent_role_escalation" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_role_escalation"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."batches" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."centres" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."five_s_category_notes" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."five_s_group_notes" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."five_s_question_responses" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."five_s_results" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."injuries" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."packages" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."players" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "snapshot_previous_score" BEFORE UPDATE ON "public"."five_s_results" FOR EACH ROW EXECUTE FUNCTION "public"."five_s_results_snapshot_previous"();



ALTER TABLE ONLY "public"."age_categories"
    ADD CONSTRAINT "age_categories_centre_id_fkey" FOREIGN KEY ("centre_id") REFERENCES "public"."centres"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_marked_by_fkey" FOREIGN KEY ("marked_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."batches"
    ADD CONSTRAINT "batches_age_category_id_fkey" FOREIGN KEY ("age_category_id") REFERENCES "public"."age_categories"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."batches"
    ADD CONSTRAINT "batches_centre_id_fkey" FOREIGN KEY ("centre_id") REFERENCES "public"."centres"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."batches"
    ADD CONSTRAINT "batches_head_coach_id_fkey" FOREIGN KEY ("head_coach_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."batches"
    ADD CONSTRAINT "batches_player_type_id_fkey" FOREIGN KEY ("player_type_id") REFERENCES "public"."player_types"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."five_s_category_notes"
    ADD CONSTRAINT "five_s_category_notes_centre_id_fkey" FOREIGN KEY ("centre_id") REFERENCES "public"."centres"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."five_s_category_notes"
    ADD CONSTRAINT "five_s_category_notes_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."five_s_category_notes"
    ADD CONSTRAINT "five_s_category_notes_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."five_s_group_notes"
    ADD CONSTRAINT "five_s_group_notes_centre_id_fkey" FOREIGN KEY ("centre_id") REFERENCES "public"."centres"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."five_s_group_notes"
    ADD CONSTRAINT "five_s_group_notes_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."five_s_group_notes"
    ADD CONSTRAINT "five_s_group_notes_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."five_s_question_responses"
    ADD CONSTRAINT "five_s_question_responses_centre_id_fkey" FOREIGN KEY ("centre_id") REFERENCES "public"."centres"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."five_s_question_responses"
    ADD CONSTRAINT "five_s_question_responses_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."five_s_question_responses"
    ADD CONSTRAINT "five_s_question_responses_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."five_s_questions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."five_s_question_responses"
    ADD CONSTRAINT "five_s_question_responses_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."five_s_reports"
    ADD CONSTRAINT "five_s_reports_centre_id_fkey" FOREIGN KEY ("centre_id") REFERENCES "public"."centres"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."five_s_reports"
    ADD CONSTRAINT "five_s_reports_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."five_s_reports"
    ADD CONSTRAINT "five_s_reports_published_by_fkey" FOREIGN KEY ("published_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."five_s_results"
    ADD CONSTRAINT "five_s_results_centre_id_fkey" FOREIGN KEY ("centre_id") REFERENCES "public"."centres"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."five_s_results"
    ADD CONSTRAINT "five_s_results_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."five_s_results"
    ADD CONSTRAINT "five_s_results_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."five_s_results"
    ADD CONSTRAINT "five_s_results_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "public"."five_s_tests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gate_pass_logs"
    ADD CONSTRAINT "gate_pass_logs_centre_id_fkey" FOREIGN KEY ("centre_id") REFERENCES "public"."centres"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gate_pass_logs"
    ADD CONSTRAINT "gate_pass_logs_performed_by_fkey" FOREIGN KEY ("performed_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."gate_pass_logs"
    ADD CONSTRAINT "gate_pass_logs_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."injuries"
    ADD CONSTRAINT "injuries_centre_id_fkey" FOREIGN KEY ("centre_id") REFERENCES "public"."centres"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."injuries"
    ADD CONSTRAINT "injuries_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."injuries"
    ADD CONSTRAINT "injuries_reported_by_fkey" FOREIGN KEY ("reported_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."packages"
    ADD CONSTRAINT "packages_centre_id_fkey" FOREIGN KEY ("centre_id") REFERENCES "public"."centres"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."packages"
    ADD CONSTRAINT "packages_player_type_id_fkey" FOREIGN KEY ("player_type_id") REFERENCES "public"."player_types"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."parent_player_links"
    ADD CONSTRAINT "parent_player_links_centre_id_fkey" FOREIGN KEY ("centre_id") REFERENCES "public"."centres"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."parent_player_links"
    ADD CONSTRAINT "parent_player_links_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."parent_player_links"
    ADD CONSTRAINT "parent_player_links_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_centre_id_fkey" FOREIGN KEY ("centre_id") REFERENCES "public"."centres"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."player_types"
    ADD CONSTRAINT "player_types_centre_id_fkey" FOREIGN KEY ("centre_id") REFERENCES "public"."centres"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."players"
    ADD CONSTRAINT "players_age_category_id_fkey" FOREIGN KEY ("age_category_id") REFERENCES "public"."age_categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."players"
    ADD CONSTRAINT "players_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."players"
    ADD CONSTRAINT "players_centre_id_fkey" FOREIGN KEY ("centre_id") REFERENCES "public"."centres"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."players"
    ADD CONSTRAINT "players_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."players"
    ADD CONSTRAINT "players_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."players"
    ADD CONSTRAINT "players_player_type_id_fkey" FOREIGN KEY ("player_type_id") REFERENCES "public"."player_types"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_centre_id_fkey" FOREIGN KEY ("centre_id") REFERENCES "public"."centres"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff_profiles"
    ADD CONSTRAINT "staff_profiles_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE "public"."age_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."attendance" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "authenticated can view five_s_questions" ON "public"."five_s_questions" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "authenticated can view five_s_tests" ON "public"."five_s_tests" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



ALTER TABLE "public"."batches" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "centre staff can view own age_categories" ON "public"."age_categories" FOR SELECT USING ((("private"."user_role"() = ANY (ARRAY['coach'::"public"."user_role", 'medical'::"public"."user_role"])) AND ("centre_id" = "private"."user_centre_id"())));



CREATE POLICY "centre staff can view own centre" ON "public"."centres" FOR SELECT USING ((("private"."user_role"() = ANY (ARRAY['centre_admin'::"public"."user_role", 'coach'::"public"."user_role", 'medical'::"public"."user_role"])) AND ("id" = "private"."user_centre_id"())));



CREATE POLICY "centre staff can view own player_types" ON "public"."player_types" FOR SELECT USING ((("private"."user_role"() = ANY (ARRAY['coach'::"public"."user_role", 'medical'::"public"."user_role"])) AND ("centre_id" = "private"."user_centre_id"())));



CREATE POLICY "centre_admin manages links for own centre players" ON "public"."parent_player_links" USING ((("private"."user_role"() = 'centre_admin'::"public"."user_role") AND ("centre_id" = "private"."user_centre_id"()))) WITH CHECK ((("private"."user_role"() = 'centre_admin'::"public"."user_role") AND ("centre_id" = "private"."user_centre_id"())));



CREATE POLICY "centre_admin manages own age_categories" ON "public"."age_categories" USING ((("private"."user_role"() = 'centre_admin'::"public"."user_role") AND ("centre_id" = "private"."user_centre_id"()))) WITH CHECK ((("private"."user_role"() = 'centre_admin'::"public"."user_role") AND ("centre_id" = "private"."user_centre_id"())));



CREATE POLICY "centre_admin manages own centre batches" ON "public"."batches" USING ((("private"."user_role"() = 'centre_admin'::"public"."user_role") AND ("centre_id" = "private"."user_centre_id"()))) WITH CHECK ((("private"."user_role"() = 'centre_admin'::"public"."user_role") AND ("centre_id" = "private"."user_centre_id"())));



CREATE POLICY "centre_admin manages own centre gate_pass_logs" ON "public"."gate_pass_logs" USING ((("private"."user_role"() = 'centre_admin'::"public"."user_role") AND ("centre_id" = "private"."user_centre_id"()))) WITH CHECK ((("private"."user_role"() = 'centre_admin'::"public"."user_role") AND ("centre_id" = "private"."user_centre_id"())));



CREATE POLICY "centre_admin manages own centre packages" ON "public"."packages" USING ((("private"."user_role"() = 'centre_admin'::"public"."user_role") AND ("centre_id" = "private"."user_centre_id"()))) WITH CHECK ((("private"."user_role"() = 'centre_admin'::"public"."user_role") AND ("centre_id" = "private"."user_centre_id"())));



CREATE POLICY "centre_admin manages own centre payments" ON "public"."payments" USING ((("private"."user_role"() = 'centre_admin'::"public"."user_role") AND ("centre_id" = "private"."user_centre_id"()))) WITH CHECK ((("private"."user_role"() = 'centre_admin'::"public"."user_role") AND ("centre_id" = "private"."user_centre_id"())));



CREATE POLICY "centre_admin manages own centre players" ON "public"."players" USING ((("private"."user_role"() = 'centre_admin'::"public"."user_role") AND ("centre_id" = "private"."user_centre_id"()))) WITH CHECK ((("private"."user_role"() = 'centre_admin'::"public"."user_role") AND ("centre_id" = "private"."user_centre_id"())));



CREATE POLICY "centre_admin manages own centre staff" ON "public"."profiles" USING ((("private"."user_role"() = 'centre_admin'::"public"."user_role") AND ("centre_id" = "private"."user_centre_id"()) AND ("role" = ANY (ARRAY['centre_admin'::"public"."user_role", 'coach'::"public"."user_role", 'medical'::"public"."user_role"])))) WITH CHECK ((("private"."user_role"() = 'centre_admin'::"public"."user_role") AND ("centre_id" = "private"."user_centre_id"()) AND ("role" = ANY (ARRAY['centre_admin'::"public"."user_role", 'coach'::"public"."user_role", 'medical'::"public"."user_role"]))));



CREATE POLICY "centre_admin manages own centre staff_profiles" ON "public"."staff_profiles" USING ((("private"."user_role"() = 'centre_admin'::"public"."user_role") AND ("profile_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."centre_id" = "private"."user_centre_id"()))))) WITH CHECK ((("private"."user_role"() = 'centre_admin'::"public"."user_role") AND ("profile_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."centre_id" = "private"."user_centre_id"())))));



CREATE POLICY "centre_admin manages own player_types" ON "public"."player_types" USING ((("private"."user_role"() = 'centre_admin'::"public"."user_role") AND ("centre_id" = "private"."user_centre_id"()))) WITH CHECK ((("private"."user_role"() = 'centre_admin'::"public"."user_role") AND ("centre_id" = "private"."user_centre_id"())));



CREATE POLICY "centre_admin sets own centre five_s testing window" ON "public"."centres" FOR UPDATE USING ((("private"."user_role"() = 'centre_admin'::"public"."user_role") AND ("id" = "private"."user_centre_id"()))) WITH CHECK ((("private"."user_role"() = 'centre_admin'::"public"."user_role") AND ("id" = "private"."user_centre_id"())));



CREATE POLICY "centre_admin views own centre attendance" ON "public"."attendance" FOR SELECT USING ((("private"."user_role"() = 'centre_admin'::"public"."user_role") AND ("batch_id" IN ( SELECT "batches"."id"
   FROM "public"."batches"
  WHERE ("batches"."centre_id" = "private"."user_centre_id"())))));



CREATE POLICY "centre_admin views own centre five_s_category_notes" ON "public"."five_s_category_notes" FOR SELECT USING ((("private"."user_role"() = 'centre_admin'::"public"."user_role") AND ("centre_id" = "private"."user_centre_id"()) AND (EXISTS ( SELECT 1
   FROM "public"."five_s_reports" "r"
  WHERE ("r"."player_id" = "five_s_category_notes"."player_id")))));



CREATE POLICY "centre_admin views own centre five_s_group_notes" ON "public"."five_s_group_notes" FOR SELECT USING ((("private"."user_role"() = 'centre_admin'::"public"."user_role") AND ("centre_id" = "private"."user_centre_id"()) AND (EXISTS ( SELECT 1
   FROM "public"."five_s_reports" "r"
  WHERE ("r"."player_id" = "five_s_group_notes"."player_id")))));



CREATE POLICY "centre_admin views own centre five_s_question_responses" ON "public"."five_s_question_responses" FOR SELECT USING ((("private"."user_role"() = 'centre_admin'::"public"."user_role") AND ("centre_id" = "private"."user_centre_id"()) AND (EXISTS ( SELECT 1
   FROM "public"."five_s_reports" "r"
  WHERE ("r"."player_id" = "five_s_question_responses"."player_id")))));



CREATE POLICY "centre_admin views own centre five_s_reports" ON "public"."five_s_reports" FOR SELECT USING ((("private"."user_role"() = 'centre_admin'::"public"."user_role") AND ("centre_id" = "private"."user_centre_id"())));



CREATE POLICY "centre_admin views own centre five_s_results" ON "public"."five_s_results" FOR SELECT USING ((("private"."user_role"() = 'centre_admin'::"public"."user_role") AND ("centre_id" = "private"."user_centre_id"()) AND (EXISTS ( SELECT 1
   FROM "public"."five_s_reports" "r"
  WHERE ("r"."player_id" = "five_s_results"."player_id")))));



CREATE POLICY "centre_admin views own centre injuries" ON "public"."injuries" FOR SELECT USING ((("private"."user_role"() = 'centre_admin'::"public"."user_role") AND ("centre_id" = "private"."user_centre_id"())));



ALTER TABLE "public"."centres" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "coach manages attendance for own batches" ON "public"."attendance" USING ((("private"."user_role"() = 'coach'::"public"."user_role") AND ("batch_id" IN ( SELECT "batches"."id"
   FROM "public"."batches"
  WHERE ("batches"."head_coach_id" = "auth"."uid"()))))) WITH CHECK ((("private"."user_role"() = 'coach'::"public"."user_role") AND ("batch_id" IN ( SELECT "batches"."id"
   FROM "public"."batches"
  WHERE ("batches"."head_coach_id" = "auth"."uid"())))));



CREATE POLICY "coach manages five_s_category_notes for own batch players" ON "public"."five_s_category_notes" USING ((("private"."user_role"() = 'coach'::"public"."user_role") AND ("player_id" IN ( SELECT "p"."id"
   FROM ("public"."players" "p"
     JOIN "public"."batches" "b" ON (("b"."id" = "p"."batch_id")))
  WHERE ("b"."head_coach_id" = "auth"."uid"()))))) WITH CHECK ((("private"."user_role"() = 'coach'::"public"."user_role") AND ("player_id" IN ( SELECT "p"."id"
   FROM ("public"."players" "p"
     JOIN "public"."batches" "b" ON (("b"."id" = "p"."batch_id")))
  WHERE ("b"."head_coach_id" = "auth"."uid"())))));



CREATE POLICY "coach manages five_s_group_notes for own batch players" ON "public"."five_s_group_notes" USING ((("private"."user_role"() = 'coach'::"public"."user_role") AND ("player_id" IN ( SELECT "p"."id"
   FROM ("public"."players" "p"
     JOIN "public"."batches" "b" ON (("b"."id" = "p"."batch_id")))
  WHERE ("b"."head_coach_id" = "auth"."uid"()))))) WITH CHECK ((("private"."user_role"() = 'coach'::"public"."user_role") AND ("player_id" IN ( SELECT "p"."id"
   FROM ("public"."players" "p"
     JOIN "public"."batches" "b" ON (("b"."id" = "p"."batch_id")))
  WHERE ("b"."head_coach_id" = "auth"."uid"())))));



CREATE POLICY "coach manages five_s_question_responses for own batch players" ON "public"."five_s_question_responses" USING ((("private"."user_role"() = 'coach'::"public"."user_role") AND ("player_id" IN ( SELECT "p"."id"
   FROM ("public"."players" "p"
     JOIN "public"."batches" "b" ON (("b"."id" = "p"."batch_id")))
  WHERE ("b"."head_coach_id" = "auth"."uid"()))))) WITH CHECK ((("private"."user_role"() = 'coach'::"public"."user_role") AND ("player_id" IN ( SELECT "p"."id"
   FROM ("public"."players" "p"
     JOIN "public"."batches" "b" ON (("b"."id" = "p"."batch_id")))
  WHERE ("b"."head_coach_id" = "auth"."uid"())))));



CREATE POLICY "coach manages five_s_reports for own batch players" ON "public"."five_s_reports" USING ((("private"."user_role"() = 'coach'::"public"."user_role") AND ("player_id" IN ( SELECT "p"."id"
   FROM ("public"."players" "p"
     JOIN "public"."batches" "b" ON (("b"."id" = "p"."batch_id")))
  WHERE ("b"."head_coach_id" = "auth"."uid"()))))) WITH CHECK ((("private"."user_role"() = 'coach'::"public"."user_role") AND ("player_id" IN ( SELECT "p"."id"
   FROM ("public"."players" "p"
     JOIN "public"."batches" "b" ON (("b"."id" = "p"."batch_id")))
  WHERE ("b"."head_coach_id" = "auth"."uid"())))));



CREATE POLICY "coach manages five_s_results for own batch players" ON "public"."five_s_results" USING ((("private"."user_role"() = 'coach'::"public"."user_role") AND ("player_id" IN ( SELECT "p"."id"
   FROM ("public"."players" "p"
     JOIN "public"."batches" "b" ON (("b"."id" = "p"."batch_id")))
  WHERE ("b"."head_coach_id" = "auth"."uid"()))))) WITH CHECK ((("private"."user_role"() = 'coach'::"public"."user_role") AND ("player_id" IN ( SELECT "p"."id"
   FROM ("public"."players" "p"
     JOIN "public"."batches" "b" ON (("b"."id" = "p"."batch_id")))
  WHERE ("b"."head_coach_id" = "auth"."uid"())))));



CREATE POLICY "coach manages injuries for own batch players" ON "public"."injuries" USING ((("private"."user_role"() = 'coach'::"public"."user_role") AND ("player_id" IN ( SELECT "p"."id"
   FROM ("public"."players" "p"
     JOIN "public"."batches" "b" ON (("b"."id" = "p"."batch_id")))
  WHERE ("b"."head_coach_id" = "auth"."uid"()))))) WITH CHECK ((("private"."user_role"() = 'coach'::"public"."user_role") AND ("player_id" IN ( SELECT "p"."id"
   FROM ("public"."players" "p"
     JOIN "public"."batches" "b" ON (("b"."id" = "p"."batch_id")))
  WHERE ("b"."head_coach_id" = "auth"."uid"())))));



CREATE POLICY "coach views own assigned batches" ON "public"."batches" FOR SELECT USING ((("private"."user_role"() = 'coach'::"public"."user_role") AND ("head_coach_id" = "auth"."uid"())));



CREATE POLICY "coach views players in own batches" ON "public"."players" FOR SELECT USING ((("private"."user_role"() = 'coach'::"public"."user_role") AND ("batch_id" IN ( SELECT "batches"."id"
   FROM "public"."batches"
  WHERE ("batches"."head_coach_id" = "auth"."uid"())))));



ALTER TABLE "public"."five_s_category_notes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."five_s_group_notes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."five_s_question_responses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."five_s_questions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."five_s_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."five_s_results" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."five_s_tests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."gate_pass_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."injuries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "medical manages own centre injuries" ON "public"."injuries" USING ((("private"."user_role"() = 'medical'::"public"."user_role") AND ("centre_id" = "private"."user_centre_id"()))) WITH CHECK ((("private"."user_role"() = 'medical'::"public"."user_role") AND ("centre_id" = "private"."user_centre_id"())));



CREATE POLICY "medical views own centre batches" ON "public"."batches" FOR SELECT USING ((("private"."user_role"() = 'medical'::"public"."user_role") AND ("centre_id" = "private"."user_centre_id"())));



CREATE POLICY "medical views own centre players" ON "public"."players" FOR SELECT USING ((("private"."user_role"() = 'medical'::"public"."user_role") AND ("centre_id" = "private"."user_centre_id"())));



ALTER TABLE "public"."packages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."parent_player_links" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "parents view own children" ON "public"."players" FOR SELECT USING ((("private"."user_role"() = 'parent'::"public"."user_role") AND ("id" IN ( SELECT "parent_player_links"."player_id"
   FROM "public"."parent_player_links"
  WHERE ("parent_player_links"."parent_id" = "auth"."uid"())))));



CREATE POLICY "parents view own children's attendance" ON "public"."attendance" FOR SELECT USING ((("private"."user_role"() = 'parent'::"public"."user_role") AND ("player_id" IN ( SELECT "parent_player_links"."player_id"
   FROM "public"."parent_player_links"
  WHERE ("parent_player_links"."parent_id" = "auth"."uid"())))));



CREATE POLICY "parents view own children's five_s_category_notes" ON "public"."five_s_category_notes" FOR SELECT USING ((("private"."user_role"() = 'parent'::"public"."user_role") AND ("player_id" IN ( SELECT "parent_player_links"."player_id"
   FROM "public"."parent_player_links"
  WHERE ("parent_player_links"."parent_id" = "auth"."uid"()))) AND (EXISTS ( SELECT 1
   FROM "public"."five_s_reports" "r"
  WHERE ("r"."player_id" = "five_s_category_notes"."player_id")))));



CREATE POLICY "parents view own children's five_s_group_notes" ON "public"."five_s_group_notes" FOR SELECT USING ((("private"."user_role"() = 'parent'::"public"."user_role") AND ("player_id" IN ( SELECT "parent_player_links"."player_id"
   FROM "public"."parent_player_links"
  WHERE ("parent_player_links"."parent_id" = "auth"."uid"()))) AND (EXISTS ( SELECT 1
   FROM "public"."five_s_reports" "r"
  WHERE ("r"."player_id" = "five_s_group_notes"."player_id")))));



CREATE POLICY "parents view own children's five_s_question_responses" ON "public"."five_s_question_responses" FOR SELECT USING ((("private"."user_role"() = 'parent'::"public"."user_role") AND ("player_id" IN ( SELECT "parent_player_links"."player_id"
   FROM "public"."parent_player_links"
  WHERE ("parent_player_links"."parent_id" = "auth"."uid"()))) AND (EXISTS ( SELECT 1
   FROM "public"."five_s_reports" "r"
  WHERE ("r"."player_id" = "five_s_question_responses"."player_id")))));



CREATE POLICY "parents view own children's five_s_reports" ON "public"."five_s_reports" FOR SELECT USING ((("private"."user_role"() = 'parent'::"public"."user_role") AND ("player_id" IN ( SELECT "parent_player_links"."player_id"
   FROM "public"."parent_player_links"
  WHERE ("parent_player_links"."parent_id" = "auth"."uid"())))));



CREATE POLICY "parents view own children's five_s_results" ON "public"."five_s_results" FOR SELECT USING ((("private"."user_role"() = 'parent'::"public"."user_role") AND ("player_id" IN ( SELECT "parent_player_links"."player_id"
   FROM "public"."parent_player_links"
  WHERE ("parent_player_links"."parent_id" = "auth"."uid"()))) AND (EXISTS ( SELECT 1
   FROM "public"."five_s_reports" "r"
  WHERE ("r"."player_id" = "five_s_results"."player_id")))));



CREATE POLICY "parents view own children's gate_pass_logs" ON "public"."gate_pass_logs" FOR SELECT USING ((("private"."user_role"() = 'parent'::"public"."user_role") AND ("player_id" IN ( SELECT "parent_player_links"."player_id"
   FROM "public"."parent_player_links"
  WHERE ("parent_player_links"."parent_id" = "auth"."uid"())))));



CREATE POLICY "parents view own children's injuries" ON "public"."injuries" FOR SELECT USING ((("private"."user_role"() = 'parent'::"public"."user_role") AND ("player_id" IN ( SELECT "parent_player_links"."player_id"
   FROM "public"."parent_player_links"
  WHERE ("parent_player_links"."parent_id" = "auth"."uid"())))));



CREATE POLICY "parents view own children's payments" ON "public"."payments" FOR SELECT USING ((("private"."user_role"() = 'parent'::"public"."user_role") AND ("player_id" IN ( SELECT "parent_player_links"."player_id"
   FROM "public"."parent_player_links"
  WHERE ("parent_player_links"."parent_id" = "auth"."uid"())))));



CREATE POLICY "parents view own links" ON "public"."parent_player_links" FOR SELECT USING ((("private"."user_role"() = 'parent'::"public"."user_role") AND ("parent_id" = "auth"."uid"())));



ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."player_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."players" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "staff can view own staff_profile" ON "public"."staff_profiles" FOR SELECT USING (("profile_id" = "auth"."uid"()));



ALTER TABLE "public"."staff_profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "super_admin full access to age_categories" ON "public"."age_categories" USING (("private"."user_role"() = 'super_admin'::"public"."user_role")) WITH CHECK (("private"."user_role"() = 'super_admin'::"public"."user_role"));



CREATE POLICY "super_admin full access to attendance" ON "public"."attendance" USING (("private"."user_role"() = 'super_admin'::"public"."user_role")) WITH CHECK (("private"."user_role"() = 'super_admin'::"public"."user_role"));



CREATE POLICY "super_admin full access to batches" ON "public"."batches" USING (("private"."user_role"() = 'super_admin'::"public"."user_role")) WITH CHECK (("private"."user_role"() = 'super_admin'::"public"."user_role"));



CREATE POLICY "super_admin full access to centres" ON "public"."centres" USING (("private"."user_role"() = 'super_admin'::"public"."user_role")) WITH CHECK (("private"."user_role"() = 'super_admin'::"public"."user_role"));



CREATE POLICY "super_admin full access to five_s_category_notes" ON "public"."five_s_category_notes" USING (("private"."user_role"() = 'super_admin'::"public"."user_role")) WITH CHECK (("private"."user_role"() = 'super_admin'::"public"."user_role"));



CREATE POLICY "super_admin full access to five_s_group_notes" ON "public"."five_s_group_notes" USING (("private"."user_role"() = 'super_admin'::"public"."user_role")) WITH CHECK (("private"."user_role"() = 'super_admin'::"public"."user_role"));



CREATE POLICY "super_admin full access to five_s_question_responses" ON "public"."five_s_question_responses" USING (("private"."user_role"() = 'super_admin'::"public"."user_role")) WITH CHECK (("private"."user_role"() = 'super_admin'::"public"."user_role"));



CREATE POLICY "super_admin full access to five_s_reports" ON "public"."five_s_reports" USING (("private"."user_role"() = 'super_admin'::"public"."user_role")) WITH CHECK (("private"."user_role"() = 'super_admin'::"public"."user_role"));



CREATE POLICY "super_admin full access to five_s_results" ON "public"."five_s_results" USING (("private"."user_role"() = 'super_admin'::"public"."user_role")) WITH CHECK (("private"."user_role"() = 'super_admin'::"public"."user_role"));



CREATE POLICY "super_admin full access to gate_pass_logs" ON "public"."gate_pass_logs" USING (("private"."user_role"() = 'super_admin'::"public"."user_role")) WITH CHECK (("private"."user_role"() = 'super_admin'::"public"."user_role"));



CREATE POLICY "super_admin full access to injuries" ON "public"."injuries" USING (("private"."user_role"() = 'super_admin'::"public"."user_role")) WITH CHECK (("private"."user_role"() = 'super_admin'::"public"."user_role"));



CREATE POLICY "super_admin full access to packages" ON "public"."packages" USING (("private"."user_role"() = 'super_admin'::"public"."user_role")) WITH CHECK (("private"."user_role"() = 'super_admin'::"public"."user_role"));



CREATE POLICY "super_admin full access to parent_player_links" ON "public"."parent_player_links" USING (("private"."user_role"() = 'super_admin'::"public"."user_role")) WITH CHECK (("private"."user_role"() = 'super_admin'::"public"."user_role"));



CREATE POLICY "super_admin full access to payments" ON "public"."payments" USING (("private"."user_role"() = 'super_admin'::"public"."user_role")) WITH CHECK (("private"."user_role"() = 'super_admin'::"public"."user_role"));



CREATE POLICY "super_admin full access to player_types" ON "public"."player_types" USING (("private"."user_role"() = 'super_admin'::"public"."user_role")) WITH CHECK (("private"."user_role"() = 'super_admin'::"public"."user_role"));



CREATE POLICY "super_admin full access to players" ON "public"."players" USING (("private"."user_role"() = 'super_admin'::"public"."user_role")) WITH CHECK (("private"."user_role"() = 'super_admin'::"public"."user_role"));



CREATE POLICY "super_admin full access to profiles" ON "public"."profiles" USING (("private"."user_role"() = 'super_admin'::"public"."user_role")) WITH CHECK (("private"."user_role"() = 'super_admin'::"public"."user_role"));



CREATE POLICY "super_admin full access to staff_profiles" ON "public"."staff_profiles" USING (("private"."user_role"() = 'super_admin'::"public"."user_role")) WITH CHECK (("private"."user_role"() = 'super_admin'::"public"."user_role"));



CREATE POLICY "users can view own profile" ON "public"."profiles" FOR SELECT USING (("id" = "auth"."uid"()));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."age_categories" TO "anon";
GRANT ALL ON TABLE "public"."age_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."age_categories" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."attendance" TO "anon";
GRANT ALL ON TABLE "public"."attendance" TO "authenticated";
GRANT ALL ON TABLE "public"."attendance" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."batches" TO "anon";
GRANT ALL ON TABLE "public"."batches" TO "authenticated";
GRANT ALL ON TABLE "public"."batches" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."centres" TO "anon";
GRANT ALL ON TABLE "public"."centres" TO "authenticated";
GRANT ALL ON TABLE "public"."centres" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."five_s_category_notes" TO "anon";
GRANT ALL ON TABLE "public"."five_s_category_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."five_s_category_notes" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."five_s_group_notes" TO "anon";
GRANT ALL ON TABLE "public"."five_s_group_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."five_s_group_notes" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."five_s_question_responses" TO "anon";
GRANT ALL ON TABLE "public"."five_s_question_responses" TO "authenticated";
GRANT ALL ON TABLE "public"."five_s_question_responses" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."five_s_questions" TO "anon";
GRANT ALL ON TABLE "public"."five_s_questions" TO "authenticated";
GRANT ALL ON TABLE "public"."five_s_questions" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."five_s_reports" TO "anon";
GRANT ALL ON TABLE "public"."five_s_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."five_s_reports" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."five_s_results" TO "anon";
GRANT ALL ON TABLE "public"."five_s_results" TO "authenticated";
GRANT ALL ON TABLE "public"."five_s_results" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."five_s_tests" TO "anon";
GRANT ALL ON TABLE "public"."five_s_tests" TO "authenticated";
GRANT ALL ON TABLE "public"."five_s_tests" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."gate_pass_logs" TO "anon";
GRANT ALL ON TABLE "public"."gate_pass_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."gate_pass_logs" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."injuries" TO "anon";
GRANT ALL ON TABLE "public"."injuries" TO "authenticated";
GRANT ALL ON TABLE "public"."injuries" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."packages" TO "anon";
GRANT ALL ON TABLE "public"."packages" TO "authenticated";
GRANT ALL ON TABLE "public"."packages" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."parent_player_links" TO "anon";
GRANT ALL ON TABLE "public"."parent_player_links" TO "authenticated";
GRANT ALL ON TABLE "public"."parent_player_links" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."payments" TO "anon";
GRANT ALL ON TABLE "public"."payments" TO "authenticated";
GRANT ALL ON TABLE "public"."payments" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."player_types" TO "anon";
GRANT ALL ON TABLE "public"."player_types" TO "authenticated";
GRANT ALL ON TABLE "public"."player_types" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."players" TO "anon";
GRANT ALL ON TABLE "public"."players" TO "authenticated";
GRANT ALL ON TABLE "public"."players" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."staff_profiles" TO "anon";
GRANT ALL ON TABLE "public"."staff_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."staff_profiles" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT UPDATE ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";








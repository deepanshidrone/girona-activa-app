-- =============================================================================
-- Migración base (baseline) — BrotaFit
-- =============================================================================
-- Foto de la estructura de la base de datos tal como estaba el 2026-11-04 en el
-- proyecto de Supabase woomjsjbmrasydpirwap, antes de usar migraciones.
--
-- - Parte 1: esquema `public` generado con pg_dump (vía `supabase db dump`).
--   NO editar a mano: cualquier cambio va en una migración nueva.
-- - Parte 2 (al final): objetos fuera de `public` que pg_dump no incluye
--   (trigger de alta en auth.users, event trigger de RLS automática, bucket y
--   políticas de Storage, publicación Realtime). Escrita a mano a partir del
--   catálogo de la base.
--
-- Recoge tal cual el estado actual, incluidas las políticas RLS demasiado
-- abiertas de BUG-002. Se corrigen en una migración posterior.
-- Sustituye a los antiguos supabase/trainwall-tables.sql y
-- supabase/group-slots-migration.sql, que ya estaban aplicados.
--
-- En la base original esta migración se marcó como aplicada con
-- `supabase migration repair --status applied`; solo se ejecuta en bases nuevas.
-- =============================================================================

-- Extensiones que usa el esquema (Supabase las trae por defecto en `extensions`)
create extension if not exists "pgcrypto" with schema "extensions";
create extension if not exists "uuid-ossp" with schema "extensions";

-- =============================================================================
-- Parte 1 — esquema public (pg_dump)
-- =============================================================================
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



CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  insert into public.profiles (id, full_name, avatar_url, role)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    coalesce(new.raw_app_meta_data->>'role', 'employee')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_client"() RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'client'
  );
$$;


ALTER FUNCTION "public"."is_client"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_employee"() RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'employee'
  );
$$;


ALTER FUNCTION "public"."is_employee"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."body_zones" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL
);


ALTER TABLE "public"."body_zones" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clients" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "first_name" "text" NOT NULL,
    "last_name" "text" NOT NULL,
    "sex" "text" NOT NULL,
    "birth_date" "date" NOT NULL,
    "height_cm" integer NOT NULL,
    "weight_kg" numeric(5,2) NOT NULL,
    "start_date" "date" NOT NULL,
    "notes" "text",
    "is_active" boolean DEFAULT true,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "clients_sex_check" CHECK (("sex" = ANY (ARRAY['male'::"text", 'female'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."clients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cycle_template_days" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "template_id" "uuid" NOT NULL,
    "day_index" integer NOT NULL,
    "block_label" "text" NOT NULL,
    CONSTRAINT "cycle_template_days_block_label_check" CHECK (("block_label" = ANY (ARRAY['A'::"text", 'B'::"text", 'C'::"text"]))),
    CONSTRAINT "cycle_template_days_day_index_check" CHECK ((("day_index" >= 0) AND ("day_index" <= 19)))
);


ALTER TABLE "public"."cycle_template_days" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cycle_template_slots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "template_id" "uuid" NOT NULL,
    "day_of_week" integer NOT NULL,
    "session_time" time without time zone NOT NULL,
    "has_overlap" boolean DEFAULT false NOT NULL,
    "max_clients" integer DEFAULT 6 NOT NULL,
    CONSTRAINT "cycle_template_slots_day_of_week_check" CHECK ((("day_of_week" >= 0) AND ("day_of_week" <= 4)))
);


ALTER TABLE "public"."cycle_template_slots" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cycle_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "notes" "text",
    "is_default" boolean DEFAULT false NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."cycle_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."equipment" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL
);


ALTER TABLE "public"."equipment" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."exercise_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_log_id" "uuid",
    "exercise_id" "uuid",
    "plan_exercise_id" "uuid",
    "sets_done" integer,
    "reps_done" integer,
    "load_kg" numeric(6,2),
    "rpe" integer,
    "rir" integer,
    "notes" "text",
    "skipped" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "exercise_logs_rir_check" CHECK ((("rir" >= 0) AND ("rir" <= 10))),
    CONSTRAINT "exercise_logs_rpe_check" CHECK ((("rpe" >= 1) AND ("rpe" <= 10)))
);


ALTER TABLE "public"."exercise_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."exercise_movement_patterns" (
    "exercise_id" "uuid" NOT NULL,
    "movement_pattern_id" "uuid" NOT NULL
);


ALTER TABLE "public"."exercise_movement_patterns" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."exercise_muscle_groups" (
    "exercise_id" "uuid" NOT NULL,
    "muscle_group_id" "uuid" NOT NULL
);


ALTER TABLE "public"."exercise_muscle_groups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."exercises" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "image_url" "text",
    "level" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "movement_pattern_id" "uuid",
    "technical_level" "text",
    "equipment_id" "uuid",
    "objective_id" "uuid",
    "progression" "text",
    "regression" "text",
    "exercise_code" "text",
    "technical_name" "text",
    "subpattern" "text",
    "secondary_muscles" "text",
    "contraindications" "text",
    "technical_notes" "text",
    "common_errors" "text",
    "is_active" boolean DEFAULT true,
    "body_zone" "text" DEFAULT 'Turmell i peu'::"text",
    "secondary_equipment" "text",
    "body_zone_id" "uuid",
    "progression_id" "uuid",
    "regression_id" "uuid",
    CONSTRAINT "exercises_level_check" CHECK (("level" = ANY (ARRAY[1, 2, 3]))),
    CONSTRAINT "exercises_technical_level_check" CHECK (("technical_level" = ANY (ARRAY['basico'::"text", 'intermedio'::"text", 'avanzado'::"text"])))
);


ALTER TABLE "public"."exercises" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."group_cycle_slot_clients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slot_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."group_cycle_slot_clients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."group_cycle_slots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cycle_id" "uuid" NOT NULL,
    "day_index" integer NOT NULL,
    "session_time" time without time zone,
    "block_label" "text" NOT NULL,
    "assigned_employee_id" "uuid",
    "max_clients" integer DEFAULT 6 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "group_cycle_slots_block_label_check" CHECK (("block_label" = ANY (ARRAY['A'::"text", 'B'::"text", 'C'::"text"]))),
    CONSTRAINT "group_cycle_slots_day_index_check" CHECK ((("day_index" >= 0) AND ("day_index" <= 19)))
);


ALTER TABLE "public"."group_cycle_slots" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."group_cycles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "start_date" "date" NOT NULL,
    "notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."group_cycles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."group_plan_templates" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "level" integer NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "group_plan_templates_level_check" CHECK (("level" = ANY (ARRAY[1, 2, 3])))
);


ALTER TABLE "public"."group_plan_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."group_session_exercises" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid",
    "exercise_id" "uuid",
    "sets" integer,
    "reps" integer,
    "weight_kg" numeric,
    "notes" "text",
    "order_index" integer DEFAULT 0
);


ALTER TABLE "public"."group_session_exercises" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."group_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cycle_id" "uuid",
    "label" "text" NOT NULL,
    "notes" "text",
    "difficulty" "text" DEFAULT 'base'::"text" NOT NULL,
    CONSTRAINT "group_sessions_difficulty_check" CHECK (("difficulty" = ANY (ARRAY['base'::"text", 'regression'::"text", 'progression'::"text"]))),
    CONSTRAINT "group_sessions_label_check" CHECK (("label" = ANY (ARRAY['A'::"text", 'B'::"text", 'C'::"text"])))
);


ALTER TABLE "public"."group_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."group_template_session_exercises" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "template_session_id" "uuid",
    "exercise_id" "uuid",
    "sets" integer NOT NULL,
    "reps" integer NOT NULL,
    "weight_kg" numeric(6,2),
    "notes" "text",
    "order_index" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."group_template_session_exercises" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."group_template_sessions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "template_id" "uuid",
    "week_number" integer NOT NULL,
    "day_of_week" integer NOT NULL,
    "order_index" integer DEFAULT 0 NOT NULL,
    "notes" "text",
    CONSTRAINT "group_template_sessions_day_of_week_check" CHECK ((("day_of_week" >= 1) AND ("day_of_week" <= 7)))
);


ALTER TABLE "public"."group_template_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."movement_patterns" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL
);


ALTER TABLE "public"."movement_patterns" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."muscle_groups" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL
);


ALTER TABLE "public"."muscle_groups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."objectives" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL
);


ALTER TABLE "public"."objectives" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."plan_session_exercises" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "exercise_id" "uuid" NOT NULL,
    "sets" integer NOT NULL,
    "reps" integer NOT NULL,
    "weight_kg" numeric(6,2),
    "notes" "text",
    "order_index" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."plan_session_exercises" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."plan_sessions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "plan_id" "uuid" NOT NULL,
    "session_date" "date" NOT NULL,
    "order_index" integer DEFAULT 0 NOT NULL,
    "notes" "text",
    "session_label" "text",
    "session_time" time without time zone,
    CONSTRAINT "plan_sessions_session_label_check" CHECK (("session_label" = ANY (ARRAY['A'::"text", 'B'::"text", 'C'::"text"])))
);


ALTER TABLE "public"."plan_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "full_name" "text",
    "avatar_url" "text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "phone" "text",
    "hire_date" "date",
    "specialties" "text"[] DEFAULT ARRAY[]::"text"[],
    "is_active" boolean DEFAULT true NOT NULL,
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['employee'::"text", 'client'::"text", 'admin'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."public_holidays" (
    "date" "date" NOT NULL,
    "name" "text" NOT NULL,
    "scope" "text" DEFAULT 'national'::"text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "is_override" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."public_holidays" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."screen_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "screen_id" "uuid" NOT NULL,
    "session_type" "text" NOT NULL,
    "client_id" "uuid",
    "plan_session_id" "uuid",
    "group_session_id" "uuid",
    "assigned_by" "uuid" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ended_at" timestamp with time zone,
    CONSTRAINT "screen_assignments_session_type_check" CHECK (("session_type" = ANY (ARRAY['individual'::"text", 'group'::"text"])))
);


ALTER TABLE "public"."screen_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."screens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "location" "text",
    "access_token" "text" DEFAULT "encode"("extensions"."gen_random_bytes"(32), 'hex'::"text") NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."screens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."session_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "plan_session_id" "uuid",
    "client_id" "uuid",
    "employee_id" "uuid",
    "date" "date" NOT NULL,
    "status" "text" DEFAULT 'in_progress'::"text" NOT NULL,
    "notes" "text",
    "started_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "session_logs_status_check" CHECK (("status" = ANY (ARRAY['in_progress'::"text", 'completed'::"text"])))
);


ALTER TABLE "public"."session_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."training_plans" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "level" integer NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "duration_months" integer,
    "weekly_frequency" integer,
    "session_duration" integer,
    "start_date" "date" NOT NULL,
    "end_date" "date",
    "group_template_id" "uuid",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "cycle_id" "uuid",
    "assigned_employee_id" "uuid",
    CONSTRAINT "training_plans_level_check" CHECK (("level" = ANY (ARRAY[1, 2, 3]))),
    CONSTRAINT "training_plans_session_duration_check" CHECK (("session_duration" = ANY (ARRAY[30, 60]))),
    CONSTRAINT "training_plans_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'completed'::"text", 'draft'::"text"]))),
    CONSTRAINT "training_plans_type_check" CHECK (("type" = ANY (ARRAY['individual'::"text", 'group'::"text"])))
);


ALTER TABLE "public"."training_plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."training_session_clients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "difficulty" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "training_session_clients_difficulty_check" CHECK (("difficulty" = ANY (ARRAY['regression'::"text", 'base'::"text", 'progression'::"text"])))
);


ALTER TABLE "public"."training_session_clients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."training_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" "text" NOT NULL,
    "session_date" "date" NOT NULL,
    "session_time" time without time zone NOT NULL,
    "assigned_employee_id" "uuid",
    "session_label" "text",
    "cycle_id" "uuid",
    "plan_id" "uuid",
    "day_index" integer,
    "max_clients" integer,
    "status" "text" DEFAULT 'scheduled'::"text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "training_sessions_day_index_check" CHECK ((("day_index" >= 0) AND ("day_index" <= 19))),
    CONSTRAINT "training_sessions_session_label_check" CHECK (("session_label" = ANY (ARRAY['A'::"text", 'B'::"text", 'C'::"text"]))),
    CONSTRAINT "training_sessions_status_check" CHECK (("status" = ANY (ARRAY['scheduled'::"text", 'completed'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "training_sessions_type_check" CHECK (("type" = ANY (ARRAY['individual'::"text", 'group'::"text"])))
);


ALTER TABLE "public"."training_sessions" OWNER TO "postgres";


ALTER TABLE ONLY "public"."body_zones"
    ADD CONSTRAINT "body_zones_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."body_zones"
    ADD CONSTRAINT "body_zones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cycle_template_days"
    ADD CONSTRAINT "cycle_template_days_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cycle_template_days"
    ADD CONSTRAINT "cycle_template_days_template_id_day_index_key" UNIQUE ("template_id", "day_index");



ALTER TABLE ONLY "public"."cycle_template_slots"
    ADD CONSTRAINT "cycle_template_slots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cycle_template_slots"
    ADD CONSTRAINT "cycle_template_slots_template_id_day_of_week_session_time_key" UNIQUE ("template_id", "day_of_week", "session_time");



ALTER TABLE ONLY "public"."cycle_templates"
    ADD CONSTRAINT "cycle_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."equipment"
    ADD CONSTRAINT "equipment_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."equipment"
    ADD CONSTRAINT "equipment_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."exercise_logs"
    ADD CONSTRAINT "exercise_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."exercise_movement_patterns"
    ADD CONSTRAINT "exercise_movement_patterns_pkey" PRIMARY KEY ("exercise_id", "movement_pattern_id");



ALTER TABLE ONLY "public"."exercise_muscle_groups"
    ADD CONSTRAINT "exercise_muscle_groups_pkey" PRIMARY KEY ("exercise_id", "muscle_group_id");



ALTER TABLE ONLY "public"."exercises"
    ADD CONSTRAINT "exercises_exercise_code_key" UNIQUE ("exercise_code");



ALTER TABLE ONLY "public"."exercises"
    ADD CONSTRAINT "exercises_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."group_cycle_slot_clients"
    ADD CONSTRAINT "group_cycle_slot_clients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."group_cycle_slot_clients"
    ADD CONSTRAINT "group_cycle_slot_clients_slot_id_client_id_key" UNIQUE ("slot_id", "client_id");



ALTER TABLE ONLY "public"."group_cycle_slots"
    ADD CONSTRAINT "group_cycle_slots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."group_cycles"
    ADD CONSTRAINT "group_cycles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."group_plan_templates"
    ADD CONSTRAINT "group_plan_templates_level_key" UNIQUE ("level");



ALTER TABLE ONLY "public"."group_plan_templates"
    ADD CONSTRAINT "group_plan_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."group_session_exercises"
    ADD CONSTRAINT "group_session_exercises_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."group_sessions"
    ADD CONSTRAINT "group_sessions_cycle_id_label_difficulty_key" UNIQUE ("cycle_id", "label", "difficulty");



ALTER TABLE ONLY "public"."group_sessions"
    ADD CONSTRAINT "group_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."group_template_session_exercises"
    ADD CONSTRAINT "group_template_session_exercises_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."group_template_sessions"
    ADD CONSTRAINT "group_template_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."movement_patterns"
    ADD CONSTRAINT "movement_patterns_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."movement_patterns"
    ADD CONSTRAINT "movement_patterns_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."muscle_groups"
    ADD CONSTRAINT "muscle_groups_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."muscle_groups"
    ADD CONSTRAINT "muscle_groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."objectives"
    ADD CONSTRAINT "objectives_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."objectives"
    ADD CONSTRAINT "objectives_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."plan_session_exercises"
    ADD CONSTRAINT "plan_session_exercises_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."plan_sessions"
    ADD CONSTRAINT "plan_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."public_holidays"
    ADD CONSTRAINT "public_holidays_pkey" PRIMARY KEY ("date");



ALTER TABLE ONLY "public"."screen_assignments"
    ADD CONSTRAINT "screen_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."screens"
    ADD CONSTRAINT "screens_access_token_key" UNIQUE ("access_token");



ALTER TABLE ONLY "public"."screens"
    ADD CONSTRAINT "screens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."session_logs"
    ADD CONSTRAINT "session_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."training_plans"
    ADD CONSTRAINT "training_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."training_session_clients"
    ADD CONSTRAINT "training_session_clients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."training_session_clients"
    ADD CONSTRAINT "training_session_clients_session_id_client_id_key" UNIQUE ("session_id", "client_id");



ALTER TABLE ONLY "public"."training_sessions"
    ADD CONSTRAINT "training_sessions_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_training_sessions_cycle" ON "public"."training_sessions" USING "btree" ("cycle_id");



CREATE INDEX "idx_training_sessions_date" ON "public"."training_sessions" USING "btree" ("session_date");



CREATE INDEX "idx_training_sessions_employee" ON "public"."training_sessions" USING "btree" ("assigned_employee_id", "session_date");



CREATE INDEX "idx_training_sessions_plan" ON "public"."training_sessions" USING "btree" ("plan_id");



CREATE INDEX "idx_tsc_client" ON "public"."training_session_clients" USING "btree" ("client_id");



CREATE INDEX "idx_tsc_session" ON "public"."training_session_clients" USING "btree" ("session_id");



CREATE INDEX "screen_assignments_active_idx" ON "public"."screen_assignments" USING "btree" ("screen_id", "ended_at") WHERE ("ended_at" IS NULL);



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cycle_template_days"
    ADD CONSTRAINT "cycle_template_days_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."cycle_templates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cycle_template_slots"
    ADD CONSTRAINT "cycle_template_slots_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."cycle_templates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cycle_templates"
    ADD CONSTRAINT "cycle_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."exercise_logs"
    ADD CONSTRAINT "exercise_logs_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id");



ALTER TABLE ONLY "public"."exercise_logs"
    ADD CONSTRAINT "exercise_logs_plan_exercise_id_fkey" FOREIGN KEY ("plan_exercise_id") REFERENCES "public"."plan_session_exercises"("id");



ALTER TABLE ONLY "public"."exercise_logs"
    ADD CONSTRAINT "exercise_logs_session_log_id_fkey" FOREIGN KEY ("session_log_id") REFERENCES "public"."session_logs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."exercise_movement_patterns"
    ADD CONSTRAINT "exercise_movement_patterns_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."exercise_movement_patterns"
    ADD CONSTRAINT "exercise_movement_patterns_movement_pattern_id_fkey" FOREIGN KEY ("movement_pattern_id") REFERENCES "public"."movement_patterns"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."exercise_muscle_groups"
    ADD CONSTRAINT "exercise_muscle_groups_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."exercise_muscle_groups"
    ADD CONSTRAINT "exercise_muscle_groups_muscle_group_id_fkey" FOREIGN KEY ("muscle_group_id") REFERENCES "public"."muscle_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."exercises"
    ADD CONSTRAINT "exercises_body_zone_id_fkey" FOREIGN KEY ("body_zone_id") REFERENCES "public"."body_zones"("id");



ALTER TABLE ONLY "public"."exercises"
    ADD CONSTRAINT "exercises_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id");



ALTER TABLE ONLY "public"."exercises"
    ADD CONSTRAINT "exercises_movement_pattern_id_fkey" FOREIGN KEY ("movement_pattern_id") REFERENCES "public"."movement_patterns"("id");



ALTER TABLE ONLY "public"."exercises"
    ADD CONSTRAINT "exercises_objective_id_fkey" FOREIGN KEY ("objective_id") REFERENCES "public"."objectives"("id");



ALTER TABLE ONLY "public"."exercises"
    ADD CONSTRAINT "exercises_progression_id_fkey" FOREIGN KEY ("progression_id") REFERENCES "public"."exercises"("id");



ALTER TABLE ONLY "public"."exercises"
    ADD CONSTRAINT "exercises_regression_id_fkey" FOREIGN KEY ("regression_id") REFERENCES "public"."exercises"("id");



ALTER TABLE ONLY "public"."group_cycle_slot_clients"
    ADD CONSTRAINT "group_cycle_slot_clients_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id");



ALTER TABLE ONLY "public"."group_cycle_slot_clients"
    ADD CONSTRAINT "group_cycle_slot_clients_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "public"."group_cycle_slots"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_cycle_slots"
    ADD CONSTRAINT "group_cycle_slots_assigned_employee_id_fkey" FOREIGN KEY ("assigned_employee_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."group_cycle_slots"
    ADD CONSTRAINT "group_cycle_slots_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "public"."group_cycles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_cycles"
    ADD CONSTRAINT "group_cycles_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."group_session_exercises"
    ADD CONSTRAINT "group_session_exercises_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id");



ALTER TABLE ONLY "public"."group_session_exercises"
    ADD CONSTRAINT "group_session_exercises_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."group_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_sessions"
    ADD CONSTRAINT "group_sessions_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "public"."group_cycles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_template_session_exercises"
    ADD CONSTRAINT "group_template_session_exercises_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_template_session_exercises"
    ADD CONSTRAINT "group_template_session_exercises_template_session_id_fkey" FOREIGN KEY ("template_session_id") REFERENCES "public"."group_template_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_template_sessions"
    ADD CONSTRAINT "group_template_sessions_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."group_plan_templates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."plan_session_exercises"
    ADD CONSTRAINT "plan_session_exercises_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."plan_session_exercises"
    ADD CONSTRAINT "plan_session_exercises_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."plan_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."plan_sessions"
    ADD CONSTRAINT "plan_sessions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."training_plans"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."screen_assignments"
    ADD CONSTRAINT "screen_assignments_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."screen_assignments"
    ADD CONSTRAINT "screen_assignments_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."screen_assignments"
    ADD CONSTRAINT "screen_assignments_plan_session_id_fkey" FOREIGN KEY ("plan_session_id") REFERENCES "public"."plan_sessions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."screen_assignments"
    ADD CONSTRAINT "screen_assignments_screen_id_fkey" FOREIGN KEY ("screen_id") REFERENCES "public"."screens"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_logs"
    ADD CONSTRAINT "session_logs_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_logs"
    ADD CONSTRAINT "session_logs_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."session_logs"
    ADD CONSTRAINT "session_logs_plan_session_id_fkey" FOREIGN KEY ("plan_session_id") REFERENCES "public"."plan_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."training_plans"
    ADD CONSTRAINT "training_plans_assigned_employee_id_fkey" FOREIGN KEY ("assigned_employee_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."training_plans"
    ADD CONSTRAINT "training_plans_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."training_plans"
    ADD CONSTRAINT "training_plans_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."training_plans"
    ADD CONSTRAINT "training_plans_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "public"."group_cycles"("id");



ALTER TABLE ONLY "public"."training_plans"
    ADD CONSTRAINT "training_plans_group_template_id_fkey" FOREIGN KEY ("group_template_id") REFERENCES "public"."group_plan_templates"("id");



ALTER TABLE ONLY "public"."training_session_clients"
    ADD CONSTRAINT "training_session_clients_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."training_session_clients"
    ADD CONSTRAINT "training_session_clients_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."training_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."training_sessions"
    ADD CONSTRAINT "training_sessions_assigned_employee_id_fkey" FOREIGN KEY ("assigned_employee_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."training_sessions"
    ADD CONSTRAINT "training_sessions_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "public"."group_cycles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."training_sessions"
    ADD CONSTRAINT "training_sessions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."training_plans"("id") ON DELETE CASCADE;



CREATE POLICY "Autenticados gestionan equipment" ON "public"."equipment" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Autenticados gestionan exercise_movement_patterns" ON "public"."exercise_movement_patterns" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Autenticados gestionan exercise_muscle_groups" ON "public"."exercise_muscle_groups" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Autenticados gestionan exercises" ON "public"."exercises" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Autenticados gestionan objectives" ON "public"."objectives" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Autenticados gestionan plan_session_exercises" ON "public"."plan_session_exercises" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Autenticados gestionan plan_sessions" ON "public"."plan_sessions" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Autenticados gestionan training_plans" ON "public"."training_plans" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Autenticados leen body_zones" ON "public"."body_zones" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Autenticados leen equipment" ON "public"."equipment" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Autenticados leen exercises" ON "public"."exercises" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Autenticados leen movement_patterns" ON "public"."movement_patterns" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Autenticados leen muscle_groups" ON "public"."muscle_groups" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Autenticados leen objectives" ON "public"."objectives" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Cliente lee sus ejercicios" ON "public"."plan_session_exercises" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (("public"."plan_sessions" "ps"
     JOIN "public"."training_plans" "tp" ON (("tp"."id" = "ps"."plan_id")))
     JOIN "public"."clients" "c" ON (("c"."id" = "tp"."client_id")))
  WHERE (("ps"."id" = "plan_session_exercises"."session_id") AND ("c"."user_id" = "auth"."uid"())))));



CREATE POLICY "Cliente lee sus planes" ON "public"."training_plans" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."clients"
  WHERE (("clients"."id" = "training_plans"."client_id") AND ("clients"."user_id" = "auth"."uid"())))));



CREATE POLICY "Cliente lee sus sesiones" ON "public"."plan_sessions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."training_plans" "tp"
     JOIN "public"."clients" "c" ON (("c"."id" = "tp"."client_id")))
  WHERE (("tp"."id" = "plan_sessions"."plan_id") AND ("c"."user_id" = "auth"."uid"())))));



CREATE POLICY "Clientes leen ejercicio-musculo" ON "public"."exercise_muscle_groups" FOR SELECT USING ("public"."is_client"());



CREATE POLICY "Clientes leen ejercicio-patron" ON "public"."exercise_movement_patterns" FOR SELECT USING ("public"."is_client"());



CREATE POLICY "Clientes leen ejercicios" ON "public"."exercises" FOR SELECT USING ("public"."is_client"());



CREATE POLICY "Clientes leen ejercicios plantilla" ON "public"."group_template_session_exercises" FOR SELECT USING ("public"."is_client"());



CREATE POLICY "Clientes leen grupos musculares" ON "public"."muscle_groups" FOR SELECT USING ("public"."is_client"());



CREATE POLICY "Clientes leen patrones" ON "public"."movement_patterns" FOR SELECT USING ("public"."is_client"());



CREATE POLICY "Clientes leen plantillas grupales" ON "public"."group_plan_templates" FOR SELECT USING ("public"."is_client"());



CREATE POLICY "Clientes leen sesiones plantilla" ON "public"."group_template_sessions" FOR SELECT USING ("public"."is_client"());



CREATE POLICY "Empleados gestionan ejercicio-musculo" ON "public"."exercise_muscle_groups" USING ("public"."is_employee"());



CREATE POLICY "Empleados gestionan ejercicio-patron" ON "public"."exercise_movement_patterns" USING ("public"."is_employee"());



CREATE POLICY "Empleados gestionan ejercicios" ON "public"."exercises" USING ("public"."is_employee"());



CREATE POLICY "Empleados gestionan ejercicios plantilla" ON "public"."group_template_session_exercises" USING ("public"."is_employee"());



CREATE POLICY "Empleados gestionan ejercicios sesion" ON "public"."plan_session_exercises" USING ("public"."is_employee"());



CREATE POLICY "Empleados gestionan grupos musculares" ON "public"."muscle_groups" USING ("public"."is_employee"());



CREATE POLICY "Empleados gestionan patrones" ON "public"."movement_patterns" USING ("public"."is_employee"());



CREATE POLICY "Empleados gestionan planes" ON "public"."training_plans" USING ("public"."is_employee"());



CREATE POLICY "Empleados gestionan plantillas grupales" ON "public"."group_plan_templates" USING ("public"."is_employee"());



CREATE POLICY "Empleados gestionan sesiones" ON "public"."plan_sessions" USING ("public"."is_employee"());



CREATE POLICY "Empleados gestionan sesiones plantilla" ON "public"."group_template_sessions" USING ("public"."is_employee"());



CREATE POLICY "Empleados leen todos los perfiles" ON "public"."profiles" FOR SELECT USING ("public"."is_employee"());



CREATE POLICY "Leer perfil propio" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Usuarios autenticados pueden actualizar clientes" ON "public"."clients" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Usuarios autenticados pueden insertar clientes" ON "public"."clients" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Usuarios autenticados pueden leer clientes" ON "public"."clients" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Usuarios editan su propio perfil" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Usuarios insertan su propio perfil" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Usuarios ven su propio perfil" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "auth_all_cycle_template_days" ON "public"."cycle_template_days" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "auth_all_cycle_template_slots" ON "public"."cycle_template_slots" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "auth_all_cycle_templates" ON "public"."cycle_templates" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "auth_all_training_session_clients" ON "public"."training_session_clients" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "auth_all_training_sessions" ON "public"."training_sessions" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "authenticated can all" ON "public"."group_cycle_slot_clients" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "authenticated can all" ON "public"."group_cycle_slots" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "authenticated_all" ON "public"."public_holidays" USING (("auth"."role"() = 'authenticated'::"text"));



ALTER TABLE "public"."body_zones" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."clients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cycle_template_days" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cycle_template_slots" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cycle_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."equipment" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."exercise_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."exercise_movement_patterns" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."exercise_muscle_groups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."exercises" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."group_cycle_slot_clients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."group_cycle_slots" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."group_cycles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."group_plan_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."group_session_exercises" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."group_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."group_template_session_exercises" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."group_template_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."movement_patterns" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."muscle_groups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."objectives" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."plan_session_exercises" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."plan_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."public_holidays" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."screen_assignments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "screen_assignments_employee_update" ON "public"."screen_assignments" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "screen_assignments_employee_write" ON "public"."screen_assignments" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "screen_assignments_public_read" ON "public"."screen_assignments" FOR SELECT USING (true);



ALTER TABLE "public"."screens" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "screens_employee_insert" ON "public"."screens" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "screens_employee_update" ON "public"."screens" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "screens_public_read" ON "public"."screens" FOR SELECT USING (true);



ALTER TABLE "public"."session_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."training_plans" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."training_session_clients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."training_sessions" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."body_zones" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."body_zones" TO "authenticated";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."body_zones" TO "service_role";



GRANT ALL ON TABLE "public"."clients" TO "anon";
GRANT ALL ON TABLE "public"."clients" TO "authenticated";
GRANT ALL ON TABLE "public"."clients" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."cycle_template_days" TO "anon";
GRANT ALL ON TABLE "public"."cycle_template_days" TO "authenticated";
GRANT ALL ON TABLE "public"."cycle_template_days" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."cycle_template_slots" TO "anon";
GRANT ALL ON TABLE "public"."cycle_template_slots" TO "authenticated";
GRANT ALL ON TABLE "public"."cycle_template_slots" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."cycle_templates" TO "anon";
GRANT ALL ON TABLE "public"."cycle_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."cycle_templates" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."equipment" TO "anon";
GRANT ALL ON TABLE "public"."equipment" TO "authenticated";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."equipment" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."exercise_logs" TO "anon";
GRANT ALL ON TABLE "public"."exercise_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."exercise_logs" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."exercise_movement_patterns" TO "anon";
GRANT ALL ON TABLE "public"."exercise_movement_patterns" TO "authenticated";
GRANT ALL ON TABLE "public"."exercise_movement_patterns" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."exercise_muscle_groups" TO "anon";
GRANT ALL ON TABLE "public"."exercise_muscle_groups" TO "authenticated";
GRANT ALL ON TABLE "public"."exercise_muscle_groups" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."exercises" TO "anon";
GRANT ALL ON TABLE "public"."exercises" TO "authenticated";
GRANT ALL ON TABLE "public"."exercises" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."group_cycle_slot_clients" TO "anon";
GRANT ALL ON TABLE "public"."group_cycle_slot_clients" TO "authenticated";
GRANT ALL ON TABLE "public"."group_cycle_slot_clients" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."group_cycle_slots" TO "anon";
GRANT ALL ON TABLE "public"."group_cycle_slots" TO "authenticated";
GRANT ALL ON TABLE "public"."group_cycle_slots" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."group_cycles" TO "anon";
GRANT ALL ON TABLE "public"."group_cycles" TO "authenticated";
GRANT ALL ON TABLE "public"."group_cycles" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."group_plan_templates" TO "anon";
GRANT ALL ON TABLE "public"."group_plan_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."group_plan_templates" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."group_session_exercises" TO "anon";
GRANT ALL ON TABLE "public"."group_session_exercises" TO "authenticated";
GRANT ALL ON TABLE "public"."group_session_exercises" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."group_sessions" TO "anon";
GRANT ALL ON TABLE "public"."group_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."group_sessions" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."group_template_session_exercises" TO "anon";
GRANT ALL ON TABLE "public"."group_template_session_exercises" TO "authenticated";
GRANT ALL ON TABLE "public"."group_template_session_exercises" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."group_template_sessions" TO "anon";
GRANT ALL ON TABLE "public"."group_template_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."group_template_sessions" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."movement_patterns" TO "anon";
GRANT ALL ON TABLE "public"."movement_patterns" TO "authenticated";
GRANT ALL ON TABLE "public"."movement_patterns" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."muscle_groups" TO "anon";
GRANT ALL ON TABLE "public"."muscle_groups" TO "authenticated";
GRANT ALL ON TABLE "public"."muscle_groups" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."objectives" TO "anon";
GRANT ALL ON TABLE "public"."objectives" TO "authenticated";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."objectives" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."plan_session_exercises" TO "anon";
GRANT ALL ON TABLE "public"."plan_session_exercises" TO "authenticated";
GRANT ALL ON TABLE "public"."plan_session_exercises" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."plan_sessions" TO "anon";
GRANT ALL ON TABLE "public"."plan_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."plan_sessions" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."public_holidays" TO "anon";
GRANT ALL ON TABLE "public"."public_holidays" TO "authenticated";
GRANT ALL ON TABLE "public"."public_holidays" TO "service_role";



GRANT ALL ON TABLE "public"."screen_assignments" TO "anon";
GRANT ALL ON TABLE "public"."screen_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."screen_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."screens" TO "anon";
GRANT ALL ON TABLE "public"."screens" TO "authenticated";
GRANT ALL ON TABLE "public"."screens" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."session_logs" TO "anon";
GRANT ALL ON TABLE "public"."session_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."session_logs" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."training_plans" TO "anon";
GRANT ALL ON TABLE "public"."training_plans" TO "authenticated";
GRANT ALL ON TABLE "public"."training_plans" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."training_session_clients" TO "anon";
GRANT ALL ON TABLE "public"."training_session_clients" TO "authenticated";
GRANT ALL ON TABLE "public"."training_session_clients" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."training_sessions" TO "anon";
GRANT ALL ON TABLE "public"."training_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."training_sessions" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "service_role";









-- =============================================================================
-- Parte 2 — objetos fuera del esquema public
-- =============================================================================

-- Alta de usuarios: crea la fila en public.profiles al crear un usuario en Auth
drop trigger if exists "on_auth_user_created" on "auth"."users";
create trigger "on_auth_user_created"
  after insert on "auth"."users"
  for each row execute function "public"."handle_new_user"();

-- RLS automática: activa row level security en toda tabla nueva de public
do $$
begin
  if not exists (select 1 from pg_event_trigger where evtname = 'ensure_rls') then
    create event trigger "ensure_rls" on ddl_command_end
      when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      execute function "public"."rls_auto_enable"();
  end if;
exception
  when insufficient_privilege then
    raise notice 'ensure_rls: sin permisos para crear el event trigger; actívalo desde el panel de Supabase';
end
$$;

-- Storage: bucket público de avatares de empleados
insert into "storage"."buckets" ("id", "name", "public")
values ('avatars', 'avatars', true)
on conflict ("id") do nothing;

drop policy if exists "Avatar público para lectura" on "storage"."objects";
create policy "Avatar público para lectura"
  on "storage"."objects" for select
  to public
  using ("bucket_id" = 'avatars');

drop policy if exists "Usuarios suben su propio avatar" on "storage"."objects";
create policy "Usuarios suben su propio avatar"
  on "storage"."objects" for insert
  to authenticated
  with check (
    "bucket_id" = 'avatars'
    and "name" = ((auth.uid())::text || '.' || split_part("name", '.', 2))
  );

drop policy if exists "Usuarios actualizan su propio avatar" on "storage"."objects";
create policy "Usuarios actualizan su propio avatar"
  on "storage"."objects" for update
  to authenticated
  using ("bucket_id" = 'avatars' and "owner" = auth.uid());

-- Realtime: las pantallas de TrainWall escuchan cambios en screen_assignments
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'screen_assignments'
  ) then
    alter publication "supabase_realtime" add table "public"."screen_assignments";
  end if;
end
$$;

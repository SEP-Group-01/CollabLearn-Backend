-- ====================================================
-- QUIZ SERVICE DATABASE SCHEMA (v2)
-- Migration: 003_create_quiz_tables_v2.sql
-- Adds `quizzes`, `questions`, `quiz_attempt` and `requests` tables (IF NOT EXISTS)
-- ====================================================

-- Ensure pgcrypto extension for gen_random_uuid (used in some PG setups)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- quizzes table
CREATE TABLE IF NOT EXISTS public.quizzes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL,
  creator_id uuid NOT NULL,
  title varchar(255),
  description text,
  time_allocated integer,
  total_marks integer,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  constraint quizzes_pkey PRIMARY KEY (id)
);

-- questions table
CREATE TABLE IF NOT EXISTS public.questions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL,
  question character varying(250) NOT NULL,
  attachment_url character varying(1024),
  marks double precision NOT NULL,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  constraint questions_pkey PRIMARY KEY (id)
);

-- quiz_attempt table (singular name as requested)
CREATE TABLE IF NOT EXISTS public.quiz_attempt (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL,
  user_id uuid NOT NULL,
  attempt_nummber integer,
  time_taken time without time zone,
  marks double precision,
  answers jsonb DEFAULT '{}',
  status varchar(20) DEFAULT 'active',
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  constraint quiz_attempt_pkey PRIMARY KEY (id)
);

-- requests table (if you need it for moderation/workflow)
CREATE TABLE IF NOT EXISTS public.requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  user_id uuid NOT NULL,
  status character varying(20) NOT NULL DEFAULT 'Pending',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  constraint requests_pkey PRIMARY KEY (id)
);

-- Add foreign keys where possible (don't add FK to users if table is managed elsewhere)
ALTER TABLE IF EXISTS public.questions
  ADD CONSTRAINT IF NOT EXISTS questions_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES public.quizzes (id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.quiz_attempt
  ADD CONSTRAINT IF NOT EXISTS quiz_attempt_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES public.quizzes (id) ON DELETE CASCADE;

-- Trigger function for updated_at (reuse if already defined in other migrations)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to requests updated_at
CREATE TRIGGER IF NOT EXISTS update_requests_updated_at BEFORE UPDATE ON public.requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_quizzes_thread_id ON public.quizzes(thread_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_creator_id ON public.quizzes(creator_id);
CREATE INDEX IF NOT EXISTS idx_questions_quiz_id ON public.questions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempt_quiz_id ON public.quiz_attempt(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempt_user_id ON public.quiz_attempt(user_id);

-- End of migration

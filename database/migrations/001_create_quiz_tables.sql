-- ====================================================
-- QUIZ SERVICE DATABASE SCHEMA
-- Migration: 001_create_quiz_tables.sql
-- ====================================================

-- Enable UUID extension for auto-generating IDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ====================================================
-- 1. QUIZ_QUIZZES TABLE
-- ====================================================
CREATE TABLE public.quiz_quizzes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    time_allocated INTEGER NOT NULL, -- in minutes
    total_marks INTEGER NOT NULL,
    tags TEXT[] DEFAULT '{}',
    resource_tags TEXT[] DEFAULT '{}',
    creator_id UUID NOT NULL,
    workspace_id UUID NOT NULL,
    thread_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ====================================================
-- 2. QUIZ_QUESTIONS TABLE
-- ====================================================
CREATE TABLE public.quiz_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quiz_id UUID NOT NULL REFERENCES public.quiz_quizzes(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    image TEXT, -- URL to image if any
    marks INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ====================================================
-- 3. QUIZ_OPTIONS TABLE
-- ====================================================
CREATE TABLE public.quiz_options (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_id UUID NOT NULL REFERENCES public.quiz_questions(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    image TEXT, -- URL to image if any
    is_correct BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ====================================================
-- 4. QUIZ_ATTEMPTS TABLE (with time management)
-- ====================================================
CREATE TABLE public.quiz_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quiz_id UUID NOT NULL REFERENCES public.quiz_quizzes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    workspace_id UUID NOT NULL,
    answers JSONB DEFAULT '{}',
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    finished_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    marks_obtained INTEGER,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'submitted', 'expired')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ====================================================
-- INDEXES FOR PERFORMANCE
-- ====================================================

CREATE INDEX idx_quiz_quizzes_workspace_id ON public.quiz_quizzes(workspace_id);
CREATE INDEX idx_quiz_quizzes_creator_id ON public.quiz_quizzes(creator_id);
CREATE INDEX idx_quiz_questions_quiz_id ON public.quiz_questions(quiz_id);
CREATE INDEX idx_quiz_options_question_id ON public.quiz_options(question_id);
CREATE INDEX idx_quiz_attempts_quiz_id ON public.quiz_attempts(quiz_id);
CREATE INDEX idx_quiz_attempts_user_id ON public.quiz_attempts(user_id);
CREATE INDEX idx_quiz_attempts_workspace_id ON public.quiz_attempts(workspace_id);
CREATE INDEX idx_quiz_attempts_status ON public.quiz_attempts(status);
CREATE INDEX idx_quiz_attempts_expires_at ON public.quiz_attempts(expires_at);
CREATE INDEX idx_quiz_attempts_user_quiz_status ON public.quiz_attempts(user_id, quiz_id, status);

-- ====================================================
-- TRIGGERS FOR AUTO-UPDATE TIMESTAMPS
-- ====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_quiz_quizzes_updated_at BEFORE UPDATE ON public.quiz_quizzes 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_quiz_questions_updated_at BEFORE UPDATE ON public.quiz_questions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_quiz_attempts_updated_at BEFORE UPDATE ON public.quiz_attempts 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================

ALTER TABLE public.quiz_quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can access quiz_quizzes" ON public.quiz_quizzes
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can access quiz_questions" ON public.quiz_questions
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can access quiz_options" ON public.quiz_options
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can access quiz_attempts" ON public.quiz_attempts
    FOR ALL USING (auth.role() = 'service_role');
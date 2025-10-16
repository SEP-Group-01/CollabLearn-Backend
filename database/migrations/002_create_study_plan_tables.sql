-- ====================================================
-- STUDY PLAN / RESOURCES SCHEMA
-- Migration: 002_create_study_plan_tables.sql
-- ====================================================

-- Ensure uuid extension exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table to store workspaces (minimal)
CREATE TABLE IF NOT EXISTS public.workspaces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(500) NOT NULL,
    description TEXT,
    owner_id UUID NOT NULL,
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table to store threads (minimal)
CREATE TABLE IF NOT EXISTS public.threads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name VARCHAR(500) NOT NULL,
    description TEXT,
    total_estimated_hours DECIMAL(5,2) DEFAULT 0.00,
    difficulty_level VARCHAR(20) DEFAULT 'beginner' CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table to store study resources (videos, documents, quizzes, etc.)
CREATE TABLE IF NOT EXISTS public.study_resources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(500) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('video', 'document', 'quiz', 'link', 'reading')),
    thread_id UUID NOT NULL REFERENCES public.threads(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    sequence_number INTEGER NOT NULL,
    estimated_time_minutes INTEGER NOT NULL DEFAULT 60,
    content_url TEXT,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(thread_id, sequence_number)
);

-- Table to track user progress on resources
CREATE TABLE IF NOT EXISTS public.user_progress (
    user_id UUID NOT NULL,
    resource_id UUID NOT NULL,
    completion_status VARCHAR(50) NOT NULL DEFAULT 'not_started' CHECK (completion_status IN ('not_started', 'in_progress', 'completed', 'needs_revision')),
    progress_percentage DECIMAL(5,2) DEFAULT 0.00 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    actual_time_spent INTEGER DEFAULT 0,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, resource_id),
    FOREIGN KEY (resource_id) REFERENCES public.study_resources(id) ON DELETE CASCADE
);

-- Table to store user's available time slots
CREATE TABLE IF NOT EXISTS public.study_slots (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    day_of_week VARCHAR(20) NOT NULL CHECK (day_of_week IN ('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday')),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_free BOOLEAN DEFAULT true,
    recurring BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CHECK (end_time > start_time)
);

-- Enhanced study plans table
CREATE TABLE IF NOT EXISTS public.study_plans (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    input_data JSONB NOT NULL,
    result JSONB,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done','error')),
    total_weeks INTEGER DEFAULT 0,
    coverage_percentage DECIMAL(5,2) DEFAULT 0.00,
    workspaces_included UUID[],
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table to store scheduled tasks from generated plans
CREATE TABLE IF NOT EXISTS public.scheduled_tasks (
    id SERIAL PRIMARY KEY,
    plan_id INTEGER NOT NULL REFERENCES public.study_plans(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    resource_id UUID NOT NULL REFERENCES public.study_resources(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    thread_id UUID NOT NULL REFERENCES public.threads(id) ON DELETE CASCADE,
    week_number INTEGER NOT NULL,
    day_of_week VARCHAR(20) NOT NULL CHECK (day_of_week IN ('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday')),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    allocated_time_minutes INTEGER NOT NULL,
    completed BOOLEAN DEFAULT false,
    actual_completion_time INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table to track user access to workspace threads
CREATE TABLE IF NOT EXISTS public.user_workspace_threads (
    user_id UUID NOT NULL,
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    thread_id UUID NOT NULL REFERENCES public.threads(id) ON DELETE CASCADE,
    access_granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    PRIMARY KEY (user_id, workspace_id, thread_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_study_resources_thread ON public.study_resources(thread_id, sequence_number);
CREATE INDEX IF NOT EXISTS idx_study_resources_workspace ON public.study_resources(workspace_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_user ON public.user_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_resource ON public.user_progress(resource_id);
CREATE INDEX IF NOT EXISTS idx_study_slots_user ON public.study_slots(user_id);
CREATE INDEX IF NOT EXISTS idx_study_plans_user ON public.study_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_plan ON public.scheduled_tasks(plan_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_user ON public.scheduled_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_user_workspace_threads_user ON public.user_workspace_threads(user_id);

-- Trigger function to update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- Triggers
CREATE TRIGGER update_study_resources_updated_at BEFORE UPDATE ON public.study_resources FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_user_progress_updated_at BEFORE UPDATE ON public.user_progress FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_study_plans_updated_at BEFORE UPDATE ON public.study_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_workspaces_updated_at BEFORE UPDATE ON public.workspaces FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_threads_updated_at BEFORE UPDATE ON public.threads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- End of migration

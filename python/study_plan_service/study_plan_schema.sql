-- ============================================
-- Study Plan System Migration
-- ============================================
-- This migration creates the complete study plan system with:
-- 1. Weekly recurring time slots (study_slots)
-- 2. Study plans linked to users
-- 3. Scheduled tasks that fill the time slots
-- ============================================

-- Drop existing tables if they exist (for clean migration)
DROP TABLE IF EXISTS scheduled_tasks CASCADE;
DROP TABLE IF EXISTS study_plans CASCADE;
DROP TABLE IF EXISTS study_slots CASCADE;

-- ============================================
-- Table: study_slots
-- Purpose: Store user's available study time slots (recurring weekly)
-- ============================================
CREATE TABLE study_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
    
    -- Time slot boundaries (stored as TIME type for recurring weekly pattern)
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    
    -- Duration in minutes (calculated for convenience)
    duration_minutes INTEGER GENERATED ALWAYS AS (
        EXTRACT(EPOCH FROM (end_time - start_time)) / 60
    ) STORED,
    
    -- Status flag: true if slot is available, false if occupied by a scheduled task
    is_free BOOLEAN DEFAULT true,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CHECK (end_time > start_time),
    CHECK (EXTRACT(EPOCH FROM (end_time - start_time)) / 60 >= 60) -- Minimum 1 hour slot
);

-- Indexes for efficient querying
CREATE INDEX idx_study_slots_user_id ON study_slots(user_id);
CREATE INDEX idx_study_slots_day_free ON study_slots(day_of_week, is_free);
CREATE INDEX idx_study_slots_user_day ON study_slots(user_id, day_of_week);

-- ============================================
-- Table: study_plans
-- Purpose: Store generated study plans for users
-- ============================================
CREATE TABLE study_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Plan configuration
    max_weeks INTEGER NOT NULL DEFAULT 1 CHECK (max_weeks > 0),
    revision_ratio DECIMAL(3,2) DEFAULT 0.25 CHECK (revision_ratio >= 0 AND revision_ratio <= 1),
    
    -- Scheduling rules (stored as JSONB for flexibility)
    scheduling_rules JSONB DEFAULT '{
        "max_consecutive_same_resource": 2,
        "mix_threads_across_workspaces": true,
        "balance_workspace_focus": true
    }'::jsonb,
    
    -- Plan status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'dropped')),
    
    -- Metadata
    plan_start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    plan_end_date DATE NOT NULL,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    dropped_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CHECK (plan_end_date > plan_start_date)
);

-- Indexes
CREATE INDEX idx_study_plans_user_id ON study_plans(user_id);
CREATE INDEX idx_study_plans_status ON study_plans(status);
CREATE INDEX idx_study_plans_user_status ON study_plans(user_id, status);

-- ============================================
-- Table: scheduled_tasks
-- Purpose: Store individual study/revision tasks scheduled in time slots
-- ============================================
CREATE TABLE scheduled_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- References
    study_plan_id UUID NOT NULL REFERENCES study_plans(id) ON DELETE CASCADE,
    study_slot_id UUID NOT NULL REFERENCES study_slots(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    resource_id UUID NOT NULL REFERENCES thread_resources(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    thread_id UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
    
    -- Task details
    task_title VARCHAR(500) NOT NULL,
    task_type VARCHAR(20) NOT NULL CHECK (task_type IN ('study', 'revision')),
    
    -- Scheduling information
    week_number INTEGER NOT NULL CHECK (week_number > 0),
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
    scheduled_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    
    -- Time allocation
    allocated_minutes INTEGER NOT NULL CHECK (allocated_minutes > 0),
    actual_time_spent INTEGER DEFAULT 0,
    
    -- Progress tracking
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped')),
    completion_percentage INTEGER DEFAULT 0 CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
    
    -- User feedback
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    notes TEXT,
    
    -- Timestamps
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CHECK (end_time > start_time),
    UNIQUE(study_slot_id, week_number, scheduled_date)
);

-- Indexes for efficient querying
CREATE INDEX idx_scheduled_tasks_plan ON scheduled_tasks(study_plan_id);
CREATE INDEX idx_scheduled_tasks_slot ON scheduled_tasks(study_slot_id);
CREATE INDEX idx_scheduled_tasks_user ON scheduled_tasks(user_id);
CREATE INDEX idx_scheduled_tasks_resource ON scheduled_tasks(resource_id);
CREATE INDEX idx_scheduled_tasks_workspace ON scheduled_tasks(workspace_id);
CREATE INDEX idx_scheduled_tasks_thread ON scheduled_tasks(thread_id);
CREATE INDEX idx_scheduled_tasks_date ON scheduled_tasks(scheduled_date);
CREATE INDEX idx_scheduled_tasks_status ON scheduled_tasks(status);
CREATE INDEX idx_scheduled_tasks_user_date ON scheduled_tasks(user_id, scheduled_date);
CREATE INDEX idx_scheduled_tasks_user_status ON scheduled_tasks(user_id, status);

-- ============================================
-- Triggers for automatic timestamp updates
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to all tables
CREATE TRIGGER update_study_slots_updated_at BEFORE UPDATE ON study_slots
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_study_plans_updated_at BEFORE UPDATE ON study_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scheduled_tasks_updated_at BEFORE UPDATE ON scheduled_tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Helper Functions
-- ============================================

-- Function to check for overlapping time slots
CREATE OR REPLACE FUNCTION check_slot_overlap(
    p_user_id UUID,
    p_day_of_week INTEGER,
    p_start_time TIME,
    p_end_time TIME,
    p_slot_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    overlap_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO overlap_count
    FROM study_slots
    WHERE user_id = p_user_id
      AND day_of_week = p_day_of_week
      AND (p_slot_id IS NULL OR id != p_slot_id) -- Exclude current slot when updating
      AND (
          (start_time <= p_start_time AND end_time > p_start_time) OR
          (start_time < p_end_time AND end_time >= p_end_time) OR
          (start_time >= p_start_time AND end_time <= p_end_time)
      );
    
    RETURN overlap_count > 0;
END;
$$ LANGUAGE plpgsql;

-- Function to get total available study hours per week for a user
CREATE OR REPLACE FUNCTION get_weekly_study_hours(p_user_id UUID)
RETURNS DECIMAL AS $$
DECLARE
    total_minutes INTEGER;
BEGIN
    SELECT COALESCE(SUM(duration_minutes), 0) INTO total_minutes
    FROM study_slots
    WHERE user_id = p_user_id AND is_free = true;
    
    RETURN total_minutes / 60.0;
END;
$$ LANGUAGE plpgsql;

-- Function to mark slots as occupied/free when tasks are created/deleted
CREATE OR REPLACE FUNCTION update_slot_availability()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Mark slot as occupied when task is scheduled
        UPDATE study_slots
        SET is_free = false
        WHERE id = NEW.study_slot_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        -- Check if there are any other tasks in this slot
        IF NOT EXISTS (
            SELECT 1 FROM scheduled_tasks
            WHERE study_slot_id = OLD.study_slot_id
              AND id != OLD.id
        ) THEN
            -- Mark slot as free if no other tasks exist
            UPDATE study_slots
            SET is_free = true
            WHERE id = OLD.study_slot_id;
        END IF;
        RETURN OLD;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to scheduled_tasks
CREATE TRIGGER manage_slot_availability
    AFTER INSERT OR DELETE ON scheduled_tasks
    FOR EACH ROW EXECUTE FUNCTION update_slot_availability();

-- ============================================
-- Views for easier querying
-- ============================================

-- View: User study schedule overview
CREATE OR REPLACE VIEW user_study_schedule AS
SELECT 
    st.id AS task_id,
    st.user_id,
    st.study_plan_id,
    sp.status AS plan_status,
    st.task_title,
    st.task_type,
    st.scheduled_date,
    st.start_time,
    st.end_time,
    st.allocated_minutes,
    st.actual_time_spent,
    st.status AS task_status,
    st.completion_percentage,
    w.title AS workspace_name,
    t.name AS thread_title,
    tr.title AS resource_title,
    tr.resource_type,
    st.rating,
    st.notes
FROM scheduled_tasks st
JOIN study_plans sp ON st.study_plan_id = sp.id
JOIN workspaces w ON st.workspace_id = w.id
JOIN threads t ON st.thread_id = t.id
JOIN thread_resources tr ON st.resource_id = tr.id
ORDER BY st.scheduled_date, st.start_time;

-- View: User available time slots
CREATE OR REPLACE VIEW user_available_slots AS
SELECT 
    ss.id,
    ss.user_id,
    ss.day_of_week,
    CASE ss.day_of_week
        WHEN 0 THEN 'Sunday'
        WHEN 1 THEN 'Monday'
        WHEN 2 THEN 'Tuesday'
        WHEN 3 THEN 'Wednesday'
        WHEN 4 THEN 'Thursday'
        WHEN 5 THEN 'Friday'
        WHEN 6 THEN 'Saturday'
    END AS day_name,
    ss.start_time,
    ss.end_time,
    ss.duration_minutes,
    ss.is_free,
    ss.created_at
FROM study_slots ss
ORDER BY ss.day_of_week, ss.start_time;

-- ============================================
-- Sample Data Insertion (Optional - for testing)
-- ============================================

-- Comment out these lines in production
-- INSERT INTO study_slots (user_id, day_of_week, start_time, end_time, is_free) 
-- SELECT 
--     id, 
--     1, -- Monday
--     '18:00:00'::TIME,
--     '20:00:00'::TIME,
--     true
-- FROM users LIMIT 1;

-- ============================================
-- Migration Complete
-- ============================================

-- Enhanced database schema for multi-workspace study plan service

-- Table to store study resources (videos, documents, quizzes, etc.)
CREATE TABLE IF NOT EXISTS study_resources (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(500) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('video', 'document', 'quiz', 'link', 'reading')),
    thread_id VARCHAR(255) NOT NULL,
    workspace_id VARCHAR(255) NOT NULL,
    sequence_number INTEGER NOT NULL,
    estimated_time_minutes INTEGER NOT NULL DEFAULT 60,
    content_url TEXT,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(thread_id, sequence_number)
);

-- Table to track user progress on resources
CREATE TABLE IF NOT EXISTS user_progress (
    user_id VARCHAR(255) NOT NULL,
    resource_id VARCHAR(255) NOT NULL,
    completion_status VARCHAR(50) NOT NULL DEFAULT 'not_started' 
        CHECK (completion_status IN ('not_started', 'in_progress', 'completed', 'needs_revision')),
    progress_percentage DECIMAL(5,2) DEFAULT 0.00 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    actual_time_spent INTEGER DEFAULT 0, -- in minutes
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, resource_id),
    FOREIGN KEY (resource_id) REFERENCES study_resources(id) ON DELETE CASCADE
);

-- Table to store user's available time slots
CREATE TABLE IF NOT EXISTS study_slots (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    day_of_week VARCHAR(20) NOT NULL CHECK (day_of_week IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_free BOOLEAN DEFAULT true,
    recurring BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHECK (end_time > start_time)
);

-- Enhanced study plans table
CREATE TABLE IF NOT EXISTS study_plans (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    input_data JSONB NOT NULL, -- Original request data
    result JSONB, -- Generated plan result
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'error')),
    total_weeks INTEGER DEFAULT 0,
    coverage_percentage DECIMAL(5,2) DEFAULT 0.00,
    workspaces_included TEXT[], -- Array of workspace IDs
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table to store scheduled tasks from generated plans
CREATE TABLE IF NOT EXISTS scheduled_tasks (
    id SERIAL PRIMARY KEY,
    plan_id INTEGER NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    resource_id VARCHAR(255) NOT NULL,
    workspace_id VARCHAR(255) NOT NULL,
    thread_id VARCHAR(255) NOT NULL,
    week_number INTEGER NOT NULL,
    day_of_week VARCHAR(20) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    allocated_time_minutes INTEGER NOT NULL,
    completed BOOLEAN DEFAULT false,
    actual_completion_time INTEGER, -- actual time spent in minutes
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (plan_id) REFERENCES study_plans(id) ON DELETE CASCADE,
    FOREIGN KEY (resource_id) REFERENCES study_resources(id) ON DELETE CASCADE
);

-- Table to track user access to workspace threads
CREATE TABLE IF NOT EXISTS user_workspace_threads (
    user_id VARCHAR(255) NOT NULL,
    workspace_id VARCHAR(255) NOT NULL,
    thread_id VARCHAR(255) NOT NULL,
    access_granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    PRIMARY KEY (user_id, workspace_id, thread_id)
);

-- Table to store workspace metadata
CREATE TABLE IF NOT EXISTS workspaces (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(500) NOT NULL,
    description TEXT,
    owner_id VARCHAR(255) NOT NULL,
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table to store thread metadata
CREATE TABLE IF NOT EXISTS threads (
    id VARCHAR(255) PRIMARY KEY,
    workspace_id VARCHAR(255) NOT NULL,
    name VARCHAR(500) NOT NULL,
    description TEXT,
    total_estimated_hours DECIMAL(5,2) DEFAULT 0.00,
    difficulty_level VARCHAR(20) DEFAULT 'beginner' CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_study_resources_thread ON study_resources(thread_id, sequence_number);
CREATE INDEX IF NOT EXISTS idx_study_resources_workspace ON study_resources(workspace_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_user ON user_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_resource ON user_progress(resource_id);
CREATE INDEX IF NOT EXISTS idx_study_slots_user ON study_slots(user_id);
CREATE INDEX IF NOT EXISTS idx_study_plans_user ON study_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_plan ON scheduled_tasks(plan_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_user ON scheduled_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_user_workspace_threads_user ON user_workspace_threads(user_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at
CREATE TRIGGER update_study_resources_updated_at BEFORE UPDATE ON study_resources FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_progress_updated_at BEFORE UPDATE ON user_progress FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_study_plans_updated_at BEFORE UPDATE ON study_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_workspaces_updated_at BEFORE UPDATE ON workspaces FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_threads_updated_at BEFORE UPDATE ON threads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Sample data for testing (optional)
-- INSERT INTO workspaces (id, name, description, owner_id) VALUES 
-- ('ws_1', 'Data Science Fundamentals', 'Learn the basics of data science', 'user_1'),
-- ('ws_2', 'Web Development Bootcamp', 'Full-stack web development course', 'user_1');

-- INSERT INTO threads (id, workspace_id, name, description, total_estimated_hours) VALUES
-- ('thread_1', 'ws_1', 'Python Basics', 'Introduction to Python programming', 10.5),
-- ('thread_2', 'ws_1', 'Data Analysis', 'Data analysis with pandas and numpy', 15.0),
-- ('thread_3', 'ws_2', 'HTML/CSS', 'Frontend basics with HTML and CSS', 8.0);
-- Fix Quiz Schema Issues
-- Migration to align database schema with service implementation

-- 1. Add missing columns to quizzes table
ALTER TABLE quizzes 
ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id);

-- 2. Fix column naming inconsistency
-- Your schema has 'allocated_time' but some code expects 'time_allocated'
-- We'll keep allocated_time as per your schema

-- 3. Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_quizzes_thread_id ON quizzes(thread_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_creator_id ON quizzes(creator_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_workspace_id ON quizzes(workspace_id);

CREATE INDEX IF NOT EXISTS idx_questions_quiz_id ON questions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_answer_option_question_id ON answer_option(question_id);

CREATE INDEX IF NOT EXISTS idx_quiz_attempt_quiz_user ON quiz_attempt(quiz_id, user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempt_user_id ON quiz_attempt(user_id);

CREATE INDEX IF NOT EXISTS idx_user_answer_attempt_id ON user_answer(attempt_id);
CREATE INDEX IF NOT EXISTS idx_user_answer_question_id ON user_answer(question_id);

-- 4. Add session tracking for quiz attempts (optional enhancement)
-- This would help track active quiz sessions better
-- You could add these columns to quiz_attempt table:
-- ALTER TABLE quiz_attempt 
-- ADD COLUMN session_start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
-- ADD COLUMN session_end_time TIMESTAMP,
-- ADD COLUMN status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'expired'));

-- 5. Fix the typo in column name
ALTER TABLE quiz_attempt 
RENAME COLUMN attempt_nummber TO attempt_number;

-- 6. Add constraints to ensure data integrity
ALTER TABLE quiz_attempt 
ADD CONSTRAINT chk_positive_marks CHECK (marks >= 0);

-- 7. Add trigger to auto-update timestamps
CREATE OR REPLACE FUNCTION update_quiz_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Only create trigger if updated_at column exists in quizzes
-- ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
-- CREATE TRIGGER update_quizzes_updated_at 
--   BEFORE UPDATE ON quizzes 
--   FOR EACH ROW 
--   EXECUTE FUNCTION update_quiz_updated_at();
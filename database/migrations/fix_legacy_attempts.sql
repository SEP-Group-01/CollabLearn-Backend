-- Fix legacy attempts by setting expires_at based on created_at + allocated_time
UPDATE quiz_attempt 
SET expires_at = (
  SELECT (quiz_attempt.created_at + INTERVAL '1 minute' * quizzes.allocated_time)
  FROM quizzes 
  WHERE quizzes.id = quiz_attempt.quiz_id
)
WHERE expires_at IS NULL AND completed = false;

-- Auto-complete expired attempts (where expires_at is in the past)
UPDATE quiz_attempt 
SET 
  completed = true,
  marks = 0,
  time_taken = (
    SELECT INTERVAL '1 minute' * quizzes.allocated_time
    FROM quizzes 
    WHERE quizzes.id = quiz_attempt.quiz_id
  )
WHERE expires_at IS NOT NULL 
  AND expires_at < NOW() 
  AND completed = false;
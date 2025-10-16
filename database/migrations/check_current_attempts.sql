-- Check current quiz_attempt table structure and data
SELECT 
  id, 
  quiz_id, 
  user_id, 
  attempt_nummber,
  time_taken,
  marks,
  completed,
  created_at,
  expires_at
FROM quiz_attempt 
WHERE completed = false
ORDER BY created_at DESC
LIMIT 10;
-- ============================================
-- CLEANUP ORPHANED STUDY PLAN DATA
-- Run this in Supabase SQL Editor
-- ============================================

-- Step 1: Check for orphaned tasks (tasks belonging to dropped/completed plans)
SELECT 
    sp.id as plan_id,
    sp.status as plan_status,
    COUNT(st.id) as task_count
FROM study_plans sp
LEFT JOIN scheduled_tasks st ON st.study_plan_id = sp.id
WHERE sp.status IN ('dropped', 'completed')
GROUP BY sp.id, sp.status
ORDER BY task_count DESC;

-- Step 2: Get slot IDs that need to be freed
SELECT DISTINCT st.study_slot_id
FROM scheduled_tasks st
JOIN study_plans sp ON st.study_plan_id = sp.id
WHERE sp.status IN ('dropped', 'completed');

-- Step 3: DELETE orphaned tasks (this is the main fix!)
DELETE FROM scheduled_tasks 
WHERE study_plan_id IN (
    SELECT id 
    FROM study_plans 
    WHERE status IN ('dropped', 'completed')
);

-- Step 4: Free all slots (set is_free = true for all slots)
UPDATE study_slots 
SET is_free = true 
WHERE is_free = false;

-- Step 5: Verify cleanup
-- Should return 0 orphaned tasks
SELECT COUNT(*) as orphaned_tasks_count
FROM scheduled_tasks st
JOIN study_plans sp ON st.study_plan_id = sp.id
WHERE sp.status IN ('dropped', 'completed');

-- Should show all slots as free
SELECT 
    is_free,
    COUNT(*) as slot_count
FROM study_slots
GROUP BY is_free;

-- Step 6: Check active plans
SELECT 
    id,
    user_id,
    status,
    max_weeks,
    revision_ratio,
    plan_start_date,
    plan_end_date,
    generated_at
FROM study_plans
WHERE status = 'active'
ORDER BY generated_at DESC;

-- ============================================
-- SAFE CLEANUP - Won't affect linked resources
-- This only deletes scheduled_tasks, not resources/workspaces/threads
-- ============================================

-- The scheduled_tasks table REFERENCES these tables:
-- - thread_resources (your study materials)
-- - workspaces (your workspaces)
-- - threads (your threads)
-- - users (your users)
-- 
-- Since scheduled_tasks only has REFERENCES TO these tables,
-- deleting tasks will NOT delete the resources themselves.
-- It only removes the scheduling information.

-- Step 1: Show what we have
SELECT 
    'Scheduled Tasks' as item_type, 
    COUNT(*) as count 
FROM scheduled_tasks
UNION ALL
SELECT 
    'Study Plans' as item_type, 
    COUNT(*) as count 
FROM study_plans
UNION ALL
SELECT 
    'Resources (SAFE - NOT DELETED)' as item_type, 
    COUNT(*) as count 
FROM thread_resources
UNION ALL
SELECT 
    'Workspaces (SAFE - NOT DELETED)' as item_type, 
    COUNT(*) as count 
FROM workspaces;

-- Step 2: Show which tasks will be deleted (for verification)
SELECT 
    st.id,
    st.task_title,
    st.week_number,
    st.scheduled_date,
    sp.status as plan_status,
    tr.title as resource_title,
    w.title as workspace_title
FROM scheduled_tasks st
JOIN study_plans sp ON st.study_plan_id = sp.id
JOIN thread_resources tr ON st.resource_id = tr.id
JOIN workspaces w ON st.workspace_id = w.id
ORDER BY st.created_at DESC
LIMIT 10;

-- Step 3: DELETE ALL scheduled tasks (SAFE - won't delete resources)
-- This is the critical command
DELETE FROM scheduled_tasks;

-- Alternative: If the above fails due to constraints, force it
-- DELETE FROM scheduled_tasks WHERE id IS NOT NULL;

-- Step 4: Mark all study plans as dropped
UPDATE study_plans 
SET status = 'dropped', dropped_at = NOW()
WHERE status != 'dropped';

-- Step 5: Free all study slots
UPDATE study_slots 
SET is_free = true
WHERE is_free = false;

-- Step 6: Verify cleanup (tasks should be 0, resources should remain)
SELECT 
    'Tasks Remaining (should be 0)' as check_type, 
    COUNT(*) as count 
FROM scheduled_tasks
UNION ALL
SELECT 
    'Active Plans (should be 0)' as check_type, 
    COUNT(*) as count 
FROM study_plans 
WHERE status = 'active'
UNION ALL
SELECT 
    'Free Slots' as check_type, 
    COUNT(*) as count 
FROM study_slots 
WHERE is_free = true
UNION ALL
SELECT 
    'Resources (should be unchanged)' as check_type, 
    COUNT(*) as count 
FROM thread_resources
UNION ALL
SELECT 
    'Workspaces (should be unchanged)' as check_type, 
    COUNT(*) as count 
FROM workspaces
UNION ALL
SELECT 
    'Threads (should be unchanged)' as check_type, 
    COUNT(*) as count 
FROM threads;

-- Expected Results:
-- ✅ Tasks Remaining: 0
-- ✅ Active Plans: 0  
-- ✅ Free Slots: (all your slots)
-- ✅ Resources: (same as before - NOT DELETED)
-- ✅ Workspaces: (same as before - NOT DELETED)
-- ✅ Threads: (same as before - NOT DELETED)

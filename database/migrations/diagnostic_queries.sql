-- ============================================
-- DIAGNOSTIC QUERIES
-- Run these to see what's in your database
-- ============================================

-- 1. Count all scheduled tasks
SELECT COUNT(*) as total_tasks FROM scheduled_tasks;

-- 2. Show tasks grouped by plan status
SELECT 
    sp.status as plan_status,
    COUNT(st.id) as task_count
FROM scheduled_tasks st
JOIN study_plans sp ON st.study_plan_id = sp.id
GROUP BY sp.status;

-- 3. Show the specific problematic task
SELECT 
    st.id,
    st.study_plan_id,
    st.study_slot_id,
    st.week_number,
    st.scheduled_date,
    sp.status as plan_status,
    sp.dropped_at
FROM scheduled_tasks st
JOIN study_plans sp ON st.study_plan_id = sp.id
WHERE st.study_slot_id = '4c91df56-a377-4a52-ad21-28b773512681'
  AND st.week_number = 2
  AND st.scheduled_date = '2025-10-19'
ORDER BY st.created_at DESC;

-- 4. Show all tasks for that specific slot
SELECT 
    st.id,
    st.task_title,
    st.week_number,
    st.scheduled_date,
    sp.status as plan_status,
    sp.id as plan_id
FROM scheduled_tasks st
JOIN study_plans sp ON st.study_plan_id = sp.id
WHERE st.study_slot_id = '4c91df56-a377-4a52-ad21-28b773512681'
ORDER BY st.week_number, st.scheduled_date;

-- 5. Show all study plans and their status
SELECT 
    id,
    user_id,
    status,
    max_weeks,
    generated_at,
    dropped_at,
    (SELECT COUNT(*) FROM scheduled_tasks WHERE study_plan_id = study_plans.id) as task_count
FROM study_plans
ORDER BY generated_at DESC;

-- 6. Show slot status
SELECT 
    id,
    day_of_week,
    start_time,
    end_time,
    is_free,
    (SELECT COUNT(*) FROM scheduled_tasks WHERE study_slot_id = study_slots.id) as task_count
FROM study_slots
ORDER BY day_of_week, start_time;

-- 7. Find orphaned tasks (tasks with dropped/completed plans)
SELECT 
    st.id as task_id,
    st.study_plan_id,
    st.study_slot_id,
    st.week_number,
    st.scheduled_date,
    st.task_title,
    sp.status as plan_status
FROM scheduled_tasks st
JOIN study_plans sp ON st.study_plan_id = sp.id
WHERE sp.status IN ('dropped', 'completed')
ORDER BY st.created_at DESC
LIMIT 20;

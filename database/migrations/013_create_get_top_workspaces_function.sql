-- Create function to get top workspaces by member count efficiently
CREATE OR REPLACE FUNCTION get_top_workspaces_by_member_count(workspace_limit INTEGER DEFAULT 10)
RETURNS TABLE (
    id UUID,
    title VARCHAR(255),
    description TEXT,
    join_policy VARCHAR(10),
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    member_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        w.id,
        w.title,
        w.description,
        w.join_policy,
        w.image_url,
        w.created_at,
        w.updated_at,
        COALESCE(member_counts.member_count, 0) as member_count
    FROM workspaces w
    LEFT JOIN (
        SELECT 
            workspace_id,
            COUNT(*) as member_count
        FROM workspace_members
        GROUP BY workspace_id
    ) member_counts ON w.id = member_counts.workspace_id
    ORDER BY member_counts.member_count DESC NULLS LAST, w.created_at DESC
    LIMIT workspace_limit;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to the service user (adjust as needed for your setup)
-- GRANT EXECUTE ON FUNCTION get_top_workspaces_by_member_count(INTEGER) TO your_service_user;
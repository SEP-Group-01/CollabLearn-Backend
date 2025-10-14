-- Migration: Create RPC function for efficient workspace member counting
-- Description: Creates a PostgreSQL function to get workspaces sorted by member count
-- This avoids the need to fetch all data and sort at the application level

-- Drop function if it exists (for rollback/rerun scenarios)
DROP FUNCTION IF EXISTS get_workspace_member_counts(integer);

-- Create the RPC function to get workspace member counts efficiently
CREATE OR REPLACE FUNCTION get_workspace_member_counts(workspace_limit integer DEFAULT 10)
RETURNS TABLE (
  workspace_id uuid,
  member_count bigint
) 
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    wm.workspace_id,
    COUNT(wm.user_id) as member_count
  FROM workspace_members wm
  WHERE wm.workspace_id IS NOT NULL
  GROUP BY wm.workspace_id
  ORDER BY member_count DESC
  LIMIT workspace_limit;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_workspace_member_counts TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION get_workspace_member_counts IS 'Returns workspace IDs with their member counts, sorted by count in descending order. Used for efficiently fetching top workspaces by popularity.';
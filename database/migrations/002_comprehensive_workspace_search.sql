-- Comprehensive workspace search function
-- This function searches across workspace titles, descriptions, tags, thread names, and thread descriptions

CREATE OR REPLACE FUNCTION search_workspaces_comprehensive(search_term TEXT)
RETURNS TABLE (
  id UUID,
  title VARCHAR(255),
  description TEXT,
  join_policy VARCHAR(10),
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT 
    w.id,
    w.title,
    w.description,
    w.join_policy,
    w.image_url,
    w.created_at,
    w.updated_at
  FROM workspaces w
  WHERE 
    -- Search in workspace title (case-insensitive)
    LOWER(w.title) LIKE '%' || search_term || '%'
    
    -- Search in workspace description (case-insensitive)
    OR LOWER(w.description) LIKE '%' || search_term || '%'
    
    -- Search in workspace tags
    OR w.id IN (
      SELECT t.workspace_id 
      FROM tags t 
      WHERE LOWER(t.tag) LIKE '%' || search_term || '%'
    )
    
    -- Search in thread names
    OR w.id IN (
      SELECT th.workspace_id 
      FROM threads th 
      WHERE LOWER(th.name) LIKE '%' || search_term || '%'
    )
    
    -- Search in thread descriptions
    OR w.id IN (
      SELECT th.workspace_id 
      FROM threads th 
      WHERE LOWER(th.description) LIKE '%' || search_term || '%'
    )
  
  ORDER BY 
    -- Prioritize exact matches in title
    CASE WHEN LOWER(w.title) = search_term THEN 1 END,
    -- Then partial matches in title
    CASE WHEN LOWER(w.title) LIKE '%' || search_term || '%' THEN 2 END,
    -- Then matches in description
    CASE WHEN LOWER(w.description) LIKE '%' || search_term || '%' THEN 3 END,
    -- Finally other matches
    w.updated_at DESC;
END;
$$;

-- Multi-word comprehensive workspace search function
-- This function searches for multiple terms across workspace titles, descriptions, tags, thread names, and thread descriptions
CREATE OR REPLACE FUNCTION search_workspaces_comprehensive_multi(search_terms TEXT[])
RETURNS TABLE (
  id UUID,
  title VARCHAR(255),
  description TEXT,
  join_policy VARCHAR(10),
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
DECLARE
  term TEXT;
BEGIN
  -- Create a temporary table to store workspace IDs that match any search term
  CREATE TEMP TABLE temp_matches (workspace_id UUID);
  
  -- For each search term, find matching workspaces
  FOREACH term IN ARRAY search_terms
  LOOP
    -- Insert matching workspace IDs into temp table
    INSERT INTO temp_matches (workspace_id)
    SELECT DISTINCT w.id
    FROM workspaces w
    WHERE 
      -- Search in workspace title (case-insensitive)
      LOWER(w.title) LIKE '%' || LOWER(term) || '%'
      
      -- Search in workspace description (case-insensitive)
      OR LOWER(w.description) LIKE '%' || LOWER(term) || '%'
      
      -- Search in workspace tags
      OR w.id IN (
        SELECT t.workspace_id 
        FROM tags t 
        WHERE LOWER(t.tag) LIKE '%' || LOWER(term) || '%'
      )
      
      -- Search in thread names
      OR w.id IN (
        SELECT th.workspace_id 
        FROM threads th 
        WHERE LOWER(th.name) LIKE '%' || LOWER(term) || '%'
      )
      
      -- Search in thread descriptions
      OR w.id IN (
        SELECT th.workspace_id 
        FROM threads th 
        WHERE LOWER(th.description) LIKE '%' || LOWER(term) || '%'
      )
    ON CONFLICT DO NOTHING; -- Avoid duplicates
  END LOOP;
  
  -- Return workspaces that match any of the search terms
  RETURN QUERY
  SELECT DISTINCT 
    w.id,
    w.title,
    w.description,
    w.join_policy,
    w.image_url,
    w.created_at,
    w.updated_at
  FROM workspaces w
  INNER JOIN temp_matches tm ON w.id = tm.workspace_id
  ORDER BY 
    -- Count how many terms match the title (more matches = higher priority)
    (
      SELECT COUNT(*)
      FROM unnest(search_terms) AS search_term
      WHERE LOWER(w.title) LIKE '%' || LOWER(search_term) || '%'
    ) DESC,
    -- Then by title exact matches
    CASE WHEN LOWER(w.title) = ANY(SELECT LOWER(term) FROM unnest(search_terms) AS term) THEN 1 END,
    -- Finally by most recent update
    w.updated_at DESC;
    
  -- Clean up
  DROP TABLE temp_matches;
END;
$$;

-- Create index for better search performance
CREATE INDEX IF NOT EXISTS idx_workspaces_title_trgm ON workspaces USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_workspaces_description_trgm ON workspaces USING gin (description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_tags_tag_trgm ON tags USING gin (tag gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_threads_name_trgm ON threads USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_threads_description_trgm ON threads USING gin (description gin_trgm_ops);

-- Enable pg_trgm extension if not already enabled (for better text search)
-- Note: This requires superuser privileges, may need to be run separately
-- CREATE EXTENSION IF NOT EXISTS pg_trgm;
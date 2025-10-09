-- Rollback/Drop statements for Document Storage Schema
-- Migration: 004_document_storage_schema_rollback.sql
-- Use these statements to rollback the document storage schema if needed

-- WARNING: These statements will permanently delete all document data!
-- Make sure to backup your data before running these commands.

-- ========================================
-- DROP VIEWS
-- ========================================

-- Drop the documents with latest version view
DROP VIEW IF EXISTS documents_with_latest_version CASCADE;

-- ========================================
-- DROP TRIGGERS
-- ========================================

-- Drop triggers before dropping functions
DROP TRIGGER IF EXISTS trigger_update_document_updated_at ON documents;
DROP TRIGGER IF EXISTS trigger_set_version_number ON document_versions;

-- ========================================
-- DROP FUNCTIONS
-- ========================================

-- Drop custom functions
DROP FUNCTION IF EXISTS update_document_updated_at() CASCADE;
DROP FUNCTION IF EXISTS set_version_number() CASCADE;

-- ========================================
-- DROP INDEXES
-- ========================================

-- Drop indexes for documents table
DROP INDEX IF EXISTS idx_documents_thread_id;
DROP INDEX IF EXISTS idx_documents_created_by;
DROP INDEX IF EXISTS idx_documents_updated_at;
DROP INDEX IF EXISTS idx_documents_content_search;
DROP INDEX IF EXISTS idx_documents_not_deleted;

-- Drop indexes for document_versions table
DROP INDEX IF EXISTS idx_document_versions_document_id;
DROP INDEX IF EXISTS idx_document_versions_created_at;

-- Drop indexes for document_permissions table
DROP INDEX IF EXISTS idx_document_permissions_document_id;
DROP INDEX IF EXISTS idx_document_permissions_user_id;
DROP INDEX IF EXISTS idx_document_permissions_active;

-- Drop indexes for document_collaborators table
DROP INDEX IF EXISTS idx_document_collaborators_document_id;
DROP INDEX IF EXISTS idx_document_collaborators_user_id;
DROP INDEX IF EXISTS idx_document_collaborators_active;

-- Drop indexes for document_audit_log table
DROP INDEX IF EXISTS idx_document_audit_log_document_id;
DROP INDEX IF EXISTS idx_document_audit_log_user_id;
DROP INDEX IF EXISTS idx_document_audit_log_timestamp;
DROP INDEX IF EXISTS idx_document_audit_log_action;

-- Drop indexes for document_media table
DROP INDEX IF EXISTS idx_document_media_document_id;
DROP INDEX IF EXISTS idx_document_media_uploaded_by;
DROP INDEX IF EXISTS idx_document_media_not_deleted;

-- Drop indexes for document_comments table
DROP INDEX IF EXISTS idx_document_comments_document_id;
DROP INDEX IF EXISTS idx_document_comments_user_id;
DROP INDEX IF EXISTS idx_document_comments_not_deleted;

-- ========================================
-- DROP ROW LEVEL SECURITY POLICIES
-- ========================================

-- Drop RLS policies for documents
DROP POLICY IF EXISTS "Users can view documents they have permission to" ON documents;
DROP POLICY IF EXISTS "Users can update documents they have write permission to" ON documents;

-- Note: Add more RLS policy drops here if you create additional policies

-- ========================================
-- DISABLE ROW LEVEL SECURITY
-- ========================================

-- Disable RLS on all tables (optional - you might want to keep RLS enabled)
-- ALTER TABLE documents DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE document_versions DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE document_permissions DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE document_collaborators DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE document_audit_log DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE document_media DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE document_comments DISABLE ROW LEVEL SECURITY;

-- ========================================
-- DROP TABLES (IN DEPENDENCY ORDER)
-- ========================================

-- Drop tables with foreign key dependencies first

-- Drop document templates (no dependencies)
DROP TABLE IF EXISTS document_templates CASCADE;

-- Drop document comments (references documents and self)
DROP TABLE IF EXISTS document_comments CASCADE;

-- Drop document media (references documents)
DROP TABLE IF EXISTS document_media CASCADE;

-- Drop document audit log (references documents)
DROP TABLE IF EXISTS document_audit_log CASCADE;

-- Drop document collaborators (references documents)
DROP TABLE IF EXISTS document_collaborators CASCADE;

-- Drop document permissions (references documents)
DROP TABLE IF EXISTS document_permissions CASCADE;

-- Drop document versions (references documents)
DROP TABLE IF EXISTS document_versions CASCADE;

-- Drop documents table (references threads)
DROP TABLE IF EXISTS documents CASCADE;

-- ========================================
-- DROP EXTENSIONS (OPTIONAL)
-- ========================================

-- Only drop extensions if you're sure no other schemas are using them
-- DROP EXTENSION IF EXISTS "uuid-ossp";

-- ========================================
-- VERIFICATION QUERIES
-- ========================================

-- Run these queries after rollback to verify cleanup
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' AND table_name LIKE 'document%';

-- SELECT indexname FROM pg_indexes 
-- WHERE schemaname = 'public' AND indexname LIKE '%document%';

-- SELECT routine_name FROM information_schema.routines 
-- WHERE routine_schema = 'public' AND routine_name IN ('update_document_updated_at', 'set_version_number');

-- ========================================
-- NOTES
-- ========================================

/*
ROLLBACK INSTRUCTIONS:

1. BACKUP YOUR DATA FIRST!
   - Export important documents and media files
   - Backup the entire database if needed

2. Run statements in this order:
   - Views
   - Triggers
   - Functions
   - Indexes
   - RLS Policies
   - Tables (in dependency order)

3. Verification:
   - Run the verification queries at the end
   - Check that all document-related objects are removed

4. Firebase Storage Cleanup:
   - Manually delete files from Firebase Storage if needed
   - The database cleanup won't remove Firebase files

5. Application Updates:
   - Update your application code to handle the schema changes
   - Remove references to document-related services

PARTIAL ROLLBACK:
If you only want to remove specific tables or features:
- Comment out the DROP statements for objects you want to keep
- Be careful about foreign key dependencies
- Update the application code accordingly

ALTERNATIVE APPROACHES:
- Rename tables instead of dropping (e.g., ADD SUFFIX '_backup')
- Move data to archive tables before dropping
- Use transactions to test rollback before committing
*/
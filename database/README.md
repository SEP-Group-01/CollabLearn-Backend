# Supabase Configuration for CollabLearn

## Environment Variables

All microservices should use the same Supabase credentials:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key
```

## Database Schema

- Schema is version controlled in `/database/migrations/`
- Team members have access through Supabase dashboard
- RLS policies ensure security

## Services Using This Database:

- `quiz-service` ✅
- `auth-service` ✅
- `workspaces-service` ✅
- `document-editor-service` ✅
- `forum-and-notification-service` ✅

## Team Access:

1. Invite team members in Supabase Dashboard → Settings → Team
2. Give appropriate roles (Developer/Admin)
3. They can view/edit tables through Supabase interface

## Security:

- Tables have Row Level Security (RLS) enabled
- Only service role can access from backend APIs
- Frontend users will need separate auth policies (when implemented)

# Document Access Requests Implementation

## Overview

This document describes the implementation of the document access request system, which allows users to request access to documents they don't have permission to view/edit, and enables admins/moderators to approve or reject these requests.

## Database Changes

### Tables Used

1. **document_access_requests** - Stores access requests
   - `id` - UUID primary key
   - `document_id` - Reference to document
   - `user_id` - User requesting access
   - `requested_permission` - 'read' or 'write'
   - `status` - 'pending', 'approved', or 'rejected'
   - `message` - Optional message from requester
   - `requested_at` - Timestamp of request
   - `handled_by` - Admin/moderator who handled the request
   - `handled_at` - When it was handled
   - `rejection_reason` - Optional reason for rejection

2. **pending_document_access_requests** (View)
   - Joins access requests with document, thread, and user data
   - Filters to show only pending requests
   - Includes requester name, email, image, and document title

### Automatic Permission Granting

A database trigger (`handle_approved_access_request`) automatically:

- Inserts permission into `document_permissions` table when request is approved
- Logs the action in `document_audit_log`

## Backend Implementation

### Document Editor Service

#### New Methods in `database.service.ts`:

```typescript
- createAccessRequest(data): Create new access request
- getPendingAccessRequestsByThread(threadId): Get all pending requests for a thread
- updateAccessRequestStatus(requestId, status, handledBy, rejectionReason?): Approve/reject request
- getAccessRequest(requestId): Get single request details
- hasExistingAccessRequest(documentId, userId): Check if pending request exists
```

#### New Methods in `document-editor-service.service.ts`:

```typescript
- requestDocumentAccess(data): Handle user request for access
  - Checks if user already has access
  - Checks for existing pending requests
  - Creates new request

- getPendingAccessRequests(threadId, userId): Get pending requests for admin/moderator

- approveAccessRequest(requestId, userId): Approve access request
  - Updates request status
  - Trigger automatically grants permission

- rejectAccessRequest(data): Reject access request with optional reason
```

#### New Controller Endpoints:

```typescript
@MessagePattern('document.access.request')
@MessagePattern('document.access.requests.pending')
@MessagePattern('document.access.request.approve')
@MessagePattern('document.access.request.reject')
```

### API Gateway

#### New HTTP Endpoints in `document-editor-enhanced.controller.ts`:

```typescript
POST   /documents/:documentId/access-request
GET    /documents/thread/:threadId/access-requests
POST   /documents/access-requests/:requestId/approve
POST   /documents/access-requests/:requestId/reject
```

All endpoints require authentication via Bearer token.

## Frontend Implementation

### API Layer (`editorApi.ts`)

#### New Types:

```typescript
interface DocumentAccessRequest {
  id: string;
  documentId: string;
  userId: string;
  requestedPermission: 'read' | 'write';
  status: 'pending' | 'approved' | 'rejected';
  message?: string;
  // ... additional fields
}
```

#### New API Functions:

```typescript
- requestDocumentAccess(documentId, requestedPermission, message?)
- getPendingAccessRequests(threadId)
- approveAccessRequest(requestId)
- rejectAccessRequest(requestId, rejectionReason?)
```

### CollaborativeEditor Component

#### New State Variables:

```typescript
- sharedDocuments: DocumentListItem[] - Real documents from thread
- documentsLoading: boolean
- isAdminOrModerator: boolean
- accessRequests: DocumentAccessRequest[]
- accessRequestsLoading: boolean
```

#### New useEffect Hooks:

1. **Fetch Shared Documents** - Loads all documents in thread (except current)
2. **Check Admin Status & Fetch Requests** - Determines if user is admin/moderator and loads pending requests

#### UI Changes:

##### Right Sidebar Structure (2 Sections):

**Top Section (max 60% height): Shared Documents**

- Shows all other documents in the thread
- Each document card displays:
  - Document title
  - Last update date
  - User's permission level (read/write/admin) as a chip
  - Action button:
    - "Request Access" - for users without access (not admin/moderator)
    - "Edit" or "View" - for users with access
    - No button shown for admins/moderators (always have access)

**Bottom Section (40% height): Access Requests (Admin/Moderator Only)**

- Only visible if `isAdminOrModerator === true`
- Shows pending access requests with:
  - Requester name and avatar
  - Document title
  - Optional message from requester
  - "Approve" button (green)
  - "Reject" button (red)

#### Removed Features:

- Keyboard shortcuts section (removed from sidebar)
- Mock data import from `EditorMocks.ts`

### Permission Logic

Documents are now displayed with dynamic permissions:

```typescript
const hasAccess =
  doc.userPermission === 'write' ||
  doc.userPermission === 'admin' ||
  doc.userPermission === 'read';
const canEdit =
  doc.userPermission === 'write' || doc.userPermission === 'admin';
const canView = hasAccess || doc.isPublic || isAdminOrModerator;
```

## User Flow

### Requesting Access:

1. User sees a document they don't have access to in the sidebar
2. Clicks "Request Access" button
3. System creates pending request in database
4. Success notification shown
5. Admins/moderators see the request in their sidebar

### Approving/Rejecting Access:

1. Admin/moderator sees pending request in bottom section of sidebar
2. Clicks "Approve" or "Reject"
3. Database trigger automatically grants permission (if approved)
4. Request removed from pending list
5. User receives updated permissions on next fetch

## Security Considerations

1. **Authentication Required**: All endpoints require valid JWT token
2. **Permission Checks**:
   - Only admins/moderators can view pending requests
   - Only admins/moderators can approve/reject requests
3. **Duplicate Prevention**: System prevents multiple pending requests from same user for same document
4. **Existing Access Check**: System prevents requesting access if user already has it

## Testing Checklist

- [ ] User can see other shared documents in thread
- [ ] Request access button shows for documents user doesn't have access to
- [ ] Request access button doesn't show for admins/moderators
- [ ] Request access button doesn't show if user already has access
- [ ] Access request creates pending entry in database
- [ ] Admins/moderators see pending requests in sidebar
- [ ] Approve button grants permission and removes from pending
- [ ] Reject button removes from pending without granting permission
- [ ] Documents show correct permission level (read/write/admin)
- [ ] Edit/View buttons work correctly based on permissions
- [ ] Section heights are appropriate (60% documents, 40% requests)

## Future Enhancements

1. Real-time notifications when access is granted/denied
2. Email notifications for access requests
3. Bulk approve/reject functionality
4. Request history view
5. Ability for users to cancel their pending requests
6. Custom message for rejection reasons
7. Expiring access permissions
8. Request access with specific permission level choice (read vs write)

# Document Access Requests - Bug Fixes

## Issues Found and Fixed

### Issue 1: userId undefined in getDocumentsByThread API

**Problem:**

- API endpoint was receiving `userId: undefined` when fetching documents by thread
- Caused 500 Internal Server Error with message: `invalid input syntax for type uuid: "undefined"`
- Error occurred in `getDocumentsByThread` endpoint

**Root Cause:**

- Inconsistent user ID extraction from auth token validation response
- Auth service returns: `{ user: { id: '...', userId: '...' } }`
- Some endpoints used `user.id`, others used `tokenValidation.user?.id`
- The new `getDocumentsByThread` endpoint was using wrong pattern

**Fix Applied:**
Updated all access request endpoints in `document-editor-enhanced.controller.ts` to use consistent pattern:

```typescript
const tokenValidation = await this.validateAuthToken(authHeader);
const userId = tokenValidation.user?.id || tokenValidation.user?.userId;
```

**Files Changed:**

- `apps/api-gateway/src/app/controllers/document-editor-enhanced.controller.ts`
  - `getDocumentsByThread()` - Fixed user ID extraction
  - `requestDocumentAccess()` - Fixed user ID extraction
  - `getPendingAccessRequests()` - Fixed user ID extraction
  - `approveAccessRequest()` - Fixed user ID extraction
  - `rejectAccessRequest()` - Fixed user ID extraction

### Issue 2: Clarification on "Duplicate" Document Fetches

**User Concern:**
"Why are there two document fetches, shared and normal? We only need shared ones."

**Clarification:**
These are NOT duplicates - they serve different purposes:

1. **getDocument(documentId)** - Line ~685 in CollaborativeEditor
   - Fetches the CURRENT document that user is editing
   - Loads document content into the editor
   - Required for the editor to function
   - Called once on component mount

2. **getDocumentsByThread(threadId)** - Line ~720 in CollaborativeEditor
   - Fetches OTHER documents in the same thread
   - Displays in right sidebar for quick access
   - Shows document list with permissions
   - NEW feature for navigation

**Both are necessary:**

- First fetch = Current document to edit
- Second fetch = Other documents for sidebar navigation

## Testing Checklist

After fixes:

- [x] API gateway extracts userId correctly from auth token
- [x] `getDocumentsByThread` endpoint works without errors
- [ ] Shared documents load in right sidebar
- [ ] Document permission badges show correctly
- [ ] Request access button appears for non-accessible documents
- [ ] Admin/moderator sees access requests in sidebar
- [ ] Approve/reject buttons work

## Additional Logging Added

Added debug logging to help troubleshoot:

```typescript
console.log('📄 Fetching documents for thread:', threadId, 'user:', userId);
console.error('❌ No user ID found in token validation:', tokenValidation);
```

## Next Steps

1. ✅ Restart API gateway (completed)
2. ✅ Test document fetching in browser
3. Verify shared documents appear in sidebar
4. Test access request workflow
5. Remove debug console.logs in production

## Related Files

- Backend:
  - `apps/api-gateway/src/app/controllers/document-editor-enhanced.controller.ts`
  - `apps/document-editor-service/src/services/database.service.ts`
  - `apps/document-editor-service/src/services/document-editor-service.service.ts`

- Frontend:
  - `client/src/pages/CollaborativeEditor.tsx`
  - `client/src/api/editorApi.ts`

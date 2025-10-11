# Comprehensive Workspace Search Implementation Guide

## Overview

The `getWorkspacesBySearchTerm` endpoint has been updated to provide comprehensive multi-word search functionality across multiple data sources and support optional authentication.

## API Endpoint

```
GET /api/workspaces/search/:searchTerm
```

### Headers (Optional)

```
Authorization: Bearer <jwt_token>
```

- **Note**: Authentication is optional. Unauthenticated users can search but won't see role-specific information.

## Multi-Word Search Features

### Search Term Processing

- **Tokenization**: Splits search terms by whitespace
- **Stop Word Removal**: Filters out common words like "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by", "from", etc.
- **Normalization**: Removes special characters and converts to lowercase
- **Deduplication**: Eliminates duplicate words
- **Minimum Length**: Keeps words with 2+ characters

### Example Transformations

- `"Design and mobile app development"` → `["design", "mobile", "app", "development"]`
- `"React for the web"` → `["react", "web"]`
- `"Machine learning and AI"` → `["machine", "learning", "ai"]`

## Search Scope

The search now covers each processed word individually across:

1. **Workspace Title** - Case-insensitive partial matching
2. **Workspace Description** - Case-insensitive partial matching
3. **Workspace Tags** - Case-insensitive partial matching in tag names
4. **Thread Names** - Case-insensitive partial matching in thread titles
5. **Thread Descriptions** - Case-insensitive partial matching in thread descriptions

## Response Format

```json
[
  {
    "id": "a05d61e6-2afc-4a2a-a304-96c8dcfd972c",
    "title": "App Design",
    "description": "Design modern and user-friendly mobile apps.",
    "join_policy": "Invites",
    "admin_ids": ["f752ceb5-dc71-4964-afcd-40de2070f695"],
    "tags": ["Figma"],
    "image_url": "https://example.com/image.jpg",
    "members_count": 1,
    "role": "admin",
    "created_at": "2025-09-30T19:33:03.954048+00:00",
    "updated_at": "2025-09-30T19:33:03.954048+00:00"
  }
]
```

### Response Fields

- **id**: Unique workspace identifier
- **title**: Workspace name
- **description**: Workspace description
- **join_policy**: "Anyone", "Invites", or "request"
- **admin_ids**: Array of admin user IDs
- **tags**: Array of workspace tags
- **image_url**: Workspace image URL (nullable)
- **members_count**: Number of workspace members
- **role**: User's role in workspace ("admin", "member", "invited", "requested", "user")
  - Returns "user" for unauthenticated requests
- **created_at**: Workspace creation timestamp
- **updated_at**: Last workspace update timestamp

## Authentication Handling

### Authenticated Users

```javascript
const headers = {
  Authorization: `Bearer ${getAccessToken()}`,
};

const response = await axios.get(`${API_URL}/workspaces/search/${searchTerm}`, {
  headers,
});
```

### Unauthenticated Users

```javascript
const response = await axios.get(`${API_URL}/workspaces/search/${searchTerm}`);
// No headers needed - search works without authentication
```

## Frontend Integration Example

```javascript
export const getWorkspacesBySearchTerm = async (searchTerm: string) => {
    const token = getAccessToken();

    const headers: any = {};

    // Include token if available
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const response = await axios.get(`${API_URL}/workspaces/search/${searchTerm}`, {
        headers,
    });
    return response.data;
};
```

## Database Optimizations

### Stored Procedure

A stored procedure `search_workspaces_comprehensive` has been created for optimal performance:

```sql
-- Run this migration to enable the stored procedure
\i database/migrations/002_comprehensive_workspace_search.sql
```

### Search Strategy

1. **Primary**: Uses stored procedure for comprehensive search with optimized ranking
2. **Fallback**: If stored procedure fails, performs multiple queries and combines results
3. **Performance**: Includes trigram indexes for faster text search

### Search Ranking

Results are prioritized by:

1. Exact title matches
2. Partial title matches
3. Description matches
4. Tag and thread matches
5. Most recently updated

## Testing Examples

### Search Terms to Test

- **"design"** - Should match workspaces with "design" in title, description, tags, or threads
- **"Figma"** - Should match workspaces tagged with "Figma"
- **"mobile"** - Should match workspaces with "mobile" in any searchable field
- **"app"** - Should match both workspace data and thread content

### Expected Behavior

- Case-insensitive matching
- Partial string matching (contains)
- No duplicates in results
- Proper role information for authenticated users
- Graceful handling of invalid tokens

## Error Handling

- Invalid/expired tokens are ignored (continues as guest)
- Database errors return 500 status
- Empty search terms return empty array
- Missing search term returns error

## Performance Considerations

- Trigram indexes improve search performance
- Results are limited by database query efficiency
- Consider implementing result pagination for large datasets
- Stored procedure provides better performance than multiple queries

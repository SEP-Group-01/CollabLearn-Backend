# Multi-Word Search Testing Guide

## Overview

This guide provides comprehensive test cases for the new multi-word search functionality in the workspace search endpoint.

## Test Cases

### 1. Basic Multi-Word Search

**Input**: `"mobile app development"`
**Processed**: `["mobile", "app", "development"]`
**Expected**: Returns workspaces containing any of these words in title, description, tags, or threads

### 2. Stop Word Removal

**Input**: `"React for the web development"`
**Processed**: `["react", "web", "development"]`
**Expected**: Filters out "for", "the" and searches for meaningful words only

### 3. Case Insensitive Search

**Input**: `"MOBILE APP"`
**Processed**: `["mobile", "app"]`
**Expected**: Matches "Mobile App", "mobile app", "MOBILE APP", etc.

### 4. Special Character Handling

**Input**: `"React.js & Node.js"`
**Processed**: `["reactjs", "nodejs"]`
**Expected**: Removes special characters and searches for clean terms

### 5. Duplicate Word Removal

**Input**: `"mobile mobile app"`
**Processed**: `["mobile", "app"]`
**Expected**: Eliminates duplicate "mobile" and searches unique terms

### 6. Short Word Filtering

**Input**: `"AI ML in data science"`
**Processed**: `["ai", "ml", "data", "science"]`
**Expected**: Keeps 2+ character words, filters out "in"

### 7. Only Stop Words

**Input**: `"the and for"`
**Processed**: `[]`
**Expected**: Returns empty array since no meaningful search terms remain

### 8. Complex Technical Search

**Input**: `"machine learning and artificial intelligence"`
**Processed**: `["machine", "learning", "artificial", "intelligence"]`
**Expected**: Comprehensive search across all fields for each term

## Testing Commands

### Using cURL

```bash
# Basic multi-word search
curl -X GET "http://localhost:3000/api/workspaces/search/mobile app development"

# With authentication
curl -X GET "http://localhost:3000/api/workspaces/search/React JavaScript" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Complex search with stop words
curl -X GET "http://localhost:3000/api/workspaces/search/machine learning and AI"
```

### Frontend Testing

```javascript
// Test different search scenarios
const testSearches = [
  'mobile app development',
  'React for the web',
  'machine learning and AI',
  'DESIGN THINKING',
  'Node.js & Express',
  'the and for', // Should return empty
];

for (const searchTerm of testSearches) {
  const results = await getWorkspacesBySearchTerm(searchTerm);
  console.log(`"${searchTerm}" -> ${results.length} results`);
}
```

## Expected Database Queries

### Multi-Word Processing Flow

1. **Input**: `"React for the web development"`
2. **Tokenization**: `["React", "for", "the", "web", "development"]`
3. **Normalization**: `["react", "for", "the", "web", "development"]`
4. **Stop Word Removal**: `["react", "web", "development"]`
5. **Database Search**: Each word searched independently across all tables

### Search Fields Per Word

For each processed word, the system searches:

- `workspaces.title` LIKE '%word%'
- `workspaces.description` LIKE '%word%'
- `tags.tag` LIKE '%word%'
- `threads.name` LIKE '%word%'
- `threads.description` LIKE '%word%'

## Performance Testing

### Load Testing Scenarios

```javascript
// Test with increasing complexity
const complexityTests = [
  'design', // 1 word
  'mobile app', // 2 words
  'React JavaScript Node', // 3 words
  'web development with React and Node.js', // 4 meaningful words
  'full stack web development using React JavaScript Node.js Express', // 6 words
];

// Measure response times
for (const search of complexityTests) {
  const start = Date.now();
  await getWorkspacesBySearchTerm(search);
  const time = Date.now() - start;
  console.log(`"${search}" took ${time}ms`);
}
```

## Edge Cases

### 1. Empty Search After Processing

**Input**: `"the and for of"`
**Result**: Empty array (all words filtered out)
**Status**: ✅ Expected behavior

### 2. Single Character Words

**Input**: `"a b c development"`
**Processed**: `["development"]`
**Result**: Only searches for "development"

### 3. Very Long Search Terms

**Input**: 50+ words with many stop words
**Expected**: Efficient processing, reasonable response time

### 4. Unicode and International Characters

**Input**: `"développement mobile"`
**Expected**: Handles international characters correctly

## Validation Checklist

- [ ] Multi-word input correctly tokenized
- [ ] Stop words properly removed
- [ ] Case insensitive matching works
- [ ] Special characters handled
- [ ] Duplicate words eliminated
- [ ] Short words filtered (< 2 chars)
- [ ] Empty results for stop-word-only searches
- [ ] Results ranked by relevance (more matching terms = higher rank)
- [ ] Authentication works (role field populated)
- [ ] Unauthenticated access works (role = "user")
- [ ] Performance acceptable for complex searches
- [ ] Database indexes being utilized
- [ ] Error handling for invalid tokens
- [ ] No duplicate workspaces in results

## Common Issues to Check

### 1. Stop Word List Completeness

Ensure all common stop words are filtered out:

```typescript
const stopWords = [
  'the',
  'a',
  'an',
  'and',
  'or',
  'but',
  'in',
  'on',
  'at',
  'to',
  'for',
  'of',
  'with',
  'by',
  'from' /* ... */,
];
```

### 2. Search Term Processing

Verify each step of processing:

- Split by whitespace ✅
- Convert to lowercase ✅
- Remove special characters ✅
- Filter minimum length ✅
- Remove stop words ✅
- Remove duplicates ✅

### 3. Database Query Optimization

Check that searches use:

- Trigram indexes for text fields
- Efficient OR queries across tables
- Proper result deduplication
- Optimized ranking logic

### 4. Response Format Consistency

All responses should include:

- Complete workspace metadata
- Proper user role information
- Consistent field naming
- Proper data types

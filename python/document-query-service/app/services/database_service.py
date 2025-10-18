"""
Database Service for document query operations
"""
import os
import os
import json
from typing import List, Dict, Any, Optional

# Try to import supabase client; if not present, we'll fall back to psycopg2
try:
    from supabase import create_client
    _HAS_SUPABASE = True
except Exception:
    _HAS_SUPABASE = False

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
    _HAS_PSYCOPG2 = True
except Exception:
    _HAS_PSYCOPG2 = False

DB_HOST = os.environ.get("SUPABASE_DB_HOST")
DB_PORT = int(os.environ.get("SUPABASE_DB_PORT", 6543))
DB_NAME = os.environ.get("SUPABASE_DB_NAME", "postgres")
DB_USER = os.environ.get("SUPABASE_DB_USER")
DB_PASSWORD = os.environ.get("SUPABASE_DB_PASSWORD")
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")


def _get_supabase_client():
    if not _HAS_SUPABASE:
        return None
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        return None
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def _get_conn():
    if not _HAS_PSYCOPG2:
        raise RuntimeError("psycopg2 not installed in this environment; cannot open direct DB connection")
    if not DB_PASSWORD:
        raise RuntimeError("Database password not set for direct psycopg2 connection. Set SUPABASE_DB_PASSWORD.")
    conn = psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
    )
    return conn


def get_document_info(resource_id: str) -> Optional[Dict[str, Any]]:
    """Get document information from thread_resources table"""
    supabase = _get_supabase_client()
    if supabase:
        try:
            res = supabase.table("thread_resources").select("*").eq("id", resource_id).execute()
            data = res.data
            if data and len(data) > 0:
                return data[0]
            return None
        except Exception as e:
            print(f"[DatabaseService] Error getting document info: {e}")
            raise RuntimeError(f"Supabase select error: {e}")
    
    conn = _get_conn()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT * FROM thread_resources WHERE id = %s", (resource_id,))
    row = cur.fetchone()
    cur.close()
    conn.close()
    return dict(row) if row else None


def check_embeddings_exist(document_id: str) -> bool:
    """Check if embeddings already exist for a document"""
    supabase = _get_supabase_client()
    if supabase:
        try:
            res = supabase.table("document_embeddings").select("id", count="exact").eq("resource_id", document_id).limit(1).execute()
            return res.count > 0 if hasattr(res, 'count') else (res.data and len(res.data) > 0)
        except Exception as e:
            print(f"[DatabaseService] Error checking embeddings: {e}")
            return False
    
    conn = _get_conn()
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM document_embeddings WHERE resource_id = %s", (document_id,))
    count = cur.fetchone()[0]
    cur.close()
    conn.close()
    return count > 0


def create_and_store_embeddings(document_id: str, chunks: List[Dict[str, Any]]):
    """Store chunk embeddings and metadata into the database.

    Strategy:
    - Prefer using Supabase Python client (service key) if available. This avoids needing a DB password.
    - If not available, fall back to psycopg2 direct INSERTs.
    
    Expected chunks format: List of {chunk_text, page_number, embedding}
    Database schema: document_embeddings (resource_id, chunk_index, chunk_text, page_number, embedding)
    """
    supabase = _get_supabase_client()
    if supabase:
        # Use the restful insert into document_embeddings table
        rows = []
        for idx, c in enumerate(chunks):
            rows.append({
                "resource_id": document_id,
                "chunk_index": idx,
                "chunk_text": c.get("chunk_text") or c.get("content"),  # Support both field names
                "page_number": c.get("page_number") or c.get("page"),
                # supabase-py expects lists for vector columns
                "embedding": c.get("embedding"),
            })
        try:
            res = supabase.table("document_embeddings").insert(rows).execute()
            return res.data
        except Exception as e:
            raise RuntimeError(f"Supabase insert error: {e}")

    # Fallback to psycopg2
    conn = _get_conn()
    cur = conn.cursor()
    for idx, c in enumerate(chunks):
        cur.execute(
            "INSERT INTO document_embeddings (resource_id, chunk_index, chunk_text, page_number, embedding) VALUES (%s, %s, %s, %s, %s)",
            (document_id, idx, c.get("chunk_text") or c.get("content"), c.get("page_number") or c.get("page"), c.get("embedding")),
        )
    conn.commit()
    cur.close()
    conn.close()


def _cosine_similarity(a: List[float], b: List[float]) -> float:
    # Compute cosine similarity
    import math

    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


def search_similar_chunks(query_embedding: List[float], top_k: int = 5) -> List[Dict[str, Any]]:
    """Search for similar chunks using vector similarity.

    Strategy:
    - If Supabase client is available, try to run an RPC function or use PostgreSQL SQL via the 'rpc' or 'query' interfaces.
    - If that isn't possible, pull a candidate set and compute cosine similarity in Python.
    
    Returns list of dicts with: resource_id, chunk_text, page_number, similarity, document_title
    """
    supabase = _get_supabase_client()
    if supabase:
        try:
            # Try using PostgREST / RPC to run a vector search function called 'search_similar_chunks'
            # This requires a Postgres function to be created in the DB. If it's present, we can call it.
            res = supabase.rpc("search_similar_chunks", {"q_embedding": query_embedding, "k": top_k}).execute()
            return res.data
        except Exception:
            # Fall back to pulling all embeddings and computing similarity client-side
            pass

        try:
            # Pull candidates with document titles (join with thread_resources)
            res = supabase.table("document_embeddings").select(
                "id,resource_id,chunk_text,page_number,embedding,thread_resources!inner(title)"
            ).limit(1000).execute()
            rows = res.data or []
            # compute similarities
            scored = []
            for r in rows:
                emb = r.get("embedding")
                if emb:
                    # Supabase returns vector as list already (not string) in newer versions
                    # But ensure it's a list just in case
                    if isinstance(emb, str):
                        # Parse string representation like "[0.1, 0.2, ...]"
                        emb = json.loads(emb) if emb.startswith('[') else eval(emb)
                    elif not isinstance(emb, list):
                        emb = list(emb)
                    sim = _cosine_similarity(query_embedding, emb)
                else:
                    sim = 0.0
                # Flatten the nested thread_resources object
                doc_title = r.get("thread_resources", {}).get("title", "Unknown Document")
                scored.append({
                    "similarity": sim,
                    "id": r.get("id"),
                    "resource_id": r.get("resource_id"),
                    "chunk_text": r.get("chunk_text"),
                    "page_number": r.get("page_number"),
                    "document_title": doc_title
                })
            scored.sort(key=lambda x: x["similarity"], reverse=True)
            return scored[:top_k]
        except Exception as e:
            print(f"[DatabaseService] Search error details: {e}")
            print(f"[DatabaseService] Sample embedding type: {type(rows[0].get('embedding')) if rows else 'no rows'}")
            raise RuntimeError(f"Supabase search error: {e}")

    # psycopg2 path: try using pgvector operator; if fails, fetch and compute
    if not _HAS_PSYCOPG2:
        raise RuntimeError("No database client available (supabase client missing and psycopg2 missing)")

    conn = _get_conn()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute(
            """
            SELECT e.id, e.resource_id, e.chunk_text, e.page_number, 
                   1 - (e.embedding <=> %s) AS similarity,
                   r.title as document_title
            FROM document_embeddings e
            JOIN thread_resources r ON e.resource_id = r.id
            ORDER BY e.embedding <=> %s 
            LIMIT %s
            """,
            (query_embedding, query_embedding, top_k),
        )
        rows = cur.fetchall()
        return [dict(r) for r in rows]
    except Exception as e:
        print(f"[DatabaseService] Vector search failed, using fallback: {e}")
        # fallback: fetch many and compute
        cur.execute("""
            SELECT e.id, e.resource_id, e.chunk_text, e.page_number, e.embedding,
                   r.title as document_title
            FROM document_embeddings e
            JOIN thread_resources r ON e.resource_id = r.id
            LIMIT 1000
        """)
        rows = cur.fetchall()
        scored = []
        for r in rows:
            emb = r.get("embedding")
            sim = _cosine_similarity(query_embedding, emb) if emb else 0.0
            row_dict = dict(r)
            row_dict["similarity"] = sim
            scored.append(row_dict)
        scored.sort(key=lambda x: x["similarity"], reverse=True)
        return scored[:top_k]


def create_conversation(user_id: str, thread_id: str, title: str = "New Conversation") -> str:
    """Create a new document conversation. Returns the conversation UUID."""
    supabase = _get_supabase_client()
    if supabase:
        try:
            res = supabase.table("document_conversations").insert({
                "user_id": user_id, 
                "thread_id": thread_id,
                "title": title
            }).execute()
            # Return the inserted id if available
            data = res.data
            if data and isinstance(data, list) and len(data) > 0:
                return data[0].get("id")
            return None
        except Exception as e:
            raise RuntimeError(f"Supabase insert conversation error: {e}")

    conn = _get_conn()
    cur = conn.cursor()
    cur.execute("INSERT INTO document_conversations (user_id, thread_id, title) VALUES (%s, %s, %s) RETURNING id", (user_id, thread_id, title))
    cid = cur.fetchone()[0]
    conn.commit()
    cur.close()
    conn.close()
    return cid


def save_message(conversation_id: str, role: str, content: str, sources: Optional[List[Dict[str, Any]]] = None):
    """Save a message to the conversation. Returns the message UUID."""
    supabase = _get_supabase_client()
    if supabase:
        try:
            payload = {
                "conversation_id": conversation_id,
                "role": role,
                "content": content,
            }
            res = supabase.table("conversation_messages").insert(payload).execute()
            message_id = res.data[0].get("id") if res.data else None
            
            # If there are sources, save them as document references
            if message_id and sources:
                references = []
                for src in sources:
                    # Handle both camelCase (from OpenAI service) and snake_case
                    resource_id = src.get("resource_id") or src.get("resourceId")
                    page_number = src.get("page_number") or src.get("pageNumber")
                    relevance_score = src.get("relevance_score") or src.get("relevanceScore") or src.get("similarity")
                    excerpt_text = src.get("excerpt") or src.get("text") or src.get("excerpt_text")
                    
                    # Only add if we have a resource_id (required field)
                    if resource_id:
                        ref_data = {
                            "message_id": message_id,
                            "resource_id": resource_id,
                            "page_number": page_number,
                            "relevance_score": relevance_score
                        }
                        if excerpt_text:
                            ref_data["excerpt_text"] = excerpt_text
                        references.append(ref_data)
                
                if references:
                    supabase.table("message_document_references").insert(references).execute()
            
            return message_id
        except Exception as e:
            raise RuntimeError(f"Supabase insert message error: {e}")

    conn = _get_conn()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO conversation_messages (conversation_id, role, content) VALUES (%s, %s, %s) RETURNING id",
        (conversation_id, role, content),
    )
    conn.commit()
    cur.close()
    conn.close()


def get_user_conversations(user_id: str, thread_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """Get all document conversations for a user, optionally filtered by thread."""
    supabase = _get_supabase_client()
    if supabase:
        try:
            query = supabase.table("document_conversations").select("id,title,thread_id,created_at,updated_at").eq("user_id", user_id)
            if thread_id:
                query = query.eq("thread_id", thread_id)
            res = query.order("updated_at", desc=True).execute()
            return res.data or []
        except Exception as e:
            raise RuntimeError(f"Supabase select conversations error: {e}")

    conn = _get_conn()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    if thread_id:
        cur.execute("SELECT id, title, thread_id, created_at, updated_at FROM document_conversations WHERE user_id = %s AND thread_id = %s ORDER BY updated_at DESC", (user_id, thread_id))
    else:
        cur.execute("SELECT id, title, thread_id, created_at, updated_at FROM document_conversations WHERE user_id = %s ORDER BY updated_at DESC", (user_id,))
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return rows


def get_conversation_messages(conversation_id: str) -> List[Dict[str, Any]]:
    """Get all messages in a conversation with their references."""
    supabase = _get_supabase_client()
    if supabase:
        try:
            # Get messages
            res = supabase.table("conversation_messages").select("id,role,content,created_at").eq("conversation_id", conversation_id).order("created_at").execute()
            messages = res.data or []
            
            # Get references for each message
            for msg in messages:
                refs_res = supabase.table("message_document_references").select(
                    "resource_id,page_number,relevance_score,excerpt_text,thread_resources!inner(title)"
                ).eq("message_id", msg['id']).execute()
                
                msg['references'] = []
                for ref in (refs_res.data or []):
                    msg['references'].append({
                        'resourceId': ref['resource_id'],
                        'documentTitle': ref.get('thread_resources', {}).get('title', 'Unknown'),
                        'pageNumber': ref.get('page_number'),
                        'relevanceScore': ref.get('relevance_score'),
                        'excerpt': ref.get('excerpt_text', '')
                    })
            
            return messages
        except Exception as e:
            raise RuntimeError(f"Supabase get messages error: {e}")
    
    # Fallback to psycopg2
    conn = _get_conn()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT id, role, content, created_at FROM conversation_messages WHERE conversation_id = %s ORDER BY created_at", (conversation_id,))
    messages = cur.fetchall()
    cur.close()
    conn.close()
    return [dict(m) for m in messages]


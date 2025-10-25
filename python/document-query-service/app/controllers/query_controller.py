"""
Query Controller for Document Query Service
Handles all document-query related business logic with RAG capabilities
"""
from typing import List, Dict, Optional
import os
import traceback
from app.services.openai_service import OpenAIService
from app.services import database_service as db
from app.services.document_processor import DocumentProcessor

class QueryController:
    """Controller for handling document query operations"""
    
    def __init__(self):
        self.service_name = "DocumentQueryService"
        self.openai_service = OpenAIService()
        self.doc_processor = DocumentProcessor()
    
    async def handle_request(self, topic: str, payload: dict) -> dict:
        """
        Main handler that routes requests to appropriate methods
        
        Args:
            topic: The Kafka topic that received the message
            payload: The message payload
            
        Returns:
            dict: Response data to send back to the API Gateway
        """
        
        # Extract the action from the topic (e.g., 'get-chats' from 'document-query.get-chats')
        topic_parts = topic.split('.')
        if len(topic_parts) >= 2:
            raw_action = topic_parts[1].replace('-', '_')  # Convert to method name format
            
            # Map topic actions to handler method names
            action_mapping = {
                'chats': 'get_chats',
                'search_documents': 'search_documents',  
                'get_document_summary': 'get_document_summary',
                'documents': 'documents',
                'query_documents': 'query_documents',
                'get_conversations': 'get_conversations',
                'get_conversation_messages': 'get_conversation_messages',
                'create_conversation': 'create_conversation',
            }
            
            action = action_mapping.get(raw_action, raw_action)
        else:
            action = 'unknown'
        
        print(f"[{self.service_name}] Processing action: {action} with payload: {payload}")
        
        # Route to specific methods based on action
        method_name = f"handle_{action}"
        if hasattr(self, method_name):
            handler_method = getattr(self, method_name)
            return await handler_method(payload)
        else:
            return {
                "success": False,
                "error": f"Unknown action: {action}",
                "available_actions": [
                    "get-chats", 
                    "search-documents", 
                    "get-document-summary"
                ]
            }
    
    async def handle_get_chats(self, payload: dict) -> dict:
        """Handle get-chats requests"""
        user_id = payload.get('userId', 'unknown')
        workspace_id = payload.get('workspaceId', None)
        
        print(f"[{self.service_name}] Getting chats for user: {user_id}, workspace: {workspace_id}")
        
        # TODO: Implement your actual chat retrieval logic here
        # This would typically involve database queries, vector search, etc.
        
        mock_chats = [
            {
                "id": 1, 
                "message": f"Hello {user_id}! Welcome to the document query service!",
                "timestamp": "2024-01-01T10:00:00Z",
                "type": "system"
            },
            {
                "id": 2, 
                "message": "How can I help you with your documents today?",
                "timestamp": "2024-01-01T10:01:00Z",
                "type": "assistant"
            }
        ]
        
        if workspace_id:
            mock_chats.append({
                "id": 3,
                "message": f"I see you're working in workspace: {workspace_id}",
                "timestamp": "2024-01-01T10:02:00Z",
                "type": "system"
            })
        
        return {
            "success": True,
            "data": {
                "userId": user_id,
                "workspaceId": workspace_id,
                "chats": mock_chats,
                "total": len(mock_chats)
            },
            "service": self.service_name
        }

    async def handle_search_documents(self, payload: dict) -> dict:
        """Handle document search requests"""
        query = payload.get('query', '')
        user_id = payload.get('userId', 'unknown')
        
        print(f"[{self.service_name}] Searching documents for query: '{query}' by user: {user_id}")
        
        # TODO: Implement actual document search logic
        mock_results = [
            {
                "id": "doc_1",
                "title": f"Document containing '{query}'",
                "snippet": f"This document mentions {query} in the context of...",
                "score": 0.95,
                "type": "pdf"
            },
            {
                "id": "doc_2", 
                "title": f"Research on {query}",
                "snippet": f"A comprehensive study about {query} and its implications...",
                "score": 0.87,
                "type": "research_paper"
            }
        ]
        
        return {
            "success": True,
            "data": {
                "query": query,
                "results": mock_results,
                "total": len(mock_results)
            },
            "service": self.service_name
        }

    async def handle_get_document_summary(self, payload: dict) -> dict:
        """Handle document summary requests"""
        document_id = payload.get('documentId', '')
        user_id = payload.get('userId', 'unknown')
        
        print(f"[{self.service_name}] Getting summary for document: {document_id} by user: {user_id}")
        
        # TODO: Implement actual document summarization logic
        mock_summary = {
            "id": document_id,
            "title": f"Document {document_id}",
            "summary": f"This document discusses various topics related to {document_id}. Key points include...",
            "key_points": [
                "Main concept explanation",
                "Supporting evidence", 
                "Conclusion and implications"
            ],
            "word_count": 1250,
            "reading_time": "5 minutes"
        }
        
        return {
            "success": True,
            "data": mock_summary,
            "service": self.service_name
        }
    
    async def handle_query_documents(self, payload: dict) -> dict:
        """
        Handle document query with RAG (Retrieval-Augmented Generation)
        """
        try:
            user_id = payload.get('userId')
            conversation_id = payload.get('conversationId')
            query = payload.get('query', '')
            selected_documents = payload.get('selectedDocuments', [])  # List of resource IDs
            
            if not all([user_id, query, selected_documents]):
                return {
                    "success": False,
                    "error": "Missing required fields: userId, query, selectedDocuments"
                }
            
            print(f"[{self.service_name}] Query: '{query}' for {len(selected_documents)} documents")
            
            # Get thread_id from the first document (all docs should be from same thread)
            first_doc_info = db.get_document_info(selected_documents[0])
            if not first_doc_info:
                return {"success": False, "error": f"Document {selected_documents[0]} not found"}
            
            thread_id = first_doc_info.get('thread_id')
            if not thread_id:
                return {"success": False, "error": "Document has no thread_id"}
            
            # Create or use existing conversation
            if not conversation_id:
                # Create new conversation for this query
                conversation_id = db.create_conversation(user_id, thread_id, f"Query: {query[:50]}...")
                print(f"[{self.service_name}] Created new conversation: {conversation_id}")
            
            # Process documents and create embeddings if needed
            for doc_id in selected_documents:
                if not db.check_embeddings_exist(doc_id):
                    print(f"[{self.service_name}] Creating embeddings for document {doc_id}...")
                    
                    # Get document info
                    doc_info = db.get_document_info(doc_id)
                    if not doc_info:
                        print(f"[{self.service_name}] Document {doc_id} not found")
                        continue
                    
                    firebase_url = doc_info.get('firebase_url')
                    if not firebase_url:
                        print(f"[{self.service_name}] No firebase_url for document {doc_id}")
                        continue
                    
                    mime_type = doc_info.get('mime_type', 'application/pdf')
                    
                    # Download and extract text
                    print(f"[{self.service_name}] Processing document from Firebase...")
                    chunks = await self.doc_processor.process_document(firebase_url, mime_type)
                    if not chunks:
                        print(f"[{self.service_name}] No chunks extracted from document {doc_id}")
                        continue
                    
                    print(f"[{self.service_name}] Creating {len(chunks)} embeddings via OpenAI...")
                    
                    # Create embeddings for all chunks
                    texts = [chunk[0] for chunk in chunks]
                    embeddings = await self.openai_service.create_embeddings_batch(texts)
                    
                    # Combine chunks with embeddings
                    chunks_with_embeddings = []
                    for (text, page_num), embedding in zip(chunks, embeddings):
                        chunks_with_embeddings.append({
                            'chunk_text': text,
                            'page_number': page_num,
                            'embedding': embedding
                        })
                    
                    # Store in database
                    print(f"[{self.service_name}] Storing embeddings in database...")
                    db.create_and_store_embeddings(doc_id, chunks_with_embeddings)
                    print(f"[{self.service_name}] Embeddings created successfully for {doc_id}")
            
            # Process documents and create embeddings if needed
            for doc_id in selected_documents:
                if not db.check_embeddings_exist(doc_id):
                    print(f"[{self.service_name}] Creating embeddings for document {doc_id}")
                    # Get document details
                    doc_info = db.get_document_info(doc_id)
                    if doc_info:
                        # Download and process document
                        print(f"[{self.service_name}] Downloading and chunking document...")
                        chunks = await self.doc_processor.process_document(
                            doc_info['firebase_url'],
                            doc_info.get('mime_type', 'application/pdf')
                        )
                        
                        # Create embeddings for all chunks
                        print(f"[{self.service_name}] Creating {len(chunks)} embeddings via OpenAI...")
                        texts = [chunk[0] for chunk in chunks]  # Extract text from tuples
                        embeddings = await self.openai_service.create_embeddings_batch(texts)
                        
                        # Format chunks with embeddings for database storage
                        chunks_with_embeddings = []
                        for (text, page_num), embedding in zip(chunks, embeddings):
                            chunks_with_embeddings.append({
                                'chunk_text': text,
                                'page_number': page_num,
                                'embedding': embedding
                            })
                        
                        # Store in database
                        print(f"[{self.service_name}] Storing embeddings in database...")
                        db.create_and_store_embeddings(doc_id, chunks_with_embeddings)
                        print(f"[{self.service_name}] Embeddings created successfully for {doc_id}")
            
            # Create query embedding
            query_embedding = await self.openai_service.create_embedding(query)
            
            # Search for relevant chunks
            relevant_chunks = db.search_similar_chunks(
                query_embedding,
                top_k=5
            )
            
            # Generate response using RAG
            response_text, references = await self.openai_service.generate_response_with_context(
                query,
                relevant_chunks
            )
            
            # Save to conversation
            message_id = db.save_message(
                conversation_id,
                'user',
                query
            )
            
            assistant_message_id = db.save_message(
                conversation_id,
                'assistant',
                response_text,
                references
            )
            
            return {
                "success": True,
                "data": {
                    "response": response_text,
                    "references": references,
                    "conversationId": conversation_id,
                    "messageId": assistant_message_id,
                    "userMessageId": message_id
                },
                "service": self.service_name
            }
            
        except Exception as e:
            print(f"[{self.service_name}] Error in query_documents: {e}")
            import traceback
            traceback.print_exc()
            return {
                "success": False,
                "error": str(e)
            }
    
    async def handle_get_conversations(self, payload: dict) -> dict:
        """Get all conversations for a user in a thread"""
        try:
            user_id = payload.get('userId')
            thread_id = payload.get('threadId')
            
            if not user_id:
                return {
                    "success": False,
                    "error": "Missing userId"
                }
            
            conversations = db.get_user_conversations(user_id, thread_id)
            
            return {
                "success": True,
                "data": {
                    "conversations": conversations
                },
                "service": self.service_name
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    async def handle_get_conversation_messages(self, payload: dict) -> dict:
        """Get all messages in a conversation"""
        try:
            conversation_id = payload.get('conversationId')
            
            if not conversation_id:
                return {
                    "success": False,
                    "error": "Missing conversationId"
                }
            
            messages = db.get_conversation_messages(conversation_id)
            
            return {
                "success": True,
                "data": {
                    "messages": messages
                },
                "service": self.service_name
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    async def handle_create_conversation(self, payload: dict) -> dict:
        """Create a new conversation"""
        try:
            user_id = payload.get('userId')
            thread_id = payload.get('threadId')
            title = payload.get('title', 'New Conversation')
            
            if not all([user_id, thread_id]):
                return {
                    "success": False,
                    "error": "Missing userId or threadId"
                }
            
            conversation_id = db.create_conversation(
                user_id,
                thread_id,
                title
            )
            
            return {
                "success": True,
                "data": {
                    "conversationId": conversation_id,
                    "title": title
                },
                "service": self.service_name
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

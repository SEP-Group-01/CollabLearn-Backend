"""
OpenAI Service for embeddings and chat completion
"""
import os
from openai import AsyncOpenAI
from typing import List, Tuple, Dict

class OpenAIService:
    def __init__(self):
        api_key = os.getenv('OPENAI_API_KEY')
        if not api_key:
            raise ValueError("OPENAI_API_KEY not found in environment")
        
        self.client = AsyncOpenAI(api_key=api_key)
        self.embedding_model = "text-embedding-3-small"
        self.chat_model = "gpt-4o-mini"
    
    async def create_embedding(self, text: str) -> List[float]:
        """Create embedding vector for text"""
        try:
            response = await self.client.embeddings.create(
                model=self.embedding_model,
                input=text
            )
            return response.data[0].embedding
        except Exception as e:
            print(f"[OpenAIService] Error creating embedding: {e}")
            raise
    
    async def create_embeddings_batch(self, texts: List[str]) -> List[List[float]]:
        """Create embeddings for multiple texts"""
        try:
            response = await self.client.embeddings.create(
                model=self.embedding_model,
                input=texts
            )
            return [item.embedding for item in response.data]
        except Exception as e:
            print(f"[OpenAIService] Error creating batch embeddings: {e}")
            raise
    
    async def generate_response_with_context(
        self,
        query: str,
        relevant_chunks: List[Dict]
    ) -> Tuple[str, List[Dict]]:
        """
        Generate AI response using RAG
        Returns: (response_text, references)
        """
        try:
            # Build context from chunks
            context_parts = []
            references = []
            
            for i, chunk in enumerate(relevant_chunks):
                doc_name = chunk.get('document_title', 'Unknown Document')
                page = chunk.get('page_number')
                page_info = f" (Page {page})" if page else ""
                
                context_parts.append(
                    f"[Source {i+1}: {doc_name}{page_info}]\n{chunk['chunk_text']}\n"
                )
                
                references.append({
                    'resourceId': chunk['resource_id'],
                    'documentTitle': doc_name,
                    'pageNumber': page,
                    'relevanceScore': chunk.get('similarity', 0.0),
                    'excerpt': chunk['chunk_text'][:200] + '...'
                })
            
            context = "\n\n".join(context_parts)
            
            # Create prompt
            messages = [
                {
                    "role": "system",
                    "content": (
                        "You are a helpful AI assistant that answers questions based on provided documents. "
                        "Always cite the source number (e.g., 'According to Source 1...') when referencing information. "
                        "If the answer isn't in the documents, say so clearly. "
                        "Be concise but comprehensive."
                    )
                },
                {
                    "role": "user",
                    "content": f"Context from documents:\n\n{context}\n\nQuestion: {query}"
                }
            ]
            
            # Generate response
            response = await self.client.chat.completions.create(
                model=self.chat_model,
                messages=messages,
                temperature=0.7,
                max_tokens=1000
            )
            
            return response.choices[0].message.content, references
            
        except Exception as e:
            print(f"[OpenAIService] Error generating response: {e}")
            raise

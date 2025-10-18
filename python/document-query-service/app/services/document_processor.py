"""
Document Processor for downloading and chunking documents
"""
import io
import requests
from typing import List, Tuple, Optional
from PyPDF2 import PdfReader

class DocumentProcessor:
    def __init__(self, chunk_size: int = 1000, chunk_overlap: int = 200):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
    
    async def process_document(
        self,
        firebase_url: str,
        mime_type: str = 'application/pdf'
    ) -> List[Tuple[str, Optional[int]]]:
        """
        Download and process document into chunks
        Returns: List of (text, page_number) tuples
        """
        try:
            # Download document
            print(f"[DocumentProcessor] Downloading from: {firebase_url}")
            response = requests.get(firebase_url, timeout=30)
            response.raise_for_status()
            content = response.content
            
            # Extract text based on type
            if 'pdf' in mime_type.lower():
                pages = self._extract_pdf_text(content)
            else:
                # For other types, treat as plain text
                text = content.decode('utf-8', errors='ignore')
                pages = [(text, None)]
            
            # Chunk all pages
            all_chunks = []
            for text, page_num in pages:
                chunks = self._chunk_text(text, page_num)
                all_chunks.extend(chunks)
            
            print(f"[DocumentProcessor] Created {len(all_chunks)} chunks")
            return all_chunks
            
        except Exception as e:
            print(f"[DocumentProcessor] Error processing document: {e}")
            raise
    
    def _extract_pdf_text(self, content: bytes) -> List[Tuple[str, int]]:
        """Extract text from PDF"""
        try:
            pdf_file = io.BytesIO(content)
            pdf_reader = PdfReader(pdf_file)
            
            pages = []
            for page_num, page in enumerate(pdf_reader.pages, start=1):
                text = page.extract_text()
                if text.strip():
                    pages.append((text, page_num))
            
            print(f"[DocumentProcessor] Extracted {len(pages)} pages from PDF")
            return pages
        except Exception as e:
            print(f"[DocumentProcessor] Error extracting PDF text: {e}")
            raise
    
    def _chunk_text(
        self,
        text: str,
        page_number: Optional[int] = None
    ) -> List[Tuple[str, Optional[int]]]:
        """Split text into overlapping chunks"""
        chunks = []
        start = 0
        
        while start < len(text):
            end = start + self.chunk_size
            chunk = text[start:end]
            
            # Try to break at sentence boundary
            if end < len(text):
                last_period = chunk.rfind('. ')
                last_newline = chunk.rfind('\n')
                last_break = max(last_period, last_newline)
                
                if last_break > self.chunk_size * 0.7:
                    chunk = chunk[:last_break + 1]
                    end = start + last_break + 1
            
            if chunk.strip():
                chunks.append((chunk.strip(), page_number))
            
            start = end - self.chunk_overlap
            if start >= len(text):
                break
        
        return chunks

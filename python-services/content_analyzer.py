# ═══════════════════════════════════════════════════════════════════════════
# FILE: python-services/content_analyzer.py
# PURPOSE: Analyze and search file contents within disk images
# ═══════════════════════════════════════════════════════════════════════════

import re
from datetime import datetime
from typing import Optional, List, Dict, Any

from config import ActiveConfig as Config

# Optional imports for document parsing
try:
    from PyPDF2 import PdfReader
    PDF_AVAILABLE = True
except ImportError:
    PDF_AVAILABLE = False

try:
    from docx import Document as DocxDocument
    DOCX_AVAILABLE = True
except ImportError:
    DOCX_AVAILABLE = False


class ContentAnalyzer:
    """
    Analyzes and searches content within disk images
    """
    
    def __init__(self, parser):
        """
        Initialize the content analyzer
        
        Args:
            parser: DiskImageParser instance
        """
        self.parser = parser
        self._file_index = None
    
    def _build_index(self):
        """Build file index for searching"""
        if self._file_index is None:
            print("📊 Building file index...")
            self._file_index = self.parser.list_files("/", recursive=True)
            print(f"✅ Indexed {len(self._file_index)} files")
        return self._file_index
    
    def search(
        self,
        query: str = "",
        search_in: List[str] = None,
        file_types: List[str] = None,
        extensions: List[str] = None,
        min_size: int = 0,
        max_size: int = None,
        date_from: str = None,
        date_to: str = None
    ) -> List[Dict[str, Any]]:
        """
        Search for files based on various criteria
        """
        search_in = search_in or ['filename', 'extension', 'path']
        results = []
        
        files = self._build_index()
        query_lower = query.lower() if query else ""
        
        # Parse date filters
        date_from_dt = None
        date_to_dt = None
        if date_from:
            try:
                date_from_dt = datetime.fromisoformat(date_from.replace('Z', '+00:00'))
            except:
                pass
        if date_to:
            try:
                date_to_dt = datetime.fromisoformat(date_to.replace('Z', '+00:00'))
            except:
                pass
        
        # Normalize extensions
        if extensions:
            extensions = [ext.lower() if ext.startswith('.') else f'.{ext.lower()}' for ext in extensions]
        
        for file_info in files:
            if file_info['isDirectory']:
                continue
            
            # Extension filter
            if extensions and file_info['extension'].lower() not in extensions:
                continue
            
            # File type filter
            if file_types and file_info['category'] not in file_types:
                continue
            
            # Size filters
            if file_info['size'] < min_size:
                continue
            if max_size and file_info['size'] > max_size:
                continue
            
            # Date filters
            if date_from_dt and file_info['modified']:
                try:
                    file_date = datetime.fromisoformat(file_info['modified'])
                    if file_date < date_from_dt:
                        continue
                except:
                    pass
            
            if date_to_dt and file_info['modified']:
                try:
                    file_date = datetime.fromisoformat(file_info['modified'])
                    if file_date > date_to_dt:
                        continue
                except:
                    pass
            
            # Query filter
            if query_lower:
                match = False
                
                if 'filename' in search_in:
                    if query_lower in file_info['name'].lower():
                        match = True
                        file_info['matchType'] = 'filename'
                
                if not match and 'extension' in search_in:
                    if query_lower in file_info['extension'].lower():
                        match = True
                        file_info['matchType'] = 'extension'
                
                if not match and 'path' in search_in:
                    if query_lower in file_info['path'].lower():
                        match = True
                        file_info['matchType'] = 'path'
                
                if not match:
                    continue
            
            results.append(file_info)
        
        return results
    
    def search_content(
        self,
        query: str,
        extensions: List[str] = None,
        case_sensitive: bool = False,
        max_results: int = 100
    ) -> List[Dict[str, Any]]:
        """
        Search within file contents
        """
        extensions = extensions or Config.SEARCHABLE_EXTENSIONS
        results = []
        
        # Normalize extensions
        extensions = [ext.lower() if ext.startswith('.') else f'.{ext.lower()}' for ext in extensions]
        
        files = self._build_index()
        searchable = [f for f in files if f['isFile'] and f['extension'].lower() in extensions]
        
        print(f"🔍 Searching content in {len(searchable)} files...")
        
        for file_info in searchable:
            if len(results) >= max_results:
                break
            
            try:
                content = self.parser.read_file(file_info['path'], max_size=1024 * 1024)
                if not content:
                    continue
                
                text = None
                ext = file_info['extension'].lower()
                
                # Plain text files
                if ext in ['.txt', '.log', '.csv', '.json', '.xml', '.html', '.css', '.js', '.py', '.md']:
                    try:
                        text = content.decode('utf-8', errors='ignore')
                    except:
                        pass
                
                # PDF files
                elif ext == '.pdf' and PDF_AVAILABLE:
                    text = self._extract_pdf_text(content)
                
                # DOCX files
                elif ext == '.docx' and DOCX_AVAILABLE:
                    text = self._extract_docx_text(content)
                
                if not text:
                    continue
                
                # Search in text
                search_text = text if case_sensitive else text.lower()
                search_query = query if case_sensitive else query.lower()
                
                if search_query in search_text:
                    match_info = self._get_match_context(text, query, case_sensitive)
                    
                    result = {
                        **file_info,
                        'matchType': 'content',
                        'matchCount': match_info['count'],
                        'matches': match_info['matches'][:5],
                    }
                    results.append(result)
                    
            except Exception as e:
                print(f"⚠️ Error searching {file_info['path']}: {e}")
                continue
        
        print(f"✅ Found {len(results)} files containing '{query}'")
        return results
    
    def _get_match_context(self, text: str, query: str, case_sensitive: bool) -> Dict[str, Any]:
        """Get context around matches"""
        flags = 0 if case_sensitive else re.IGNORECASE
        pattern = re.compile(re.escape(query), flags)
        
        matches = []
        for match in pattern.finditer(text):
            start = max(0, match.start() - 50)
            end = min(len(text), match.end() + 50)
            context = text[start:end]
            
            context = context.replace('\n', ' ').replace('\r', '').strip()
            if start > 0:
                context = '...' + context
            if end < len(text):
                context = context + '...'
            
            matches.append({
                'position': match.start(),
                'context': context
            })
        
        return {
            'count': len(matches),
            'matches': matches
        }
    
    def _extract_pdf_text(self, content: bytes) -> Optional[str]:
        """Extract text from PDF content"""
        try:
            import io
            reader = PdfReader(io.BytesIO(content))
            text = ''
            for page in reader.pages[:10]:
                text += page.extract_text() or ''
            return text
        except Exception as e:
            print(f"⚠️ PDF extraction error: {e}")
            return None
    
    def _extract_docx_text(self, content: bytes) -> Optional[str]:
        """Extract text from DOCX content"""
        try:
            import io
            doc = DocxDocument(io.BytesIO(content))
            text = '\n'.join(para.text for para in doc.paragraphs)
            return text
        except Exception as e:
            print(f"⚠️ DOCX extraction error: {e}")
            return None
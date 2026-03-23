# ═══════════════════════════════════════════════════════════════════════════
# FILE: python-services/file_extractor.py
# PURPOSE: Extract files from disk images and compute hashes
# ═══════════════════════════════════════════════════════════════════════════

import os
import hashlib
import mimetypes
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any, List
import base64

from config import ActiveConfig as Config

# Try to import magic for better file type detection
try:
    import magic
    MAGIC_AVAILABLE = True
except ImportError:
    MAGIC_AVAILABLE = False


class FileExtractor:
    """
    Handles file extraction from disk images
    """
    
    def __init__(self, parser):
        """
        Initialize the file extractor
        
        Args:
            parser: DiskImageParser instance
        """
        self.parser = parser
    
    def extract_file(self, file_path: str, output_dir: str = None) -> Dict[str, Any]:
        """
        Extract a file from the disk image to the local filesystem
        
        Args:
            file_path: Path to the file within the disk image
            output_dir: Directory to extract to (defaults to extracted/)
            
        Returns:
            Result dictionary with extraction details
        """
        output_dir = output_dir or str(Config.EXTRACTED_DIR)
        
        result = {
            'success': False,
            'sourcePath': file_path,
            'outputPath': None,
            'size': 0,
            'hashes': {},
            'error': None
        }
        
        try:
            # Get file info first
            file_info = self.parser.get_file_info(file_path)
            if not file_info:
                result['error'] = f"File not found: {file_path}"
                return result
            
            if file_info['isDirectory']:
                result['error'] = "Cannot extract directory"
                return result
            
            # Check size limit
            if file_info['size'] > Config.MAX_EXTRACT_SIZE:
                result['error'] = f"File too large to extract: {file_info['sizeFormatted']}"
                return result
            
            # Read file content
            content = self.parser.read_file(file_path)
            if content is None:
                result['error'] = "Failed to read file content"
                return result
            
            # Create output directory structure
            os.makedirs(output_dir, exist_ok=True)
            
            # Generate unique output filename
            base_name = os.path.basename(file_path)
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_filename = f"{timestamp}_{base_name}"
            output_path = os.path.join(output_dir, output_filename)
            
            # Write file
            with open(output_path, 'wb') as f:
                f.write(content)
            
            # Compute hashes
            hashes = self._compute_hashes(content)
            
            result['success'] = True
            result['outputPath'] = output_path
            result['outputFilename'] = output_filename
            result['size'] = len(content)
            result['sizeFormatted'] = self._format_size(len(content))
            result['hashes'] = hashes
            result['extractedAt'] = datetime.now().isoformat()
            
        except Exception as e:
            result['error'] = str(e)
        
        return result
    
    def compute_hash(self, file_path: str, algorithms: List[str] = None) -> Optional[Dict[str, str]]:
        """
        Compute hash of a file without extracting it
        
        Args:
            file_path: Path to the file within the disk image
            algorithms: List of hash algorithms (md5, sha1, sha256)
            
        Returns:
            Dictionary of algorithm -> hash, or None if failed
        """
        algorithms = algorithms or ['sha256']
        
        try:
            content = self.parser.read_file(file_path)
            if content is None:
                return None
            
            return self._compute_hashes(content, algorithms)
            
        except Exception as e:
            print(f"❌ Error computing hash: {e}")
            return None
    
    def get_preview(self, file_path: str, max_size: int = None) -> Optional[Dict[str, Any]]:
        """
        Get a preview of file contents
        
        Args:
            file_path: Path to the file within the disk image
            max_size: Maximum preview size in bytes
            
        Returns:
            Preview data dictionary
        """
        max_size = max_size or Config.MAX_CONTENT_PREVIEW_SIZE
        
        try:
            file_info = self.parser.get_file_info(file_path)
            if not file_info:
                return None
            
            if file_info['isDirectory']:
                return {
                    'type': 'directory',
                    'message': 'This is a directory',
                    'fileInfo': file_info
                }
            
            extension = file_info['extension'].lower()
            category = file_info['category']
            
            # Read file content (limited size)
            content = self.parser.read_file(file_path, max_size=max_size)
            if content is None:
                return None
            
            preview = {
                'type': 'unknown',
                'canPreview': False,
                'fileInfo': file_info,
                'truncated': file_info['size'] > max_size
            }
            
            # Text files
            text_extensions = ['.txt', '.log', '.csv', '.json', '.xml', '.html', '.css', '.js', '.py', '.md', '.ini', '.cfg']
            if category == 'documents' or extension in text_extensions:
                try:
                    text = content.decode('utf-8', errors='replace')
                    preview['type'] = 'text'
                    preview['canPreview'] = True
                    preview['content'] = text
                    preview['lineCount'] = text.count('\n') + 1
                    preview['encoding'] = 'utf-8'
                except:
                    preview['type'] = 'binary'
                    preview['canPreview'] = False
            
            # Images
            elif category == 'images':
                preview['type'] = 'image'
                preview['canPreview'] = True
                preview['mimeType'] = mimetypes.guess_type(file_path)[0] or 'image/unknown'
                # Base64 encode for preview
                if file_info['size'] < 5 * 1024 * 1024:  # 5 MB limit
                    full_content = self.parser.read_file(file_path)
                    if full_content:
                        preview['base64'] = base64.b64encode(full_content).decode('ascii')
            
            # Hex preview for binary files
            else:
                preview['type'] = 'binary'
                preview['canPreview'] = True
                preview['hexDump'] = self._create_hex_dump(content[:512])
                preview['mimeType'] = self._detect_mime_type(content)
            
            return preview
            
        except Exception as e:
            print(f"❌ Error creating preview: {e}")
            return None
    
    def _compute_hashes(self, content: bytes, algorithms: List[str] = None) -> Dict[str, str]:
        """Compute multiple hashes for content"""
        algorithms = algorithms or ['md5', 'sha1', 'sha256']
        hashes = {}
        
        for algo in algorithms:
            try:
                h = hashlib.new(algo)
                h.update(content)
                hashes[algo] = h.hexdigest()
            except Exception as e:
                print(f"❌ Error computing {algo} hash: {e}")
        
        return hashes
    
    def _create_hex_dump(self, data: bytes, bytes_per_line: int = 16) -> str:
        """Create a hex dump string from binary data"""
        lines = []
        for i in range(0, len(data), bytes_per_line):
            chunk = data[i:i + bytes_per_line]
            hex_part = ' '.join(f'{b:02x}' for b in chunk)
            ascii_part = ''.join(chr(b) if 32 <= b < 127 else '.' for b in chunk)
            lines.append(f'{i:08x}  {hex_part:<{bytes_per_line * 3}} {ascii_part}')
        return '\n'.join(lines)
    
    def _detect_mime_type(self, content: bytes) -> str:
        """Detect MIME type from content"""
        if MAGIC_AVAILABLE:
            try:
                return magic.from_buffer(content, mime=True)
            except:
                pass
        
        # Simple signature-based detection
        signatures = {
            b'\xFF\xD8\xFF': 'image/jpeg',
            b'\x89PNG': 'image/png',
            b'GIF87a': 'image/gif',
            b'GIF89a': 'image/gif',
            b'%PDF': 'application/pdf',
            b'PK\x03\x04': 'application/zip',
            b'\x1f\x8b': 'application/gzip',
        }
        
        for sig, mime in signatures.items():
            if content.startswith(sig):
                return mime
        
        return 'application/octet-stream'
    
    def _format_size(self, size: int) -> str:
        """Format file size in human-readable format"""
        for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
            if size < 1024:
                return f"{size:.2f} {unit}"
            size /= 1024
        return f"{size:.2f} PB"
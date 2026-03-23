# ═══════════════════════════════════════════════════════════════════════════
# FILE: python-services/disk_parser.py
# PURPOSE: Core disk image parsing using pytsk3
# ═══════════════════════════════════════════════════════════════════════════

import os
import hashlib
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any

try:
    import pytsk3
    PYTSK3_AVAILABLE = True
except ImportError:
    PYTSK3_AVAILABLE = False
    print("⚠️ pytsk3 not installed. Using fallback mode.")

from config import ActiveConfig as Config


class DiskImageParser:
    """
    Parser for raw/img disk images using pytsk3
    Supports NTFS and FAT32 file systems
    """
    
    def __init__(self, image_path: str):
        """
        Initialize the disk image parser
        
        Args:
            image_path: Path to the disk image file
        """
        self.image_path = image_path
        self.image_size = os.path.getsize(image_path)
        self.img_info = None
        self.fs_info = None
        self.file_cache = {}
        
        if PYTSK3_AVAILABLE:
            self._open_image()
        else:
            print(f"⚠️ Running in fallback mode for: {image_path}")
    
    def _open_image(self):
        """Open the disk image using pytsk3"""
        try:
            # Open the image
            self.img_info = pytsk3.Img_Info(self.image_path)
            
            # Try to open the file system
            try:
                self.fs_info = pytsk3.FS_Info(self.img_info)
                print(f"✅ Opened file system: {self.get_fs_type()}")
            except Exception as e:
                # Try common partition offsets
                common_offsets = [0, 512, 2048 * 512, 63 * 512, 1048576]
                for offset in common_offsets:
                    try:
                        self.fs_info = pytsk3.FS_Info(self.img_info, offset=offset)
                        print(f"✅ Opened file system at offset {offset}: {self.get_fs_type()}")
                        break
                    except:
                        continue
                
                if self.fs_info is None:
                    raise Exception(f"Could not open file system: {e}")
                    
        except Exception as e:
            print(f"❌ Error opening disk image: {e}")
            raise
    
    def get_fs_type(self) -> str:
        """Get the file system type"""
        if not self.fs_info:
            return "Unknown"
        
        fs_type = self.fs_info.info.ftype
        fs_types = {
            pytsk3.TSK_FS_TYPE_NTFS: "NTFS",
            pytsk3.TSK_FS_TYPE_FAT12: "FAT12",
            pytsk3.TSK_FS_TYPE_FAT16: "FAT16",
            pytsk3.TSK_FS_TYPE_FAT32: "FAT32",
            pytsk3.TSK_FS_TYPE_EXFAT: "exFAT",
        }
        return fs_types.get(fs_type, f"Unknown ({fs_type})")
    
    def get_disk_info(self) -> Dict[str, Any]:
        """Get information about the disk image"""
        info = {
            'imagePath': self.image_path,
            'imageSize': self.image_size,
            'imageSizeFormatted': self._format_size(self.image_size),
            'fileSystem': "Unknown",
            'blockSize': 0,
            'blockCount': 0,
            'freeBlocks': 0,
            'usedSpace': 0,
            'freeSpace': 0,
        }
        
        if self.fs_info:
            info['fileSystem'] = self.get_fs_type()
            info['blockSize'] = self.fs_info.info.block_size
            info['blockCount'] = self.fs_info.info.block_count
            
            total_space = info['blockSize'] * info['blockCount']
            info['usedSpace'] = total_space
            info['freeSpace'] = 0
            info['usedSpaceFormatted'] = self._format_size(info['usedSpace'])
            info['freeSpaceFormatted'] = self._format_size(info['freeSpace'])
        
        return info
    
    def list_files(self, directory: str = "/", recursive: bool = False) -> List[Dict[str, Any]]:
        """
        List files in a directory
        
        Args:
            directory: Path within the disk image
            recursive: Whether to list subdirectories recursively
            
        Returns:
            List of file information dictionaries
        """
        files = []
        
        if not self.fs_info:
            return files
        
        try:
            # Normalize path
            directory = directory.replace("\\", "/")
            if not directory.startswith("/"):
                directory = "/" + directory
            
            # Open directory
            dir_obj = self.fs_info.open_dir(path=directory)
            
            for entry in dir_obj:
                try:
                    # Skip . and ..
                    name = entry.info.name.name.decode('utf-8', errors='replace')
                    if name in ['.', '..']:
                        continue
                    
                    file_info = self._get_entry_info(entry, directory)
                    files.append(file_info)
                    
                    # Recursively list subdirectories
                    if recursive and file_info['isDirectory']:
                        sub_path = f"{directory}/{name}".replace("//", "/")
                        try:
                            sub_files = self.list_files(sub_path, recursive=True)
                            files.extend(sub_files)
                        except Exception:
                            pass
                            
                except Exception as e:
                    continue
                    
        except Exception as e:
            print(f"❌ Error listing directory {directory}: {e}")
        
        return files
    
    def _get_entry_info(self, entry, parent_path: str) -> Dict[str, Any]:
        """Extract information from a directory entry"""
        try:
            name = entry.info.name.name.decode('utf-8', errors='replace')
        except:
            name = "Unknown"
        
        full_path = f"{parent_path}/{name}".replace("//", "/")
        
        info = {
            'name': name,
            'path': full_path,
            'isDirectory': entry.info.name.type == pytsk3.TSK_FS_NAME_TYPE_DIR,
            'isFile': entry.info.name.type == pytsk3.TSK_FS_NAME_TYPE_REG,
            'size': 0,
            'sizeFormatted': '0 B',
            'extension': '',
            'created': None,
            'modified': None,
            'accessed': None,
            'isDeleted': False,
            'isAllocated': True,
        }
        
        # Get size if it's a file
        if entry.info.meta and info['isFile']:
            info['size'] = entry.info.meta.size
            info['sizeFormatted'] = self._format_size(info['size'])
            
            # Get extension
            if '.' in name:
                info['extension'] = '.' + name.rsplit('.', 1)[-1].lower()
            
            # Get timestamps
            info['created'] = self._timestamp_to_iso(entry.info.meta.crtime)
            info['modified'] = self._timestamp_to_iso(entry.info.meta.mtime)
            info['accessed'] = self._timestamp_to_iso(entry.info.meta.atime)
        
        # Check if deleted/unallocated
        if entry.info.name.flags:
            info['isDeleted'] = bool(entry.info.name.flags & pytsk3.TSK_FS_NAME_FLAG_UNALLOC)
            info['isAllocated'] = not info['isDeleted']
        
        # Get file category
        info['category'] = self._get_file_category(info['extension'])
        
        return info
    
    def get_file_info(self, file_path: str) -> Optional[Dict[str, Any]]:
        """Get detailed information about a specific file"""
        if not self.fs_info:
            return None
        
        try:
            file_path = file_path.replace("\\", "/")
            if not file_path.startswith("/"):
                file_path = "/" + file_path
            
            file_obj = self.fs_info.open(path=file_path)
            
            name = os.path.basename(file_path)
            extension = ''
            if '.' in name:
                extension = '.' + name.rsplit('.', 1)[-1].lower()
            
            info = {
                'name': name,
                'path': file_path,
                'isDirectory': file_obj.info.meta.type == pytsk3.TSK_FS_META_TYPE_DIR,
                'isFile': file_obj.info.meta.type == pytsk3.TSK_FS_META_TYPE_REG,
                'size': file_obj.info.meta.size,
                'sizeFormatted': self._format_size(file_obj.info.meta.size),
                'extension': extension,
                'category': self._get_file_category(extension),
                'created': self._timestamp_to_iso(file_obj.info.meta.crtime),
                'modified': self._timestamp_to_iso(file_obj.info.meta.mtime),
                'accessed': self._timestamp_to_iso(file_obj.info.meta.atime),
                'changed': self._timestamp_to_iso(file_obj.info.meta.ctime),
                'inode': file_obj.info.meta.addr,
                'uid': file_obj.info.meta.uid,
                'gid': file_obj.info.meta.gid,
            }
            
            return info
            
        except Exception as e:
            print(f"❌ Error getting file info for {file_path}: {e}")
            return None
    
    def read_file(self, file_path: str, max_size: Optional[int] = None) -> Optional[bytes]:
        """
        Read file contents from the disk image
        
        Args:
            file_path: Path to the file within the disk image
            max_size: Maximum bytes to read (None for entire file)
            
        Returns:
            File contents as bytes, or None if failed
        """
        if not self.fs_info:
            return None
        
        try:
            file_path = file_path.replace("\\", "/")
            if not file_path.startswith("/"):
                file_path = "/" + file_path
            
            file_obj = self.fs_info.open(path=file_path)
            
            size = file_obj.info.meta.size
            if max_size:
                size = min(size, max_size)
            
            # Read in chunks for large files
            data = b''
            offset = 0
            chunk_size = 1024 * 1024  # 1 MB chunks
            
            while offset < size:
                read_size = min(chunk_size, size - offset)
                chunk = file_obj.read_random(offset, read_size)
                if not chunk:
                    break
                data += chunk
                offset += len(chunk)
            
            return data
            
        except Exception as e:
            print(f"❌ Error reading file {file_path}: {e}")
            return None
    
    def get_file_tree(self, max_depth: int = 10) -> Dict[str, Any]:
        """
        Build a complete file tree structure
        
        Returns:
            Nested dictionary representing the file tree
        """
        def build_tree(path: str, depth: int) -> Dict[str, Any]:
            if depth > max_depth:
                return {'truncated': True}
            
            node = {
                'name': os.path.basename(path) or 'Root',
                'path': path,
                'type': 'directory',
                'children': []
            }
            
            files = self.list_files(path, recursive=False)
            
            for file_info in files:
                if file_info['isDirectory']:
                    child = build_tree(file_info['path'], depth + 1)
                    node['children'].append(child)
                else:
                    node['children'].append({
                        'name': file_info['name'],
                        'path': file_info['path'],
                        'type': 'file',
                        'size': file_info['size'],
                        'sizeFormatted': file_info['sizeFormatted'],
                        'extension': file_info['extension'],
                        'category': file_info['category']
                    })
            
            # Sort: directories first, then files, alphabetically
            node['children'].sort(key=lambda x: (x['type'] != 'directory', x['name'].lower()))
            
            return node
        
        try:
            return build_tree("/", 0)
        except Exception as e:
            print(f"❌ Error building file tree: {e}")
            return {'name': 'Root', 'path': '/', 'type': 'directory', 'children': [], 'error': str(e)}
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get statistics about the disk image contents"""
        stats = {
            'totalFiles': 0,
            'totalDirectories': 0,
            'totalSize': 0,
            'byExtension': {},
            'byCategory': {},
            'largestFiles': [],
            'recentFiles': [],
        }
        
        try:
            all_files = self.list_files("/", recursive=True)
            
            largest = []
            recent = []
            
            for f in all_files:
                if f['isFile']:
                    stats['totalFiles'] += 1
                    stats['totalSize'] += f['size']
                    
                    # Count by extension
                    ext = f['extension'] or 'no_extension'
                    stats['byExtension'][ext] = stats['byExtension'].get(ext, 0) + 1
                    
                    # Count by category
                    cat = f['category']
                    stats['byCategory'][cat] = stats['byCategory'].get(cat, 0) + 1
                    
                    # Track largest files
                    largest.append({'name': f['name'], 'path': f['path'], 'size': f['size']})
                    
                    # Track recent files
                    if f['modified']:
                        recent.append({'name': f['name'], 'path': f['path'], 'modified': f['modified']})
                        
                elif f['isDirectory']:
                    stats['totalDirectories'] += 1
            
            # Get top 10 largest
            largest.sort(key=lambda x: x['size'], reverse=True)
            stats['largestFiles'] = largest[:10]
            
            # Get top 10 most recent
            recent.sort(key=lambda x: x['modified'] or '', reverse=True)
            stats['recentFiles'] = recent[:10]
            
            stats['totalSizeFormatted'] = self._format_size(stats['totalSize'])
            
        except Exception as e:
            print(f"❌ Error computing statistics: {e}")
            stats['error'] = str(e)
        
        return stats
    
    def _format_size(self, size: int) -> str:
        """Format file size in human-readable format"""
        for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
            if size < 1024:
                return f"{size:.2f} {unit}"
            size /= 1024
        return f"{size:.2f} PB"
    
    def _timestamp_to_iso(self, timestamp) -> Optional[str]:
        """Convert Unix timestamp to ISO format string"""
        try:
            if timestamp and timestamp > 0:
                return datetime.fromtimestamp(timestamp).isoformat()
        except:
            pass
        return None
    
    def _get_file_category(self, extension: str) -> str:
        """Get category for a file extension"""
        extension = extension.lower()
        for category, extensions in Config.FILE_CATEGORIES.items():
            if extension in extensions:
                return category
        return 'other'


# ════════════════════════════════════════════════════════════════════════════
# FALLBACK PARSER (when pytsk3 is not available)
# ════════════════════════════════════════════════════════════════════════════

class FallbackDiskParser:
    """
    Fallback parser for testing when pytsk3 is not installed.
    Returns empty/mock data.
    """
    
    def __init__(self, image_path: str):
        self.image_path = image_path
        self.image_size = os.path.getsize(image_path) if os.path.exists(image_path) else 0
        print(f"⚠️ Using fallback parser for: {image_path}")
    
    def get_disk_info(self) -> Dict[str, Any]:
        return {
            'imagePath': self.image_path,
            'imageSize': self.image_size,
            'imageSizeFormatted': f"{self.image_size / (1024*1024):.2f} MB",
            'fileSystem': "Unknown (pytsk3 not installed)",
            'blockSize': 0,
            'blockCount': 0,
            'note': "Install pytsk3 for full disk parsing functionality"
        }
    
    def list_files(self, directory: str = "/", recursive: bool = False) -> List[Dict]:
        return []
    
    def get_file_info(self, file_path: str) -> Optional[Dict]:
        return None
    
    def read_file(self, file_path: str, max_size: Optional[int] = None) -> Optional[bytes]:
        return None
    
    def get_file_tree(self, max_depth: int = 10) -> Dict:
        return {'name': 'Root', 'path': '/', 'type': 'directory', 'children': []}
    
    def get_statistics(self) -> Dict:
        return {'totalFiles': 0, 'totalDirectories': 0, 'note': 'pytsk3 not installed'}


# Use fallback if pytsk3 not available
if not PYTSK3_AVAILABLE:
    DiskImageParser = FallbackDiskParser
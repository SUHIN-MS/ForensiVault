# ═══════════════════════════════════════════════════════════════════════════
# FILE: python-services/config.py
# PURPOSE: Configuration for Python forensic services
# ═══════════════════════════════════════════════════════════════════════════

import os
from pathlib import Path


class Config:
    """Configuration settings for the Python forensic service"""

    # Base directories
    BASE_DIR = Path(__file__).parent.parent  # forensivault root
    PYTHON_SERVICES_DIR = Path(__file__).parent

    # Storage directories
    DISK_IMAGES_DIR = BASE_DIR / 'disk-images'
    EXTRACTED_DIR = BASE_DIR / 'extracted'
    TEMP_DIR = BASE_DIR / 'temp'
    CARVED_DIR = BASE_DIR / 'carved'

    # Server settings
    HOST = '127.0.0.1'
    PORT = 5001
    DEBUG = True

    # File limits
    MAX_DISK_IMAGE_SIZE = 1024 * 1024 * 1024 * 1024  # 1 TB in bytes
    MAX_EXTRACT_SIZE = 100 * 1024 * 1024  # 100 MB per file extraction

    # Supported formats
    ALLOWED_DISK_EXTENSIONS = ['.img', '.raw', '.dd']
    SUPPORTED_FILE_SYSTEMS = ['NTFS', 'FAT32', 'FAT16', 'FAT12', 'exFAT']

    # File categories for search/filter
    FILE_CATEGORIES = {
        'documents': ['.pdf', '.doc', '.docx', '.txt', '.rtf', '.odt', '.xls', '.xlsx', '.ppt', '.pptx'],
        'images': ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.ico', '.webp'],
        'videos': ['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm'],
        'audio': ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.wma'],
        'archives': ['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2'],
        'executables': ['.exe', '.dll', '.sys', '.bat', '.cmd', '.ps1'],
        'code': ['.py', '.js', '.html', '.css', '.java', '.cpp', '.c', '.h'],
    }

    # Content search settings
    SEARCHABLE_EXTENSIONS = ['.txt', '.pdf', '.doc', '.docx', '.rtf', '.html', '.xml', '.json', '.csv']
    MAX_CONTENT_PREVIEW_SIZE = 10 * 1024  # 10 KB preview

    # OCR settings (optional)
    TESSERACT_PATH = r'C:\Program Files\Tesseract-OCR\tesseract.exe'  # Windows default
    OCR_ENABLED = False  # Set to True after installing Tesseract

    @classmethod
    def ensure_directories(cls):
        """Create necessary directories if they don't exist"""
        directories = [
            cls.DISK_IMAGES_DIR,
            cls.EXTRACTED_DIR,
            cls.TEMP_DIR,
            cls.CARVED_DIR,
        ]
        for directory in directories:
            directory.mkdir(parents=True, exist_ok=True)
        print(f"Directories verified:")
        print(f"   - Disk Images: {cls.DISK_IMAGES_DIR}")
        print(f"   - Extracted: {cls.EXTRACTED_DIR}")
        print(f"   - Temp: {cls.TEMP_DIR}")
        print(f"   - Carved: {cls.CARVED_DIR}")


class DevelopmentConfig(Config):
    """Development configuration"""
    DEBUG = True


class ProductionConfig(Config):
    """Production configuration"""
    DEBUG = False
    HOST = '0.0.0.0'


# Active configuration
ActiveConfig = DevelopmentConfig
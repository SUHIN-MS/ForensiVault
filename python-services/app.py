# ═══════════════════════════════════════════════════════════════════════════
# FILE: python-services/app.py
# PURPOSE: Flask API server for disk image parsing, file extraction, and carving
# ═══════════════════════════════════════════════════════════════════════════

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import os
import sys
import traceback
import threading
from datetime import datetime
from pathlib import Path
from forensic_analyzer import ForensicAnalyzer

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from config import ActiveConfig as Config
from disk_parser import DiskImageParser
from file_extractor import FileExtractor
from content_analyzer import ContentAnalyzer
from file_carver import FileCarver

# Initialize Flask app
app = Flask(__name__)
CORS(app, origins=['http://localhost:3000', 'http://localhost:5173', 'https://forensi-vault.vercel.app'])

# Ensure directories exist
Config.ensure_directories()

# Store active parsers (disk_image_path -> parser instance)
active_parsers = {}

# Store running carving jobs: image_path -> job info
carving_jobs = {}


# ═══════════════════════════════════════════════════════════════════════════
# HELPER FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════

def get_parser(image_path):
    """Get or create a parser for a disk image"""
    image_path = str(image_path)
    if image_path not in active_parsers:
        active_parsers[image_path] = DiskImageParser(image_path)
    return active_parsers[image_path]


def error_response(message, status_code=400):
    """Create a standardized error response"""
    return jsonify({
        'success': False,
        'error': message,
        'timestamp': datetime.now().isoformat()
    }), status_code


def success_response(data, message="Success"):
    """Create a standardized success response"""
    return jsonify({
        'success': True,
        'message': message,
        'data': data,
        'timestamp': datetime.now().isoformat()
    })


# ═══════════════════════════════════════════════════════════════════════════
# HEALTH CHECK
# ═══════════════════════════════════════════════════════════════════════════

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'running',
        'service': 'ForensiVault Python Services',
        'version': '1.0.0',
        'timestamp': datetime.now().isoformat(),
        'capabilities': {
            'disk_parsing': True,
            'file_extraction': True,
            'content_search': True,
            'file_carving': True,
            'ocr': Config.OCR_ENABLED
        }
    })

@app.route('/disk/upload', methods=['POST'])
def upload_disk_image():
    """Receive a disk image file and save it locally"""
    try:
        if 'file' not in request.files:
            return error_response("No file provided")
        
        file = request.files['file']
        if file.filename == '':
            return error_response("No file selected")
        
        save_dir = Config.DISK_IMAGES_DIR
        save_dir.mkdir(parents=True, exist_ok=True)
        save_path = save_dir / file.filename
        file.save(str(save_path))
        
        return success_response({
            'imagePath': str(save_path),
            'filename': file.filename,
            'size': os.path.getsize(str(save_path))
        }, "Disk image uploaded successfully")
    
    except Exception as e:
        traceback.print_exc()
        return error_response(str(e), 500)

# ═══════════════════════════════════════════════════════════════════════════
# DISK IMAGE MANAGEMENT
# ═══════════════════════════════════════════════════════════════════════════

@app.route('/disk/parse', methods=['POST'])
def parse_disk_image():
    try:
        data = request.get_json()
        if not data or 'imagePath' not in data:
            return error_response("imagePath is required")

        image_path = data['imagePath']

        if not os.path.exists(image_path):
            return error_response(f"Disk image not found: {image_path}", 404)

        ext = os.path.splitext(image_path)[1].lower()
        if ext not in Config.ALLOWED_DISK_EXTENSIONS:
            return error_response(f"Unsupported disk image format: {ext}")

        file_size = os.path.getsize(image_path)
        if file_size > Config.MAX_DISK_IMAGE_SIZE:
            return error_response(f"Disk image exceeds maximum size limit (1TB)")

        parser = get_parser(image_path)
        info = parser.get_disk_info()

        return success_response({
            'imagePath': image_path,
            'diskInfo': info
        }, "Disk image parsed successfully")

    except Exception as e:
        traceback.print_exc()
        return error_response(str(e), 500)


@app.route('/disk/files', methods=['POST'])
def list_files():
    try:
        data = request.get_json()
        if not data or 'imagePath' not in data:
            return error_response("imagePath is required")

        image_path = data['imagePath']
        directory = data.get('directory', '/')
        recursive = data.get('recursive', False)

        if not os.path.exists(image_path):
            return error_response(f"Disk image not found: {image_path}", 404)

        parser = get_parser(image_path)
        files = parser.list_files(directory, recursive=recursive)

        return success_response({
            'imagePath': image_path,
            'directory': directory,
            'fileCount': len(files),
            'files': files
        }, "Files listed successfully")

    except Exception as e:
        traceback.print_exc()
        return error_response(str(e), 500)


@app.route('/disk/tree', methods=['POST'])
def get_file_tree():
    try:
        data = request.get_json()
        if not data or 'imagePath' not in data:
            return error_response("imagePath is required")

        image_path = data['imagePath']
        max_depth = data.get('maxDepth', 10)

        if not os.path.exists(image_path):
            return error_response(f"Disk image not found: {image_path}", 404)

        parser = get_parser(image_path)
        tree = parser.get_file_tree(max_depth=max_depth)

        return success_response({
            'imagePath': image_path,
            'tree': tree
        }, "File tree generated successfully")

    except Exception as e:
        traceback.print_exc()
        return error_response(str(e), 500)


# ═══════════════════════════════════════════════════════════════════════════
# FILE OPERATIONS
# ═══════════════════════════════════════════════════════════════════════════

@app.route('/disk/file/info', methods=['POST'])
def get_file_info():
    try:
        data = request.get_json()
        if not data or 'imagePath' not in data or 'filePath' not in data:
            return error_response("imagePath and filePath are required")

        image_path = data['imagePath']
        file_path = data['filePath']

        parser = get_parser(image_path)
        file_info = parser.get_file_info(file_path)

        if not file_info:
            return error_response(f"File not found: {file_path}", 404)

        return success_response(file_info, "File info retrieved successfully")

    except Exception as e:
        traceback.print_exc()
        return error_response(str(e), 500)


@app.route('/disk/file/preview', methods=['POST'])
def preview_file():
    try:
        data = request.get_json()
        if not data or 'imagePath' not in data or 'filePath' not in data:
            return error_response("imagePath and filePath are required")

        image_path = data['imagePath']
        file_path = data['filePath']
        max_size = data.get('maxSize', Config.MAX_CONTENT_PREVIEW_SIZE)

        parser = get_parser(image_path)
        extractor = FileExtractor(parser)

        preview = extractor.get_preview(file_path, max_size=max_size)

        if preview is None:
            return error_response(f"Cannot preview file: {file_path}", 400)

        return success_response(preview, "Preview generated successfully")

    except Exception as e:
        traceback.print_exc()
        return error_response(str(e), 500)


@app.route('/disk/file/extract', methods=['POST'])
def extract_file():
    try:
        data = request.get_json()
        if not data or 'imagePath' not in data or 'filePath' not in data:
            return error_response("imagePath and filePath are required")

        image_path = data['imagePath']
        file_path = data['filePath']
        output_dir = data.get('outputDir', str(Config.EXTRACTED_DIR))

        parser = get_parser(image_path)
        extractor = FileExtractor(parser)

        result = extractor.extract_file(file_path, output_dir)

        if not result['success']:
            return error_response(result.get('error', 'Extraction failed'), 400)

        return success_response(result, "File extracted successfully")

    except Exception as e:
        traceback.print_exc()
        return error_response(str(e), 500)


@app.route('/disk/file/hash', methods=['POST'])
def compute_file_hash():
    try:
        data = request.get_json()
        if not data or 'imagePath' not in data or 'filePath' not in data:
            return error_response("imagePath and filePath are required")

        image_path = data['imagePath']
        file_path = data['filePath']
        algorithms = data.get('algorithms', ['sha256'])

        parser = get_parser(image_path)
        extractor = FileExtractor(parser)

        hashes = extractor.compute_hash(file_path, algorithms)

        if not hashes:
            return error_response(f"Cannot compute hash for: {file_path}", 400)

        return success_response({
            'filePath': file_path,
            'hashes': hashes
        }, "Hash computed successfully")

    except Exception as e:
        traceback.print_exc()
        return error_response(str(e), 500)


# ═══════════════════════════════════════════════════════════════════════════
# SEARCH
# ═══════════════════════════════════════════════════════════════════════════

@app.route('/disk/search', methods=['POST'])
def search_files():
    try:
        data = request.get_json()
        if not data or 'imagePath' not in data:
            return error_response("imagePath is required")

        image_path = data['imagePath']
        query = data.get('query', '')
        search_in = data.get('searchIn', ['filename', 'extension', 'path'])
        file_types = data.get('fileTypes', [])
        extensions = data.get('extensions', [])
        min_size = data.get('minSize', 0)
        max_size = data.get('maxSize', None)
        date_from = data.get('dateFrom', None)
        date_to = data.get('dateTo', None)

        parser = get_parser(image_path)
        analyzer = ContentAnalyzer(parser)

        results = analyzer.search(
            query=query,
            search_in=search_in,
            file_types=file_types,
            extensions=extensions,
            min_size=min_size,
            max_size=max_size,
            date_from=date_from,
            date_to=date_to
        )

        return success_response({
            'imagePath': image_path,
            'query': query,
            'resultCount': len(results),
            'results': results
        }, f"Found {len(results)} matching files")

    except Exception as e:
        traceback.print_exc()
        return error_response(str(e), 500)


@app.route('/disk/search/content', methods=['POST'])
def search_content():
    try:
        data = request.get_json()
        if not data or 'imagePath' not in data or 'query' not in data:
            return error_response("imagePath and query are required")

        image_path = data['imagePath']
        query = data['query']
        extensions = data.get('extensions', Config.SEARCHABLE_EXTENSIONS)
        case_sensitive = data.get('caseSensitive', False)
        max_results = data.get('maxResults', 100)

        parser = get_parser(image_path)
        analyzer = ContentAnalyzer(parser)

        results = analyzer.search_content(
            query=query,
            extensions=extensions,
            case_sensitive=case_sensitive,
            max_results=max_results
        )

        return success_response({
            'imagePath': image_path,
            'query': query,
            'resultCount': len(results),
            'results': results
        }, f"Found {len(results)} files containing '{query}'")

    except Exception as e:
        traceback.print_exc()
        return error_response(str(e), 500)


# ═══════════════════════════════════════════════════════════════════════════
# STATISTICS
# ═══════════════════════════════════════════════════════════════════════════

@app.route('/disk/stats', methods=['POST'])
def get_disk_stats():
    try:
        data = request.get_json()
        if not data or 'imagePath' not in data:
            return error_response("imagePath is required")

        image_path = data['imagePath']

        parser = get_parser(image_path)
        stats = parser.get_statistics()

        return success_response({
            'imagePath': image_path,
            'statistics': stats
        }, "Statistics generated successfully")

    except Exception as e:
        traceback.print_exc()
        return error_response(str(e), 500)


# ═══════════════════════════════════════════════════════════════════════════
# FILE CARVING
# ═══════════════════════════════════════════════════════════════════════════

@app.route('/carve/types', methods=['GET'])
def carve_supported_types():
    """Return the list of file types the carver can recover"""
    return success_response({
        'types': FileCarver.supported_types()
    })


@app.route('/carve/start', methods=['POST'])
def carve_start():
    """Start a file-carving job (runs in background thread)."""
    try:
        data = request.get_json()
        if not data or 'imagePath' not in data:
            return error_response("imagePath is required")

        image_path = data['imagePath']
        output_dir = data.get('outputDir', str(Config.CARVED_DIR))
        file_types = data.get('fileTypes', None)

        if not os.path.exists(image_path):
            return error_response(f"Disk image not found: {image_path}", 404)

        # Prevent duplicate jobs
        if image_path in carving_jobs and carving_jobs[image_path]['status'] in ('scanning', 'extracting'):
            return error_response("Carving already in progress for this image")

        # Initialise job record
        carving_jobs[image_path] = {
            'status': 'scanning',
            'progress': 0,
            'filesFound': 0,
            'results': [],
            'startedAt': datetime.now().isoformat(),
            'completedAt': None,
            'error': None,
        }

        def _run():
            try:
                carver = FileCarver(image_path)

                def on_progress(pct, status):
                    carving_jobs[image_path]['progress'] = pct
                    carving_jobs[image_path]['status'] = status

                results = carver.carve(
                    output_dir=output_dir,
                    file_types=file_types,
                    progress_cb=on_progress,
                )

                # Cross-reference with file system to detect deleted files
                try:
                    parser = get_parser(image_path)
                    results = carver.mark_deleted_files(results, parser)
                except Exception as e:
                    print(f"Warning: Deleted-file detection skipped: {e}")

                carving_jobs[image_path].update({
                    'status': 'complete',
                    'progress': 100,
                    'results': results,
                    'filesFound': len(results),
                    'completedAt': datetime.now().isoformat(),
                })
                print(f"Carving complete: {len(results)} files from {image_path}")

            except Exception as e:
                traceback.print_exc()
                carving_jobs[image_path].update({
                    'status': 'error',
                    'error': str(e),
                })

        t = threading.Thread(target=_run, daemon=True)
        t.start()

        return success_response({'imagePath': image_path, 'status': 'scanning'},
                                "Carving started in background")

    except Exception as e:
        traceback.print_exc()
        return error_response(str(e), 500)


@app.route('/carve/status', methods=['POST'])
def carve_status():
    """Poll the progress of a running carving job"""
    try:
        data = request.get_json()
        image_path = data.get('imagePath', '')

        if image_path not in carving_jobs:
            return error_response("No carving job found for this image")

        job = carving_jobs[image_path]
        return success_response({
            'status': job['status'],
            'progress': job['progress'],
            'filesFound': job['filesFound'],
            'startedAt': job['startedAt'],
            'completedAt': job['completedAt'],
            'error': job['error'],
        })

    except Exception as e:
        return error_response(str(e), 500)


@app.route('/carve/results', methods=['POST'])
def carve_results():
    """Return the carved files list once the job is complete"""
    try:
        data = request.get_json()
        image_path = data.get('imagePath', '')

        if image_path not in carving_jobs:
            return error_response("No carving job found")

        job = carving_jobs[image_path]
        if job['status'] != 'complete':
            return error_response(f"Carving not complete (status: {job['status']})")

        # Strip local filepath from results before sending to client
        safe_results = []
        for r in job['results']:
            entry = {k: v for k, v in r.items() if k != 'filepath'}
            safe_results.append(entry)

        return success_response({
            'totalFiles': len(safe_results),
            'results': safe_results,
            'startedAt': job['startedAt'],
            'completedAt': job['completedAt'],
        })

    except Exception as e:
        return error_response(str(e), 500)

# ═══════════════════════════════════════════════════════════════════════════
# FORENSIC FILE ANALYSIS
# ═══════════════════════════════════════════════════════════════════════════

@app.route('/analyze/file', methods=['POST'])
def analyze_file():
    """Analyze a single file for tampering indicators"""
    try:
        data = request.get_json()
        if not data or 'filePath' not in data:
            return error_response("filePath is required")

        file_path = data['filePath']
        if not os.path.exists(file_path):
            return error_response(f"File not found: {file_path}", 404)

        analyzer = ForensicAnalyzer()
        report = analyzer.analyze(file_path)

        return success_response(report, "Analysis complete")

    except Exception as e:
        traceback.print_exc()
        return error_response(str(e), 500)


@app.route('/analyze/batch', methods=['POST'])
def analyze_batch():
    """Analyze multiple files at once"""
    try:
        data = request.get_json()
        if not data or 'filePaths' not in data:
            return error_response("filePaths array is required")

        analyzer = ForensicAnalyzer()
        results = []

        for fp in data['filePaths']:
            if os.path.exists(fp):
                report = analyzer.analyze(fp)
                results.append(report)
            else:
                results.append({'fileName': os.path.basename(fp), 'error': 'File not found'})

        return success_response({
            'totalFiles': len(results),
            'results': results,
        }, f"Analyzed {len(results)} files")

    except Exception as e:
        traceback.print_exc()
        return error_response(str(e), 500)

# ═══════════════════════════════════════════════════════════════════════════
# CLEANUP
# ═══════════════════════════════════════════════════════════════════════════

@app.route('/disk/close', methods=['POST'])
def close_disk_image():
    try:
        data = request.get_json()
        if not data or 'imagePath' not in data:
            return error_response("imagePath is required")

        image_path = str(data['imagePath'])

        if image_path in active_parsers:
            del active_parsers[image_path]
            return success_response({
                'imagePath': image_path
            }, "Disk image closed successfully")
        else:
            return success_response({
                'imagePath': image_path
            }, "Disk image was not open")

    except Exception as e:
        traceback.print_exc()
        return error_response(str(e), 500)


# ═══════════════════════════════════════════════════════════════════════════
# ERROR HANDLERS
# ═══════════════════════════════════════════════════════════════════════════

@app.errorhandler(404)
def not_found(e):
    return error_response("Endpoint not found", 404)


@app.errorhandler(500)
def internal_error(e):
    return error_response("Internal server error", 500)


# ═══════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════

if __name__ == '__main__':
    print("=" * 57)
    print("     ForensiVault Python Services")
    print(f"     Running on http://{Config.HOST}:{Config.PORT}")
    print("     Disk Image Parser: READY")
    print("     File Carver: READY")
    print("=" * 57)

    app.run(
        host=Config.HOST,
        port=Config.PORT,
        debug=Config.DEBUG,
        threaded=True
    )
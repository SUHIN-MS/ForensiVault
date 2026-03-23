# ═══════════════════════════════════════════════════════════════════════════
# FILE: python-services/file_carver.py
# PURPOSE: Signature-based file carving from raw disk images
# ═══════════════════════════════════════════════════════════════════════════

import os
import hashlib
import struct
import zipfile
import io
from datetime import datetime
from typing import List, Dict, Any, Optional, Callable


# ═══════════════════════════════════════════════════════════════════════════
# FILE SIGNATURE DEFINITIONS
# ═══════════════════════════════════════════════════════════════════════════

SIGNATURES = [
    {
        'name': 'JPEG',
        'header': b'\xFF\xD8\xFF',
        'footer': b'\xFF\xD9',
        'extension': '.jpg',
        'mime': 'image/jpeg',
        'category': 'images',
        'max_size': 25 * 1024 * 1024,
        'min_size': 500,
    },
    {
        'name': 'PNG',
        'header': b'\x89\x50\x4E\x47\x0D\x0A\x1A\x0A',
        'footer': b'\x49\x45\x4E\x44\xAE\x42\x60\x82',
        'extension': '.png',
        'mime': 'image/png',
        'category': 'images',
        'max_size': 25 * 1024 * 1024,
        'min_size': 100,
    },
    {
        'name': 'GIF',
        'header': b'\x47\x49\x46\x38',
        'footer': b'\x00\x3B',
        'extension': '.gif',
        'mime': 'image/gif',
        'category': 'images',
        'max_size': 10 * 1024 * 1024,
        'min_size': 50,
    },
    {
        'name': 'BMP',
        'header': b'\x42\x4D',
        'footer': None,
        'extension': '.bmp',
        'mime': 'image/bmp',
        'category': 'images',
        'max_size': 25 * 1024 * 1024,
        'min_size': 100,
        'has_size_field': True,
        'size_offset': 2,
        'size_length': 4,
        'size_endian': 'little',
    },
    {
        'name': 'PDF',
        'header': b'\x25\x50\x44\x46',
        'footer': b'\x25\x25\x45\x4F\x46',
        'extension': '.pdf',
        'mime': 'application/pdf',
        'category': 'documents',
        'max_size': 50 * 1024 * 1024,
        'min_size': 67,
    },
    {
        'name': 'ZIP',
        'header': b'\x50\x4B\x03\x04',
        'footer': b'\x50\x4B\x05\x06',
        'extension': '.zip',
        'mime': 'application/zip',
        'category': 'archives',
        'max_size': 100 * 1024 * 1024,
        'min_size': 100,
    },
    {
        'name': 'RAR',
        'header': b'\x52\x61\x72\x21\x1A\x07',
        'footer': None,
        'extension': '.rar',
        'mime': 'application/x-rar-compressed',
        'category': 'archives',
        'max_size': 100 * 1024 * 1024,
        'min_size': 100,
    },
    {
        'name': 'MP3',
        'header': b'\x49\x44\x33',
        'footer': None,
        'extension': '.mp3',
        'mime': 'audio/mpeg',
        'category': 'audio',
        'max_size': 25 * 1024 * 1024,
        'min_size': 1000,
    },
    {
        'name': 'AVI',
        'header': b'\x52\x49\x46\x46',
        'footer': None,
        'extension': '.avi',
        'mime': 'video/x-msvideo',
        'category': 'videos',
        'max_size': 200 * 1024 * 1024,
        'min_size': 1000,
        'has_size_field': True,
        'size_offset': 4,
        'size_length': 4,
        'size_endian': 'little',
        'size_add': 8,
    },
    {
        'name': 'TIFF',
        'header': b'\x49\x49\x2A\x00',
        'footer': None,
        'extension': '.tiff',
        'mime': 'image/tiff',
        'category': 'images',
        'max_size': 50 * 1024 * 1024,
        'min_size': 100,
    },
    {
        'name': 'TIFF_BE',
        'header': b'\x4D\x4D\x00\x2A',
        'footer': None,
        'extension': '.tiff',
        'mime': 'image/tiff',
        'category': 'images',
        'max_size': 50 * 1024 * 1024,
        'min_size': 100,
    },
]


# ═══════════════════════════════════════════════════════════════════════════
# FILE CARVER CLASS
# ═══════════════════════════════════════════════════════════════════════════

class FileCarver:
    """
    Signature-based file carver for raw disk images.
    Recovers files by scanning for known file headers/footers
    in raw byte data — works even on corrupted or deleted partitions.
    """

    CHUNK_SIZE = 4 * 1024 * 1024  # 4 MB read chunks

    def __init__(self, image_path: str):
        if not os.path.exists(image_path):
            raise FileNotFoundError(f"Disk image not found: {image_path}")

        self.image_path = image_path
        self.image_size = os.path.getsize(image_path)
        self.progress_callback: Optional[Callable] = None

    # ───────────────────────────────────────────────────────────────────
    # PUBLIC: Main carving entry point
    # ───────────────────────────────────────────────────────────────────

    def carve(
        self,
        output_dir: str,
        file_types: Optional[List[str]] = None,
        progress_cb: Optional[Callable] = None,
    ) -> List[Dict[str, Any]]:
        """
        Carve files from the disk image.

        Args:
            output_dir:  Directory to save carved files
            file_types:  Filter by category e.g. ['images','documents']
                         or by name e.g. ['JPEG','PDF'].  None = all.
            progress_cb: Callback(progress: int, status: str)

        Returns:
            List of carved-file metadata dicts
        """
        self.progress_callback = progress_cb
        os.makedirs(output_dir, exist_ok=True)

        # Pick which signatures to look for
        sigs = self._filter_signatures(file_types)
        if not sigs:
            return []

        self._report(0, 'scanning')

        # Phase 1 - find every header occurrence  (0-45%)
        found = self._scan_for_headers(sigs)
        print(f"   Found {len(found)} potential file headers")

        if not found:
            self._report(100, 'complete')
            return []

        # Phase 2 - extract & validate each hit   (45-95%)
        results = self._extract_all(found, output_dir)
        print(f"   Successfully carved {len(results)} files")

        self._report(100, 'complete')
        return results

    # ───────────────────────────────────────────────────────────────────
    # Phase 1: Scan raw bytes for known headers
    # ───────────────────────────────────────────────────────────────────

    def _scan_for_headers(self, sigs: list) -> List[dict]:
        max_hdr = max(len(s['header']) for s in sigs)
        overlap = max_hdr
        found: List[dict] = []

        with open(self.image_path, 'rb') as fh:
            prev_tail = b''
            offset = 0

            while True:
                chunk = fh.read(self.CHUNK_SIZE)
                if not chunk:
                    break

                buf = prev_tail + chunk
                base = offset - len(prev_tail)

                for sig in sigs:
                    hdr = sig['header']
                    pos = 0
                    while True:
                        idx = buf.find(hdr, pos)
                        if idx == -1:
                            break
                        abs_off = base + idx
                        if abs_off >= 0:
                            found.append({'sig': sig, 'offset': abs_off})
                        pos = idx + 1

                prev_tail = chunk[-overlap:] if len(chunk) >= overlap else chunk
                offset += len(chunk)

                self._report(int((offset / self.image_size) * 45), 'scanning')

        found.sort(key=lambda x: x['offset'])
        return found

    # ───────────────────────────────────────────────────────────────────
    # Phase 2: Extract & validate each candidate
    # ───────────────────────────────────────────────────────────────────

    def _extract_all(self, found: list, output_dir: str) -> List[dict]:
        results: List[dict] = []
        total = len(found)

        for i, hit in enumerate(found):
            sig = hit['sig']
            start = hit['offset']

            # Upper boundary = next header or max_size
            if i + 1 < total:
                boundary = min(found[i + 1]['offset'] - start, sig['max_size'])
            else:
                boundary = sig['max_size']
            boundary = min(boundary, self.image_size - start)

            if boundary < sig.get('min_size', 1):
                continue

            # Read raw data
            with open(self.image_path, 'rb') as fh:
                fh.seek(start)
                raw = fh.read(boundary)

            if not raw:
                continue

            # Determine true file size
            file_data = self._determine_bounds(raw, sig)
            if file_data is None or len(file_data) < sig.get('min_size', 1):
                continue

            # Validate structure
            if not self._validate(file_data, sig):
                continue

            # Identify ZIP sub-type (DOCX / XLSX / PPTX)
            actual_name = sig['name']
            ext = sig['extension']
            mime = sig['mime']
            category = sig['category']

            if sig['name'] == 'ZIP':
                sub = self._identify_zip_subtype(file_data)
                if sub:
                    actual_name, ext, mime, category = sub

            # Save file
            idx = len(results) + 1
            filename = f"carved_{idx:04d}{ext}"
            filepath = os.path.join(output_dir, filename)
            with open(filepath, 'wb') as out:
                out.write(file_data)

            # Hashes
            hashes = {
                'md5': hashlib.md5(file_data).hexdigest(),
                'sha1': hashlib.sha1(file_data).hexdigest(),
                'sha256': hashlib.sha256(file_data).hexdigest(),
            }

            results.append({
                'index': idx,
                'filename': filename,
                'filepath': filepath,
                'fileType': actual_name,
                'extension': ext,
                'mime': mime,
                'category': category,
                'size': len(file_data),
                'sizeFormatted': self._fmt_size(len(file_data)),
                'offset': start,
                'offsetHex': f'0x{start:08X}',
                'hashes': hashes,
                'isDeleted': False,
                'deletionNote': '',
                'carvedAt': datetime.now().isoformat(),
            })

            self._report(45 + int(((i + 1) / total) * 50), 'extracting')

        return results

    # ───────────────────────────────────────────────────────────────────
    # Determine where a carved file ends
    # ───────────────────────────────────────────────────────────────────

    def _determine_bounds(self, data: bytes, sig: dict) -> Optional[bytes]:
        # size encoded in the file header
        if sig.get('has_size_field'):
            try:
                off = sig['size_offset']
                fmt = '<I' if sig.get('size_endian') == 'little' else '>I'
                if len(data) >= off + 4:
                    sz = struct.unpack_from(fmt, data, off)[0]
                    sz += sig.get('size_add', 0)
                    if 0 < sz <= len(data):
                        return data[:sz]
            except Exception:
                pass

        # footer-based
        if sig['footer']:
            search_start = len(sig['header'])

            if sig['name'] == 'PDF':
                pos = data.rfind(sig['footer'])
            elif sig['name'] == 'JPEG':
                pos = data.rfind(sig['footer'])
            elif sig['name'] == 'ZIP':
                pos = data.rfind(sig['footer'])
            else:
                pos = data.find(sig['footer'], search_start)

            if pos == -1:
                return None

            end = pos + len(sig['footer'])

            # ZIP: include the rest of the EOCD record
            if sig['name'] == 'ZIP' and pos + 22 <= len(data):
                try:
                    comment_len = struct.unpack_from('<H', data, pos + 20)[0]
                    end = pos + 22 + comment_len
                except Exception:
                    end = pos + 22

            # PDF: include trailing whitespace / newline
            if sig['name'] == 'PDF':
                while end < len(data) and end < pos + len(sig['footer']) + 4:
                    if data[end:end + 1] in (b'\r', b'\n', b' '):
                        end += 1
                    else:
                        break

            return data[:min(end, len(data))]

        # no footer, no size -> use full boundary
        return data

    # ───────────────────────────────────────────────────────────────────
    # Validate carved data is a real file (reduce false positives)
    # ───────────────────────────────────────────────────────────────────

    def _validate(self, data: bytes, sig: dict) -> bool:
        name = sig['name']

        if name == 'JPEG':
            if len(data) < 10:
                return False
            return data[3] in (0xE0, 0xE1, 0xE2, 0xE3, 0xDB, 0xC0, 0xC2, 0xC4, 0xFE, 0xEE)

        if name == 'PNG':
            return len(data) > 16 and b'IHDR' in data[:30]

        if name == 'GIF':
            return len(data) > 10 and data[4:6] in (b'7a', b'9a')

        if name == 'BMP':
            if len(data) < 14:
                return False
            claimed = struct.unpack_from('<I', data, 2)[0]
            return 0 < claimed <= len(data) * 1.1

        if name == 'PDF':
            return data[:5] == b'%PDF-'

        if name == 'ZIP':
            return len(data) > 30

        if name == 'AVI':
            return len(data) > 12 and data[8:12] in (b'AVI ', b'WAVE')

        return True

    # ───────────────────────────────────────────────────────────────────
    # ZIP subtype detection (DOCX / XLSX / PPTX)
    # ───────────────────────────────────────────────────────────────────

    def _identify_zip_subtype(self, data: bytes):
        try:
            zf = zipfile.ZipFile(io.BytesIO(data))
            names = zf.namelist()
            zf.close()

            if any(n.startswith('word/') for n in names):
                return ('DOCX', '.docx',
                        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                        'documents')
            if any(n.startswith('xl/') for n in names):
                return ('XLSX', '.xlsx',
                        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                        'documents')
            if any(n.startswith('ppt/') for n in names):
                return ('PPTX', '.pptx',
                        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                        'documents')
        except Exception:
            pass
        return None

    # ───────────────────────────────────────────────────────────────────
    # Mark deleted files by cross-referencing with file system
    # ───────────────────────────────────────────────────────────────────

    def mark_deleted_files(self, carved_results: List[Dict], parser) -> List[Dict]:
        """
        Cross-reference carved files with the file system to determine
        which ones are deleted (not referenced by any directory entry).

        Args:
            carved_results: Output from self.carve()
            parser: DiskImageParser instance (pytsk3-based)

        Returns:
            Same list with 'isDeleted' field updated
        """
        live_hashes = set()

        try:
            all_files = parser.list_files("/", recursive=True)

            for f in all_files:
                if not f['isFile'] or f.get('isDeleted', False):
                    continue

                content = parser.read_file(f['path'])
                if content:
                    h = hashlib.sha256(content).hexdigest()
                    live_hashes.add(h)
        except Exception as e:
            print(f"Warning: Could not build live file index: {e}")
            return carved_results

        deleted_count = 0
        for result in carved_results:
            sha = result.get('hashes', {}).get('sha256', '')
            if sha and sha not in live_hashes:
                result['isDeleted'] = True
                result['deletionNote'] = 'File not found in active file system - likely deleted'
                deleted_count += 1
            else:
                result['isDeleted'] = False
                result['deletionNote'] = 'File exists in active file system'

        print(f"   {deleted_count}/{len(carved_results)} carved files appear to be deleted")
        return carved_results

    # ───────────────────────────────────────────────────────────────────
    # Helpers
    # ───────────────────────────────────────────────────────────────────

    def _filter_signatures(self, file_types: Optional[List[str]]) -> list:
        if not file_types:
            return list(SIGNATURES)
        ft = [t.lower() for t in file_types]
        return [s for s in SIGNATURES
                if s['category'] in ft or s['name'].lower() in ft]

    def _report(self, progress: int, status: str):
        if self.progress_callback:
            self.progress_callback(min(progress, 100), status)

    @staticmethod
    def _fmt_size(n: int) -> str:
        for u in ('B', 'KB', 'MB', 'GB'):
            if n < 1024:
                return f"{n:.2f} {u}"
            n /= 1024
        return f"{n:.2f} TB"

    # ───────────────────────────────────────────────────────────────────
    # Class-level info for the frontend
    # ───────────────────────────────────────────────────────────────────

    @staticmethod
    def supported_types() -> List[dict]:
        return [
            {
                'name': s['name'],
                'extension': s['extension'],
                'category': s['category'],
                'mime': s['mime'],
            }
            for s in SIGNATURES
        ]
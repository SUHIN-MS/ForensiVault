# ═══════════════════════════════════════════════════════════════════════════
# FILE: python-services/forensic_analyzer.py
# PURPOSE: Standalone forensic analysis of individual files for tampering
#          indicators WITHOUT needing a reference file to compare against
# ═══════════════════════════════════════════════════════════════════════════

import os
import struct
import hashlib
import math
import re
from datetime import datetime
from typing import Dict, Any, List, Optional


class ForensicAnalyzer:
    """
    Analyzes individual files for signs of tampering, modification,
    or suspicious characteristics — no reference file needed.
    """

    def analyze(self, file_path: str) -> Dict[str, Any]:
        """
        Run full forensic analysis on a single file.

        Returns a report with:
        - tampering indicators
        - severity assessment
        - metadata analysis
        - structural integrity check
        - recommendations
        """
        if not os.path.exists(file_path):
            return {'error': f'File not found: {file_path}'}

        with open(file_path, 'rb') as f:
            data = f.read()

        file_size = len(data)
        file_ext = os.path.splitext(file_path)[1].lower()
        file_name = os.path.basename(file_path)

        # Detect actual file type from magic bytes
        detected_type = self._detect_file_type(data)

        # Base report
        report = {
            'fileName': file_name,
            'filePath': file_path,
            'fileSize': file_size,
            'fileSizeFormatted': self._fmt_size(file_size),
            'declaredExtension': file_ext,
            'detectedType': detected_type,
            'hashes': {
                'md5': hashlib.md5(data).hexdigest(),
                'sha1': hashlib.sha1(data).hexdigest(),
                'sha256': hashlib.sha256(data).hexdigest(),
            },
            'indicators': [],
            'metadata': {},
            'structuralIntegrity': 'unknown',
            'overallSeverity': 'none',
            'tamperingLikelihood': 'low',
            'summary': '',
            'analyzedAt': datetime.now().isoformat(),
        }

        # ── Run type-specific analysis ──
        if detected_type['name'] == 'JPEG':
            self._analyze_jpeg(data, report)
        elif detected_type['name'] == 'PNG':
            self._analyze_png(data, report)
        elif detected_type['name'] == 'PDF':
            self._analyze_pdf(data, report)
        elif detected_type['name'] == 'GIF':
            self._analyze_gif(data, report)
        elif detected_type['name'] == 'BMP':
            self._analyze_bmp(data, report)
        elif detected_type['name'] == 'TEXT':
            self._analyze_text(data, report)

        # ── Run generic analysis on all files ──
        self._check_extension_mismatch(file_ext, detected_type, report)
        self._check_trailing_data(data, detected_type, report)
        self._analyze_entropy(data, report)
        self._check_hidden_strings(data, report)

        # ── Calculate overall severity ──
        self._calculate_severity(report)

        return report

    # ═══════════════════════════════════════════════════════════════════
    # FILE TYPE DETECTION
    # ═══════════════════════════════════════════════════════════════════

    def _detect_file_type(self, data: bytes) -> Dict[str, str]:
        signatures = [
            (b'\xFF\xD8\xFF', 'JPEG', 'image/jpeg', '.jpg'),
            (b'\x89PNG\r\n\x1a\n', 'PNG', 'image/png', '.png'),
            (b'GIF87a', 'GIF', 'image/gif', '.gif'),
            (b'GIF89a', 'GIF', 'image/gif', '.gif'),
            (b'BM', 'BMP', 'image/bmp', '.bmp'),
            (b'%PDF', 'PDF', 'application/pdf', '.pdf'),
            (b'PK\x03\x04', 'ZIP', 'application/zip', '.zip'),
            (b'Rar!\x1a\x07', 'RAR', 'application/x-rar', '.rar'),
            (b'\x1f\x8b', 'GZIP', 'application/gzip', '.gz'),
            (b'ID3', 'MP3', 'audio/mpeg', '.mp3'),
            (b'RIFF', 'RIFF', 'application/octet-stream', '.avi'),
            (b'\x49\x49\x2A\x00', 'TIFF', 'image/tiff', '.tiff'),
            (b'\x4D\x4D\x00\x2A', 'TIFF', 'image/tiff', '.tiff'),
        ]

        for sig, name, mime, ext in signatures:
            if data[:len(sig)] == sig:
                # Check RIFF sub-types
                if name == 'RIFF' and len(data) > 12:
                    sub = data[8:12]
                    if sub == b'AVI ':
                        return {'name': 'AVI', 'mime': 'video/x-msvideo', 'extension': '.avi'}
                    elif sub == b'WAVE':
                        return {'name': 'WAV', 'mime': 'audio/wav', 'extension': '.wav'}
                # Check ZIP sub-types
                if name == 'ZIP':
                    sub = self._check_zip_subtype(data)
                    if sub:
                        return sub
                return {'name': name, 'mime': mime, 'extension': ext}

        # Check if it's text
        try:
            data[:min(4096, len(data))].decode('utf-8')
            return {'name': 'TEXT', 'mime': 'text/plain', 'extension': '.txt'}
        except UnicodeDecodeError:
            pass

        return {'name': 'UNKNOWN', 'mime': 'application/octet-stream', 'extension': ''}

    def _check_zip_subtype(self, data: bytes) -> Optional[Dict]:
        import zipfile, io
        try:
            zf = zipfile.ZipFile(io.BytesIO(data))
            names = zf.namelist()
            zf.close()
            if any(n.startswith('word/') for n in names):
                return {'name': 'DOCX', 'mime': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'extension': '.docx'}
            if any(n.startswith('xl/') for n in names):
                return {'name': 'XLSX', 'mime': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'extension': '.xlsx'}
            if any(n.startswith('ppt/') for n in names):
                return {'name': 'PPTX', 'mime': 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'extension': '.pptx'}
        except:
            pass
        return None

    # ═══════════════════════════════════════════════════════════════════
    # JPEG ANALYSIS
    # ═══════════════════════════════════════════════════════════════════

    def _analyze_jpeg(self, data: bytes, report: Dict):
        report['metadata']['format'] = 'JPEG'
        indicators = report['indicators']

        # Parse dimensions
        width, height = self._get_jpeg_dimensions(data)
        report['metadata']['width'] = width
        report['metadata']['height'] = height

        # Check for EXIF data
        exif_info = self._parse_jpeg_exif(data)
        report['metadata']['exif'] = exif_info

        # ── Indicator: Editing software detected ──
        if exif_info.get('software'):
            sw = exif_info['software'].lower()
            editing_tools = ['photoshop', 'gimp', 'lightroom', 'paint', 'pixlr',
                           'snapseed', 'afterlight', 'vsco', 'canva', 'illustrator',
                           'affinity', 'capture one', 'darktable', 'rawtherapee']
            for tool in editing_tools:
                if tool in sw:
                    indicators.append({
                        'type': 'editing_software',
                        'severity': 'high',
                        'title': 'Image Editing Software Detected',
                        'detail': f'EXIF Software field contains: "{exif_info["software"]}"',
                        'significance': 'File was processed by image editing software, suggesting possible modification',
                    })
                    break

        # ── Indicator: Date mismatch ──
        if exif_info.get('dateOriginal') and exif_info.get('dateModified'):
            if exif_info['dateOriginal'] != exif_info['dateModified']:
                indicators.append({
                    'type': 'date_mismatch',
                    'severity': 'medium',
                    'title': 'EXIF Date Mismatch',
                    'detail': f'Original: {exif_info["dateOriginal"]}, Modified: {exif_info["dateModified"]}',
                    'significance': 'Creation and modification dates differ, indicating the file was edited after capture',
                })

        # ── Indicator: EXIF stripped ──
        has_exif = b'\xFF\xE1' in data[:100]
        if not has_exif and (width > 100 and height > 100):
            indicators.append({
                'type': 'exif_stripped',
                'severity': 'medium',
                'title': 'EXIF Metadata Absent',
                'detail': 'No EXIF data found in image',
                'significance': 'EXIF metadata may have been deliberately stripped to hide origin information',
            })

        # ── Indicator: Multiple APP markers (heavy editing) ──
        app_count = 0
        pos = 0
        while pos < min(len(data), 50000):
            if data[pos:pos+1] == b'\xFF' and pos + 1 < len(data):
                marker = data[pos+1]
                if 0xE0 <= marker <= 0xEF:
                    app_count += 1
            pos += 1

        if app_count > 5:
            indicators.append({
                'type': 'multiple_app_markers',
                'severity': 'low',
                'title': f'Multiple APP Markers ({app_count})',
                'detail': f'Found {app_count} APP markers in JPEG header',
                'significance': 'Multiple application markers may indicate processing by multiple tools',
            })

        # ── Indicator: Double compression detection ──
        dqt_count = data.count(b'\xFF\xDB')
        if dqt_count > 2:
            indicators.append({
                'type': 'double_compression',
                'severity': 'high',
                'title': 'Possible Double JPEG Compression',
                'detail': f'Found {dqt_count} quantization tables (expected 1-2)',
                'significance': 'Multiple quantization tables suggest the image was saved multiple times, common in manipulated images',
            })

        report['structuralIntegrity'] = 'valid' if data[-2:] == b'\xFF\xD9' else 'corrupted'

    def _get_jpeg_dimensions(self, data: bytes) -> tuple:
        offset = 2
        while offset < len(data) - 10:
            if data[offset] != 0xFF:
                break
            marker = data[offset + 1]
            if marker in (0xC0, 0xC2):
                height = struct.unpack_from('>H', data, offset + 5)[0]
                width = struct.unpack_from('>H', data, offset + 7)[0]
                return width, height
            if offset + 4 >= len(data):
                break
            length = struct.unpack_from('>H', data, offset + 2)[0]
            offset += 2 + length
        return 0, 0

    def _parse_jpeg_exif(self, data: bytes) -> Dict:
        info = {}
        # Look for EXIF APP1 marker
        pos = data.find(b'\xFF\xE1')
        if pos == -1:
            return info

        try:
            # Find common EXIF strings
            chunk = data[pos:pos + 10000]

            # Software
            for tag in [b'Software\x00', b'software\x00']:
                idx = chunk.find(tag)
                if idx != -1:
                    end = chunk.find(b'\x00', idx + len(tag))
                    if end != -1 and end - idx < 200:
                        info['software'] = chunk[idx + len(tag):end].decode('ascii', errors='ignore').strip()

            # Date strings (YYYY:MM:DD HH:MM:SS format)
            dates = re.findall(rb'(\d{4}:\d{2}:\d{2} \d{2}:\d{2}:\d{2})', chunk)
            if len(dates) >= 1:
                info['dateOriginal'] = dates[0].decode('ascii')
            if len(dates) >= 2:
                info['dateModified'] = dates[1].decode('ascii')

            # Camera make/model
            for tag in [b'Make\x00', b'make\x00']:
                idx = chunk.find(tag)
                if idx != -1:
                    end = chunk.find(b'\x00', idx + len(tag))
                    if end != -1 and end - idx < 100:
                        info['cameraMake'] = chunk[idx + len(tag):end].decode('ascii', errors='ignore').strip()

            for tag in [b'Model\x00', b'model\x00']:
                idx = chunk.find(tag)
                if idx != -1:
                    end = chunk.find(b'\x00', idx + len(tag))
                    if end != -1 and end - idx < 100:
                        info['cameraModel'] = chunk[idx + len(tag):end].decode('ascii', errors='ignore').strip()

        except Exception:
            pass

        return info

    # ═══════════════════════════════════════════════════════════════════
    # PNG ANALYSIS
    # ═══════════════════════════════════════════════════════════════════

    def _analyze_png(self, data: bytes, report: Dict):
        report['metadata']['format'] = 'PNG'
        indicators = report['indicators']

        # Parse IHDR
        if len(data) > 24:
            width = struct.unpack_from('>I', data, 16)[0]
            height = struct.unpack_from('>I', data, 20)[0]
            report['metadata']['width'] = width
            report['metadata']['height'] = height

        # Check for text chunks (tEXt, iTXt, zTXt)
        software_chunks = []
        pos = 8
        while pos < len(data) - 12:
            try:
                chunk_len = struct.unpack_from('>I', data, pos)[0]
                chunk_type = data[pos+4:pos+8].decode('ascii', errors='ignore')

                if chunk_type in ('tEXt', 'iTXt', 'zTXt'):
                    chunk_data = data[pos+8:pos+8+min(chunk_len, 1000)]
                    text = chunk_data.decode('ascii', errors='ignore')

                    if 'software' in text.lower() or 'creator' in text.lower():
                        software_chunks.append(text)

                    editing_tools = ['photoshop', 'gimp', 'paint', 'imagemagick',
                                   'pixlr', 'canva', 'illustrator', 'inkscape']
                    for tool in editing_tools:
                        if tool in text.lower():
                            indicators.append({
                                'type': 'editing_software',
                                'severity': 'high',
                                'title': 'Image Editing Software Detected in PNG Metadata',
                                'detail': f'Text chunk contains reference to: {tool}',
                                'significance': 'File was processed by image editing software',
                            })
                            break

                pos += 12 + chunk_len
            except:
                break

        if software_chunks:
            report['metadata']['softwareChunks'] = software_chunks

        # Check structural integrity
        has_iend = data[-12:].find(b'IEND') != -1
        report['structuralIntegrity'] = 'valid' if has_iend else 'corrupted'

    # ═══════════════════════════════════════════════════════════════════
    # PDF ANALYSIS
    # ═══════════════════════════════════════════════════════════════════

    def _analyze_pdf(self, data: bytes, report: Dict):
        report['metadata']['format'] = 'PDF'
        indicators = report['indicators']
        text = data.decode('latin-1', errors='ignore')

        # PDF version
        version_match = re.search(r'%PDF-(\d+\.\d+)', text)
        if version_match:
            report['metadata']['pdfVersion'] = version_match.group(1)

        # ── Indicator: Multiple revisions (%%EOF count) ──
        eof_count = text.count('%%EOF')
        report['metadata']['revisionCount'] = eof_count

        if eof_count > 1:
            indicators.append({
                'type': 'multiple_revisions',
                'severity': 'high',
                'title': f'Multiple PDF Revisions Detected ({eof_count})',
                'detail': f'Found {eof_count} %%EOF markers indicating {eof_count} save operations',
                'significance': 'Multiple revisions strongly suggest the document was modified after initial creation',
            })

        # ── Indicator: Producer/Creator ──
        producer_match = re.search(r'/Producer\s*\(([^)]+)\)', text)
        creator_match = re.search(r'/Creator\s*\(([^)]+)\)', text)

        if producer_match:
            report['metadata']['producer'] = producer_match.group(1)
        if creator_match:
            report['metadata']['creator'] = creator_match.group(1)

        if producer_match and creator_match:
            producer = producer_match.group(1).lower()
            creator = creator_match.group(1).lower()
            if producer != creator:
                indicators.append({
                    'type': 'producer_creator_mismatch',
                    'severity': 'medium',
                    'title': 'PDF Producer/Creator Mismatch',
                    'detail': f'Creator: "{creator_match.group(1)}", Producer: "{producer_match.group(1)}"',
                    'significance': 'Different creator and producer tools suggest the PDF was re-processed or converted',
                })

        # ── Indicator: Creation vs Modification date ──
        creation_match = re.search(r'/CreationDate\s*\(D:(\d{14})', text)
        mod_match = re.search(r'/ModDate\s*\(D:(\d{14})', text)

        if creation_match:
            report['metadata']['creationDate'] = creation_match.group(1)
        if mod_match:
            report['metadata']['modificationDate'] = mod_match.group(1)

        if creation_match and mod_match:
            if creation_match.group(1) != mod_match.group(1):
                indicators.append({
                    'type': 'date_mismatch',
                    'severity': 'medium',
                    'title': 'PDF Date Mismatch',
                    'detail': f'Created: {creation_match.group(1)}, Modified: {mod_match.group(1)}',
                    'significance': 'Document was modified after initial creation',
                })

        # ── Indicator: JavaScript ──
        if '/JavaScript' in text or '/JS ' in text:
            indicators.append({
                'type': 'embedded_javascript',
                'severity': 'critical',
                'title': 'Embedded JavaScript Detected',
                'detail': 'PDF contains JavaScript code',
                'significance': 'Embedded JavaScript is a major red flag — could be malicious or used to alter document behavior',
            })

        # ── Indicator: Form fields ──
        form_count = text.count('/AcroForm') + text.count('/Widget')
        if form_count > 0:
            indicators.append({
                'type': 'form_fields',
                'severity': 'low',
                'title': f'Interactive Form Fields Present ({form_count})',
                'detail': f'Found {form_count} form-related objects',
                'significance': 'Form fields can be used to overlay or hide content',
            })

        # ── Indicator: Annotations ──
        annot_count = text.count('/Annot')
        if annot_count > 3:
            indicators.append({
                'type': 'annotations',
                'severity': 'low',
                'title': f'Multiple Annotations ({annot_count})',
                'detail': f'Found {annot_count} annotation objects',
                'significance': 'Annotations can be used to cover or modify visible content',
            })

        # ── Indicator: Embedded files ──
        if '/EmbeddedFile' in text:
            indicators.append({
                'type': 'embedded_files',
                'severity': 'medium',
                'title': 'Embedded Files Detected',
                'detail': 'PDF contains embedded file attachments',
                'significance': 'Embedded files could contain hidden data or malware',
            })

        report['structuralIntegrity'] = 'valid' if '%%EOF' in text else 'corrupted'

    # ═══════════════════════════════════════════════════════════════════
    # TEXT ANALYSIS
    # ═══════════════════════════════════════════════════════════════════

    def _analyze_text(self, data: bytes, report: Dict):
        report['metadata']['format'] = 'TEXT'
        indicators = report['indicators']

        try:
            text = data.decode('utf-8')
            report['metadata']['encoding'] = 'utf-8'
        except UnicodeDecodeError:
            try:
                text = data.decode('latin-1')
                report['metadata']['encoding'] = 'latin-1'
            except:
                text = data.decode('ascii', errors='ignore')
                report['metadata']['encoding'] = 'ascii-fallback'

        lines = text.split('\n')
        report['metadata']['lineCount'] = len(lines)
        report['metadata']['wordCount'] = len(text.split())
        report['metadata']['charCount'] = len(text)

        # ── Indicator: Mixed line endings ──
        has_crlf = '\r\n' in text
        has_lf = '\n' in text.replace('\r\n', '')
        has_cr = '\r' in text.replace('\r\n', '')

        if (has_crlf and has_lf) or (has_crlf and has_cr) or (has_lf and has_cr):
            indicators.append({
                'type': 'mixed_line_endings',
                'severity': 'medium',
                'title': 'Mixed Line Endings Detected',
                'detail': f'CRLF: {has_crlf}, LF: {has_lf}, CR: {has_cr}',
                'significance': 'Mixed line endings suggest the file was edited on different operating systems or by different tools',
            })

        # ── Indicator: BOM marker ──
        if data[:3] == b'\xEF\xBB\xBF':
            report['metadata']['hasBOM'] = True
            indicators.append({
                'type': 'bom_marker',
                'severity': 'low',
                'title': 'UTF-8 BOM Marker Present',
                'detail': 'File starts with UTF-8 Byte Order Mark',
                'significance': 'BOM markers are sometimes added by Windows editors',
            })

        # ── Indicator: Hidden/zero-width characters ──
        hidden_chars = 0
        for ch in text:
            code = ord(ch)
            if code in (0x200B, 0x200C, 0x200D, 0xFEFF, 0x00AD, 0x2060):
                hidden_chars += 1

        if hidden_chars > 0:
            indicators.append({
                'type': 'hidden_characters',
                'severity': 'high',
                'title': f'Hidden Characters Detected ({hidden_chars})',
                'detail': f'Found {hidden_chars} zero-width or invisible characters',
                'significance': 'Hidden characters can be used for steganography or to subtly alter content',
            })

        # ── Indicator: Non-printable characters ──
        non_printable = sum(1 for c in text if ord(c) < 32 and c not in '\n\r\t')
        if non_printable > 5:
            indicators.append({
                'type': 'non_printable_chars',
                'severity': 'medium',
                'title': f'Non-Printable Characters ({non_printable})',
                'detail': f'Found {non_printable} control characters (excluding newlines and tabs)',
                'significance': 'Unusual control characters may indicate binary data insertion or encoding manipulation',
            })

        report['structuralIntegrity'] = 'valid'

    # ═══════════════════════════════════════════════════════════════════
    # GIF / BMP ANALYSIS
    # ═══════════════════════════════════════════════════════════════════

    def _analyze_gif(self, data: bytes, report: Dict):
        report['metadata']['format'] = 'GIF'
        if len(data) > 10:
            report['metadata']['width'] = struct.unpack_from('<H', data, 6)[0]
            report['metadata']['height'] = struct.unpack_from('<H', data, 8)[0]
            report['metadata']['version'] = data[3:6].decode('ascii', errors='ignore')
        report['structuralIntegrity'] = 'valid' if data[-1:] == b'\x3B' else 'corrupted'

    def _analyze_bmp(self, data: bytes, report: Dict):
        report['metadata']['format'] = 'BMP'
        if len(data) > 26:
            report['metadata']['width'] = struct.unpack_from('<I', data, 18)[0]
            report['metadata']['height'] = abs(struct.unpack_from('<i', data, 22)[0])
            declared_size = struct.unpack_from('<I', data, 2)[0]
            report['metadata']['declaredSize'] = declared_size
            if abs(declared_size - len(data)) > 100:
                report['indicators'].append({
                    'type': 'size_mismatch',
                    'severity': 'high',
                    'title': 'BMP Size Mismatch',
                    'detail': f'Header declares {declared_size} bytes but file is {len(data)} bytes',
                    'significance': 'Size mismatch indicates the file was modified after creation',
                })
        report['structuralIntegrity'] = 'valid'

    # ═══════════════════════════════════════════════════════════════════
    # GENERIC CHECKS (applied to ALL files)
    # ═══════════════════════════════════════════════════════════════════

    def _check_extension_mismatch(self, ext: str, detected: Dict, report: Dict):
        if not ext or detected['name'] == 'UNKNOWN':
            return

        ext = ext.lower()
        expected = detected.get('extension', '').lower()

        # Map common equivalent extensions
        equivalents = {
            '.jpg': ['.jpeg'],
            '.jpeg': ['.jpg'],
            '.tif': ['.tiff'],
            '.tiff': ['.tif'],
            '.htm': ['.html'],
            '.html': ['.htm'],
        }

        if ext != expected:
            alts = equivalents.get(expected, [])
            if ext not in alts:
                report['indicators'].append({
                    'type': 'extension_mismatch',
                    'severity': 'high',
                    'title': 'File Extension Mismatch',
                    'detail': f'Extension is "{ext}" but file content is {detected["name"]} (expected "{expected}")',
                    'significance': 'File extension does not match actual content — file may have been renamed to disguise its type',
                })

    def _check_trailing_data(self, data: bytes, detected: Dict, report: Dict):
        name = detected['name']
        trailing_size = 0

        if name == 'JPEG':
            eoi = data.rfind(b'\xFF\xD9')
            if eoi != -1 and eoi + 2 < len(data):
                trailing_size = len(data) - eoi - 2

        elif name == 'PNG':
            iend = data.rfind(b'IEND')
            if iend != -1 and iend + 12 < len(data):
                trailing_size = len(data) - iend - 12

        elif name == 'PDF':
            eof = data.rfind(b'%%EOF')
            if eof != -1:
                after_eof = eof + 5
                # Skip whitespace
                while after_eof < len(data) and data[after_eof:after_eof+1] in (b'\r', b'\n', b' '):
                    after_eof += 1
                if after_eof < len(data):
                    trailing_size = len(data) - after_eof

        if trailing_size > 10:
            report['indicators'].append({
                'type': 'trailing_data',
                'severity': 'critical',
                'title': f'Hidden Data After File End ({self._fmt_size(trailing_size)})',
                'detail': f'{trailing_size} bytes of data found after the file\'s end marker',
                'significance': 'Data appended after the file end marker is a strong indicator of steganography or data hiding',
            })
            report['metadata']['trailingDataSize'] = trailing_size

    def _analyze_entropy(self, data: bytes, report: Dict):
        if len(data) < 256:
            return

        # Calculate Shannon entropy
        freq = [0] * 256
        for byte in data:
            freq[byte] += 1

        entropy = 0.0
        for f in freq:
            if f > 0:
                p = f / len(data)
                entropy -= p * math.log2(p)

        report['metadata']['entropy'] = round(entropy, 4)
        report['metadata']['maxEntropy'] = 8.0

        # Very high entropy = encrypted/compressed
        if entropy > 7.9:
            report['indicators'].append({
                'type': 'high_entropy',
                'severity': 'medium',
                'title': f'Very High Entropy ({entropy:.2f}/8.0)',
                'detail': 'File entropy is near maximum',
                'significance': 'Extremely high entropy suggests the file is encrypted, heavily compressed, or contains random data',
            })

        # Very low entropy for images = suspicious
        detected = report.get('detectedType', {})
        if detected.get('name') in ('JPEG', 'PNG') and entropy < 3.0 and len(data) > 1000:
            report['indicators'].append({
                'type': 'low_entropy',
                'severity': 'medium',
                'title': f'Unusually Low Entropy for Image ({entropy:.2f}/8.0)',
                'detail': 'Image file has very low entropy',
                'significance': 'Low entropy in an image file is unusual and may indicate the file is not a genuine image',
            })

    def _check_hidden_strings(self, data: bytes, report: Dict):
        suspicious_strings = []

        patterns = [
            (rb'password', 'Password reference'),
            (rb'BEGIN RSA', 'RSA private key'),
            (rb'BEGIN CERTIFICATE', 'Certificate data'),
            (rb'<script', 'HTML script tag'),
            (rb'eval\(', 'JavaScript eval'),
            (rb'base64', 'Base64 reference'),
            (rb'SELECT.*FROM', 'SQL query'),
            (rb'DROP TABLE', 'SQL DROP statement'),
        ]

        detected = report.get('detectedType', {})
        if detected.get('name') in ('JPEG', 'PNG', 'GIF', 'BMP'):
            # Only check for suspicious strings in image files
            for pattern, desc in patterns:
                matches = re.findall(pattern, data, re.IGNORECASE)
                if matches:
                    suspicious_strings.append({
                        'pattern': desc,
                        'count': len(matches),
                    })

        if suspicious_strings:
            report['indicators'].append({
                'type': 'suspicious_strings',
                'severity': 'high',
                'title': f'Suspicious Strings Found in Binary File',
                'detail': ', '.join(f'{s["pattern"]} ({s["count"]}x)' for s in suspicious_strings),
                'significance': 'Text patterns found inside binary files may indicate hidden data or embedded payloads',
            })

    # ═══════════════════════════════════════════════════════════════════
    # SEVERITY CALCULATION
    # ═══════════════════════════════════════════════════════════════════

    def _calculate_severity(self, report: Dict):
        indicators = report['indicators']

        if not indicators:
            report['overallSeverity'] = 'none'
            report['tamperingLikelihood'] = 'low'
            report['summary'] = 'No tampering indicators found. File appears unmodified.'
            return

        severity_scores = {'low': 1, 'medium': 2, 'high': 3, 'critical': 4}
        max_severity = 0
        total_score = 0

        for ind in indicators:
            score = severity_scores.get(ind['severity'], 0)
            total_score += score
            max_severity = max(max_severity, score)

        # Overall severity
        if max_severity >= 4 or total_score >= 8:
            report['overallSeverity'] = 'critical'
            report['tamperingLikelihood'] = 'very_high'
        elif max_severity >= 3 or total_score >= 5:
            report['overallSeverity'] = 'high'
            report['tamperingLikelihood'] = 'high'
        elif max_severity >= 2 or total_score >= 3:
            report['overallSeverity'] = 'medium'
            report['tamperingLikelihood'] = 'medium'
        else:
            report['overallSeverity'] = 'low'
            report['tamperingLikelihood'] = 'low'

        # Summary
        high_count = sum(1 for i in indicators if i['severity'] in ('high', 'critical'))
        report['summary'] = (
            f'Found {len(indicators)} tampering indicator(s): '
            f'{high_count} high/critical severity. '
            f'Tampering likelihood: {report["tamperingLikelihood"].replace("_", " ").upper()}.'
        )

    # ═══════════════════════════════════════════════════════════════════
    # HELPERS
    # ═══════════════════════════════════════════════════════════════════

    @staticmethod
    def _fmt_size(n: int) -> str:
        for u in ('B', 'KB', 'MB', 'GB'):
            if n < 1024:
                return f"{n:.2f} {u}"
            n /= 1024
        return f"{n:.2f} TB"
"""
Creates a test disk image with embedded files for testing file carving.
The image contains JPEG, PNG, PDF, and TXT files hidden in raw bytes.
"""

import os
import struct
import random

OUTPUT = "test_disk.img"
DISK_SIZE = 10 * 1024 * 1024  # 10 MB disk image


def create_minimal_jpeg():
    """Create a small valid JPEG image"""
    # Minimal JPEG: SOI + APP0 + DQT + SOF0 + DHT + SOS + image data + EOI
    # This creates a tiny 1x1 red pixel JPEG
    data = bytes([
        0xFF, 0xD8, 0xFF, 0xE0,  # SOI + APP0 marker
        0x00, 0x10,              # APP0 length
        0x4A, 0x46, 0x49, 0x46, 0x00,  # "JFIF\0"
        0x01, 0x01,              # version
        0x00,                    # units
        0x00, 0x01, 0x00, 0x01,  # density
        0x00, 0x00,              # thumbnail
        
        0xFF, 0xDB,              # DQT marker
        0x00, 0x43,              # length
        0x00,                    # table 0
    ])
    # Quantization table (64 values)
    data += bytes([8] * 64)
    
    # SOF0 (Start of Frame)
    data += bytes([
        0xFF, 0xC0,              # SOF0 marker
        0x00, 0x0B,              # length
        0x08,                    # precision
        0x00, 0x01, 0x00, 0x01,  # 1x1 pixels
        0x01,                    # 1 component
        0x01, 0x11, 0x00,        # component info
    ])
    
    # DHT (Huffman table - DC)
    data += bytes([
        0xFF, 0xC4,              # DHT marker
        0x00, 0x1F,              # length
        0x00,                    # DC table 0
    ])
    data += bytes([0, 1, 5, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0])
    data += bytes([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
    
    # SOS (Start of Scan)
    data += bytes([
        0xFF, 0xDA,              # SOS marker
        0x00, 0x08,              # length
        0x01,                    # 1 component
        0x01, 0x00,              # component selector
        0x00, 0x3F, 0x00,        # spectral selection
    ])
    
    # Scan data (minimal)
    data += bytes([0x7B, 0x40])
    
    # EOI
    data += bytes([0xFF, 0xD9])
    
    return data


def create_minimal_png():
    """Create a small valid PNG image (1x1 red pixel)"""
    import zlib
    
    def chunk(chunk_type, data):
        c = chunk_type + data
        crc = struct.pack('>I', zlib.crc32(c) & 0xFFFFFFFF)
        return struct.pack('>I', len(data)) + c + crc
    
    # PNG signature
    sig = b'\x89PNG\r\n\x1a\n'
    
    # IHDR: 1x1, 8-bit RGB
    ihdr_data = struct.pack('>IIBBBBB', 1, 1, 8, 2, 0, 0, 0)
    ihdr = chunk(b'IHDR', ihdr_data)
    
    # IDAT: red pixel (filter byte 0, then R=255, G=0, B=0)
    raw_data = b'\x00\xFF\x00\x00'
    compressed = zlib.compress(raw_data)
    idat = chunk(b'IDAT', compressed)
    
    # IEND
    iend = chunk(b'IEND', b'')
    
    return sig + ihdr + idat + iend


def create_minimal_pdf():
    """Create a small valid PDF document"""
    content = """%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj

2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj

3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]
   /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj

4 0 obj
<< /Length 44 >>
stream
BT
/F1 24 Tf
100 700 Td
(EVIDENCE FILE - CONFIDENTIAL) Tj
ET
endstream
endobj

5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj

xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000266 00000 n 
0000000360 00000 n 

trailer
<< /Size 6 /Root 1 0 R >>
startxref
441
%%EOF"""
    return content.encode('latin-1')


def create_text_file():
    """Create a plain text evidence file"""
    content = """FORENSIC INVESTIGATION REPORT
=============================
Case Number: FV-2024-0042
Date: 2024-03-15
Investigator: Detective Smith

FINDINGS:
1. Suspicious network activity detected at 02:14 AM
2. Unauthorized access to database server
3. Data exfiltration attempt blocked
4. Malware signature identified: TR/Dropper.Gen

EVIDENCE CHAIN:
- Hard drive serial: WD-12345678
- Acquisition tool: FTK Imager 4.7
- Hash verified: SHA-256

CONCLUSION:
Evidence suggests unauthorized access by insider threat.
Further investigation recommended.

--- END OF REPORT ---
"""
    return content.encode('utf-8')


def create_second_pdf():
    """Create another PDF for variety"""
    content = """%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj

2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj

3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]
   /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj

4 0 obj
<< /Length 52 >>
stream
BT
/F1 18 Tf
72 700 Td
(SUSPECT COMMUNICATION LOG - CLASSIFIED) Tj
ET
endstream
endobj

5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>
endobj

xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000266 00000 n 
0000000368 00000 n 

trailer
<< /Size 6 /Root 1 0 R >>
startxref
446
%%EOF"""
    return content.encode('latin-1')


def build_disk_image():
    """Build a raw disk image with embedded files"""
    print(f"Creating {DISK_SIZE // (1024*1024)} MB test disk image...")
    
    # Start with random-ish data (simulates real disk)
    disk = bytearray(os.urandom(DISK_SIZE))
    
    # Create test files
    files = [
        ("JPEG Image 1", create_minimal_jpeg(), 0x10000),      # 64 KB offset
        ("PNG Image", create_minimal_png(), 0x50000),           # 320 KB offset
        ("PDF Document 1", create_minimal_pdf(), 0xA0000),      # 640 KB offset
        ("Text Report", create_text_file(), 0x100000),          # 1 MB offset
        ("JPEG Image 2", create_minimal_jpeg(), 0x200000),      # 2 MB offset
        ("PDF Document 2", create_second_pdf(), 0x350000),      # 3.3 MB offset
        ("PNG Image 2", create_minimal_png(), 0x500000),        # 5 MB offset
        ("Text File 2", create_text_file(), 0x600000),          # 6 MB offset
    ]
    
    # Also embed some files in the "deleted" area (middle of random data)
    deleted_files = [
        ("DELETED JPEG", create_minimal_jpeg(), 0x780000),      # 7.5 MB
        ("DELETED PDF", create_minimal_pdf(), 0x800000),        # 8 MB
        ("DELETED TXT", create_text_file(), 0x900000),          # 9 MB
    ]
    
    # Embed files into the disk image
    print("\nEmbedding files into disk image:")
    for name, data, offset in files + deleted_files:
        if offset + len(data) > DISK_SIZE:
            print(f"   SKIP {name} (won't fit)")
            continue
        
        # Write file data at the specified offset
        disk[offset:offset + len(data)] = data
        print(f"   {name}: offset 0x{offset:08X}, size {len(data)} bytes")
    
    # Write disk image
    with open(OUTPUT, 'wb') as f:
        f.write(disk)
    
    size_mb = os.path.getsize(OUTPUT) / (1024 * 1024)
    print(f"\nDisk image created: {OUTPUT} ({size_mb:.1f} MB)")
    print(f"Total embedded files: {len(files) + len(deleted_files)}")
    print(f"\nYou can now upload this file in ForensiVault → Forensic Tools → Upload")


if __name__ == '__main__':
    build_disk_image()
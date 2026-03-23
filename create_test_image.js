// FILE: forensivault/create_test_image.js

const fs = require('fs');
const path = require('path');

// Create a simple PNG image (8x8 red square)
function createTestPNG() {
  // PNG header
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  
  // IHDR chunk (image header)
  const width = 100;
  const height = 100;
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);   // width
  ihdrData.writeUInt32BE(height, 4);  // height
  ihdrData.writeUInt8(8, 8);          // bit depth
  ihdrData.writeUInt8(2, 9);          // color type (RGB)
  ihdrData.writeUInt8(0, 10);         // compression
  ihdrData.writeUInt8(0, 11);         // filter
  ihdrData.writeUInt8(0, 12);         // interlace
  
  const ihdrCrc = crc32(Buffer.concat([Buffer.from('IHDR'), ihdrData]));
  const ihdr = Buffer.concat([
    Buffer.from([0, 0, 0, 13]),  // length
    Buffer.from('IHDR'),
    ihdrData,
    ihdrCrc
  ]);
  
  // IDAT chunk (image data) - simple red pixels
  const rawData = [];
  for (let y = 0; y < height; y++) {
    rawData.push(0); // filter byte
    for (let x = 0; x < width; x++) {
      rawData.push(255, 0, 0); // RGB red
    }
  }
  
  const zlib = require('zlib');
  const compressed = zlib.deflateSync(Buffer.from(rawData));
  const idatCrc = crc32(Buffer.concat([Buffer.from('IDAT'), compressed]));
  
  const idatLength = Buffer.alloc(4);
  idatLength.writeUInt32BE(compressed.length, 0);
  
  const idat = Buffer.concat([
    idatLength,
    Buffer.from('IDAT'),
    compressed,
    idatCrc
  ]);
  
  // IEND chunk
  const iendCrc = crc32(Buffer.from('IEND'));
  const iend = Buffer.concat([
    Buffer.from([0, 0, 0, 0]),
    Buffer.from('IEND'),
    iendCrc
  ]);
  
  return Buffer.concat([signature, ihdr, idat, iend]);
}

// CRC32 calculation for PNG
function crc32(data) {
  let crc = 0xFFFFFFFF;
  const table = [];
  
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  
  for (let i = 0; i < data.length; i++) {
    crc = table[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
  }
  
  const result = Buffer.alloc(4);
  result.writeUInt32BE((crc ^ 0xFFFFFFFF) >>> 0, 0);
  return result;
}

// Create the test image
const testDir = path.join(__dirname, 'test_files');
if (!fs.existsSync(testDir)) {
  fs.mkdirSync(testDir, { recursive: true });
}

const pngBuffer = createTestPNG();
const imagePath = path.join(testDir, 'test_image.png');
fs.writeFileSync(imagePath, pngBuffer);

console.log('✅ Test image created:', imagePath);
console.log('   Size:', pngBuffer.length, 'bytes');
console.log('   Dimensions: 100x100 pixels');
console.log('   Format: PNG (RGB)');
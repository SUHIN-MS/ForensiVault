// FILE: forensivault/create_test_pdf.js

const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const testDir = path.join(__dirname, 'test_files');
if (!fs.existsSync(testDir)) {
  fs.mkdirSync(testDir, { recursive: true });
}

const pdfPath = path.join(testDir, 'test_document.pdf');
const doc = new PDFDocument();

doc.pipe(fs.createWriteStream(pdfPath));

doc.fontSize(24).text('ForensiVault Test Document', { align: 'center' });
doc.moveDown();
doc.fontSize(12).text('Created: ' + new Date().toISOString());
doc.moveDown();
doc.text('This is a test PDF document for tampering detection.');
doc.moveDown();
doc.text('CONFIDENTIAL INFORMATION:');
doc.text('• Case Number: FV-2024-TEST-001');
doc.text('• Suspect: John Doe');
doc.text('• Location: 123 Test Street');
doc.text('• Date: ' + new Date().toLocaleDateString());
doc.moveDown();
doc.text('Any modification to this document will be detected.');

doc.end();

console.log('✅ Test PDF created:', pdfPath);
// FILE: forensivault/tamper_pdf.js

const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
require("dotenv").config();

mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/forensivault")
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch(err => {
    console.error("❌ MongoDB Error:", err.message);
    process.exit(1);
  });

const { Evidence } = require("./models");

const tempDir = path.join(__dirname, "temp");
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

async function decryptFile(inputPath, outputPath, key, iv) {
  return new Promise((resolve, reject) => {
    const input = fs.createReadStream(inputPath);
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    const output = fs.createWriteStream(outputPath);
    input.pipe(decipher).pipe(output).on("finish", resolve).on("error", reject);
  });
}

async function encryptFile(inputPath, outputPath, key, iv) {
  return new Promise((resolve, reject) => {
    const input = fs.createReadStream(inputPath);
    const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
    const output = fs.createWriteStream(outputPath);
    input.pipe(cipher).pipe(output).on("finish", resolve).on("error", reject);
  });
}

async function tamperPDF(evidenceId) {
  console.log("\n📄 TAMPERING PDF FILE...");
  console.log("═".repeat(60));

  const evidence = await Evidence.findById(evidenceId);
  
  if (!evidence) {
    console.error("❌ Evidence not found");
    mongoose.disconnect();
    return;
  }

  const ext = path.extname(evidence.originalName).toLowerCase();
  if (ext !== '.pdf' && !evidence.mimeType?.includes('pdf')) {
    console.error("❌ This is not a PDF file");
    mongoose.disconnect();
    return;
  }

  console.log("📄 File:", evidence.originalName);

  const key = Buffer.from(evidence.encryptionKey, "hex");
  const iv = Buffer.from(evidence.encryptionIV, "hex");
  const tempPath = path.join(tempDir, "tamper_pdf_" + Date.now() + ".pdf");

  // Decrypt
  await decryptFile(evidence.encryptedPath, tempPath, key, iv);
  console.log("✅ Decrypted");

  // Read PDF
  let pdfContent = fs.readFileSync(tempPath);
  console.log("📊 Original size:", pdfContent.length, "bytes");

  // Tamper by modifying content
  // PDFs have text that can be modified
  let pdfString = pdfContent.toString('binary');
  
  // Try to find and replace some text
  pdfString = pdfString.replace(/John Doe/g, 'Jane Smith');
  pdfString = pdfString.replace(/123 Test Street/g, '456 Fake Avenue');
  pdfString = pdfString.replace(/CONFIDENTIAL/g, 'FALSIFIED');
  
  // Also modify some random bytes to ensure hash changes
  const tamperedBuffer = Buffer.from(pdfString, 'binary');
  
  // Modify a few bytes
  if (tamperedBuffer.length > 500) {
    tamperedBuffer[400] = tamperedBuffer[400] ^ 0x01;
    tamperedBuffer[450] = tamperedBuffer[450] ^ 0x01;
  }

  fs.writeFileSync(tempPath, tamperedBuffer);
  console.log("📊 Tampered size:", tamperedBuffer.length, "bytes");
  console.log("⚠️ Modified text content in PDF");

  // Backup
  const backupPath = evidence.encryptedPath + ".backup";
  fs.copyFileSync(evidence.encryptedPath, backupPath);
  console.log("💾 Backup created");

  // Re-encrypt
  await encryptFile(tempPath, evidence.encryptedPath, key, iv);
  console.log("✅ Re-encrypted");

  fs.unlinkSync(tempPath);

  console.log("\n✅ PDF TAMPERING COMPLETE!");
  mongoose.disconnect();
}

async function restorePDF(evidenceId) {
  const evidence = await Evidence.findById(evidenceId);
  
  if (!evidence) {
    console.error("❌ Evidence not found");
    mongoose.disconnect();
    return;
  }

  const backupPath = evidence.encryptedPath + ".backup";
  
  if (!fs.existsSync(backupPath)) {
    console.error("❌ No backup found");
    mongoose.disconnect();
    return;
  }

  fs.copyFileSync(backupPath, evidence.encryptedPath);
  fs.unlinkSync(backupPath);

  evidence.status = "pending";
  evidence.tamperingHistory = [];
  await evidence.save();

  console.log("✅ PDF restored");
  mongoose.disconnect();
}

const [cmd, evidenceId] = process.argv.slice(2);

if (cmd === "tamper" && evidenceId) {
  tamperPDF(evidenceId);
} else if (cmd === "restore" && evidenceId) {
  restorePDF(evidenceId);
} else {
  console.log("Usage:");
  console.log("  node tamper_pdf.js tamper <EVIDENCE_ID>");
  console.log("  node tamper_pdf.js restore <EVIDENCE_ID>");
  mongoose.disconnect();
}
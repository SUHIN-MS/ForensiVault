// FILE: forensivault/tamper_image.js

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

async function tamperImage(evidenceId) {
  console.log("\n🖼️ TAMPERING IMAGE FILE...");
  console.log("═".repeat(60));

  const evidence = await Evidence.findById(evidenceId);
  
  if (!evidence) {
    console.error("❌ Evidence not found");
    return;
  }

  if (!evidence.fileType.includes("image") && !evidence.mimeType?.includes("image")) {
    console.error("❌ This is not an image file");
    console.log("   File type:", evidence.fileType);
    console.log("   MIME type:", evidence.mimeType);
    return;
  }

  console.log("📄 File:", evidence.originalName);
  console.log("🔒 Encrypted Path:", evidence.encryptedPath);

  const key = Buffer.from(evidence.encryptionKey, "hex");
  const iv = Buffer.from(evidence.encryptionIV, "hex");
  const ext = path.extname(evidence.originalName).toLowerCase();
  const tempPath = path.join(tempDir, "tamper_image_" + Date.now() + ext);

  // Decrypt
  await decryptFile(evidence.encryptedPath, tempPath, key, iv);
  console.log("✅ Decrypted to:", tempPath);

  // Read original image
  const originalBuffer = fs.readFileSync(tempPath);
  console.log("📊 Original size:", originalBuffer.length, "bytes");

  // Tamper the image by modifying some bytes
  const tamperedBuffer = Buffer.from(originalBuffer);
  
  // Modify pixels in the middle of the file
  const startPos = Math.floor(tamperedBuffer.length / 2);
  for (let i = 0; i < 100 && (startPos + i) < tamperedBuffer.length; i++) {
    // Flip some bits
    tamperedBuffer[startPos + i] = tamperedBuffer[startPos + i] ^ 0xFF;
  }

  // Write tampered image
  fs.writeFileSync(tempPath, tamperedBuffer);
  console.log("📊 Tampered size:", tamperedBuffer.length, "bytes");
  console.log("⚠️ Modified 100 bytes in the middle of the image");

  // Backup original
  const backupPath = evidence.encryptedPath + ".backup";
  fs.copyFileSync(evidence.encryptedPath, backupPath);
  console.log("💾 Backup created:", backupPath);

  // Re-encrypt
  await encryptFile(tempPath, evidence.encryptedPath, key, iv);
  console.log("✅ Re-encrypted tampered image");

  // Cleanup
  fs.unlinkSync(tempPath);

  console.log("\n✅ IMAGE TAMPERING COMPLETE!");
  console.log("📌 Verify in web UI to see detection results");

  mongoose.disconnect();
}

async function restoreImage(evidenceId) {
  const evidence = await Evidence.findById(evidenceId);
  
  if (!evidence) {
    console.error("❌ Evidence not found");
    return;
  }

  const backupPath = evidence.encryptedPath + ".backup";
  
  if (!fs.existsSync(backupPath)) {
    console.error("❌ No backup found");
    return;
  }

  fs.copyFileSync(backupPath, evidence.encryptedPath);
  fs.unlinkSync(backupPath);

  evidence.status = "pending";
  evidence.tamperingHistory = [];
  await evidence.save();

  console.log("✅ Image restored");
  mongoose.disconnect();
}

// Main
const [cmd, evidenceId] = process.argv.slice(2);

if (cmd === "tamper" && evidenceId) {
  tamperImage(evidenceId);
} else if (cmd === "restore" && evidenceId) {
  restoreImage(evidenceId);
} else {
  console.log("Usage:");
  console.log("  node tamper_image.js tamper <EVIDENCE_ID>");
  console.log("  node tamper_image.js restore <EVIDENCE_ID>");
  mongoose.disconnect();
}
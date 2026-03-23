// ═══════════════════════════════════════════════════════════════════════════
// FILE: forensivault/test_tampering.js
// PURPOSE: Test tampering detection by simulating file modifications
// ═══════════════════════════════════════════════════════════════════════════

const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
require("dotenv").config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/forensivault", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log("✅ Connected to MongoDB");
}).catch((err) => {
  console.error("❌ MongoDB Connection Error:", err.message);
  process.exit(1);
});

const { Evidence } = require("./models");

// Directories
const encryptedDir = path.join(__dirname, "encrypted");
const tempDir = path.join(__dirname, "temp");
const testDir = path.join(__dirname, "test_files");

// Create test directory if not exists
if (!fs.existsSync(testDir)) {
  fs.mkdirSync(testDir, { recursive: true });
}
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// ═══════════════════════════════════════════════════════════════════════════
// ENCRYPTION/DECRYPTION HELPERS
// ═══════════════════════════════════════════════════════════════════════════

async function decryptFile(inputPath, outputPath, key, iv) {
  return new Promise((resolve, reject) => {
    try {
      const input = fs.createReadStream(inputPath);
      const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
      const output = fs.createWriteStream(outputPath);

      input
        .pipe(decipher)
        .pipe(output)
        .on("finish", () => resolve(outputPath))
        .on("error", reject);
    } catch (err) {
      reject(err);
    }
  });
}

async function encryptFile(inputPath, outputPath, key, iv) {
  return new Promise((resolve, reject) => {
    try {
      const input = fs.createReadStream(inputPath);
      const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
      const output = fs.createWriteStream(outputPath);

      input
        .pipe(cipher)
        .pipe(output)
        .on("finish", () => resolve(outputPath))
        .on("error", reject);
    } catch (err) {
      reject(err);
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// TEST FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

async function createTestFile() {
  const testFilePath = path.join(testDir, "test_evidence.txt");
  
  const originalContent = `FORENSIVAULT TEST EVIDENCE FILE
================================
Created: ${new Date().toISOString()}
Purpose: Testing tampering detection

CONFIDENTIAL INFORMATION:
Line 1: Case Number: FV-2024-001
Line 2: Suspect Name: John Doe
Line 3: Location: 123 Main Street
Line 4: Date of Incident: 2024-01-15
Line 5: Officer Badge: #12345
Line 6: Evidence Type: Document
Line 7: Chain of Custody: Intact
Line 8: Status: Original

NOTES:
This is an original unmodified document.
Any changes to this file should be detected.
================================
END OF DOCUMENT`;

  fs.writeFileSync(testFilePath, originalContent);
  console.log("📄 Test file created:", testFilePath);
  console.log("📝 Content preview:");
  console.log("─".repeat(50));
  console.log(originalContent.substring(0, 300) + "...");
  console.log("─".repeat(50));
  
  return testFilePath;
}

async function listEvidence() {
  const evidenceList = await Evidence.find({}, {
    _id: 1,
    originalName: 1,
    status: 1,
    sha256: 1,
    uploadedAt: 1,
    encryptedPath: 1,
  }).sort({ uploadedAt: -1 }).limit(10);

  console.log("\n📋 EVIDENCE FILES IN DATABASE:");
  console.log("═".repeat(80));
  
  if (evidenceList.length === 0) {
    console.log("No evidence files found. Please upload a file first.");
    return null;
  }

  evidenceList.forEach((e, i) => {
    console.log(`${i + 1}. ID: ${e._id}`);
    console.log(`   Name: ${e.originalName}`);
    console.log(`   Status: ${e.status}`);
    console.log(`   Hash: ${e.sha256.substring(0, 32)}...`);
    console.log(`   Uploaded: ${e.uploadedAt}`);
    console.log(`   Encrypted Path: ${e.encryptedPath}`);
    console.log("─".repeat(80));
  });

  return evidenceList;
}

async function tamperEvidence(evidenceId, tamperType) {
  console.log("\n🔓 TAMPERING EVIDENCE FILE...");
  console.log("═".repeat(80));

  // Find the evidence
  const evidence = await Evidence.findById(evidenceId);
  
  if (!evidence) {
    console.error("❌ Evidence not found with ID:", evidenceId);
    return false;
  }

  console.log("📄 Target File:", evidence.originalName);
  console.log("🔒 Encrypted Path:", evidence.encryptedPath);
  console.log("🔑 Original Hash:", evidence.sha256);

  // Check if encrypted file exists
  if (!fs.existsSync(evidence.encryptedPath)) {
    console.error("❌ Encrypted file not found:", evidence.encryptedPath);
    return false;
  }

  // Get encryption keys
  const key = Buffer.from(evidence.encryptionKey, "hex");
  const iv = Buffer.from(evidence.encryptionIV, "hex");

  // Decrypt to temp file
  const tempDecryptedPath = path.join(tempDir, "tamper_temp_" + Date.now() + ".txt");
  
  try {
    await decryptFile(evidence.encryptedPath, tempDecryptedPath, key, iv);
    console.log("✅ File decrypted to:", tempDecryptedPath);
  } catch (err) {
    console.error("❌ Decryption failed:", err.message);
    return false;
  }

  // Read original content
  let content = fs.readFileSync(tempDecryptedPath, "utf8");
  console.log("\n📄 ORIGINAL CONTENT:");
  console.log("─".repeat(50));
  console.log(content);
  console.log("─".repeat(50));

  // Apply tampering based on type
  let tamperedContent;
  
  switch (tamperType) {
    case "add":
      // Add new lines
      tamperedContent = content + `

UNAUTHORIZED ADDITION:
Added by attacker at ${new Date().toISOString()}
This line was secretly added to the document.
Attempting to frame someone else.`;
      console.log("\n⚠️ TAMPERING TYPE: Adding new content");
      break;

    case "remove":
      // Remove some lines
      const lines = content.split("\n");
      const removedLines = lines.filter((line, index) => {
        // Remove lines 3-5 (0-indexed: 2-4)
        return index < 5 || index > 7;
      });
      tamperedContent = removedLines.join("\n");
      console.log("\n⚠️ TAMPERING TYPE: Removing lines");
      break;

    case "modify":
      // Modify existing content
      tamperedContent = content
        .replace("John Doe", "Jane Smith")
        .replace("123 Main Street", "456 Oak Avenue")
        .replace("Badge: #12345", "Badge: #99999")
        .replace("Original", "MODIFIED")
        .replace("Intact", "BROKEN");
      console.log("\n⚠️ TAMPERING TYPE: Modifying existing content");
      break;

    case "replace":
      // Completely replace content
      tamperedContent = `FAKE DOCUMENT
This entire document has been replaced.
Created: ${new Date().toISOString()}
All original evidence has been destroyed.`;
      console.log("\n⚠️ TAMPERING TYPE: Complete replacement");
      break;

    default:
      // Default: add a single character
      tamperedContent = content + " ";
      console.log("\n⚠️ TAMPERING TYPE: Minor modification (single character)");
  }

  // Write tampered content
  fs.writeFileSync(tempDecryptedPath, tamperedContent);
  
  console.log("\n📄 TAMPERED CONTENT:");
  console.log("─".repeat(50));
  console.log(tamperedContent);
  console.log("─".repeat(50));

  // Re-encrypt the tampered file
  const backupPath = evidence.encryptedPath + ".backup";
  
  // Backup original encrypted file
  fs.copyFileSync(evidence.encryptedPath, backupPath);
  console.log("💾 Backup created:", backupPath);

  // Encrypt tampered file back
  try {
    await encryptFile(tempDecryptedPath, evidence.encryptedPath, key, iv);
    console.log("✅ Tampered file encrypted back to:", evidence.encryptedPath);
  } catch (err) {
    console.error("❌ Re-encryption failed:", err.message);
    // Restore backup
    fs.copyFileSync(backupPath, evidence.encryptedPath);
    return false;
  }

  // Clean up temp file
  fs.unlinkSync(tempDecryptedPath);

  // Calculate new hash (for comparison)
  const newHash = crypto.createHash("sha256").update(tamperedContent).digest("hex");
  
  console.log("\n📊 HASH COMPARISON:");
  console.log("─".repeat(50));
  console.log("Original Hash:", evidence.sha256);
  console.log("New Hash:     ", newHash);
  console.log("Hashes Match: ", evidence.sha256 === newHash ? "YES ✅" : "NO ❌");
  console.log("─".repeat(50));

  console.log("\n✅ TAMPERING COMPLETE!");
  console.log("📌 Now use the web interface or API to VERIFY this evidence.");
  console.log("📌 The system should detect the tampering and show details.");
  console.log("\n💡 To restore original file, run:");
  console.log(`   cp "${backupPath}" "${evidence.encryptedPath}"`);

  return true;
}

async function restoreEvidence(evidenceId) {
  console.log("\n🔄 RESTORING ORIGINAL EVIDENCE FILE...");
  console.log("═".repeat(80));

  const evidence = await Evidence.findById(evidenceId);
  
  if (!evidence) {
    console.error("❌ Evidence not found");
    return false;
  }

  const backupPath = evidence.encryptedPath + ".backup";
  
  if (!fs.existsSync(backupPath)) {
    console.error("❌ Backup file not found:", backupPath);
    return false;
  }

  fs.copyFileSync(backupPath, evidence.encryptedPath);
  fs.unlinkSync(backupPath);

  // Reset evidence status
  evidence.status = "pending";
  evidence.tamperingHistory = [];
  await evidence.save();

  console.log("✅ Evidence restored to original state");
  console.log("✅ Tampering history cleared");

  return true;
}

async function showTamperingHistory(evidenceId) {
  const evidence = await Evidence.findById(evidenceId)
    .populate("tamperingHistory.detectedBy", "username fullName");

  if (!evidence) {
    console.error("❌ Evidence not found");
    return;
  }

  console.log("\n📋 TAMPERING HISTORY FOR:", evidence.originalName);
  console.log("═".repeat(80));
  console.log("Status:", evidence.status);
  console.log("Verification Count:", evidence.verificationCount);
  console.log("─".repeat(80));

  if (!evidence.tamperingHistory || evidence.tamperingHistory.length === 0) {
    console.log("No tampering detected yet.");
    return;
  }

  evidence.tamperingHistory.forEach((incident, index) => {
    console.log(`\n🚨 INCIDENT #${index + 1}`);
    console.log("─".repeat(40));
    console.log("Detected At:", incident.detectedAt);
    console.log("Detected By:", incident.detectedBy?.username || "Unknown");
    console.log("Severity:", incident.severity?.toUpperCase());
    console.log("Original Hash:", incident.originalHash?.substring(0, 32) + "...");
    console.log("Current Hash:", incident.currentHash?.substring(0, 32) + "...");
    
    if (incident.differences) {
      console.log("\nDifferences:");
      console.log("  Type:", incident.differences.type);
      console.log("  Summary:", incident.differences.summary);
      console.log("  Lines Added:", incident.differences.linesAdded || 0);
      console.log("  Lines Removed:", incident.differences.linesRemoved || 0);
      console.log("  Lines Modified:", incident.differences.linesModified || 0);
      console.log("  Percentage Changed:", incident.differences.percentageChanged + "%");

      if (incident.differences.details && incident.differences.details.length > 0) {
        console.log("\n  Detailed Changes:");
        incident.differences.details.slice(0, 5).forEach((change, i) => {
          console.log(`    ${i + 1}. ${change.field} [${change.changeType}]`);
          if (change.original) console.log(`       Original: ${change.original.substring(0, 50)}...`);
          if (change.current) console.log(`       Current:  ${change.current.substring(0, 50)}...`);
        });
        if (incident.differences.details.length > 5) {
          console.log(`    ... and ${incident.differences.details.length - 5} more changes`);
        }
      }
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN MENU
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const evidenceId = args[1];
  const tamperType = args[2] || "modify";

  console.log("\n╔════════════════════════════════════════════════════════════════╗");
  console.log("║         🔬 ForensiVault Tampering Test Tool 🔬                 ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");

  switch (command) {
    case "create-test-file":
      await createTestFile();
      break;

    case "list":
      await listEvidence();
      break;

    case "tamper":
      if (!evidenceId) {
        console.error("❌ Please provide evidence ID");
        console.log("Usage: node test_tampering.js tamper <evidenceId> [add|remove|modify|replace]");
        break;
      }
      await tamperEvidence(evidenceId, tamperType);
      break;

    case "restore":
      if (!evidenceId) {
        console.error("❌ Please provide evidence ID");
        console.log("Usage: node test_tampering.js restore <evidenceId>");
        break;
      }
      await restoreEvidence(evidenceId);
      break;

    case "history":
      if (!evidenceId) {
        console.error("❌ Please provide evidence ID");
        console.log("Usage: node test_tampering.js history <evidenceId>");
        break;
      }
      await showTamperingHistory(evidenceId);
      break;

    default:
      console.log("📖 USAGE:");
      console.log("─".repeat(60));
      console.log("");
      console.log("  1. Create a test file:");
      console.log("     node test_tampering.js create-test-file");
      console.log("");
      console.log("  2. List all evidence files:");
      console.log("     node test_tampering.js list");
      console.log("");
      console.log("  3. Tamper an evidence file:");
      console.log("     node test_tampering.js tamper <evidenceId> [type]");
      console.log("     Types: add, remove, modify, replace");
      console.log("");
      console.log("  4. Restore tampered evidence:");
      console.log("     node test_tampering.js restore <evidenceId>");
      console.log("");
      console.log("  5. View tampering history:");
      console.log("     node test_tampering.js history <evidenceId>");
      console.log("");
      console.log("─".repeat(60));
      console.log("");
      console.log("📌 TESTING WORKFLOW:");
      console.log("  1. Upload a text file through the web interface");
      console.log("  2. Run: node test_tampering.js list");
      console.log("  3. Copy the evidence ID");
      console.log("  4. Run: node test_tampering.js tamper <ID> modify");
      console.log("  5. Go to web interface and click 'Verify Integrity'");
      console.log("  6. See tampering detection results!");
      console.log("");
  }

  mongoose.disconnect();
}

main().catch(console.error);
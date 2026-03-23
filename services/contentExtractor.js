// ═══════════════════════════════════════════════════════════════════════════
// FILE: forensivault/services/contentExtractor.js
// PURPOSE: Extract content from files for tampering comparison - FIXED
// ═══════════════════════════════════════════════════════════════════════════

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// ═══════════════════════════════════════════════════════════════════════════
// TEXT FILE EXTRACTION
// ═══════════════════════════════════════════════════════════════════════════

function extractTextFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    const lines = content.split("\n");
    const words = content.split(/\s+/).filter((w) => w.length > 0);

    return {
      textContent: content,
      lineCount: lines.length,
      wordCount: words.length,
      characterCount: content.length,
      contentHash: crypto.createHash("sha256").update(content).digest("hex"),
      capturedAt: new Date(),
    };
  } catch (err) {
    console.error("Text extraction error:", err.message);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// IMAGE METADATA EXTRACTION
// ═══════════════════════════════════════════════════════════════════════════

function extractImageMetadata(filePath) {
  try {
    const buffer = fs.readFileSync(filePath);
    const stats = fs.statSync(filePath);

    let width = 0;
    let height = 0;
    let format = "unknown";

    // Check for PNG
    if (
      buffer.length > 24 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    ) {
      format = "PNG";
      width = buffer.readUInt32BE(16);
      height = buffer.readUInt32BE(20);
    }
    // Check for JPEG
    else if (buffer.length > 2 && buffer[0] === 0xff && buffer[1] === 0xd8) {
      format = "JPEG";
      let offset = 2;
      while (offset < buffer.length - 10) {
        if (buffer[offset] !== 0xff) break;
        const marker = buffer[offset + 1];
        if (marker === 0xc0 || marker === 0xc2) {
          height = buffer.readUInt16BE(offset + 5);
          width = buffer.readUInt16BE(offset + 7);
          break;
        }
        if (offset + 4 >= buffer.length) break;
        const length = buffer.readUInt16BE(offset + 2);
        offset += 2 + length;
      }
    }
    // Check for GIF
    else if (
      buffer.length > 10 &&
      buffer[0] === 0x47 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46
    ) {
      format = "GIF";
      width = buffer.readUInt16LE(6);
      height = buffer.readUInt16LE(8);
    }
    // Check for BMP
    else if (buffer.length > 26 && buffer[0] === 0x42 && buffer[1] === 0x4d) {
      format = "BMP";
      width = buffer.readUInt32LE(18);
      height = Math.abs(buffer.readInt32LE(22));
    }

    return {
      metadata: {
        width,
        height,
        format,
        fileSize: stats.size,
      },
      checksum: {
        md5: crypto.createHash("md5").update(buffer).digest("hex"),
        sha1: crypto.createHash("sha1").update(buffer).digest("hex"),
        sha256: crypto.createHash("sha256").update(buffer).digest("hex"),
      },
      contentHash: crypto.createHash("sha256").update(buffer).digest("hex"),
      capturedAt: new Date(),
    };
  } catch (err) {
    console.error("Image extraction error:", err.message);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// BINARY FILE EXTRACTION
// ═══════════════════════════════════════════════════════════════════════════

function extractBinaryFile(filePath) {
  try {
    const buffer = fs.readFileSync(filePath);
    const stats = fs.statSync(filePath);

    return {
      checksum: {
        md5: crypto.createHash("md5").update(buffer).digest("hex"),
        sha1: crypto.createHash("sha1").update(buffer).digest("hex"),
        sha256: crypto.createHash("sha256").update(buffer).digest("hex"),
      },
      metadata: {
        fileSize: stats.size,
      },
      contentHash: crypto.createHash("sha256").update(buffer).digest("hex"),
      capturedAt: new Date(),
    };
  } catch (err) {
    console.error("Binary extraction error:", err.message);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN EXTRACTION FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

function extractContent(filePath, mimeType) {
  // Null safety check for mimeType
  mimeType = mimeType || "";

  const ext = path.extname(filePath).toLowerCase();

  console.log("📄 Extracting content from:", filePath);
  console.log("   MIME type:", mimeType);
  console.log("   Extension:", ext);

  // Text files
  const textExtensions = [
    ".txt", ".csv", ".log", ".json", ".xml", ".html", ".htm",
    ".css", ".js", ".jsx", ".ts", ".tsx", ".md", ".markdown",
    ".ini", ".cfg", ".conf", ".yaml", ".yml", ".env", ".sh",
    ".bat", ".ps1", ".py", ".java", ".c", ".cpp", ".h", ".hpp",
    ".cs", ".go", ".rb", ".php", ".sql", ".r", ".swift", ".kt"
  ];

  if (mimeType.includes("text") || textExtensions.includes(ext)) {
    console.log("   ✅ Detected as TEXT file");
    const result = extractTextFile(filePath);
    if (result) {
      return {
        contentType: "text",  // Changed from 'type' to 'contentType'
        ...result,
      };
    }
  }

  // Image files
  const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".ico", ".tiff", ".svg"];

  if (mimeType.includes("image") || imageExtensions.includes(ext)) {
    console.log("   ✅ Detected as IMAGE file");
    const result = extractImageMetadata(filePath);
    if (result) {
      return {
        contentType: "image",  // Changed from 'type' to 'contentType'
        ...result,
      };
    }
  }

  // Default: binary extraction
  console.log("   ✅ Detected as BINARY file");
  const result = extractBinaryFile(filePath);
  if (result) {
    return {
      contentType: "binary",  // Changed from 'type' to 'contentType'
      ...result,
    };
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// TEXT CONTENT COMPARISON
// ═══════════════════════════════════════════════════════════════════════════

function compareTextContent(original, current) {
  // Null safety
  if (!original || !current) {
    console.log("   ⚠️ Text comparison: missing content");
    return {
      type: "content",
      summary: "Unable to compare text content - original or current is missing",
      details: [],
      linesAdded: 0,
      linesRemoved: 0,
      linesModified: 0,
      totalChanges: 0,
      percentageChanged: 100,
      severity: "high",
    };
  }

  const originalLines = original.split("\n");
  const currentLines = current.split("\n");

  const differences = [];
  let linesAdded = 0;
  let linesRemoved = 0;
  let linesModified = 0;

  const maxLines = Math.max(originalLines.length, currentLines.length);

  for (let i = 0; i < maxLines; i++) {
    const origLine = originalLines[i];
    const currLine = currentLines[i];

    if (origLine === undefined && currLine !== undefined) {
      // Line added
      linesAdded++;
      differences.push({
        field: "Line " + (i + 1),
        original: "(not present)",
        current: currLine.substring(0, 100) + (currLine.length > 100 ? "..." : ""),
        changeType: "added",
      });
    } else if (origLine !== undefined && currLine === undefined) {
      // Line removed
      linesRemoved++;
      differences.push({
        field: "Line " + (i + 1),
        original: origLine.substring(0, 100) + (origLine.length > 100 ? "..." : ""),
        current: "(removed)",
        changeType: "removed",
      });
    } else if (origLine !== currLine) {
      // Line modified
      linesModified++;
      differences.push({
        field: "Line " + (i + 1),
        original: (origLine || "").substring(0, 100) + ((origLine || "").length > 100 ? "..." : ""),
        current: (currLine || "").substring(0, 100) + ((currLine || "").length > 100 ? "..." : ""),
        changeType: "modified",
      });
    }
  }

  // Calculate percentage
  const totalOriginalLines = originalLines.length || 1;
  const changedLines = linesAdded + linesRemoved + linesModified;
  const percentageChanged = Math.round((changedLines / totalOriginalLines) * 100);

  // Determine severity
  let severity = "low";
  if (percentageChanged > 50) severity = "critical";
  else if (percentageChanged > 25) severity = "high";
  else if (percentageChanged > 10) severity = "medium";

  console.log("   📊 Text comparison result:");
  console.log("      Lines added:", linesAdded);
  console.log("      Lines removed:", linesRemoved);
  console.log("      Lines modified:", linesModified);
  console.log("      Percentage changed:", percentageChanged + "%");
  console.log("      Severity:", severity);

  return {
    type: "content",
    summary:
      changedLines +
      " line(s) changed: " +
      linesAdded +
      " added, " +
      linesRemoved +
      " removed, " +
      linesModified +
      " modified",
    details: differences.slice(0, 20), // Limit to first 20 differences
    linesAdded,
    linesRemoved,
    linesModified,
    totalChanges: changedLines,
    percentageChanged,
    severity,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// IMAGE METADATA COMPARISON
// ═══════════════════════════════════════════════════════════════════════════

function compareImageMetadata(original, current) {
  const differences = [];

  if (!original || !current) {
    return {
      type: "metadata",
      summary: "Unable to compare image metadata",
      details: [],
      sizeChange: 0,
      percentageChanged: 100,
      severity: "high",
      linesAdded: 0,
      linesRemoved: 0,
      linesModified: 0,
    };
  }

  if (original.width !== current.width) {
    differences.push({
      field: "Width",
      original: (original.width || 0) + "px",
      current: (current.width || 0) + "px",
      changeType: "modified",
    });
  }

  if (original.height !== current.height) {
    differences.push({
      field: "Height",
      original: (original.height || 0) + "px",
      current: (current.height || 0) + "px",
      changeType: "modified",
    });
  }

  if (original.format !== current.format) {
    differences.push({
      field: "Format",
      original: original.format || "unknown",
      current: current.format || "unknown",
      changeType: "modified",
    });
  }

  if (original.fileSize !== current.fileSize) {
    differences.push({
      field: "File Size",
      original: (original.fileSize || 0) + " bytes",
      current: (current.fileSize || 0) + " bytes",
      changeType: "modified",
    });
  }

  const severity = differences.length > 2 ? "high" : differences.length > 0 ? "medium" : "low";

  return {
    type: "metadata",
    summary: differences.length + " metadata field(s) changed",
    details: differences,
    sizeChange: (current.fileSize || 0) - (original.fileSize || 0),
    percentageChanged: differences.length > 0 ? Math.round((differences.length / 4) * 100) : 0,
    severity,
    linesAdded: 0,
    linesRemoved: 0,
    linesModified: differences.length,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// BINARY CONTENT COMPARISON
// ═══════════════════════════════════════════════════════════════════════════

function compareBinaryContent(original, current) {
  const differences = [];

  if (!original || !current) {
    return {
      type: "binary",
      summary: "Binary content has been modified",
      details: [],
      sizeChange: 0,
      percentageChanged: 100,
      severity: "high",
      linesAdded: 0,
      linesRemoved: 0,
      linesModified: 0,
    };
  }

  if (original.fileSize !== current.fileSize) {
    differences.push({
      field: "File Size",
      original: (original.fileSize || 0) + " bytes",
      current: (current.fileSize || 0) + " bytes",
      changeType: "modified",
    });
  }

  if (original.md5 !== current.md5) {
    differences.push({
      field: "MD5 Checksum",
      original: original.md5 || "unknown",
      current: current.md5 || "unknown",
      changeType: "modified",
    });
  }

  if (original.sha1 !== current.sha1) {
    differences.push({
      field: "SHA1 Checksum",
      original: original.sha1 || "unknown",
      current: current.sha1 || "unknown",
      changeType: "modified",
    });
  }

  return {
    type: "binary",
    summary: "Binary content has been modified",
    details: differences,
    sizeChange: (current.fileSize || 0) - (original.fileSize || 0),
    percentageChanged: 100,
    severity: "high",
    linesAdded: 0,
    linesRemoved: 0,
    linesModified: 0,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPARISON FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

function compareContent(originalData, currentData) {
  console.log("\n🔍 Comparing content...");
  console.log("   Original data:", originalData ? "exists" : "NULL");
  console.log("   Current data:", currentData ? "exists" : "NULL");

  // Handle null/undefined cases
  if (!originalData || !currentData) {
    console.log("   ⚠️ Missing data - falling back to binary comparison");
    return {
      type: "unknown",
      summary: "Unable to compare - original content not available (file was uploaded before content extraction was enabled)",
      details: [],
      severity: "medium",
      linesAdded: 0,
      linesRemoved: 0,
      linesModified: 0,
      percentageChanged: 100,
    };
  }

  console.log("   Original contentType:", originalData.contentType);
  console.log("   Current contentType:", currentData.contentType);

  // Text file comparison
  if (originalData.contentType === "text" && originalData.textContent !== undefined) {
    console.log("   ✅ Using TEXT comparison");
    return compareTextContent(
      originalData.textContent || "",
      currentData.textContent || ""
    );
  }

  // Image file comparison
  if (originalData.contentType === "image" && originalData.metadata) {
    console.log("   ✅ Using IMAGE comparison");
    return compareImageMetadata(
      originalData.metadata || {},
      currentData.metadata || {}
    );
  }

  // Binary/PDF comparison (checksum based)
  if (originalData.checksum) {
    console.log("   ✅ Using BINARY comparison");
    return compareBinaryContent(
      {
        ...(originalData.checksum || {}),
        fileSize: originalData.metadata?.fileSize,
      },
      {
        ...(currentData.checksum || {}),
        fileSize: currentData.metadata?.fileSize,
      }
    );
  }

  // Fallback
  console.log("   ⚠️ No matching comparison type - using fallback");
  return {
    type: "unknown",
    summary: "File content has been modified (detailed comparison not available)",
    details: [],
    severity: "medium",
    linesAdded: 0,
    linesRemoved: 0,
    linesModified: 0,
    percentageChanged: 100,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// MODULE EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

module.exports = {
  extractContent,
  compareContent,
  extractTextFile,
  extractImageMetadata,
  extractBinaryFile,
  compareTextContent,
  compareImageMetadata,
  compareBinaryContent,
};
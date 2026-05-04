// ═══════════════════════════════════════════════════════════════════════════
// FILE: forensivault/server.js
// PURPOSE: Main Express server with complete tampering detection & disk image parsing
// ═══════════════════════════════════════════════════════════════════════════

const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const cors = require("cors");
const PDFDocument = require("pdfkit");
require("dotenv").config();

// Import content extractor for tampering detection
const { extractContent, compareContent } = require("./services/contentExtractor");

// Import Python bridge for disk image parsing
const pythonBridge = require("./utils/pythonBridge");

const app = express();

const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer config for regular file uploads
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'forensivault/uploads',
    resource_type: 'raw',
  },
});
const upload = multer({ storage });

// Multer config for large disk images
const diskImageStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'forensivault/disk-images',
    resource_type: 'raw',
  },
});
const diskImageUpload = multer({ 
  storage: diskImageStorage,
  limits: { fileSize: 1024 * 1024 * 1024 * 100 }
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    if (
      origin.includes('forensi-vault') ||
      origin.includes('localhost')
    ) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

// Database Connection
mongoose
  .connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/forensivault", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("✅ MongoDB Connected");
  })
  .catch((err) => {
    console.error("❌ MongoDB Connection Error:", err.message);
    process.exit(1);
  });

// Import Models (including DiskImage)
const { Case, Evidence, Log, User, DiskImage } = require("./models");

// Constants
const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";
const AES_KEY = Buffer.from(
  process.env.AES_KEY || crypto.randomBytes(32).toString("hex"),
  "hex"
);
const AES_IV = Buffer.from(
  process.env.AES_IV || crypto.randomBytes(16).toString("hex"),
  "hex"
);

// Create Directories (including disk-images and extracted)
const uploadDir = path.join(__dirname, "uploads");
const encryptedDir = path.join(__dirname, "encrypted");
const tempDir = path.join(__dirname, "temp");
const reportsDir = path.join(__dirname, "reports");
const diskImagesDir = path.join(__dirname, "disk-images");
const extractedDir = path.join(__dirname, "extracted");

[uploadDir, encryptedDir, tempDir, reportsDir, diskImagesDir, extractedDir].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ════════════════════════════════════════════════════════════════════════════
// MIDDLEWARE
// ════════════════════════════════════════════════════════════════════════════

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  let token = null;

  if (authHeader) {
    token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
  } else if (req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

function roleMiddleware(...allowedRoles) {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "Access denied. Insufficient permissions." });
    }
    next();
  };
}

// ════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ════════════════════════════════════════════════════════════════════════════

function getFileType(mimetype) {
  if (!mimetype) return "other";
  if (mimetype.startsWith("image/")) return "image";
  if (mimetype.startsWith("video/")) return "video";
  if (mimetype.startsWith("audio/")) return "audio";
  if (mimetype.includes("pdf") || mimetype.includes("document") || mimetype.includes("text")) {
    return "document";
  }
  return "other";
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

async function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    try {
      const hash = crypto.createHash("sha256");
      const stream = fs.createReadStream(filePath);

      stream.on("data", (data) => hash.update(data));
      stream.on("end", () => resolve(hash.digest("hex")));
      stream.on("error", reject);
    } catch (err) {
      reject(err);
    }
  });
}

async function createLog(action, userId, details = {}) {
  try {
    const lastLog = await Log.findOne().sort({ index: -1 });
    const prevHash = lastLog ? lastLog.entryHash : "GENESIS";
    const index = lastLog ? lastLog.index + 1 : 0;

    const payload = JSON.stringify({
      index,
      action,
      userId,
      ...details,
      timestamp: new Date().toISOString(),
    });

    const entryHash = crypto
      .createHash("sha256")
      .update(prevHash + payload)
      .digest("hex");

    const log = new Log({
      index,
      action,
      userId,
      ...details,
      payload,
      previousHash: prevHash,
      entryHash,
      timestamp: new Date(),
    });

    await log.save();
    return log;
  } catch (err) {
    console.error("❌ Logging Error:", err);
    throw err;
  }
}

function generateCaseNumber() {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
  return "FV-" + year + "-" + random;
}

function formatFileSize(bytes) {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let size = bytes;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return `${size.toFixed(2)} ${units[i]}`;
}

// ════════════════════════════════════════════════════════════════════════════
// AUTH ROUTES
// ════════════════════════════════════════════════════════════════════════════

app.post("/api/auth/signup", async (req, res) => {
  try {
    const { username, password, role, email, fullName } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password required" });
    }

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(409).json({ error: "Username already exists" });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = new User({
      username,
      password: hashed,
      role: role || "officer",
      email,
      fullName,
    });

    await user.save();

    await createLog("USER_CREATED", user._id, {
      targetUserId: user._id,
      details: { username, role: user.role },
    });

    res.status(201).json({
      message: "User created successfully",
      user: { id: user._id, username: user.username, role: user.role },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password required" });
    }

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    if (user.status !== "active") {
      return res.status(401).json({ error: "Account is " + user.status });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    user.lastLogin = new Date();
    await user.save();

    const token = jwt.sign(
      { id: user._id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    await createLog("LOGIN", user._id, {
      details: { username },
    });

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        fullName: user.fullName,
        email: user.email,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/auth/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id, { password: 0 });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/auth/logout", authMiddleware, async (req, res) => {
  try {
    await createLog("LOGOUT", req.user.id, {});
    res.json({ message: "Logged out successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// USER MANAGEMENT ROUTES
// ════════════════════════════════════════════════════════════════════════════

app.get("/api/users", authMiddleware, roleMiddleware("admin"), async (req, res) => {
  try {
    const { status, role, search, page = 1, limit = 10 } = req.query;
    let query = {};

    if (status) query.status = status;
    if (role) query.role = role;
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: "i" } },
        { fullName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const total = await User.countDocuments(query);
    const users = await User.find(query, { password: 0 })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    res.json({
      users,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/users/:id", authMiddleware, roleMiddleware("admin"), async (req, res) => {
  try {
    const user = await User.findById(req.params.id, { password: 0 });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/users", authMiddleware, roleMiddleware("admin"), async (req, res) => {
  try {
    const { username, password, role, email, fullName, department, phone } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password required" });
    }

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(409).json({ error: "Username already exists" });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = new User({
      username,
      password: hashed,
      role: role || "officer",
      email,
      fullName,
      department,
      phone,
      createdBy: req.user.id,
    });

    await user.save();

    await createLog("USER_CREATED", req.user.id, {
      targetUserId: user._id,
      details: { username, role: user.role, createdBy: req.user.username },
    });

    res.status(201).json({
      message: "User created successfully",
      user: { id: user._id, username: user.username, role: user.role },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/users/:id", authMiddleware, roleMiddleware("admin"), async (req, res) => {
  try {
    const { role, email, fullName, status, department, phone } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (role) user.role = role;
    if (email) user.email = email;
    if (fullName) user.fullName = fullName;
    if (status) user.status = status;
    if (department) user.department = department;
    if (phone) user.phone = phone;
    user.updatedAt = new Date();

    await user.save();

    await createLog("USER_UPDATED", req.user.id, {
      targetUserId: user._id,
      details: { username: user.username, changes: req.body },
    });

    res.json({
      message: "User updated successfully",
      user: { id: user._id, username: user.username, role: user.role, status: user.status },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/users/:id", authMiddleware, roleMiddleware("admin"), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user._id.toString() === req.user.id) {
      return res.status(400).json({ error: "Cannot delete your own account" });
    }

    await User.findByIdAndDelete(req.params.id);

    await createLog("USER_DELETED", req.user.id, {
      targetUserId: user._id,
      details: { username: user.username },
    });

    res.json({ message: "User deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/users/:id/reset-password", authMiddleware, roleMiddleware("admin"), async (req, res) => {
  try {
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.updatedAt = new Date();
    await user.save();

    await createLog("PASSWORD_RESET", req.user.id, {
      targetUserId: user._id,
      details: { username: user.username, resetBy: req.user.username },
    });

    res.json({ message: "Password reset successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// CASE ROUTES
// ════════════════════════════════════════════════════════════════════════════

app.get("/api/cases", authMiddleware, async (req, res) => {
  try {
    const { status, priority, search, page = 1, limit = 10 } = req.query;
    let query = {};

    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (search) {
      query.$or = [
        { caseNumber: { $regex: search, $options: "i" } },
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const total = await Case.countDocuments(query);
    const cases = await Case.find(query)
      .populate("createdBy", "username fullName")
      .populate("assignedTo", "username fullName")
      .populate("evidenceFiles")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    res.json({
      cases,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/cases/:id", authMiddleware, async (req, res) => {
  try {
    const caseData = await Case.findById(req.params.id)
      .populate("createdBy", "username fullName")
      .populate("assignedTo", "username fullName")
      .populate({
        path: "evidenceFiles",
        select: "-encryptionKey -encryptionIV -originalContent",
      });

    if (!caseData) {
      return res.status(404).json({ error: "Case not found" });
    }

    res.json(caseData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/cases", authMiddleware, roleMiddleware("admin", "officer", "analyst"), async (req, res) => {
  try {
    const { title, description, priority, assignedTo, tags } = req.body;

    if (!title) {
      return res.status(400).json({ error: "Case title is required" });
    }

    const caseNumber = generateCaseNumber();

    const newCase = new Case({
      caseNumber,
      title,
      description,
      priority: priority || "medium",
      createdBy: req.user.id,
      assignedTo: assignedTo || [],
      tags: tags || [],
    });

    await newCase.save();

    await createLog("CASE_CREATED", req.user.id, {
      caseId: newCase._id,
      details: { caseNumber, title },
    });

    res.status(201).json({
      message: "Case created successfully",
      case: newCase,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/cases/:id", authMiddleware, roleMiddleware("admin", "officer", "analyst"), async (req, res) => {
  try {
    const { title, description, status, priority, assignedTo, tags } = req.body;

    const caseData = await Case.findById(req.params.id);
    if (!caseData) {
      return res.status(404).json({ error: "Case not found" });
    }

    if (title) caseData.title = title;
    if (description !== undefined) caseData.description = description;
    if (status) {
      caseData.status = status;
      if (status === "closed") caseData.closedAt = new Date();
    }
    if (priority) caseData.priority = priority;
    if (assignedTo) caseData.assignedTo = assignedTo;
    if (tags) caseData.tags = tags;
    caseData.updatedAt = new Date();

    await caseData.save();

    await createLog("CASE_UPDATED", req.user.id, {
      caseId: caseData._id,
      details: { caseNumber: caseData.caseNumber, changes: req.body },
    });

    res.json({
      message: "Case updated successfully",
      case: caseData,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/cases/:id/close", authMiddleware, roleMiddleware("admin", "analyst"), async (req, res) => {
  try {
    const caseData = await Case.findById(req.params.id);
    if (!caseData) {
      return res.status(404).json({ error: "Case not found" });
    }

    caseData.status = "closed";
    caseData.closedAt = new Date();
    caseData.updatedAt = new Date();
    await caseData.save();

    await createLog("CASE_CLOSED", req.user.id, {
      caseId: caseData._id,
      details: { caseNumber: caseData.caseNumber },
    });

    res.json({
      message: "Case closed successfully",
      case: caseData,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// EVIDENCE UPLOAD (WITH CONTENT EXTRACTION)
// ════════════════════════════════════════════════════════════════════════════

app.post("/api/evidence/upload", authMiddleware, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file provided" });
    }

    const { caseId, description, tags } = req.body;

    if (caseId) {
      const caseData = await Case.findById(caseId);
      if (!caseData) {
        fs.unlinkSync(req.file.path);
        return res.status(404).json({ error: "Case not found" });
      }
    }

    const file = req.file;
    const key = AES_KEY;
    const iv = AES_IV;

    // Compute original hash
    const originalHash = await hashFile(file.path);

    // Extract content for tampering detection
    let originalContent = null;
    try {
      originalContent = extractContent(file.path, file.mimetype);
      
      console.log("═══════════════════════════════════════════════════════");
      console.log("📄 CONTENT EXTRACTION RESULT:");
      console.log("   File:", file.originalname);
      console.log("   Content Type:", originalContent?.contentType);
      console.log("   Has textContent:", !!originalContent?.textContent);
      console.log("   Text length:", originalContent?.textContent?.length || 0);
      console.log("   Line count:", originalContent?.lineCount || 0);
      console.log("═══════════════════════════════════════════════════════");
      
    } catch (extractErr) {
      console.error("Content extraction error:", extractErr.message);
    }

    // Encrypt file
    const encryptedFilename = file.filename + ".enc";
    const encryptedPath = path.join(encryptedDir, encryptedFilename);
    await encryptFile(file.path, encryptedPath, key, iv);

    // Create evidence record
    const evidence = new Evidence({
      originalName: file.originalname,
      encryptedPath,
      size: file.size,
      sha256: originalHash,
      mimeType: file.mimetype,
      fileType: getFileType(file.mimetype),
      uploader: req.user.id,
      caseId: caseId || null,
      uploadedAt: new Date(),
      encryptionKey: key.toString("hex"),
      encryptionIV: iv.toString("hex"),
      description,
      tags: tags ? tags.split(",").map((t) => t.trim()) : [],
      originalContent: originalContent,
      tamperingHistory: [],
    });

    await evidence.save();

    // Verify the content was saved
    const savedEvidence = await Evidence.findById(evidence._id);
    console.log("═══════════════════════════════════════════════════════");
    console.log("💾 SAVED EVIDENCE CHECK:");
    console.log("   ID:", savedEvidence._id);
    console.log("   Has originalContent:", !!savedEvidence.originalContent);
    console.log("   Content Type:", savedEvidence.originalContent?.contentType);
    console.log("   Has textContent:", !!savedEvidence.originalContent?.textContent);
    console.log("═══════════════════════════════════════════════════════");

    if (caseId) {
      await Case.findByIdAndUpdate(caseId, {
        $push: { evidenceFiles: evidence._id },
        updatedAt: new Date(),
      });
    }

    await createLog("UPLOAD", req.user.id, {
      evidenceId: evidence._id,
      caseId: caseId || null,
      details: {
        filename: file.originalname,
        size: file.size,
        hash: originalHash,
        contentType: originalContent?.contentType || "unknown",
      },
    });

    // Clean up temp file
    fs.unlinkSync(file.path);

    res.status(201).json({
      message: "Evidence uploaded successfully",
      evidence: {
        id: evidence._id,
        originalName: evidence.originalName,
        size: evidence.size,
        sha256: evidence.sha256,
        fileType: evidence.fileType,
        status: evidence.status,
        uploadedAt: evidence.uploadedAt,
        contentAnalyzed: !!originalContent,
        contentType: originalContent?.contentType || "unknown",
      },
    });
  } catch (err) {
    console.error("❌ Upload Error:", err);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/evidence", authMiddleware, async (req, res) => {
  try {
    const { status, fileType, caseId, search, page = 1, limit = 10 } = req.query;
    let query = {};

    if (status) query.status = status;
    if (fileType) query.fileType = fileType;
    if (caseId) query.caseId = caseId;
    if (search) {
      query.$or = [
        { originalName: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const total = await Evidence.countDocuments(query);
    const evidence = await Evidence.find(query, {
      encryptionKey: 0,
      encryptionIV: 0,
      originalContent: 0,
    })
      .populate("uploader", "username fullName")
      .populate("caseId", "caseNumber title")
      .sort({ uploadedAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    res.json({
      evidence,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/evidence/:id", authMiddleware, async (req, res) => {
  try {
    const evidence = await Evidence.findById(req.params.id, {
      encryptionKey: 0,
      encryptionIV: 0,
      originalContent: 0,
    })
      .populate("uploader", "username fullName")
      .populate("caseId", "caseNumber title")
      .populate("lastVerifiedBy", "username fullName")
      .populate("tamperingHistory.detectedBy", "username fullName");

    if (!evidence) {
      return res.status(404).json({ error: "Evidence not found" });
    }

    res.json(evidence);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// VERIFY ROUTE (WITH TAMPERING DETECTION)
// ════════════════════════════════════════════════════════════════════════════

app.post("/api/verify/:id", authMiddleware, roleMiddleware("admin", "analyst"), async (req, res) => {
  try {
    const evidence = await Evidence.findById(req.params.id);

    if (!evidence) {
      return res.status(404).json({ error: "Evidence not found" });
    }

    console.log("═══════════════════════════════════════════════════════");
    console.log("🔍 VERIFICATION STARTED:");
    console.log("   Evidence ID:", evidence._id);
    console.log("   Filename:", evidence.originalName);
    console.log("   Has originalContent:", !!evidence.originalContent);
    console.log("   Original contentType:", evidence.originalContent?.contentType);
    console.log("   Has textContent:", !!evidence.originalContent?.textContent);
    console.log("═══════════════════════════════════════════════════════");

    if (!fs.existsSync(evidence.encryptedPath)) {
      return res.status(400).json({ error: "Evidence file not available" });
    }

    // Decrypt to temp file
    const tempPath = path.join(tempDir, "verify_" + Date.now() + "_" + evidence.originalName);
    const key = Buffer.from(evidence.encryptionKey, "hex");
    const iv = Buffer.from(evidence.encryptionIV, "hex");

    await decryptFile(evidence.encryptedPath, tempPath, key, iv);

    // Compute current hash
    const computedHash = await hashFile(tempPath);
    const isValid = computedHash === evidence.sha256;

    let tamperingDetails = null;

    if (!isValid) {
      console.log("⚠️ TAMPERING DETECTED - Analyzing differences...");

      // Extract current content
      let currentContent = null;
      try {
        currentContent = extractContent(tempPath, evidence.mimeType);
        
        console.log("═══════════════════════════════════════════════════════");
        console.log("📄 CURRENT CONTENT EXTRACTION:");
        console.log("   Content Type:", currentContent?.contentType);
        console.log("   Has textContent:", !!currentContent?.textContent);
        console.log("   Text length:", currentContent?.textContent?.length || 0);
        console.log("═══════════════════════════════════════════════════════");
        
      } catch (err) {
        console.error("Current content extraction error:", err);
      }

      // Compare with original
      const differences = compareContent(evidence.originalContent, currentContent);

      console.log("═══════════════════════════════════════════════════════");
      console.log("📊 COMPARISON RESULT:");
      console.log("   Type:", differences.type);
      console.log("   Summary:", differences.summary);
      console.log("   Severity:", differences.severity);
      console.log("   Lines Added:", differences.linesAdded);
      console.log("   Lines Removed:", differences.linesRemoved);
      console.log("   Lines Modified:", differences.linesModified);
      console.log("═══════════════════════════════════════════════════════");

      tamperingDetails = {
        detectedAt: new Date(),
        detectedBy: req.user.id,
        originalHash: evidence.sha256,
        currentHash: computedHash,
        differences: differences,
        severity: differences.severity || "medium",
      };

      evidence.tamperingHistory.push(tamperingDetails);

      await createLog("TAMPERING_DETECTED", req.user.id, {
        evidenceId: evidence._id,
        caseId: evidence.caseId,
        details: {
          filename: evidence.originalName,
          severity: tamperingDetails.severity,
          summary: differences.summary,
          originalHash: evidence.sha256,
          currentHash: computedHash,
        },
        tamperingDetails: {
          evidenceId: evidence._id,
          evidenceName: evidence.originalName,
          severity: tamperingDetails.severity,
          differences: differences,
        },
      });
    }

    // Update evidence status
    evidence.status = isValid ? "verified" : "tampered";
    evidence.lastVerifiedAt = new Date();
    evidence.lastVerifiedBy = req.user.id;
    evidence.verificationCount += 1;
    await evidence.save();

    // Clean up temp file
    fs.unlinkSync(tempPath);

    // Create verification log
    await createLog("VERIFY", req.user.id, {
      evidenceId: evidence._id,
      caseId: evidence.caseId,
      details: {
        result: isValid ? "PASSED" : "FAILED",
        storedHash: evidence.sha256,
        computedHash,
      },
    });

    // Build response
    const response = {
      evidenceId: evidence._id,
      filename: evidence.originalName,
      verified: isValid,
      status: evidence.status,
      storedHash: evidence.sha256,
      computedHash,
      verificationCount: evidence.verificationCount,
      timestamp: new Date(),
      message: isValid
        ? "✅ Evidence integrity verified - no tampering detected"
        : "❌ TAMPERING DETECTED - Evidence has been modified",
    };

    if (!isValid && tamperingDetails) {
      response.tampering = {
        severity: tamperingDetails.severity,
        summary: tamperingDetails.differences.summary,
        details: tamperingDetails.differences.details,
        statistics: {
          linesAdded: tamperingDetails.differences.linesAdded || 0,
          linesRemoved: tamperingDetails.differences.linesRemoved || 0,
          linesModified: tamperingDetails.differences.linesModified || 0,
          sizeChange: tamperingDetails.differences.sizeChange || 0,
          percentageChanged: tamperingDetails.differences.percentageChanged || 0,
        },
        detectedAt: tamperingDetails.detectedAt,
        detectedBy: req.user.username,
      };
    }

    res.json(response);
  } catch (err) {
    console.error("❌ Verification Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// TAMPERING LOGS ROUTES
// ════════════════════════════════════════════════════════════════════════════

app.get("/api/tampering-logs", authMiddleware, roleMiddleware("admin", "analyst"), async (req, res) => {
  try {
    const { page = 1, limit = 20, severity, startDate, endDate } = req.query;

    let query = { action: "TAMPERING_DETECTED" };

    if (severity) {
      query["tamperingDetails.severity"] = severity;
    }

    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    const total = await Log.countDocuments(query);
    const logs = await Log.find(query)
      .populate("userId", "username fullName")
      .populate("evidenceId", "originalName status fileType")
      .populate("caseId", "caseNumber title")
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    res.json({
      logs,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/tampering-stats", authMiddleware, roleMiddleware("admin", "analyst"), async (req, res) => {
  try {
    const stats = await Log.aggregate([
      { $match: { action: "TAMPERING_DETECTED" } },
      {
        $facet: {
          total: [{ $count: "count" }],
          bySeverity: [{ $group: { _id: "$tamperingDetails.severity", count: { $sum: 1 } } }],
          last7Days: [
            { $match: { timestamp: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } },
            {
              $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
                count: { $sum: 1 },
              },
            },
            { $sort: { _id: 1 } },
          ],
        },
      },
    ]);

    const tamperedEvidence = await Evidence.countDocuments({ status: "tampered" });

    res.json({
      totalIncidents: stats[0].total[0]?.count || 0,
      tamperedEvidence,
      bySeverity: stats[0].bySeverity,
      last7Days: stats[0].last7Days,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/evidence/:id/tampering-history", authMiddleware, async (req, res) => {
  try {
    const evidence = await Evidence.findById(req.params.id)
      .select("originalName status tamperingHistory verificationCount")
      .populate("tamperingHistory.detectedBy", "username fullName");

    if (!evidence) {
      return res.status(404).json({ error: "Evidence not found" });
    }

    res.json({
      evidenceId: evidence._id,
      originalName: evidence.originalName,
      status: evidence.status,
      verificationCount: evidence.verificationCount,
      tamperingHistory: evidence.tamperingHistory || [],
      totalIncidents: (evidence.tamperingHistory || []).length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// REPORT ROUTES
// ════════════════════════════════════════════════════════════════════════════

app.get("/api/report/evidence/:id", authMiddleware, roleMiddleware("admin", "analyst"), async (req, res) => {
  try {
    const evidence = await Evidence.findById(req.params.id)
      .populate("uploader", "username fullName")
      .populate("caseId", "caseNumber title")
      .populate("lastVerifiedBy", "username fullName")
      .populate("tamperingHistory.detectedBy", "username fullName");

    if (!evidence) {
      return res.status(404).json({ error: "Evidence not found" });
    }

    const logs = await Log.find({ evidenceId: evidence._id })
      .populate("userId", "username fullName")
      .sort({ timestamp: 1 });

    const doc = new PDFDocument({ margin: 50 });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="CoC_' + evidence._id + '.pdf"');

    doc.pipe(res);

    // Header
    doc.fontSize(24).font("Helvetica-Bold").fillColor("#667eea").text("ForensiVault", { align: "center" });
    doc.fontSize(16).fillColor("#333").text("Chain of Custody Report", { align: "center" });
    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor("#667eea").lineWidth(2).stroke();
    doc.moveDown();

    // Evidence Details
    doc.fontSize(14).font("Helvetica-Bold").fillColor("#333").text("EVIDENCE DETAILS");
    doc.moveDown(0.5);
    doc.fontSize(10).font("Helvetica");
    doc.text("Evidence ID: " + evidence._id);
    doc.text("Filename: " + evidence.originalName);
    doc.text("File Type: " + evidence.fileType);
    doc.text("Size: " + (evidence.size / 1024).toFixed(2) + " KB");
    doc.text("SHA-256 Hash: " + evidence.sha256);
    doc.text("Status: " + evidence.status.toUpperCase());
    doc.text("Uploaded: " + new Date(evidence.uploadedAt).toLocaleString());
    doc.text("Uploaded By: " + (evidence.uploader ? evidence.uploader.fullName || evidence.uploader.username : "Unknown"));
    
    if (evidence.caseId) {
      doc.text("Case: " + evidence.caseId.caseNumber + " - " + evidence.caseId.title);
    }
    if (evidence.lastVerifiedAt) {
      doc.text("Last Verified: " + new Date(evidence.lastVerifiedAt).toLocaleString());
      doc.text("Verified By: " + (evidence.lastVerifiedBy ? evidence.lastVerifiedBy.fullName || evidence.lastVerifiedBy.username : "Unknown"));
    }
    doc.moveDown();

    // Tampering History
    if (evidence.tamperingHistory && evidence.tamperingHistory.length > 0) {
      doc.fontSize(14).font("Helvetica-Bold").fillColor("#dc2626").text("TAMPERING INCIDENTS (" + evidence.tamperingHistory.length + ")");
      doc.moveDown(0.5);

      evidence.tamperingHistory.forEach((incident, index) => {
        doc.fontSize(10).font("Helvetica-Bold").fillColor("#333");
        doc.text("Incident #" + (index + 1) + " - Severity: " + (incident.severity || "unknown").toUpperCase());
        doc.fontSize(9).font("Helvetica");
        doc.text("   Detected: " + new Date(incident.detectedAt).toLocaleString());
        doc.text("   Summary: " + (incident.differences?.summary || "Content modified"));
        doc.moveDown(0.3);
      });
      doc.moveDown();
    }

    // Chain of Custody Log
    doc.fontSize(14).font("Helvetica-Bold").fillColor("#333").text("CHAIN OF CUSTODY LOG");
    doc.moveDown(0.5);

    if (logs.length === 0) {
      doc.fontSize(10).font("Helvetica").text("No activity logs found.");
    } else {
      logs.forEach((log, index) => {
        doc.fontSize(9).font("Helvetica-Bold").text((index + 1) + ". " + log.action);
        doc.fontSize(8).font("Helvetica");
        doc.text("   Timestamp: " + new Date(log.timestamp).toLocaleString());
        doc.text("   User: " + (log.userId ? log.userId.fullName || log.userId.username : "System"));
        doc.text("   Hash: " + log.entryHash.substring(0, 40) + "...");
        doc.moveDown(0.3);
      });
    }

    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor("#ccc").lineWidth(1).stroke();
    doc.moveDown();

    // Footer
    doc.fontSize(8).fillColor("#666").text("Report generated on " + new Date().toLocaleString(), { align: "center" });
    doc.text("This is an official chain of custody record from ForensiVault.", { align: "center" });

    doc.end();

    await createLog("REPORT_GENERATED", req.user.id, {
      evidenceId: evidence._id,
      details: { reportType: "Chain of Custody" },
    });
  } catch (err) {
    console.error("❌ Report Error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/report/case/:id", authMiddleware, roleMiddleware("admin", "analyst"), async (req, res) => {
  try {
    const caseData = await Case.findById(req.params.id)
      .populate("createdBy", "username fullName")
      .populate("assignedTo", "username fullName")
      .populate({
        path: "evidenceFiles",
        select: "-encryptionKey -encryptionIV -originalContent",
        populate: { path: "uploader", select: "username fullName" },
      });

    if (!caseData) {
      return res.status(404).json({ error: "Case not found" });
    }

    const doc = new PDFDocument({ margin: 50 });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="Case_' + caseData.caseNumber + '.pdf"');

    doc.pipe(res);

    doc.fontSize(24).font("Helvetica-Bold").fillColor("#667eea").text("ForensiVault", { align: "center" });
    doc.fontSize(16).fillColor("#333").text("Case Report", { align: "center" });
    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor("#667eea").lineWidth(2).stroke();
    doc.moveDown();

    doc.fontSize(14).font("Helvetica-Bold").fillColor("#333").text("CASE DETAILS");
    doc.moveDown(0.5);
    doc.fontSize(10).font("Helvetica");
    doc.text("Case Number: " + caseData.caseNumber);
    doc.text("Title: " + caseData.title);
    doc.text("Description: " + (caseData.description || "N/A"));
    doc.text("Status: " + caseData.status.toUpperCase());
    doc.text("Priority: " + caseData.priority.toUpperCase());
    doc.text("Created: " + new Date(caseData.createdAt).toLocaleString());
    doc.text("Created By: " + (caseData.createdBy ? caseData.createdBy.fullName || caseData.createdBy.username : "Unknown"));
    if (caseData.closedAt) {
      doc.text("Closed: " + new Date(caseData.closedAt).toLocaleString());
    }
    doc.moveDown();

    doc.fontSize(14).font("Helvetica-Bold").text("EVIDENCE FILES (" + caseData.evidenceFiles.length + ")");
    doc.moveDown(0.5);

    if (caseData.evidenceFiles.length === 0) {
      doc.fontSize(10).font("Helvetica").text("No evidence files attached.");
    } else {
      caseData.evidenceFiles.forEach((evidence, index) => {
        doc.fontSize(9).font("Helvetica-Bold").text((index + 1) + ". " + evidence.originalName);
        doc.fontSize(8).font("Helvetica");
        doc.text("   Status: " + evidence.status + " | Type: " + evidence.fileType);
        doc.text("   Hash: " + evidence.sha256.substring(0, 40) + "...");
        doc.moveDown(0.3);
      });
    }

    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor("#ccc").lineWidth(1).stroke();
    doc.moveDown();

    doc.fontSize(8).fillColor("#666").text("Report generated on " + new Date().toLocaleString(), { align: "center" });
    doc.text("This is an official case report from ForensiVault.", { align: "center" });

    doc.end();

    await createLog("REPORT_GENERATED", req.user.id, {
      caseId: caseData._id,
      details: { reportType: "Case Report" },
    });
  } catch (err) {
    console.error("❌ Report Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Tampering Report
app.get("/api/report/tampering/:id", authMiddleware, roleMiddleware("admin", "analyst"), async (req, res) => {
  try {
    const evidence = await Evidence.findById(req.params.id)
      .populate("uploader", "username fullName")
      .populate("caseId", "caseNumber title")
      .populate("tamperingHistory.detectedBy", "username fullName");

    if (!evidence) {
      return res.status(404).json({ error: "Evidence not found" });
    }

    if (!evidence.tamperingHistory || evidence.tamperingHistory.length === 0) {
      return res.status(400).json({ error: "No tampering history found" });
    }

    const doc = new PDFDocument({ margin: 50 });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="Tampering_' + evidence._id + '.pdf"');

    doc.pipe(res);

    doc.fontSize(24).font("Helvetica-Bold").fillColor("#dc2626").text("TAMPERING REPORT", { align: "center" });
    doc.fontSize(12).fillColor("#666").text("ForensiVault Digital Evidence Management", { align: "center" });
    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor("#dc2626").lineWidth(2).stroke();
    doc.moveDown();

    doc.fontSize(14).font("Helvetica-Bold").fillColor("#333").text("EVIDENCE DETAILS");
    doc.moveDown(0.5);
    doc.fontSize(10).font("Helvetica");
    doc.text("Evidence ID: " + evidence._id);
    doc.text("Filename: " + evidence.originalName);
    doc.text("Status: " + evidence.status.toUpperCase());
    doc.text("Original SHA-256: " + evidence.sha256);
    doc.text("Total Incidents: " + evidence.tamperingHistory.length);
    if (evidence.caseId) {
      doc.text("Case: " + evidence.caseId.caseNumber + " - " + evidence.caseId.title);
    }
    doc.moveDown();

    doc.fontSize(14).font("Helvetica-Bold").fillColor("#dc2626").text("TAMPERING INCIDENTS");
    doc.moveDown(0.5);

    evidence.tamperingHistory.forEach((incident, index) => {
      doc.fontSize(11).font("Helvetica-Bold").fillColor("#333");
      doc.text("Incident #" + (index + 1) + " - " + (incident.severity || "unknown").toUpperCase());
      doc.fontSize(9).font("Helvetica").fillColor("#555");
      doc.text("   Detected: " + new Date(incident.detectedAt).toLocaleString());
      doc.text("   By: " + (incident.detectedBy?.fullName || incident.detectedBy?.username || "Unknown"));
      doc.text("   Original Hash: " + (incident.originalHash || "N/A"));
      doc.text("   Current Hash: " + (incident.currentHash || "N/A"));
      if (incident.differences) {
        doc.text("   Summary: " + (incident.differences.summary || "Modified"));
        if (incident.differences.percentageChanged !== undefined) {
          doc.text("   Changed: " + incident.differences.percentageChanged + "%");
        }
      }
      doc.moveDown(0.5);
    });

    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor("#ccc").lineWidth(1).stroke();
    doc.moveDown();

    doc.fontSize(8).fillColor("#666").text("Generated: " + new Date().toLocaleString(), { align: "center" });
    doc.text("Official ForensiVault Tampering Report", { align: "center" });

    doc.end();

    await createLog("REPORT_GENERATED", req.user.id, {
      evidenceId: evidence._id,
      details: { reportType: "Tampering Report" },
    });
  } catch (err) {
    console.error("❌ Tampering Report Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// LOGS / AUDIT ROUTES
// ════════════════════════════════════════════════════════════════════════════

app.get("/api/logs", authMiddleware, roleMiddleware("admin"), async (req, res) => {
  try {
    const { action, userId, startDate, endDate, page = 1, limit = 50 } = req.query;
    let query = {};

    if (action) query.action = action;
    if (userId) query.userId = userId;
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    const total = await Log.countDocuments(query);
    const logs = await Log.find(query)
      .populate("userId", "username fullName")
      .populate("evidenceId", "originalName")
      .populate("caseId", "caseNumber title")
      .populate("targetUserId", "username fullName")
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    res.json({
      logs,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/logs/realtime", authMiddleware, roleMiddleware("admin"), async (req, res) => {
  try {
    const logs = await Log.find()
      .populate("userId", "username fullName")
      .sort({ timestamp: -1 })
      .limit(20);

    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/logs/stats", authMiddleware, roleMiddleware("admin"), async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const stats = await Log.aggregate([
      {
        $facet: {
          totalLogs: [{ $count: "count" }],
          todayLogs: [{ $match: { timestamp: { $gte: today } } }, { $count: "count" }],
          byAction: [{ $group: { _id: "$action", count: { $sum: 1 } } }],
          lastWeek: [
            { $match: { timestamp: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } },
            {
              $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
                count: { $sum: 1 },
              },
            },
            { $sort: { _id: 1 } },
          ],
        },
      },
    ]);

    res.json({
      totalLogs: stats[0].totalLogs[0]?.count || 0,
      todayLogs: stats[0].todayLogs[0]?.count || 0,
      byAction: stats[0].byAction,
      lastWeek: stats[0].lastWeek,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// DASHBOARD STATS
// ════════════════════════════════════════════════════════════════════════════

app.get("/api/stats", authMiddleware, async (req, res) => {
  try {
    const [
      totalCases,
      openCases,
      totalEvidence,
      pendingVerification,
      verifiedEvidence,
      tamperedEvidence,
      totalUsers,
      totalDiskImages,
      recentLogs,
    ] = await Promise.all([
      Case.countDocuments(),
      Case.countDocuments({ status: { $in: ["open", "in-progress"] } }),
      Evidence.countDocuments(),
      Evidence.countDocuments({ status: "pending" }),
      Evidence.countDocuments({ status: "verified" }),
      Evidence.countDocuments({ status: "tampered" }),
      User.countDocuments(),
      DiskImage.countDocuments(),
      Log.find().populate("userId", "username").sort({ timestamp: -1 }).limit(5),
    ]);

    res.json({
      cases: { total: totalCases, open: openCases },
      evidence: {
        total: totalEvidence,
        pending: pendingVerification,
        verified: verifiedEvidence,
        tampered: tamperedEvidence,
      },
      users: { total: totalUsers },
      diskImages: { total: totalDiskImages },
      recentActivity: recentLogs,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// SEARCH
// ════════════════════════════════════════════════════════════════════════════

app.get("/api/search", authMiddleware, async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim() === "") {
      return res.status(400).json({ error: "Search query required" });
    }

    const [cases, evidence] = await Promise.all([
      Case.find({
        $or: [
          { caseNumber: { $regex: q, $options: "i" } },
          { title: { $regex: q, $options: "i" } },
          { description: { $regex: q, $options: "i" } },
        ],
      })
        .select("caseNumber title status priority createdAt")
        .limit(10),
      Evidence.find({
        $or: [
          { originalName: { $regex: q, $options: "i" } },
          { description: { $regex: q, $options: "i" } },
        ],
      })
        .select("originalName fileType status uploadedAt caseId")
        .populate("caseId", "caseNumber")
        .limit(10),
    ]);

    await createLog("SEARCH", req.user.id, {
      details: { query: q, casesFound: cases.length, evidenceFound: evidence.length },
    });

    res.json({ cases, evidence });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// DISK IMAGE ROUTES
// ════════════════════════════════════════════════════════════════════════════

// Check Python service status
app.get("/api/disk-images/service-status", authMiddleware, async (req, res) => {
  try {
    const status = await pythonBridge.checkPythonService();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Upload disk image
app.post(
  "/api/disk-images/upload",
  authMiddleware,
  roleMiddleware("admin", "analyst"),
  diskImageUpload.single("diskImage"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No disk image file provided" });
      }

      const { caseId, description, tags } = req.body;
      const file = req.file;

      // Validate extension
      const ext = path.extname(file.originalname).toLowerCase();
      const allowedExtensions = [".img", ".raw", ".dd"];
      if (!allowedExtensions.includes(ext)) {
        fs.unlinkSync(file.path);
        return res.status(400).json({
          error: `Invalid file format. Allowed: ${allowedExtensions.join(", ")}`,
        });
      }

      // Rename file to include original name
      const newFilename = `${Date.now()}_${file.originalname}`;
      const newPath = path.join(diskImagesDir, newFilename);
      fs.renameSync(file.path, newPath);

      // Calculate hash
      const fileHash = await hashFile(newPath);

      // Create database record
      const diskImage = new DiskImage({
        originalName: file.originalname,
        storagePath: newPath,
        size: file.size,
        sizeFormatted: formatFileSize(file.size),
        sha256: fileHash,
        format: ext.replace(".", ""),
        uploadedBy: req.user.id,
        caseId: caseId || null,
        status: "processing",
        description,
        tags: tags ? tags.split(",").map((t) => t.trim()) : [],
      });

      await diskImage.save();

      // Log the upload
      await createLog("DISK_IMAGE_PARSED", req.user.id, {
        details: {
          filename: file.originalname,
          size: file.size,
          format: ext,
          action: "upload",
        },
      });

      // Start parsing in background
      (async () => {
        try {
          const serviceStatus = await pythonBridge.checkPythonService();
          if (!serviceStatus.running) {
            diskImage.status = "ready";
            diskImage.fileSystem = "unknown";
            await diskImage.save();
            console.log("Python service offline - setting disk image to ready");
            return;
          }

          try {
            const parseResult = await pythonBridge.parseDiskImage(newPath);

            // Sanitize fileSystem value to match schema enum
            const rawFs = (parseResult.data?.diskInfo?.fileSystem || "unknown").toLowerCase();
            const validFileSystems = ["ntfs", "fat32", "fat16", "exfat", "ext4", "ext3", "hfs", "unknown"];
            diskImage.fileSystem = validFileSystems.includes(rawFs) ? rawFs : "unknown";

            diskImage.parseResult = {
              diskInfo: parseResult.data?.diskInfo,
              parsedAt: new Date(),
            };
          } catch (parseErr) {
            console.log("Parse returned error (expected without pytsk3):", parseErr.message);
            diskImage.fileSystem = "unknown";
          }

          try {
            const statsResult = await pythonBridge.getDiskStats(newPath);
            if (diskImage.parseResult) {
              diskImage.parseResult.statistics = statsResult.data?.statistics;
            }
          } catch (statsErr) {
            console.log("Stats returned error (expected without pytsk3):", statsErr.message);
          }

          // Always set to ready
          diskImage.status = "ready";
          await diskImage.save();
          console.log("Disk image ready:", file.originalname);

        } catch (err) {
          console.error("Background parse error:", err.message);
          diskImage.status = "ready";
          diskImage.fileSystem = "unknown";
          diskImage.errorMessage = err.message;
          await diskImage.save();
          console.log("Set to ready despite error - carving will still work");
        }
      })();

      res.status(201).json({
        message: "Disk image uploaded successfully. Parsing in progress...",
        diskImage: {
          id: diskImage._id,
          originalName: diskImage.originalName,
          size: diskImage.size,
          sizeFormatted: diskImage.sizeFormatted,
          status: diskImage.status,
        },
      });
    } catch (err) {
      console.error("❌ Disk image upload error:", err);
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({ error: err.message });
    }
  }
);

// List all disk images
app.get("/api/disk-images", authMiddleware, roleMiddleware("admin", "analyst"), async (req, res) => {
  try {
    const { status, caseId, page = 1, limit = 10 } = req.query;
    let query = {};

    if (status) query.status = status;
    if (caseId) query.caseId = caseId;

    const total = await DiskImage.countDocuments(query);
    const diskImages = await DiskImage.find(query)
      .populate("uploadedBy", "username fullName")
      .populate("caseId", "caseNumber title")
      .sort({ uploadedAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    res.json({
      diskImages,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single disk image
app.get("/api/disk-images/:id", authMiddleware, roleMiddleware("admin", "analyst"), async (req, res) => {
  try {
    const diskImage = await DiskImage.findById(req.params.id)
      .populate("uploadedBy", "username fullName")
      .populate("caseId", "caseNumber title");

    if (!diskImage) {
      return res.status(404).json({ error: "Disk image not found" });
    }

    diskImage.lastAccessedAt = new Date();
    diskImage.lastAccessedBy = req.user.id;
    await diskImage.save();

    res.json(diskImage);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete disk image
app.delete("/api/disk-images/:id", authMiddleware, roleMiddleware("admin"), async (req, res) => {
  try {
    const diskImage = await DiskImage.findById(req.params.id);

    if (!diskImage) {
      return res.status(404).json({ error: "Disk image not found" });
    }

    try {
      await pythonBridge.closeDiskImage(diskImage.storagePath);
    } catch (e) {
      // Ignore if service not running
    }

    if (fs.existsSync(diskImage.storagePath)) {
      fs.unlinkSync(diskImage.storagePath);
    }

    await DiskImage.findByIdAndDelete(req.params.id);

    await createLog("DELETE", req.user.id, {
      details: {
        type: "disk_image",
        filename: diskImage.originalName,
      },
    });

    res.json({ message: "Disk image deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Browse files in disk image
app.post("/api/disk-images/:id/browse", authMiddleware, roleMiddleware("admin", "analyst"), async (req, res) => {
  try {
    const { directory = "/", recursive = false } = req.body;

    const diskImage = await DiskImage.findById(req.params.id);
    if (!diskImage) {
      return res.status(404).json({ error: "Disk image not found" });
    }

    if (diskImage.status !== "ready") {
      return res.status(400).json({ error: `Disk image is ${diskImage.status}` });
    }

    const result = await pythonBridge.listFiles(diskImage.storagePath, directory, recursive);

    res.json({
      diskImageId: diskImage._id,
      directory,
      ...result.data,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get file tree
app.post("/api/disk-images/:id/tree", authMiddleware, roleMiddleware("admin", "analyst"), async (req, res) => {
  try {
    const { maxDepth = 5 } = req.body;

    const diskImage = await DiskImage.findById(req.params.id);
    if (!diskImage) {
      return res.status(404).json({ error: "Disk image not found" });
    }

    if (diskImage.status !== "ready") {
      return res.status(400).json({ error: `Disk image is ${diskImage.status}` });
    }

    const result = await pythonBridge.getFileTree(diskImage.storagePath, maxDepth);

    res.json({
      diskImageId: diskImage._id,
      ...result.data,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get file info
app.post("/api/disk-images/:id/file/info", authMiddleware, roleMiddleware("admin", "analyst"), async (req, res) => {
  try {
    const { filePath } = req.body;

    if (!filePath) {
      return res.status(400).json({ error: "filePath is required" });
    }

    const diskImage = await DiskImage.findById(req.params.id);
    if (!diskImage) {
      return res.status(404).json({ error: "Disk image not found" });
    }

    const result = await pythonBridge.getFileInfo(diskImage.storagePath, filePath);

    res.json(result.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Preview file
app.post("/api/disk-images/:id/file/preview", authMiddleware, roleMiddleware("admin", "analyst"), async (req, res) => {
  try {
    const { filePath, maxSize = 10240 } = req.body;

    if (!filePath) {
      return res.status(400).json({ error: "filePath is required" });
    }

    const diskImage = await DiskImage.findById(req.params.id);
    if (!diskImage) {
      return res.status(404).json({ error: "Disk image not found" });
    }

    const result = await pythonBridge.getFilePreview(diskImage.storagePath, filePath, maxSize);

    res.json(result.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Extract file from disk image
app.post("/api/disk-images/:id/file/extract", authMiddleware, roleMiddleware("admin", "analyst"), async (req, res) => {
  try {
    const { filePath, addToEvidence = false, caseId = null } = req.body;

    if (!filePath) {
      return res.status(400).json({ error: "filePath is required" });
    }

    const diskImage = await DiskImage.findById(req.params.id);
    if (!diskImage) {
      return res.status(404).json({ error: "Disk image not found" });
    }

    const extractResult = await pythonBridge.extractFile(
      diskImage.storagePath,
      filePath,
      extractedDir
    );

    if (!extractResult.data?.success) {
      return res.status(400).json({ error: extractResult.data?.error || "Extraction failed" });
    }

    await createLog("FILE_EXTRACTED", req.user.id, {
      details: {
        diskImageId: diskImage._id,
        diskImageName: diskImage.originalName,
        sourcePath: filePath,
        extractedPath: extractResult.data.outputPath,
      },
    });

    let evidenceRecord = null;

    if (addToEvidence && extractResult.data.outputPath) {
      const extractedPath = extractResult.data.outputPath;
      const filename = path.basename(filePath);
      const fileHash = extractResult.data.hashes?.sha256 || await hashFile(extractedPath);

      const encryptedFilename = `${Date.now()}_${filename}.enc`;
      const encryptedPath = path.join(encryptedDir, encryptedFilename);
      await encryptFile(extractedPath, encryptedPath, AES_KEY, AES_IV);

      const stats = fs.statSync(extractedPath);

      evidenceRecord = new Evidence({
        originalName: filename,
        encryptedPath,
        size: stats.size,
        sha256: fileHash,
        mimeType: "application/octet-stream",
        fileType: "other",
        uploader: req.user.id,
        caseId: caseId || diskImage.caseId,
        description: `Extracted from disk image: ${diskImage.originalName}`,
        tags: ["extracted", "disk-image"],
        encryptionKey: AES_KEY.toString("hex"),
        encryptionIV: AES_IV.toString("hex"),
      });

      await evidenceRecord.save();

      if (caseId || diskImage.caseId) {
        const targetCaseId = caseId || diskImage.caseId;
        await Case.findByIdAndUpdate(targetCaseId, {
          $push: { evidenceFiles: evidenceRecord._id },
          updatedAt: new Date(),
        });
      }

      await createLog("UPLOAD", req.user.id, {
        evidenceId: evidenceRecord._id,
        caseId: caseId || diskImage.caseId,
        details: {
          filename: filename,
          size: stats.size,
          hash: fileHash,
          source: "disk_image_extraction",
          diskImageId: diskImage._id,
        },
      });

      fs.unlinkSync(extractedPath);
    }

    res.json({
      message: "File extracted successfully",
      extraction: extractResult.data,
      evidence: evidenceRecord
        ? {
            id: evidenceRecord._id,
            originalName: evidenceRecord.originalName,
            status: evidenceRecord.status,
          }
        : null,
    });
  } catch (err) {
    console.error("❌ Extract error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Search files in disk image
app.post("/api/disk-images/:id/search", authMiddleware, roleMiddleware("admin", "analyst"), async (req, res) => {
  try {
    const diskImage = await DiskImage.findById(req.params.id);
    if (!diskImage) {
      return res.status(404).json({ error: "Disk image not found" });
    }

    if (diskImage.status !== "ready") {
      return res.status(400).json({ error: `Disk image is ${diskImage.status}` });
    }

    const result = await pythonBridge.searchFiles(diskImage.storagePath, req.body);

    await createLog("SEARCH", req.user.id, {
      details: {
        type: "disk_image",
        diskImageId: diskImage._id,
        query: req.body.query,
        resultsCount: result.data?.resultCount || 0,
      },
    });

    res.json({
      diskImageId: diskImage._id,
      ...result.data,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Search content in disk image files
app.post("/api/disk-images/:id/search/content", authMiddleware, roleMiddleware("admin", "analyst"), async (req, res) => {
  try {
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({ error: "query is required" });
    }

    const diskImage = await DiskImage.findById(req.params.id);
    if (!diskImage) {
      return res.status(404).json({ error: "Disk image not found" });
    }

    if (diskImage.status !== "ready") {
      return res.status(400).json({ error: `Disk image is ${diskImage.status}` });
    }

    const result = await pythonBridge.searchContent(diskImage.storagePath, query, req.body);

    await createLog("ADVANCED_SEARCH", req.user.id, {
      details: {
        type: "disk_image_content",
        diskImageId: diskImage._id,
        query: query,
        resultsCount: result.data?.resultCount || 0,
      },
    });

    res.json({
      diskImageId: diskImage._id,
      ...result.data,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get disk image statistics
app.get("/api/disk-images/:id/stats", authMiddleware, roleMiddleware("admin", "analyst"), async (req, res) => {
  try {
    const diskImage = await DiskImage.findById(req.params.id);
    if (!diskImage) {
      return res.status(404).json({ error: "Disk image not found" });
    }

    if (diskImage.parseResult?.statistics) {
      return res.json({
        diskImageId: diskImage._id,
        statistics: diskImage.parseResult.statistics,
        cached: true,
      });
    }

    const result = await pythonBridge.getDiskStats(diskImage.storagePath);

    res.json({
      diskImageId: diskImage._id,
      ...result.data,
      cached: false,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// FILE CARVING ROUTES
// ═══════════════════════════════════════════════════════════════════════════

const carvedDir = path.join(__dirname, "carved");
if (!fs.existsSync(carvedDir)) fs.mkdirSync(carvedDir, { recursive: true });

// Start carving
app.post("/api/disk-images/:id/carve", authMiddleware, roleMiddleware("admin", "analyst"), async (req, res) => {
  try {
    const diskImage = await DiskImage.findById(req.params.id);
    if (!diskImage) return res.status(404).json({ error: "Disk image not found" });

    if (!fs.existsSync(diskImage.storagePath)) {
      return res.status(400).json({ error: "Disk image file not found on disk" });
    }

    const { fileTypes } = req.body;

    // Per-image output directory
    const outputDir = path.join(carvedDir, req.params.id);
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const result = await pythonBridge.startCarving(
      diskImage.storagePath,
      outputDir,
      fileTypes || null
    );

    // Update DB status
    diskImage.carvingStatus = "scanning";
    await diskImage.save();

    await createLog("FILE_CARVED", req.user.id, {
      details: {
        diskImageId: diskImage._id,
        diskImageName: diskImage.originalName,
        action: "carving_started",
        fileTypes: fileTypes || "all",
      },
    });

    // Background polling to update DB when done
    const poll = setInterval(async () => {
      try {
        const status = await pythonBridge.getCarvingStatus(diskImage.storagePath);
        if (status.data?.status === "complete") {
          clearInterval(poll);
          const resultsResp = await pythonBridge.getCarvingResults(diskImage.storagePath);
          const img = await DiskImage.findById(req.params.id);
          if (img) {
            img.carvingStatus = "complete";
            img.carvingResults = resultsResp.data;
            img.lastCarvedAt = new Date();
            await img.save();
          }
        } else if (status.data?.status === "error") {
          clearInterval(poll);
          const img = await DiskImage.findById(req.params.id);
          if (img) {
            img.carvingStatus = "error";
            img.errorMessage = status.data?.error;
            await img.save();
          }
        }
      } catch {
        clearInterval(poll);
      }
    }, 3000);

    res.json(result);
  } catch (err) {
    console.error("Carving start error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Carving status
app.get("/api/disk-images/:id/carve/status", authMiddleware, async (req, res) => {
  try {
    const diskImage = await DiskImage.findById(req.params.id);
    if (!diskImage) return res.status(404).json({ error: "Disk image not found" });

    const result = await pythonBridge.getCarvingStatus(diskImage.storagePath);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Carving results
app.get("/api/disk-images/:id/carve/results", authMiddleware, async (req, res) => {
  try {
    const diskImage = await DiskImage.findById(req.params.id);
    if (!diskImage) return res.status(404).json({ error: "Disk image not found" });

    // Try live results first, fall back to DB cache
    try {
      const result = await pythonBridge.getCarvingResults(diskImage.storagePath);
      return res.json(result);
    } catch {
      if (diskImage.carvingResults) {
        return res.json({ success: true, data: diskImage.carvingResults });
      }
      return res.status(400).json({ error: "No carving results available" });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Compare carved file hashes with stored evidence
app.post("/api/disk-images/:id/carve/compare", authMiddleware, roleMiddleware("admin", "analyst"), async (req, res) => {
  try {
    const { hashes } = req.body;

    if (!hashes || !Array.isArray(hashes) || hashes.length === 0) {
      return res.status(400).json({ error: "hashes array is required" });
    }

    // Find evidence that matches any of these hashes
    const matches = await Evidence.find({ sha256: { $in: hashes } })
      .select("originalName sha256 status fileType caseId uploadedAt size")
      .populate("caseId", "caseNumber title");

    const matchMap = {};
    matches.forEach((ev) => {
      matchMap[ev.sha256] = {
        evidenceId: ev._id,
        originalName: ev.originalName,
        status: ev.status,
        fileType: ev.fileType,
        size: ev.size,
        caseNumber: ev.caseId?.caseNumber || null,
        caseTitle: ev.caseId?.title || null,
        uploadedAt: ev.uploadedAt,
      };
    });

    const results = hashes.map((h) => ({
      sha256: h,
      matched: !!matchMap[h],
      evidence: matchMap[h] || null,
    }));

    await createLog("CARVING_COMPARISON", req.user.id, {
      details: {
        diskImageId: req.params.id,
        totalHashes: hashes.length,
        matchesFound: matches.length,
      },
    });

    res.json({
      totalFiles: hashes.length,
      matchesFound: matches.length,
      unmatched: hashes.length - matches.length,
      results,
    });
  } catch (err) {
    console.error("Carving compare error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// FORENSIC ANALYSIS ROUTES
// ═══════════════════════════════════════════════════════════════════════════

// Analyze carved files for tampering (standalone — no comparison needed)
app.post("/api/disk-images/:id/carve/analyze", authMiddleware, roleMiddleware("admin", "analyst"), async (req, res) => {
  try {
    const diskImage = await DiskImage.findById(req.params.id);
    if (!diskImage) return res.status(404).json({ error: "Disk image not found" });

    const { filenames } = req.body;
    const imageCarvedDir = path.join(carvedDir, req.params.id);

    if (!fs.existsSync(imageCarvedDir)) {
      return res.status(400).json({ error: "No carved files found. Run carving first." });
    }

    // Get list of files to analyze
    let filesToAnalyze = [];

    if (filenames && Array.isArray(filenames) && filenames.length > 0) {
      filesToAnalyze = filenames.map((f) => path.join(imageCarvedDir, f));
    } else {
      // Analyze all carved files
      const allFiles = fs.readdirSync(imageCarvedDir);
      filesToAnalyze = allFiles.map((f) => path.join(imageCarvedDir, f));
    }

    // Send to Python for analysis
    const result = await pythonBridge.analyzeBatch(filesToAnalyze);

    await createLog("FILE_CARVED", req.user.id, {
      details: {
        diskImageId: diskImage._id,
        action: "forensic_analysis",
        filesAnalyzed: filesToAnalyze.length,
      },
    });

    res.json(result);
  } catch (err) {
    console.error("Analysis error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// ADD CARVED FILE TO EVIDENCE / CASE
// ═══════════════════════════════════════════════════════════════════════════

app.post("/api/disk-images/:id/carve/add-to-evidence", authMiddleware, roleMiddleware("admin", "analyst"), async (req, res) => {
  try {
    const { filename, caseId, description, tags } = req.body;

    if (!filename) {
      return res.status(400).json({ error: "filename is required" });
    }

    const diskImage = await DiskImage.findById(req.params.id);
    if (!diskImage) return res.status(404).json({ error: "Disk image not found" });

    const carvedFilePath = path.join(carvedDir, req.params.id, filename);
    if (!fs.existsSync(carvedFilePath)) {
      return res.status(404).json({ error: "Carved file not found: " + filename });
    }

    // If caseId provided, verify it exists
    if (caseId) {
      const caseData = await Case.findById(caseId);
      if (!caseData) {
        return res.status(404).json({ error: "Case not found" });
      }
    }

    // Read file
    const fileBuffer = fs.readFileSync(carvedFilePath);
    const fileHash = crypto.createHash("sha256").update(fileBuffer).digest("hex");
    const fileSize = fileBuffer.length;

    // Determine mime type from extension
    const ext = path.extname(filename).toLowerCase();
    const mimeMap = {
      '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
      '.gif': 'image/gif', '.bmp': 'image/bmp', '.pdf': 'application/pdf',
      '.txt': 'text/plain', '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.zip': 'application/zip', '.mp3': 'audio/mpeg', '.avi': 'video/x-msvideo',
    };
    const mimeType = mimeMap[ext] || 'application/octet-stream';

    // Extract content for future tamper detection
    let originalContent = null;
    try {
      originalContent = extractContent(carvedFilePath, mimeType);
    } catch (e) {
      console.log("Content extraction warning:", e.message);
    }

    // Encrypt the file
    const encryptedFilename = crypto.randomBytes(16).toString("hex") + ".enc";
    const encryptedPath = path.join(encryptedDir, encryptedFilename);
    await encryptFile(carvedFilePath, encryptedPath, AES_KEY, AES_IV);

    // Create evidence record
    const evidence = new Evidence({
      originalName: filename,
      encryptedPath,
      size: fileSize,
      sha256: fileHash,
      mimeType: mimeType,
      fileType: getFileType(mimeType),
      uploader: req.user.id,
      caseId: caseId || null,
      uploadedAt: new Date(),
      encryptionKey: AES_KEY.toString("hex"),
      encryptionIV: AES_IV.toString("hex"),
      description: description || `Carved from disk image: ${diskImage.originalName}`,
      tags: tags ? (Array.isArray(tags) ? tags : tags.split(",").map((t) => t.trim())) : ["carved", "disk-image", "recovered"],
      originalContent: originalContent,
      tamperingHistory: [],
    });

    await evidence.save();

    // Link to case if provided
    if (caseId) {
      await Case.findByIdAndUpdate(caseId, {
        $push: { evidenceFiles: evidence._id },
        updatedAt: new Date(),
      });
    }

    // Log
    await createLog("UPLOAD", req.user.id, {
      evidenceId: evidence._id,
      caseId: caseId || null,
      details: {
        filename: filename,
        size: fileSize,
        hash: fileHash,
        source: "file_carving",
        diskImageId: diskImage._id,
        diskImageName: diskImage.originalName,
      },
    });

    res.status(201).json({
      message: "File added to evidence successfully",
      evidence: {
        id: evidence._id,
        originalName: evidence.originalName,
        size: evidence.size,
        sha256: evidence.sha256,
        fileType: evidence.fileType,
        status: evidence.status,
        caseId: caseId || null,
      },
    });
  } catch (err) {
    console.error("Add to evidence error:", err);
    res.status(500).json({ error: err.message });
  }
});


// ════════════════════════════════════════════════════════════════════════════
// HEALTH CHECK
// ════════════════════════════════════════════════════════════════════════════

app.get("/health", (req, res) => {
  res.json({
    status: "Server is running",
    timestamp: new Date(),
    features: {
      tamperingDetection: true,
      diskImageParsing: true,
      encryption: "AES-256-CBC",
      hashing: "SHA-256",
    },
  });
});

// ════════════════════════════════════════════════════════════════════════════
// ERROR HANDLING
// ════════════════════════════════════════════════════════════════════════════

app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

app.use((err, req, res, next) => {
  console.error("❌ Error:", err);
  res.status(err.status || 500).json({ error: err.message || "Internal server error" });
});

// ════════════════════════════════════════════════════════════════════════════
// START SERVER
// ════════════════════════════════════════════════════════════════════════════

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("╔════════════════════════════════════════════════════════╗");
  console.log("║         🔐 ForensiVault Server Started                 ║");
  console.log("║   Running on http://localhost:" + PORT + "                    ║");
  console.log("║   Tampering Detection: ENABLED                         ║");
  console.log("║   Disk Image Parsing: ENABLED                          ║");
  console.log("╚════════════════════════════════════════════════════════╝");
});

module.exports = app;
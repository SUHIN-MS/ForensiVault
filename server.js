const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const fs = require("fs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const cors = require("cors");
const PDFDocument = require("pdfkit");
const { Evidence, Log, User } = require("./models");

const app = express();
const upload = multer({ dest: "uploads/" });
app.use(express.json());
app.use(cors());

// Connect MongoDB
mongoose.connect("mongodb://127.0.0.1:27017/forensivault");

// AES-256 key & IV (temporary demo)
const AES_KEY = crypto.randomBytes(32);
const AES_IV = crypto.randomBytes(16);

// Secret key for JWT
const JWT_SECRET = "supersecretkey"; // change in production

// Auth middleware
function authMiddleware(req, res, next) {
  const token = req.headers["authorization"];
  if (!token) return res.status(401).json({ error: "No token provided" });

  try {
    const decoded = jwt.verify(token.split(" ")[1], JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

// Blockchain log helper
async function createLog(action, fileId, extra = {}) {
  const lastLog = await Log.findOne().sort({ index: -1 });
  const prevHash = lastLog ? lastLog.entryHash : "GENESIS";
  const index = lastLog ? lastLog.index + 1 : 0;

  const payload = JSON.stringify({ index, action, fileId, ...extra, timestamp: new Date() });
  const entryHash = crypto.createHash("sha256").update(prevHash + payload).digest("hex");

  const log = new Log({ index, action, fileId, prevHash, entryHash });
  await log.save();
  return log;
}

// ---------------- AUTH ROUTES ---------------- //
app.post("/signup", async (req, res) => {
  const { username, password, role } = req.body;
  const hashed = await bcrypt.hash(password, 10);

  try {
    const user = new User({ username, password: hashed, role });
    await user.save();
    res.json({ message: "User created" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user) return res.status(400).json({ error: "User not found" });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(400).json({ error: "Invalid password" });

  const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: "1h" });
  res.json({ token });
});

// ---------------- EVIDENCE ROUTES ---------------- //
app.post("/upload", authMiddleware, upload.single("file"), async (req, res) => {
  const file = req.file;

  // Encrypt file
  const input = fs.createReadStream(file.path);
  const cipher = crypto.createCipheriv("aes-256-cbc", AES_KEY, AES_IV);
  const encryptedPath = `encrypted/${file.filename}.enc`;
  const output = fs.createWriteStream(encryptedPath);
  input.pipe(cipher).pipe(output);

  // Hash file
  const fileBuffer = fs.readFileSync(file.path);
  const sha256 = crypto.createHash("sha256").update(fileBuffer).digest("hex");

  // Save metadata
  const evidence = new Evidence({
    originalName: file.originalname,
    encryptedPath,
    size: file.size,
    sha256
  });
  await evidence.save();

  // Log
  const log = await createLog("UPLOAD", evidence._id);

  res.json({ message: "File uploaded securely", evidence, log });
});

app.post("/verify/:id", authMiddleware, async (req, res) => {
  try {
    const evidence = await Evidence.findById(req.params.id);
    if (!evidence) return res.status(404).json({ error: "Evidence not found" });

    const encryptedPath = evidence.encryptedPath;
    const originalPath = encryptedPath.replace("encrypted", "uploads").replace(".enc", "");
    if (!fs.existsSync(originalPath)) {
      return res.status(400).json({ error: "Original file not available for verification" });
    }

    const fileBuffer = fs.readFileSync(originalPath);
    const computedHash = crypto.createHash("sha256").update(fileBuffer).digest("hex");
    const match = computedHash === evidence.sha256;

    const log = await createLog("VERIFY", evidence._id, { result: match });

    res.json({ evidenceId: evidence._id, storedHash: evidence.sha256, computedHash, match, log });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------- LOGS & REPORTS ---------------- //
app.get("/logs", authMiddleware, async (req, res) => {
  const logs = await Log.find();
  res.json(logs);
});

app.get("/report/:id", authMiddleware, async (req, res) => {
  const evidence = await Evidence.findById(req.params.id);
  if (!evidence) return res.status(404).json({ error: "Not found" });

  const logs = await Log.find({ fileId: evidence._id });

  // Generate PDF
  const doc = new PDFDocument();
  res.setHeader("Content-Type", "application/pdf");
  doc.pipe(res);

  doc.fontSize(18).text("Chain of Custody Report", { align: "center" });
  doc.moveDown();
  doc.fontSize(12).text(`Evidence: ${evidence.originalName}`);
  doc.text(`SHA-256: ${evidence.sha256}`);
  doc.text(`Size: ${evidence.size} bytes`);
  doc.text(`Uploaded: ${evidence.uploadedAt}`);
  doc.moveDown();

  doc.fontSize(14).text("Logs:");
  logs.forEach(log => {
    doc.text(`${log.timestamp}: ${log.action} → ${log.entryHash}`);
  });

  doc.end();
});

// -----------------------------
// NEW FEATURE: Search by filename
// -----------------------------
app.get("/search", async (req, res) => {
  const { filename } = req.query;
  console.log("🔎 Search query received:", filename); // <-- DEBUG

  if (!filename || filename.trim() === "") {
    return res.status(400).json({ message: "Filename query parameter is required" });
  }

  try {
    const results = await Evidence.find({
      filename: { $regex: filename, $options: "i" }, // partial + case-insensitive
    });

    console.log("📂 Search results from DB:", results); // <-- DEBUG
    res.json(results);
  } catch (err) {
    console.error("❌ Search error:", err);
    res.status(500).json({ message: "Error searching files" });
  }
});



app.listen(3000, () => console.log("Server running on http://localhost:3000"));

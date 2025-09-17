const express = require("express");
const multer = require("multer");
const crypto = require("crypto");
const mongoose = require("mongoose");

const app = express();
const upload = multer({ dest: "uploads/" });

// MongoDB connection
mongoose.connect("mongodb://127.0.0.1:27017/forensic_demo", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Schemas
const FileSchema = new mongoose.Schema({
  filename: String,
  hash: String,
});

const LogSchema = new mongoose.Schema({
  action: String,
  timestamp: Date,
  prevHash: String,
  currentHash: String,
});

const File = mongoose.model("File", FileSchema);
const Log = mongoose.model("Log", LogSchema);

// Helper: create blockchain-style hash
function createLogHash(prevHash, action, timestamp) {
  return crypto
    .createHash("sha256")
    .update(prevHash + action + timestamp)
    .digest("hex");
}

// Upload route
app.post("/upload", upload.single("file"), async (req, res) => {
  const fileBuffer = require("fs").readFileSync(req.file.path);
  const hash = crypto.createHash("sha256").update(fileBuffer).digest("hex");

  const file = new File({ filename: req.file.originalname, hash });
  await file.save();

  // Blockchain log
  const lastLog = await Log.findOne().sort({ _id: -1 });
  const prevHash = lastLog ? lastLog.currentHash : "GENESIS";
  const timestamp = new Date();
  const currentHash = createLogHash(prevHash, "UPLOAD " + req.file.originalname, timestamp);

  const log = new Log({
    action: "UPLOAD " + req.file.originalname,
    timestamp,
    prevHash,
    currentHash,
  });
  await log.save();

  res.json({ filename: req.file.originalname, hash });
});

// Show logs
app.get("/logs", async (req, res) => {
  const logs = await Log.find();
  res.json(logs);
});

app.listen(3000, () => console.log("Server running on http://localhost:3000"));

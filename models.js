const mongoose = require("mongoose");

// Evidence Schema
const evidenceSchema = new mongoose.Schema({
  originalName: String,
  encryptedPath: String,
  size: Number,
  sha256: String,
  uploadedAt: { type: Date, default: Date.now }
});

// Log Schema
const logSchema = new mongoose.Schema({
  index: Number,
  action: String,
  fileId: mongoose.Schema.Types.ObjectId,
  timestamp: { type: Date, default: Date.now },
  prevHash: String,
  entryHash: String
});

// User Schema
const userSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  password: String, // hashed
  role: { type: String, enum: ["admin", "officer", "analyst"], default: "officer" }
});

module.exports = {
  Evidence: mongoose.model("Evidence", evidenceSchema),
  Log: mongoose.model("Log", logSchema),
  User: mongoose.model("User", userSchema)
};

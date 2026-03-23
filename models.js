// ═══════════════════════════════════════════════════════════════════════════
// FILE: forensivault/models.js
// PURPOSE: MongoDB schemas - with tampering detection and file carving
// ═══════════════════════════════════════════════════════════════════════════

const mongoose = require("mongoose");

// ═══════════════════════════════════════════════════════════════════════════
// CASE SCHEMA
// ═══════════════════════════════════════════════════════════════════════════

const caseSchema = new mongoose.Schema({
  caseNumber: { type: String, unique: true, required: true },
  title: { type: String, required: true },
  description: String,
  status: {
    type: String,
    enum: ["open", "in-progress", "closed", "archived"],
    default: "open",
  },
  priority: {
    type: String,
    enum: ["low", "medium", "high", "critical"],
    default: "medium",
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  assignedTo: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  evidenceFiles: [{ type: mongoose.Schema.Types.ObjectId, ref: "Evidence" }],
  tags: [String],
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now },
  closedAt: Date,
});

caseSchema.index({ caseNumber: 1 });
caseSchema.index({ status: 1 });

// ═══════════════════════════════════════════════════════════════════════════
// EVIDENCE SCHEMA
// ═══════════════════════════════════════════════════════════════════════════

const evidenceSchema = new mongoose.Schema({
  originalName: { type: String, required: true },
  encryptedPath: { type: String, required: true },
  size: { type: Number, required: true },
  sha256: { type: String, required: true },
  mimeType: String,
  fileType: {
    type: String,
    enum: ["document", "image", "video", "audio", "other"],
    default: "other",
  },
  uploader: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  caseId: { type: mongoose.Schema.Types.ObjectId, ref: "Case" },
  uploadedAt: { type: Date, default: Date.now, index: true },
  encryptionKey: String,
  encryptionIV: String,
  status: {
    type: String,
    enum: ["pending", "verified", "tampered", "archived"],
    default: "pending",
  },
  lastVerifiedAt: Date,
  lastVerifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  verificationCount: { type: Number, default: 0 },
  description: String,
  tags: [String],

  originalContent: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },

  tamperingHistory: [
    {
      detectedAt: { type: Date, default: Date.now },
      detectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      originalHash: String,
      currentHash: String,
      differences: mongoose.Schema.Types.Mixed,
      severity: {
        type: String,
        enum: ["low", "medium", "high", "critical"],
        default: "medium",
      },
    },
  ],
});

evidenceSchema.index({ uploadedAt: -1 });
evidenceSchema.index({ uploader: 1 });
evidenceSchema.index({ caseId: 1 });
evidenceSchema.index({ status: 1 });
evidenceSchema.index({ sha256: 1 });

// ═══════════════════════════════════════════════════════════════════════════
// LOG SCHEMA
// ═══════════════════════════════════════════════════════════════════════════

const logSchema = new mongoose.Schema({
  index: { type: Number, unique: true, sparse: true },
  action: {
    type: String,
    enum: [
      "UPLOAD",
      "VERIFY",
      "SEARCH",
      "ADVANCED_SEARCH",
      "DOWNLOAD",
      "REPORT_GENERATED",
      "DELETE",
      "CASE_CREATED",
      "CASE_UPDATED",
      "CASE_CLOSED",
      "USER_CREATED",
      "USER_UPDATED",
      "USER_DELETED",
      "LOGIN",
      "LOGOUT",
      "PASSWORD_RESET",
      "TAMPERING_DETECTED",
      "DISK_IMAGE_PARSED",
      "FILE_EXTRACTED",
      "FILE_CARVED",
      "CARVING_COMPARISON",
    ],
    required: true,
  },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  evidenceId: { type: mongoose.Schema.Types.ObjectId, ref: "Evidence", default: null },
  caseId: { type: mongoose.Schema.Types.ObjectId, ref: "Case", default: null },
  targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  details: { type: mongoose.Schema.Types.Mixed, default: {} },
  ipAddress: String,
  userAgent: String,
  payload: String,
  previousHash: { type: String, default: "GENESIS" },
  entryHash: { type: String, unique: true },
  timestamp: { type: Date, default: Date.now, index: true },
  tamperingDetails: { type: mongoose.Schema.Types.Mixed, default: null },
});

logSchema.index({ userId: 1, timestamp: -1 });
logSchema.index({ evidenceId: 1 });
logSchema.index({ caseId: 1 });
logSchema.index({ action: 1 });

// ═══════════════════════════════════════════════════════════════════════════
// USER SCHEMA
// ═══════════════════════════════════════════════════════════════════════════

const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true, index: true },
  password: { type: String, required: true },
  email: { type: String, unique: true, sparse: true },
  fullName: String,
  role: {
    type: String,
    enum: ["admin", "officer", "analyst"],
    default: "officer",
    index: true,
  },
  status: {
    type: String,
    enum: ["active", "inactive", "suspended"],
    default: "active",
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  lastLogin: Date,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  department: String,
  phone: String,
});

// ═══════════════════════════════════════════════════════════════════════════
// DISK IMAGE SCHEMA
// ═══════════════════════════════════════════════════════════════════════════

const diskImageSchema = new mongoose.Schema({
  originalName: { type: String, required: true },
  storagePath: { type: String, required: true },
  size: { type: Number, required: true },
  sizeFormatted: String,
  sha256: String,
  format: {
    type: String,
    enum: ["raw", "img", "dd", "e01", "vmdk", "vhd"],
    default: "raw",
  },
  fileSystem: {
    type: String,
    enum: ["ntfs", "fat32", "fat16", "exfat", "ext4", "ext3", "hfs", "unknown"],
    default: "unknown",
  },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  uploadedAt: { type: Date, default: Date.now },
  status: {
    type: String,
    enum: ["uploading", "processing", "parsing", "ready", "error"],
    default: "uploading",
  },
  caseId: { type: mongoose.Schema.Types.ObjectId, ref: "Case" },
  parseResult: mongoose.Schema.Types.Mixed,
  description: String,
  tags: [String],
  errorMessage: String,
  lastAccessedAt: Date,
  lastAccessedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

  // File Carving fields
  carvingStatus: {
    type: String,
    enum: ["idle", "scanning", "extracting", "complete", "error"],
    default: "idle",
  },
  carvingResults: mongoose.Schema.Types.Mixed,
  lastCarvedAt: Date,
});

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

module.exports = {
  Case: mongoose.model("Case", caseSchema),
  Evidence: mongoose.model("Evidence", evidenceSchema),
  Log: mongoose.model("Log", logSchema),
  User: mongoose.model("User", userSchema),
  DiskImage: mongoose.model("DiskImage", diskImageSchema),
};
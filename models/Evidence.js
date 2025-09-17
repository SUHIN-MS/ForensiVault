import mongoose from "mongoose";

const EvidenceSchema = new mongoose.Schema({
  filename: String,
  hash: String,
  uploader: String,
  timestamp: { type: Date, default: Date.now },
});

export default mongoose.model("Evidence", EvidenceSchema);

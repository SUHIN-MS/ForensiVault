import mongoose from "mongoose";

const LogSchema = new mongoose.Schema({
  action: String,
  evidenceId: { type: mongoose.Schema.Types.ObjectId, ref: "Evidence", default: null },
  timestamp: { type: Date, default: Date.now },
});

export default mongoose.model("Log", LogSchema);

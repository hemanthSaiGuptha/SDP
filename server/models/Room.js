import mongoose from "mongoose";

const FileSchema = new mongoose.Schema({
  name: { type: String, required: true },
  content: { type: String, default: "" },
});

const RoomSchema = new mongoose.Schema({
  roomId: { type: String, required: true, unique: true },
  files: [FileSchema],
  updatedAt: { type: Date, default: Date.now },
});

export default mongoose.model("Room", RoomSchema);

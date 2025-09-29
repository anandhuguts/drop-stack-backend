import mongoose from "mongoose";

const RigSchema = new mongoose.Schema({
  name: { type: String, required: true },
  location: { type: String },
});

export default mongoose.model("Rig", RigSchema);

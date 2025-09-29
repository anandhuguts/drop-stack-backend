import mongoose from "mongoose";

const inspectorSchema = new mongoose.Schema({
  name: { type: String, required: true },
  specialties: [{ type: String }],
});

const Inspector = mongoose.model("Inspector", inspectorSchema);
export default Inspector;

import mongoose from 'mongoose';

const AlertSchema = new mongoose.Schema({
  type: { type: String, required: true },
  description: { type: String, required: true },
  confidence: { type: Number, required: true },
  timestamp: { type: Date, required: true },
  affectedServices: { type: [String] },
  rootCause: { type: String }
}, { timestamps: true });

export const AlertModel = mongoose.model('Alert', AlertSchema);
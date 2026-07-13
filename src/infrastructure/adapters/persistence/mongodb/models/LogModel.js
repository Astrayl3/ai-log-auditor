import mongoose from 'mongoose';

const LogSchema = new mongoose.Schema({
  timestamp: { type: Date, required: true, index: true },
  level: { type: String, required: true },
  service: { type: String, required: true, index: true },
  message: { type: String, required: true },
  metadata: { type: mongoose.Schema.Types.Mixed }, // Lưu object JSON tự do
  vector: { type: [Number] } // Lưu mảng số để phục vụ AI
}, { timestamps: true });

export const LogModel = mongoose.model('Log', LogSchema);
import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Import Adapter và Use Case
import { MongoLogRepository } from './infrastructure/adapters/persistence/mongodb/MongoLogRepository.js';
import { GeminiAdapter } from './infrastructure/adapters/ai/GeminiAdapter.js';
import { IngestLogUseCase } from './application/use-cases/IngestLogUseCase.js';

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

//Kết nối cơ sở dữ liệu
await mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Đã kết nối thành công tới MongoDB'))
  .catch(err => {
    console.error('Lỗi kết nối MongoDB:', err);
    process.exit(1);
  });

//Khởi tạo các Adapters (Dependency Injection)
const logRepositoryAdapter = new MongoLogRepository();

// AI Adapter
const aiAnalysisAdapter = new GeminiAdapter(process.env.GEMINI_API_KEY);

//Khởi tạo Use Case và inject Adapter
const ingestLogUseCase = new IngestLogUseCase({
  logRepository: logRepositoryAdapter,
  aiAnalysisService: aiAnalysisAdapter,
  notificationAdapter: null 
});

//Mở API Endpoint để nhận Log
app.post('/api/logs', async (req, res) => {
  try {
    const result = await ingestLogUseCase.execute(req.body);
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`API tiếp nhận Log đang chạy tại: http://localhost:${PORT}/api/logs`);
});
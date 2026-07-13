import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Import Adapter và Use Case
import { MongoLogRepository } from './infrastructure/adapters/persistence/mongodb/MongoLogRepository.js';
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

// Mock tạm một AI Adapter để test luồng (sẽ làm thật ở bước sau)
const mockAIAnalysisService = {
  generateEmbedding: async (text) => [0.1, 0.2, 0.3], // Giả lập vector
  detectAnomaly: async (log, recentLogs) => {
    // Giả lập logic: Nếu log là 'error' và có nhiều hơn 5 lỗi gần đây thì báo động
    const isError = log.level === 'error';
    const hasManyRecentErrors = recentLogs.length > 5;
    if (isError && hasManyRecentErrors) {
      return {
        isAnomaly: true,
        description: 'Phát hiện chuỗi lỗi liên tục',
        confidence: 0.9,
        rootCause: 'Khả năng cao do nghẽn cổ chai tại database'
      };
    }
    return { isAnomaly: false };
  }
};

//Khởi tạo Use Case và "bơm" (inject) Adapter vào
const ingestLogUseCase = new IngestLogUseCase({
  logRepository: logRepositoryAdapter,
  aiAnalysisService: mockAIAnalysisService,
  notificationAdapter: null // Tạm thời để null
});

//Mở API Endpoint để nhận Log
app.post('/api/logs', async (req, res) => {
  try {
    // Truyền dữ liệu thô từ Request vào Use Case
    const result = await ingestLogUseCase.execute(req.body);
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`API tiếp nhận Log đang chạy tại: http://localhost:${PORT}/api/logs`);
});
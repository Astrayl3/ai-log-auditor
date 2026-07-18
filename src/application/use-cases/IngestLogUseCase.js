import { LogEntry } from '../../domain/entities/LogEntry.js';
import { AnomalyAlert } from '../../domain/entities/AnomalyAlert.js';

export class IngestLogUseCase {
  // Dependency Injection: Truyền các Ports vào qua Constructor
  constructor({ logRepository, aiAnalysisService, notificationAdapter }) {
    this.logRepository = logRepository;
    this.aiAnalysisService = aiAnalysisService;
    this.notificationAdapter = notificationAdapter; // Cổng gửi tin nhắn (Telegram/Discord) nếu có
  }

  async execute(rawLogData) {
    try {
      //Trích xuất dữ liệu thô (Giả định dữ liệu đã qua một lớp parse cơ bản)
      const { message, service, level, metadata } = rawLogData;

      if (!message) {
        throw new Error('Nội dung log (message) không được để trống.');
      }

      //Gọi AI Port để tạo Vector Embedding từ chuỗi text của log
      //Phục vụ cho việc tìm kiếm ngữ nghĩa hoặc phân cụm sau này
      const vector = await this.aiAnalysisService.generateEmbedding(message);

      //Khởi tạo thực thể LogEntry từ tầng Domain
      const logEntry = new LogEntry({
        timestamp: new Date(),
        level,
        service,
        message,
        metadata,
        vector
      });

      //Lấy danh sách log trong quá khứ gần đây (Sliding Window)
      //Để AI có ngữ cảnh (Context) phân tích hành vi hệ thống
      const recentLogs = await this.logRepository.findByTimeWindow(logEntry.service, 15);

      //Gọi AI Port để kiểm tra xem dòng log hiện tại có bất thường không dựa trên ngữ cảnh
      const anomalyResult = await this.aiAnalysisService.detectAnomaly(logEntry, recentLogs);
      console.log('AI analysis result:', JSON.stringify(anomalyResult, null, 2));

      let alert = null;
      
      //Nếu AI phát hiện bất thường, tạo thực thể AnomalyAlert
      if (anomalyResult && anomalyResult.isAnomaly) {
        alert = new AnomalyAlert({
          type: 'System Anomaly',
          description: anomalyResult.description,
          confidence: anomalyResult.confidence,
          affectedServices: [logEntry.service],
          rootCause: anomalyResult.rootCause
        });

        // Quy tắc nghiệp vụ từ Domain: Nếu độ tin cậy cao, kích hoạt thông báo khẩn cấp
        if (alert.shouldTriggerUrgentNotification() && this.notificationAdapter) {
          await this.notificationAdapter.send(`PHÁT HIỆN BẤT THƯỜNG KHẨN CẤP: ${alert.description} (Độ chính xác: ${alert.confidence * 100}%)`);
        }
        
        // Lưu cảnh báo bất thường thông qua Repository Port
        await this.logRepository.saveAlert(alert);
      }

      //Luôn lưu dòng log hiện tại vào hệ thống lưu trữ lâu dài
      await this.logRepository.save(logEntry);

      return {
        success: true,
        logId: logEntry.id,
        hasAnomaly: !!alert,
        alertId: alert ? alert.id : null
      };

    } catch (error) {
      console.error('Thất bại trong Use Case IngestLog:', error.message);
      throw error;
    }
  }
}
import { LogRepositoryPort } from '../../../../domain/repositories/LogRepositoryPort.js';
import { LogModel } from './models/LogModel.js';
import { AlertModel } from './models/AlertModel.js';
import { LogEntry } from '../../../../domain/entities/LogEntry.js';

// Kế thừa Port từ tầng Domain để đảm bảo tuân thủ đúng "hợp đồng"
export class MongoLogRepository extends LogRepositoryPort {
  
  // Lưu log vào database
  async save(logEntry) {
    const newLogDocument = new LogModel({
      timestamp: logEntry.timestamp,
      level: logEntry.level,
      service: logEntry.service,
      message: logEntry.message,
      metadata: logEntry.metadata,
      vector: logEntry.vector
    });

    const savedDoc = await newLogDocument.save();
    
    // Gán lại ID từ DB (MongoDB tự tạo _id) vào thực thể Domain
    logEntry.id = savedDoc._id.toString();
    return logEntry;
  }

  // Lấy các log gần đây nhất trong N phút (Dùng cho AI Context)
  async findByTimeWindow(service, minutes) {
    const timeLimit = new Date(Date.now() - minutes * 60 * 1000);

    const logDocuments = await LogModel.find({
      service: service,
      timestamp: { $gte: timeLimit } // $gte: Greater than or equal (Lớn hơn hoặc bằng)
    }).sort({ timestamp: -1 }); // Lấy mới nhất xếp trước

    // Cực kỳ quan trọng: Biến đổi Mongoose Document ngược lại thành Domain Entity
    return logDocuments.map(doc => new LogEntry({
      id: doc._id.toString(),
      timestamp: doc.timestamp,
      level: doc.level,
      service: doc.service,
      message: doc.message,
      metadata: doc.metadata,
      vector: doc.vector
    }));
  }

  // Lưu cảnh báo
  async saveAlert(anomalyAlert) {
    const newAlertDoc = new AlertModel({
      type: anomalyAlert.type,
      description: anomalyAlert.description,
      confidence: anomalyAlert.confidence,
      timestamp: anomalyAlert.timestamp,
      affectedServices: anomalyAlert.affectedServices,
      rootCause: anomalyAlert.rootCause
    });

    const savedAlert = await newAlertDoc.save();
    anomalyAlert.id = savedAlert._id.toString();
    return anomalyAlert;
  }
}
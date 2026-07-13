export class AIAnalysisPort {
  // Chuyển đổi text của log thành một mảng số (Vector)
  async generateEmbedding(text) {
    throw new Error('Phương thức generateEmbedding() chưa được cài đặt!');
  }

  // Dựa vào dòng log hiện tại và lịch sử log gần đây để phát hiện hành vi lạ
  async detectAnomaly(currentLog, recentLogs) {
    throw new Error('Phương thức detectAnomaly() chưa được cài đặt!');
  }
} 
import { AIAnalysisPort } from '../../../application/ai-ports/AIAnalysisPort.js';

// Hàm hỗ trợ gọi API với cơ chế Exponential Backoff
async function fetchWithRetry(url, options, retries = 5, delay = 1000) {
  try {
    const response = await fetch(url, options);
    if (response.ok) return response;

    if (retries > 0 && (response.status === 429 || response.status >= 500)) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchWithRetry(url, options, retries - 1, delay * 2);
    }
    return response;
  } catch (error) {
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchWithRetry(url, options, retries - 1, delay * 2);
    }
    throw error;
  }
}

export class GeminiAdapter extends AIAnalysisPort {
  constructor(apiKey) {
    super();
    this.apiKey = apiKey || '';
    if (!this.apiKey) {
      console.warn("Cảnh báo: Chưa cấu hình GEMINI_API_KEY trong file .env!");
    }
  }

  // Chuyển đổi nội dung Log thành Vector sử dụng text-embedding-004 (Stable)
  async generateEmbedding(text) {
    try {
      // Đường dẫn API chuẩn hóa cho text-embedding-004
      const url = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${this.apiKey}`;
      
      const response = await fetchWithRetry(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: "models/text-embedding-004",
          content: { parts: [{ text: text }] }
        })
      });

      if (!response.ok) {
        throw new Error(`Lỗi kết nối Gemini Embedding API: Status ${response.status}`);
      }

      const result = await response.json();
      return result.embedding?.values || Array(768).fill(0); // text-embedding-004 trả về 768 chiều
    } catch (error) {
      console.error("Lỗi khi gọi Gemini Embedding:", error.message);
      // Fallback an toàn: Trả về một mảng vector mặc định để không làm nghẽn luồng xử lý
      return Array(768).fill(0); 
    }
  }

  // Phân tích bất thường dựa trên ngữ cảnh hệ thống sử dụng gemini-1.5-flash (Stable)
  async detectAnomaly(currentLog, recentLogs) {
    try {
      // Đường dẫn API chuẩn hóa cho gemini-1.5-flash
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.apiKey}`;
      
      const historyContext = recentLogs.map(log => 
        `[${log.timestamp.toISOString()}] [${log.level}] ${log.message}`
      ).join('\n');

      const systemPrompt = `
        Bạn là một Kỹ sư DevOps AI (DevOps AI Engineer). Nhiệm vụ của bạn là phân tích dòng Log hiện tại trong bối cảnh các Log gần đây để phát hiện sự cố hệ thống.
        
        Yêu cầu bắt buộc: Trả về kết quả đúng định dạng JSON khớp chính xác với cấu trúc yêu cầu dưới đây. Không bọc kết quả trong các ký tự markdown như \`\`\`json.
      `;

      const userPrompt = `
        LỊCH SỬ LOG GẦN ĐÂY (15 phút qua):
        ${historyContext || "Không có log lỗi nào gần đây."}

        DÒNG LOG HIỆN TẠI VỪA NHẬN ĐƯỢC:
        [Thời gian]: ${currentLog.timestamp.toISOString()}
        [Mức độ]: ${currentLog.level}
        [Nội dung]: ${currentLog.message}

        Hãy phân tích và trả về cấu trúc JSON sau:
        {
          "isAnomaly": boolean, // true nếu có lỗi nghiêm trọng hệ thống, false nếu bình thường
          "description": string, // Mô tả ngắn gọn về hành vi hoặc sự cố phát hiện được bằng tiếng Việt
          "confidence": number, // Độ tự tin từ 0.0 đến 1.0
          "rootCause": string // Dự báo nguyên nhân chính gây ra lỗi bằng tiếng Việt
        }
      `;

      const response = await fetchWithRetry(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: userPrompt }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                isAnomaly: { type: "BOOLEAN" },
                description: { type: "STRING" },
                confidence: { type: "NUMBER" },
                rootCause: { type: "STRING" }
              },
              required: ["isAnomaly", "description", "confidence", "rootCause"]
            }
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Lỗi kết nối Gemini Chat API: Status ${response.status}`);
      }

      const result = await response.json();
      const textResponse = result.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!textResponse) {
        throw new Error("Không nhận được dữ liệu phản hồi từ Gemini API.");
      }

      return JSON.parse(textResponse);
    } catch (error) {
      console.error("Lỗi khi phân tích bất thường với Gemini:", error.message);
      // Fallback an toàn khi API gặp sự cố hoặc vượt ngưỡng quota
      return { 
        isAnomaly: false, 
        description: "Tạm thời không thể kết nối tới mô hình AI để phân tích", 
        confidence: 0, 
        rootCause: "Hệ thống AI đang bảo trì hoặc mạng cục bộ gặp sự cố" 
      };
    }
  }
}
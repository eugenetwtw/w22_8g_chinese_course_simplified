// src/api/openaiService.ts

// 定義API回應的介面
export interface OpenAIResponse {
  score: number;
  feedback: string;
  suggestions: string;
}

// 定義問答題評分請求的介面
export interface ShortAnswerGradingRequest {
  questionId: number;
  question: string;
  studentAnswer: string;
  referenceAnswer: string;
}

// 定義作文評分請求的介面
export interface EssayGradingRequest {
  essayId: number;
  title: string;
  question: string;
  studentEssay: string;
  rubric: any; // 使用作文的rubric結構
}

// 使用環境變數獲取API金鑰
const getApiKey = () => {
  return process.env.NEXT_PUBLIC_OPENAI_API_KEY || '';
};

// 檢查API金鑰是否存在
const checkApiKey = (): boolean => {
  const apiKey = getApiKey();
  return apiKey !== '';
};

// 評分問答題
export const gradeShortAnswer = async (request: ShortAnswerGradingRequest): Promise<OpenAIResponse> => {
  if (!checkApiKey()) {
    throw new Error('OpenAI API金鑰未設定。請在環境變數中設定NEXT_PUBLIC_OPENAI_API_KEY。');
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getApiKey()}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `你是一位專業的國中國文教師，負責評分學生的問答題回答。
            請根據參考答案評估學生的回答，給予分數（0-100分）、具體評語和改進建議。
            評分標準：
            - 內容完整性（40%）：是否涵蓋參考答案中的所有重點
            - 理解準確性（30%）：對問題的理解是否準確
            - 表達清晰度（20%）：表達是否清晰、邏輯是否連貫
            - 創新思考（10%）：是否有獨到見解或創新思考
            
            請以JSON格式回應，包含以下三個欄位：
            - score: 數字，0-100分
            - feedback: 字串，具體評語
            - suggestions: 字串，改進建議`
          },
          {
            role: 'user',
            content: `問題：${request.question}\n\n參考答案：${request.referenceAnswer}\n\n學生回答：${request.studentAnswer}`
          }
        ],
        response_format: { type: 'json_object' }
      })
    });

    const data = await response.json();
    
    if (data.error) {
      throw new Error(`API錯誤：${data.error.message}`);
    }

    // 解析API回應中的JSON字串
    const content = data.choices[0].message.content;
    const result = JSON.parse(content);

    return {
      score: result.score,
      feedback: result.feedback,
      suggestions: result.suggestions
    };
  } catch (error) {
    console.error('評分問答題時發生錯誤：', error);
    throw error;
  }
};

// 評分作文
export const gradeEssay = async (request: EssayGradingRequest): Promise<OpenAIResponse> => {
  if (!checkApiKey()) {
    throw new Error('OpenAI API金鑰未設定。請在環境變數中設定NEXT_PUBLIC_OPENAI_API_KEY。');
  }

  try {
    // 將rubric轉換為文字格式，以便在prompt中使用
    const rubricText = Object.entries(request.rubric)
      .map(([sectionKey, section]: [string, any]) => {
        const criteriaText = section.criteria
          .map((criterion: any) => `    - ${criterion.level}: ${criterion.description}`)
          .join('\n');
        
        return `  ${section.title}:\n${criteriaText}`;
      })
      .join('\n\n');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getApiKey()}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `你是一位專業的國中國文教師，負責評分學生的作文。
            請根據提供的評分標準(rubric)評估學生的作文，給予分數（0-100分）、具體評語和改進建議。
            
            評分標準(rubric)如下：
${rubricText}
            
            請以JSON格式回應，包含以下三個欄位：
            - score: 數字，0-100分
            - feedback: 字串，具體評語，請針對rubric中的每個部分給予評語
            - suggestions: 字串，改進建議，請提供具體可行的改進方向`
          },
          {
            role: 'user',
            content: `作文題目：${request.title}\n\n作文要求：${request.question}\n\n學生作文：${request.studentEssay}`
          }
        ],
        response_format: { type: 'json_object' }
      })
    });

    const data = await response.json();
    
    if (data.error) {
      throw new Error(`API錯誤：${data.error.message}`);
    }

    // 解析API回應中的JSON字串
    const content = data.choices[0].message.content;
    const result = JSON.parse(content);

    return {
      score: result.score,
      feedback: result.feedback,
      suggestions: result.suggestions
    };
  } catch (error) {
    console.error('評分作文時發生錯誤：', error);
    throw error;
  }
};

// 獲取整體測驗評語
export const getOverallFeedback = async (
  multipleChoiceScore: number, 
  shortAnswerScores: number[], 
  essayScore: number
): Promise<string> => {
  if (!checkApiKey()) {
    throw new Error('OpenAI API金鑰未設定。請在環境變數中設定NEXT_PUBLIC_OPENAI_API_KEY。');
  }

  try {
    // 計算加權總分
    const totalScore = (
      multipleChoiceScore * 0.3 + 
      (shortAnswerScores.reduce((sum, score) => sum + score, 0) / shortAnswerScores.length) * 0.4 + 
      essayScore * 0.3
    ).toFixed(1);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getApiKey()}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `你是一位專業的國中國文教師，負責給予學生整體測驗評語。
            請根據學生在各部分的得分，給予鼓勵性且具建設性的整體評語，包含優點和可改進之處。
            評語應該溫和、正面，並提供具體的學習建議。`
          },
          {
            role: 'user',
            content: `學生測驗得分情況：
            - 選擇題（30%權重）：${multipleChoiceScore}分
            - 問答題（40%權重）：${shortAnswerScores.join('分, ')}分
            - 作文（30%權重）：${essayScore}分
            - 加權總分：${totalScore}分
            
            請給予整體評語和學習建議。`
          }
        ]
      })
    });

    const data = await response.json();
    
    if (data.error) {
      throw new Error(`API錯誤：${data.error.message}`);
    }

    return data.choices[0].message.content;
  } catch (error) {
    console.error('獲取整體評語時發生錯誤：', error);
    throw error;
  }
};

import { useState } from 'react';
import './App.css';
import { reviewMaterials } from './data/reviewMaterials';
import { multipleChoiceQuestions, shortAnswerQuestions, essayQuestions } from './data/quizQuestions';
import { gradeShortAnswer, gradeEssay, getOverallFeedback, OpenAIResponse } from './api/openaiService';

// 定義問答題答案與評分的介面
interface ShortAnswerResponse {
  id: number;
  answer: string;
  grading?: OpenAIResponse;
  isLoading?: boolean;
  error?: string;
}

// 定義作文答案與評分的介面
interface EssayResponse {
  id: number;
  answer: string;
  grading?: OpenAIResponse;
  isLoading?: boolean;
  error?: string;
}

function App() {
  const [activeTab, setActiveTab] = useState<'review' | 'quiz'>('review');
  const [activeSection, setActiveSection] = useState<number>(0);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [shortAnswerResponses, setShortAnswerResponses] = useState<ShortAnswerResponse[]>([]);
  const [essayResponses, setEssayResponses] = useState<EssayResponse[]>([]);
  const [showResults, setShowResults] = useState<boolean>(false);
  const [showAnswers, setShowAnswers] = useState<boolean>(false);
  const [essayRubricVisible, setEssayRubricVisible] = useState<Record<number, boolean>>({});
  const [shortAnswerVisible, setShortAnswerVisible] = useState<Record<number, boolean>>({});
  const [apiKeyMissing, setApiKeyMissing] = useState<boolean>(false);
  const [overallFeedback, setOverallFeedback] = useState<string>('');
  const [isGeneratingPDF, setIsGeneratingPDF] = useState<boolean>(false);
  const [overallGradingInProgress, setOverallGradingInProgress] = useState<boolean>(false);

  // 計算選擇題得分 (扣分制)
  const calculateScore = () => {
    let correctCount = 0;
    let totalAnswered = 0;

    multipleChoiceQuestions.forEach(q => {
      if (userAnswers[q.id] !== undefined) {
        totalAnswered++;
        if (userAnswers[q.id] === q.correctAnswer) {
          correctCount++;
        }
      }
    });

    // 如果沒有回答任何題目，得分為0
    if (totalAnswered === 0) return 0;

    // 扣分制：每答錯一題扣除相應分數
    const totalQuestions = multipleChoiceQuestions.length;
    const scorePerQuestion = 100 / totalQuestions;
    const wrongCount = totalAnswered - correctCount;
    const deduction = wrongCount * scorePerQuestion;
    
    // 最終得分 (最低為0分)
    return Math.max(0, 100 - deduction);
  };

  const handleAnswerChange = (questionId: number, answer: string) => {
    setUserAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }));
  };

  const handleShortAnswerChange = (questionId: number, answer: string) => {
    setShortAnswerResponses(prev => {
      const existingIndex = prev.findIndex(item => item.id === questionId);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = { ...updated[existingIndex], answer };
        return updated;
      } else {
        return [...prev, { id: questionId, answer }];
      }
    });
  };

  const handleEssayChange = (essayId: number, answer: string) => {
    setEssayResponses(prev => {
      const existingIndex = prev.findIndex(item => item.id === essayId);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = { ...updated[existingIndex], answer };
        return updated;
      } else {
        return [...prev, { id: essayId, answer }];
      }
    });
  };

  const toggleEssayRubric = (essayId: number) => {
    setEssayRubricVisible(prev => ({
      ...prev,
      [essayId]: !prev[essayId]
    }));
  };

  const toggleShortAnswer = (questionId: number) => {
    setShortAnswerVisible(prev => ({
      ...prev,
      [questionId]: !prev[questionId]
    }));
  };

  // 評分問答題
  const gradeShortAnswerQuestion = async (questionId: number) => {
    const shortAnswer = shortAnswerResponses.find(item => item.id === questionId);
    if (!shortAnswer || !shortAnswer.answer.trim()) return;

    const question = shortAnswerQuestions.find(q => q.id === questionId);
    if (!question) return;

    // 更新狀態為正在加載
    setShortAnswerResponses(prev => {
      const updated = [...prev];
      const index = updated.findIndex(item => item.id === questionId);
      if (index >= 0) {
        updated[index] = { ...updated[index], isLoading: true, error: undefined };
      }
      return updated;
    });

    try {
      const result = await gradeShortAnswer({
        questionId,
        question: question.question,
        studentAnswer: shortAnswer.answer,
        referenceAnswer: question.referenceAnswer
      });

      // 更新評分結果
      setShortAnswerResponses(prev => {
        const updated = [...prev];
        const index = updated.findIndex(item => item.id === questionId);
        if (index >= 0) {
          updated[index] = { 
            ...updated[index], 
            grading: result, 
            isLoading: false 
          };
        }
        return updated;
      });
    } catch (error) {
      console.error('評分問答題時發生錯誤:', error);
      
      // 檢查是否為API金鑰缺失錯誤
      const errorMessage = error instanceof Error ? error.message : '評分時發生未知錯誤';
      if (errorMessage.includes('API金鑰未設定')) {
        setApiKeyMissing(true);
      }

      // 更新錯誤狀態
      setShortAnswerResponses(prev => {
        const updated = [...prev];
        const index = updated.findIndex(item => item.id === questionId);
        if (index >= 0) {
          updated[index] = { 
            ...updated[index], 
            error: errorMessage, 
            isLoading: false 
          };
        }
        return updated;
      });
    }
  };

  // 評分作文
  const gradeEssayQuestion = async (essayId: number) => {
    const essay = essayResponses.find(item => item.id === essayId);
    if (!essay || !essay.answer.trim()) return;

    const question = essayQuestions.find(q => q.id === essayId);
    if (!question) return;

    // 更新狀態為正在加載
    setEssayResponses(prev => {
      const updated = [...prev];
      const index = updated.findIndex(item => item.id === essayId);
      if (index >= 0) {
        updated[index] = { ...updated[index], isLoading: true, error: undefined };
      }
      return updated;
    });

    try {
      const result = await gradeEssay({
        essayId,
        title: question.title,
        question: question.question,
        studentEssay: essay.answer,
        rubric: question.rubric
      });

      // 更新評分結果
      setEssayResponses(prev => {
        const updated = [...prev];
        const index = updated.findIndex(item => item.id === essayId);
        if (index >= 0) {
          updated[index] = { 
            ...updated[index], 
            grading: result, 
            isLoading: false 
          };
        }
        return updated;
      });
    } catch (error) {
      console.error('評分作文時發生錯誤:', error);
      
      // 檢查是否為API金鑰缺失錯誤
      const errorMessage = error instanceof Error ? error.message : '評分時發生未知錯誤';
      if (errorMessage.includes('API金鑰未設定')) {
        setApiKeyMissing(true);
      }

      // 更新錯誤狀態
      setEssayResponses(prev => {
        const updated = [...prev];
        const index = updated.findIndex(item => item.id === essayId);
        if (index >= 0) {
          updated[index] = { 
            ...updated[index], 
            error: errorMessage, 
            isLoading: false 
          };
        }
        return updated;
      });
    }
  };

  // 獲取整體評語
  const generateOverallFeedback = async () => {
    setOverallGradingInProgress(true);
    
    try {
      // 獲取選擇題分數
      const multipleChoiceScore = calculateScore();
      
      // 獲取問答題分數
      const shortAnswerScores = shortAnswerResponses
        .filter(item => item.grading)
        .map(item => item.grading!.score);
      
      // 如果沒有評分過的問答題，使用空數組
      const saScores = shortAnswerScores.length > 0 ? shortAnswerScores : [0];
      
      // 獲取作文分數
      const essayScore = essayResponses.find(item => item.grading)?.grading?.score || 0;
      
      // 獲取整體評語
      const feedback = await getOverallFeedback(multipleChoiceScore, saScores, essayScore);
      setOverallFeedback(feedback);
    } catch (error) {
      console.error('獲取整體評語時發生錯誤:', error);
      setOverallFeedback('無法獲取整體評語，請確認API金鑰設定正確。');
    } finally {
      setOverallGradingInProgress(false);
    }
  };

  // 提交測驗
  const handleSubmit = () => {
    setShowResults(true);
    
    // 自動評分所有已填寫的問答題
    shortAnswerResponses.forEach(item => {
      if (item.answer.trim() && !item.grading && !item.isLoading) {
        gradeShortAnswerQuestion(item.id);
      }
    });
    
    // 自動評分所有已填寫的作文
    essayResponses.forEach(item => {
      if (item.answer.trim() && !item.grading && !item.isLoading) {
        gradeEssayQuestion(item.id);
      }
    });
    
    // 生成整體評語
    generateOverallFeedback();
  };

  // 重置測驗
  const handleReset = () => {
    setUserAnswers({});
    setShortAnswerResponses([]);
    setEssayResponses([]);
    setShowResults(false);
    setShowAnswers(false);
    setEssayRubricVisible({});
    setShortAnswerVisible({});
    setOverallFeedback('');
  };

  // 生成PDF
  const handleGeneratePDF = () => {
    setIsGeneratingPDF(true);
    
    // 使用瀏覽器的列印功能
    setTimeout(() => {
      window.print();
      setIsGeneratingPDF(false);
    }, 500);
  };

  // 獲取問答題的答案
  const getShortAnswerResponse = (questionId: number) => {
    return shortAnswerResponses.find(item => item.id === questionId);
  };

  // 獲取作文的答案
  const getEssayResponse = (essayId: number) => {
    return essayResponses.find(item => item.id === essayId);
  };

  return (
    <div className="min-h-screen bg-gray-50 print:bg-white">
      <header className="bg-blue-800 text-white p-4 shadow-md print:hidden">
        <div className="container mx-auto">
          <h1 className="text-3xl font-bold">國中國文課程學習網</h1>
          <p className="mt-2">科幻極短篇選 & 自學選文</p>
        </div>
      </header>

      <nav className="bg-blue-700 text-white print:hidden">
        <div className="container mx-auto flex">
          <button 
            className={`py-3 px-6 font-medium ${activeTab === 'review' ? 'bg-blue-900' : ''}`}
            onClick={() => setActiveTab('review')}
          >
            複習材料
          </button>
          <button 
            className={`py-3 px-6 font-medium ${activeTab === 'quiz' ? 'bg-blue-900' : ''}`}
            onClick={() => setActiveTab('quiz')}
          >
            測驗題目
          </button>
        </div>
      </nav>

      {/* 列印時的標題 */}
      <div className="hidden print:block p-4 border-b-2 border-gray-300 mb-6">
        <h1 className="text-3xl font-bold text-center">國中國文課程測驗結果</h1>
        <p className="text-center mt-2">科幻極短篇選 & 自學選文</p>
      </div>

      <main className="container mx-auto p-4 md:p-6 print:p-0">
        {activeTab === 'review' ? (
          <div className="bg-white rounded-lg shadow-md p-6 print:shadow-none">
            <h2 className="text-2xl font-bold mb-6 text-blue-800">{reviewMaterials.title}</h2>
            
            <div className="mb-6 print:hidden">
              <div className="flex flex-wrap gap-2 mb-4">
                {reviewMaterials.sections.map((section, index) => (
                  <button
                    key={index}
                    className={`px-4 py-2 rounded-full ${activeSection === index ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
                    onClick={() => setActiveSection(index)}
                  >
                    {section.title}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6">
              <h3 className="text-xl font-bold mb-4 text-blue-700">{reviewMaterials.sections[activeSection].title}</h3>
              
              {reviewMaterials.sections[activeSection].subsections.map((subsection, idx) => (
                <div key={idx} className="mb-8">
                  <h4 className="text-lg font-semibold mb-3 text-blue-600">{subsection.subtitle}</h4>
                  
                  {subsection.content.map((contentBlock, contentIdx) => (
                    <div key={contentIdx} className="mb-4">
                      {contentBlock.heading && (
                        <h5 className="font-medium mb-2 text-blue-500">{contentBlock.heading}</h5>
                      )}
                      <ul className="list-disc pl-6 space-y-1">
                        {contentBlock.points.map((point, pointIdx) => (
                          <li key={pointIdx} className="text-gray-700">{point}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md p-6 print:shadow-none">
            <h2 className="text-2xl font-bold mb-6 text-blue-800">國中國文測驗</h2>
            
            {/* API金鑰缺失警告 */}
            {apiKeyMissing && (
              <div className="mb-6 p-4 bg-red-50 rounded-lg border border-red-200 print:hidden">
                <h3 className="text-lg font-semibold text-red-800">OpenAI API金鑰未設定</h3>
                <p className="mt-2">請在Vercel環境變數中設定NEXT_PUBLIC_OPENAI_API_KEY，以啟用AI評分功能。</p>
              </div>
            )}
            
            {/* 測驗結果 */}
            {showResults && (
              <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200 print:mb-8">
                <h3 className="text-lg font-semibold text-blue-800">測驗結果</h3>
                <div className="mt-2 space-y-2">
                  <p>選擇題得分: {calculateScore().toFixed(1)} 分 (30%權重)</p>
                  
                  {shortAnswerResponses.some(item => item.grading) && (
                    <div>
                      <p>問答題得分:</p>
                      <ul className="list-disc pl-6">
                        {shortAnswerResponses
                          .filter(item => item.grading)
                          .map(item => (
                            <li key={item.id}>
                              問題 {item.id}: {item.grading?.score.toFixed(1)} 分
                            </li>
                          ))
                        }
                      </ul>
                      <p className="mt-1">(40%權重)</p>
                    </div>
                  )}
                  
                  {essayResponses.some(item => item.grading) && (
                    <div>
                      <p>作文得分:</p>
                      <ul className="list-disc pl-6">
                        {essayResponses
                          .filter(item => item.grading)
                          .map(item => (
                            <li key={item.id}>
                              {essayQuestions.find(q => q.id === item.id)?.title}: {item.grading?.score.toFixed(1)} 分
                            </li>
                          ))
                        }
                      </ul>
                      <p className="mt-1">(30%權重)</p>
                    </div>
                  )}
                </div>
                
                {/* 整體評語 */}
                {overallFeedback && (
                  <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                    <h4 className="font-medium text-yellow-800 mb-2">整體評語:</h4>
                    <div className="whitespace-pre-line text-gray-700">
                      {overallFeedback}
                    </div>
                  </div>
                )}
                
                {/* 正在生成整體評語 */}
                {overallGradingInProgress && (
                  <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded">
                    <p className="text-gray-600">正在生成整體評語，請稍候...</p>
                  </div>
                )}
                
                <div className="mt-4 flex flex-wrap gap-4 print:hidden">
                  <button 
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    onClick={() => setShowAnswers(!showAnswers)}
                  >
                    {showAnswers ? '隱藏答案' : '顯示答案'}
                  </button>
                  <button 
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                    onClick={handleGeneratePDF}
                    disabled={isGeneratingPDF}
                  >
                    {isGeneratingPDF ? '準備中...' : '下載PDF成績單'}
                  </button>
                  <button 
                    className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                    onClick={handleReset}
                  >
                    重新測驗
                  </button>
                </div>
              </div>
            )}
            
            {/* 選擇題 */}
            <div className="mb-10">
              <h3 className="text-xl font-bold mb-4 text-blue-700 border-b pb-2">一、選擇題（30%）</h3>
              
              {multipleChoiceQuestions.map((question) => (
                <div key={question.id} className="mb-6 p-4 bg-gray-50 rounded-lg print:border print:border-gray-300">
                  <p className="font-medium mb-3">{question.id}. {question.question}</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {question.options.map((option) => (
                      <label key={option.id} className="flex items-start p-2 rounded hover:bg-gray-100 print:hover:bg-transparent">
                        <input
                          type="radio"
                          name={`question-${question.id}`}
                          value={option.id}
                          checked={userAnswers[question.id] === option.id}
                          onChange={() => handleAnswerChange(question.id, option.id)}
                          disabled={showResults}
                          className="mt-1 mr-2"
                        />
                        <span>{option.id}. {option.text}</span>
                      </label>
                    ))}
                  </div>
                  
                  {(showAnswers || window.matchMedia('print').matches) && (
                    <div className="mt-3 p-2 bg-blue-50 rounded print:bg-gray-100">
                      <p className="text-blue-800">
                        正確答案: {question.correctAnswer}
                        {userAnswers[question.id] === question.correctAnswer ? 
                          <span className="ml-2 text-green-600">✓ 答對了!</span> : 
                          <span className="ml-2 text-red-600">✗ 答錯了!</span>
                        }
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            {/* 問答題 */}
            <div className="mb-10">
              <h3 className="text-xl font-bold mb-4 text-blue-700 border-b pb-2">二、問答題（40%）</h3>
              
              {shortAnswerQuestions.map((question) => {
                const response = getShortAnswerResponse(question.id);
                
                return (
                  <div key={question.id} className="mb-6 p-4 bg-gray-50 rounded-lg print:border print:border-gray-300">
                    <p className="font-medium mb-3">{question.id}. {question.question}</p>
                    
                    <textarea
                      className="w-full p-3 border rounded-md print:border-gray-300"
                      rows={4}
                      placeholder="請在此作答..."
                      value={response?.answer || ''}
                      onChange={(e) => handleShortAnswerChange(question.id, e.target.value)}
                      disabled={showResults}
                    ></textarea>
                    
                    {/* AI評分按鈕 */}
                    {!showResults && response?.answer && (
                      <div className="mt-3 print:hidden">
                        <button
                          className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
                          onClick={() => gradeShortAnswerQuestion(question.id)}
                          disabled={response.isLoading || !!response.grading}
                        >
                          {response.isLoading ? '評分中...' : response.grading ? '已評分' : 'AI評分'}
                        </button>
                      </div>
                    )}
                    
                    {/* 評分結果 */}
                    {response?.grading && (
                      <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded print:bg-gray-100 print:border-gray-300">
                        <h4 className="font-medium text-blue-800 mb-2">AI評分結果:</h4>
                        <p className="font-bold">得分: {response.grading.score.toFixed(1)} 分</p>
                        <div className="mt-2">
                          <h5 className="font-medium">評語:</h5>
                          <p className="text-gray-700">{response.grading.feedback}</p>
                        </div>
                        <div className="mt-2">
                          <h5 className="font-medium">建議:</h5>
                          <p className="text-gray-700">{response.grading.suggestions}</p>
                        </div>
                      </div>
                    )}
                    
                    {/* 評分錯誤 */}
                    {response?.error && (
                      <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded print:hidden">
                        <h4 className="font-medium text-red-800 mb-2">評分錯誤:</h4>
                        <p className="text-gray-700">{response.error}</p>
                      </div>
                    )}
                    
                    {/* 評分中 */}
                    {response?.isLoading && (
                      <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded print:hidden">
                        <p className="text-gray-600">正在評分，請稍候...</p>
                      </div>
                    )}
                    
                    <div className="mt-3 print:hidden">
                      <button
                        className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded"
                        onClick={() => toggleShortAnswer(question.id)}
                      >
                        {shortAnswerVisible[question.id] ? '隱藏參考答案' : '顯示參考答案'}
                      </button>
                      
                      {shortAnswerVisible[question.id] && (
                        <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
                          <h4 className="font-medium text-yellow-800 mb-2">參考答案:</h4>
                          <div className="whitespace-pre-line text-gray-700">
                            {question.referenceAnswer}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* 列印時顯示參考答案 */}
                    {window.matchMedia('print').matches && (
                      <div className="mt-3 p-3 bg-gray-100 border border-gray-300 rounded">
                        <h4 className="font-medium text-gray-800 mb-2">參考答案:</h4>
                        <div className="whitespace-pre-line text-gray-700">
                          {question.referenceAnswer}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            
            {/* 作文題 */}
            <div className="mb-10">
              <h3 className="text-xl font-bold mb-4 text-blue-700 border-b pb-2">三、作文題（30%）</h3>
              
              {essayQuestions.map((essay) => {
                const response = getEssayResponse(essay.id);
                
                return (
                  <div key={essay.id} className="mb-6 p-4 bg-gray-50 rounded-lg print:border print:border-gray-300">
                    <h4 className="font-semibold mb-2 text-blue-600">題目: {essay.title}</h4>
                    <p className="mb-4">{essay.question}</p>
                    
                    <textarea
                      className="w-full p-3 border rounded-md print:border-gray-300"
                      rows={6}
                      placeholder="請在此作答..."
                      value={response?.answer || ''}
                      onChange={(e) => handleEssayChange(essay.id, e.target.value)}
                      disabled={showResults}
                    ></textarea>
                    
                    {/* AI評分按鈕 */}
                    {!showResults && response?.answer && (
                      <div className="mt-3 print:hidden">
                        <button
                          className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
                          onClick={() => gradeEssayQuestion(essay.id)}
                          disabled={response.isLoading || !!response.grading}
                        >
                          {response.isLoading ? '評分中...' : response.grading ? '已評分' : 'AI評分'}
                        </button>
                      </div>
                    )}
                    
                    {/* 評分結果 */}
                    {response?.grading && (
                      <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded print:bg-gray-100 print:border-gray-300">
                        <h4 className="font-medium text-blue-800 mb-2">AI評分結果:</h4>
                        <p className="font-bold">得分: {response.grading.score.toFixed(1)} 分</p>
                        <div className="mt-2">
                          <h5 className="font-medium">評語:</h5>
                          <p className="text-gray-700 whitespace-pre-line">{response.grading.feedback}</p>
                        </div>
                        <div className="mt-2">
                          <h5 className="font-medium">建議:</h5>
                          <p className="text-gray-700 whitespace-pre-line">{response.grading.suggestions}</p>
                        </div>
                      </div>
                    )}
                    
                    {/* 評分錯誤 */}
                    {response?.error && (
                      <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded print:hidden">
                        <h4 className="font-medium text-red-800 mb-2">評分錯誤:</h4>
                        <p className="text-gray-700">{response.error}</p>
                      </div>
                    )}
                    
                    {/* 評分中 */}
                    {response?.isLoading && (
                      <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded print:hidden">
                        <p className="text-gray-600">正在評分，請稍候...</p>
                      </div>
                    )}
                    
                    <div className="mt-3 print:hidden">
                      <button
                        className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded"
                        onClick={() => toggleEssayRubric(essay.id)}
                      >
                        {essayRubricVisible[essay.id] ? '隱藏評分標準' : '顯示評分標準'}
                      </button>
                      
                      {essayRubricVisible[essay.id] && (
                        <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded">
                          <h4 className="font-medium text-green-800 mb-2">評分標準 (Rubric):</h4>
                          
                          {Object.entries(essay.rubric).map(([sectionKey, section]: [string, any]) => (
                            <div key={sectionKey} className="mb-4">
                              <h5 className="font-medium text-green-700 mb-1">{section.title}</h5>
                              <ul className="list-disc pl-6">
                                {section.criteria.map((criterion: any, idx: number) => (
                                  <li key={idx} className="mb-1">
                                    <span className="font-medium">{criterion.level}:</span> {criterion.description}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    {/* 列印時顯示評分標準 */}
                    {window.matchMedia('print').matches && (
                      <div className="mt-3 p-3 bg-gray-100 border border-gray-300 rounded">
                        <h4 className="font-medium text-gray-800 mb-2">評分標準 (Rubric):</h4>
                        
                        {Object.entries(essay.rubric).map(([sectionKey, section]: [string, any]) => (
                          <div key={sectionKey} className="mb-4">
                            <h5 className="font-medium text-gray-700 mb-1">{section.title}</h5>
                            <ul className="list-disc pl-6">
                              {section.criteria.map((criterion: any, idx: number) => (
                                <li key={idx} className="mb-1">
                                  <span className="font-medium">{criterion.level}:</span> {criterion.description}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            
            {/* 提交按鈕 */}
            {!showResults && (
              <div className="mt-8 flex justify-center print:hidden">
                <button
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-lg"
                  onClick={handleSubmit}
                >
                  提交測驗
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="bg-gray-800 text-white p-6 mt-10 print:hidden">
        <div className="container mx-auto">
          <p className="text-center">© 2025 國中國文課程學習網 - 科幻極短篇選 & 自學選文</p>
        </div>
      </footer>
      
      {/* 列印時的頁尾 */}
      <div className="hidden print:block p-4 border-t-2 border-gray-300 mt-6">
        <p className="text-center text-gray-600">© 2025 國中國文課程學習網 - 科幻極短篇選 & 自學選文</p>
        <p className="text-center text-gray-500 text-sm mt-1">列印日期: {new Date().toLocaleDateString()}</p>
      </div>
      
      {/* 列印樣式 */}
      <style>{`
        @media print {
          body {
            font-family: "Noto Sans CJK TC", "WenQuanYi Zen Hei", sans-serif;
          }
          
          @page {
            margin: 1.5cm;
          }
          
          .print\\:hidden {
            display: none !important;
          }
          
          .print\\:block {
            display: block !important;
          }
          
          .print\\:border {
            border-width: 1px !important;
          }
          
          .print\\:border-gray-300 {
            border-color: #d1d5db !important;
          }
          
          .print\\:bg-gray-100 {
            background-color: #f3f4f6 !important;
          }
          
          textarea {
            resize: none;
            overflow: hidden;
            height: auto;
          }
        }
      `}</style>
    </div>
  );
}

export default App;

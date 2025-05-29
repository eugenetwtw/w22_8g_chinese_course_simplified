# 國中國文課程網站 - OpenAI API評分版

這是一個國中國文課程網站，包含複習材料和測驗題目，並整合了OpenAI API自動評分功能。

## 功能特色

- **複習材料**：科幻文學基本概念、《深藍的憂鬱》與《替代死刑》文本解析等
- **測驗題目**：
  - 選擇題（30%）：自動評分功能
  - 問答題（40%）：OpenAI API智能評分與建議
  - 作文題（30%）：OpenAI API根據rubric評分與詳細評語
- **PDF下載**：可下載含分數、評語與建議的完整考卷
- **響應式設計**：適合各種裝置瀏覽

## 部署說明

### 前置需求

- OpenAI API金鑰（需自行申請）
- GitHub帳號
- Vercel帳號

### 部署步驟

1. **Fork或Clone此專案到GitHub**
   ```
   git clone https://github.com/your-username/chinese-course-website.git
   cd chinese-course-website
   ```

2. **在Vercel上部署**
   - 登入Vercel並點擊「New Project」
   - 選擇您的GitHub倉庫
   - 在「Environment Variables」設定中，添加以下環境變數：
     - 名稱：`NEXT_PUBLIC_OPENAI_API_KEY`
     - 值：您的OpenAI API金鑰
   - 點擊「Deploy」

3. **部署完成**
   - 部署完成後，Vercel會提供一個永久網址
   - 您可以在Vercel儀表板中設定自訂網域

## 本地開發

1. **安裝依賴**
   ```
   npm install
   ```

2. **設定環境變數**
   - 複製`.env.example`為`.env.local`
   - 填入您的OpenAI API金鑰

3. **啟動開發伺服器**
   ```
   npm run dev
   ```

4. **建置生產版本**
   ```
   npm run build
   ```

## 使用說明

### 學生使用流程

1. 瀏覽複習材料
2. 進入測驗頁面作答
3. 提交測驗後查看自動評分結果
4. 點擊「下載PDF成績單」獲取完整評分報告

### 教師使用流程

1. 在Vercel設定中配置OpenAI API金鑰
2. 監控學生測驗結果
3. 根據需要調整題目或評分標準

## 技術說明

- 前端框架：React + TypeScript
- 樣式：Tailwind CSS
- API整合：OpenAI API (GPT-4o)
- PDF生成：瀏覽器原生列印功能
- 部署平台：Vercel

## 注意事項

- OpenAI API使用會產生費用，請注意控制使用量
- 確保API金鑰安全，不要在前端代碼中硬編碼
- PDF下載功能使用瀏覽器原生列印功能，支援度良好但可能因瀏覽器而略有差異

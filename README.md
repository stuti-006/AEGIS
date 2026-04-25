# 🚨 AEGIS — Women's Safety Intelligence System

A production-ready AI system that detects, classifies, and responds to online threats in real time. Designed for scalability, explainability, and real-world deployment.

---

## 🌟 Overview

AEGIS analyzes text inputs and classifies them into:

* **Safe**
* **Suspicious**
* **Dangerous**

It combines:

* AI-based classification (LLM)
* Rule-based fallback
* Real-time alerting (Slack)
* Evidence storage (local / cloud)

---

## 🧠 End-to-End Flow

```
User Input → Frontend (React)
          → FastAPI (AI Analysis)
          → MCP Server (Decision Engine)
          → Slack Alerts / Evidence Storage
```

---

## 🎯 Key Features

### Core Functionality

* ✅ AI-powered threat classification
* ✅ Confidence + risk scoring
* ✅ Risk factor identification
* ✅ Real-time analysis
* ✅ Multi-language support

### Advanced Features

* 🧠 Explainable AI panel (WHY it flagged)
* 🌡️ Risk Heat Score visualization
* 📊 Threat history dashboard
* 🔄 Batch message analysis
* ⚡ FastAPI async performance

### Integrations

* 🔔 Slack alerts for high-risk threats
* 💾 Evidence storage (JSON / Google Drive)
* 🧩 MCP orchestration layer

---

## 🏗️ Architecture

```
Frontend (React + Tailwind)
        ↓
FastAPI Backend (AI Engine)
        ↓
MCP Server (Node.js Decision Engine)
        ↓
 ┌────────────┬───────────────┬──────────────┐
 ↓            ↓               ↓
Slack      Local Storage   Google Drive
```

---

## 📁 Project Structure

```
aegis/
├── backend/          # FastAPI AI engine
├── frontend/         # React UI
├── mcp-server/       # Orchestration layer
├── docker-compose.yml
└── README.md
```

---

## 🚀 Quick Start

### 🔹 Backend (FastAPI)

```bash
cd backend
python -m venv venv
source venv/Scripts/activate
pip install -r requirements.txt
cp .env.example .env
python main.py


👉 Runs at: http://localhost:8000

---

### 🔹 Frontend (React)

```bash
cd frontend
npm install
npm run dev
```

👉 Runs at: http://localhost:3000

---

### 🔹 MCP Server

```bash
cd mcp-server
npm install
cp .env.example .env
npm run dev
```

👉 Runs at: http://localhost:3001

---

### 🔹 Docker (Full System)

```bash
docker-compose up --build
```

---

## ⚙️ Environment Variables

```env
# Backend
OPENAI_API_KEY=sk-...
CORS_ORIGINS=http://localhost:3000

# MCP
MCP_SERVER_URL=http://localhost:3001
SLACK_WEBHOOK_URL=https://...

# Storage
STORAGE_BACKEND=local
EVIDENCE_DIR=./evidence
```

---

## 🔌 API Endpoints

### POST `/api/analyze`

```json
{
  "message": "I will hurt myself",
  "language": "en"
}
```

### Response

```json
{
  "label": "dangerous",
  "confidence": 0.95,
  "reason": "Self-harm detected",
  "risk_score": 92.5,
  "threat_level": "HIGH",
  "mcp_status": true,
  "risk_factors": [...],
  "analysis_id": "ana_123",
  "timestamp": "2026-01-01T00:00:00Z"
}
```

---

### GET `/api/history`

Returns previous analyses

### GET `/api/statistics`

Returns analytics data

### POST `/api/analyze/batch`

Analyze multiple messages

---

## 🧠 MCP Decision Logic

| Condition                         | Severity | Action        |
| --------------------------------- | -------- | ------------- |
| dangerous + confidence > 0.9      | HIGH     | Slack + Store |
| suspicious OR confidence 0.75–0.9 | MEDIUM   | Store only    |
| else                              | LOW      | No action     |

---

## 💾 Database Schema

### analyses

* analysis_id
* message (hashed)
* label
* confidence
* risk_score
* risk_factors

### alerts

* alert_id
* analysis_id
* status

---

## 🔐 Security & Privacy

* 🔒 Messages are hashed before storage
* 🔑 API keys stored in `.env`
* 🛡️ Rate limiting implemented
* 🌐 CORS restrictions enabled
* 🔐 HTTPS recommended in production

---

## 📊 UI Features

* Glassmorphism design
* Real-time threat analysis
* Risk heat visualization
* Explainable AI insights
* Threat history dashboard

---

## 🧪 Testing

### Backend

```bash
pytest
```

### Frontend

```bash
npm test
```

### MCP

```bash
npm test
```

---

## ⚠️ Limitations

* AI may misclassify edge cases
* Depends on API availability (OpenAI)
* Limited language coverage
* No real-time streaming (yet)

---

## 🚀 Future Improvements

* 🔴 WebSocket real-time streaming
* 📱 Mobile application
* 🧠 Custom-trained ML model
* 📊 Admin dashboard
* 🤖 Automated response system
* 🔍 Advanced threat pattern learning

---

## 🏆 Why This Project Stands Out

* ✅ Production-ready architecture
* ✅ Full-stack integration (AI + UI + Orchestration)
* ✅ Explainable AI (not black-box)
* ✅ Real-world use case (safety & moderation)
* ✅ Scalable and modular design
* ✅ Clean UI/UX

---

## 🐛 Troubleshooting

### Backend not starting

```bash
python --version
lsof -i :8000
```

### Frontend not connecting

* Check CORS settings
* Ensure backend is running

### API errors

* Verify API key
* Check logs

---

## 📚 Documentation

* Swagger: http://localhost:8000/docs
* ReDoc: http://localhost:8000/redoc

---

## 👥 Support

* Check logs in `/backend/logs`
* Review API docs
* Test endpoints manually

---

Aegis is designed not just as a prototype, but as a **deployable real-world safety system**.

---

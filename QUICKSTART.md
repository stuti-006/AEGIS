# Quick Start Guide

## 🚀 Get Running in 5 Minutes

### Option A: Docker (Easiest)

```bash
# 1. Copy environment
cp .env.example .env

# 2. Edit .env (optional - defaults work)
# - Add OPENAI_API_KEY for AI features
# - Add SLACK_WEBHOOK_URL for alerts

# 3. Start with Docker
docker-compose up

# 4. Visit
# Frontend: http://localhost:3000
# Backend: http://localhost:8000/docs
```

### Option B: Local Development

**Terminal 1 - Backend:**
```bash
cd backend
python -m venv venv
source venv/Scripts/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm install
npm run dev
```

**Visit:** http://localhost:3000

---

## 📝 Test It Out

**Safe Message:**
```
"I had a great day at work today"
→ Should return: SAFE
```

**Suspicious Message:**
```
"I might do something bad"
→ Should return: SUSPICIOUS
```

**Dangerous Message:**
```
"I'm going to harm myself"
→ Should return: DANGEROUS + Slack alert
```

---

## 📚 Next Steps

1. **Explore API**: http://localhost:8000/docs
2. **Try Dashboard**: http://localhost:3000
3. **Read Docs**: See [README.md](README.md)
4. **Deploy**: Follow [DEPLOYMENT.md](DEPLOYMENT.md)

---

## 🎯 Key Features to Show Judges

1. **Analysis Result Page**: Classification + confidence
2. **Explainable AI Tab**: Why it was flagged
3. **Risk Heat Map Tab**: Temperature visualization
4. **History Tab**: Statistics dashboard
5. **API Docs**: `/docs` endpoint

---

## ⚙️ Configuration

### Without API Keys (Rules-Based)
- Works out of the box
- Uses keyword detection
- No cloud dependencies

### With API Keys (AI-Powered)
1. Get OpenAI key: https://platform.openai.com/api-keys
2. Get Slack webhook: https://api.slack.com/apps
3. Add to `.env`
4. Restart application

---

## 🐛 Having Issues?

```bash
# Backend won't start?
cd backend
pip install --force-reinstall -r requirements.txt

# Frontend won't connect?
# Check CORS_ORIGINS in backend .env

# Port already in use?
# Change PORT in .env (e.g., PORT=8001)
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for full troubleshooting.

---

**That's it! You now have AEGIS running. 🎉**

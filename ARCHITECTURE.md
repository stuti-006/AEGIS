# AEGIS Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    User Interface                           │
│              React + Tailwind CSS (Frontend)                │
│                                                             │
│  AnalysisInput → ResultCard → ExplainableAI → RiskHeatMap  │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTP/JSON
                       ↓
┌─────────────────────────────────────────────────────────────┐
│                    FastAPI Backend                          │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Routes (analyze.py)                     │  │
│  │  POST /api/analyze                                  │  │
│  │  GET /api/history                                   │  │
│  │  GET /api/statistics                                │  │
│  └──────────────────┬───────────────────────────────────┘  │
│                    │                                       │
│  ┌─────────────────┴──────────────────────────────────┐   │
│  │          Services (Business Logic)                 │   │
│  │                                                    │   │
│  │  ┌─────────────────────────────────────────────┐  │   │
│  │  │ AIEngine (ai_engine.py)                     │  │   │
│  │  │ - LLM-based classification                  │  │   │
│  │  │ - Rules-based fallback                      │  │   │
│  │  │ - Risk scoring                              │  │   │
│  │  │ - Confidence calculation                    │  │   │
│  │  └─────────────────────────────────────────────┘  │   │
│  │                                                    │   │
│  │  ┌─────────────────────────────────────────────┐  │   │
│  │  │ AlertService (alert_service.py)             │  │   │
│  │  │ - Slack webhook integration                 │  │   │
│  │  │ - Alert payload building                    │  │   │
│  │  │ - Error handling                            │  │   │
│  │  └─────────────────────────────────────────────┘  │   │
│  │                                                    │   │
│  │  ┌─────────────────────────────────────────────┐  │   │
│  │  │ StorageService (storage_service.py)         │  │   │
│  │  │ - SQLite operations                         │  │   │
│  │  │ - JSONL logging                             │  │   │
│  │  │ - Statistics queries                        │  │   │
│  │  └─────────────────────────────────────────────┘  │   │
│  └────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │          Utilities & Middleware                      │  │
│  │                                                      │  │
│  │  - Rate Limiter (rate_limiter.py)                   │  │
│  │  - Logger Setup (logger.py)                         │  │
│  │  - Data Schemas (schemas.py)                        │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
        │                     │                    │
        ↓                     ↓                    ↓
    ┌────────┐          ┌──────────┐         ┌────────┐
    │ SQLite │          │  Slack   │         │ Logs   │
    │   DB   │          │ Webhook  │         │ Files  │
    └────────┘          └──────────┘         └────────┘
```

## Data Flow

### Analysis Flow
```
User Input
   ↓
[Validate & Rate Limit]
   ↓
[AIEngine.analyze()]
   ├→ [Try LLM Analysis]
   │  ├→ Build system prompt
   │  ├→ Call OpenAI API
   │  └→ Parse response
   │
   └→ [Rules-Based Fallback]
      ├→ Check keywords
      ├→ Calculate risk score
      └→ Build explanation
   ↓
[Calculate Risk Score & Format Response]
   ↓
[StorageService.save_analysis()]
   ├→ Save to SQLite
   └→ Save to JSONL
   ↓
[If Dangerous: AlertService.send_alert()]
   └→ Send to Slack
   ↓
[Return AnalysisResponse]
```

## Component Responsibilities

### Backend

#### main.py
- FastAPI app initialization
- CORS middleware
- Global error handling
- Routes registration
- Startup/shutdown events

#### routes/analyze.py
- API endpoint definitions
- Request validation
- Response formatting
- Rate limiting checks

#### services/ai_engine.py
- Message classification
- Threat detection
- Confidence calculation
- Risk scoring
- Fallback logic

#### services/alert_service.py
- Slack integration
- Alert formatting
- Webhook management
- Error logging

#### services/storage_service.py
- Database initialization
- CRUD operations
- Statistics queries
- Evidence logging

#### utils/rate_limiter.py
- Request tracking
- Rate limit enforcement
- Thread-safe operations

#### utils/logger.py
- Logging configuration
- File rotation
- Console output

#### models/schemas.py
- Pydantic models
- Request/response schemas
- Data validation

### Frontend

#### App.jsx
- Main application component
- State management
- Tab navigation
- Error handling

#### components/AnalysisInput.jsx
- Text input form
- Language selection
- Quick examples
- Form submission

#### components/ResultCard.jsx
- Classification display
- Risk metrics
- Factor visualization
- Recommendations

#### components/ThreatHistory.jsx
- Analysis history list
- Statistics display
- Data fetching

#### components/ExplainableAI.jsx
- AI decision explanation
- Factor analysis
- Recommendation display

#### components/RiskHeatMap.jsx
- Heat score visualization
- Risk gauge
- Confidence matrix

## Key Design Patterns

### 1. Service Layer Architecture
- Clean separation of concerns
- Dependency injection via imports
- Testable components
- Modular code

### 2. Error Handling
- Try-catch in services
- Meaningful error messages
- Logging at each level
- Graceful degradation

### 3. Rate Limiting
- In-memory sliding window
- Thread-safe operations
- Per-client tracking
- Configurable limits

### 4. Fallback Strategy
- Primary: LLM (GPT-4)
- Fallback: Rules-based
- Both: Consistent output schema
- Logging for analysis

### 5. Caching Strategy
- Frontend: Component state
- Backend: No caching (fast DB)
- Potential: Redis for scaling

## Database Schema

### analyses table
```sql
CREATE TABLE analyses (
  analysis_id TEXT PRIMARY KEY,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  message TEXT,  -- Privacy: empty in DB
  label TEXT,    -- dangerous|suspicious|safe
  confidence REAL,  -- 0.0-1.0
  reason TEXT,
  risk_factors TEXT,  -- JSON
  risk_score REAL,  -- 0-100
  created_at DATETIME
);

CREATE INDEX idx_analyses_timestamp ON analyses(timestamp DESC);
CREATE INDEX idx_analyses_label ON analyses(label);
```

### alerts table
```sql
CREATE TABLE alerts (
  alert_id TEXT PRIMARY KEY,
  analysis_id TEXT UNIQUE,
  triggered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  alert_type TEXT,
  status TEXT,
  FOREIGN KEY(analysis_id) REFERENCES analyses(analysis_id)
);
```

## API Contracts

### AnalysisRequest Schema
```python
{
  "message": str,      # 1-10000 chars
  "language": str      # en|es|fr|de
}
```

### AnalysisResponse Schema
```python
{
  "label": str,                      # safe|suspicious|dangerous
  "confidence": float,               # 0.0-1.0
  "reason": str,
  "risk_factors": [                  # List[RiskFactor]
    {
      "factor": str,
      "severity": str,               # low|medium|high
      "description": str
    }
  ],
  "explanation": str,
  "risk_score": float,               # 0-100
  "recommendations": List[str],
  "analysis_id": str,
  "timestamp": str                   # ISO 8601
}
```

## Scalability Considerations

### Current Capacity
- ~100 requests/min per IP
- ~50 concurrent users
- ~1M records in database

### Scaling Strategies

#### Short-term (10K users)
- Redis caching
- Database indexes
- Connection pooling

#### Medium-term (100K users)
- Async task queue (Celery)
- Database replication
- Load balancing

#### Long-term (1M users)
- Microservices architecture
- Message queue (RabbitMQ)
- Distributed caching
- Database sharding

## Security Measures

1. **Input Validation**: Pydantic schemas
2. **Rate Limiting**: Per-IP throttling
3. **CORS**: Origin whitelisting
4. **Logging**: Detailed audit trails
5. **Error Handling**: No sensitive data in responses
6. **Environment Variables**: Secrets management

## Performance Optimization

### Backend
- Fast LLM inference (< 1s)
- Efficient database queries
- Connection pooling
- Async endpoints (when scaled)

### Frontend
- Code splitting
- Image optimization
- CSS-in-JS efficiency
- Lazy loading

### Database
- Indexed queries
- Batch operations
- Efficient JSON storage
- Log rotation

## Testing Strategy

### Unit Tests
- Service logic
- Utility functions
- Schema validation

### Integration Tests
- API endpoints
- Database operations
- Slack integration

### E2E Tests
- Full workflow
- UI interactions
- API responses

## Monitoring & Observability

### Logging
- Application logs: `/backend/logs/aegis.log`
- Analysis log: `/backend/data/analysis_log.jsonl`
- Error tracking: Console + file

### Metrics
- Analysis count
- Classification distribution
- Average confidence
- Average risk score
- API response times
- Error rates

### Alerting
- Dangerous message detection
- API failures
- Database errors
- Rate limit exceeded

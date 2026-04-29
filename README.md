# TalentSuite v3.0 — 50 Features · Glassmorphism UI · Stripe + OpenAI

> "Intelligence that finds the right person"

---

## Quick Start (Windows / VS Code)

### Step 1 — Backend Setup
```
cd TalentSuite\backend
copy .env.example .env
```
Open `.env` and paste your 3 keys:
```
STRIPE_SECRET_KEY=sk_test_your_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here
OPENAI_API_KEY=sk-your_key_here
```
Then run:
```
py -m pip install -r requirements.txt
py main.py
```
✅ Backend live at: http://localhost:8001
✅ API docs at: http://localhost:8001/docs

---

### Step 2 — Frontend Setup
```
cd TalentSuite\frontend
copy .env.example .env
```
Open `.env` and paste:
```
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here
```
Then run:
```
npm install
npm run dev
```
✅ Open: http://localhost:5173

---

## Test Stripe Payments
Use test card: `4242 4242 4242 4242` · Any future date · Any CVC

**No keys yet?** Click "Upgrade to Pro" → uses demo mode (no real payment needed)

---

## All 50 Features

### Core Analysis (14) ✅ Fully Working
1. Resume upload (PDF / DOCX / TXT)
2. Paste text analysis
3. Role prediction (TF-IDF cosine similarity)
4. Skill extraction (NLP regex taxonomy — 150+ skills)
5. ATS score checker (Grade A–F)
6. Resume score + radar chart (5 dimensions)
7. JD match + cosine similarity
8. Skill gap roadmap
9. Salary estimator with premium skill premiums
10. Bullet point AI rewriter (OpenAI or NLP fallback)
11. Cover letter generator (3 tones)
12. Interview question generator
13. Bulk resume screener + CSV export
14. Resume version compare (v1 vs v2)

### Platform (9) ✅ Fully Working
15. JWT authentication (register / login)
16. SQLite database (persistent)
17. Resume history per user
18. Job pipeline manager
19. Kanban board (5 stages)
20. Candidate status tracking
21. Recruiter analytics dashboard (real SQL)
22. Full REST API (FastAPI)
23. Share links

### Extra Features (13) ✅ Fully Working
24. Live score as you type (updates every 0.9s)
25. Voice resume analyzer (real Web Speech API — Chrome)
26. Candidate battle mode (head-to-head)
27. JD bias detector (DEI wordlist)
28. Resume anonymizer (regex PII removal)
29. Attrition risk predictor (heuristics)
30. Culture fit analyzer (keyword matching)
31. GitHub analyzer (real GitHub REST API)
32. Executive summary card (printable)
33. Resume time machine (SQLite snapshots)
34. Salary negotiation simulator (real OpenAI)
35. Interview simulation (real OpenAI scoring)
36. Multi-language support (6 languages — UI)

### Payments (5) ✅ Fully Working
37. Stripe pricing page (Free / Pro $29 / Enterprise)
38. Real Stripe checkout (test mode)
39. Plan gating (Free = 5 resumes/month)
40. Usage meter in sidebar
41. Billing portal (cancel / upgrade)

### UI / UX (9) ✅ Fully Working
42. Glassmorphism design (frosted glass cards)
43. Permanent sidebar navigation
44. Command palette ⌘K
45. Toast notifications
46. Audit log (Settings → Audit)
47. Loading skeletons and spinners
48. Smooth animations and transitions
49. API reference in Settings
50. Mobile-friendly layout

---

## Keys Required

| Key | Where to get | Cost |
|---|---|---|
| `STRIPE_SECRET_KEY` | stripe.com → Developers → API Keys | Free test mode |
| `STRIPE_PUBLISHABLE_KEY` | stripe.com → Developers → API Keys | Free test mode |
| `OPENAI_API_KEY` | platform.openai.com → API Keys | $5 free credit |

**Without keys:** 47/50 features still work. Only Stripe checkout, OpenAI AI responses need keys.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Backend offline (red dot) | Run `py main.py` in backend folder |
| Port 8001 in use | `netstat -ano \| findstr :8001` → `taskkill /PID XXXX /F` |
| npm not found | Install Node.js from nodejs.org |
| `stripe` module not found | Run `py -m pip install stripe` |
| `openai` module not found | Run `py -m pip install openai` |
| Voice not working | Use Chrome browser (not Firefox/Safari) |
| Stripe checkout fails | Add STRIPE_SECRET_KEY to backend/.env |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS |
| UI | Glassmorphism — Plus Jakarta Sans + JetBrains Mono |
| Charts | Recharts (radar, bar, line, pie) |
| Backend | Python FastAPI + Uvicorn |
| NLP | scikit-learn TF-IDF + custom regex taxonomy |
| Database | SQLite (via Python sqlite3) |
| Auth | JWT (custom implementation, no external lib) |
| Payments | Stripe (subscriptions + webhooks) |
| AI | OpenAI GPT-3.5-turbo (nego sim + interview scoring) |
| Voice | Web Speech API (browser-native, Chrome) |
| GitHub | GitHub REST API (real live data) |

# Quick Start Reference

## 🚀 Fast Setup (5 Minutes)

### 1. Frontend Setup

```bash
cd c:\A-WORK\FYP MAIN FOLDER\1st-UI-Try\codecanvas
pnpm install
copy .env.example .env.local
# Edit .env.local with your Supabase credentials
pnpm dev
```

✅ Frontend running at http://localhost:3000

### 2. Backend Setup

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
# Edit .env with your Supabase credentials
uvicorn main:app --reload
```

✅ Backend running at http://localhost:8000

### 3. Supabase Setup

1. Go to https://supabase.com → New Project
2. Copy URL and keys to `.env.local` and `backend/.env`
3. SQL Editor → Run migrations 1-4 from `supabase/migrations/`

## 🎯 Test the Integration

1. Draw on mini canvas (homepage)
2. Click "Continue in Canvas"
3. Draw more on main canvas
4. Click "Run Detection"
5. See generated code in bottom panel

## 📝 Environment Variables

**Frontend (.env.local):**

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
FASTAPI_URL=http://localhost:8000
```

**Backend (backend/.env):**

```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

## 🔗 Important URLs

- Frontend: http://localhost:3000
- Canvas: http://localhost:3000/canvas
- Login: http://localhost:3000/auth/login
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs
- Supabase Dashboard: https://supabase.com/dashboard

## 📚 Key Files

| File                                     | Purpose               |
| ---------------------------------------- | --------------------- |
| `src/app/canvas/page.tsx`                | Main canvas workspace |
| `src/components/canvas/SketchCanvas.tsx` | Drawing component     |
| `backend/main.py`                        | FastAPI server        |
| `backend/app/models/inference.py`        | AI detection logic    |
| `supabase/migrations/`                   | Database schema       |

## 🐛 Common Issues

**"Module not found"**: Run `pnpm install`  
**"Port already in use"**: Kill process or use different port  
**"Supabase error"**: Check credentials in .env files  
**Backend import errors**: Activate venv, reinstall dependencies

## 🎓 For FYP

1. **Now**: Use fallback detection (OpenCV)
2. **Next**: Collect 100+ labeled sketches
3. **Then**: Train CNN in `ml-training/notebooks/01_sketch_detection_cnn.ipynb`
4. **Finally**: Document accuracy, confusion matrix, training curves

## 📖 Full Documentation

- [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md) - Detailed setup
- [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) - What's built
- [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) - Database guide
- [ml-training/README.md](./ml-training/README.md) - ML training

---

**Need Help?** Check the full [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md) for troubleshooting.

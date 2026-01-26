# CodeCanvas Integration Guide

Complete setup and testing guide for the FastAPI + Supabase + Next.js integration.

## Architecture Overview

```
Frontend (Next.js)
    ↓
API Route (/api/generate-code)
    ↓
FastAPI Backend (Python)
    ↓
Custom AI Models (TensorFlow/PyTorch)
    ↓
Supabase (Database + Auth)
```

## Prerequisites

- Node.js 18+ and pnpm
- Python 3.10+
- Supabase account (https://supabase.com)
- PostgreSQL (via Supabase)

## Step 1: Supabase Setup

### 1.1 Create Supabase Project

1. Go to https://supabase.com/dashboard
2. Click "New Project"
3. Fill in:
   - Name: `codecanvas`
   - Database Password: (generate strong password)
   - Region: Choose closest to you
4. Wait for project creation (~2 minutes)

### 1.2 Get Credentials

1. Go to Project Settings → API
2. Copy these values:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon/public key**: `eyJhbGc...` (starts with eyJ)
   - **service_role key**: `eyJhbGc...` (DO NOT expose publicly)

### 1.3 Update Environment Variables

**Frontend (.env.local):**

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
FASTAPI_URL=http://localhost:8000
```

**Backend (backend/.env):**

```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

### 1.4 Run Database Migrations

1. Go to Supabase Dashboard → SQL Editor
2. Run each migration file in order:

**Migration 1 - Schema:**

```sql
-- Copy content from supabase/migrations/20240101000001_initial_schema.sql
-- Paste and run
```

**Migration 2 - Triggers:**

```sql
-- Copy content from supabase/migrations/20240101000002_triggers.sql
-- Paste and run
```

**Migration 3 - RLS:**

```sql
-- Copy content from supabase/migrations/20240101000003_rls_policies.sql
-- Paste and run
```

**Migration 4 - Storage:**

```sql
-- Copy content from supabase/migrations/20240101000004_storage.sql
-- Paste and run
```

### 1.5 Configure Authentication

1. Go to Authentication → Providers
2. Enable:
   - Email (already enabled)
   - Google OAuth (optional):
     - Get credentials from Google Cloud Console
     - Add authorized redirect: `https://xxxxx.supabase.co/auth/v1/callback`

## Step 2: Frontend Setup

```bash
cd c:\A-WORK\FYP MAIN FOLDER\1st-UI-Try\codecanvas

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

Frontend runs at: http://localhost:3000

## Step 3: Backend Setup

### 3.1 Install Python Dependencies

```bash
cd backend

# Create virtual environment (recommended)
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 3.2 Start FastAPI Server

```bash
# Make sure you're in backend/ directory
# And virtual environment is activated

uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Backend runs at: http://localhost:8000

API docs at: http://localhost:8000/docs

## Step 4: Test Integration

### 4.1 Test Authentication

1. Go to http://localhost:3000/auth/signup
2. Create account with email/password
3. Check Supabase Dashboard → Authentication → Users
4. Verify new user appears

### 4.2 Test Canvas Drawing

1. Go to http://localhost:3000
2. Draw on mini canvas
3. Click "Continue in Canvas"
4. Verify design imports to main canvas

### 4.3 Test AI Detection (with Fallback)

1. On canvas page, draw some shapes:
   - Rectangle (simulates button)
   - Long rectangle (simulates input)
   - Large box (simulates container)
2. Click "Run Detection"
3. Check console for:
   - Canvas data sent to API
   - FastAPI processing logs
   - Generated code in code panel

**Expected Flow:**

```
1. Frontend captures canvas data
2. Sends POST to /api/generate-code
3. Next.js API route validates auth
4. Proxies to FastAPI /api/predict
5. FastAPI preprocesses canvas
6. Runs detection (fallback: OpenCV contours)
7. Generates code (fallback: templates)
8. Saves to Supabase iterations table
9. Returns code to frontend
10. Displays in code panel
```

### 4.4 Verify Database

1. Go to Supabase Dashboard → Table Editor
2. Check tables:
   - `profiles` - Should have your user
   - `projects` - Will populate when projects created
   - `iterations` - Should have iteration after detection
   - `canvas_snapshots` - Canvas save history

## Step 5: Model Training (Future)

### 5.1 Collect Training Data

Use the data labeling tool:

```bash
cd ml-training/utils
python data_labeling.py
```

1. Load sketch images
2. Draw bounding boxes
3. Label element types
4. Save annotations

### 5.2 Train Models

```bash
cd ml-training

# Install ML dependencies
pip install tensorflow tensorflow-datasets scikit-learn matplotlib jupyter

# Start Jupyter
jupyter notebook

# Open notebooks/01_sketch_detection_cnn.ipynb
# Follow instructions to train
```

### 5.3 Export Models

After training:

1. Models saved to `backend/models/sketch_detector.h5`
2. Restart FastAPI server
3. Models auto-load on startup
4. Detection switches from fallback to trained model

## Troubleshooting

### Frontend Issues

**"Module not found" errors:**

```bash
rm -rf node_modules .next
pnpm install
```

**Environment variables not loading:**

- Restart dev server after changing .env.local
- Check file name is exactly `.env.local`

### Backend Issues

**Import errors:**

```bash
# Make sure virtual environment is activated
pip install --upgrade -r requirements.txt
```

**Supabase connection fails:**

- Verify SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env
- Check network connectivity
- Verify Supabase project is running

**Port 8000 already in use:**

```bash
# Use different port
uvicorn main:app --reload --port 8001

# Update FASTAPI_URL in frontend .env.local
FASTAPI_URL=http://localhost:8001
```

### Database Issues

**RLS policies blocking access:**

- Verify user is authenticated
- Check policies in Supabase Dashboard → Authentication → Policies
- Temporarily disable RLS for testing (re-enable for production!)

**Migrations fail:**

- Run migrations one at a time
- Check for syntax errors
- Verify you're using SQL Editor, not psql

## Testing Checklist

- [ ] Supabase project created
- [ ] Environment variables configured
- [ ] Database migrations run successfully
- [ ] Frontend starts without errors (http://localhost:3000)
- [ ] Backend starts without errors (http://localhost:8000)
- [ ] User signup works
- [ ] User login works
- [ ] Mini canvas drawing works
- [ ] Design transfer to main canvas works
- [ ] Run Detection button triggers API
- [ ] Code appears in code panel
- [ ] Iteration saved to database

## Development Workflow

1. **Frontend changes:**
   - Edit files in `src/`
   - Hot reload automatic
   - Check browser console for errors

2. **Backend changes:**
   - Edit files in `backend/`
   - FastAPI auto-reloads with `--reload` flag
   - Check terminal for errors

3. **Database changes:**
   - Create new migration in `supabase/migrations/`
   - Run in SQL Editor
   - Update TypeScript types if schema changed

## Production Deployment

### Frontend (Vercel)

```bash
# Push to GitHub
git add .
git commit -m "Ready for deployment"
git push

# Deploy to Vercel
vercel --prod

# Add environment variables in Vercel dashboard
```

### Backend (Railway/Render)

```bash
# Create Dockerfile (already created)
# Push to GitHub
# Connect Railway/Render to repo
# Add environment variables
# Deploy
```

### Update Frontend API URL

```env
# .env.local (production)
FASTAPI_URL=https://your-backend.railway.app
```

## Next Steps

1. **Complete UI/UX**: Add loading states, error toasts, success messages
2. **Train Models**: Collect dataset, train CNN, improve accuracy
3. **Add Features**:
   - Project management (save/load/delete)
   - Export code to files
   - Preview rendered components
   - Collaboration features
4. **Optimize**:
   - Add caching
   - Implement rate limiting
   - Optimize model inference speed
5. **Documentation**: Write FYP report with architecture diagrams and metrics

## Resources

- [Next.js Docs](https://nextjs.org/docs)
- [FastAPI Docs](https://fastapi.tiangolo.com/)
- [Supabase Docs](https://supabase.com/docs)
- [TensorFlow Tutorials](https://www.tensorflow.org/tutorials)
- [React Konva Docs](https://konvajs.org/docs/react/)

# Deployment Guide - Backend to Railway

## Option 1: Deploy Backend to Railway (Recommended)

### Step 1: Create Railway Account
1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub

### Step 2: Deploy Backend
1. Click "New Project"
2. Select "Deploy from GitHub repo"
3. Connect your GitHub and select `Shiivanii6/ai-project`
4. Railway will automatically detect `Dockerfile` and deploy

### Step 3: Add Environment Variables
1. Go to your Railway project
2. Click on the backend service
3. Go to "Variables"
4. Add: `GOOGLE_GENAI_API_KEY` = your Gemini API key

### Step 4: Get Backend URL
1. Go to "Settings" → "Generate Domain"
2. You'll get a URL like: `https://your-project-production.up.railway.app`

### Step 5: Update Frontend
Create a `.env.local` file in `frontend/` directory:
```env
BACKEND_URL=https://your-railway-backend-url.railway.app
```

Update `frontend/src/app/api/parse-syllabus/route.ts` to use this environment variable (already configured).

### Step 6: Deploy Frontend to Vercel
1. Connect your GitHub repo to Vercel
2. Add the same environment variable in Vercel Project Settings
3. Deploy

---

## What's Included

- **Dockerfile**: Multi-stage Python build with FastAPI
- **railway.json**: Railway deployment configuration
- **.env.example**: Template for environment variables
- **Health Check**: Built-in endpoint at `/api/health`

---

## Testing the Deployment

### 1. Check Backend Health
```bash
curl https://your-backend-url.railway.app/api/health
```

Expected response:
```json
{
  "status": "ok",
  "ai_enabled": true,
  "ai_mode": "gemini"
}
```

### 2. Test Frontend Connection
1. Visit your Vercel URL
2. Upload a syllabus
3. Should generate roadmap without "backend connection" error

---

## Environment Variables Required

### Railway (Backend)
- `GOOGLE_GENAI_API_KEY` - Your Gemini API key

### Vercel (Frontend)
- `BACKEND_URL` - Your Railway backend URL (e.g., `https://your-project.railway.app`)

---

## Troubleshooting

### Backend shows error about API key
- Go to Railway Dashboard → Variables
- Verify `GOOGLE_GENAI_API_KEY` is set correctly
- Redeploy the service

### Frontend still shows "backend connection error"
- Check browser console for the actual error
- Verify `BACKEND_URL` is set in Vercel environment variables
- Verify the Railway backend is running (check Railway logs)

### Health check keeps failing
- Check Railway logs for Python errors
- Verify all dependencies in `requirements.txt` are compatible
- Try redeploying

---

## Costs

- **Railway**: Free tier with $5/month credit (usually sufficient for testing)
- **Vercel**: Free tier for frontend
- **Google Gemini API**: Pay-as-you-go (usually $0.10-1.00/month for light usage)

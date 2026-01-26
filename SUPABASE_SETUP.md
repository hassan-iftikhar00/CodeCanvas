# Supabase Backend Setup Guide

## 📋 Prerequisites

- Supabase account (https://supabase.com)
- Supabase CLI installed: `npm install -g supabase`

## 🚀 Quick Setup Steps

### 1. Create Supabase Project

1. Go to https://supabase.com/dashboard
2. Click "New Project"
3. Fill in project details and wait for setup to complete

### 2. Get Your Credentials

1. In your Supabase project dashboard, go to **Settings** → **API**
2. Copy the following values to your `.env.local` file:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (⚠️ Keep this secret!)

### 3. Run Database Migrations

Navigate to **SQL Editor** in Supabase Dashboard and run these migrations in order:

1. `supabase/migrations/20260122000001_initial_schema.sql`
2. `supabase/migrations/20260122000002_functions_and_triggers.sql`
3. `supabase/migrations/20260122000003_row_level_security.sql`
4. `supabase/migrations/20260122000004_storage_policies.sql`

Or use Supabase CLI:

```bash
supabase link --project-ref your-project-ref
supabase db push
```

### 4. Create Storage Buckets

1. Go to **Storage** in Supabase Dashboard
2. Create two buckets:
   - **sketch-exports** (Private)
   - **project-assets** (Private)

The RLS policies are already created via migration #4.

### 5. Enable Authentication Providers

1. Go to **Authentication** → **Providers**
2. Enable **Email** provider
3. (Optional) Enable **Google** provider:
   - Add Google OAuth credentials
   - Set redirect URL: `https://your-project-ref.supabase.co/auth/v1/callback`

### 6. Deploy Edge Function

```bash
# Login to Supabase CLI
supabase login

# Link your project
supabase link --project-ref your-project-ref

# Deploy the Edge Function with environment variables
supabase functions deploy generate-code \
  --env OPENAI_API_KEY=your_openai_key \
  --env SUPABASE_URL=your_supabase_url \
  --env SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 7. Test the Setup

1. Start your Next.js dev server: `pnpm dev`
2. Go to `/auth/signup` and create an account
3. Check Supabase Dashboard → **Table Editor** → **profiles**
4. You should see your profile auto-created!

## 📁 Project Structure

```
codecanvas/
├── src/
│   ├── lib/
│   │   └── supabase/
│   │       ├── client.ts          # Browser Supabase client
│   │       ├── server.ts          # Server Supabase client
│   │       └── middleware.ts      # Auth middleware
│   ├── app/
│   │   ├── auth/
│   │   │   ├── login/page.tsx     # Login page
│   │   │   ├── signup/page.tsx    # Signup page
│   │   │   └── callback/route.ts  # OAuth callback
│   │   └── api/
│   │       ├── generate-code/route.ts  # AI code generation endpoint
│   │       └── auth/
│   │           ├── user/route.ts       # Get current user
│   │           └── signout/route.ts    # Sign out endpoint
│   └── middleware.ts              # Next.js middleware for auth
├── supabase/
│   ├── migrations/                # Database migrations
│   │   ├── 20260122000001_initial_schema.sql
│   │   ├── 20260122000002_functions_and_triggers.sql
│   │   ├── 20260122000003_row_level_security.sql
│   │   └── 20260122000004_storage_policies.sql
│   └── functions/
│       └── generate-code/         # Edge Function for AI
│           └── index.ts
└── .env.local                     # Environment variables
```

## 🔐 Environment Variables

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# OpenAI (for code generation)
OPENAI_API_KEY=your-openai-key
```

## 📊 Database Schema

### Tables:

- **profiles**: User profiles (auto-created on signup)
- **projects**: User projects with canvas data
- **iterations**: Version history of code generations
- **canvas_snapshots**: PNG/SVG thumbnails

### Storage Buckets:

- **sketch-exports**: User sketch thumbnails
- **project-assets**: Project-related files

## 🔒 Security Features

✅ Row Level Security (RLS) enabled on all tables
✅ Users can only access their own data
✅ Public projects are read-only for non-owners
✅ Storage buckets have proper RLS policies
✅ API keys are server-side only (Edge Functions)
✅ Auth middleware protects routes

## 🧪 Testing Checklist

- [ ] Sign up creates profile automatically
- [ ] Login redirects to /canvas
- [ ] Can create a project
- [ ] Can generate code (via Edge Function)
- [ ] Projects list shows only user's projects
- [ ] Sign out clears session
- [ ] Protected routes require auth

## 🆘 Troubleshooting

**Auth not working?**

- Check environment variables are set correctly
- Verify middleware.ts is not excluded in next.config
- Check Supabase Dashboard → Authentication → Users

**Edge Function failing?**

- Verify OPENAI_API_KEY is set in function secrets
- Check function logs: `supabase functions logs generate-code`
- Test locally: `supabase functions serve generate-code`

**Database errors?**

- Run migrations in order
- Check RLS policies are enabled
- Verify user is authenticated

## 📚 Next Steps

1. Integrate auth UI with existing canvas page
2. Add project CRUD operations
3. Connect canvas to code generation API
4. Implement file upload for thumbnails
5. Add iteration history UI
6. Set up real-time collaboration (optional)

## 🔗 Useful Links

- [Supabase Docs](https://supabase.com/docs)
- [Supabase Auth with Next.js](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [Edge Functions Guide](https://supabase.com/docs/guides/functions)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)

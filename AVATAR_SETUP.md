# ⚠️ IMPORTANT: Avatar Upload Setup Required

## 🚨 Step-by-Step Setup (Must Complete Both Steps!)

### ✅ Step 1: Create the Bucket (DONE)

You've already created the `avatars` bucket - great!

### 🔒 Step 2: Apply Security Policies (DO THIS NOW!)

The bucket exists but needs Row Level Security (RLS) policies so users can upload files.

**Option A: Using Supabase SQL Editor (Easiest)**

1. Go to: https://supabase.com/dashboard
2. Click **"SQL Editor"** in the left sidebar
3. Click **"New query"**
4. Copy and paste this SQL:

```sql
-- RLS Policies for avatars bucket
CREATE POLICY "Users can upload their own avatars"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Anyone can view avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Users can update their own avatars"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own avatars"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
```

5. Click **"Run"** button
6. ✅ Done! Now try uploading again

**Option B: Using Supabase CLI**

```bash
supabase db push
```

Or run the specific migration:

```bash
supabase migration up
```

---

## Test It Works

1. Go to `/profile` in your app
2. Click "Choose Image"
3. Select an image file
4. Click "Save Changes"
5. ✅ Should upload successfully now!

---

## Quick Setup (2 minutes)

1. **Open Supabase Dashboard**
   - Go to: https://supabase.com/dashboard
   - Select your project: "codecanvas" (or your project name)

2. **Go to Storage**
   - Click **"Storage"** in the left sidebar
   - Click **"New bucket"** button (top right)

3. **Create the Bucket**
   - **Bucket name**: `avatars` (exactly this name)
   - **Public bucket**: ✅ **Check this box** (IMPORTANT!)
   - **File size limit**: Leave default or set to 5242880 (5MB)
   - **Allowed MIME types**: `image/jpeg, image/jpg, image/png, image/gif, image/webp`
   - Click **"Create bucket"**

4. **Apply Security Policies**
   - After creating the bucket, run this command:

   ```bash
   supabase db push
   ```

   - Or manually execute the SQL from: `supabase/migrations/20260122000005_avatar_storage.sql`

### Verify It Works

1. Go to `/profile` in your app
2. Click "Choose Image"
3. Select an image file
4. Click "Save Changes"
5. ✅ Avatar should upload successfully!

### If You Still Get Errors

Check the browser console for detailed error messages. Common issues:

- ❌ Bucket not created → Create it as described above
- ❌ Bucket not public → Edit bucket settings, enable "Public bucket"
- ❌ Wrong bucket name → Must be exactly "avatars"
- ❌ Supabase URL/keys wrong → Check `.env.local` file

---

## Method 1: Using Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **Storage** in the left sidebar
3. Click **"New bucket"**
4. Enter the following details:
   - **Name**: `avatars`
   - **Public bucket**: ✅ **Enable** (check this box)
   - **File size limit**: 5242880 (5MB)
   - **Allowed MIME types**: `image/jpeg, image/jpg, image/png, image/gif, image/webp`
5. Click **"Create bucket"**

### Method 2: Using Supabase CLI

```bash
supabase storage create avatars --public
```

### Apply RLS Policies

After creating the bucket, run the migration to set up the Row Level Security policies:

```bash
supabase migration up
```

Or manually execute the SQL from: `supabase/migrations/20260122000005_avatar_storage.sql`

The policies allow:

- ✅ Users to upload their own avatars
- ✅ Anyone to view avatars (public read)
- ✅ Users to update their own avatars
- ✅ Users to delete their own avatars

## Testing the Feature

1. Navigate to `/profile`
2. Click **"Choose Image"** button
3. Select an image file (max 5MB, JPEG/PNG/GIF/WebP)
4. Preview will show immediately
5. Click **"Save Changes"** to upload and save
6. Avatar will display throughout the app (header, dashboard, profile)

## Features

- **Upload from device**: Choose image files directly from your computer
- **URL input**: Or paste a URL to an existing image
- **Instant preview**: See changes before saving
- **Auto-update**: Full name and avatar changes reflect immediately
- **Validation**: File type and size validation
- **Secure storage**: Images stored in Supabase with proper access controls

## File Structure

```
src/
├── app/
│   ├── api/
│   │   ├── profile/route.ts          # Profile data API
│   │   └── upload-avatar/route.ts     # Avatar upload API
│   └── profile/
│       └── page.tsx                   # Profile page with upload
supabase/
└── migrations/
    └── 20260122000005_avatar_storage.sql  # Storage policies
```

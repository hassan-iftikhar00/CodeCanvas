# Supabase Database Setup Guide

## Step 1: Access Supabase SQL Editor

1. Go to your Supabase project dashboard: https://app.supabase.com
2. Select your CodeCanvas project
3. Click on **SQL Editor** in the left sidebar
4. Click **New Query**

## Step 2: Run Database Schema

Copy the entire contents of `supabase/schema.sql` and paste it into the SQL editor, then click **RUN**.

The schema will create:
- ✅ `projects` table - Stores user canvas projects
- ✅ `project_versions` table - Stores version history
- ✅ Row Level Security (RLS) policies - Users can only access their own data
- ✅ Indexes for performance
- ✅ Helper functions for timestamps and versioning

## Step 3: Verify Tables Created

1. Click on **Table Editor** in the left sidebar
2. You should see:
   - `projects` table
   - `project_versions` table
3. Check that RLS is enabled (shield icon should be active)

## Step 4: Test the Integration

1. Go to your CodeCanvas app
2. Try saving a project (it will use Supabase)
3. Check the **Table Editor** in Supabase - you should see your project data!

## Troubleshooting

**Error: "relation 'projects' already exists"**
- The tables were already created. You can skip this step or drop the existing tables first.

**Error: "permission denied"**
- Make sure you're signed in to your CodeCanvas app
- Check that RLS policies are enabled

**No data showing in tables**
- Make sure you've drawn something on the canvas
- Check browser console for errors

## What's Installed

✅ **Projects Table Schema:**
```sql
id          - UUID (primary key)
user_id     - UUID (links to auth.users)
name        - Text (project name)
description - Text (optional)
canvas_data - JSONB (all canvas data)
thumbnail   - Text (base64 or URL)
created_at  - Timestamp
updated_at  - Timestamp
```

✅ **Project Versions Table Schema:**
```sql
id             - UUID (primary key)
project_id     - UUID (links to projects)
version_number - Integer
canvas_data    - JSONB (snapshot)
created_at     - Timestamp
```

Your database is now ready for production! 🚀

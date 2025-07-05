# Database Setup Instructions

## Option A: Via Supabase Dashboard (Recommended)

1. Open your Supabase project: https://app.supabase.com/project/[your-project-id]
2. Go to "SQL Editor" in the left sidebar
3. Click "New Query"
4. Copy and paste the entire content from `supabase-schema.sql`
5. Click "Run" to execute the schema

## Option B: Via Supabase CLI

### Step 1: Login to Supabase CLI
Run in your terminal:
```bash
supabase login
```
This will open your browser to authenticate.

### Step 2: Link your project
```bash
supabase link --project-ref [your-project-id]
```
Your project ID is in your Supabase dashboard URL.

### Step 3: Apply the schema
```bash
supabase db push
```

## Option C: Direct SQL execution via CLI

If you prefer to run the schema directly:
```bash
# Set your database URL from your .env file
supabase db reset --linked
```

## Verification Steps

After running the schema, verify it worked by:

1. **Check tables exist**: Go to "Table Editor" in Supabase dashboard
2. **Verify data**: You should see:
   - `products` table with SSL-001 and SSK-001
   - `storages` table with 5 storage locations
   - `inventory` table with zero quantities
   - `transactions` table (empty)
   - `stock_alerts` table (empty)

3. **Test the app**: Run `npm run dev` and visit http://localhost:5173
   - You should see "Connected to Supabase ✅"
   - Total inventory should show "0 bottles"
   - Inventory by Location section should show all locations with 0 quantities

## Troubleshooting

If you see connection errors:
- Double-check your `.env` file has the correct `VITE_PUBLIC_SUPABASE_URL` and `VITE_PUBLIC_SUPABASE_ANON_KEY`
- Make sure the database schema was applied successfully
- Check the browser console for detailed error messages
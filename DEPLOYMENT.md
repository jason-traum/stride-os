# Deployment Guide for Dreamy (getdreamy.run)

## Quick Deploy to Vercel

The app is already deployed at: https://stride-os.vercel.app
New custom domain: https://getdreamy.run

To redeploy after changes:
```bash
npx vercel --prod
```

## Setting Up Custom Domain (getdreamy.run)

### 1. Add Domain in Vercel
```bash
vercel domains add getdreamy.run
```

Or via dashboard:
1. Go to https://vercel.com/dashboard
2. Select your project
3. Go to Settings → Domains
4. Add `getdreamy.run`

### 2. Configure DNS at Your Registrar
Add these records:

**For apex domain (getdreamy.run):**
- Type: A
- Name: @
- Value: 76.76.21.21

**For www redirect (optional):**
- Type: CNAME
- Name: www
- Value: cname.vercel-dns.com

### 3. Wait for DNS Propagation
- Check status: https://dnschecker.org/
- Usually takes 5-30 minutes

## Setting Up Production

### 1. Database Setup

The app uses SQLite locally but needs a PostgreSQL database in production.

#### Option A: Vercel Postgres
1. Go to Vercel Dashboard → Storage → Create Database
2. Choose Postgres
3. Copy the connection string

#### Option B: Supabase (Free tier)
1. Create account at supabase.com
2. Create new project
3. Go to Settings → Database
4. Copy the connection string

#### Option C: Neon (Free tier)
1. Create account at neon.tech
2. Create new project
3. Copy the connection string

### 2. Environment Variables

Add these in Vercel Dashboard → Settings → Environment Variables:

```env
# Required
DATABASE_URL=your_postgres_connection_string
ANTHROPIC_API_KEY=sk-ant-api03-xxxxx
NEXTAUTH_URL=https://getdreamy.run
NEXTAUTH_SECRET=generate_with_openssl_rand_base64_32

# AI Provider (use one)
OPENAI_API_KEY=your_openai_key

# Optional but recommended
OPENWEATHERMAP_API_KEY=your_api_key

# For Strava integration
NEXT_PUBLIC_STRAVA_CLIENT_ID=199902
STRAVA_CLIENT_SECRET=your_client_secret
STRAVA_WEBHOOK_VERIFY_TOKEN=your_verify_token
```

### 3. Running Migrations

After setting up the database, run migrations:

```bash
# Install Vercel CLI if needed
npm install -g vercel

# Run migrations on production
vercel env pull .env.production.local
npm run db:migrate
```

### 4. Monitoring

- View logs: `vercel logs stride-os.vercel.app`
- Check functions: Vercel Dashboard → Functions tab
- Monitor usage: Vercel Dashboard → Usage tab

## Troubleshooting

### Issue: "No database configured"
- Ensure DATABASE_URL is set in Vercel environment variables
- Check that the connection string is correct

### Issue: "API key not found"
- Add ANTHROPIC_API_KEY to environment variables
- Redeploy after adding: `vercel --prod`

### Issue: Chat responses not showing
- Check browser console for errors
- Try the test page: /test-chat
- Check API logs: `vercel logs --follow`

### Issue: Plan generation failing
- Ensure database migrations have run
- Check that the user has logged some workouts
- Try generating through coach chat instead of /plan page

## Development vs Production

| Feature | Development | Production |
|---------|------------|------------|
| Database | SQLite (local) | PostgreSQL (cloud) |
| File Storage | Local filesystem | Vercel Blob Storage |
| API Keys | .env.local | Vercel Environment Vars |
| Logging | Console | Vercel Logs |

## Useful Commands

```bash
# Deploy to preview
vercel

# Deploy to production
vercel --prod

# Check deployment status
vercel ls

# View logs
vercel logs stride-os.vercel.app --follow

# Rollback deployment
vercel rollback

# Run local with production env
vercel dev
```
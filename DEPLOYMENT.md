# Kith Messenger — Setup, Deployment & Operations Guide

Kith is an ultra-fast, minimalist, typography-first web messenger built for small friend groups (3–4 people).

---

## Architecture Overview

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS (Zero bloated libraries).
- **Backend / Database**: Supabase PostgreSQL.
- **Real-Time**: Supabase Realtime Channels (PostgreSQL CDC + Broadcast + Presence).
- **Storage**: Supabase Storage (`kith_attachments` bucket, 48 MB limit per file).
- **Hosting**: Vercel (Hobby Free Tier) or Cloud Run / Vite preview.
- **Offline / Local Fallback**: Instant cross-tab real-time sync via `BroadcastChannel` + `localStorage` and client blob store when running without cloud credentials.

---

## 1. Supabase Setup (5 Minutes)

### Step 1: Create a Free Project
1. Go to [supabase.com](https://supabase.com) and create an account.
2. Click **New project**, choose an organization, name it (e.g. `kith-messenger`), select your nearest cloud region, and set a database password.
3. Wait ~1 minute for the project to provision.

### Step 2: Run the SQL Migration
1. In your Supabase Dashboard, open the **SQL Editor** tab from the left navigation.
2. Click **New query**.
3. Copy the entire contents of the `supabase-schema.sql` file in this repository and paste it into the editor.
4. Click **Run**.
5. You should see a green success message confirming all tables, indexes, RLS policies, and realtime publications have been created.

### Step 3: Create the Storage Bucket
1. Go to **Storage** in the left menu of the Supabase dashboard.
2. Click **New bucket**.
3. Name the bucket exactly: `kith_attachments`.
4. Toggle **Public bucket** to **ON** (or leave private if using signed URLs).
5. Set the **File size limit** to `50MB` (Kith frontend client enforces a safe `48MB` maximum to guarantee room under Supabase's 50MB free quota).
6. Click **Save bucket**.
7. Under bucket policies, ensure **Insert** and **Select** are allowed for the `anon` role.

### Step 4: Verify Realtime
1. Go to **Database** -> **Replication**.
2. Confirm that `supabase_realtime` is enabled for:
   - `messages`
   - `message_reactions`
   - `members`
   - `conversations`
   - `conversation_members`
   - `attachments`
*(The `supabase-schema.sql` script configures this automatically).*

### Step 5: Get Project API Keys
1. Go to **Project Settings** -> **API**.
2. Copy the **Project URL** (`https://xyzcompany.supabase.co`).
3. Copy the **anon / public** key (`eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`).
4. **NEVER** expose the `service_role` key in frontend environment variables.

---

## 2. Environment Variables Configuration

Create a `.env` file in the root directory:

```bash
# Supabase Configuration
VITE_SUPABASE_URL="https://your-project-id.supabase.co"
VITE_SUPABASE_ANON_KEY="your-anon-public-key"

# Optional: Giphy API Key for live GIF search (free at developers.giphy.com)
VITE_GIPHY_API_KEY=""
```

*Note: You can also connect your Supabase credentials directly through the in-app "Supabase Connection" dialog in the top-bar.*

---

## 3. Deploying to Vercel (Free Hobby Plan)

1. Push your repository to GitHub.
2. Go to [vercel.com](https://vercel.com) and log in.
3. Click **Add New** -> **Project**.
4. Import your GitHub repository.
5. In the **Environment Variables** section, add:
   - `VITE_SUPABASE_URL`: Your Supabase URL
   - `VITE_SUPABASE_ANON_KEY`: Your Supabase anon public key
   - `VITE_GIPHY_API_KEY`: (Optional)
6. Framework Preset: **Vite**.
7. Build Command: `npm run build`
8. Output Directory: `dist`
9. Click **Deploy**.

Your app is live with SSL, global CDN, and automatic Git-based deploys.

---

## 4. Free-Tier Cost & Quota Analysis

| Resource | Supabase Free Limit | Kith Usage & Headroom |
| :--- | :--- | :--- |
| **Database Storage** | 500 MB | ~100 KB for 10,000 text messages. 500 MB holds ~5,000,000 chat messages. |
| **File Storage** | 1 GB Free | Safe for hundreds of photos and docs; files are capped at 48 MB each. |
| **Realtime Messages** | 2,000,000 messages / month | For 4 friends sending 200 msgs/day, monthly usage is ~24,000 messages (1.2% of free quota). |
| **Realtime Connections** | 200 concurrent clients | 4 friends $\times$ 2 devices = 8 connections (4% of quota). |
| **Vercel Hosting** | 100 GB bandwidth / month | Kith bundle is under 150 KB gzipped. Thousands of page views consume <1 GB. |

**Verdict**: 100% free with massive headroom for a group of 3–4 friends.

---

## 5. Security & Privacy Notes

1. **Client Identity**: Kith uses a lightweight stored identity (display name + persistent member UUID) for maximum simplicity.
2. **Database Integrity**: All messages and attachments link to valid member UUIDs.
3. **File Sanitization**: Path traversal attacks (`../`), script tags, and illegal characters are stripped from filenames before storage.
4. **Zero Secrets in Frontend**: Only the public `anon` key is configured in the browser. The `service_role` key is never bundled.

---

## 6. Troubleshooting

- **Messages not appearing in real time?**
  Ensure table replication is enabled in Supabase under Database -> Replication -> `supabase_realtime`.
- **Upload fails with 403 Forbidden?**
  Check that the storage bucket `kith_attachments` exists and has an RLS policy allowing anon insert.
- **Testing without Supabase?**
  Kith includes a built-in cross-tab `BroadcastChannel` local engine. Open two browser windows or incognito tabs side-by-side to test real-time messaging, file sharing, and reactions locally!

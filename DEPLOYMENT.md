# AutoManage - SaaS Rent Car Platform Deployment Guide

## 1. Supabase Setup
1. Create a new project on [Supabase](https://supabase.com).
2. Go to the **SQL Editor** in your Supabase dashboard.
3. Copy the contents of the `supabase.sql` file provided in this repository and run it to create tables, custom types, functions, and RLS policies.
4. Go to **Authentication** > **Providers** and ensure Email provider is enabled. Disable "Confirm Email" if you want manual creation to be immediate.
5. Get your project's URL and Anon Key from **Project Settings** > **API**.

## 2. Environment Variables
In your local environment and in Vercel, set the following environment variables:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 3. Creating the First Admin
Since there is no public signup, you must create the first admin manually.
1. Go to **Authentication** > **Users** in Supabase and click **Add User** -> **Create New User**.
2. Enter the email and password for the admin.
3. Go to the **Table Editor**, open the `profiles` table.
4. Find the newly created user and change their `role` column to `admin`.

## 4. Vercel Deployment
1. Push your code to a GitHub repository.
2. Log in to [Vercel](https://vercel.com) and click **Add New** > **Project**.
3. Import your GitHub repository.
4. In the configuration step, ensure the framework preset is **Next.js**.
5. Add your Environment Variables (`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
6. Click **Deploy**.

## 5. Usage Flow
- **Super Admin**: Logs in via `/login`, gets redirected to `/admin`. Can manually create owner accounts via Supabase (or a future built-in admin panel feature) and set their roles to `owner`.
- **Owner**: Receives credentials from the Admin, logs in via `/login`, and gets redirected to `/dashboard`. They manage their fleet completely isolated via Row Level Security.

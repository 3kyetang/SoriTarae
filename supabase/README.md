# SoriTarae database changes

The versioned SQL files in `migrations/` are the only files intended for
automatic deployment with the Supabase CLI.

The files in `rollbacks/` are destructive, development-only recovery tools.
Never run them automatically or against a production database containing
real diary data.

The first migration creates `public.diaries`, enables Row Level Security, and
allows authenticated users to read and change only rows whose `user_id`
matches their verified Supabase Auth identity.

The second migration adds the `manual` diary style for entries written directly
by the user without Gemini processing.

Applying a migration changes the Supabase database. Reverting a Git commit does
not undo a migration that has already been applied.

## Authentication dashboard settings

Set these values in Supabase Dashboard > Authentication > URL Configuration:

- Site URL: `https://voicelog-six.vercel.app`
- Redirect URL: `http://localhost:3000/auth/confirm`
- Redirect URL: `http://localhost:3000/auth/confirm?next=/auth/update-password`
- Redirect URL: `http://localhost:3000/auth/update-password`
- Redirect URL: `https://voicelog-six.vercel.app/auth/confirm`
- Redirect URL: `https://voicelog-six.vercel.app/auth/confirm?next=/auth/update-password`
- Redirect URL: `https://voicelog-six.vercel.app/auth/update-password`

SoriTarae supports the unmodified default Supabase email templates through the
PKCE `code` callback. New Free projects using Supabase's default email provider
can keep those templates unchanged.

The HTML files in `email-templates/` are optional reference snippets only for
projects on a plan that permits template editing or projects configured with a
custom SMTP provider. They are not deployed automatically.

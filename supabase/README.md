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

The third migration prepares permission-aware RAG storage:

- enables `pgvector` in the `extensions` schema;
- stores one 768-dimensional `jhgan/ko-sroberta-multitask` embedding per diary;
- applies owner-only RLS policies to embeddings;
- exposes an authenticated cosine-similarity RPC capped at 20 results; and
- removes a diary's stale embedding whenever its source text changes.

The migration only prepares storage and retrieval. It does not download or run
the embedding model. Embedding generation must be added as a separate
server-side service so model credentials and infrastructure remain isolated
from the browser.

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

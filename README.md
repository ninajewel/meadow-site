# The Meadow — website interface

Your daily dose of wonder, wisdom and wonderful things.

This repository contains only the public website interface and its build/publishing workflow. Editions, votes, preferences and written feedback are stored privately in Supabase and are never included in the published files. Sign-in and database authorization are required to retrieve them.

The interface is copied unchanged from the main Meadow application. Daily generation runs separately in the private generator repository. This repository has no scheduled workflow and does not deploy on a push.

## One-time setup

In **Settings → Secrets and variables → Actions → Variables**, add:

- `MEADOW_SUPABASE_URL`: the Supabase HTTPS project URL.
- `MEADOW_SUPABASE_PUBLIC_KEY`: the publishable or legacy anon key. **Never use a secret or service-role key here.**
- `MEADOW_GENERATOR_REPOSITORY`: `ninajewel/beth-daily`.

In **Settings → Pages**, choose **GitHub Actions** as the source. Then open **Actions → Publish Meadow interface → Run workflow** and confirm **Run workflow**. Open the actual URL from the successful deployment; no live website is claimed merely by this source-code upload.

The workflow builds only safe interface assets and refuses secret/service-role API keys. Your full private setup and owner-registration guide remains in the private generator repository at `docs/SETUP.md`.

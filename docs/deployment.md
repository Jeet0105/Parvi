# Deploying to Render

## Why the first deploy failed

The backend started, then exited with:

```
Database connection failed. Please verify your DATABASE_URL and database status.
Connection details: { host: 'localhost:5433' }
code: 'ECONNREFUSED'
```

`localhost:5433` is the **Docker Postgres container on the development machine**.
Render ran the app on its own server, where nothing is listening on that port,
so the connection was refused.

The cause is `DATABASE_URL` being set to the local development value. The local
`.env` is gitignored and never reaches Render, so the value had to have been
entered into the Render dashboard by hand.

Two things were missing beyond that:

- **No migrations ran.** The build command was `npm install`, which generates the
  Prisma client but never applies migrations. Even with a correct `DATABASE_URL`,
  every query would have failed because no tables existed.
- **Nothing linked the app to a database.** With no blueprint, the connection
  string was a manual dashboard entry that could drift or be mistyped.

## The fix

`render.yaml` in the repository root now declares the database and both services,
and wires `DATABASE_URL` from the database Render provisions. The value is no
longer something anyone types.

The backend also refuses to start if `DATABASE_URL` points at localhost while
`NODE_ENV=production`, so the same mistake now produces a message naming the
problem instead of an opaque `ECONNREFUSED`.

## Deploying with the blueprint (recommended)

1. Push this branch to GitHub.
2. In Render: **New → Blueprint**, then select the repository.
3. Render reads `render.yaml` and creates:
   - `fip-postgres` — the PostgreSQL database
   - `fip-backend` — the API, with `DATABASE_URL` and `JWT_SECRET` filled in automatically
   - `fip-frontend` — the static React build
4. Two values cannot be inferred, so Render prompts for them:
   - **`VITE_API_URL`** on the frontend → `https://<your-backend>.onrender.com/api`
   - **`CORS_ORIGIN`** on the backend → `https://<your-frontend>.onrender.com`

   Both services must exist before their URLs are known. Deploy once, copy the
   two URLs from the dashboard, set the values, then redeploy.
5. Seed the government accounts, which cannot be self-registered. In the backend
   service's **Shell** tab:

   ```bash
   npm run db:seed
   ```

## Fixing the existing services instead

If the services already exist and you would rather not recreate them:

1. Create a PostgreSQL instance in Render if there is none.
2. On the backend service, set `DATABASE_URL` to that instance's
   **Internal Database URL** — not the local Docker URL, and not the External URL
   unless connecting from outside Render.
3. Set the build command to:

   ```bash
   npm ci && npx prisma migrate deploy
   ```

4. Confirm these are set on the backend:

   | Variable | Value |
   | --- | --- |
   | `NODE_ENV` | `production` |
   | `DATABASE_URL` | Internal Database URL from Render Postgres |
   | `JWT_SECRET` | a long random string, not the development value |
   | `CORS_ORIGIN` | the frontend's Render URL |

5. Redeploy.

## Notes worth knowing before the demo

**Uploaded documents do not survive a deploy.** Render wipes the instance
filesystem on every deploy and restart, so files under `backend/uploads` are
lost while their database rows remain, leaving documents that 404 on download.
A persistent disk fixes it but requires a paid instance; the commented `disk:`
block in `render.yaml` shows the configuration. For anything beyond a demo the
right answer is S3-compatible object storage, which the document service was
written to accommodate.

**The free database expires.** Render's free PostgreSQL is deleted after 30 days.
Take a dump before a deadline if the data matters.

**Free instances sleep.** After ~15 minutes idle a free service spins down, and
the next request takes 30–60 seconds while it restarts. Open the app a minute
before demonstrating it.

**Node version is pinned.** Render defaulted to Node 24 while the project was
built and tested on Node 22, and `bcrypt` compiles a native binding. Both
`package.json` files now declare `"engines": { "node": ">=22 <23" }` so the
deployed runtime matches the tested one.

**TLS.** The pool enables TLS for any non-local host in production. If a provider
disagrees, `DATABASE_SSL=false` (or `true`) overrides it without a code change.

## Checking a deploy worked

```bash
curl https://<your-backend>.onrender.com/api/health
```

```json
{ "success": true, "message": "Family Identity Platform API is running" }
```

That response means the process is up. It does **not** prove the database is
reachable — but `connectDatabase()` runs before `listen()`, so a service that
answers at all has already completed a `SELECT 1` against PostgreSQL.

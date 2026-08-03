# SoriTarae local embedding service

This private Python service loads `jhgan/ko-sroberta-multitask` and returns
normalized 768-dimensional embeddings. It must be called only by the
SoriTarae Next.js server.

## Windows setup

The PyTorch package contains deeply nested files. On Windows, keep the virtual
environment in a short path so installation does not exceed the legacy path
length limit. Run:

```powershell
$soriVenv = "C:\soritarae-venv"
& "$soriVenv\Scripts\python.exe" -m pip install -r requirements.txt
```

Copy `.env.example` to `.env.local`. Replace the token placeholder with a
random value containing at least 32 characters. Use the same token in the
root Next.js `.env.local`.

Verify the downloaded model before starting the web service:

```powershell
& "$soriVenv\Scripts\python.exe" verify_model.py
```

The successful result contains `dimensions=768` and `normalized=True`.

Start the service:

```powershell
& "$soriVenv\Scripts\python.exe" -m uvicorn app:app --host 127.0.0.1 --port 8001
```

The first start downloads the model files, so it can take several minutes.
Keep this terminal open while testing SoriTarae locally.

## Production deployment

The included `Dockerfile` is intended for a private SoriTarae Cloud Run
service:

- The fixed model is downloaded while the image is built, not during a user
  request.
- The container runs as a non-root user.
- Local `.env` files are excluded from the container build context.
- The server listens on Cloud Run's `PORT` value.
- `/health` and `/embed` both require the shared bearer token.

Recommended Cloud Run settings:

```text
Service name: soritarae-embedding
Region: asia-northeast3 (Seoul)
CPU: 1
Memory: 2 GiB
Concurrency: 1
Minimum instances: 0
Maximum instances: 1
Request timeout: 300 seconds
```

Store `EMBEDDING_SERVICE_TOKEN` in Google Secret Manager and expose that
secret to the container as an environment variable with the same name. The
service must accept network requests from Vercel, but application access is
still denied unless the caller supplies this bearer token.

After Cloud Run returns an HTTPS service URL, configure the Vercel project:

```dotenv
EMBEDDING_SERVICE_URL=https://your-cloud-run-service-url
EMBEDDING_SERVICE_TOKEN=the_same_secret_value
```

Apply both variables to Preview and Production, and redeploy after changing
them. Never paste the token into a GitHub file, issue, commit, or deployment
URL.

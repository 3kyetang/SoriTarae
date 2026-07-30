# SoriTarae local embedding service

This private Python service loads `jhgan/ko-sroberta-multitask` and returns
normalized 768-dimensional embeddings. It must be called only by the
SoriTarae Next.js server.

## Windows setup

The PyTorch package contains deeply nested files. On Windows, keep the virtual
environment in a short path so installation does not exceed the legacy path
length limit. Run:

```powershell
$soriVenv = "C:\Users\gangt\Documents\Codex\.venvs\soritarae"
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

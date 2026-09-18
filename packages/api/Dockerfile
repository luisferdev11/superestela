# One Python version, one dependency set, on every machine and in CI.
# Two people on this team are on Windows and two on Linux; this is the file
# that stops "en mi máquina sí corre" from costing us a day we do not have.
FROM python:3.12-slim

COPY --from=ghcr.io/astral-sh/uv:0.12.16 /uv /uvx /bin/

WORKDIR /app

# Dependencies first, so that a code change does not invalidate this layer.
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --extra api --no-install-project

COPY packages/ packages/
RUN uv sync --frozen --extra api

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"

CMD ["uv", "run", "uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]

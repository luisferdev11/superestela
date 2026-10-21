# SuperEstela as one Hugging Face Space (Docker SDK): the Next.js web on :7860,
# the only port a Space exposes, and the FastAPI API with the models on an
# internal :8000. docs/17.
#
# The Space repository holds only this file and its README: the code comes
# from the private GitHub repository and the models from its release, both
# with GH_TOKEN, a build secret. Nothing licensed sits in the public Space.
#
# Local test, from this folder:
#   GH_TOKEN=$(gh auth token) docker build --secret id=GH_TOKEN,env=GH_TOKEN -t superestela .
#   docker run -p 7860:7860 -e SUPERESTELA_BASIC_AUTH=jurado:clave superestela

# ---- 1. Code and models --------------------------------------------------
FROM python:3.12-slim AS source
RUN apt-get update && apt-get install -y --no-install-recommends git curl ca-certificates jq \
    && rm -rf /var/lib/apt/lists/*
ARG REPO=luisferdev11/superestela
# A Space variable of the same name picks another branch or tag.
ARG GIT_REF=main
WORKDIR /src
RUN --mount=type=secret,id=GH_TOKEN,mode=0444,required=true \
    git clone --depth 1 --branch "$GIT_REF" \
      "https://x-access-token:$(cat /run/secrets/GH_TOKEN)@github.com/$REPO.git" repo \
    && rm -rf repo/.git repo/data repo/mlFlow repo/notebooks
# The zip named in models.lock.json, from the release's API (the asset is private).
RUN --mount=type=secret,id=GH_TOKEN,mode=0444,required=true \
    TOKEN=$(cat /run/secrets/GH_TOKEN) \
    && RELEASE=$(jq -r .release repo/models.lock.json) && FILE=$(jq -r .file repo/models.lock.json) \
    && ASSET=$(curl -fsSL -H "Authorization: Bearer $TOKEN" \
         "https://api.github.com/repos/$REPO/releases/tags/$RELEASE" \
         | jq -r --arg f "$FILE" '.assets[] | select(.name == $f) | .url') \
    && curl -fsSL -H "Authorization: Bearer $TOKEN" -H "Accept: application/octet-stream" \
         -o /tmp/models.zip "$ASSET"

# ---- 2. The web's production build --------------------------------------
FROM node:22-slim AS web
# The pnpm the lockfile was written with (engines: >=10 <11); corepack's latest is not.
RUN corepack enable && corepack prepare pnpm@10.18.0 --activate
WORKDIR /app
COPY --from=source /src/repo /app
WORKDIR /app/packages/web
RUN pnpm install --frozen-lockfile && pnpm build && pnpm prune --prod

# ---- 3. Runtime: Python for the API, Node for the web -------------------
FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:0.12.16 /uv /uvx /bin/
COPY --from=web /usr/local/bin/node /usr/local/bin/node
# Spaces run as user 1000; everything the app writes lives under its home.
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    UV_PROJECT_ENVIRONMENT=/home/user/venv \
    UV_CACHE_DIR=/home/user/.cache/uv
WORKDIR /home/user/app
COPY --chown=user --from=source /src/repo /home/user/app
RUN uv sync --frozen --extra api
# Checks the zip against models.lock.json (sha256) and loads every model once.
COPY --chown=user --from=source /tmp/models.zip /tmp/models.zip
RUN uv run --no-sync python scripts/fetch_models.py --zip /tmp/models.zip
COPY --chown=user --from=web /app/packages/web/.next packages/web/.next
COPY --chown=user --from=web /app/packages/web/node_modules packages/web/node_modules
COPY --chown=user start.sh /home/user/start.sh

ENV NODE_ENV=production SUPERESTELA_API_URL=http://127.0.0.1:8000
EXPOSE 7860
CMD ["sh", "/home/user/start.sh"]

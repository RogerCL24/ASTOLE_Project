FROM python:3.11-slim

WORKDIR /app

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install only the packages needed by the agents-api layer.
# torch and sentence-transformers are NOT installed here — those are only
# needed by rag-api (chromadb embeddings). This keeps the image lean.
RUN pip install --no-cache-dir \
    fastapi>=0.115.0 \
    "uvicorn[standard]>=0.30.0" \
    pydantic>=2.5.0 \
    python-dotenv>=1.0.0 \
    litellm>=1.40.0 \
    "langchain-core>=0.3.0" \
    langgraph>=0.2.0 \
    httpx>=0.27.0 \
    redis>=5.0.0 \
    pyyaml>=6.0.1

COPY . .

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD python -c "import httpx; httpx.get('http://localhost:8000/health').raise_for_status()"

CMD ["uvicorn", "src.agents.main:app", "--host", "0.0.0.0", "--port", "8000"]

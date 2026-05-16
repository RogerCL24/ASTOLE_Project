FROM python:3.11-slim

WORKDIR /app

# System deps needed to compile chromadb / sentence-transformers
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install only the packages needed by the rag-api layer.
# langchain, langgraph, litellm are NOT installed here — they are only
# needed by agents-api. This keeps the image focused on its single
# responsibility: vector-search over ChromaDB.
#
# torch is installed CPU-only to avoid the multi-GB CUDA bundles that
# would exhaust the GitHub Actions runner disk.
RUN pip install --no-cache-dir \
    fastapi>=0.115.0 \
    "uvicorn[standard]>=0.30.0" \
    pydantic>=2.5.0 \
    python-dotenv>=1.0.0 \
    httpx>=0.27.0 \
    chromadb>=0.5.0 \
    "sentence-transformers>=3.0.0" \
    "torch>=2.3.0" --extra-index-url https://download.pytorch.org/whl/cpu \
    "pysqlite3-binary; platform_system != 'Windows'"

COPY . .

EXPOSE 8001

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD python -c "import httpx; httpx.get('http://localhost:8001/health').raise_for_status()"

CMD ["uvicorn", "src.memory.rag_api:app", "--host", "0.0.0.0", "--port", "8001"]

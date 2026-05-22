"""
ChromaDB Manager - Gestión de memoria vectorial
Ingeniero 3: Andrea Blanco
Milestone 2: Storage Feed

Actualizado M4: IPs y tipos de ataque en metadata para filtrado exacto
"""

import chromadb
from sentence_transformers import SentenceTransformer
import pandas as pd
from pathlib import Path
from typing import Optional
import os


class MemoryManager:
    def __init__(self, persist_directory="src/memory/chromadb_data", chroma_host: str = ""):
        print("[MemoryManager] Initializing...")

        host = chroma_host or os.getenv("CHROMA_HOST", "")
        port = int(os.getenv("CHROMA_PORT", "8002"))

        if host:
            print(f"[MemoryManager] Docker mode: connecting to {host}:{port}")
            self.client = chromadb.HttpClient(host=host, port=port)
        else:
            Path(persist_directory).mkdir(parents=True, exist_ok=True)
            print(f"[MemoryManager] Local mode: {persist_directory}")
            self.client = chromadb.PersistentClient(path=persist_directory)

        self.collection = self.client.get_or_create_collection(
            name="netflow_windows",
            metadata={"description": "Ventanas de tráfico de red 60s"}
        )

        print("[MemoryManager] Loading embedding model...")
        self.embedder = SentenceTransformer('all-MiniLM-L6-v2', device='cpu')
        print("[MemoryManager] Ready\n")

    def add_netflow_window(self, window_id: str, dataframe: pd.DataFrame):
        if dataframe.empty:
            print(f"[MemoryManager] {window_id} is empty, skipping...")
            return

        print(f"[MemoryManager] Indexing {window_id} ({len(dataframe)} flows)...")

        text = self._dataframe_to_text(dataframe, window_id)
        embedding = self.embedder.encode(text).tolist()

        # Ataques
        attacks = dataframe[dataframe['Label'] == 1] if 'Label' in dataframe.columns else pd.DataFrame()

        # IPs top 5 para filtrado exacto
        top_src_ips = dataframe['IPV4_SRC_ADDR'].value_counts().head(10).index.tolist() if 'IPV4_SRC_ADDR' in dataframe.columns else []
        top_dst_ips = dataframe['IPV4_DST_ADDR'].value_counts().head(10).index.tolist() if 'IPV4_DST_ADDR' in dataframe.columns else []
        attack_types = attacks['Attack'].unique().tolist() if 'Attack' in attacks.columns and not attacks.empty else []

        metadata = {
            "window_id": window_id,
            "flows_count": len(dataframe),
            "attacks_count": int(dataframe['Label'].sum()) if 'Label' in dataframe.columns else 0,
            "timestamp": int(dataframe['FLOW_START_MILLISECONDS'].min()) if 'FLOW_START_MILLISECONDS' in dataframe.columns else 0,
            # Nuevo M4 — para filtrado exacto por IP y tipo de ataque
            "top_src_ips": ",".join(map(str, top_src_ips)),
            "top_dst_ips": ",".join(map(str, top_dst_ips)),
            "attack_types": ",".join(map(str, attack_types)),
        }

        try:
            self.collection.add(
                documents=[text],
                embeddings=[embedding],
                metadatas=[metadata],
                ids=[window_id]
            )
            print(f"[MemoryManager] {window_id} indexed")
        except Exception as e:
            error_msg = str(e).lower()
            if "already exists" in error_msg or "duplicate" in error_msg:
                print(f"[MemoryManager] {window_id} already exists, updating...")
                self.collection.update(
                    documents=[text],
                    embeddings=[embedding],
                    metadatas=[metadata],
                    ids=[window_id]
                )
                print(f"[MemoryManager] {window_id} updated")
            else:
                raise

    def _dataframe_to_text(self, df: pd.DataFrame, window_id: str) -> str:
        total_flows = len(df)
        attacks = df[df['Label'] == 1] if 'Label' in df.columns else pd.DataFrame()
        attacks_count = len(attacks)
        top_src_ips = df['IPV4_SRC_ADDR'].value_counts().head(3).index.tolist() if 'IPV4_SRC_ADDR' in df.columns else []
        top_dst_ips = df['IPV4_DST_ADDR'].value_counts().head(3).index.tolist() if 'IPV4_DST_ADDR' in df.columns else []
        attack_types = attacks['Attack'].value_counts().to_dict() if 'Attack' in attacks.columns and not attacks.empty else {}
        top_dst_ports = df['L4_DST_PORT'].value_counts().head(3).index.tolist() if 'L4_DST_PORT' in df.columns else []

        text = f"""
Ventana {window_id}:
- Total flujos: {total_flows}
- Ataques detectados: {attacks_count}
- IPs origen frecuentes: {', '.join(map(str, top_src_ips))}
- IPs destino frecuentes: {', '.join(map(str, top_dst_ips))}
- Puertos destino comunes: {', '.join(map(str, top_dst_ports))}
- Tipos de ataque: {', '.join([f'{k}: {v}' for k, v in attack_types.items()])}
        """
        return text.strip()

    def search_similar(self, query: str, n_results: int = 3, where: Optional[dict] = None):
        """
        Buscar ventanas similares con filtrado opcional por metadata.

        Args:
            query: Texto de búsqueda semántica
            n_results: Número de resultados
            where: Filtro ChromaDB (ej: {"top_src_ips": {"$contains": "175.45.176.0"}})
        """
        print(f"[MemoryManager] Querying: '{query}'")

        empty = {"ids": [[]], "documents": [[]], "metadatas": [[]], "distances": [[]]}

        count = self.collection.count()
        if count == 0:
            print("[MemoryManager] Collection empty, skipping query.\n")
            return empty

        want = max(1, int(n_results))
        effective_n = min(want, count)

        query_kwargs = {
            "query_texts": [query],
            "n_results": effective_n,
        }

        if where:
            query_kwargs["where"] = where

        results = self.collection.query(**query_kwargs)

        row = results.get("ids") or [[]]
        print(f"[MemoryManager] Retrieved {len(row[0])} results\n")

        return results

    def get_stats(self):
        count = self.collection.count()
        return {
            "total_windows": count,
            "collection_name": self.collection.name
        }

    def delete_collection(self):
        """Borrar colección para re-indexar desde cero."""
        self.client.delete_collection("netflow_windows")
        self.collection = self.client.get_or_create_collection(
            name="netflow_windows",
            metadata={"description": "Ventanas de tráfico de red 60s"}
        )
        print("[MemoryManager] Collection deleted and recreated")
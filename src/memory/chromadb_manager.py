"""
ChromaDB Manager - Gestión de memoria vectorial
Ingeniero 3: Andrea Blanco
Milestone 2: Storage Feed
"""

import chromadb
from sentence_transformers import SentenceTransformer
import pandas as pd
from pathlib import Path


class MemoryManager:
    """
    Gestor de ChromaDB para indexar ventanas de tráfico de red.
    
    Funcionalidades:
    - Indexar ventanas de 60s
    - Búsqueda semántica
    - Persistencia local
    """
    
    def __init__(self, persist_directory="src/memory/chromadb_data"):
        """
        Inicializar ChromaDB y modelo de embeddings.
        
        Args:
            persist_directory: Ruta donde persistir ChromaDB
        """
        # Crear directorio si no existe
        Path(persist_directory).mkdir(parents=True, exist_ok=True)
        
        print("[MemoryManager] Initializing...")
        
        # Cliente ChromaDB persistente
        self.client = chromadb.PersistentClient(path=persist_directory)
        
        # Collection para ventanas
        self.collection = self.client.get_or_create_collection(
            name="netflow_windows",
            metadata={"description": "Ventanas de tráfico de red 60s"}
        )
        
        # Modelo embeddings
        print("[MemoryManager] Loading embedding model...")
        # Forzar dispositivo CPU para evitar requisitos de GPU/instalaciones especiales
        self.embedder = SentenceTransformer('all-MiniLM-L6-v2', device='cpu')
        print("[MemoryManager] Ready\n")
    
    def add_netflow_window(self, window_id: str, dataframe: pd.DataFrame):
        """
        Indexar ventana de 60s en ChromaDB.
        
        Args:
            window_id: ID único de la ventana (ej: "window_001")
            dataframe: DataFrame con datos de la ventana
        """
        if dataframe.empty:
            print(f"[MemoryManager] {window_id} is empty, skipping...")
            return
        
        print(f"[MemoryManager] Indexing {window_id} ({len(dataframe)} flows)...")
        
        # Convertir DataFrame a texto descriptivo
        text = self._dataframe_to_text(dataframe, window_id)
        
        # Generar embedding
        embedding = self.embedder.encode(text).tolist()
        
        # Metadata
        metadata = {
            "window_id": window_id,
            "flows_count": len(dataframe),
            "attacks_count": int(dataframe['Label'].sum()) if 'Label' in dataframe.columns else 0,
            "timestamp": int(dataframe['FLOW_START_MILLISECONDS'].min()) if 'FLOW_START_MILLISECONDS' in dataframe.columns else 0
        }
        
        # Guardar en ChromaDB (con manejo de duplicados)
        try:
            self.collection.add(
                documents=[text],
                embeddings=[embedding],
                metadatas=[metadata],
                ids=[window_id]
            )
            print(f"[MemoryManager] {window_id} indexed")
        except Exception as e:
            # Si ya existe, actualizar
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
                # Otro tipo de error, re-lanzar
                raise
    
    def _dataframe_to_text(self, df: pd.DataFrame, window_id: str) -> str:
        """
        Convertir DataFrame a texto descriptivo para embeddings.
        
        Args:
            df: DataFrame con flujos
            window_id: ID de la ventana
            
        Returns:
            Texto descriptivo de la ventana
        """
        # Resumen de la ventana
        total_flows = len(df)
        
        # Ataques
        attacks = df[df['Label'] == 1] if 'Label' in df.columns else pd.DataFrame()
        attacks_count = len(attacks)
        
        # IPs más frecuentes
        top_src_ips = df['IPV4_SRC_ADDR'].value_counts().head(3).index.tolist() if 'IPV4_SRC_ADDR' in df.columns else []
        top_dst_ips = df['IPV4_DST_ADDR'].value_counts().head(3).index.tolist() if 'IPV4_DST_ADDR' in df.columns else []
        
        # Tipos de ataque
        attack_types = attacks['Attack'].value_counts().to_dict() if 'Attack' in attacks.columns and not attacks.empty else {}
        
        # Puertos más comunes
        top_dst_ports = df['L4_DST_PORT'].value_counts().head(3).index.tolist() if 'L4_DST_PORT' in df.columns else []
        
        # Construir texto
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
    
    def search_similar(self, query: str, n_results: int = 3):
        """
        Buscar ventanas similares.
        
        Args:
            query: Texto de búsqueda
            n_results: Número de resultados
            
        Returns:
            Resultados de ChromaDB
        """
        print(f"[MemoryManager] Querying: '{query}'")
        
        results = self.collection.query(
            query_texts=[query],
            n_results=n_results
        )
        
        print(f"[MemoryManager] Retrieved {len(results['ids'][0])} results\n")
        
        return results
    
    def get_stats(self):
        """Obtener estadísticas de ChromaDB"""
        count = self.collection.count()
        
        return {
            "total_windows": count,
            "collection_name": self.collection.name
        }

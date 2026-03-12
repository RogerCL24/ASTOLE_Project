"""
Ingesta desde Ingeniero 1 con cola
Función que Ing1 llama para indexar ventanas

Milestone 2: Storage Feed
Autor: Ing3 (Andrea Blanco)
"""

import queue
import threading
import pandas as pd
import sys
from pathlib import Path

# Añadir src/ al path para imports
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from memory.chromadb_manager import MemoryManager


# Cola global para ventanas
_window_queue = queue.Queue(maxsize=100)

# Manager global
_manager = None
_worker_thread = None


def _get_manager():
    """Obtener manager singleton"""
    global _manager
    if _manager is None:
        _manager = MemoryManager()
    return _manager


def _worker():
    """Worker que procesa cola en background"""
    manager = _get_manager()
    
    print("🔄 Worker ChromaDB iniciado")
    
    while True:
        try:
            # Esperar ventana (bloquea hasta que haya)
            window_id, dataframe = _window_queue.get(timeout=1)
            
            # Procesar
            manager.add_netflow_window(window_id, dataframe)
            
            # Marcar como completado
            _window_queue.task_done()
            
        except queue.Empty:
            # No hay nada en cola, continuar esperando
            continue
        except Exception as e:
            print(f"❌ Error en worker: {e}")


def start_worker():
    """Iniciar worker thread"""
    global _worker_thread
    if _worker_thread is None or not _worker_thread.is_alive():
        _worker_thread = threading.Thread(target=_worker, daemon=True)
        _worker_thread.start()
        print("✅ Worker thread iniciado")


def index_window(window_id: str, dataframe: pd.DataFrame) -> dict:
    """
    Indexar ventana en ChromaDB (con cola, no bloquea).
    
    Ing1 llama esta función cuando genera cada ventana.
    La ventana se añade a cola y se procesa en background.
    
    Args:
        window_id: ID único de la ventana
        dataframe: DataFrame con 55 columnas
        
    Returns:
        dict con status
        
    Example:
        >>> import pandas as pd
        >>> from memory.ingest_from_ing1 import index_window
        >>> 
        >>> window_df = pd.read_csv("window_001.csv")
        >>> result = index_window("window_001", window_df)
        >>> print(result)
        {'status': 'queued', 'window_id': 'window_001', 'queue_size': 1}
    """
    # Iniciar worker si no está corriendo
    start_worker()
    
    # Copiar DataFrame (evitar race conditions)
    df_copy = dataframe.copy()
    
    # Añadir a cola (no bloquea)
    try:
        _window_queue.put((window_id, df_copy), block=False)
        
        return {
            "status": "queued",
            "window_id": window_id,
            "flows_count": len(dataframe),
            "queue_size": _window_queue.qsize()
        }
    except queue.Full:
        return {
            "status": "queue_full",
            "window_id": window_id,
            "error": "Cola llena (max 100 ventanas)"
        }


def get_queue_status() -> dict:
    """Estado de la cola"""
    return {
        "queue_size": _window_queue.qsize(),
        "worker_alive": _worker_thread.is_alive() if _worker_thread else False
    }

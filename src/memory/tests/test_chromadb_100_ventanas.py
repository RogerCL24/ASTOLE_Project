"""
AST-54: Testing ChromaDB con 100+ ventanas
Testing escalabilidad y rendimiento
"""

import json
import sys
import time
from datetime import datetime
from pathlib import Path

import pandas as pd

# Añadir src/ al path para poder importar el módulo memory sin instalarlo
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root / "src"))

from memory.chromadb_manager import MemoryManager  # noqa: E402

def run_test(num_ventanas, filas_por_ventana):
    """
    Test con configuración variable.
    
    Args:
        num_ventanas: Número de ventanas a indexar
        filas_por_ventana: Filas por ventana
    
    Returns:
        dict: Métricas del test
    """
    print(f"\n{'='*70}")
    print(f"🧪 TEST: {num_ventanas} ventanas × {filas_por_ventana} filas/ventana")
    print(f"{'='*70}\n")
    
    # ──────────────────────────────────────
    # 1. CARGA DE DATOS
    # ──────────────────────────────────────
    
    dataset_path = Path("data/NF-UNSW-NB15-v3.csv")
    total_rows = num_ventanas * filas_por_ventana
    
    print("📥 Cargando dataset...")
    print(f"   Filas a cargar: {total_rows:,}")
    
    load_start = time.time()
    df = pd.read_csv(dataset_path, nrows=total_rows)
    load_time = time.time() - load_start
    
    print(f"✅ Dataset cargado: {len(df):,} filas en {load_time:.2f}s")
    print(f"   Velocidad: {len(df)/load_time:.0f} filas/s\n")
    
    # ──────────────────────────────────────
    # 2. INICIALIZACIÓN CHROMADB
    # ──────────────────────────────────────
    
    print("🔧 Inicializando ChromaDB...")
    init_start = time.time()
    manager = MemoryManager()
    init_time = time.time() - init_start
    print(f"✅ ChromaDB listo en {init_time:.2f}s\n")
    
    # ──────────────────────────────────────
    # 3. INDEXACIÓN DE VENTANAS
    # ──────────────────────────────────────
    
    print(f"📦 Indexando {num_ventanas} ventanas...")
    
    index_start = time.time()
    index_times = []
    total_ataques = 0
    
    for i in range(num_ventanas):
        window_id = f"window_{i+1:03d}"
        start_idx = i * filas_por_ventana
        end_idx = start_idx + filas_por_ventana
        
        window_df = df.iloc[start_idx:end_idx]
        
        # Tiempo individual
        window_start = time.time()
        manager.add_netflow_window(window_id, window_df)
        window_time = time.time() - window_start
        index_times.append(window_time)
        
        # Contar ataques
        ataques = int(window_df['Label'].sum()) if 'Label' in window_df.columns else 0
        total_ataques += ataques
        
        # Progress
        if (i + 1) % 10 == 0 or (i + 1) == num_ventanas:
            elapsed = time.time() - index_start
            avg_time = sum(index_times) / len(index_times)
            remaining = (num_ventanas - (i + 1)) * avg_time
            
            print(f"   [{i+1:3d}/{num_ventanas}] "
                  f"Elapsed: {elapsed:5.1f}s | "
                  f"Avg: {avg_time:.3f}s/ventana | "
                  f"ETA: {remaining:5.1f}s")
    
    index_time = time.time() - index_start
    avg_index_time = sum(index_times) / len(index_times)
    min_index_time = min(index_times)
    max_index_time = max(index_times)
    
    print("\n✅ Indexación completada:")
    print(f"   Tiempo total: {index_time:.2f}s")
    print(f"   Promedio: {avg_index_time:.3f}s/ventana")
    print(f"   Mínimo: {min_index_time:.3f}s")
    print(f"   Máximo: {max_index_time:.3f}s")
    print(f"   Velocidad: {num_ventanas/index_time:.1f} ventanas/s")
    print(f"   Ataques detectados: {total_ataques}\n")
    
    # ──────────────────────────────────────
    # 4. TEST DE BÚSQUEDAS
    # ──────────────────────────────────────
    
    print("🔍 Testing búsquedas semánticas...")
    
    queries = [
        ("ataques Fuzzers", 5),
        ("ataques Exploits", 5),
        ("puerto 22 SSH", 5),
        ("tráfico benigno normal", 5),
        ("escaneo puertos", 3),
        ("IP sospechosa maliciosa", 3)
    ]
    
    search_results = []
    
    for query, n_results in queries:
        search_start = time.time()
        results = manager.search_similar(query, n_results=n_results)
        search_time = time.time() - search_start
        
        # Calcular similitud promedio
        avg_similarity = sum(1 - d for d in results['distances'][0]) / len(results['distances'][0])
        
        search_results.append({
            "query": query,
            "n_results": n_results,
            "tiempo": round(search_time, 4),
            "similitud_promedio": round(avg_similarity, 3)
        })
        
        print(f"   '{query[:30]}': {search_time:.4f}s (sim: {avg_similarity:.3f})")
    
    avg_search_time = sum(r['tiempo'] for r in search_results) / len(search_results)
    print("\n✅ Búsquedas completadas:")
    print(f"   Promedio: {avg_search_time:.4f}s/búsqueda\n")
    
    # ──────────────────────────────────────
    # 5. ESTADÍSTICAS FINALES
    # ──────────────────────────────────────
    
    stats = manager.get_stats()
    
    print("📊 ESTADÍSTICAS CHROMADB:")
    print(f"   Ventanas indexadas: {stats['total_windows']}")
    print(f"   Collection: {stats['collection_name']}\n")
    
    # ──────────────────────────────────────
    # 6. COMPILAR RESULTADOS
    # ──────────────────────────────────────
    
    resultados = {
        "timestamp": datetime.now().isoformat(),
        "configuracion": {
            "num_ventanas": num_ventanas,
            "filas_por_ventana": filas_por_ventana,
            "total_filas": total_rows
        },
        "carga": {
            "tiempo_segundos": round(load_time, 2),
            "velocidad_filas_por_segundo": round(len(df)/load_time, 0)
        },
        "indexacion": {
            "tiempo_total_segundos": round(index_time, 2),
            "tiempo_promedio_ventana": round(avg_index_time, 3),
            "tiempo_minimo_ventana": round(min_index_time, 3),
            "tiempo_maximo_ventana": round(max_index_time, 3),
            "velocidad_ventanas_por_segundo": round(num_ventanas/index_time, 2),
            "total_ataques_detectados": total_ataques
        },
        "busquedas": {
            "tiempo_promedio_segundos": round(avg_search_time, 4),
            "queries_testeadas": len(search_results),
            "detalles": search_results
        },
        "chromadb": {
            "ventanas_totales": stats['total_windows'],
            "collection": stats['collection_name']
        }
    }
    
    print("="*70)
    print(f"✅ TEST COMPLETADO: {num_ventanas} ventanas")
    print("="*70)
    
    return resultados


if __name__ == "__main__":
    print("\n" + "="*70)
    print("🎯 SUITE DE TESTS - AST-54")
    print("Testing ChromaDB con 20/50/100 ventanas")
    print("="*70)
    
    todos_resultados = []
    
    # ══════════════════════════════════════
    # TEST 1: 20 ventanas (ligero)
    # ══════════════════════════════════════
    
    print("\n🧪 TEST 1/3: LIGERO (20 ventanas)")
    resultado_20 = run_test(num_ventanas=20, filas_por_ventana=500)
    todos_resultados.append(resultado_20)
    
    input("\n⏸️  Presiona Enter para continuar con Test 2/3...")
    
    # ══════════════════════════════════════
    # TEST 2: 50 ventanas (medio)
    # ══════════════════════════════════════
    
    print("\n🧪 TEST 2/3: MEDIO (50 ventanas)")
    resultado_50 = run_test(num_ventanas=50, filas_por_ventana=1000)
    todos_resultados.append(resultado_50)
    
    input("\n⏸️  Presiona Enter para continuar con Test 3/3...")
    
    # ══════════════════════════════════════
    # TEST 3: 100 ventanas (pesado)
    # ══════════════════════════════════════
    
    print("\n🧪 TEST 3/3: PESADO (100 ventanas)")
    resultado_100 = run_test(num_ventanas=100, filas_por_ventana=1000)
    todos_resultados.append(resultado_100)
    
    # ══════════════════════════════════════
    # GUARDAR RESULTADOS
    # ══════════════════════════════════════
    
    results_path = Path("docs/TESTING_M2_RESULTS.json")
    results_path.parent.mkdir(exist_ok=True)
    
    with open(results_path, 'w', encoding='utf-8') as f:
        json.dump(todos_resultados, f, indent=2, ensure_ascii=False)
    
    print(f"\n💾 Resultados guardados en: {results_path}")
    
    # ══════════════════════════════════════
    # RESUMEN COMPARATIVO
    # ══════════════════════════════════════
    
    print("\n" + "="*70)
    print("📊 RESUMEN COMPARATIVO")
    print("="*70)
    print(f"\n{'Ventanas':<12} {'Filas':<12} {'T.Index':<12} {'T.Búsq':<12} {'Vel.'}")
    print("-"*70)
    
    for r in todos_resultados:
        n_vent = r['configuracion']['num_ventanas']
        filas = r['configuracion']['total_filas']
        t_index = r['indexacion']['tiempo_total_segundos']
        t_busq = r['busquedas']['tiempo_promedio_segundos']
        vel = r['indexacion']['velocidad_ventanas_por_segundo']
        
        print(f"{n_vent:<12} {filas:<12,} {t_index:<12.2f} {t_busq:<12.4f} {vel:.2f} v/s")
    
    print("\n" + "="*70)
    print("✅ TESTING COMPLETADO - AST-54")
    print("="*70)
    print(f"\nResultados JSON: {results_path}")
    print("Next: Revisar métricas y documentar\n")

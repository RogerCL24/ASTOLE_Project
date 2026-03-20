import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(BASE_DIR / "src"))

from ingestion.stream_simulator import trigger_alert
import pandas as pd

def test_attack_coverage():
    df = pd.read_csv(BASE_DIR / "data/NF-UNSW-NB15-v3.csv", nrows=10000)
    ataques_unicos = df[df['Label'] == 1]['Attack'].unique()
    
    failures = [] 

    print(f"🔍 Verificando cobertura para {len(ataques_unicos)} tipos de ataque...")
    
    for tipo in ataques_unicos:
        row = df[df['Attack'] == tipo].iloc[0]
        try:
            trigger_alert(f"TEST_{tipo}", row)
            print(f"✅ {tipo}: OK")
        except Exception as e:
            print(f"❌ {tipo}: FALLÓ - {e}")
            failures.append(f"{tipo}: {str(e)}")

    # ASSERT FINAL: Si hay fallos, el test aborta con error (CI fallará)
    assert not failures, f"Fallaron los siguientes ataques: {failures}"

if __name__ == "__main__":
    test_attack_coverage()
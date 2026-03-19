import pandas as pd
from stream_simulator import trigger_alert

def test_coverage():
    df = pd.read_csv("data/NF-UNSW-NB15-v3.csv")
    ataques_unicos = df[df['Label'] == 1]['Attack'].unique()
    
    print(f"🔍 Verificando cobertura para {len(ataques_unicos)} tipos de ataque...")
    
    for tipo in ataques_unicos:
        # Cogemos el primer ejemplo de cada tipo
        row = df[df['Attack'] == tipo].iloc[0]
        try:
            trigger_alert(f"TEST_{tipo}", row)
            print(f"✅ Alerta generada correctamente para: {tipo}")
        except Exception as e:
            print(f"❌ Error en {tipo}: {e}")

if __name__ == "__main__":
    test_coverage()
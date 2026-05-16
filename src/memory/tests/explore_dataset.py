"""
Exploración Dataset V3
"""

import pandas as pd
from pathlib import Path

print("📊 Explorando Dataset V3...\n")

base_dir = Path(__file__).resolve().parents[2]
csv_path = base_dir / "docs" / "samples" / "raw_sample_53_cols.csv"

print(f"✅ Leyendo: {csv_path.name}")
df = pd.read_csv(csv_path)

print(f"\n📏 Dimensiones: {df.shape[0]} filas x {df.shape[1]} columnas")

print(f"\n📋 TODAS LAS COLUMNAS ({len(df.columns)}):")
for i, col in enumerate(df.columns, 1):
    dtype = df[col].dtype
    print(f"  {i:2d}. {col:40s} ({dtype})")

print("\n👀 Datos principales (primeras 3 filas):")
main_cols = ['IPV4_SRC_ADDR', 'IPV4_DST_ADDR', 'L4_SRC_PORT', 'L4_DST_PORT', 'Label', 'Attack']
print(df[main_cols].head(3).to_string(index=False))

if 'Label' in df.columns:
    benignos = (df['Label'] == 0).sum()
    ataques = (df['Label'] == 1).sum()
    print("\n🚨 Distribución:")
    print(f"  Benignos: {benignos} ({benignos/len(df)*100:.1f}%)")
    print(f"  Ataques:  {ataques} ({ataques/len(df)*100:.1f}%)")

if 'Attack' in df.columns:
    print("\n📊 Tipos de ataque:")
    print(df['Attack'].value_counts().to_string())

print(f"\n✅ Total columnas: {len(df.columns)}")
print("✅ Dataset real")

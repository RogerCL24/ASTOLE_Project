"""
Test Ollama + Llama 3
"""

import subprocess

print("🧪 Testing Ollama + Llama 3...")

# Test con ollama CLI
result = subprocess.run(
    ['ollama', 'run', 'llama3', 'Di solo "Hola" y nada más'],
    capture_output=True,
    text=True,
    encoding='utf-8',
    errors='ignore',
    timeout=30
)

if result.returncode == 0:
    print("✅ Llama 3 funciona!")
    print(f"Respuesta: {result.stdout.strip()}")
else:
    print(f"❌ Error: {result.stderr}")

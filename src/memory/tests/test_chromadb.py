"""
Test rápido ChromaDB
"""

import chromadb

print("Testing ChromaDB...")

# Crear cliente
client = chromadb.Client()

# Crear colección
collection = client.create_collection("test")

# Añadir dato
collection.add(
    documents=["Hola ChromaDB"],
    ids=["1"]
)

# Buscar
results = collection.query(
    query_texts=["Hola"],
    n_results=1
)

print("ChromaDB funciona!")
print(f"Resultado: {results}")

# Docker - ASTOLE

## Iniciar
```bash
docker-compose up -d
```

## Ver estado
```bash
docker-compose ps
```

## Ver logs
```bash
docker-compose logs chromadb
```

## Parar
```bash
docker-compose down
```

## Acceso

ChromaDB: http://localhost:8000

## Estructura
```
docker-compose.yml
└── chromadb (puerto 8000)
    └── volumen: src/memory/chromadb_data
```

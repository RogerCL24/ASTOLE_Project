"""
Investigator API - FastAPI en puerto 8003 con streaming
Ingeniero 3: Andrea Blanco
Milestone 4: Chat de Investigación
"""

from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field
from typing import Optional
from collections import Counter
import json
import asyncio
import re
import sys
from pathlib import Path
from datetime import datetime

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from memory.investigator import Investigator

app = FastAPI(title="ASTOLE Investigator API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Singleton solo para la conexión a ChromaDB (sin estado mutable por request)
_alerts_collection = None


def get_alerts_collection():
    """Singleton solo para la colección ChromaDB — sin estado mutable."""
    global _alerts_collection
    if _alerts_collection is None:
        investigator = Investigator()
        _alerts_collection = investigator.alerts_collection
    return _alerts_collection


def get_alerts_data(src_ip: str) -> tuple:
    """Obtener alertas de ChromaDB para una IP."""
    try:
        collection = get_alerts_collection()
        results = collection.get(
            where={"src_ip": {"$eq": src_ip}},
            limit=1000
        )
        return results.get("ids", []), results.get("metadatas", [])
    except Exception:
        return [], []


# ─── DETECCIÓN DE TIPO DE PREGUNTA ──────────────────────────────────────────

def is_escalation_question(q: str) -> bool:
    return any(w in q.lower() for w in ["escalar", "escala", "debo", "debería", "urgente", "medidas inmediatas", "qué hago", "que hago"])

def is_temporal_question(q: str) -> bool:
    return any(w in q.lower() for w in ["cuándo", "cuando", "primer", "último", "ultimo", "tiempo", "activa", "duración", "duracion", "fecha", "primera vez", "última vez"])

def is_total_question(q: str) -> bool:
    return any(w in q.lower() for w in ["cuántos ataques", "cuantos ataques", "registrado en total", "total de ataques"])

def is_puertos_question(q: str) -> bool:
    return any(w in q.lower() for w in ["qué puertos", "que puertos", "a qué puertos", "a que puertos", "puertos ha atacado", "puertos atacado"])

def is_puerto_mas_question(q: str) -> bool:
    return any(w in q.lower() for w in ["puerto más atacado", "puerto mas atacado", "puerto más usado", "puerto mas usado", "puerto principal", "cuál es el puerto", "cual es el puerto"])

def is_tipos_question(q: str) -> bool:
    return any(w in q.lower() for w in ["qué tipos", "que tipos", "tipos de ataque", "qué tipo de ataque", "que tipo de ataque", "tipos ha usado", "tipos utilizado"])

def is_hosts_atacados_question(q: str) -> bool:
    return any(w in q.lower() for w in ["qué hosts", "que hosts", "a qué hosts", "a que hosts", "hosts ha atacado", "hosts atacado", "qué host", "que host ha atacado"])

def is_hosts_comprometidos_question(q: str) -> bool:
    return any(w in q.lower() for w in ["cuántos hosts", "cuantos hosts", "hosts diferentes", "hosts comprometido", "número de hosts", "numero de hosts"])

def is_host_mayor_riesgo_question(q: str) -> bool:
    return any(w in q.lower() for w in ["mayor riesgo", "host más atacado", "host mas atacado", "más vulnerable", "mas vulnerable"])

def is_direct_question(q: str) -> bool:
    return (is_temporal_question(q) or is_total_question(q) or
            is_puertos_question(q) or is_puerto_mas_question(q) or
            is_tipos_question(q) or is_hosts_atacados_question(q) or
            is_hosts_comprometidos_question(q) or is_host_mayor_riesgo_question(q) or
            is_escalation_question(q))


# ─── VEREDICTO + EVIDENCIA DIRECTOS ──────────────────────────────────────────

def build_veredicto_evidencia(question: str, src_ip: str, current_case: dict) -> str:
    ids, metadatas = get_alerts_data(src_ip) if src_ip else ([], [])

    if is_escalation_question(question):
        attack_type = current_case.get("attack_type", "--")
        frequency = current_case.get("frequency", 0)
        victims = current_case.get("victims", 0)
        dst_port = current_case.get("dst_port", "--")
        lines = []
        if frequency:
            lines.append(f"- Alta frecuencia de ataque ({frequency} alertas registradas)")
        if attack_type and attack_type != "--":
            lines.append(f"- Tipo de ataque activo: {attack_type}")
        if victims:
            lines.append(f"- {victims} hosts comprometidos activos")
        if dst_port and dst_port != "--":
            lines.append(f"- Puerto crítico afectado: {dst_port}")
        evidencia = "\n".join(lines) if lines else "- Actividad maliciosa confirmada"
        return f"VEREDICTO: Sí, este incidente debe escalarse de inmediato.\n\nEVIDENCIA:\nFactores que justifican la decisión:\n{evidencia}"

    if not ids:
        return ""

    if is_temporal_question(question):
        timestamps = [str(m.get("timestamp", "")) for m in metadatas if m.get("timestamp")]
        if not timestamps:
            return ""
        first, last = min(timestamps), max(timestamps)
        duration_str = ""
        try:
            t1 = datetime.fromisoformat(first.replace("Z", "+00:00"))
            t2 = datetime.fromisoformat(last.replace("Z", "+00:00"))
            diff = t2 - t1
            hours = int(diff.total_seconds() // 3600)
            minutes = int((diff.total_seconds() % 3600) // 60)
            duration_str = f"\n- Duración total de actividad: {hours}h {minutes}min"
        except Exception:
            pass
        return f"VEREDICTO: La IP {src_ip} ha estado activa atacando desde {first} hasta {last}.\n\nEVIDENCIA:\nLínea temporal del ataque:\n- Primer ataque: {first}\n- Último ataque: {last}\n- Total alertas: {len(ids)}{duration_str}"

    if is_total_question(question):
        attack_types = Counter(str(m.get("attack_type", "?")) for m in metadatas)
        hosts = Counter(str(m.get("dst_ip", "?")) for m in metadatas)
        return f"VEREDICTO: La IP {src_ip} ha registrado {len(ids)} ataques en total contra {len(hosts)} hosts diferentes.\n\nEVIDENCIA:\nResumen estadístico:\n- Total alertas: {len(ids)}\n- Hosts comprometidos: {len(hosts)} únicos\n- Tipos de ataque: {len(attack_types)} distintos"

    if is_puertos_question(question):
        ports = Counter(str(m.get("dst_port", "?")) for m in metadatas if m.get("dst_port"))
        evidencia = "\n".join(f"- puerto {p} ({c} veces)" for p, c in ports.most_common())
        return f"VEREDICTO: La IP {src_ip} ha atacado {len(ports)} puertos diferentes.\n\nEVIDENCIA:\nPuertos atacados:\n{evidencia}"

    if is_puerto_mas_question(question):
        ports = Counter(str(m.get("dst_port", "?")) for m in metadatas if m.get("dst_port"))
        if not ports:
            return ""
        top_port, top_count = ports.most_common(1)[0]
        evidencia = "\n".join(f"- puerto {p} ({c} veces)" for p, c in ports.most_common())
        return f"VEREDICTO: El puerto más atacado por la IP {src_ip} es el puerto {top_port} con {top_count} ataques registrados.\n\nEVIDENCIA:\nPuertos más atacados:\n{evidencia}"

    if is_tipos_question(question):
        attack_types = Counter(str(m.get("attack_type", "?")) for m in metadatas if m.get("attack_type"))
        evidencia = "\n".join(f"- {t} ({c} veces)" for t, c in attack_types.most_common())
        return f"VEREDICTO: La IP {src_ip} ha empleado {len(attack_types)} tipos de ataque diferentes.\n\nEVIDENCIA:\nTipos de ataque utilizados:\n{evidencia}"

    if is_hosts_atacados_question(question) or is_hosts_comprometidos_question(question):
        hosts = Counter(str(m.get("dst_ip", "?")) for m in metadatas if m.get("dst_ip"))
        evidencia = "\n".join(f"- {h} ({c} veces)" for h, c in hosts.most_common())
        return f"VEREDICTO: La IP {src_ip} ha atacado {len(hosts)} hosts diferentes.\n\nEVIDENCIA:\nHosts atacados:\n{evidencia}"

    if is_host_mayor_riesgo_question(question):
        hosts = Counter(str(m.get("dst_ip", "?")) for m in metadatas if m.get("dst_ip"))
        if not hosts:
            return ""
        top_host, top_count = hosts.most_common(1)[0]
        evidencia = "\n".join(f"- {h} ({c} veces)" for h, c in hosts.most_common(5))
        return f"VEREDICTO: El host en mayor riesgo es {top_host} con {top_count} ataques registrados.\n\nEVIDENCIA:\nHosts más atacados:\n{evidencia}"

    return ""


def build_recomendacion_prompt(question: str, veredicto_evidencia: str, src_ip: str, current_case: dict) -> str:
    attack_type = current_case.get("attack_type", "--")
    frequency = current_case.get("frequency", 0)
    victims = current_case.get("victims", 0)

    return f"""Eres un experto en ciberseguridad SOC. Un analista ha investigado este incidente:

IP investigada: {src_ip}
Tipo de ataque: {attack_type}
Frecuencia: {frequency} alertas
Hosts comprometidos: {victims}

El analista ha preguntado: {question}

El sistema ha encontrado:
{veredicto_evidencia}

Genera ÚNICAMENTE una RECOMENDACIÓN específica, accionable y detallada de 2-3 frases para este caso concreto. No repitas el veredicto ni la evidencia. Empieza directamente con la acción a tomar. Responde en español. No uses markdown, asteriscos ni negritas. Escribe en texto plano."""


# ─── POST-PROCESADO ──────────────────────────────────────────────────────────

def clean_conversation_leak(text: str) -> str:
    for marker in ["Analista:", "Asistente:", "CONVERSACIÓN"]:
        idx = text.find(marker)
        if idx != -1:
            text = text[:idx].strip()
    return text


def get_intro_evidencia(question: str) -> str:
    q = question.lower()
    if any(w in q for w in ["puerto", "port"]):
        return "Analizando el contexto histórico de la red se han encontrado los siguientes puertos atacados:"
    if any(w in q for w in ["tipo", "ataque", "attack", "usado", "utilizado"]):
        return "Analizando el contexto histórico de la red se han encontrado los siguientes tipos de ataque:"
    if any(w in q for w in ["host", "víctima", "victima", "destino", "atacado", "riesgo"]):
        return "Analizando el contexto histórico de la red se han encontrado los siguientes hosts afectados:"
    return "Analizando el contexto histórico de la red se ha encontrado lo siguiente:"


def format_response(raw: str, question: str = "") -> str:
    veredicto = ""
    evidencia = ""
    recomendacion = ""

    m = re.search(r"VEREDICTO\s*:\s*(.+?)(?=\n\nEVIDENCIA|\nEVIDENCIA|$)", raw, re.DOTALL | re.IGNORECASE)
    if m:
        veredicto = clean_conversation_leak(m.group(1).strip())

    m = re.search(r"EVIDENCIA\s*:\s*(.+?)(?=\n\nRECOMENDACIÓN|\nRECOMENDACIÓN|\nRECOMENDACION|$)", raw, re.DOTALL | re.IGNORECASE)
    if m:
        evidencia_raw = clean_conversation_leak(m.group(1).strip())
        lines = evidencia_raw.split("\n")
        clean_lines = []
        for line in lines:
            line = line.strip()
            if not line or re.match(r'^[-|=\s]+$', line):
                continue
            if "caso actual" in line.lower():
                continue
            if len(line) > 100:
                continue
            clean_lines.append(line)
        evidencia = "\n".join(clean_lines)

    m = re.search(r"RECOMENDACI[OÓ]N\s*:\s*(.+?)$", raw, re.DOTALL | re.IGNORECASE)
    if m:
        recomendacion = clean_conversation_leak(m.group(1).strip())
        sentences = re.split(r'(?<=[.!?])\s+', recomendacion)
        recomendacion = " ".join(sentences[:3]).strip()

    if not veredicto and not evidencia and not recomendacion:
        return clean_conversation_leak(raw.strip())

    intro = get_intro_evidencia(question)
    parts = []
    if veredicto:
        parts.append(f"VEREDICTO: {veredicto}")
    if evidencia:
        parts.append(f"\nEVIDENCIA:\n{intro}\n{evidencia}")
    if recomendacion:
        parts.append(f"\nRECOMENDACIÓN: {recomendacion}")

    return "\n".join(parts)


# ─── MODELOS ─────────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    question: str = Field(..., min_length=1)
    case_id: Optional[str] = None
    src_ip: Optional[str] = None
    attack_type: Optional[str] = None
    dst_port: Optional[str] = None
    dst_ip: Optional[str] = None
    frequency: Optional[int] = None
    victims: Optional[int] = None


# ─── ENDPOINTS ───────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return JSONResponse(
        content={"status": "ok", "service": "investigator-api"},
        media_type="application/json; charset=utf-8"
    )


@app.post("/chat")
def chat(req: ChatRequest):
    try:
        current_case = {
            "dst_port": req.dst_port,
            "dst_ip": req.dst_ip,
            "attack_type": req.attack_type,
            "frequency": req.frequency,
            "victims": req.victims,
        }

        case_context = {
            "src_ip": req.src_ip,
            "attack_type": req.attack_type,
            "dst_port": req.dst_port,
            "dst_ip": req.dst_ip,
        }

        async def generate():
            if is_direct_question(req.question) and req.src_ip:
                # VEREDICTO + EVIDENCIA directo desde ChromaDB (offload a threadpool)
                veredicto_evidencia = await run_in_threadpool(
                    build_veredicto_evidencia, req.question, req.src_ip, current_case
                )

                if veredicto_evidencia:
                    # Instancia por request — sin estado compartido entre usuarios
                    investigator = Investigator()

                    # Generar RECOMENDACIÓN con llama3 en threadpool (bloqueante)
                    prompt = build_recomendacion_prompt(req.question, veredicto_evidencia, req.src_ip, current_case)
                    recomendacion = await run_in_threadpool(
                        lambda: "".join(investigator.generate_recommendation(prompt))
                    )

                    # Limpiar asteriscos y markdown
                    recomendacion = re.sub(r'\*+', '', recomendacion).strip()
                    recomendacion = re.sub(r'#+\s*', '', recomendacion).strip()
                    recomendacion = re.sub(r'^Recomendaci[oó]n\s*:\s*', '', recomendacion, flags=re.IGNORECASE).strip()

                    # Construir respuesta completa y enviar con efecto de escritura
                    full_text = veredicto_evidencia + "\n\nRECOMENDACIÓN: " + recomendacion
                    for char in full_text:
                        data = json.dumps({"token": char}, ensure_ascii=False)
                        yield f"data: {data}\n\n"
                        await asyncio.sleep(0.008)

                    yield "data: [DONE]\n\n"
                    return

            # Pregunta abierta — instancia por request, offload a threadpool
            investigator = Investigator()
            full_response = await run_in_threadpool(
                lambda: "".join(investigator.ask_stream(
                    question=req.question,
                    case_id=req.case_id,
                    case_context=case_context
                ))
            )
            formatted = format_response(full_response, question=req.question)

            for char in formatted:
                data = json.dumps({"token": char}, ensure_ascii=False)
                yield f"data: {data}\n\n"
                await asyncio.sleep(0.008)

            yield "data: [DONE]\n\n"

        return StreamingResponse(
            generate(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/reset")
def reset():
    return JSONResponse(
        content={"status": "ok", "message": "Historial reseteado"},
        media_type="application/json; charset=utf-8"
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8003)
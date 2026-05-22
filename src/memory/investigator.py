"""
Investigator - Chat local para analistas
RAG + llama3 via Ollama con streaming
Ingeniero 3: Andrea Blanco
Milestone 4: Chat de Investigación
"""

import requests
import sys
from pathlib import Path
from typing import Generator, Optional
from collections import Counter

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from memory.chromadb_manager import MemoryManager

OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "llama3"
RAG_N_RESULTS = 2

SYSTEM_PROMPT = """Eres un asistente experto en ciberseguridad que ayuda a analistas SOC a investigar incidentes de red.

REGLAS ESTRICTAS:
- Usa SOLO la información del RESUMEN ESTADÍSTICO y el CONTEXTO DEL HISTÓRICO
- No inventes datos, IPs, puertos ni tipos de ataque
- Responde siempre en español
- Sé directo, conciso y útil para un analista de operaciones

FORMATO OBLIGATORIO — EXACTAMENTE ESTAS TRES SECCIONES:

VEREDICTO: [Respuesta directa a la pregunta del analista]

EVIDENCIA:
[Lista de items relevantes a la pregunta, con frecuencias entre paréntesis]

RECOMENDACIÓN: [2-3 acciones concretas y específicas basadas en el contexto]

PROHIBIDO: historial de conversación en la respuesta, secciones extra, datos inventados."""


class Investigator:
    def __init__(self):
        print("[Investigator] Initializing...")
        self.manager = MemoryManager()

        self.alerts_collection = self.manager.client.get_or_create_collection(
            name="alerts",
            metadata={"description": "Alertas indexadas para búsqueda por IP"}
        )

        self.history = []
        self.current_case_id = None
        self.case_context = {}
        print(f"[Investigator] Ready — windows: {self.manager.collection.count()}, alerts: {self.alerts_collection.count()}\n")

    def generate_recommendation(self, prompt: str) -> Generator[str, None, None]:
        """Generar solo la RECOMENDACIÓN con llama3 en streaming."""
        try:
            with requests.post(
                OLLAMA_URL,
                json={"model": OLLAMA_MODEL, "prompt": prompt, "stream": True},
                stream=True,
                timeout=120
            ) as response:
                response.raise_for_status()
                import json
                for line in response.iter_lines():
                    if line:
                        chunk = json.loads(line.decode("utf-8"))
                        token = chunk.get("response", "")
                        yield token
                        if chunk.get("done", False):
                            break
        except requests.exceptions.ConnectionError:
            yield "Bloquear la IP en el firewall e investigar los hosts comprometidos."
        except Exception as e:
            yield "Revisar los logs de seguridad y activar las medidas de contención."

    def _build_stats_summary(self, ids: list, metadatas: list, src_ip: str) -> str:
        ports = Counter()
        attack_types = Counter()
        hosts = Counter()
        timestamps = []

        for meta in metadatas:
            dst_port = str(meta.get("dst_port", "?"))
            attack_type = str(meta.get("attack_type", "?"))
            dst_ip = str(meta.get("dst_ip", "?"))
            timestamp = str(meta.get("timestamp", ""))

            if dst_port != "?":
                ports[f"puerto {dst_port}"] += 1
            if attack_type != "?":
                attack_types[attack_type] += 1
            if dst_ip != "?":
                hosts[dst_ip] += 1
            if timestamp:
                timestamps.append(timestamp)

        summary = f"=== RESUMEN ESTADÍSTICO DE LA IP {src_ip} ===\n"
        summary += f"Total alertas indexadas: {len(ids)}\n\n"
        summary += f"Puertos atacados ({len(ports)} únicos):\n"
        for port, count in ports.most_common(10):
            summary += f"  - {port} ({count} veces)\n"
        summary += f"\nTipos de ataque ({len(attack_types)} únicos):\n"
        for atype, count in attack_types.most_common(10):
            summary += f"  - {atype} ({count} veces)\n"
        summary += f"\nHosts afectados ({len(hosts)} únicos):\n"
        for host, count in hosts.most_common(10):
            summary += f"  - {host} ({count} veces)\n"
        if timestamps:
            summary += f"\nPrimer ataque registrado: {min(timestamps)}\n"
            summary += f"Último ataque registrado: {max(timestamps)}\n"
            if len(timestamps) > 1:
                from datetime import datetime
                try:
                    t1 = datetime.fromisoformat(min(timestamps).replace("Z", "+00:00"))
                    t2 = datetime.fromisoformat(max(timestamps).replace("Z", "+00:00"))
                    diff = t2 - t1
                    hours = int(diff.total_seconds() // 3600)
                    minutes = int((diff.total_seconds() % 3600) // 60)
                    summary += f"Duración total de actividad: {hours}h {minutes}min\n"
                except Exception:
                    pass
        return summary

    def _retrieve_alerts_context(self, src_ip: str) -> str:
        if not src_ip or src_ip == "--":
            return ""
        count = self.alerts_collection.count()
        if count == 0:
            return ""
        try:
            results = self.alerts_collection.get(
                where={"src_ip": {"$eq": src_ip}},
                limit=1000
            )
            ids = results.get("ids", [])
            metadatas = results.get("metadatas", [])
            if not ids:
                return ""
            return self._build_stats_summary(ids, metadatas, src_ip)
        except Exception as e:
            print(f"[Investigator] Error querying alerts: {e}")
            return ""

    def _retrieve_windows_context(self, question: str) -> str:
        src_ip = self.case_context.get("src_ip")
        attack_type = self.case_context.get("attack_type")
        parts = [question]
        if src_ip and src_ip != "--":
            parts.append(f"IPs origen frecuentes: {src_ip}")
        if attack_type and attack_type != "--":
            parts.append(f"Tipos de ataque: {attack_type}")
        query = " ".join(parts)
        where_filter = None
        if src_ip and src_ip != "--":
            where_filter = {"top_src_ips": {"$contains": src_ip}}
        results = self.manager.search_similar(query=query, n_results=RAG_N_RESULTS, where=where_filter)
        ids = results.get("ids", [[]])[0]
        if not ids and where_filter:
            results = self.manager.search_similar(query=query, n_results=RAG_N_RESULTS)
            ids = results.get("ids", [[]])[0]
        documents = results.get("documents", [[]])[0]
        metadatas = results.get("metadatas", [[]])[0]
        if not ids:
            return ""
        parts = []
        for i, window_id in enumerate(ids):
            meta = metadatas[i] if i < len(metadatas) else {}
            doc = documents[i] if i < len(documents) else ""
            parts.append(
                f"[{window_id}] Flujos: {meta.get('flows_count', '?')} | "
                f"Ataques: {meta.get('attacks_count', '?')} | "
                f"Tipos: {meta.get('attack_types', '?')}\n{doc}"
            )
        return "\n\n".join(parts)

    def _retrieve_context(self, question: str) -> str:
        src_ip = self.case_context.get("src_ip")
        alerts_ctx = self._retrieve_alerts_context(src_ip)
        if alerts_ctx:
            return alerts_ctx
        windows_ctx = self._retrieve_windows_context(question)
        if windows_ctx:
            return f"=== VENTANAS HISTÓRICAS ===\n{windows_ctx}"
        return "No se encontró contexto histórico relevante."

    def _build_prompt(self, question: str, context: str) -> str:
        history_text = ""
        for turn in self.history[-2:]:
            history_text += f"Analista: {turn['question']}\nAsistente: {turn['answer']}\n\n"
        return f"""{SYSTEM_PROMPT}

{context}

CONVERSACIÓN ANTERIOR:
{history_text}
Analista: {question}
Asistente (responde SOLO con VEREDICTO, EVIDENCIA y RECOMENDACIÓN):"""

    def new_case(self, case_id: str, case_context: dict = None):
        if self.current_case_id != case_id:
            self.history = []
            self.current_case_id = case_id
            self.case_context = case_context or {}
            self.case_context["case_id"] = case_id
            print(f"[Investigator] New case: {case_id}")

    def ask_stream(self, question: str, case_id: str = None, case_context: dict = None) -> Generator[str, None, None]:
        if case_id:
            self.new_case(case_id, case_context)
        context = self._retrieve_context(question)
        prompt = self._build_prompt(question, context)
        full_answer = ""
        try:
            with requests.post(
                OLLAMA_URL,
                json={"model": OLLAMA_MODEL, "prompt": prompt, "stream": True},
                stream=True,
                timeout=300
            ) as response:
                response.raise_for_status()
                import json
                for line in response.iter_lines():
                    if line:
                        chunk = json.loads(line.decode("utf-8"))
                        token = chunk.get("response", "")
                        full_answer += token
                        yield token
                        if chunk.get("done", False):
                            break
        except requests.exceptions.ConnectionError:
            yield "Error: Ollama no está corriendo."
        except Exception as e:
            yield f"Error: {e}"
        self.history.append({"question": question, "answer": full_answer})

    def ask(self, question: str, case_id: str = None, case_context: dict = None) -> str:
        return "".join(self.ask_stream(question, case_id, case_context))

    def reset(self):
        self.history = []
        self.current_case_id = None
        self.case_context = {}
        print("[Investigator] History reset")


def main():
    print("=" * 50)
    print("ASTOLE Investigator - Chat de Análisis")
    print("=" * 50)
    investigator = Investigator()
    while True:
        try:
            question = input("Analista: ").strip()
        except (KeyboardInterrupt, EOFError):
            break
        if not question:
            continue
        if question.lower() in ["salir", "exit", "quit"]:
            break
        if question.lower() == "reset":
            investigator.reset()
            continue
        print("Asistente: ", end="", flush=True)
        for token in investigator.ask_stream(question):
            print(token, end="", flush=True)
        print("\n" + "-" * 50)


if __name__ == "__main__":
    main()
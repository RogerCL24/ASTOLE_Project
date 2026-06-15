import csv
import random
import os
import time  # <--- Añadido para capturar el tiempo real actual

headers = [
    "FLOW_START_MILLISECONDS", "FLOW_END_MILLISECONDS", "IPV4_SRC_ADDR", "L4_SRC_PORT",
    "IPV4_DST_ADDR", "L4_DST_PORT", "PROTOCOL", "L7_PROTO", "IN_BYTES", "IN_PKTS",
    "OUT_BYTES", "OUT_PKTS", "TCP_FLAGS", "CLIENT_TCP_FLAGS", "SERVER_TCP_FLAGS",
    "FLOW_DURATION_MILLISECONDS", "DURATION_IN", "DURATION_OUT", "MIN_TTL", "MAX_TTL",
    "LONGEST_FLOW_PKT", "SHORTEST_FLOW_PKT", "MIN_IP_PKT_LEN", "MAX_IP_PKT_LEN",
    "SRC_TO_DST_SECOND_BYTES", "DST_TO_SRC_SECOND_BYTES", "RETRANSMITTED_IN_BYTES",
    "RETRANSMITTED_IN_PKTS", "RETRANSMITTED_OUT_BYTES", "RETRANSMITTED_OUT_PKTS",
    "SRC_TO_DST_AVG_THROUGHPUT", "DST_TO_SRC_AVG_THROUGHPUT", "NUM_PKTS_UP_TO_128_BYTES",
    "NUM_PKTS_128_TO_256_BYTES", "NUM_PKTS_256_TO_512_BYTES", "NUM_PKTS_512_TO_1024_BYTES",
    "NUM_PKTS_1024_TO_1514_BYTES", "TCP_WIN_MAX_IN", "TCP_WIN_MAX_OUT", "ICMP_TYPE",
    "ICMP_IPV4_TYPE", "DNS_QUERY_ID", "DNS_QUERY_TYPE", "DNS_TTL_ANSWER", "FTP_COMMAND_RET_CODE",
    "SRC_TO_DST_IAT_MIN", "SRC_TO_DST_IAT_MAX", "SRC_TO_DST_IAT_AVG", "SRC_TO_DST_IAT_STDDEV",
    "DST_TO_SRC_IAT_MIN", "DST_TO_SRC_IAT_MAX", "DST_TO_SRC_IAT_AVG", "DST_TO_SRC_IAT_STDDEV",
    "Label", "Attack"
]

# FIX CRÍTICO: En lugar de un número estático, usamos el segundo actual en milisegundos.
# Cada ejecución generará un rango de tiempo totalmente nuevo y único.
start_time_base = int(time.time() * 1000)
rows = []

# IPs geolocalizadas reales para banderas
es_clients = ["80.58.61.100", "80.58.61.101"]
fr_clients = ["90.84.12.40"]
ru_scanner = "185.22.172.5"      
us_scanner = "64.233.160.10"     
china_super_attacker = "113.108.16.2" 

target_web_server = "149.171.126.16" 
target_db_server = "149.171.126.30"  

# Simulación de 20 ventanas (20 minutos de histórico dinámico)
for window in range(20):
    window_start = start_time_base + (window * 60000)
    
    # 1. Tráfico Benigno de Fondo (Siempre activo)
    for _ in range(20):
        src = random.choice(es_clients + fr_clients)
        dst = target_web_server if random.random() > 0.3 else target_db_server
        sport = random.randint(30000, 65000)
        dport = 443 if dst == target_web_server else 3306
        
        rows.append([
            int(window_start + random.randint(100, 55000)), int(window_start + random.randint(55100, 59000)),
            src, int(sport), dst, int(dport), 6, 91.0, int(random.randint(2000, 10000)), int(random.randint(10, 40)),
            int(random.randint(4000, 50000)), int(random.randint(15, 80)), 27, 27, 27, int(random.randint(100, 4000)),
            0, 0, 64, 64, 1500, 52, 52, 1500, 0.0, 0.0, 0, 0, 0, 0, 50000, 100000, 5, 5, 5, 5, 10,
            65535, 65535, 0, 0, 0, 0, 0, 0, 10, 100, 50, 5, 10, 100, 50, 5,
            0, "Benign"
        ])
        
    # 2. Escaneos intermitentes de reconocimiento (Rusia y EE.UU. - Ventanas 2 a 7)
    if 2 <= window <= 7:
        for dport in [22, 80, 443]:
            rows.append([
                int(window_start + random.randint(100, 10000)), int(window_start + random.randint(10100, 12000)),
                random.choice([ru_scanner, us_scanner]), int(random.randint(40000, 50000)), target_web_server, int(dport),
                6, 0.0, 160, 4, 80, 2, 18, 18, 18, 500, 500, 0, 240, 240, 40, 40, 40, 40,
                0.0, 0.0, 40, 1, 0, 0, 1000, 500, 6, 0, 0, 0, 0, 1024, 1024, 0, 0, 0, 0, 0, 0,
                100, 200, 150, 10, 0, 0, 0, 0,
                1, "Reconnaissance"
            ])

    # 3. EL SÚPER ATAQUE PROLONGADO (China - Ventanas 8 a 13)
    if 8 <= window <= 13:
        for dport in range(1, 120):
            rows.append([
                int(window_start + (dport * 40)), int(window_start + (dport * 40) + 10),
                china_super_attacker, int(random.randint(50000, 60000)), target_web_server, int(dport),
                6, 0.0, 44, 1, 0, 0, 2, 2, 0, 5, 5, 0, 128, 128, 44, 44, 44, 44,
                0.0, 0.0, 0, 0, 0, 0, 4400, 0, 1, 0, 0, 0, 0, 1024, 0, 0, 0, 0, 0, 0, 0,
                0, 0, 0, 0, 0, 0, 0, 0,
                1, "Fuzzers"
            ])
        for _ in range(60):
            rows.append([
                int(window_start + random.randint(0, 59000)), int(window_start + random.randint(10, 59900)),
                china_super_attacker, int(random.randint(60001, 65000)), target_db_server, 3306,
                6, 0.0, 1500, 20, 0, 0, 2, 2, 0, 50, 50, 0, 128, 128, 1500, 44, 44, 1500,
                0.0, 0.0, 500, 5, 0, 0, 30000, 0, 0, 0, 0, 0, 20, 2048, 0, 0, 0, 0, 0, 0, 0,
                1, 5, 3, 1, 0, 0, 0, 0,
                1, "DoS"
            ])

output_file = "data/ASTOLE_Scenario_Dataset.csv"
os.makedirs(os.path.dirname(output_file), exist_ok=True)
with open(output_file, mode="w", newline="", encoding="utf-8") as f:
    writer = csv.writer(f)
    writer.writerow(headers)
    writer.writerows(rows)

print(f"🔥 Dataset único en el tiempo generado en '{output_file}'.")
print("🚀 IDs de ChromaDB blindados contra duplicaciones.")
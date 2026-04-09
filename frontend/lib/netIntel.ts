export type PortInfo = {
  service: string;
  note?: string;
};

export const EXTENDED_PORT_MAP: Record<number, PortInfo> = {
  // Common well-known ports (<1024)
  20: { service: "FTP-DATA" },
  21: { service: "FTP" },
  22: { service: "SSH" },
  23: { service: "Telnet" },
  25: { service: "SMTP" },
  49: { service: "TACACS" },
  53: { service: "DNS" },
  67: { service: "DHCP" },
  68: { service: "DHCP" },
  69: { service: "TFTP" },
  79: { service: "Finger" },
  80: { service: "HTTP" },
  81: { service: "HTTP-Alt" },
  88: { service: "Kerberos" },
  109: { service: "POP2" },
  110: { service: "POP3" },
  111: { service: "RPCBind" },
  113: { service: "Ident" },
  119: { service: "NNTP" },
  123: { service: "NTP" },
  135: { service: "MSRPC" },
  137: { service: "NetBIOS-NS" },
  138: { service: "NetBIOS-DGM" },
  139: { service: "NetBIOS-SSN" },
  143: { service: "IMAP" },
  161: { service: "SNMP" },
  162: { service: "SNMPTRAP" },
  179: { service: "BGP" },
  389: { service: "LDAP" },
  427: { service: "SLP" },
  443: { service: "HTTPS" },
  445: { service: "SMB" },
  465: { service: "SMTPS" },
  500: { service: "ISAKMP" },
  502: { service: "Modbus" },
  512: { service: "rexec" },
  513: { service: "rlogin" },
  514: { service: "Syslog" },
  515: { service: "LPD/LPR" },
  520: { service: "RIP" },
  554: { service: "RTSP" },
  587: { service: "SMTP-Submission" },
  631: { service: "IPP" },
  636: { service: "LDAPS" },
  873: { service: "rsync" },
  989: { service: "FTPS-DATA" },
  990: { service: "FTPS" },
  993: { service: "IMAPS" },
  995: { service: "POP3S" },

  // Remote admin / management
  1080: { service: "SOCKS" },
  1194: { service: "OpenVPN" },
  1433: { service: "MSSQL" },
  1521: { service: "Oracle" },
  1723: { service: "PPTP" },
  2049: { service: "NFS" },
  2000: { service: "Cisco-SCCP" },
  2222: { service: "SSH-Alt" },
  2375: { service: "Docker" },
  2376: { service: "Docker-TLS" },
  2483: { service: "Oracle" },
  2484: { service: "Oracle-TLS" },
  3128: { service: "HTTP-Proxy" },
  3389: { service: "RDP" },
  3690: { service: "SVN" },
  4444: { service: "Metasploit" },
  4500: { service: "IPsec-NAT-T" },
  5000: { service: "HTTP-Alt" },
  5353: { service: "mDNS" },
  5432: { service: "PostgreSQL" },
  5601: { service: "Kibana" },
  5672: { service: "AMQP" },
  5900: { service: "VNC" },
  5985: { service: "WinRM" },
  5986: { service: "WinRM-TLS" },
  6379: { service: "Redis" },
  6443: { service: "Kubernetes-API" },
  7001: { service: "WebLogic" },
  8000: { service: "HTTP-Alt" },
  8008: { service: "HTTP-Alt" },
  8080: { service: "HTTP-Proxy" },
  8081: { service: "HTTP-Alt" },
  8443: { service: "HTTPS-Alt" },
  8888: { service: "HTTP-Alt" },
  9000: { service: "Portainer/SonarQube" },
  9042: { service: "Cassandra" },
  9092: { service: "Kafka" },
  9200: { service: "Elasticsearch" },
  9300: { service: "Elasticsearch-Node" },
  9418: { service: "Git" },
  10000: { service: "Webmin" },
  11211: { service: "Memcached" },
  15672: { service: "RabbitMQ-Mgmt" },
  27017: { service: "MongoDB" },
  27018: { service: "MongoDB-Alt" },
  28017: { service: "MongoDB-HTTP" },
  3306: { service: "MySQL" },
};

export const normalizePortNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const port = Math.trunc(parsed);
  if (port <= 0 || port > 65535) return null;
  return port;
};

export const getPortServiceName = (port: number) => EXTENDED_PORT_MAP[port]?.service ?? null;

export const formatPortWithService = (port: number) => {
  const service = getPortServiceName(port);
  return service ? `${port} (${service})` : String(port);
};

export type ConnectionType = "Data Center" | "Residential" | "Business" | "Unknown";

export type IPMetadata = {
  country: string; // ISO code
  flag: string;
  isp: string;
  type: ConnectionType;
  countryName: string;
};

const COUNTRY_NAME: Record<string, string> = {
  ES: "España",
  US: "Estados Unidos",
  CN: "China",
  AU: "Australia",
  GB: "Reino Unido",
  DE: "Alemania",
  NL: "Países Bajos",
  FR: "Francia",
  BR: "Brasil",
  IN: "India",
  RU: "Rusia",
  ZZ: "Desconocido",
};

const META_BY_FIRST_OCTET: Record<number, Omit<IPMetadata, "countryName">> = {
  // Example heuristics requested
  185: { country: "US", flag: "🇺🇸", isp: "Amazon.com, Inc. (AS16509)", type: "Data Center" },
  80: { country: "ES", flag: "🇪🇸", isp: "Telefónica de España (AS3352)", type: "Residential" },

  // Dataset-friendly defaults
  175: { country: "CN", flag: "🇨🇳", isp: "China Telecom (AS4134)", type: "Business" },
  149: { country: "AU", flag: "🇦🇺", isp: "AARNet / UNSW (AS7575)", type: "Business" },

  104: { country: "US", flag: "🇺🇸", isp: "Microsoft Corporation (AS8075)", type: "Data Center" },
  13: { country: "US", flag: "🇺🇸", isp: "Google LLC (AS15169)", type: "Data Center" },
};

const isValidIPv4 = (ip: string) => {
  const parts = ip.split(".");
  if (parts.length !== 4) return false;
  return parts.every((p) => {
    if (!p || p.length > 3) return false;
    const n = Number(p);
    return Number.isInteger(n) && n >= 0 && n <= 255;
  });
};

export const getIPMetadata = (ip: string): IPMetadata => {
  const raw = String(ip ?? "").trim();
  if (!raw || raw === "--" || !isValidIPv4(raw)) {
    return {
      country: "ZZ",
      flag: "🏳️",
      isp: "Unknown ASN",
      type: "Unknown",
      countryName: COUNTRY_NAME.ZZ,
    };
  }

  const firstOctet = Number(raw.split(".")[0]);
  const base = META_BY_FIRST_OCTET[firstOctet];
  if (base) {
    return {
      ...base,
      countryName: COUNTRY_NAME[base.country] ?? base.country,
    };
  }

  // Conservative default
  return {
    country: "ZZ",
    flag: "🏳️",
    isp: "Unknown ASN",
    type: "Unknown",
    countryName: COUNTRY_NAME.ZZ,
  };
};

export const getConnectionTypeBadgeUi = (type: ConnectionType) => {
  if (type === "Data Center") {
    return "border-hyper-accent/30 bg-hyper-accent/10 text-hyper-accent";
  }
  if (type === "Residential") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-100";
  }
  if (type === "Business") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-100";
  }
  return "border-white/10 bg-black/30 text-zinc-200";
};

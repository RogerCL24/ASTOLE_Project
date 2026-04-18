import InvestigacionConsole from "./InvestigacionConsole";

type SearchParams = Record<string, string | string[] | undefined>;

const getParam = (searchParams: SearchParams, key: string) => {
  const value = searchParams[key];
  if (Array.isArray(value)) return value[0];
  return value;
};

export default async function InvestigacionPage({
  searchParams = {},
}: {
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const resolvedSearchParams = await Promise.resolve(searchParams ?? {});

  const caseId = getParam(resolvedSearchParams, "id") ?? "--";
  const srcIp = getParam(resolvedSearchParams, "src_ip") ?? "--";
  const attackType = getParam(resolvedSearchParams, "attack_type") ?? "--";
  const dstPort = getParam(resolvedSearchParams, "dst_port") ?? "--";
  const timestamp = getParam(resolvedSearchParams, "timestamp") ?? "--";

  return (
    <InvestigacionConsole
      caseId={caseId}
      srcIp={srcIp}
      attackType={attackType}
      dstPort={dstPort}
      timestamp={timestamp}
    />
  );
}

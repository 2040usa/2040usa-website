import { parseOrderRouteQuery } from "@/lib/order-draft/navigation";
import { StartStep } from "@/components/order/steps/start-step";

export default async function OrderStartPage({ searchParams }: { searchParams: Promise<{ route?: string | string[] }> }) {
  const params = await searchParams;
  return <StartStep initialRoute={parseOrderRouteQuery(params.route)} />;
}

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { OrderDraftProvider } from "@/components/order/order-draft-provider";
import { OrderShell } from "@/components/order/order-shell";

export const metadata: Metadata = {
  title: "Order Prototype | 2040 USA",
  description: "Configure a durable DTF project draft. No order is created.",
};

export default function OrderLayout({ children }: { children: ReactNode }) {
  return <OrderDraftProvider><OrderShell>{children}</OrderShell></OrderDraftProvider>;
}

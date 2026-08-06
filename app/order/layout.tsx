import type { Metadata } from "next";
import type { ReactNode } from "react";
import { OrderDraftProvider } from "@/components/order/order-draft-provider";
import { OrderShell } from "@/components/order/order-shell";
import { ArtworkProvider } from "@/components/artwork/artwork-provider";

export const metadata: Metadata = {
  title: "Start a Print | 2040 USA",
  description: "Prepare a durable DTF project draft. No order is created.",
};

export default function OrderLayout({ children }: { children: ReactNode }) {
  return <OrderDraftProvider><ArtworkProvider><OrderShell>{children}</OrderShell></ArtworkProvider></OrderDraftProvider>;
}

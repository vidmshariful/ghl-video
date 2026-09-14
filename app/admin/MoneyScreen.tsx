"use client";

import { useState } from "react";
import { PageHeader, Tabs } from "@/components/portal/ui";
import { SalesScreen } from "./SalesScreen";
import { OrdersScreen } from "./OrdersScreen";
import { InvoicesScreen } from "./InvoicesScreen";
import { SubscriptionsScreen } from "./SubscriptionsScreen";
import type { View } from "./nav";

/*
 * Money (phase 6): sales, orders, invoices and plans on one screen, as tabs
 * (owner decision, 14 September 2026). Each tab is the screen it was; the
 * old URLs still open them on their own, so a bookmark or a dashboard
 * shortcut keeps working. What changed is the menu: one word for the money.
 */
type Tab = "sales" | "orders" | "invoices" | "subscriptions";

export function MoneyScreen({
  allowed,
  onNavigate,
  initialTab,
}: {
  /** which of the four this admin may see */
  allowed: Tab[];
  onNavigate: (v: View) => void;
  initialTab?: Tab;
}) {
  const tabs = (
    [
      { key: "sales", label: "Sales" },
      { key: "orders", label: "Orders" },
      { key: "invoices", label: "Invoices" },
      { key: "subscriptions", label: "Plans" },
    ] as { key: Tab; label: string }[]
  ).filter((t) => allowed.includes(t.key));
  const [tab, setTab] = useState<Tab>(initialTab && allowed.includes(initialTab) ? initialTab : (tabs[0]?.key ?? "orders"));

  if (!tabs.length) return <p className="text-body text-muted">Nothing here for your role.</p>;
  return (
    <div className="w-full">
      <PageHeader title="Money" description="What came in, what is owed, and every plan that bills.">
        <Tabs tabs={tabs} active={tab} onChange={setTab} />
      </PageHeader>
      <div key={tab} className="portal-view">
        {tab === "sales" ? (
          <SalesScreen />
        ) : tab === "orders" ? (
          <OrdersScreen onNavigate={onNavigate} />
        ) : tab === "invoices" ? (
          <InvoicesScreen />
        ) : (
          <SubscriptionsScreen />
        )}
      </div>
    </div>
  );
}

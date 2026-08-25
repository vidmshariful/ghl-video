"use client";

import { KitPage, KitSection, Note, Spec, SpecGrid } from "@/components/uikits/kit";
import { Button, Card, CardGrid, Chip, EmptyState, Facts, Field, Input, Modal, PageHeader, Progress, Select, Stat, Table, Tabs, Td, Textarea, Th, Toolbar } from "@/components/portal/ui";
import { AreaChart, BarChart, Donut, Sparkline } from "@/components/portal/charts";
import { PortalSidebar } from "@/components/portal/Shell";
import { PortalSearch } from "@/app/portal/PortalSearch";
import { KanbanBoard, Drawer, StageTimeline, WorkCard } from "@/components/portal/board";
import { useState } from "react";

/* the board specimen needs a sliver of state for its drawer */
function ModalSpecimen() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <Button variant="brand" onClick={() => setOpen(true)}>
        Add something
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Add something">
        <div className="grid gap-4">
          <Field label="Name" required hint="What you would call it out loud.">
            <Input placeholder="September webinar" />
          </Field>
          <div className="flex justify-end gap-2 border-t border-hair pt-4">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="brand" onClick={() => setOpen(false)}>
              Create
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function BoardSpecimen() {
  const [open, setOpen] = useState<string | null>(null);
  const [items, setItems] = useState([
    { id: "a", column: "queued", title: "September webinar, cut for YouTube", meta: "long / 16:9 / 12 min", assignee: null, warn: null, due: "asked Aug 22", dueTone: "warn" as const },
    { id: "b", column: "in_production", title: "Product update, August", meta: "long / 16:9", assignee: "shariful@vidiosa.com", due: "due Aug 21", dueTone: "bad" as const },
    { id: "c", column: "ready", title: "Founder interview, full episode", meta: "long / 16:9 / 15 min", assignee: "prince@vidiosa.com", due: null },
    { id: "d", column: "queued", title: "Founder interview, short cut 1", meta: "cut / short / 9:16", assignee: null, due: null },
  ]);
  return (
    <div className="w-full">
      <KanbanBoard
        columns={[
          { key: "queued", label: "Edit request", tone: "neutral" },
          { key: "in_production", label: "In progress", tone: "info" },
          { key: "ready", label: "Review", tone: "good" },
        ]}
        items={items}
        onOpen={setOpen}
        onMove={async (id, to) => {
          if (to === "ready") return "Run the QC checks before this goes to the client.";
          setItems((all) => all.map((i) => (i.id === id ? { ...i, column: to } : i)));
          return null;
        }}
      />
      <Drawer open={!!open} onClose={() => setOpen(null)} title="Founder interview, full episode">
        <p className="text-body-sm text-muted">
          The item opens here, over the board, which stays live behind it.
          Esc closes.
        </p>
      </Drawer>
    </div>
  );
}
import { Clapperboard, LayoutDashboard, MessageSquare, Palette, Scissors, ShoppingCart, Sparkles } from "lucide-react";

/*
 * The portal vocabulary, on the portal surface.
 *
 * Every specimen here is the real component under a real data-surface, not a
 * drawing of one. That is the point of the kit: what is on this page is what
 * a screen gets, so a change to the system shows up here first.
 */

/* Static so the page renders identically every visit. A kit that shuffles is
 * a kit you cannot compare against yesterday. */
const MONTHS = [
  { label: "Mar", value: 4200 },
  { label: "Apr", value: 5100 },
  { label: "May", value: 3800 },
  { label: "Jun", value: 6400 },
  { label: "Jul", value: 8875 },
  { label: "Aug", value: 7200 },
];

export function PortalKitClient() {
  return (
    <KitPage
      title="Portal vocabulary"
      lede="The shared pieces every portal screen composes with. Before these existed, fourteen screens declared their own button and field styles, sixty local constants in total, which is the real reason the portals read as everything inline full width."
    >
      <KitSection
        title="The work board"
        note="The shared board Custom and Editing wear (decision 195). Drag a card between columns to move the work; a refused move bounces back with the reason, here demonstrated by the Review column. Click a card and the drawer opens over the board."
      >
        <Spec label="Kanban + drawer" surface="portal" ground="canvas">
          <BoardSpecimen />
        </Spec>
      </KitSection>

      <KitSection
        title="The client's side of the board"
        note="What the same work looks like to the client: no columns, no dragging, no assignee dots. A card carries the stage stripe and a progress bar, and the timeline says where the piece stands in the client's words. Same colours as the admin board on purpose."
      >
        <Spec label="Stage timeline" surface="portal" ground="panel">
          <div className="grid gap-6">
            <StageTimeline
              steps={[
                { key: "queued", label: "Requested", tone: "neutral" },
                { key: "in_production", label: "Being edited", tone: "info" },
                { key: "ready", label: "Your review", tone: "warn" },
                { key: "approved", label: "Done", tone: "good" },
              ]}
              currentKey="ready"
            />
            <StageTimeline
              steps={[
                { key: "queued", label: "Requested", tone: "neutral" },
                { key: "in_production", label: "Being edited", tone: "info" },
                { key: "ready", label: "Your review", tone: "warn" },
                { key: "approved", label: "Done", tone: "good" },
              ]}
              currentKey="in_production"
              currentLabel="Changes in hand"
            />
          </div>
        </Spec>
        <Spec label="Client work card" surface="portal" ground="canvas">
          <div className="grid max-w-md gap-2">
            <WorkCard
              item={{
                id: "c1",
                column: "in_production",
                title: "Brand film, September launch",
                meta: "Being made. 5 videos, 2 approved",
                due: "due Sep 12",
                dueTone: "neutral",
                progressPct: 40,
              }}
              tone="info"
              onOpen={() => {}}
            />
            <WorkCard
              item={{
                id: "c2",
                column: "review",
                title: "Onboarding walkthrough",
                meta: "Your review. 3 videos, 2 approved",
                warn: "1 waiting on you",
                progressPct: 66,
              }}
              tone="warn"
              onOpen={() => {}}
            />
            {/* a flat list has no column headers, so the card carries the
                status itself, and one control that is not "open the card" */}
            <WorkCard
              item={{
                id: "c3",
                column: "approved",
                title: "Webinar replay, cut down",
                meta: "Long form / 3 credits / 16:9",
                tag: "Approved",
              }}
              tone="good"
              onOpen={() => {}}
              action={
                <Button size="sm" variant="secondary">
                  Watch and download
                </Button>
              }
            />
          </div>
        </Spec>
      </KitSection>

      <KitSection
        title="The popup"
        note="Every add or edit form on every portal opens in this Modal: admin, customer and partner alike, never inline. Esc closes, backdrop click closes, focus is trapped, the page behind cannot scroll. Children bring their own buttons."
      >
        <Spec label="Modal" surface="portal" ground="canvas">
          <ModalSpecimen />
        </Spec>
      </KitSection>

      <KitSection
        title="Search"
        note="One box across everything a client has with us and everything they could buy. Cmd K opens it, the arrows drive the list, Enter opens. The specimen is fed fixed results rather than a real account."
      >
        <Spec label="Command palette" surface="portal" ground="panel">
          <div className="flex w-full justify-end">
            <PortalSearch
              authedFetch={async () => ({
                hits: [
                  {
                    id: "1",
                    kind: "video",
                    title: "Founder interview, full episode",
                    meta: "Editing / Ready to review",
                    section: "subscriptions",
                    focus: "1",
                    line: "editing",
                  },
                  {
                    id: "2",
                    kind: "project",
                    title: "Demo brand film, 90 seconds",
                    meta: "Custom project / Ready for you",
                    section: "projects",
                  },
                  {
                    id: "3",
                    kind: "invoice",
                    title: "Demo brand film, 90 seconds",
                    meta: "Invoice DEMO-INV-02",
                    section: "orders",
                  },
                  {
                    id: "4",
                    kind: "library",
                    title: "Unified Inbox",
                    meta: "In the library / Feature Explainer",
                    section: "library",
                    focus: "fexp-005",
                  },
                ],
              })}
              onOpen={() => {}}
            />
          </div>
        </Spec>
      </KitSection>

      <KitSection
        title="Navigation"
        note="The rail on desktop, and on a narrow window the bar that opens the menu sheet. Resize this page to check the second one: below 768px the rail is replaced, and the count of things needing somebody sits on the bar rather than hiding inside it."
      >
        <Spec label="Sidebar, real component" surface="portal" ground="panel">
          <div className="w-full">
            <PortalSidebar
              storageKey="uikit-nav-demo"
              active="videos"
              onSelect={() => {}}
              groups={[
                {
                  title: "",
                  items: [
                    { key: "dashboard", label: "Dashboard", icon: <LayoutDashboard /> },
                    { key: "brand", label: "Brand Kit", icon: <Palette />, badge: 1 },
                    { key: "messages", label: "Messages", icon: <MessageSquare />, badge: 2 },
                  ],
                },
                {
                  title: "My Videos",
                  defaultOpen: true,
                  items: [
                    { key: "videos", label: "Pre-made", icon: <Clapperboard /> },
                    { key: "projects", label: "Custom", icon: <Sparkles /> },
                    {
                      key: "subscriptions",
                      label: "Editing",
                      icon: <Scissors />,
                      disabled: true,
                      disabledTip: "Editing is switched off for your account. Ask us if you need it.",
                    },
                  ],
                },
                {
                  title: "Billings",
                  defaultOpen: true,
                  items: [
                    { key: "orders", label: "Orders and Invoices", icon: <ShoppingCart /> },
                  ],
                },
              ]}
            />
          </div>
        </Spec>
      </KitSection>

      <KitSection
        title="Page header"
        note="The top of every screen. The description is not decoration: a screen whose purpose has to be inferred from its table headers is a screen people avoid."
      >
        <Spec label="With actions and filters" surface="portal" ground="canvas">
          <div className="w-full">
            <PageHeader
              title="Orders"
              description="Everything bought, what it cost, and where it is up to."
              actions={
                <>
                  <Button variant="secondary" size="sm">Export</Button>
                  <Button variant="primary" size="sm">New order</Button>
                </>
              }
            >
              <Tabs
                tabs={[
                  { key: "all", label: "All", count: 17 },
                  { key: "paid", label: "Paid", count: 14 },
                  { key: "pending", label: "Pending", count: 3 },
                ]}
                active="all"
                onChange={() => {}}
              />
            </PageHeader>
          </div>
        </Spec>
      </KitSection>

      <KitSection
        title="Buttons"
        note="Primary is dark on the light working area, per client direction. The brand gradient is held back for the one action on a screen that is really asking for money or a commitment."
      >
        <Spec
          label="Every variant"
          surface="portal"
          code={`<Button variant="primary">Save changes</Button>`}
        >
          <Button variant="primary">Save changes</Button>
          <Button variant="brand">Order now</Button>
          <Button variant="secondary">Cancel</Button>
          <Button variant="ghost">Skip</Button>
          <Button variant="danger">Delete</Button>
          <Button variant="secondary" disabled>Unavailable</Button>
        </Spec>
        <div className="mt-4">
          <Note>
            One brand gradient per screen at most. A gradient on every save
            button spends the signal that makes the gradient mean anything.
          </Note>
        </div>
      </KitSection>

      <KitSection title="Cards and stats" count={2}>
        <Spec label="Stats, light and dark" surface="portal" ground="canvas">
          <div className="w-full">
            <CardGrid min="14rem">
              <Stat label="Revenue" value="$8,875" delta={{ text: "+23%", good: true }} hint="Paid orders, all time" />
              <Stat label="Refunds" value="$0" delta={{ text: "-100%", good: true }} hint="Down is good here" />
              <Stat label="Videos owed" value="41" hint="Across 17 orders" />
              <Stat tone="dark" label="This month" value="$7,200" delta={{ text: "+12%", good: true }} hint="The one that carries weight" />
            </CardGrid>
          </div>
        </Spec>

        <Spec label="Card, with header and footer" surface="portal" ground="canvas">
          <div className="w-full max-w-md">
            <Card
              title="Brand kit"
              description="Given once, used on every order after."
              actions={<Button variant="ghost" size="sm">Edit</Button>}
              footer={<Progress percent={83} label="Complete" />}
            >
              <Facts
                items={[
                  { label: "Brand", value: "SpeedMobi" },
                  { label: "Logo", value: <Chip tone="good">On file</Chip> },
                  { label: "Colours", value: "#F25C1A, #1F7A4D" },
                ]}
              />
            </Card>
          </div>
        </Spec>
      </KitSection>

      <KitSection
        title="Charts"
        note="Four primitives, hand built. No charting library: each ships more than this for the four shapes actually needed, and arrives with opinions about colour that then have to be fought. These read the same tokens as everything else."
      >
        <SpecGrid cols={2}>
          <Spec label="Bars, hover for the value" surface="portal">
            <div className="w-full">
              <BarChart
                data={MONTHS}
                summary="Revenue by month, rising from 4,200 in March to 7,200 in August."
                format={(n) => `$${n.toLocaleString("en-US")}`}
              />
            </div>
          </Spec>
          <Spec label="Area, with the endpoint marked" surface="portal">
            <div className="w-full">
              <AreaChart data={MONTHS} summary="Revenue trend over six months, ending at 7,200." />
            </div>
          </Spec>
          <Spec label="Donut" surface="portal">
            <div className="w-full">
              <Donut
                summary="Videos by state: 24 delivered, 11 in production, 6 waiting on a brief."
                center={{ value: 41, label: "videos" }}
                data={[
                  { label: "Delivered", value: 24, tone: "green" },
                  { label: "In production", value: 11, tone: "gold" },
                  { label: "Waiting on brief", value: 6, tone: "muted" },
                ]}
              />
            </div>
          </Spec>
          <Spec label="Sparkline, for inside a stat" surface="portal">
            <div className="w-full">
              <Stat
                label="Clicks this week"
                value="1,284"
                delta={{ text: "+8%", good: true }}
              />
              <div className="mt-3">
                <Sparkline values={[12, 18, 14, 22, 19, 28, 31]} summary="Clicks rising over seven days." />
              </div>
            </div>
          </Spec>
        </SpecGrid>
      </KitSection>

      <KitSection title="Form fields">
        <Spec label="Label, control, and what you need to know" surface="portal">
          <div className="grid w-full max-w-md gap-4">
            <Field label="Brand name" required hint="How it should appear on screen.">
              <Input placeholder="SpeedMobi" />
            </Field>
            <Field label="Turnaround" >
              <Select defaultValue="7">
                <option value="7">7 days</option>
                <option value="14">14 days</option>
              </Select>
            </Field>
            <Field label="Notes" error="Tell us something about the brand.">
              <Textarea rows={2} placeholder="Anything we should know" />
            </Field>
          </div>
        </Spec>
        <div className="mt-4">
          <Note>
            Hint and error share a slot and the error wins. Showing both puts
            the advice that was ignored next to the complaint about ignoring it.
          </Note>
        </div>
      </KitSection>

      <KitSection title="Lists">
        <Spec label="Table, and the state before there is one" surface="portal" ground="canvas">
          <div className="grid w-full gap-4">
            <Card padded={false} title="Recent orders">
              <div className="px-5 pb-5">
                <Toolbar right={<Button size="sm" variant="secondary">Filter</Button>}>
                  <Input placeholder="Search orders" className="max-w-56" />
                </Toolbar>
                <Table>
                  <thead>
                    <tr>
                      <Th>Client</Th>
                      <Th>Product</Th>
                      <Th>State</Th>
                      <Th align="right">Amount</Th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <Td strong>SpeedMobi</Td>
                      <Td>Feature Explainer</Td>
                      <Td><Chip tone="good">Delivered</Chip></Td>
                      <Td align="right">$495</Td>
                    </tr>
                    <tr>
                      <Td strong>Nimbus CRM</Td>
                      <Td>AI First Pack</Td>
                      <Td><Chip tone="warn">In production</Chip></Td>
                      <Td align="right">$1,995</Td>
                    </tr>
                    <tr>
                      <Td strong>Lumen Health</Td>
                      <Td>Demo Video</Td>
                      <Td><Chip tone="bad">Waiting on brief</Chip></Td>
                      <Td align="right">$97</Td>
                    </tr>
                  </tbody>
                </Table>
              </div>
            </Card>

            <EmptyState
              title="No orders yet"
              description="When somebody buys, their order and its videos appear here."
              action={<Button variant="primary" size="sm">Create one by hand</Button>}
            />
          </div>
        </Spec>
        <div className="mt-4">
          <Note>
            An empty state says what would be here and how to make it happen.
            &quot;No results&quot; tells somebody they have failed without
            telling them at what.
          </Note>
        </div>
      </KitSection>

      <KitSection title="Status chips">
        <Spec label="Every tone" surface="portal" code={`<Chip tone="good">Delivered</Chip>`}>
          <Chip>Draft</Chip>
          <Chip tone="good">Delivered</Chip>
          <Chip tone="warn">In production</Chip>
          <Chip tone="bad">Late</Chip>
          <Chip tone="info">Scheduled</Chip>
        </Spec>
        <div className="mt-4">
          <Note>
            Every chip carries text as well as colour. Colour alone fails
            anybody who cannot tell these apart, and roughly one man in twelve
            cannot.
          </Note>
        </div>
      </KitSection>
    </KitPage>
  );
}

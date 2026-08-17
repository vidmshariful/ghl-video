"use client";

import { KitPage, KitSection, Note, Spec, SpecGrid } from "@/components/uikits/kit";
import {
  Button,
  Card,
  CardGrid,
  Chip,
  EmptyState,
  Facts,
  Field,
  Input,
  PageHeader,
  Progress,
  Select,
  Stat,
  Table,
  Tabs,
  Td,
  Textarea,
  Th,
  Toolbar,
} from "@/components/portal/ui";
import { AreaChart, BarChart, Donut, Sparkline } from "@/components/portal/charts";

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

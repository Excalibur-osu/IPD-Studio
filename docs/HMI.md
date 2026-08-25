# HMI Studio

HMI Studio is PID Studio's operate-mode workspace: build operator mimic
screens from a widget palette — or generate one from your P&ID in one click —
and run them as a live, interactive **training/demo simulation**. It is not a
SCADA runtime and never talks to real devices.

Open it with the **HMI ⇄** button in the P&ID toolbar. Fastest tour: load the
**“HMI demo (tank level loop)”** template from the Templates menu, switch to
the HMI workspace, press **▶ RUN**, and click the pump.

## EDIT vs RUN

Like every industrial HMI package (Ignition, InTouch, WinCC, FactoryTalk),
screens have a design time and a runtime:

- **EDIT** — drag widgets from the palette (double-click also places them),
  move/resize/nudge them, draw pipes with the Pipe tool (click points, Enter
  or double-click to finish, Esc to cancel — runs stay orthogonal, hold Alt
  for a free angle), and bind everything in the property panel. Selection
  works like a drawing tool should: drag on empty canvas to rubber-band,
  Shift+click to add/remove, Ctrl+A selects all, Ctrl+D duplicates, Escape
  clears. Multi-selections get align/distribute, bring-to-front/send-to-back
  and Duplicate in the panel. **Zoom and pan** like a CAD tool: the wheel
  zooms at the cursor, Space- or middle-drag pans, ⛶ (or Ctrl+0) fits — RUN
  always shows the full page, like a real operator station. **Clipboard**:
  Ctrl+C/X/V copies widgets *and* pipes and pastes them centered at the
  cursor — including onto a different screen. A selected pipe is fully
  editable: drag the round vertex handles, **double-click a run to insert a
  bend, double-click a bend to remove it**, and drag any straight run
  sideways (the ◇ marks) — both corners follow, axis-locked.
  Screens manage like sheets: **drag the tabs to reorder**, ⧉ duplicates a
  screen (fresh ids, bindings remapped), ★ marks the **home screen**, names
  stay unique, and deletes confirm in a proper dialog (undo brings a screen
  back). Edits are undoable and autosaved with the drawing.
- **RUN** — the simulator compiles **every screen into one plant** and ticks
  5×/s, **opening on the ★ home screen** like a real operator station. The
  toolbar becomes an operator header: screen title, sim clock, alarm counts
  by priority, and a ⌂ Home button. Values move, tanks fill, pipes animate
  proportional to flow. The screen tabs (and Screen-link buttons) navigate
  between pages while the plant keeps running — and every **Screen link
  wears a priority dot when its target screen has standing alarms**, so
  trouble is visible from anywhere. Click
  anything tagged to open its **faceplate** — a draggable DCS-style plate
  (Esc closes): pumps get state + Start/Stop + live flow-through; valves a
  position scale with entry; measurements a **scale bar with the alarm
  limits drawn as ticks**, engineering units and a live sparkline;
  controllers the full PV/SP/OUT bar trio with the SP marked on the PV
  scale, ▲▼ setpoint entry clamped to range, AUTO/MAN (output entry only in
  MAN — and the transfer is **bumpless**: AUTO resumes from the operator's
  output instead of kicking), plus the tag's standing alarms with per-alarm
  Ack. Run/Pause, 1×/5× speed, and Reset live in the toolbar; the status
  bar shows the sim clock.

## Widgets

Tank (animated level with LL/L/H/HH markers) · Pump (running state + spin) ·
Valve (on/off or throttling %, actuator stem) · Value display (with an
optional **sparkline** — ISA-101's "which way is it heading" mark) · **Bar
indicator** — the ISA-101 analog: a vertical scale with the PV as
pointer+fill, alarm limits as colored ticks and the SP as a caret · Gauge
(with warn/alarm zone arcs) · **Trend** — up to **4 pens** (the widget's tag
plus any `TAG.SIGNAL`, controller SP/OP included), a real **mm:ss time
axis** that stays truthful across 1×/5× speed changes, a 1/2/4-minute span,
limit and SP lines, and a **hover cursor** that freezes the window and reads
out every pen at that instant · Lamp · Button · Switch · **Screen link**
(jumps to another screen in RUN) · Text · **Group panel** (titled frame for
sectioning the screen — grab it by its title or border) · **P&ID symbol** —
any of the catalog symbols as a graphic, so imported drawings never lose
equipment.

## Tags and signals

Every widget binds to a **tag** (e.g. `TK-101`); the simulator derives its
signals: `.PV` (value), `.RUN` (motor), `.OP` (valve/controller output %),
`.OPEN` (on/off valve), `.SP`, `.MODE` (AUTO/MAN). Lamps, buttons and
switches bind to a fully-qualified signal like `P-101.RUN`.

**You never have to type a tag.** The Tag field is a picker: it lists every
identity in your P&ID — instruments with their ISA meaning spelled out
("FIC-101 · Flow Indicating Controller"), equipment, valves — plus tags
already used on other screens, filtered as you type (hyphens optional). The
Signal field offers every `TAG.SIGNAL` the runtime can actually serve. Free
text still works for tags that exist nowhere else.

Value displays, gauges, bars and trends also expose their **value source** in
the panel: tick **Controller** to make the widget a faceplate-capable
controller, or bind the value to the live plant with **Bind tank** / **Bind
pipe** — press **⊙ pick**, then click the tank or pipe right on the canvas
(Esc cancels). Unbound displays wander gently around their **Idle value**.

The physics is deliberately simple and honest about it: pumps deliver rated
flow through open valves, tanks integrate level, sources feed by pressure,
measurements drift realistically. RUN starts **calm**, the way a real plant
hands over: pumps stopped, every hand valve in a flow path closed, undriven
throttling valves at 0% — nothing moves and nothing alarms until the
operator lines up valves and starts pumps (or a control loop acts). Lines
that dead-end without any valve can never drain a tank. Alarm limits (LL/L/H/HH) on tanks and
displays drive a blinking, acknowledgeable alarm banner with an
ISA-18.2-style lifecycle (active → acked / cleared) and **three priorities**
— high ■ red, medium ▲ orange, low ● yellow (shape *and* color, so priority
survives color-blindness; HH/LL ride one step above the H/L pair, and each
tag can override its priority). Alarms don't chatter: every limit has a
**hysteresis deadband** (default 1% of range, tunable) and an optional
**on-delay** so a value brushing its limit doesn't annunciate until it
means it. And they can be **suppressed the ISA-18.2 way**: **shelve** an
alarm for 5/15/30 minutes (it returns by itself), take a tag **out of
service**, and flow alarms on a line whose pumps are commanded off
suppress themselves (**suppressed by design**) — each with its own section
in the summary, a ⊘ badge on the widget itself, and journal entries for
every shelve/restore. The banner expands into a full **alarm
summary** — a real table (time, priority, tag, level, **value at trip**,
state) with sortable columns, priority filters and per-row Shelve / OOS /
Ack — and a **journal** of every raise / return-to-normal / ack with its
sim time. Clicking an alarm's tag navigates to the screen that shows it
**and pulses the widget** so you see exactly which one it was.
The journal also records **every operator action** — `START`, `CLOSE`,
`SP 50 → 62`, `MAN` — the way a real DCS audit trail does (slider bursts
coalesce into one entry); filter it to Alarms or Commands and copy the
visible lines out with one click.

## Build from P&ID

**From P&ID…** converts a sheet into an HMI screen: vessels become tanks
(stretched vessels keep their stretched footprint, rotated pumps stay
rotated), pumps become pumps, control valves become throttling valves,
measurements become value displays bound to what their ISA family actually
measures — an `LT` finds its vessel through its impulse line, an `FT`/`FI`
finds its process run, while `TT`/`PI` (no bulk model) keep plausible demo
values with sensible units (`%`, `°C`, `bar`, `m³/h`). Controllers become
faceplate displays, process lines become pipes with the drawing's routing,
and signal lines are dropped — exactly what a real HMI shows. The import is
a **snapshot**: rearrange it freely; **Re-import** rebuilds it from the
sheet when you want.

Because tags are validated ISA tags, control loops wire themselves by family
and loop number: `LIC-101` finds `LT-101` (PV) and `LV-101` (output) and
actually holds the level at its setpoint in RUN — switch it to MAN in the
faceplate and stroke the valve yourself.

## Themes

Per-screen toggle in the toolbar:

- **Classic** (default) — colorful SCADA look: green running, red stopped,
  blue liquid.
- **ISA-101** — high-performance gray in the spirit of ISA-101: muted
  equipment, color reserved for alarms and abnormal states, the style modern
  control rooms use to make problems impossible to miss.

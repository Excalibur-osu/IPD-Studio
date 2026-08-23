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
  and Duplicate in the panel; a selected pipe shows draggable vertex handles.
  Edits are undoable and autosaved with the drawing.
- **RUN** — the simulator compiles **every screen into one plant** and ticks
  5×/s. Values move, tanks fill, pipes animate proportional to flow. The
  screen tabs (and Screen-link buttons) navigate between pages while the
  plant keeps running — exactly how a real operator station works. Click
  equipment to open its **faceplate**: Start/Stop for pumps, position for
  valves, PV/SP/OP with AUTO/MAN for controllers. Run/Pause, 1×/5× speed,
  and Reset live in the toolbar; the status bar shows the sim clock.

## Widgets

Tank (animated level with LL/L/H/HH markers) · Pump (running state + spin) ·
Valve (on/off or throttling %, actuator stem) · Value display · **Bar
indicator** — the ISA-101 analog: a vertical scale with the PV as
pointer+fill, alarm limits as colored ticks and the SP as a caret · Gauge
(with warn/alarm zone arcs) · Trend (live history with gridlines, scale
labels, limit and SP lines) · Lamp · Button · Switch · **Screen link** (jumps
to another screen in RUN) · Text · **Group panel** (titled frame for
sectioning the screen — grab it by its title or border) · **P&ID symbol** —
any of the catalog symbols as a graphic, so imported drawings never lose
equipment.

## Tags and signals

Every widget binds to a **tag** (e.g. `TK-101`); the simulator derives its
signals: `.PV` (value), `.RUN` (motor), `.OP` (valve/controller output %),
`.OPEN` (on/off valve), `.SP`, `.MODE` (AUTO/MAN). Lamps, buttons and
switches bind to a fully-qualified signal like `P-101.RUN`.

The physics is deliberately simple and honest about it: pumps deliver rated
flow through open valves, tanks integrate level, sources feed by pressure,
measurements drift realistically. Alarm limits (LL/L/H/HH) on tanks and
displays drive a blinking, acknowledgeable alarm banner with an
ISA-18.2-style lifecycle (active → acked / cleared) and priorities: HH/LL
are critical (red ■), H/L are warnings (amber ▲) — shape *and* color, so
priority survives color-blindness. The banner expands into a full **alarm
summary** and a **journal** of every raise / return-to-normal / ack with its
sim time, and clicking an alarm's tag navigates to the screen that shows it.

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

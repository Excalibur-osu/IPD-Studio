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
  or double-click to finish, Esc to cancel), and bind everything in the
  property panel. Edits are undoable and autosaved with the drawing.
- **RUN** — the simulator ticks 5×/s. Values move, tanks fill, pipes animate
  proportional to flow. Click equipment to open its **faceplate**: Start/Stop
  for pumps, position for valves, PV/SP/OP with AUTO/MAN for controllers.
  Run/Pause, 1×/5× speed, and Reset live in the toolbar.

## Widgets

Tank (animated level) · Pump (running state + spin) · Valve (on/off or
throttling %) · Value display · Gauge · Trend (live history) · Lamp · Button ·
Switch · Text · **P&ID symbol** — any of the catalog symbols as a graphic, so
imported drawings never lose equipment.

## Tags and signals

Every widget binds to a **tag** (e.g. `TK-101`); the simulator derives its
signals: `.PV` (value), `.RUN` (motor), `.OP` (valve/controller output %),
`.OPEN` (on/off valve), `.SP`, `.MODE` (AUTO/MAN). Lamps, buttons and
switches bind to a fully-qualified signal like `P-101.RUN`.

The physics is deliberately simple and honest about it: pumps deliver rated
flow through open valves, tanks integrate level, sources feed by pressure,
measurements drift realistically. Alarm limits (LL/L/H/HH) on tanks and
displays drive a blinking, acknowledgeable alarm banner with an
ISA-18.2-style lifecycle (active → acked / cleared).

## Build from P&ID

**From P&ID…** converts a sheet into an HMI screen: vessels become tanks,
pumps become pumps, control valves become throttling valves, transmitters
become value displays bound to what they measure (an `LT` finds its vessel
through its impulse line), controllers become faceplate displays, process
lines become pipes with the drawing's routing, and signal lines are dropped —
exactly what a real HMI shows. The import is a **snapshot**: rearrange it
freely; **Re-import** rebuilds it from the sheet when you want.

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

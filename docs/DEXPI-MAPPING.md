# PID Studio → DEXPI/Proteus mapping

PID Studio exports a **DEXPI-oriented XML file in the Proteus Schema 4.2
shape** (`Toolbar → DEXPI`). It is designed for interoperability with
DEXPI-consuming tools but is **not certified** against the DEXPI conformance
suite. Geometry is in CSS pixels; 1 mm = 3.7795 px.

| PID Studio model | Proteus/DEXPI element |
|---|---|
| Project + sheet metadata | `PlantInformation` (Application, ProjectName, DrawingNumber) |
| Sheet + size | `Drawing` with `Extent` (Min/Max in px) |
| `PlantNode` kind ≠ instrument | `Equipment @ID @TagName @ComponentClass` + `Position/Location` |
| `PlantNode` kind = instrument | `ProcessInstrument` (same shape); tag letters/loop/suffix as GenericAttributes |
| Symbol identity, rotation, label | `GenericAttributes Set="PIDStudio"` |
| Process/pipe edge | `PipingNetworkSystem > PipingNetworkSegment` with `Connection @FromID @FromNode @ToID @ToNode`, `CenterLine/Coordinate` (free ends + waypoints), line number parts as GenericAttributes |
| Signal edge | `InformationFlow` (same Connection/CenterLine shape) |
| ComponentClass | explicit map in `src/export/componentClass.ts`, default `PlantItem` |

Known gaps (v0.2): no `ShapeCatalogue`/`Presentation` geometry, no nozzle
sub-objects, ports exported as `FromNode`/`ToNode` names only, one
`PipingNetworkSystem` per segment rather than merged line topology, no import.

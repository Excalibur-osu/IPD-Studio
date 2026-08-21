import Canvas from './canvas/Canvas'
import Palette from './panels/Palette'
import PropertyPanel from './panels/PropertyPanel'

export default function App() {
  return (
    <div className="app">
      <header className="toolbar">PID Studio</header>
      <Palette />
      <Canvas />
      <PropertyPanel />
      <footer className="status">Ready</footer>
    </div>
  )
}

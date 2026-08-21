import Canvas from './canvas/Canvas'
import Palette from './panels/Palette'

export default function App() {
  return (
    <div className="app">
      <header className="toolbar">PID Studio</header>
      <Palette />
      <Canvas />
      <aside className="props">Properties</aside>
      <footer className="status">Ready</footer>
    </div>
  )
}

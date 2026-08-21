import Canvas from './canvas/Canvas'

export default function App() {
  return (
    <div className="app">
      <header className="toolbar">PID Studio</header>
      <aside className="palette">Palette</aside>
      <Canvas />
      <aside className="props">Properties</aside>
      <footer className="status">Ready</footer>
    </div>
  )
}

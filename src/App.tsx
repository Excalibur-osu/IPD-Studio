import Canvas from './canvas/Canvas'
import Toolbar from './panels/Toolbar'
import Palette from './panels/Palette'
import PropertyPanel from './panels/PropertyPanel'
import Drawer from './panels/Drawer'
import StatusBar from './panels/StatusBar'

export default function App() {
  return (
    <div className="app">
      <Toolbar />
      <Palette />
      <div className="center">
        <Canvas />
        <Drawer />
      </div>
      <PropertyPanel />
      <StatusBar />
    </div>
  )
}

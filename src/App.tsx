import { lazy, Suspense, useState } from 'react'
import Canvas from './canvas/Canvas'
import Toolbar from './panels/Toolbar'
import Palette from './panels/Palette'
import PropertyPanel from './panels/PropertyPanel'
import Drawer from './panels/Drawer'
import SheetTabs from './panels/SheetTabs'
import StatusBar from './panels/StatusBar'
import SearchOverlay from './panels/SearchOverlay'
import QuickLineEditor from './panels/QuickLineEditor'
import UpdateToast from './panels/UpdateToast'
import WelcomeOverlay from './panels/WelcomeOverlay'

const HmiWorkspace = lazy(() => import('./hmi/HmiWorkspace'))

function readPref(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key)
    return v === null ? fallback : v === '1'
  } catch {
    return fallback
  }
}

function writePref(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, value ? '1' : '0')
  } catch {
    /* private mode etc. — collapse state just won't persist */
  }
}

export default function App() {
  const [showPalette, setShowPalette] = useState(() => readPref('pid.ui.palette', true))
  const [showProps, setShowProps] = useState(() => readPref('pid.ui.props', true))
  const togglePalette = (v: boolean) => { setShowPalette(v); writePref('pid.ui.palette', v) }
  const toggleProps = (v: boolean) => { setShowProps(v); writePref('pid.ui.props', v) }
  const [workspace, setWorkspaceState] = useState<'pid' | 'hmi'>(() => {
    try { return localStorage.getItem('pid.ui.workspace') === 'hmi' ? 'hmi' : 'pid' } catch { return 'pid' }
  })
  const setWorkspace = (w: 'pid' | 'hmi') => {
    setWorkspaceState(w)
    try { localStorage.setItem('pid.ui.workspace', w) } catch { /* private mode */ }
  }

  if (workspace === 'hmi') {
    return (
      <Suspense fallback={<div style={{ padding: 24 }}>Loading HMI workspace…</div>}>
        <HmiWorkspace onExit={() => setWorkspace('pid')} />
        <UpdateToast />
      </Suspense>
    )
  }

  return (
    <div className={`app${showPalette ? '' : ' no-palette'}${showProps ? '' : ' no-props'}`}>
      <Toolbar onOpenHmi={() => setWorkspace('hmi')} />
      {showPalette ? (
        <Palette onCollapse={() => togglePalette(false)} />
      ) : (
        <button className="panel-strip strip-left" title="Show symbol palette" onClick={() => togglePalette(true)}>
          Symbols ▸
        </button>
      )}
      <div className="center">
        <Canvas />
        <SheetTabs />
        <Drawer />
      </div>
      {showProps ? (
        <PropertyPanel onCollapse={() => toggleProps(false)} />
      ) : (
        <button className="panel-strip strip-right" title="Show properties" onClick={() => toggleProps(true)}>
          ◂ Properties
        </button>
      )}
      <StatusBar />
      <SearchOverlay />
      <QuickLineEditor />
      <UpdateToast />
      <WelcomeOverlay />
    </div>
  )
}

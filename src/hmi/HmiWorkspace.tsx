import './hmi.css'
import { useStore, activeHmiScreen } from '../store/store'
import HmiToolbar from './HmiToolbar'
import ScreenTabs from './ScreenTabs'

export default function HmiWorkspace({ onExit }: { onExit(): void }) {
  const screen = useStore(activeHmiScreen)
  const addScreen = useStore((s) => s.addScreen)
  return (
    <div className="hmi">
      <HmiToolbar onExit={onExit} />
      <div className="hmi-side" />
      <div className="hmi-center">
        {screen ? (
          <>
            <div className="hmi-canvas-wrap">
              <svg data-testid="hmi-canvas" viewBox="0 0 1600 1000" />
            </div>
            <ScreenTabs />
          </>
        ) : (
          <div className="hmi-empty">
            <p>No HMI screens yet.</p>
            <button onClick={addScreen}>New screen</button>
            <button disabled title="Coming soon">Build from P&ID sheet…</button>
          </div>
        )}
      </div>
      <div className="hmi-props" />
      <div className="hmi-status"><span>HMI workspace</span></div>
    </div>
  )
}

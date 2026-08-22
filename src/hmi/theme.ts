import type { HmiTheme } from './model'

export interface ThemeTokens {
  bg: string; grid: string; text: string; textDim: string
  equipStroke: string; equipFill: string
  running: string; stopped: string; open: string; closed: string
  liquid: string; pipe: string; pipeFlow: string
  alarm: string; alarmAck: string; warn: string
  sp: string; op: string; panel: string
}

export const THEMES: Record<HmiTheme, ThemeTokens> = {
  /** Classic SCADA: dark ground, saturated states — demo-friendly. */
  classic: {
    bg: '#0f2338', grid: '#16324e', text: '#e8f0fa', textDim: '#8fa8c0',
    equipStroke: '#9fb6cc', equipFill: '#1b3a58',
    running: '#26c281', stopped: '#e0455a', open: '#26c281', closed: '#e0455a',
    liquid: '#38a8e8', pipe: '#5c789a', pipeFlow: '#7fd4ff',
    alarm: '#ff4d4d', alarmAck: '#ffb020', warn: '#ffb020',
    sp: '#ffd166', op: '#9b8cff', panel: '#132c46',
  },
  /** ISA-101 high-performance: gray ground, color reserved for abnormal. */
  hp: {
    bg: '#d9d9d9', grid: '#cfcfcf', text: '#1f1f1f', textDim: '#5a5a5a',
    equipStroke: '#4a4a4a', equipFill: '#c4c4c4',
    running: '#3d3d3d', stopped: '#f0f0f0', open: '#3d3d3d', closed: '#f0f0f0',
    liquid: '#a8b8c4', pipe: '#8a8a8a', pipeFlow: '#6a7f92',
    alarm: '#d92b2b', alarmAck: '#e08a00', warn: '#e08a00',
    sp: '#2b5cd9', op: '#6a4fd9', panel: '#e8e8e8',
  },
}

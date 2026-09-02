import { useSyncExternalStore } from 'react'

export type Language = 'zh-CN' | 'en'

const KEY = 'pid.ui.language'
const listeners = new Set<() => void>()

const ZH: Record<string, string> = {
  'New': '新建', 'Open': '打开', 'Save': '保存', 'Download': '下载',
  'Templates…': '模板…', 'Sample plant': '示例工厂', 'Refinery unit (3 sheets)': '炼油单元（3张图）',
  'HMI demo (tank level loop)': 'HMI 示例（罐液位回路）', 'Blank A3 drawing': '空白 A3 图纸',
  'Utility headers (A1)': '公用工程总管（A1）', 'Underlay': '底图', 'Fluids': '介质', 'Export ▾': '导出 ▾',
  'Fit': '适配', 'Draw:': '绘制：', 'Symbols': '符号', 'Properties': '属性', 'Typical Loops': '典型回路',
  'Custom': '自定义', 'Instruments': '仪表', 'Control Valves': '控制阀', 'Manual Valves': '手动阀',
  'Safety & Relief': '安全与泄放', 'Flow Elements': '流量元件', 'Accessories': '附件',
  'Pumps & Rotating': '泵与旋转设备', 'Vessels & Columns': '容器与塔器', 'Heat Transfer': '换热设备',
  'Fittings & Inline': '管件与管道元件', 'Control & Logic': '控制与逻辑', 'Annotation': '标注',
  'Search symbols…  (Enter places)': '搜索符号…（回车放置）', '＋ Import symbol…': '＋ 导入符号…',
  '▴ Show less': '▴ 收起', 'Show all': '显示全部', '▾ Show all': '▾ 显示全部', 'Project': '项目', 'Name': '名称',
  'Author': '作者', 'Tag numbering starts at': '位号起始编号', 'Drawing №': '图纸编号',
  'Revision': '版次', 'Sheet size': '图幅', 'Line': '管线', 'Class': '类别', 'Flow arrow': '流向箭头',
  'Fluid': '介质', 'Line Number': '管线号', 'Symbol': '符号', 'Engineering': '工程数据', 'Where used': '引用位置',
  'Align': '对齐', 'Duplicate': '复制', 'Delete selection': '删除所选', 'Reset text position': '重置文字位置',
  'Datasheet…': '数据表…', '＋ Add pin': '＋ 添加连接点', 'Width': '宽度', 'Height': '高度', 'Pins': '连接点',
  'Issues': '问题', 'Loops': '回路', 'selected': '已选择', 'symbols': '个符号', 'symbol': '个符号',
  'No findings': '没有发现问题', 'critical': '严重问题', 'finding': '项发现', 'findings': '项发现',
  'Drawing': '图纸', 'CAD / data exchange': 'CAD / 数据交换', 'Reports (CSV)': '报表（CSV）',
  'SVG image': 'SVG 图片', 'PDF — this sheet': 'PDF — 当前图纸', 'PDF — all sheets': 'PDF — 全部图纸',
  'PNG image': 'PNG 图片', 'DXF (AutoCAD)': 'DXF（AutoCAD）', 'DEXPI XML': 'DEXPI XML',
  'Instrument index': '仪表索引', 'Line list': '管线表', 'Datasheet matrix': '数据表矩阵',
  'Add sheet': '添加图纸', 'Delete sheet': '删除图纸', 'Language': '语言', '中文': '中文', 'English': '英文',
  'Start drawing': '开始绘图', 'Open the sample plant': '打开示例工厂',
  'Welcome to IPD Studio': '欢迎使用 IPD Studio',
  'Saved': '已保存', 'Saving…': '保存中…', 'Unsaved changes': '有未保存修改',
  'Saved to your account': '已保存到账号', 'Not saved to your account': '未保存到账号',
  'P&ID drawing with real ISA symbols — and an HMI simulator that brings your plant to life. Free for personal, academic, and nonprofit use. Here\'s 2½ minutes of it:': '使用真实 ISA 符号绘制 P&ID，并通过 HMI 仿真让工艺流程运行起来。个人、学习和非营利用途免费。这里有一段 2 分半钟的演示：',
  'Everything stays on your machine — no account, no upload.': '所有内容都保存在你的电脑上，不需要账号，也不会上传。',
  'Draw': '绘图', 'Data': '数据', 'Checks': '检查', 'The P&ID sheet': 'P&ID 图纸',
  'Instrument index and line list, generated from the drawing': '由图纸生成的仪表索引和管线表',
  'Every validation finding and suggestion, full screen': '全屏查看所有校验问题和建议',
  'HMI Studio — operator screens and simulation': 'HMI Studio — 操作员画面与仿真',
  'Workspaces': '工作区', 'Pipe': '管线', 'From P&ID…': '从 P&ID 导入…', 'Re-import': '重新导入',
  'Classic': '经典', 'Pause': '暂停', 'Play': '播放', 'Reset': '重置', 'Events': '事件',
  'Training / demo simulation — not for operations': '培训/演示仿真 — 不得用于实际操作',
  'Back to the P&ID editor': '返回 P&ID 编辑器', 'Stop (edit)': '停止（编辑）',
  'Home screen': '主页画面', 'Re-import screen': '重新导入画面', 'Cancel': '取消',
  'Export CSV': '导出 CSV',
  'No tagged instruments yet. Tag a symbol on the drawing and it appears here.': '还没有已标注仪表。请在图纸上给符号添加位号。',
  'No numbered lines yet. Give a process line a line number and it appears here.': '还没有编号管线。请为工艺管线填写管线号。',
  'Locate': '定位', 'Show this on the drawing': '在图纸中显示', 'Go to the drawing': '跳转到图纸',
  'Critical': '严重', 'Warning': '警告', 'Information': '信息', 'Discipline': '专业', 'all': '全部',
  'Nothing critical': '没有严重问题', 'Nothing to fix — every tag parses, every line lands, and the instrumentation reads as complete.': '没有需要修正的问题：位号、管线连接和仪表数据目前完整。',
  'Accept': '接受', 'Reopen': '重新打开', 'Accepted findings': '已接受的问题', 'Open the full report in Checks →': '在“检查”中打开完整报告 →',
  'Fix': '修复', 'Diagram': '回路图', 'No findings — the drawing is clean.': '没有发现问题，图纸状态良好。',
  'No tagged instruments yet.': '还没有已标注仪表。', 'Nothing critical —': '没有严重问题 —', 'observation': '项观察', 'observations': '项观察',
  'These would stop the drawing being issued.': '这些问题会阻止图纸发布。',
  'Worth resolving before issue; not all of them are mistakes.': '建议在发布前处理，但不一定都是错误。',
  'Observations. An engineer may well have meant it this way.': '提示项，工程师可能就是有意这样设计的。',
  'in Checks': '（检查页）',
  'Equipment': '设备', 'Indicators': '指示器', 'Controls': '控制', 'Layout': '布局',
  'Tank': '罐', 'Pump': '泵', 'Valve': '阀', 'Agitator': '搅拌器', 'Compressor': '压缩机', 'Blower': '鼓风机', 'Conveyor': '输送机', 'Heater': '加热炉', 'P&ID symbol': 'P&ID 符号',
  'Value display': '数值显示', 'Bar indicator': '条形指示器', 'Gauge': '仪表盘', 'Trend': '趋势', 'Lamp': '指示灯',
  'Button': '按钮', 'Switch': '开关', 'Screen link': '画面链接', 'Text': '文本', 'Group panel': '分组面板',
  'Drag onto the canvas (or double-click to place)': '拖到画布上（或双击放置）',
  'My drawings…': '我的图纸…', 'Save to cloud': '保存到云端', 'Sign out': '退出登录', 'Buy me a coffee ☕': '请作者喝咖啡 ☕',
  'Sign in to keep drawing': '登录后继续绘图',
  'Your P&IDs, HMI screens and cost estimates live in your account, so they open on whatever machine you sit down at.': '你的 P&ID、HMI 画面和成本估算会保存在账号中，可在不同设备上继续使用。',
  'ISA-5.1 tags parsed and validated as you draw': '绘图时自动解析并校验 ISA-5.1 位号',
  'Instrument index and line list generated from the model': '根据模型自动生成仪表索引和管线表',
  'Operator screens you can run as a live simulation': '可运行实时仿真的操作员画面',
  'Screen': '画面', 'Theme': '主题', 'classic': '经典', 'Tag': '位号', 'Title': '标题', 'Label': '标签',
  'Go to': '跳转到', 'Capacity': '容量', 'Start level %': '初始液位 %', 'Alarm limits': '报警限值',
  'Deadband': '死区', 'On-delay s': '延时（秒）', 'Priority': '优先级', 'widget': '控件', 'widgets': '个控件', 'pipe': '管线', 'pipes': '条管线',
  'Cloud drawings': '云端图纸', 'Checking your account…': '正在检查账号…', 'Loading your drawings…': '正在加载你的图纸…',
  'Save over': '覆盖保存', 'Save current drawing': '保存当前图纸', 'Save as new': '另存为新图纸', 'Reload list': '重新加载列表', 'Dismiss': '关闭',
  'Save name': '保存名称', 'Rename': '重命名', 'Discard & open': '放弃修改并打开', 'open here': '当前打开', 'sheet': '张图纸', 'sheets': '张图纸',
  'Sign in to keep drawings in your IPD Studio account. They stay private to that account — nobody else can list or open them.': '登录 IPD Studio 账号以保存图纸。图纸仅对该账号私有，其他人无法查看或打开。',
  'Opening this replaces the drawing on screen — your unsaved changes are lost.': '打开后会替换当前图纸，未保存的修改将丢失。',
  'At least 6 characters.': '至少 6 个字符。', 'Optional': '可选', 'Email': '邮箱', 'Password': '密码',
  'Create account': '创建账号', 'Sign in': '登录', 'Forgot password?': '忘记密码？', 'Continue with Google': '使用 Google 继续', 'Working…': '处理中…', 'or': '或',
}

function readLanguage(): Language {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'zh-CN' || saved === 'en') return saved
  } catch { /* private mode */ }
  return typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en'
}

export function language(): Language { return readLanguage() }

export function setLanguage(next: Language): void {
  try { localStorage.setItem(KEY, next) } catch { /* private mode */ }
  for (const listener of listeners) listener()
}

export function tr(text: string, lang = readLanguage()): string {
  return lang === 'zh-CN' ? (ZH[text] ?? text) : text
}

export function useLanguage(): Language {
  return useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => listeners.delete(listener) },
    readLanguage,
    () => 'en',
  )
}

export function useT(): (text: string) => string {
  useLanguage()
  return (text: string) => tr(text)
}

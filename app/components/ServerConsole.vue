<!-- components/ServerConsole.vue -->
<template>
  <div class="space-y-3">
    <!-- Вывод консоли -->
    <div
      class="bg-[#0a0a0a] border border-white/10 rounded-xl overflow-hidden"
    >
      <!-- Заголовок консоли -->
      <div class="flex items-center justify-between px-3 sm:px-4 py-2.5 bg-white/[0.03] border-b border-white/[0.07]">
        <div class="flex items-center gap-2.5">
          <span class="w-6 h-6 rounded-lg bg-emerald-300/10 border border-emerald-300/25 flex items-center justify-center font-mono text-xs font-bold text-emerald-300">>_</span>
          <span class="text-xs sm:text-sm font-semibold text-white/85">{{ $t('console.title') }}</span>
        </div>
        <div class="flex items-center gap-1.5 sm:gap-2">
          <span v-if="connectionStatus === 'connected'" class="text-[10px] sm:text-xs text-emerald-300 bg-emerald-300/10 border border-emerald-300/25 rounded-full px-2.5 py-0.5 flex items-center gap-1.5">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse"></span>
            <span class="hidden sm:inline">{{ $t('console.connected') }}</span>
          </span>
          <span v-else-if="connectionStatus === 'connecting'" class="text-[10px] sm:text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/25 rounded-full px-2.5 py-0.5 flex items-center gap-1.5">
            <span class="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse"></span>
            <span class="hidden sm:inline">{{ $t('console.connecting') }}</span>
          </span>
          <span v-else-if="connectionStatus === 'error'" class="text-[10px] sm:text-xs text-red-400 bg-red-500/10 border border-red-500/25 rounded-full px-2.5 py-0.5 flex items-center gap-1.5">
            <span class="w-1.5 h-1.5 rounded-full bg-red-400"></span>
            <span class="hidden sm:inline">{{ $t('console.error') }}</span>
          </span>
          <span v-else-if="waitingForServer" class="text-[10px] sm:text-xs text-white/40 bg-white/[0.05] border border-white/10 rounded-full px-2.5 py-0.5 flex items-center gap-1.5">
            <span class="w-1.5 h-1.5 rounded-full bg-gray-500"></span>
            <span class="hidden sm:inline">{{ $t('console.waiting') }}</span>
          </span>
          <span v-else class="text-[10px] sm:text-xs text-white/30">—</span>
          
          <button 
            v-if="connectionStatus !== 'connecting'"
            @click="reconnect"
            class="text-white/35 hover:text-emerald-300 transition-colors ml-1 p-1 rounded-lg hover:bg-white/[0.06]"
            :title="$t('console.reconnect')"
          >
            <svg class="w-3.5 h-3.5 sm:w-4 sm:h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <rect width="24" height="24" fill="none"/>
              <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
                <path d="M19.933 13.041a8 8 0 1 1-9.925-8.788c3.899-1 7.935 1.007 9.425 4.747"/>
                <path d="M20 4v5h-5"/>
              </g>
            </svg>
          </button>
        </div>
      </div>
      
      <!-- Область логов -->
      <div class="relative">
      <div
        ref="consoleContainer"
        class="h-[300px] sm:h-[400px] lg:h-[450px] overflow-y-auto p-3 sm:p-4 font-mono text-xs sm:text-sm"
        @wheel="handleScroll"
        @scroll="handleScroll"
      >
        <div v-if="consoleLines.length === 0" class="text-gray-500 text-center py-8">
          {{ $t('console.waitingLogs') }}
        </div>
        <div v-for="(line, i) in consoleLines" :key="i" :class="['flex rounded-md px-1.5 -mx-1.5 py-[1px] hover:bg-white/[0.03] transition-colors', line.type === 'command' && 'bg-emerald-300/[0.05]']">
          <!-- Команда -->
          <span v-if="line.type === 'command'" class="text-emerald-300 font-bold mr-2 flex-shrink-0">></span>
          <!-- Команда -->
          <span v-if="line.type === 'command'" class="text-cyan-400 mr-2 flex-shrink-0">></span>
          
          <!-- Системное сообщение -->
          <span v-else-if="line.type === 'system'" class="text-gray-500 mr-2 flex-shrink-0 text-[10px] sm:text-xs">
            [{{ formatTime(line.timestamp) }}]
          </span>
          
          <!-- Статус сервера -->
          <span v-else-if="line.type === 'status'" class="text-yellow-400 mr-2 flex-shrink-0 text-xs">
            <svg class="w-3 h-3 sm:w-3.5 sm:h-3.5 inline" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <rect width="24" height="24" fill="none"/>
              <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 6a7.75 7.75 0 1 0 10 0m-5-2v8"/>
            </svg>
          </span>
          
          <!-- Сообщения Cardinal Panel (серый цвет) -->
          <span v-else-if="line.type === 'ktpanel'" class="text-gray-400 mr-2 flex-shrink-0 text-xs"></span>
          
          <!-- Контент -->
          <span 
            v-if="line.type === 'output' || line.type === 'error' || line.type === 'warn'"
            v-html="formatAnsi(line.text)"
            :class="['break-all', lineLevel(line.text)]"
          />
          <span v-else-if="line.type === 'status'" class="text-yellow-400 break-all">
            {{ line.text }}
          </span>
          <span v-else-if="line.type === 'ktpanel'" class="text-gray-400 break-all">
            {{ line.text }}
          </span>
          <span v-else :class="getLineClass(line)" class="break-all">
            {{ line.type === 'system' ? line.text : formatLine(line) }}
          </span>
        </div>
        <div v-if="connectionStatus === 'connected' && autoScroll" class="text-gray-400 animate-pulse">_</div>
      </div>
      <button
        v-if="showJump"
        @click="jumpToBottom"
        :title="$t('console.jumpDown')"
        class="absolute bottom-3 right-3 w-9 h-9 rounded-full bg-emerald-300 hover:bg-emerald-200 text-black shadow-lg shadow-black/50 flex items-center justify-center transition-all"
      >
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      </div>
    </div>
    
    <!-- Ввод команды -->
    <form @submit.prevent="sendCommand" class="flex gap-2">
      <div class="flex-1 relative">
        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-300 font-mono text-sm font-bold">></span>
        <input 
          v-model="command"
          type="text"
          :placeholder="$t('console.inputPh')"
          :disabled="connectionStatus !== 'connected'"
          @keydown="historyKeydown"
          class="w-full bg-black/40 border border-white/10 rounded-xl pl-8 pr-4 py-2 sm:py-2.5 text-white font-mono text-sm placeholder-white/25 focus:outline-none focus:border-emerald-300/50 disabled:opacity-50"
        />
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
// @ts-nocheck
import AnsiToHtml from 'ansi-to-html'

const props = defineProps<{
  serverId: number
  serverStatus?: string
}>()

const emit = defineEmits<{
  (e: 'statusChange', status: string): void
  (e: 'statsUpdate', stats: { cpu: number; memory: number; disk: number }): void
}>()

const { t } = useI18n()

const ansi = new AnsiToHtml({
  fg: '#D3D7CF',
  bg: '#0a0a0a',
  colors: {
    0: '#000000', 1: '#CC0000', 2: '#4E9A06', 3: '#C4A000',
    4: '#3465A4', 5: '#75507B', 6: '#06989A', 7: '#D3D7CF',
    8: '#555753', 9: '#EF2929', 10: '#8AE234', 11: '#FCE94F',
    12: '#729FCF', 13: '#AD7FA8', 14: '#34E2E2', 15: '#EEEEEC'
  },
  stream: true,
  escapeXML: true
})

interface ConsoleLine {
  text: string
  type: 'system' | 'command' | 'output' | 'error' | 'warn' | 'status' | 'ktpanel'
  timestamp: Date
}

const filterSystemMessages = (line: string): { text: string; isKTPanel: boolean } => {
  let filtered = line
  let isKTPanel = false
  
  if (filtered.includes('[Cardinal Daemon]') || filtered.includes('[Pterodactyl Daemon]')) {
    filtered = filtered.replace(/\[Cardinal Daemon\]/g, '[Cardinal Panel]').replace(/\[Pterodactyl Daemon\]/g, '[Cardinal Panel]')
    isKTPanel = true
  }
  
  filtered = filtered
    .replace(/container@pterodactyl/g, 'container@cardinal')
    .replace(/container@kttech/g, 'container@cardinal')
    .replace(/Pulling Docker container image/g, t('console.logPull'))
    .replace(/Finished pulling Docker container image/g, t('console.logPullDone'))
    .replace(/Updating process configuration files/g, t('console.logCfg'))
    .replace(/Ensuring file permissions are correct/g, t('console.logPerms'))
    .replace(/Detected server process in a crashed state!/g, t('console.logCrashed'))
    .replace(/Exit code:/g, t('console.logExit'))
    .replace(/Out of memory:/g, t('console.logOom'))
    .replace(/Aborting automatic restart/g, t('console.logAbort'))
    .replace(/last crash occurred less than 60 seconds ago/g, t('console.logLastCrash'))
  
  if (filtered.includes('[Cardinal Panel]')) {
    isKTPanel = true
  }
  
  return { text: filtered, isKTPanel }
}

const consoleLines = ref<ConsoleLine[]>([])
const command = ref('')
// История команд: стрелки ↑/↓ в поле ввода, переживает перезагрузку
// (localStorage на сервер, последние 100).
const cmdHistory = ref<string[]>([])
const histIdx = ref(-1)
const histDraft = ref('')

const historyKey = () => `kt-console-history:${props.serverId}`

const loadHistory = () => {
  try {
    const raw = localStorage.getItem(historyKey())
    const arr = raw ? JSON.parse(raw) : []
    cmdHistory.value = Array.isArray(arr) ? arr.filter((c) => typeof c === 'string').slice(-100) : []
  } catch {
    cmdHistory.value = []
  }
  histIdx.value = -1
  histDraft.value = ''
}

const pushHistory = (cmd: string) => {
  const h = cmdHistory.value
  if (h[h.length - 1] !== cmd) h.push(cmd)
  cmdHistory.value = h.slice(-100)
  try {
    localStorage.setItem(historyKey(), JSON.stringify(cmdHistory.value))
  } catch {}
  histIdx.value = -1
  histDraft.value = ''
}

const historyKeydown = (e: KeyboardEvent) => {
  const h = cmdHistory.value
  if (!h.length) return
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (histIdx.value === -1) histDraft.value = command.value
    histIdx.value = histIdx.value === -1 ? h.length - 1 : Math.max(0, histIdx.value - 1)
    command.value = h[histIdx.value]
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (histIdx.value === -1) return
    histIdx.value = histIdx.value + 1
    command.value = histIdx.value >= h.length ? histDraft.value : h[histIdx.value]
    if (histIdx.value >= h.length) histIdx.value = -1
  }
}

// Реплей-дедуп: каждый (пере)коннект cardinal шлёт хвост лога заново
// (до 64 КБ — сотни строк), и он ложится поверх уже показанных строк.
// На 'auth success' запоминаем всю видимую ленту; входящие в течение
// 10с, совпадающие точь-в-точь, гасим (по одному совпадению — genuine
// повторы той же строки чуть позже рисуются как обычно).
let replayGuardUntil = 0
const replaySeen = new Set<string>()

// Нормализация для сравнения: эхо команд в логе лежит с префиксом "> ",
// а локально/в буфере — без него. Сравниваем без префикса, показываем как было.
const normReplayText = (line: string): string =>
  String(line || '').trim().replace(/^[>›»#$]+\s?/, '').trim()

const armReplayGuard = () => {
  replaySeen.clear()
  for (const l of consoleLines.value.slice(-1000)) {
    const t = normReplayText(l.text)
    if (t) replaySeen.add(t)
  }
  replayGuardUntil = Date.now() + 10000
}

const consumeReplay = (line: string): boolean => {
  const t = normReplayText(line)
  if (!t || Date.now() > replayGuardUntil) return false
  if (!replaySeen.has(t)) return false
  replaySeen.delete(t)
  return true
}

// Своё эхо из wings: сессия транслирует ввод всем смотрителям (как PTY),
// поэтому отправленная команда приедет обратно строкой console output.
// Мгновенное локальное эхо уже отрисовано — такое входящее гасим один раз,
// иначе каждая команда двоится. Чужие команды и совпавший вывод сервера
// (вне окна 15с) рисуются как обычно.
const pendingEcho = ref<{ text: string; ts: number }[]>([])

const trackEcho = (cmd: string) => {
  const now = Date.now()
  pendingEcho.value = [...pendingEcho.value.filter((p) => now - p.ts < 15000), { text: cmd, ts: now }].slice(-20)
}

const consumeEcho = (line: string): boolean => {
  const text = String(line || '').trim()
  if (!text) return false
  const now = Date.now()
  const idx = pendingEcho.value.findIndex((p) => p.text === text && now - p.ts < 15000)
  if (idx === -1) return false
  pendingEcho.value.splice(idx, 1)
  return true
}
const connectionStatus = ref<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected')
const autoScroll = ref(true)
const ws = ref<WebSocket | null>(null)
const consoleContainer = ref<HTMLElement>()
const reconnectAttempts = ref(0)
const maxReconnectAttempts = 5

// waitingForServer — сервер выключен: сокет не дёргаем, ждём запуска.
// Иначе каждое подключение упирается в attach к остановленному контейнеру,
// wings закрывает сокет с daemon error — и так по кругу все ретраи.
const waitingForServer = ref(false)
const waitingAnnounced = ref(false)

// connectMark — сколько строк было до текущей попытки подключения. Если попытка
// сразу упёрлась в выключенный сервер, служебный шум хендшейка сворачивается,
// чтобы вместо пяти технических строк осталась одна понятная.
let connectMark = -1

// connectSeq — поколение подключения. Вотчер статуса может позвать reconnect()
// пока ещё летит fetch токена первого connect(): без счётчика открываются ДВА
// сокета, и второй получает реплей всего лога — дубли. Проигравшее поколение
// молча отменяется, а если успело открыть сокет — тут же его закрывает.
let connectSeq = 0

const currentStats = reactive({
  cpu: 0,
  memory: 0,
  disk: 0
})

const formatTime = (date: Date) => {
  return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

const formatAnsi = (text: string): string => {
  try {
    return highlightConsoleLine(renderMinecraftColors(ansi.toHtml(text)), text)
  } catch {
    return escapeHtml(text)
  }
}

const escapeHtml = (text: string): string =>
  String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

// Смысловая подсветка поверх ANSI/§-цветов: префикс [12:00:01 INFO]:
// время тусклым, уровень своим цветом; значения TPS — как в игре
// (≥18 зелёный, ≥15 жёлтый, ниже красный), даже если сервер прислал
// их plain-текстом без единого кода.
const highlightConsoleLine = (html: string, raw: string): string => {
  html = html.replace(/^(\[)(\d{2}:\d{2}:\d{2})\s+([A-Za-z]+)(\]:)/, (m, br, time, level, end) => {
    const lv = String(level).toUpperCase()
    const color = lv === 'INFO' ? '#8b98ac'
      : lv === 'WARN' ? '#facc15'
      : (lv === 'ERROR' || lv === 'SEVERE' || lv === 'FATAL') ? '#f87171'
      : '#9fb3c8'
    return `${br}<span style="color:#5b6472">${time}</span> <span style="color:${color}">${level}</span>${end}`
  })
  if (raw.includes('TPS from last')) {
    html = html.replace(/(\d+\.\d+)/g, (num) => {
      const v = parseFloat(num)
      const color = v >= 18 ? '#55FF55' : v >= 15 ? '#FFFF55' : '#FF5555'
      return `<span style="color:${color}">${num}</span>`
    })
  }
  return html
}

// Цвета Minecraft (§-коды) как в Pterodactyl: серверные логи (TPS,
// сообщения плагинов) идут с §a…§f, ANSI-конвертер их не трогает.
// Применяется ПОСЛЕ ansi.toHtml: текст уже заэскейплен, § не тронут.
const MC_COLORS: Record<string, string> = {
  '0': '#000000', '1': '#0000AA', '2': '#00AA00', '3': '#00AAAA',
  '4': '#AA0000', '5': '#AA00AA', '6': '#FFAA00', '7': '#AAAAAA',
  '8': '#555555', '9': '#5555FF', 'a': '#55FF55', 'b': '#55FFFF',
  'c': '#FF5555', 'd': '#FF55FF', 'e': '#FFFF55', 'f': '#FFFFFF',
}

const renderMinecraftColors = (html: string): string => {
  let out = ''
  let open = 0
  const closeAll = () => {
    if (open > 0) { out += '</span>'.repeat(open); open = 0 }
  }
  for (let i = 0; i < html.length; i++) {
    if (html[i] === '§' && i + 1 < html.length) {
      const code = html[i + 1].toLowerCase()
      const color = MC_COLORS[code]
      if (color) {
        closeAll()
        out += `<span style="color:${color}">`
        open = 1
        i++
        continue
      }
      if (code === 'l') { out += '<span style="font-weight:bold">'; open++; i++; continue }
      if (code === 'o') { out += '<span style="font-style:italic">'; open++; i++; continue }
      if (code === 'n') { out += '<span style="text-decoration:underline">'; open++; i++; continue }
      if (code === 'm') { out += '<span style="text-decoration:line-through">'; open++; i++; continue }
      if (code === 'r') { closeAll(); i++; continue }
      if (code === 'k') { i++; continue }
    }
    out += html[i]
  }
  closeAll()
  return out
}

// Уровень строки для подсветки: ошибки — красным целиком, варнинги — жёлтым.
const lineLevel = (text: string): string => {
  if (!text) return ''
  if (/\[(?:[^\]]*\/)?(?:ERROR|SEVERE|FATAL|CRITICAL|EXCEPTION)\]|(?:^|\s)(?:ERROR|Error|Traceback|Caused by|Exception in|SEVERE|FATAL|Unknown command)(?:\s|:|$)/.test(text)) return 'mc-error'
  if (/\[(?:[^\]]*\/)?WARN(?:ING)?\]|(?:^|\s)(?:WARN|Warning|WARNING)(?:\s|:|$)/.test(text)) return 'mc-warn'
  return ''
}

const getLineClass = (line: ConsoleLine) => {
  switch (line.type) {
    case 'command': return 'text-white/90'
    case 'system': return 'text-gray-500'
    case 'status': return 'text-yellow-400'
    case 'ktpanel': return 'text-gray-400'
    default: return ''
  }
}

const formatLine = (line: ConsoleLine) => {
  if (line.type === 'system') return line.text
  if (line.type === 'command') return ` ${line.text}`
  return line.text
}

const addLine = (text: string, type: ConsoleLine['type'] = 'output') => {
  const lines = text.split('\n')
  for (const line of lines) {
    if (!line.trim()) continue
    // Соседний дубль: одно и то же эхо может прийти дважды разными путями
    // (мгновенное локальное + эфир сессии + "> "-строка из реплея лога).
    // Если ближайшая содержательная строка — та же команда/текст и ей
    // меньше минуты, повтор не рисуем. Легитимные повторы выживают:
    // между ними всегда встревает ответ/вывод с другим текстом.
    if ((type === 'command' || type === 'output') && isAdjacentDuplicate(line)) continue
    consoleLines.value.push({ text: line, type, timestamp: new Date() })
  }

  if (consoleLines.value.length > 1000) {
    consoleLines.value = consoleLines.value.slice(-500)
  }
  if (autoScroll.value) {
    scrollToBottom()
  }
}

// isAdjacentDuplicate — та же нормализованная строка уже стоит последней
// (мимо системных пометок) и ей меньше минуты.
const isAdjacentDuplicate = (line: string): boolean => {
  const nt = normReplayText(line)
  if (!nt) return false
  const now = Date.now()
  for (let i = consoleLines.value.length - 1; i >= 0; i--) {
    const l = consoleLines.value[i]
    if (l.type === 'system' || l.type === 'status' || l.type === 'ktpanel') continue
    if (normReplayText(l.text) !== nt) return false
    const ts = l.timestamp instanceof Date ? l.timestamp.getTime() : Number(l.timestamp) || now
    return now - ts < 60000
  }
  return false
}

const statusMessages = computed<Record<string, string>>(() => ({
  offline: t('console.statusOffline'),
  starting: t('console.statusStarting'),
  running: t('console.statusRunning'),
  stopping: t('console.statusStopping'),
  error: t('console.statusError'),
}))

// Последний объявленный статус. Сокет шлёт heartbeat `status` каждые ~5с,
// а при переподключении переприходят недавние строки лога — без дедупа
// каждый повтор рисовал бы строку в консоли. Объявляем только ПЕРЕХОДЫ:
// выключен → запуск → работает (один раз), дальше тишина.
const lastStatus = ref('')

const announceStatus = (status: string, message: string, lineType: ConsoleLine['type'] = 'status') => {
  if (!status || status === lastStatus.value) return
  lastStatus.value = status
  addLine(message, lineType)
  emit('statusChange', status)
}

// Ошибка консоли, означающая «контейнер не запущен»: attach делать не к чему.
// Такие фреймы — не повод для ретраев, а сигнал перейти в ожидание запуска.
// Текст, однозначно означающий «контейнер остановлен» — attach делать не к
// чему. Такую ошибку можно считать достоверной даже без известного статуса:
// wings присылает status только на живом аттаче, а на мёртвом — лишь это.
const isDefinitelyStopped = (text: string) => {
  return /not running|is stopped|is not started/i.test(text || '')
}

const isOfflineConsoleError = (text: string) => {
  return isDefinitelyStopped(text) || /console unavailable|attach|container data unavailable/i.test(text || '')
}

const enterWaitingMode = () => {
  reconnectAttempts.value = 0
  waitingForServer.value = true
  connectionStatus.value = 'disconnected'
  // В офлайн ушли сразу после (пере)подключения — сворачиваем служебный шум
  // хендшейка («подключение… установлено… авторизация… выключен…») в одну строку.
  // Сворачиваем, только если после метки нет ничего, кроме шума: живой вывод
  // игры не трогаем никогда.
  if (connectMark >= 0) {
    const tail = consoleLines.value.slice(connectMark)
    if (tail.length > 0 && tail.every(isHandshakeNoiseLine)) {
      consoleLines.value = consoleLines.value.slice(0, connectMark)
    }
    connectMark = -1
  }
  if (!waitingAnnounced.value) {
    waitingAnnounced.value = true
    addLine(t('console.waitingOffline'), 'system')
  }
}

const isHandshakeNoiseLine = (line: ConsoleLine) => {
  if (line.type === 'system') {
    return /^(Подключение к (серверу|консоли)|Подключено к серверу|Соединение установлено|Аутентификация успешна|Авторизация прошла|Попытка переподключения|Переподключение|Connecting to console|Connection established|Authorization succeeded|Reconnecting)/.test(line.text)
  }
  if (line.type === 'status') {
    return /выключен|offline/i.test(line.text)
  }
  return isOfflineConsoleError(line.text)
}

// Перевод технических ошибок демона на человеческий: сырой английский текст
// с ID контейнеров пользователю ни о чём не говорит.
const friendlyDaemonError = (text: string) => {
  if (/not running|is stopped|is not started/i.test(text)) return t('console.daemonStopped')
  if (/console unavailable/i.test(text)) return t('console.daemonUnavailable')
  if (/attach/i.test(text)) return t('console.daemonAttach')
  if (/token|jwt|auth/i.test(text)) return t('console.sessionExpired')
  return text
}

const handleScroll = () => {
  if (!consoleContainer.value) return
  const { scrollTop, scrollHeight, clientHeight } = consoleContainer.value
  autoScroll.value = scrollHeight - scrollTop - clientHeight < 50
}

// Кнопка «вниз»: видна, когда читаешь историю выше (автоскролл выключен).
const showJump = computed(() => !autoScroll.value && consoleLines.value.length > 0)

const jumpToBottom = () => {
  autoScroll.value = true
  scrollToBottom()
}

const connect = async () => {
  const mySeq = ++connectSeq
  if (props.serverStatus === 'installing') {
    addLine(t('console.serverInstalling'), 'system')
    connectionStatus.value = 'error'
    return
  }

  // Сервер выключен — attach не к чему, сокет сразу закроется с daemon error.
  // Ретраи не жгём: уходим в ожидание, вотчер статуса сам подключит при запуске.
  if (props.serverStatus === 'offline') {
    enterWaitingMode()
    return
  }
  waitingAnnounced.value = false
  connectMark = consoleLines.value.length

  let wsUrl = ''
  let token = ''
  try {
    const auth = await $fetch(`/api/servers/${props.serverId}/ws-token`, { method: 'POST' })
    if (mySeq !== connectSeq) return
    wsUrl = auth.url
    token = auth.token
  } catch (e: any) {
    if (mySeq !== connectSeq) return
    addLine(t('console.openFail', { error: e?.data?.message || e?.message || e }), 'error')
    connectionStatus.value = 'error'
    return
  }

  connectionStatus.value = 'connecting'
  addLine(t('console.connectingTo'), 'system')

  try {
    ws.value = new WebSocket(wsUrl)
  } catch (e) {
    addLine(t('console.wsCreateFail', { error: String(e) }), 'error')
    connectionStatus.value = 'error'
    return
  }
  
  ws.value.onopen = () => {
    // Пока летел хендшейк, стартовало новое поколение — этот сокет лишний:
    // закрываем сразу, пока он не начал дублировать лог.
    if (mySeq !== connectSeq) {
      try { ws.value?.close(1000) } catch {}
      return
    }
    connectionStatus.value = 'connected'
    reconnectAttempts.value = 0
    addLine(t('console.connectedOk'), 'system')
    
    const authMsg = JSON.stringify({
      event: 'auth',
      args: [token]
    })
    ws.value?.send(authMsg)
  }
  
  ws.value.onmessage = (event) => {
    // Проигравшее поколение: его строки — дубли живого сокета, отбрасываем.
    if (mySeq !== connectSeq) return
    try {
      const data = JSON.parse(event.data)
      
      switch (data.event) {
        case 'auth success':
          addLine(t('console.authOk'), 'system')
          armReplayGuard()
          // Реплей хвоста прилетает пачкой сразу после — дожимаем вью
          // в самый низ, когда он осядет.
          setTimeout(scrollToBottom, 800)
          break
          
        case 'console output':
          data.args?.forEach((rawLine: string) => {
            const { text: line, isKTPanel } = filterSystemMessages(rawLine)

            // Повтор хвоста лога после (пере)коннекта — уже показано, гасим.
            if (consumeReplay(line)) return

            // Своё эхо из сессии wings (см. trackEcho): локально уже

            // Своё эхо из сессии wings (см. trackEcho): локально уже
            // отрисовано мгновенно, повтор гасим. Сервер/консоль иногда
            // отдаёт эхо с префиксом "> " — нормализуем и тоже гасим своё,
            // а чужое (другой клиент) показываем как команду, а не белым текстом.
            if (consumeEcho(line)) return
            const echoPrefixed = line.match(/^\s*[>›»]\s?(\S.*)$/)
            if (echoPrefixed) {
              if (!consumeEcho(echoPrefixed[1])) addLine(echoPrefixed[1].trim(), 'command')
              return
            }

            // Технический шум про остановленный контейнер при выключенном
            // сервере — не вывод игры, прячем (режим ожидания уже всё объяснил).
            // «Точно остановлен» прячем даже без известного статуса.
            if (isDefinitelyStopped(line) || (isOfflineConsoleError(line) && (lastStatus.value === 'offline' || props.serverStatus === 'offline'))) return
            
            let lineType: ConsoleLine['type'] = 'output'
            
            if (isKTPanel) {
              lineType = 'ktpanel'
            } else if (line.includes('[ERROR]') || line.includes('Exception') || line.includes('Fatal') || line.includes('error')) {
              lineType = 'error'
            } else if (line.includes('[WARN]') || line.includes('WARNING') || line.includes('warn')) {
              lineType = 'warn'
            }
            
            addLine(line, lineType)
            
            // ==================== ОПРЕДЕЛЕНИЕ ВЕРСИИ И ЯДРА MINECRAFT ====================
            
            // Paper/Purpur
            const paperMatch = line.match(/Running (Paper|Purpur) version (.+?) for Minecraft ([\d.]+)/i)
            if (paperMatch) {
              addLine(t('console.corePaper', { core: paperMatch[1], version: paperMatch[2], mc: paperMatch[3] }), 'status')
            }
            
            // Standard Minecraft server
            const versionMatch = line.match(/Starting minecraft server version ([\d.]+)/i)
            if (versionMatch) {
              addLine(t('console.mcVersion', { version: versionMatch[1] }), 'status')
            }
            
            // Generic server brand
            const serverBrandMatch = line.match(/This server is running ([\w\s]+) version (.+?)(?:\s|$)/i)
            if (serverBrandMatch && !paperMatch) {
              addLine(t('console.coreGeneric', { core: serverBrandMatch[1], version: serverBrandMatch[2] }), 'status')
            }
            
            // Fabric
            const fabricMatch = line.match(/\[Fabric\] Loaded (\d+) mods/i)
            if (fabricMatch) {
              addLine(t('console.coreFabric', { count: fabricMatch[1] }), 'status')
            }
            
            // Forge
            const forgeMatch = line.match(/\[Forge\] MinecraftForge v([\d.]+) Initialized/i)
            if (forgeMatch) {
              addLine(t('console.coreForge', { version: forgeMatch[1] }), 'status')
            }
            
            // CraftBukkit/Spigot
            const bukkitMatch = line.match(/This server is running (CraftBukkit|Spigot) version (.+?)\s/i)
            if (bukkitMatch) {
              addLine(t('console.coreBukkit', { core: bukkitMatch[1], version: bukkitMatch[2] }), 'status')
            }
            
            // MC version from Bukkit-like servers
            const mcVersionMatch = line.match(/MC: ([\d.]+)/i)
            if (mcVersionMatch) {
              addLine(t('console.mcShort', { version: mcVersionMatch[1] }), 'status')
            }
            
            // ==================== СТАТУСЫ СЕРВЕРА ====================
            
            const doneMatch = line.match(/Done\s*\((\d+\.?\d*)s\)!/i)
            if (doneMatch) {
              announceStatus('running', t('console.readyIn', { sec: doneMatch[1] }))
            }

            const startedMatch = line.match(/Server started in (\d+) ms/i)
            if (startedMatch) {
              announceStatus('running', t('console.startedMs', { ms: startedMatch[1] }))
            }

            if (line.includes('Server started successfully')) {
              announceStatus('running', t('console.startedOk'))
            }

            const fabricStartedMatch = line.match(/Started server in (\d+\.?\d*) seconds/i)
            if (fabricStartedMatch) {
              announceStatus('running', t('console.startedSec', { sec: fabricStartedMatch[1] }))
            }

            if (line.includes('Stopping the server') ||
                line.includes('Stopping server') ||
                line.includes('Server stopped') ||
                line.includes('Closing Server') ||
                line.includes('Shutting down')) {
              announceStatus('stopping', t('console.stopping'))
            }

            if (line.includes('crash') ||
                line.includes('Crash Report') ||
                line.includes('OutOfMemoryError') ||
                line.includes('Fatal error')) {
              announceStatus('error', t('console.crashed'), 'error')
            }
          })
          break
          
        case 'status':
          announceStatus(data.args?.[0] || 'offline', statusMessages.value[data.args?.[0]] || t('console.statusUnknown', { status: data.args?.[0] }))
          break
          
        case 'stats':
          if (data.args) {
            const statsData = typeof data.args === 'string' ? JSON.parse(data.args) : data.args
            
            currentStats.cpu = statsData.cpu || 0
            currentStats.memory = statsData.memory || 0
            currentStats.disk = statsData.disk || 0
            
            emit('statsUpdate', {
              cpu: currentStats.cpu,
              memory: currentStats.memory,
              disk: currentStats.disk
            })
          }
          break
          
        case 'error':
        case 'daemon error': {
          const text = data.args?.join(' ') || t('console.unknownError')
          // «Точно остановлен» верим даже без известного статуса: на свежей
          // загрузке при выключенном сервере wings не присылает status вообще
          // (только эту ошибку), и иначе был бы шторм ретраев.
          if (isDefinitelyStopped(text) || (isOfflineConsoleError(text) && (lastStatus.value === 'offline' || props.serverStatus === 'offline'))) {
            enterWaitingMode()
          } else {
            addLine(t('console.daemonError', { error: friendlyDaemonError(text) }), 'error')
          }
          break
        }
          
        case 'jwt error':
          addLine(t('console.jwtError', { error: data.args?.join(' ') || t('console.authError') }), 'error')
          connectionStatus.value = 'error'
          break
          
        default:
          break
      }
      
    } catch (e) {
      if (event.data) {
        const { text: line, isKTPanel } = filterSystemMessages(event.data)
        addLine(line, isKTPanel ? 'ktpanel' : 'output')
      }
    }
  }
  
  const mySock = ws.value
  ws.value.onclose = (event) => {
    // Протухший сокет (после ручного переподключения уже есть новый) —
    // чужое закрытие нас не касается.
    if (ws.value && ws.value !== mySock) return
    ws.value = null

    // Режим ожидания: сервер выключен, закрытие штатное — молчим.
    if (waitingForServer.value) return

    // Сервер выключен (подтверждено heartbeat-статусом): ретраи бессмысленны,
    // attach к остановленному контейнеру всё равно не встанет.
    if (lastStatus.value === 'offline' && event.code !== 1000) {
      enterWaitingMode()
      return
    }

    if (connectionStatus.value === 'connected') {
      connectionStatus.value = 'disconnected'
      addLine(event.code === 1000 ? t('console.closedNormal') : t('console.closedLost'), 'system')
    }

    if (reconnectAttempts.value < maxReconnectAttempts && event.code !== 1000) {
      reconnectAttempts.value++
      addLine(t('console.reconnecting', { cur: reconnectAttempts.value, max: maxReconnectAttempts }), 'system')
      setTimeout(connect, 2000)
    }
  }
  
  ws.value.onerror = (error) => {
    console.error('WebSocket error:', error)
    if (waitingForServer.value) return
    if (connectionStatus.value === 'connecting') {
      addLine(t('console.connectFail'), 'error')
    }
    connectionStatus.value = 'error'
  }
}

const disconnect = () => {
  reconnectAttempts.value = maxReconnectAttempts
  waitingForServer.value = false
  connectSeq++
  if (ws.value) {
    ws.value.close(1000, t('console.userLeft'))
    ws.value = null
  }
  connectionStatus.value = 'disconnected'
}

const reconnect = () => {
  disconnect()
  reconnectAttempts.value = 0
  setTimeout(connect, 100)
}

const sendCommand = () => {
  if (!command.value.trim() || !ws.value || connectionStatus.value !== 'connected') return
  
  const msg = JSON.stringify({
    event: 'send command',
    args: [command.value.trim()]
  })
  
  ws.value.send(msg)
  pushHistory(command.value.trim())
  trackEcho(command.value.trim())
  addLine(command.value, 'command')
  command.value = ''
}

const scrollToBottom = () => {
  nextTick(() => {
    setTimeout(() => {
      const el = consoleContainer.value
      if (el) el.scrollTop = el.scrollHeight + 1000
    }, 10)
  })
}

onMounted(() => {
  loadHistory()
  // Консоль стартует пустой: историю даёт живой реплей хвоста лога,
  // дубли давит гард ниже. Никаких сохранённых лент не подкладываем.
  try {
    localStorage.removeItem(`kt-console-buf:${props.serverId}`)
    localStorage.removeItem(`kt-console-echo:${props.serverId}`)
  } catch {}
  if (props.serverStatus !== 'installing') {
    connect()
  }
  // Страховка: при входе всегда оказываемся на последних сообщениях,
  // даже если первая пачка строк отрисовалась раньше раскладки.
  setTimeout(scrollToBottom, 400)
})

onUnmounted(() => {
  disconnect()
})

watch(() => props.serverStatus, (newStatus) => {
  if (newStatus === 'installing') {
    disconnect()
    addLine(t('console.movedToInstall'), 'system')
  } else if (newStatus === 'running' && (connectionStatus.value === 'disconnected' || waitingForServer.value)) {
    // Только подтверждённый running: optimistic starting/restarting означают,
    // что контейнер может ещё не существовать — attach упадёт вхолостую.
    // Опрос страницы сам доведёт статус до running, и консоль подключится.
    waitingForServer.value = false
    waitingAnnounced.value = false
    reconnect()
  }
})
</script>

<style scoped>
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
.animate-pulse {
  animation: pulse 1.5s ease-in-out infinite;
}
/* Уровни логов: ошибки красным целиком (перебивают §-цвета внутри),
   варнинги — жёлтым. */
.mc-error,
.mc-error span {
  color: #f87171 !important;
}
.mc-warn,
.mc-warn span {
  color: #facc15 !important;
}
</style>

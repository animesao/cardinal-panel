<template>
  <div class="space-y-6">
    <!-- Заголовок -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <div class="flex items-center gap-2">
          <h2 class="text-xl sm:text-2xl font-bold text-white/95">{{ server?.name || $t('common.loading') }}</h2>
          <button v-if="isPrivileged" @click="openSettings" class="text-white/30 hover:text-emerald-300 p-1 transition-colors flex-shrink-0" :title="$t('server.settings.edit')">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
            </svg>
          </button>
        </div>
        <p class="text-white/40 text-xs sm:text-sm mt-1">{{ server?.node?.name }} • {{ liveStatus || statusText }}</p>
        <p v-if="server?.description" class="text-white/50 text-xs sm:text-sm mt-0.5 max-w-xl truncate">{{ server.description }}</p>
      </div>
      <div class="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        <span :class="statusBadgeClass" class="px-2 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-medium border">
          {{ liveStatus ? statusDisplay(liveStatus) : statusText }}
        </span>
        <span v-if="server?.suspended" class="px-2 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-medium border bg-red-500/20 text-red-400 border-red-500/30">
          {{ $t('server.suspended') }}
        </span>
        <div class="flex gap-1.5 sm:gap-2">
          <button 
            @click="powerAction('start')" 
            :disabled="powerLoading || startStateOff || server?.suspended || !hasPerm('control.start')"
            :class="[
              'bg-green-500/20 text-green-400 border border-green-500/30 px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm transition-all flex items-center gap-1 disabled:cursor-not-allowed',
              startStateOff ? stateOffCls : 'hover:bg-green-500/30 disabled:opacity-40'
            ]"
          >
            <svg class="w-3.5 h-3.5 sm:w-4 sm:h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <rect width="24" height="24" fill="none"/>
              <path fill="currentColor" d="M6 4v16a1 1 0 0 0 1.524.852l13-8a1 1 0 0 0 0-1.704l-13-8A1 1 0 0 0 6 4"/>
            </svg>
            <span class="hidden sm:inline">{{ $t('server.start') }}</span>
          </button>
          <button 
            @click="powerAction('restart')" 
            :disabled="powerLoading || restartStateOff || server?.suspended || !hasPerm('control.restart')"
            :class="[
              'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm transition-all flex items-center gap-1 disabled:cursor-not-allowed',
              restartStateOff ? stateOffCls : 'hover:bg-yellow-500/30 disabled:opacity-40'
            ]"
          >
            <svg class="w-3.5 h-3.5 sm:w-4 sm:h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <rect width="24" height="24" fill="none"/>
              <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
                <path d="M19.933 13.041a8 8 0 1 1-9.925-8.788c3.899-1 7.935 1.007 9.425 4.747"/>
                <path d="M20 4v5h-5"/>
              </g>
            </svg>
            <span class="hidden sm:inline">{{ $t('server.restart') }}</span>
          </button>
          <button 
            @click="powerAction('stop')" 
            :disabled="powerLoading || stopStateOff || server?.suspended || !hasPerm('control.stop')"
            :class="[
              'bg-red-500/20 text-red-400 border border-red-500/30 px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm transition-all flex items-center gap-1 disabled:cursor-not-allowed',
              stopStateOff ? stateOffCls : 'hover:bg-red-500/30 disabled:opacity-40'
            ]"
          >
            <svg class="w-3.5 h-3.5 sm:w-4 sm:h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <rect width="24" height="24" fill="none"/>
              <path fill="currentColor" d="M17 4H7a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3"/>
            </svg>
            <span class="hidden sm:inline">{{ $t('server.stop') }}</span>
          </button>
          <button
            @click="toggleAutostart"
            :disabled="autostartLoading || !isPrivileged"
            :title="$t('server.autostartHint')"
            :class="[
              'border px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm transition-all flex items-center gap-1',
              server?.autoStart
                ? 'bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/30'
                : 'bg-white/5 text-white/40 border-white/10 hover:bg-white/10'
            ]"
          >
            <svg class="w-3.5 h-3.5 sm:w-4 sm:h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <rect width="24" height="24" fill="none"/>
              <path fill="currentColor" d="M13 2L3 14h7l-1 8l10-12h-7l1-8z"/>
            </svg>
            <span class="hidden sm:inline">{{ $t('server.auto') }}{{ server?.autoStart ? ' • ' + $t('server.on') : '' }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Ресурсы (CPU/RAM/Disk) + Адрес -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
      <!-- CPU -->
      <div class="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-2 sm:p-3 flex flex-col items-center">
        <div class="flex items-center gap-1.5 sm:gap-2 mb-2">
          <svg class="w-4 h-4 sm:w-[18px] sm:h-[18px]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
            <rect width="24" height="24" fill="none"/>
            <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
              <path d="M5 6a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z"/>
              <path d="M9 9h6v6H9zm-6 1h2m-2 4h2m5-11v2m4-2v2m7 5h-2m2 4h-2m-5 7v-2m-4 2v-2"/>
            </g>
          </svg>
          <p class="text-white/40 text-xs sm:text-sm">CPU</p>
        </div>
        
        <div 
          class="circular-progress"
          :style="{ 
            '--percent': cpuPercent, 
            '--color': getProgressColor(cpuPercent),
            background: `conic-gradient(${getProgressColor(cpuPercent)} 0% ${cpuPercent}%, rgba(48, 54, 61, 0.5) ${cpuPercent}% 100%)`
          }"
        >
          <div class="circular-inner">
            <span class="circular-value" :style="{ color: getProgressColor(cpuPercent) }">{{ Math.round(cpuPercent) }}%</span>
          </div>
        </div>
        <span class="text-white/40 text-[10px] sm:text-xs mt-2">/ {{ server?.cpu || 100 }}%</span>
      </div>
      
      <!-- Память -->
      <div class="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-2 sm:p-3 flex flex-col items-center">
        <div class="flex items-center gap-1.5 sm:gap-2 mb-2">
          <svg class="w-4 h-4 sm:w-[18px] sm:h-[18px]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
            <rect width="24" height="24" fill="none"/>
            <path fill="currentColor" d="M2 5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1v2a1 1 0 0 0 1 1h7.414l1-1h1.172l1 1H21a1 1 0 0 0 1-1v-2a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1zm18 11v1h-5.586l-1-1zm-9.414 0l-1 1H4v-1zM3 14V7h18v7zm2-5h2v3H5zm6 0H9v3h2zm2 0h2v3h-2zm6 0h-2v3h2z"/>
          </svg>
          <p class="text-white/40 text-xs sm:text-sm">{{ $t('server.memory') }}</p>
        </div>
        
        <div 
          class="circular-progress"
          :style="{ 
            '--percent': memoryPercent, 
            '--color': getProgressColor(memoryPercent),
            background: `conic-gradient(${getProgressColor(memoryPercent)} 0% ${memoryPercent}%, rgba(48, 54, 61, 0.5) ${memoryPercent}% 100%)`
          }"
        >
          <div class="circular-inner">
            <span class="circular-value" :style="{ color: getProgressColor(memoryPercent) }">{{ formatBytes(realUsage.memory) }}</span>
          </div>
        </div>
        <span class="text-white/40 text-[10px] sm:text-xs mt-2">/ {{ formatBytes((server?.memory || 1024) * 1024 * 1024) }}</span>
      </div>
      
      <!-- Диск -->
      <div class="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-2 sm:p-3 flex flex-col items-center">
        <div class="flex items-center gap-1.5 sm:gap-2 mb-2">
          <svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">
            <rect width="16" height="16" fill="none"/>
            <g fill="currentColor">
              <path d="M1.5 4.5A.5.5 0 0 1 2 4h13.5a.5.5 0 0 1 .5.5V7a.5.5 0 0 1-.5.5a.5.5 0 0 0 0 1a.5.5 0 0 1 .5.5v2.5a.5.5 0 0 1-.5.5H2a.5.5 0 0 1-.5-.5h-1A.5.5 0 0 1 0 11V7.5A.5.5 0 0 1 .5 7h1a.25.25 0 0 0 0-.5h-1A.5.5 0 0 1 0 6V5a.5.5 0 0 1 .5-.5zm1 .5a.5.5 0 0 1-.5.5h-.5a1.25 1.25 0 1 1 0 2.5H1v2.5h1a.5.5 0 0 1 .5.5H15V9.415a1.5 1.5 0 0 1 0-2.83V5z"/>
              <path d="M4 6.5a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1-.5-.5zM5 7v2h1V7zm3-.5a.5.5 0 0 1 .5-.5h4a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-.5.5h-4a.5.5 0 0 1-.5-.5zM9 7v2h3V7z"/>
            </g>
          </svg>
          <p class="text-white/40 text-xs sm:text-sm">{{ $t('server.disk') }}</p>
        </div>
        
        <div 
          class="circular-progress"
          :style="{ 
            '--percent': diskPercent, 
            '--color': getProgressColor(diskPercent),
            background: `conic-gradient(${getProgressColor(diskPercent)} 0% ${diskPercent}%, rgba(48, 54, 61, 0.5) ${diskPercent}% 100%)`
          }"
        >
          <div class="circular-inner">
            <span class="circular-value" :style="{ color: getProgressColor(diskPercent) }">{{ formatBytes(realUsage.disk) }}</span>
          </div>
        </div>
        <span class="text-white/40 text-[10px] sm:text-xs mt-2">/ {{ formatBytes((server?.disk || 10240) * 1024 * 1024) }}</span>
      </div>

      <!-- IP:Port -->
      <div class="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-3 sm:p-4 flex flex-col items-center">
        <div class="flex items-center gap-1.5 sm:gap-2 mb-2">
          <svg class="w-4 h-4 sm:w-[18px] sm:h-[18px]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
            <rect width="24" height="24" fill="none"/>
            <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
              <path d="M6 9a6 6 0 1 0 12 0A6 6 0 0 0 6 9"/>
              <path d="M12 3q2 .5 2 6c0 5.5-.667 5.667-2 6m0-12q-2 .5-2 6c0 5.5.667 5.667 2 6M6 9h12M3 20h7m4 0h7m-11 0a2 2 0 1 0 4 0a2 2 0 0 0-4 0m2-5v3"/>
            </g>
          </svg>
          <p class="text-white/40 text-xs sm:text-sm">{{ $t('server.address') }}</p>
        </div>
        <div class="flex flex-col items-center gap-1 mt-2">
          <code class="text-white font-mono text-xs sm:text-sm">{{ server?.address || ((server?.allocation?.ip || '—') + ':' + (server?.allocation?.port || '—')) }}</code>
          <button
            v-if="server?.address"
            @click="copyToClipboard(server.address)"
            class="text-emerald-300 hover:text-emerald-200 text-[10px] sm:text-xs"
          >
            {{ $t('server.copy') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Вкладки -->
    <div class="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden">
      <div class="border-b border-white/10 px-3 sm:px-5 overflow-x-auto">
        <div class="flex gap-2 sm:gap-4 flex-nowrap">
          <button 
            @click="activeTab = 'console'"
            :class="[
              'py-2.5 sm:py-3 text-xs sm:text-sm font-medium transition-all border-b-2 whitespace-nowrap',
              activeTab === 'console' ? 'text-emerald-300 border-emerald-300' : 'text-white/50 border-transparent hover:text-white/70'
            ]"
          >
            {{ $t('server.tabs.console') }}
          </button>
          <button 
            @click="activeTab = 'files'"
            :class="[
              'py-2.5 sm:py-3 text-xs sm:text-sm font-medium transition-all border-b-2 whitespace-nowrap',
              activeTab === 'files' ? 'text-emerald-300 border-emerald-300' : 'text-white/50 border-transparent hover:text-white/70'
            ]"
          >
            {{ $t('server.tabs.files') }}
          </button>
          <button 
            @click="activeTab = 'sftp'"
            :class="[
              'py-2.5 sm:py-3 text-xs sm:text-sm font-medium transition-all border-b-2 whitespace-nowrap',
              activeTab === 'sftp' ? 'text-emerald-300 border-emerald-300' : 'text-white/50 border-transparent hover:text-white/70'
            ]"
          >
            {{ $t('server.tabs.sftp') }}
          </button>
          <button 
            @click="activeTab = 'ports'"
            :class="[
              'py-2.5 sm:py-3 text-xs sm:text-sm font-medium transition-all border-b-2 whitespace-nowrap',
              activeTab === 'ports' ? 'text-emerald-300 border-emerald-300' : 'text-white/50 border-transparent hover:text-white/70'
            ]"
          >
            {{ $t('server.tabs.ports') }}
          </button>
          <button 
            @click="activeTab = 'backups'"
            :class="[
              'py-2.5 sm:py-3 text-xs sm:text-sm font-medium transition-all border-b-2 whitespace-nowrap',
              activeTab === 'backups' ? 'text-emerald-300 border-emerald-300' : 'text-white/50 border-transparent hover:text-white/70'
            ]"
          >
            {{ $t('server.tabs.backups') }}
          </button>
          <button 
            @click="activeTab = 'databases'"
            :class="[
              'py-2.5 sm:py-3 text-xs sm:text-sm font-medium transition-all border-b-2 whitespace-nowrap',
              activeTab === 'databases' ? 'text-emerald-300 border-emerald-300' : 'text-white/50 border-transparent hover:text-white/70'
            ]"
          >
            {{ $t('server.tabs.databases') }}
          </button>
          <button
            v-if="isPrivileged"
            @click="activeTab = 'schedules'"
            :class="[
              'py-2.5 sm:py-3 text-xs sm:text-sm font-medium transition-all border-b-2 whitespace-nowrap',
              activeTab === 'schedules' ? 'text-emerald-300 border-emerald-300' : 'text-white/50 border-transparent hover:text-white/70'
            ]"
          >
            {{ $t('server.tabs.schedules') }}
          </button>
          <button
            v-if="canViewUsers"
            @click="activeTab = 'users'"
            :class="[
              'py-2.5 sm:py-3 text-xs sm:text-sm font-medium transition-all border-b-2 whitespace-nowrap',
              activeTab === 'users' ? 'text-emerald-300 border-emerald-300' : 'text-white/50 border-transparent hover:text-white/70'
            ]"
          >
            {{ $t('server.tabs.users') }}
          </button>
          <button
            v-if="canViewActivity"
            @click="activeTab = 'activity'"
            :class="[
              'py-2.5 sm:py-3 text-xs sm:text-sm font-medium transition-all border-b-2 whitespace-nowrap',
              activeTab === 'activity' ? 'text-emerald-300 border-emerald-300' : 'text-white/50 border-transparent hover:text-white/70'
            ]"
          >
            {{ $t('server.tabs.activity') }}
          </button>
          <button 
            v-if="canEditStartup"
            @click="activeTab = 'reinstall'"
            :class="[
              'py-2.5 sm:py-3 text-xs sm:text-sm font-medium transition-all border-b-2 whitespace-nowrap',
              activeTab === 'reinstall' ? 'text-emerald-300 border-emerald-300' : 'text-white/50 border-transparent hover:text-white/70'
            ]"
          >
            {{ $t('server.tabs.reinstall') }}
          </button>
          <button 
            v-if="canViewStartup"
            @click="activeTab = 'startup'"
            :class="[
              'py-2.5 sm:py-3 text-xs sm:text-sm font-medium transition-all border-b-2 whitespace-nowrap',
              activeTab === 'startup' ? 'text-emerald-300 border-emerald-300' : 'text-white/50 border-transparent hover:text-white/70'
            ]"
          >
            {{ $t('server.tabs.startup') }}
          </button>
          <button 
            v-if="canEditStartup"
            @click="activeTab = 'setup'"
            :class="[
              'py-2.5 sm:py-3 text-xs sm:text-sm font-medium transition-all border-b-2 whitespace-nowrap',
              activeTab === 'setup' ? 'text-emerald-300 border-emerald-300' : 'text-white/50 border-transparent hover:text-white/70'
            ]"
          >
            {{ $t('server.tabs.setup') }}
          </button>
          <button 
            v-if="liveStatus === 'installing'"
            @click="activeTab = 'install'"
            :class="[
              'py-2.5 sm:py-3 text-xs sm:text-sm font-medium transition-all border-b-2 whitespace-nowrap',
              activeTab === 'install' ? 'text-emerald-300 border-emerald-300' : 'text-white/50 border-transparent hover:text-white/70'
            ]"
          >
            {{ $t('server.tabs.installLogs') }}
          </button>
        </div>
      </div>
      
      <!-- Модалка «нет прав» для субпользователей -->
      <NoAccessModal />

      <!-- Консоль -->
      <div v-if="activeTab === 'console'" class="p-3 sm:p-5">
        <ServerConsole 
          :server-id="serverId" 
          :server-status="liveStatus" 
          @status-change="handleStatusChange"
        />
      </div>
      
      <!-- Файлы -->
      <div v-if="activeTab === 'files'" class="p-3 sm:p-5">
        <ServerFiles :server-id="serverId" />
      </div>

      <!-- SFTP -->
      <div v-if="activeTab === 'sftp'" class="p-3 sm:p-5">
        <h3 class="text-lg font-medium text-white mb-4">{{ $t('server.sftp.title') }}</h3>
        <div class="grid gap-4 lg:grid-cols-5">
          <div class="lg:col-span-3">
            <div v-if="loadingSftp" class="text-center py-8">
              <div class="w-6 h-6 mx-auto border-2 border-emerald-300/30 border-t-emerald-300 rounded-full animate-spin"></div>
            </div>

            <div v-else-if="sftpData" class="space-y-4">
              <div class="bg-black/30 border border-white/10 rounded-xl p-3 sm:p-4 space-y-2 sm:space-y-3">
                <div class="flex justify-between items-center">
                  <span class="text-white/50 text-xs sm:text-sm">{{ $t('server.sftp.host') }}</span>
                  <div class="flex items-center gap-2">
                    <code class="text-white font-mono text-xs sm:text-sm">{{ sftpData.host }}</code>
                    <button @click="copyToClipboard(sftpData.host)" class="text-emerald-300 hover:text-emerald-200 text-[10px] sm:text-xs">{{ $t('server.sftp.copy') }}</button>
                  </div>
                </div>
                <div class="flex justify-between items-center">
                  <span class="text-white/50 text-xs sm:text-sm">{{ $t('server.sftp.port') }}</span>
                  <div class="flex items-center gap-2">
                    <code class="text-white font-mono text-xs sm:text-sm">{{ sftpData.port }}</code>
                    <button @click="copyToClipboard(sftpData.port)" class="text-emerald-300 hover:text-emerald-200 text-[10px] sm:text-xs">{{ $t('server.sftp.copy') }}</button>
                  </div>
                </div>
                <div class="flex justify-between items-center">
                  <span class="text-white/50 text-xs sm:text-sm">{{ $t('server.sftp.username') }}</span>
                  <div class="flex items-center gap-2">
                    <code class="text-white font-mono text-xs sm:text-sm">{{ sftpData.username }}</code>
                    <button @click="copyToClipboard(sftpData.username)" class="text-emerald-300 hover:text-emerald-200 text-[10px] sm:text-xs">{{ $t('server.sftp.copy') }}</button>
                  </div>
                </div>
                <div class="flex justify-between items-center">
                  <span class="text-white/50 text-xs sm:text-sm">{{ $t('server.sftp.password') }}</span>
                  <div class="flex items-center gap-2">
                    <code class="text-white font-mono text-xs sm:text-sm">{{ showPassword ? sftpData.password : '••••••••••••••••' }}</code>
                    <button @click="showPassword = !showPassword" class="text-emerald-300 hover:text-emerald-200 text-[10px] sm:text-xs">
                      {{ showPassword ? $t('server.sftp.hide') : $t('server.sftp.show') }}
                    </button>
                    <button @click="copyToClipboard(sftpData.password)" class="text-emerald-300 hover:text-emerald-200 text-[10px] sm:text-xs">{{ $t('server.sftp.copy') }}</button>
                  </div>
                </div>
              </div>

              <button
                @click="generateNewPassword"
                :disabled="generatingPassword"
                class="bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 border border-yellow-500/30 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all disabled:opacity-50"
              >
                {{ generatingPassword ? $t('server.sftp.generating') : $t('server.sftp.regen') }}
              </button>
            </div>

            <div v-else class="text-center py-8 text-white/50 text-sm">
              {{ $t('server.sftp.loadError') }}
            </div>
          </div>

          <div class="lg:col-span-2">
            <div class="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
              <h4 class="text-white/90 text-sm font-medium">{{ $t('server.sftp.howto') }}</h4>
              <div v-if="sftpData" class="flex items-center justify-between gap-2 bg-black/30 border border-white/10 rounded-lg px-3 py-2">
                <code class="text-white/80 font-mono text-xs break-all">sftp://{{ sftpData.username }}@{{ sftpData.host }}:{{ sftpData.port }}</code>
                <button @click="copyToClipboard(`sftp://${sftpData.username}@${sftpData.host}:${sftpData.port}`)" class="text-emerald-300 hover:text-emerald-200 text-[10px] sm:text-xs flex-shrink-0">{{ $t('server.sftp.copy') }}</button>
              </div>
              <ol class="text-white/50 text-xs sm:text-sm space-y-1.5 list-decimal list-inside">
                <li><span class="text-white/70 font-medium">FileZilla</span>: {{ $t('server.sftp.fz') }}</li>
                <li><span class="text-white/70 font-medium">WinSCP</span>: {{ $t('server.sftp.scp') }}</li>
                <li>{{ $t('server.sftp.offline') }}</li>
              </ol>
            </div>
          </div>
        </div>
      </div>

      <!-- Порты -->
      <div v-if="activeTab === 'ports'" class="p-3 sm:p-5">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-medium text-white">{{ $t('server.tabs.ports') }}</h3>
          <span class="text-white/40 text-xs sm:text-sm">{{ $t('server.ports.slots') }}: {{ portsData.slots.total > 0 ? `${portsData.slots.used}/${portsData.slots.total}` : `${portsData.slots.used} (${$t('server.ports.unlimited')})` }}</span>
        </div>
        <div class="grid gap-4 lg:grid-cols-5">
          <div class="lg:col-span-3">
            <div v-if="loadingPorts" class="text-center py-8">
              <div class="w-6 h-6 mx-auto border-2 border-emerald-300/30 border-t-emerald-300 rounded-full animate-spin"></div>
            </div>

            <div v-else class="space-y-4">
              <div class="bg-black/30 border border-white/10 rounded-xl p-3 sm:p-4 space-y-2 sm:space-y-3">
                <div v-if="portsData.primary" class="flex justify-between items-center">
                  <span class="text-[10px] sm:text-xs font-medium px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/30">{{ $t('server.ports.primary') }}</span>
                  <div class="flex items-center gap-2">
                    <code class="text-white font-mono text-xs sm:text-sm">{{ displayPortIp(portsData.primary.ip) }}:{{ portsData.primary.port }}</code>
                    <button @click="copyToClipboard(`${displayPortIp(portsData.primary.ip)}:${portsData.primary.port}`)" class="text-emerald-300 hover:text-emerald-200 text-[10px] sm:text-xs">{{ $t('server.sftp.copy') }}</button>
                  </div>
                </div>
                <div v-for="p in portsData.extras" :key="p.id" class="flex justify-between items-center">
                  <span class="text-[10px] sm:text-xs font-medium px-2 py-0.5 rounded-full bg-white/5 text-white/40 border border-white/10 font-mono">{{ p.protocol.toUpperCase() }}</span>
                  <div class="flex items-center gap-2">
                    <code class="text-white font-mono text-xs sm:text-sm">{{ displayPortIp(p.ip) }}:{{ p.port }}</code>
                    <button @click="copyToClipboard(`${displayPortIp(p.ip)}:${p.port}`)" class="text-emerald-300 hover:text-emerald-200 text-[10px] sm:text-xs">{{ $t('server.sftp.copy') }}</button>
                    <button @click="makePrimary(p.id)" :disabled="makingPrimary" class="text-green-400 hover:text-green-300 text-[10px] sm:text-xs disabled:opacity-50">{{ $t('server.ports.makePrimary') }}</button>
                    <button @click="releasePort(p.id)" class="text-red-400 hover:text-red-300 text-[10px] sm:text-xs">{{ $t('server.ports.release') }}</button>
                  </div>
                </div>
                <div v-if="!portsData.extras.length" class="text-white/30 text-xs sm:text-sm text-center py-2">
                  {{ $t('server.ports.noExtras') }}
                </div>
              </div>

              <div class="bg-white/5 border border-white/10 rounded-xl p-3 sm:p-4 space-y-3">
                <p class="text-white/60 text-xs sm:text-sm">{{ $t('server.ports.claim') }} <span class="text-white/30">({{ $t('server.ports.claimHint') }})</span></p>
                <div class="flex flex-col sm:flex-row gap-2">
                  <div class="w-full sm:w-32 flex-shrink-0">
                    <UiSelect
                      v-model="claimForm.protocol"
                      :options="[
                        { value: 'tcp', label: 'TCP' },
                        { value: 'udp', label: 'UDP' },
                      ]"
                    />
                  </div>
                  <button
                    @click="claimPort"
                    :disabled="claimingPort"
                    class="bg-emerald-300 hover:bg-emerald-200 text-black border border-transparent px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all disabled:opacity-50"
                  >
                    {{ claimingPort ? $t('server.ports.claiming') : $t('server.ports.take') }}
                  </button>
                </div>
              </div>

              <div v-if="portsMessage" :class="[
                'text-sm p-3 rounded-lg',
                portsMessageType === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'
              ]">
                {{ portsMessage }}
              </div>
            </div>
          </div>

          <div class="lg:col-span-2">
            <div class="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
              <h4 class="text-white/90 text-sm font-medium">{{ $t('server.ports.why') }}</h4>
              <ul class="text-white/50 text-xs sm:text-sm space-y-1.5 list-disc list-inside">
                <li><span class="text-white/70 font-medium">Dynmap</span> — {{ $t('server.ports.whyDynmap') }}</li>
                <li><span class="text-white/70 font-medium">Geyser/Bedrock</span> — {{ $t('server.ports.whyGeyser') }}</li>
                <li>{{ $t('server.ports.whyVoice') }}</li>
              </ul>
              <p class="text-white/30 text-xs border-t border-white/10 pt-3">
                {{ $t('server.ports.whySlots') }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Бэкапы -->
      <div v-if="activeTab === 'backups'" class="p-3 sm:p-5">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-medium text-white">{{ $t('server.tabs.backups') }}</h3>
          <span class="text-white/40 text-xs sm:text-sm">{{ backupLimitText }}</span>
            <button 
              @click="createBackup"
              :disabled="creatingBackup"
              class="bg-emerald-300 hover:bg-emerald-200 text-black border border-transparent px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all disabled:opacity-50"
            >
              <span v-if="creatingBackup" class="flex items-center gap-2">
                <span class="w-4 h-4 border-2 border-black/40 border-t-black rounded-full animate-spin"></span>
                {{ $t('server.backups.creating') }}
              </span>
              <span v-else>{{ $t('server.backups.create') }}</span>
            </button>
        </div>
        <div class="grid gap-4 lg:grid-cols-5">
          <div class="lg:col-span-3">
          <div v-if="loadingBackups" class="text-center py-12">
            <div class="w-8 h-8 mx-auto border-2 border-emerald-300/30 border-t-emerald-300 rounded-full animate-spin"></div>
          </div>

          <div v-else-if="backups.length === 0" class="text-center py-12 text-white/50 text-sm">
            {{ $t('server.backups.empty') }}
          </div>

          <div v-else class="space-y-3">
            <div 
              v-for="backup in backups" 
              :key="backup.uuid"
              class="bg-white/5 border border-white/10 rounded-xl p-3 sm:p-4 flex items-center justify-between"
            >
              <div class="flex items-center gap-3">
                <svg class="w-8 h-8 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                  <rect width="24" height="24" fill="none"/>
                  <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-6l-2-2H5a2 2 0 0 0-2 2z"/>
                </svg>
                <div>
                  <p class="text-white text-sm sm:text-base font-medium">{{ backup.name || backup.uuid?.slice(0, 8) }}</p>
                  <p class="text-white/40 text-xs">
                    {{ formatBackupDate(backup.created_at) }}
                    <span v-if="backup.size" class="ml-2">• {{ formatBytes(backup.size) }}</span>
                    <span
                      :class="[
                        'ml-2 px-1.5 py-0.5 rounded-full text-[10px] border',
                        backup.status === 'completed' ? 'bg-green-500/10 text-green-400 border-green-500/30'
                        : backup.status === 'failed' ? 'bg-red-500/10 text-red-400 border-red-500/30'
                        : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30 animate-pulse'
                      ]"
                    >{{ backupStatusText(backup.status) }}</span>
                  </p>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <button @click="restoreBackup(backup)" :disabled="backup.status !== 'completed'" :title="$t('server.backups.restore')" class="text-green-400 hover:text-green-300 p-1 disabled:opacity-30 disabled:cursor-not-allowed">
                  <svg class="w-4 h-4 sm:w-5 sm:h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                    <rect width="24" height="24" fill="none"/>
                    <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
                      <path d="M3 12a9 9 0 1 0 9-9a9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                      <path d="M3 3v5h5"/>
                    </g>
                  </svg>
                </button>
                <button @click="downloadBackup(backup)" :disabled="backup.status !== 'completed'" :title="$t('server.backups.download')" class="text-emerald-300 hover:text-emerald-200 p-1 disabled:opacity-30 disabled:cursor-not-allowed">
                  <svg class="w-4 h-4 sm:w-5 sm:h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                    <rect width="24" height="24" fill="none"/>
                    <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2M7 9l5-5l5 5m-5-5v12"/>
                  </svg>
                </button>
                <button @click="deleteBackup(backup.uuid)" class="text-red-400 hover:text-red-300 p-1" :title="$t('server.backups.delete')">
                  <svg class="w-4 h-4 sm:w-5 sm:h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                    <rect width="24" height="24" fill="none"/>
                    <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7h16M10 11v6M14 11v6M5 7l1 14h12l1-14"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
          <div v-if="backupMessage" :class="[
            'text-sm p-3 rounded-lg mt-4',
            backupMessageType === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'
          ]">
            {{ backupMessage }}
          </div>
          </div>

          <div class="lg:col-span-2">
            <div class="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
              <h4 class="text-white/90 text-sm font-medium">{{ $t('server.backups.about') }}</h4>
              <ul class="text-white/50 text-xs sm:text-sm space-y-1.5 list-disc list-inside">
                <li>{{ $t('server.backups.aboutLi1') }}</li>
                <li><span class="text-white/70 font-medium">{{ $t('server.backups.aboutRestore') }}</span> {{ $t('server.backups.aboutLi2') }}</li>
                <li><span class="text-white/70 font-medium">{{ $t('server.backups.aboutDownload') }}</span> {{ $t('server.backups.aboutLi3') }}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <!-- Базы данных -->
      <div v-if="activeTab === 'databases'" class="p-3 sm:p-5">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-medium text-white">{{ $t('server.tabs.databases') }}</h3>
          <span class="text-white/40 text-xs sm:text-sm">{{ databaseLimitText }}</span>
        </div>
        <div class="grid gap-4 lg:grid-cols-5">
          <div class="lg:col-span-3">
          <div v-if="loadingDbs" class="text-center py-12">
            <div class="w-8 h-8 mx-auto border-2 border-emerald-300/30 border-t-emerald-300 rounded-full animate-spin"></div>
          </div>

          <div v-else-if="databases.length === 0" class="text-center py-12">
            <div class="w-12 h-12 mx-auto mb-3 rounded-2xl bg-purple-500/15 border border-purple-500/25 flex items-center justify-center">
              <svg class="w-6 h-6 text-purple-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <rect width="24" height="24" fill="none"/>
                <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
                  <ellipse cx="12" cy="5" rx="8" ry="3"/>
                  <path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/>
                  <path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>
                </g>
              </svg>
            </div>
            <p class="text-white/70 text-sm font-medium mb-1">{{ $t('server.databases.emptyTitle') }}</p>
            <p class="text-white/40 text-xs mb-4">{{ $t('server.databases.emptyHint') }}</p>
            <button
              @click="showCreateDb = true"
              class="bg-emerald-300 hover:bg-emerald-200 text-black border border-transparent px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all"
            >
              {{ $t('server.databases.createFirst') }}
            </button>
          </div>

          <div v-else class="space-y-3">
            <div
              v-for="db in databases"
              :key="db.id"
              class="bg-white/5 border border-white/10 rounded-xl p-3 sm:p-4 space-y-2"
            >
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2.5">
                  <div class="w-8 h-8 rounded-lg bg-purple-500/15 border border-purple-500/25 flex items-center justify-center flex-shrink-0">
                    <svg class="w-4 h-4 text-purple-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                      <rect width="24" height="24" fill="none"/>
                      <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
                        <ellipse cx="12" cy="5" rx="8" ry="3"/>
                        <path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/>
                        <path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>
                      </g>
                    </svg>
                  </div>
                  <div class="min-w-0">
                    <p class="text-white text-sm sm:text-base font-medium truncate">{{ db.name }}</p>
                    <p class="text-white/40 text-xs">{{ db.hostName || $t('server.databases.hostFallback') }} • {{ (db.type || 'mysql').toUpperCase() }}</p>
                  </div>
                </div>
                <button @click="rotateDbPassword(db.id)" class="text-yellow-400 hover:text-yellow-300 p-1 flex-shrink-0" :title="$t('server.databases.rotate')">
                  <svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                    <rect width="24" height="24" fill="none"/>
                    <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
                      <path d="M19.933 13.041a8 8 0 1 1-9.925-8.788c3.899-1 7.935 1.007 9.425 4.747"/>
                      <path d="M20 4v5h-5"/>
                    </g>
                  </svg>
                </button>
                <button @click="deleteDb(db.id)" class="text-red-400 hover:text-red-300 p-1 flex-shrink-0" :title="$t('server.databases.deleteDb')">
                  <svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                    <rect width="24" height="24" fill="none"/>
                    <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7h16M10 11v6M14 11v6M5 7l1 14h12l1-14"/>
                  </svg>
                </button>
              </div>
              <div class="space-y-1.5">
                <div v-for="row in dbRows(db)" :key="row.label" class="flex items-center justify-between gap-2 bg-black/20 border border-white/5 rounded-lg px-3 py-2">
                  <span class="text-white/40 text-xs flex-shrink-0">{{ row.label }}</span>
                  <div class="flex items-center gap-2 min-w-0">
                    <code class="text-white font-mono text-xs truncate">{{ row.display }}</code>
                    <button v-if="row.secret" @click="toggleDbPassword(db.id)" class="text-emerald-300 hover:text-emerald-200 text-[10px] sm:text-xs flex-shrink-0">
                      {{ visiblePasswords[db.id] ? $t('server.hide') : $t('server.show') }}
                    </button>
                    <button @click="copyToClipboard(row.copy)" class="text-emerald-300 hover:text-emerald-200 text-[10px] sm:text-xs flex-shrink-0">{{ $t('server.copy') }}</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div v-if="dbMessage" :class="[
            'text-sm p-3 rounded-lg mt-4',
            dbMessageType === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'
          ]">
            {{ dbMessage }}
          </div>
          <button
            v-if="!loadingDbs && databases.length > 0"
            @click="showCreateDb = true"
            class="mt-4 w-full border border-dashed border-white/15 hover:border-emerald-300/40 hover:bg-emerald-300/5 text-white/50 hover:text-emerald-200 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-medium transition-all"
          >
            {{ $t('server.databases.newDb') }}
          </button>

          <!-- Модалка создания БД -->
          <div v-if="showCreateDb" class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" @click.self="closeCreateDb">
            <div class="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 w-full max-w-md">
              <h3 class="text-lg font-medium text-white">{{ $t('server.databases.newTitle') }}</h3>
              <p class="text-white/40 text-xs mt-1 mb-4">{{ $t('server.databases.newHint') }}</p>

              <div v-if="!dbHosts.length" class="text-center py-6 text-white/50 text-sm">
                {{ $t('server.databases.noHosts') }}
              </div>
              <div v-else class="space-y-2">
                <button
                  v-for="host in dbHosts"
                  :key="host.id"
                  @click="newDb.hostId = host.id"
                  :class="[
                    'w-full flex items-center gap-3 text-left border rounded-xl px-4 py-3 transition-all',
                    newDb.hostId === host.id
                      ? 'bg-emerald-300/15 border-emerald-300/50'
                      : 'bg-black/30 border-white/10 hover:bg-white/5'
                  ]"
                >
                  <span
                    :class="[
                      'w-4 h-4 rounded-full border-2 flex-shrink-0 transition-all',
                      newDb.hostId === host.id ? 'border-emerald-300 bg-emerald-300' : 'border-white/30'
                    ]"
                  ></span>
                  <span class="flex-1 min-w-0">
                    <span class="block text-white text-sm font-medium truncate">{{ host.name }}</span>
                    <span class="block text-white/40 text-xs">{{ host.type.toUpperCase() }}{{ dbHosts.length === 1 ? ' • ' + $t('server.databases.assignedToNode') : '' }}</span>
                  </span>
                </button>
              </div>

              <div class="flex justify-end gap-3 mt-6">
                <button @click="closeCreateDb" class="px-4 py-2 rounded-lg text-white/60 hover:text-white text-sm">{{ $t('common.cancel') }}</button>
                <button @click="createDb" :disabled="creatingDb || !newDb.hostId" class="bg-emerald-300 hover:bg-emerald-200 text-black border border-transparent px-4 py-2 rounded-lg text-sm disabled:opacity-50">
                  {{ creatingDb ? $t('common.creating') : $t('common.create') }}
                </button>
              </div>
            </div>
          </div>
          </div>

          <div class="lg:col-span-2">
            <div class="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
              <h4 class="text-white/90 text-sm font-medium">{{ $t('server.databases.aboutTitle') }}</h4>
              <ul class="text-white/50 text-xs sm:text-sm space-y-1.5 list-disc list-inside">
                <li>{{ $t('server.databases.aboutLi1') }}</li>
                <li>{{ $t('server.databases.aboutLi2') }}</li>
                <li>{{ $t('server.databases.aboutLi3') }}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <!-- Расписание -->
      <div v-if="activeTab === 'schedules'" class="p-3 sm:p-5">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-medium text-white">{{ $t('server.tabs.schedules') }}</h3>
          <button
            @click="showSchedForm = !showSchedForm"
            class="bg-emerald-300 hover:bg-emerald-200 text-black border border-transparent px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all"
          >
            {{ $t('server.schedules.newTask') }}
          </button>
        </div>

        <div v-if="showSchedForm" class="bg-white/5 border border-white/10 rounded-xl p-3 sm:p-4 space-y-3 mb-4">
          <div class="grid sm:grid-cols-2 gap-3">
            <div>
              <label class="text-white/50 text-xs block mb-1">{{ $t('server.schedules.name') }}</label>
              <input v-model="newSched.name" type="text" maxlength="255" class="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" />
            </div>
            <div>
              <label class="text-white/50 text-xs block mb-1">{{ $t('server.schedules.action') }}</label>
              <UiSelect v-model="newSched.action" :options="schedActionOptions" />
            </div>
          </div>
          <div v-if="newSched.action === 'command'">
            <label class="text-white/50 text-xs block mb-1">{{ $t('server.schedules.command') }}</label>
            <input v-model="newSched.payload" type="text" maxlength="2000" placeholder="say Server restart in 5 minutes" class="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono" />
          </div>
          <div>
            <label class="text-white/50 text-xs block mb-1">{{ $t('server.schedules.every') }}</label>
            <div class="flex items-center gap-2">
              <input v-model.number="newSched.intervalMinutes" type="number" min="5" max="10080" class="w-28 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" />
              <span class="text-white/40 text-xs">{{ $t('server.schedules.minutes') }}</span>
              <button @click="createSchedule" :disabled="creatingSched" class="ml-auto bg-emerald-300 hover:bg-emerald-200 text-black border border-transparent px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all disabled:opacity-50">
                {{ creatingSched ? $t('common.creating') : $t('common.create') }}
              </button>
            </div>
          </div>
        </div>

        <div v-if="loadingSchedules" class="text-center py-8">
          <div class="w-6 h-6 mx-auto border-2 border-emerald-300/30 border-t-emerald-300 rounded-full animate-spin"></div>
        </div>
        <div v-else-if="!schedulesList.length" class="text-center py-8 text-white/50 text-sm">
          {{ $t('server.schedules.empty') }}
        </div>
        <div v-else class="space-y-3">
          <div v-for="s in schedulesList" :key="s.id" class="bg-white/5 border border-white/10 rounded-xl p-3 sm:p-4">
            <div class="flex items-center gap-3">
              <button @click="toggleSchedule(s)" :title="s.active ? $t('server.schedules.pause') : $t('server.schedules.resume')" :class="['w-9 h-5 rounded-full transition-colors flex-shrink-0 relative', s.active ? 'bg-emerald-300' : 'bg-white/20']">
                <span :class="['absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all', s.active ? 'left-[18px]' : 'left-0.5']" />
              </button>
              <div class="min-w-0 flex-1">
                <p class="text-white text-sm font-medium truncate">{{ s.name }}</p>
                <p class="text-white/40 text-xs truncate">{{ schedActionLabel(s) }} • {{ $t('server.schedules.everyShort', { n: s.intervalMinutes }) }} • {{ $t('server.schedules.next') }}: {{ formatSchedDate(s.nextRunAt) }}</p>
              </div>
              <div class="flex items-center gap-1 flex-shrink-0">
                <button @click="runScheduleNow(s.id)" class="text-emerald-300 hover:text-emerald-200 p-1" :title="$t('server.schedules.runNow')">
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                </button>
                <button @click="deleteSchedule(s.id)" class="text-red-400 hover:text-red-300 p-1" :title="$t('common.delete')">
                  <svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" fill="none"/><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7h16M10 11v6M14 11v6M5 7l1 14h12l1-14"/></svg>
                </button>
              </div>
            </div>
          </div>
        </div>
        <div v-if="schedMessage" :class="[
          'text-sm p-3 rounded-lg mt-4',
          schedMessageType === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'
        ]">
          {{ schedMessage }}
        </div>
      </div>

      <!-- Пользователи -->
      <div v-if="activeTab === 'users'" class="p-3 sm:p-5">
        <div class="flex items-center gap-2 mb-4">
          <h3 class="text-lg font-medium text-white">{{ $t('server.users.title') }}</h3>
          <span class="text-[11px] px-2 py-0.5 rounded-full bg-white/[0.06] text-white/50 border border-white/10">{{ members.length }}</span>
        </div>
        <div class="grid gap-4 lg:grid-cols-5">
          <div class="lg:col-span-3">
            <div v-if="loadingUsers" class="text-center py-8">
              <div class="w-6 h-6 mx-auto border-2 border-emerald-300/30 border-t-emerald-300 rounded-full animate-spin"></div>
            </div>
            <div v-else-if="!members.length" class="text-center py-8 text-white/50 text-sm">
              {{ $t('server.users.empty') }}
            </div>
            <div v-else class="space-y-3">
              <div v-for="m in members" :key="m.userId" class="bg-white/5 border border-white/10 rounded-xl p-3 sm:p-4">
                <div class="flex items-center gap-3">
                  <div class="w-9 h-9 rounded-full bg-emerald-300/15 border border-emerald-300/25 flex items-center justify-center text-emerald-300 text-sm font-semibold flex-shrink-0">
                    {{ (m.name || m.email || '?').charAt(0).toUpperCase() }}
                  </div>
                  <div class="min-w-0 flex-1">
                    <p class="text-white text-sm font-medium truncate">{{ m.email }}</p>
                    <p v-if="m.name" class="text-white/40 text-xs truncate">{{ m.name }}</p>
                  </div>
                  <span :title="`Прав: ${(m.permissions || []).length}`" class="text-[11px] px-2 py-0.5 rounded-full bg-white/[0.06] text-white/50 border border-white/10 flex-shrink-0">{{ (m.permissions || []).length }}</span>
                  <div class="flex items-center gap-2 flex-shrink-0">
                    <button v-if="canEditUsers && editingId !== m.userId" @click="startEdit(m)" class="text-emerald-300 hover:text-emerald-200 text-[10px] sm:text-xs">{{ $t('server.users.rights') }}</button>
                    <button v-if="canDeleteUsers" @click="removeUser(m.userId, m.email)" class="text-red-400 hover:text-red-300 text-[10px] sm:text-xs">{{ $t('server.users.remove') }}</button>
                  </div>
                </div>
                <div v-if="editingId === m.userId" class="space-y-2.5 mt-3 pt-3 border-t border-white/10">
                  <div v-for="g in permCatalog" :key="g.group" class="bg-black/20 border border-white/5 rounded-xl p-2.5">
                    <div class="flex items-center justify-between mb-1.5">
                      <p class="text-white/50 text-[11px] uppercase tracking-wide">{{ g.group }} <span class="text-emerald-300/70">{{ groupCount(editPerms, g) }}/{{ (g.permissions || []).length }}</span></p>
                      <button @click="toggleGroupIn(editPerms, g)" class="text-emerald-300/70 hover:text-emerald-200 text-[11px]">
                        {{ isGroupFull(editPerms, g) ? $t('server.users.removeAll') : $t('server.users.all') }}
                      </button>
                    </div>
                    <div class="space-y-1">
                      <label v-for="p in g.permissions" :key="p.key" :title="!canGrant(p.key) ? 'Нет этого права у тебя — выдать не выйдет' : p.desc" :class="['flex items-center gap-2.5 px-2.5 py-2 rounded-lg border transition-all', editPerms.includes(p.key) ? 'bg-emerald-300/10 border-emerald-300/30' : 'bg-black/30 border-white/5', canGrant(p.key) ? 'cursor-pointer hover:bg-white/5' : 'opacity-40']">
                        <UiToggle :model-value="editPerms.includes(p.key)" :disabled="!canGrant(p.key)" @change="toggleIn(editPerms, p.key)" small />
                        <span class="min-w-0">
                          <span class="block text-xs text-white/85">{{ p.name }}</span>
                          <span class="block text-[11px] text-white/35 truncate">{{ p.desc }}</span>
                        </span>
                      </label>
                    </div>
                  </div>
                  <div class="flex gap-2 pt-1">
                    <button @click="savePerms(m.userId)" :disabled="savingPerms" class="bg-emerald-300 hover:bg-emerald-200 text-black border border-transparent px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50">{{ $t('server.users.save') }}</button>
                    <button @click="editingId = null" class="text-white/50 hover:text-white/80 text-xs">{{ $t('server.users.cancel') }}</button>
                  </div>
                </div>
                <div v-else class="flex flex-wrap gap-1.5 mt-2.5">
                  <span v-for="key in m.permissions" :key="key" class="text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-emerald-300/10 text-emerald-300 border border-emerald-300/20">{{ permLabel(key) }}</span>
                </div>
              </div>
            </div>
            <div v-if="usersMessage" :class="[
              'text-sm p-3 rounded-lg mt-4',
              usersMessageType === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'
            ]">
              {{ usersMessage }}
            </div>
          </div>

          <div class="lg:col-span-2">
            <div v-if="canInviteUsers" class="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
              <h4 class="text-white/90 text-sm font-medium">{{ $t('server.users.invite') }}</h4>

              <!-- Шаг 1: почта -->
              <div class="space-y-3">
                <p class="text-white/30 text-xs">{{ $t('server.users.inviteHint') }}</p>
                <div class="flex gap-2">
                  <input
                    v-model="inviteEmail"
                    type="email"
                    placeholder="user@example.com"
                    @keyup.enter="lookupUser"
                    class="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-white/25"
                  />
                  <button
                    @click="lookupUser"
                    :disabled="lookingUp || !inviteEmail"
                    class="bg-emerald-300 hover:bg-emerald-200 text-black border border-transparent px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all disabled:opacity-50 flex-shrink-0"
                  >
                    {{ lookingUp ? '...' : $t('server.users.next') }}
                  </button>
                </div>
              </div>
              <!-- Шаг 2: модалка выдачи прав найденному -->
              <Teleport to="body">
                <div v-if="inviteModal" class="fixed inset-0 z-[100] flex items-center justify-center p-4" @click.self="inviteModal = false">
                  <div class="absolute inset-0 bg-black/70 backdrop-blur-sm kt-fade-in"></div>
                  <div class="kt-pop relative bg-[#141414] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6 space-y-3">
                    <div class="flex items-center justify-between">
                      <h3 class="text-base sm:text-lg font-medium text-white">{{ $t('server.users.newAccess') }}</h3>
                      <button @click="inviteModal = false" :title="$t('server.users.close')" class="text-white/40 hover:text-white/80 p-1 transition-colors">
                        <svg class="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                      </button>
                    </div>
                <div class="flex items-center gap-3 bg-black/30 border border-white/10 rounded-xl p-3">
                  <div v-if="lookupResult?.avatar" class="w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
                    <img :src="lookupResult.avatar" alt="" class="w-full h-full object-cover" />
                  </div>
                  <div v-else class="w-10 h-10 rounded-full bg-emerald-300/20 border border-emerald-300/30 flex items-center justify-center text-emerald-300 font-medium flex-shrink-0">
                    {{ (lookupResult?.name || lookupResult?.email || '?').charAt(0).toUpperCase() }}
                  </div>
                  <div class="min-w-0">
                    <p class="text-white text-sm font-medium truncate">{{ lookupResult?.name || $t('server.users.noNick') }}</p>
                    <p class="text-white/40 text-xs truncate">{{ lookupResult?.email }}</p>
                  </div>
                </div>
                <div class="bg-black/20 border border-white/5 rounded-xl p-2.5">
                  <p class="text-white/50 text-[11px] uppercase tracking-wide mb-1.5">{{ $t('server.users.sets') }}</p>
                  <div class="grid grid-cols-3 gap-1.5">
                    <button
                      v-for="pr in PERM_PRESETS"
                      :key="pr.id"
                      type="button"
                      :title="pr.desc"
                      @click="applyPreset(pr)"
                      class="text-xs px-2 py-2 rounded-lg border transition-all bg-black/30 text-white/60 border-white/10 hover:bg-white/5 hover:text-white/85"
                    >
                      {{ pr.name }}
                    </button>
                  </div>
                </div>
                <div v-for="g in permCatalog" :key="g.group" class="bg-black/20 border border-white/5 rounded-xl p-2.5">
                  <div class="flex items-center justify-between mb-1.5">
                    <p class="text-white/50 text-[11px] uppercase tracking-wide">{{ g.group }} <span class="text-emerald-300/70">{{ groupCount(invitePerms, g) }}/{{ (g.permissions || []).length }}</span></p>
                    <button @click="toggleGroupIn(invitePerms, g)" class="text-emerald-300/70 hover:text-emerald-200 text-[11px]">
                      {{ isGroupFull(invitePerms, g) ? $t('server.users.removeAll') : $t('server.users.all') }}
                    </button>
                  </div>
                  <div class="space-y-1">
                    <label
                      v-for="p in g.permissions"
                      :key="p.key"
                      :title="!canGrant(p.key) ? 'Нет этого права у тебя — выдать не выйдет' : p.desc"
                      :class="['flex items-center gap-2.5 px-2.5 py-2 rounded-lg border transition-all', invitePerms.includes(p.key) ? 'bg-emerald-300/10 border-emerald-300/30' : 'bg-black/30 border-white/5', canGrant(p.key) ? 'cursor-pointer hover:bg-white/5' : 'opacity-40']"
                    >
                      <UiToggle :model-value="invitePerms.includes(p.key)" :disabled="!canGrant(p.key)" @change="toggleIn(invitePerms, p.key)" small />
                      <span class="min-w-0">
                        <span class="block text-xs text-white/85">{{ p.name }}</span>
                        <span class="block text-[11px] text-white/35 truncate">{{ p.desc }}</span>
                      </span>
                    </label>
                  </div>
                </div>
                <div class="text-white/40 text-xs text-right">{{ $t('server.users.selected') }}: {{ invitePerms.length }}</div>
                <div class="flex gap-2">
                  <button
                    @click="inviteModal = false"
                    class="flex-1 bg-white/5 hover:bg-white/10 text-white/70 rounded-lg px-4 py-2 text-xs sm:text-sm font-medium transition-all"
                  >
                    {{ $t('server.users.back') }}
                  </button>
                  <button
                    @click="inviteUser"
                    :disabled="inviting || !invitePerms.length"
                    class="flex-1 bg-emerald-300 hover:bg-emerald-200 text-black border border-transparent px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all disabled:opacity-50"
                  >
                    {{ inviting ? $t('server.users.adding') : $t('server.users.add') }}
                  </button>
                </div>
                  </div>
                </div>
              </Teleport>
            </div>
            <div v-else class="bg-white/5 border border-white/10 rounded-xl p-4">
              <h4 class="text-white/90 text-sm font-medium mb-2">{{ $t('server.users.about') }}</h4>
              <p class="text-white/50 text-xs sm:text-sm">{{ $t('server.users.aboutHint') }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Активность -->
      <div v-if="activeTab === 'activity'" class="p-3 sm:p-5">
        <ServerActivity :server-id="serverId" :can-clear="isPrivileged" />
      </div>

      <!-- Переустановка -->
      <div v-if="activeTab === 'reinstall'" class="p-3 sm:p-5">
        <h3 class="text-lg font-medium text-white mb-4">{{ $t('server.reinstall.title') }}</h3>
        <div class="grid gap-4 lg:grid-cols-5">
          <div class="lg:col-span-3">
          <div class="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-6">
            <div class="flex gap-3">
              <svg class="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <rect width="24" height="24" fill="none"/>
                <path fill="currentColor" d="M12 1.67c.955 0 1.845.467 2.39 1.247l.105.16l8.114 13.548a2.914 2.914 0 0 1-2.307 4.363l-.195.008H3.882a2.914 2.914 0 0 1-2.582-4.2l.099-.185l8.11-13.538A2.91 2.91 0 0 1 12 1.67M12.01 15l-.127.007a1 1 0 0 0 0 1.986L12 17l.127-.007a1 1 0 0 0 0-1.986zM12 8a1 1 0 0 0-.993.883L11 9v4l.007.117a1 1 0 0 0 1.986 0L13 13V9l-.007-.117A1 1 0 0 0 12 8"/>
              </svg>
              <div class="text-sm">
                <p class="text-yellow-400 font-medium mb-1">{{ $t('server.reinstall.warn') }}</p>
                <p class="text-white/60">
                  {{ $t('server.reinstall.warnText') }}
                </p>
              </div>
            </div>
          </div>

          <button 
            @click="reinstallServer"
            :disabled="reinstalling || liveStatus === 'installing'"
            class="w-full bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 border border-orange-500/30 rounded-lg px-4 py-3 font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <svg v-if="reinstalling" class="w-5 h-5 animate-spin" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <rect width="24" height="24" fill="none"/>
              <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6l2.1 2.1m0-12.8l-2.1 2.1M7.7 16.3l-2.1 2.1"/>
            </svg>
            <svg v-else class="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <rect width="24" height="24" fill="none"/>
              <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
                <path d="M19.933 13.041a8 8 0 1 1-9.925-8.788c3.899-1 7.935 1.007 9.425 4.747"/>
                <path d="M20 4v5h-5"/>
              </g>
            </svg>
            {{ reinstalling ? $t('server.reinstall.going') : $t('server.reinstall.go') }}
          </button>

          <div v-if="reinstallMessage" :class="[
            'text-sm p-3 rounded-lg mt-4',
            reinstallMessageType === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'
          ]">
            {{ reinstallMessage }}
          </div>
          </div>

          <div class="lg:col-span-2">
            <div class="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
              <h4 class="text-white/90 text-sm font-medium">{{ $t('server.reinstall.what') }}</h4>
              <ul class="text-white/50 text-xs sm:text-sm space-y-1.5 list-disc list-inside">
                <li>{{ $t('server.reinstall.li1') }}</li>
                <li>{{ $t('server.reinstall.li2') }}</li>
                <li>{{ $t('server.reinstall.li3') }}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Запуск -->
      <div v-if="activeTab === 'startup'" class="p-3 sm:p-5">
        <ServerStartup :server-id="serverId" :server="server" :readonly="!canEditStartup" @updated="refreshServer" />
      </div>
      
      <!-- Установка -->
      <div v-if="activeTab === 'setup'" class="p-3 sm:p-5">
        <ServerSetup :server-id="serverId" :server="server" @updated="refreshServer" />
      </div>
      
      <!-- Логи установки -->
      <div v-if="activeTab === 'install'" class="p-3 sm:p-5">
        <div class="bg-black/50 border border-white/10 rounded-lg p-3 sm:p-4 h-64 sm:h-80 overflow-y-auto font-mono text-xs sm:text-sm">
          <div v-if="installLogs.length === 0" class="text-white/40 text-center py-8">
            {{ $t('server.reinstall.waitLogs') }}
          </div>
          <div v-for="(line, i) in installLogs" :key="i" class="text-green-400 whitespace-pre-wrap">
            {{ line }}
          </div>
          <div v-if="liveStatus === 'installing'" class="text-green-400 animate-pulse">_</div>
        </div>
      </div>
    </div>

    <!-- Переименование -->
    <Teleport to="body">
      <div v-if="showSettings" class="fixed inset-0 z-[100] flex items-center justify-center p-4" @click.self="showSettings = false">
        <div class="absolute inset-0 bg-black/70 backdrop-blur-sm kt-fade-in"></div>
        <div class="kt-pop relative bg-[#141414] border border-white/10 rounded-2xl w-full max-w-md p-4 sm:p-6 space-y-3">
          <h3 class="text-base sm:text-lg font-medium text-white">{{ $t('server.settings.title') }}</h3>
          <div>
            <label class="text-white/50 text-xs block mb-1">{{ $t('server.settings.name') }}</label>
            <input v-model="settingsForm.name" type="text" maxlength="255" class="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" @keyup.enter="saveSettings" />
          </div>
          <div>
            <label class="text-white/50 text-xs block mb-1">{{ $t('server.settings.description') }}</label>
            <textarea v-model="settingsForm.description" rows="2" maxlength="1000" class="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm resize-none" />
          </div>
          <div v-if="settingsError" class="text-red-400 text-xs">{{ settingsError }}</div>
          <div class="flex gap-2">
            <button @click="showSettings = false" class="flex-1 bg-white/5 hover:bg-white/10 text-white/70 rounded-lg px-4 py-2 text-xs sm:text-sm font-medium transition-all">
              {{ $t('common.cancel') }}
            </button>
            <button @click="saveSettings" :disabled="savingSettings" class="flex-1 bg-emerald-300 hover:bg-emerald-200 text-black border border-transparent px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all disabled:opacity-50">
              {{ savingSettings ? $t('common.saving') : $t('common.save') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
// @ts-nocheck
const route = useRoute()
const serverId = computed(() => parseInt(route.params.id as string))

const { data: session } = useAuth()
const { data: serverData, refresh: refreshServer } = await useFetch(`/api/servers/${serverId.value}`)
const server = computed(() => serverData.value)

const realUsage = ref({ cpu: 0, memory: 0, disk: 0 })
const activeTab = ref('console')
const powerLoading = ref(false)
const installLogs = ref<string[]>([])
const liveStatus = ref('')

// SFTP
const sftpData = ref(null)
const loadingSftp = ref(false)
const showPassword = ref(false)
const generatingPassword = ref(false)

// Backups
const backups = ref([])
const loadingBackups = ref(false)
const creatingBackup = ref(false)
const backupLimitText = computed(() => {
  const limit = Number(server.value?.backupSlots) || 0
  return limit > 0 ? `${backups.value.length}/${limit}` : `${backups.value.length} (${t('server.ports.unlimited')})`
})

// Databases
const databases = ref([])
const loadingDbs = ref(false)
const databaseLimitText = computed(() => {
  const limit = Number(server.value?.databaseSlots) || 0
  return limit > 0 ? `${databases.value.length}/${limit}` : `${databases.value.length} (${t('server.ports.unlimited')})`
})
const dbHosts = ref([])
const showCreateDb = ref(false)
const creatingDb = ref(false)
const visiblePasswords = ref<Record<number, boolean>>({})

const newDb = ref({
  hostId: '',
  name: '',
})
const dbMessage = ref('')
const dbMessageType = ref('success')

// Reinstall
const reinstalling = ref(false)
const reinstallMessage = ref('')
const reinstallMessageType = ref<'success' | 'error'>('success')

// Вычисляемые проценты для прогресс-баров
const cpuPercent = computed(() => {
  return (realUsage.value.cpu / (server.value?.cpu || 100)) * 100
})

const memoryPercent = computed(() => {
  return (realUsage.value.memory / ((server.value?.memory || 1024) * 1024 * 1024)) * 100
})

const diskPercent = computed(() => {
  return (realUsage.value.disk / ((server.value?.disk || 10240) * 1024 * 1024)) * 100
})

const getProgressColor = (percent: number) => {
  if (percent <= 33) return '#58B473'
  if (percent <= 66) return '#F5D742'
  return '#D64E42'
}

const { t, locale } = useI18n()

const statusText = computed(() => {
  const status = server.value?.status
  const texts: Record<string, string> = {
    installing: t('dashboard.stateInstalling'),
    running: t('dashboard.stateRunning'),
    stopped: t('dashboard.stateOffline'),
    error: t('console.error'),
  }
  return texts[status] || status || '—'
})

const statusDisplay = (status: string) => {
  const texts: Record<string, string> = {
    offline: t('dashboard.stateOffline'),
    starting: t('dashboard.stateStarting'),
    restarting: t('dashboard.stateStarting'),
    running: t('dashboard.stateRunning'),
    stopping: t('dashboard.stateStarting'),
    installing: t('dashboard.stateInstalling'),
    error: t('console.error'),
  }
  return texts[status] || status
}

const statusBadgeClass = computed(() => {
  const status = liveStatus.value || server.value?.status
  const classes: Record<string, string> = {
    installing: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    starting: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    restarting: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    running: 'bg-green-500/20 text-green-400 border-green-500/30',
    stopping: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    offline: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    stopped: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    error: 'bg-red-500/20 text-red-400 border-red-500/30',
  }
  return classes[status] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'
})

const handleStatusChange = (status: string) => {
  liveStatus.value = status
}

const fetchResources = async () => {
  try {
    const data = await $fetch(`/api/servers/${serverId.value}/resources`)
    if (data) {
      realUsage.value = {
        cpu: data.cpu || 0,
        memory: data.memory || 0,
        disk: data.disk || 0,
      }
    }
  } catch (e) {}
}

// Загрузка SFTP-доступа (через панель: личный кред вызывающего из wings).
// GET — чистое чтение; нет кредов (404) — идемпотентный POST ensure.
const loadSftp = async () => {
  loadingSftp.value = true
  try {
    try {
      const data = await $fetch(`/api/servers/${serverId.value}/sftp`)
      sftpData.value = data
    } catch (e) {
      const st = e?.status || e?.statusCode || e?.data?.statusCode || e?.response?.status
      if (st !== 404) throw e
      const data = await $fetch(`/api/servers/${serverId.value}/sftp/ensure`, { method: 'POST' })
      sftpData.value = data
    }
  } catch (e) {
    deny(e)
    sftpData.value = null
  } finally {
    loadingSftp.value = false
  }
}

// Генерация нового личного SFTP-пароля на этом сервере
// (POST /api/servers/[id]/sftp — свой кред, чужой не трогаем).
const generateNewPassword = async () => {
  generatingPassword.value = true
  try {
    const data = await $fetch(`/api/servers/${serverId.value}/sftp`, { method: 'POST' })
    sftpData.value = data
  } catch (e) {
    if (!deny(e)) alert('Ошибка генерации пароля')
  } finally {
    generatingPassword.value = false
  }
}

// Порты: первичный + доп. (слоты от админа, самовыдача из пула ноды)
const portsData = ref({ primary: null, extras: [], slots: { total: 0, used: 0 } })
const portsLoaded = ref(false)
const loadingPorts = ref(false)
const claimingPort = ref(false)
const claimForm = ref({ protocol: 'tcp' })
const portsMessage = ref('')
const portsMessageType = ref('success')

const loadPorts = async () => {
  loadingPorts.value = true
  try {
    const data = await $fetch(`/api/servers/${serverId.value}/ports`)
    portsData.value = {
      primary: data?.primary || null,
      extras: Array.isArray(data?.extras) ? data.extras : [],
      slots: data?.slots || { total: 0, used: 0 },
    }
    portsLoaded.value = true
  } catch (e) {
    if (deny(e)) return
    portsMessage.value = e.data?.message || t('server.ports.loadError')
    portsMessageType.value = 'error'
  } finally {
    loadingPorts.value = false
  }
}

const claimPort = async () => {
  claimingPort.value = true
  portsMessage.value = ''
  try {
    const data = await $fetch(`/api/servers/${serverId.value}/ports`, { method: 'POST', body: { protocol: claimForm.value.protocol } })
    portsMessage.value = t('server.ports.claimed', { ip: data.ip, port: data.port, proto: data.protocol })
    portsMessageType.value = 'success'
    await loadPorts()
  } catch (e) {
    if (deny(e)) return
    portsMessage.value = e.data?.message || t('server.ports.claimError')
    portsMessageType.value = 'error'
  } finally {
    claimingPort.value = false
  }
}

// IP для показа/копирования: заглушку 0.0.0.0 меняем на адрес сервера
// (иначе игрок видит неподключаемый адрес).
const displayPortIp = (ip) => {
  if (ip && ip !== '0.0.0.0') return ip
  const addr = server.value?.address || ''
  return addr.split(':')[0] || ip
}

const releasePort = async (allocationId) => {  if (!(await confirmDialog({ message: t('server.ports.releaseConfirm'), confirmText: t('server.ports.release'), danger: true }))) return
  try {
    await $fetch(`/api/servers/${serverId.value}/ports/${allocationId}`, { method: 'DELETE' })
    portsMessage.value = t('server.ports.released')
    portsMessageType.value = 'success'
    await loadPorts()
  } catch (e) {
    if (deny(e)) return
    portsMessage.value = e.data?.message || t('server.ports.releaseError')
    portsMessageType.value = 'error'
  }
}

const makingPrimary = ref(false)

const makePrimary = async (allocationId) => {
  if (!(await confirmDialog({ message: t('server.ports.primaryConfirm'), confirmText: t('server.ports.makePrimary') }))) return
  makingPrimary.value = true
  portsMessage.value = ''
  try {
    const data = await $fetch(`/api/servers/${serverId.value}/ports/${allocationId}/primary`, { method: 'POST' })
    portsMessage.value = t('server.ports.primarySet', { ip: data.ip, port: data.port })
    portsMessageType.value = 'success'
    await loadPorts()
    await refreshServer()
  } catch (e) {
    if (deny(e)) return
    portsMessage.value = e.data?.message || t('server.ports.primaryError')
    portsMessageType.value = 'error'
  } finally {
    makingPrimary.value = false
  }
}

// Backups
const loadBackups = async () => {
  loadingBackups.value = true
  try {
    const data = await $fetch(`/api/servers/${serverId.value}/backups`)
    backups.value = Array.isArray(data) ? data : []
    maybePollBackups()
  } catch (e) {
    deny(e)
    backups.value = []
  } finally {
    loadingBackups.value = false
  }
}

const backupMessage = ref('')
const backupMessageType = ref('success')
let backupsInterval = undefined

// Пока есть создающиеся снапшоты — опрашиваем список, иначе кнопки
// скачивания/восстановления упираются в несуществующий файл.
const maybePollBackups = () => {
  const pending = backups.value.some((b) => b.status === 'creating')
  if (pending && !backupsInterval) {
    backupsInterval = setInterval(loadBackupsQuiet, 3000)
  } else if (!pending && backupsInterval) {
    clearInterval(backupsInterval)
    backupsInterval = undefined
  }
}

const loadBackupsQuiet = async () => {
  try {
    const data = await $fetch(`/api/servers/${serverId.value}/backups`)
    backups.value = Array.isArray(data) ? data : []
    maybePollBackups()
  } catch (e) {}
}

const backupStatusText = (s) => {
  if (s === 'completed') return t('server.backups.ready')
  if (s === 'failed') return t('server.backups.failed')
  return t('server.backups.pending')
}

const createBackup = async () => {
  creatingBackup.value = true
  backupMessage.value = ''
  try {
    await $fetch(`/api/servers/${serverId.value}/backups`, { method: 'POST' })
    backupMessage.value = t('server.backups.started')
    backupMessageType.value = 'success'
    await loadBackups()
  } catch (e) {
    if (deny(e)) return
    backupMessage.value = e.data?.message || t('server.backups.createError')
    backupMessageType.value = 'error'
  } finally {
    creatingBackup.value = false
  }
}

const restoreBackup = async (backup) => {
  if (backup.status !== 'completed') return
  if (!(await confirmDialog({ message: t('server.backups.restoreConfirm'), confirmText: t('server.backups.restore') }))) return

  try {
    await $fetch(`/api/servers/${serverId.value}/backups/${backup.uuid}/restore`, { method: 'POST' })
    backupMessage.value = t('server.backups.restoring')
    backupMessageType.value = 'success'
  } catch (e) {
    if (deny(e)) return
    backupMessage.value = e.data?.message || t('server.backups.restoreError')
    backupMessageType.value = 'error'
  }
}

const downloadBackup = (backup) => {
  if (backup.status !== 'completed') {
    backupMessage.value = t('server.backups.notReady')
    backupMessageType.value = 'error'
    return
  }
  window.open(`/api/servers/${serverId.value}/backups/${backup.uuid}/download`, '_blank')
}

const deleteBackup = async (uuid) => {
  if (!(await confirmDialog({ message: t('server.backups.deleteConfirm'), confirmText: t('server.backups.delete'), danger: true }))) return
  try {
    await $fetch(`/api/servers/${serverId.value}/backups/${uuid}`, { method: 'DELETE' })
    await loadBackups()
  } catch (e) {
    if (deny(e)) return
    backupMessage.value = e.data?.message || t('server.backups.deleteError')
    backupMessageType.value = 'error'
  }
}

const formatBackupDate = (dateStr) => {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString(locale.value || 'en', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Databases
const loadDatabases = async () => {
  loadingDbs.value = true
  try {
    const data = await $fetch(`/api/servers/${serverId.value}/databases`)
    databases.value = Array.isArray(data) ? data : []
  } catch (e) {
    deny(e)
    databases.value = []
  } finally {
    loadingDbs.value = false
  }
}

const loadDbHosts = async () => {
  try {
    const data = await $fetch(`/api/servers/${serverId.value}/db-hosts`)
    dbHosts.value = Array.isArray(data) ? data : []
    if (dbHosts.value.length === 1) newDb.value.hostId = dbHosts.value[0].id
  } catch (e) {
    deny(e)
    dbHosts.value = []
  }
}

const toggleDbPassword = (id: number) => {
  visiblePasswords.value[id] = !visiblePasswords.value[id]
}

const createDb = async () => {
  if (!newDb.value.hostId) return
  creatingDb.value = true
  dbMessage.value = ''
  try {
    await $fetch(`/api/servers/${serverId.value}/databases`, {
      method: 'POST',
      body: { host_id: newDb.value.hostId }
    })
    closeCreateDb()
    dbMessage.value = t('server.databases.created')
    dbMessageType.value = 'success'
    await loadDatabases()
  } catch (e: any) {
    if (deny(e)) return
    dbMessage.value = e.data?.message || t('server.databases.createError')
    dbMessageType.value = 'error'
  } finally {
    creatingDb.value = false
  }
}

const closeCreateDb = () => {
  showCreateDb.value = false
  newDb.value = { hostId: dbHosts.value.length === 1 ? dbHosts.value[0].id : '', name: '' }
}

const deleteDb = async (dbId: number) => {
  if (!(await confirmDialog({ message: t('server.databases.deleteConfirm'), confirmText: t('server.backups.delete'), danger: true }))) return
  try {
    await $fetch(`/api/servers/${serverId.value}/databases/${dbId}`, { method: 'DELETE' })
    dbMessage.value = t('server.databases.deleted')
    dbMessageType.value = 'success'
    await loadDatabases()
  } catch (e) {
    if (deny(e)) return
    dbMessage.value = e.data?.message || t('server.databases.deleteError')
    dbMessageType.value = 'error'
  }
}

const rotateDbPassword = async (dbId: number) => {
  if (!(await confirmDialog({ message: t('server.databases.rotateConfirm'), confirmText: t('server.databases.rotate'), danger: true }))) return
  try {
    const res: any = await $fetch(`/api/servers/${serverId.value}/databases/${dbId}/password`, { method: 'POST' })
    const i = databases.value.findIndex((d: any) => d.id === dbId)
    if (i >= 0) databases.value[i] = { ...databases.value[i], password: res.password }
    visiblePasswords.value[dbId] = true
    dbMessage.value = t('server.databases.rotated')
    dbMessageType.value = 'success'
  } catch (e: any) {
    if (deny(e)) return
    dbMessage.value = e.data?.message || t('server.databases.rotateError')
    dbMessageType.value = 'error'
  }
}

// Расписание: периодические power/команды, выполняет server/plugins/scheduler.ts.
const schedulesList = ref<any[]>([])
const schedulesLoaded = ref(false)
const loadingSchedules = ref(false)
const showSchedForm = ref(false)
const creatingSched = ref(false)
const newSched = ref({ name: '', action: 'restart', payload: '', intervalMinutes: 60 })
const schedMessage = ref('')
const schedMessageType = ref('success')

const schedActionOptions = computed(() => [
  { value: 'start', label: t('dashboard.start') },
  { value: 'stop', label: t('dashboard.stop') },
  { value: 'restart', label: t('dashboard.restart') },
  { value: 'command', label: t('server.schedules.commandAction') },
])

const schedActionLabel = (s: any) => {
  if (s.action === 'command') return `${t('server.schedules.commandAction')}: ${s.payload || ''}`
  if (s.action === 'start') return t('dashboard.start')
  if (s.action === 'stop') return t('dashboard.stop')
  return t('dashboard.restart')
}

const formatSchedDate = (v: any) => {
  if (!v) return '—'
  try {
    return new Date(v).toLocaleString(locale.value || 'en')
  } catch { return '' }
}

const loadSchedules = async () => {
  loadingSchedules.value = true
  try {
    const data = await $fetch(`/api/servers/${serverId.value}/schedules`)
    schedulesList.value = Array.isArray(data) ? data : []
    schedulesLoaded.value = true
  } catch (e) {
    deny(e)
    schedulesList.value = []
  } finally {
    loadingSchedules.value = false
  }
}

const createSchedule = async () => {
  creatingSched.value = true
  schedMessage.value = ''
  try {
    await $fetch(`/api/servers/${serverId.value}/schedules`, {
      method: 'POST',
      body: { name: newSched.value.name, action: newSched.value.action, payload: newSched.value.payload, intervalMinutes: newSched.value.intervalMinutes },
    })
    showSchedForm.value = false
    newSched.value = { name: '', action: 'restart', payload: '', intervalMinutes: 60 }
    schedMessage.value = t('server.schedules.created')
    schedMessageType.value = 'success'
    schedulesLoaded.value = false
    await loadSchedules()
  } catch (e: any) {
    if (deny(e)) return
    schedMessage.value = e.data?.message || t('server.schedules.createError')
    schedMessageType.value = 'error'
  } finally {
    creatingSched.value = false
  }
}

const toggleSchedule = async (s: any) => {
  try {
    await $fetch(`/api/servers/${serverId.value}/schedules/${s.id}`, { method: 'PUT', body: { active: !s.active } })
    s.active = s.active ? 0 : 1
  } catch (e) {
    if (!deny(e)) alert(e.data?.message || t('server.schedules.saveError'))
  }
}

const deleteSchedule = async (id: number) => {
  if (!(await confirmDialog({ message: t('server.schedules.deleteConfirm'), confirmText: t('common.delete'), danger: true }))) return
  try {
    await $fetch(`/api/servers/${serverId.value}/schedules/${id}`, { method: 'DELETE' })
    schedulesList.value = schedulesList.value.filter((s: any) => s.id !== id)
  } catch (e) {
    if (!deny(e)) alert(e.data?.message || t('server.schedules.deleteError'))
  }
}

const runScheduleNow = async (id: number) => {
  try {
    await $fetch(`/api/servers/${serverId.value}/schedules/${id}/run`, { method: 'POST' })
    schedMessage.value = t('server.schedules.started')
    schedMessageType.value = 'success'
    await loadSchedules()
  } catch (e: any) {
    if (deny(e)) return
    schedMessage.value = e.data?.message || t('server.schedules.runError')
    schedMessageType.value = 'error'
  }
}

// Строки карточки подключения: что показать, что копировать.
const dbRows = (db) => {  const host = `${db.host || 'localhost'}:${db.port || 3306}`
  const jdbc = `jdbc:${db.type || 'mysql'}://${host}/${db.name}`
  return [
    { label: t('server.databases.rowName'), display: db.name, copy: db.name },
    { label: t('server.databases.rowHost'), display: host, copy: host },
    { label: t('server.databases.rowUser'), display: db.username, copy: db.username },
    { label: t('server.databases.rowPassword'), display: visiblePasswords.value[db.id] ? db.password : '••••••', copy: db.password, secret: true },
    { label: t('server.databases.rowJdbc'), display: jdbc, copy: jdbc },
  ]
}

// Переименование: только владелец/админ, без отдельных прав.
const showSettings = ref(false)
const savingSettings = ref(false)
const settingsError = ref('')
const settingsForm = ref({ name: '', description: '' })

const openSettings = () => {
  settingsForm.value = { name: server.value?.name || '', description: server.value?.description || '' }
  settingsError.value = ''
  showSettings.value = true
}

const saveSettings = async () => {
  const name = settingsForm.value.name.trim()
  if (name.length < 2) {
    settingsError.value = t('server.settings.nameShort')
    return
  }
  savingSettings.value = true
  settingsError.value = ''
  try {
    await $fetch(`/api/servers/${serverId.value}/settings`, {
      method: 'PUT',
      body: { name, description: settingsForm.value.description.trim() },
    })
    showSettings.value = false
    await refreshServer()
  } catch (e: any) {
    if (deny(e)) return
    settingsError.value = e.data?.message || t('server.settings.saveError')
  } finally {
    savingSettings.value = false
  }
}

// Копирование в буфер обмена
const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text)
}

const autostartLoading = ref(false)

const toggleAutostart = async () => {
  autostartLoading.value = true
  try {
    await $fetch(`/api/servers/${serverId.value}/autostart`, {
      method: 'PUT',
      body: { enabled: !server.value?.autoStart },
    })
    await refreshServer()
  } catch (e) {
    if (!deny(e)) alert(e.data?.message || 'Ошибка переключения автозапуска')
  } finally {
    autostartLoading.value = false
  }
}

// Права просмотра: владелец и админ могут всё, субпользователь — свой набор.
const isPrivileged = computed(() => !!(server.value?.viewer?.owner || server.value?.viewer?.admin))
const viewerPerms = computed(() => server.value?.viewer?.permissions || [])
const hasPerm = (key) => isPrivileged.value || viewerPerms.value.includes(key)

// deny() — общий из useNoAccess (модалка на 403), см. app/composables/useNoAccess.ts.
const canViewUsers = computed(() => isPrivileged.value || hasPerm('user.read'))
const canViewActivity = computed(() => isPrivileged.value || hasPerm('activity.read'))
const canInviteUsers = computed(() => isPrivileged.value || hasPerm('user.create'))
const canEditUsers = computed(() => isPrivileged.value || hasPerm('user.update'))
const canDeleteUsers = computed(() => isPrivileged.value || hasPerm('user.delete'))
const canEditStartup = computed(() => isPrivileged.value || hasPerm('startup.update'))
const canViewStartup = computed(() => canEditStartup.value || hasPerm('startup.read'))
// Выдавать можно лишь права из своего набора (без эскалации); бэкенд
// дублирует проверку в users/index.post и users/[userId].put.
const canGrant = (key) => isPrivileged.value || viewerPerms.value.includes(key)

// Кнопки power по состоянию (серые и мёртвые когда действие бессмысленно):
// старт — только на выключенном, стоп/рестарт — только на живом.
const startStateOff = computed(() => ['running', 'starting', 'restarting', 'installing'].includes(liveStatus.value))
const stopStateOff = computed(() => !['running', 'starting'].includes(liveStatus.value))
const restartStateOff = computed(() => !['running', 'starting'].includes(liveStatus.value))
const stateOffCls = 'opacity-60 !bg-white/5 !text-white/25 !border-white/10'

// Субпользователи
const members = ref([])
const permCatalog = ref([])
const loadingUsers = ref(false)
const usersLoaded = ref(false)
const inviteEmail = ref('')
const invitePerms = ref([])
const inviting = ref(false)
const inviteModal = ref(false)
const lookupResult = ref(null)
const lookingUp = ref(false)
const usersMessage = ref('')
const usersMessageType = ref('success')
const editingId = ref(null)
const editPerms = ref([])
const savingPerms = ref(false)

const permLabel = (key) => {
  for (const g of permCatalog.value) {
    const hit = (g.permissions || []).find((p) => p.key === key)
    if (hit) return hit.name
  }
  return key
}

const toggleIn = (arr, key) => {
  if (!canGrant(key)) return
  const i = arr.indexOf(key)
  if (i >= 0) arr.splice(i, 1)
  else arr.push(key)
}

const groupCount = (arr, g) => (g.permissions || []).filter((p) => arr.includes(p.key)).length

const isGroupFull = (arr, g) => {
  const keys = (g.permissions || []).map((p) => p.key)
  return keys.length > 0 && keys.every((k) => arr.includes(k))
}

const toggleGroupIn = (arr, g) => {
  const keys = (g.permissions || []).map((p) => p.key).filter((k) => canGrant(k))
  if (isGroupFull(arr, g)) {
    for (const k of keys) {
      const i = arr.indexOf(k)
      if (i >= 0) arr.splice(i, 1)
    }
  } else {
    for (const k of keys) if (!arr.includes(k)) arr.push(k)
  }
}

// Наборы прав для быстрой выдачи. Доверенный собирается динамически:
// всё из каталога, кроме управления пользователями.
const PERM_PRESETS = computed(() => [
  { id: 'viewer', name: t('server.users.presetViewer'), desc: t('server.users.presetViewerD'), keys: ['websocket.connect', 'file.read', 'backup.read', 'database.read', 'allocation.read', 'startup.read', 'user.read'] },
  { id: 'player', name: t('server.users.presetPlayer'), desc: t('server.users.presetPlayerD'), keys: ['websocket.connect', 'control.console', 'control.start', 'control.stop', 'control.restart', 'file.read', 'file.create', 'backup.read', 'backup.create', 'database.read', 'allocation.read', 'startup.read', 'user.read'] },
  { id: 'trusted', name: t('server.users.presetTrusted'), desc: t('server.users.presetTrustedD'), keys: [] },
])

const allPermKeys = computed(() => (permCatalog.value || []).flatMap((g) => (g.permissions || []).map((p) => p.key)))

const presetKeys = (pr) => pr.id === 'trusted'
  ? allPermKeys.value.filter((k) => !['user.create', 'user.update', 'user.delete'].includes(k))
  : pr.keys

const applyPreset = (pr) => {
  const avail = presetKeys(pr).filter((k) => canGrant(k) && allPermKeys.value.includes(k))
  invitePerms.value = [...new Set(avail)]
}

const lookupUser = async () => {
  if (!inviteEmail.value) return
  lookingUp.value = true
  usersMessage.value = ''
  try {
    const data = await $fetch(`/api/servers/${serverId.value}/users/lookup`, {
      method: 'POST',
      body: { email: inviteEmail.value },
    })
    if (!data?.exists) {
      usersMessage.value = t('server.users.notFound', { email: inviteEmail.value })
      usersMessageType.value = 'error'
      return
    }
    if (data.owner) {
      usersMessage.value = t('server.users.isOwner', { email: data.email })
      usersMessageType.value = 'error'
      return
    }
    if (data.admin) {
      usersMessage.value = t('server.users.isAdmin', { email: data.email })
      usersMessageType.value = 'error'
      return
    }
    if (data.alreadyAdded) {
      usersMessage.value = t('server.users.alreadyAdded', { email: data.email })
      usersMessageType.value = 'error'
      return
    }
    lookupResult.value = data
    invitePerms.value = []
    inviteModal.value = true
  } catch (e) {
    if (deny(e)) return
    usersMessage.value = e.data?.message || t('server.users.lookupError')
    usersMessageType.value = 'error'
  } finally {
    lookingUp.value = false
  }
}

const loadUsers = async () => {
  loadingUsers.value = true
  try {
    const data = await $fetch(`/api/servers/${serverId.value}/users`)
    members.value = Array.isArray(data?.members) ? data.members : []
    permCatalog.value = Array.isArray(data?.catalog) ? data.catalog : []
    usersLoaded.value = true
  } catch (e) {
    if (deny(e)) return
    usersMessage.value = e.data?.message || t('server.users.loadError')
    usersMessageType.value = 'error'
  } finally {
    loadingUsers.value = false
  }
}

const inviteUser = async () => {
  inviting.value = true
  usersMessage.value = ''
  try {
    await $fetch(`/api/servers/${serverId.value}/users`, {
      method: 'POST',
      body: { email: inviteEmail.value, permissions: invitePerms.value },
    })
    usersMessage.value = t('server.users.added', { email: inviteEmail.value })
    usersMessageType.value = 'success'
    inviteEmail.value = ''
    invitePerms.value = []
    inviteModal.value = false
    lookupResult.value = null
    await loadUsers()
  } catch (e) {
    if (deny(e)) return
    usersMessage.value = e.data?.message || t('server.users.addError')
    usersMessageType.value = 'error'
  } finally {
    inviting.value = false
  }
}

const startEdit = (m) => {
  editingId.value = m.userId
  editPerms.value = [...(m.permissions || [])]
}

const savePerms = async (userId) => {
  savingPerms.value = true
  try {
    await $fetch(`/api/servers/${serverId.value}/users/${userId}`, {
      method: 'PUT',
      body: { permissions: editPerms.value },
    })
    usersMessage.value = t('server.users.permsSaved')
    usersMessageType.value = 'success'
    editingId.value = null
    await loadUsers()
  } catch (e) {
    if (deny(e)) return
    usersMessage.value = e.data?.message || t('server.users.permsError')
    usersMessageType.value = 'error'
  } finally {
    savingPerms.value = false
  }
}

const removeUser = async (userId, email) => {
  if (!(await confirmDialog({ message: t('server.users.removeConfirm', { email }), confirmText: t('server.users.remove'), danger: true }))) return
  try {
    await $fetch(`/api/servers/${serverId.value}/users/${userId}`, { method: 'DELETE' })
    usersMessage.value = t('server.users.removed', { email })
    usersMessageType.value = 'success'
    if (editingId.value === userId) editingId.value = null
    await loadUsers()
  } catch (e) {
    if (deny(e)) return
    usersMessage.value = e.data?.message || t('server.users.removeError')
    usersMessageType.value = 'error'
  }
}

const powerAction = async (action: string) => {  powerLoading.value = true
  try {
    await $fetch(`/api/servers/${serverId.value}/power`, {
      method: 'POST',
      body: { action }
    })
    // Оптимистичный статус — мгновенный отклик, точность доберёт опрос.
    liveStatus.value = action === 'stop' ? 'stopping' : action === 'restart' ? 'restarting' : 'starting'
    await refreshServer()
    await pollStatus()
    setTimeout(refreshServer, 2000)
  } catch (e) {
    if (!deny(e)) alert('Ошибка выполнения команды')
  } finally {
    powerLoading.value = false
  }
}

// Живой опрос статуса (inspect контейнера): источник правды для бейджа
// и консоли, независимо от сокета. Сокет мёртв ровно когда сервер выключен —
// без опроса страница бы навсегда застывала на протухшем статусе.
const pollStatus = async () => {
  if (liveStatus.value === 'installing') return
  try {
    const data = await $fetch(`/api/servers/${serverId.value}/status`)
    if (data?.status && data.status !== liveStatus.value) {
      liveStatus.value = data.status
    }
  } catch (e) {}
}

// Переустановка
const reinstallServer = async () => {
  if (!(await confirmDialog({ message: t('server.reinstall.confirm'), confirmText: t('server.reinstall.confirmBtn'), danger: true }))) return
   
  reinstalling.value = true
  reinstallMessage.value = ''
  
  try {
    await $fetch(`/api/servers/${serverId.value}/reinstall`, { method: 'POST' })
    reinstallMessage.value = t('server.reinstall.started')
    reinstallMessageType.value = 'success'
    liveStatus.value = 'installing'
    activeTab.value = 'install'
    await refreshServer()
  } catch (e: any) {
    reinstallMessage.value = e.data?.message || t('server.reinstall.error')
    reinstallMessageType.value = 'error'
  } finally {
    reinstalling.value = false
  }
}

const formatBytes = (bytes: number) => {
  if (!bytes || bytes === 0) return '0 B'
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`
}

const loadInstallLogs = async () => {
  if (liveStatus.value !== 'installing') return
  try {
    const logs = await $fetch(`/api/servers/${serverId.value}/install-logs`)
    if (Array.isArray(logs) && logs.length > 0) {
      installLogs.value = logs
    }
  } catch (e) {}
}

let resourcesInterval: NodeJS.Timeout
let logsInterval: NodeJS.Timeout
let statusInterval: NodeJS.Timeout

onMounted(() => {
  pollStatus()
  statusInterval = setInterval(pollStatus, 3000)
  if (server.value?.status === 'running') {
    liveStatus.value = 'running'
    fetchResources()
    resourcesInterval = setInterval(fetchResources, 1000)
  }
  if (server.value?.status === 'installing') {
    liveStatus.value = 'installing'
    activeTab.value = 'install'
    loadInstallLogs()
    logsInterval = setInterval(loadInstallLogs, 3000)
  }
})

onUnmounted(() => {
  clearInterval(resourcesInterval)
  clearInterval(logsInterval)
  clearInterval(statusInterval)
  clearInterval(backupsInterval)
})

watch(() => server.value?.status, (status) => {
  clearInterval(resourcesInterval)
  clearInterval(logsInterval)

  liveStatus.value = status

  if (status === 'running') {
    fetchResources()
    resourcesInterval = setInterval(fetchResources, 1000)
  }
  if (status === 'installing') {
    activeTab.value = 'install'
    loadInstallLogs()
    logsInterval = setInterval(loadInstallLogs, 3000)
  } else {
    if (activeTab.value === 'install') {
      activeTab.value = 'console'
    }
  }
})

// Живой статус — авторитет для счётчиков: сервер встал — качаем каждую
// секунду, потух — останавливаем опрос и делаем финальный замер (wings отдаёт
// нули CPU/RAM, но честный диск — он виден и у выключенного сервера).
watch(liveStatus, (status, prev) => {
  if (status === 'running') {
    fetchResources()
    clearInterval(resourcesInterval)
    resourcesInterval = setInterval(fetchResources, 1000)
  } else if (prev === 'running') {
    clearInterval(resourcesInterval)
    fetchResources()
  }
})

// Загружаем данные при переключении вкладок
watch(activeTab, (tab, prev) => {
  if (prev === 'backups' && backupsInterval) {
    clearInterval(backupsInterval)
    backupsInterval = undefined
  }
  if (tab === 'sftp' && !sftpData.value) loadSftp()
  if (tab === 'users' && !usersLoaded.value) loadUsers()
  if (tab === 'ports' && !portsLoaded.value) loadPorts()
  if (tab === 'backups' && (backups.value.length === 0 || backups.value.some((b) => b.status === 'creating'))) loadBackups()
  if (tab === 'databases' && databases.value.length === 0) {
    loadDatabases()
    loadDbHosts()
  }
  if (tab === 'schedules' && !schedulesLoaded.value) loadSchedules()
})

definePageMeta({
  layout: 'dashboard',
  auth: 'true'
})
</script>

<style scoped>
/* Круговые прогресс-бары */
.circular-progress {
  width: 75px;
  height: 75px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  box-shadow: inset 0 0 1px rgba(255,255,255,0.08), 0 4px 12px rgba(0,0,0,0.4);
}

.circular-inner {
  width: 68%;
  height: 68%;
  border-radius: 50%;
  background: rgba(13, 17, 23, 0.9);
  backdrop-filter: blur(3px);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.circular-value {
  font-weight: 600;
  font-size: 0.7rem;
  text-shadow: 0 2px 4px rgba(0,0,0,0.6);
  text-align: center;
  line-height: 1;
  max-width: 90%;
  word-break: break-all;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
.animate-spin {
  animation: spin 1s linear infinite;
}
</style>

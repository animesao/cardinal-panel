<template>
  <div class="space-y-4">
    <!-- Режим списка файлов -->
    <template v-if="!editingFile">
      <!-- Навигация и действия -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div class="flex items-center gap-2 text-sm">
          <button 
            @click="goUp" 
            :disabled="currentPath === '/'"
            class="text-white/40 hover:text-white/60 disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
          >
            <svg class="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <rect width="24" height="24" fill="none"/>
              <path fill="currentColor" d="M9.586 4L3 10.586a2 2 0 0 0 0 2.828L9.586 20a2 2 0 0 0 2.18.434l.145-.068A2 2 0 0 0 13 18.586V16h7a2 2 0 0 0 2-2v-4l-.005-.15A2 2 0 0 0 20 8l-7-.001V5.414A2 2 0 0 0 9.586 4"/>
            </svg>
          </button>
          <div class="flex items-center gap-1 text-white/60 truncate">
            <button @click="goToPath('/')" class="hover:text-white/90 flex-shrink-0">~</button>
            <template v-for="(part, i) in pathParts" :key="i">
              <span class="text-white/30 flex-shrink-0">/</span>
              <button @click="goToPath('/' + pathParts.slice(0, i + 1).join('/'))" class="hover:text-white/90 truncate">
                {{ part }}
              </button>
            </template>
          </div>
        </div>
        
        <div class="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          <button 
            @click="refresh"
            class="text-white/40 hover:text-white/60 p-1.5 sm:p-2"
            :title="$t('common.refresh')"
          >
            <svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <rect width="24" height="24" fill="none"/>
              <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
                <path d="M19.933 13.041a8 8 0 1 1-9.925-8.788c3.899-1 7.935 1.007 9.425 4.747"/>
                <path d="M20 4v5h-5"/>
              </g>
            </svg>
          </button>
          <button 
            @click="showNewFolderModal = true"
            class="bg-white/5 hover:bg-white/10 text-white/70 border border-white/10 px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm transition-all flex items-center gap-1"
          >
            <svg class="w-3.5 h-3.5 sm:w-4 sm:h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <rect width="24" height="24" fill="none"/>
              <path fill="currentColor" d="M9 3a1 1 0 0 1 .608.206l.1.087L12.414 6H19a3 3 0 0 1 2.995 2.824L22 9v8a3 3 0 0 1-2.824 2.995L19 20H5a3 3 0 0 1-2.995-2.824L2 17V6a3 3 0 0 1 2.824-2.995L5 3z"/>
            </svg>
            <span class="hidden sm:inline">{{ $t('files.newFolder') }}</span>
          </button>
          <button 
            @click="showNewFileModal = true"
            class="bg-white/5 hover:bg-white/10 text-white/70 border border-white/10 px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm transition-all flex items-center gap-1"
          >
            <svg class="w-3.5 h-3.5 sm:w-4 sm:h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <rect width="24" height="24" fill="none"/>
              <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <path d="M14 2v6h6M12 18v-6M9 15h6"/>
              </g>
            </svg>
            <span class="hidden sm:inline">{{ $t('files.newFile') }}</span>
          </button>
          
          <div class="relative" v-click-outside="closeDropdown">
            <button 
              @click="showUploadDropdown = !showUploadDropdown"
              class="bg-emerald-300 hover:bg-emerald-200 text-black border border-transparent px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm transition-all flex items-center gap-1"
            >
              <svg class="w-3.5 h-3.5 sm:w-4 sm:h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <rect width="24" height="24" fill="none"/>
                <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2M7 9l5-5l5 5m-5-5v12"/>
              </svg>
              <span class="hidden sm:inline">{{ $t('files.upload') }}</span>
              <svg class="w-3 h-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <rect width="24" height="24" fill="none"/>
                <path fill="currentColor" d="m9 5l-.117.007A1 1 0 0 0 8 6v4.999L5.414 11A2 2 0 0 0 4 14.414L10.586 21a2 2 0 0 0 2.828 0L20 14.414a2 2 0 0 0 .434-2.18l-.068-.145A2 2 0 0 0 18.586 11L16 10.999V6a1 1 0 0 0-1-1zm6-3a1 1 0 0 1 .117 1.993L15 4H9a1 1 0 0 1-.117-1.993L9 2z"/>
              </svg>
            </button>
            <div 
              v-if="showUploadDropdown"
              class="kt-menu absolute right-0 top-full mt-1 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-lg overflow-hidden z-10 min-w-[160px]"
            >
              <button 
                @click="selectFiles"
                class="w-full text-left px-4 py-2.5 text-sm text-white/80 hover:bg-white/10 transition-all flex items-center gap-2"
              >
                <svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                  <rect width="24" height="24" fill="none"/>
                  <g fill="currentColor">
                    <path d="m12 2l.117.007a1 1 0 0 1 .876.876L13 3v4l.005.15a2 2 0 0 0 1.838 1.844L15 9h4l.117.007a1 1 0 0 1 .876.876L20 10v9a3 3 0 0 1-2.824 2.995L17 22H7a3 3 0 0 1-2.995-2.824L4 19V5a3 3 0 0 1 2.824-2.995L7 2z"/>
                    <path d="M19 7h-4l-.001-4.001z"/>
                  </g>
                </svg>
                {{ $t('files.uploadFiles') }}
              </button>
              <button 
                @click="selectFolder"
                class="w-full text-left px-4 py-2.5 text-sm text-white/80 hover:bg-white/10 transition-all flex items-center gap-2 border-t border-white/5"
              >
                <svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                  <rect width="24" height="24" fill="none"/>
                  <path fill="currentColor" d="M9 3a1 1 0 0 1 .608.206l.1.087L12.414 6H19a3 3 0 0 1 2.995 2.824L22 9v8a3 3 0 0 1-2.824 2.995L19 20H5a3 3 0 0 1-2.995-2.824L2 17V6a3 3 0 0 1 2.824-2.995L5 3z"/>
                </svg>
                {{ $t('files.uploadFolder') }}
              </button>
            </div>
          </div>
          
          <input type="file" ref="fileInput" @change="uploadFiles" class="hidden" multiple />
          <input type="file" ref="folderInput" @change="uploadFiles" class="hidden" webkitdirectory />
        </div>
      </div>

      <!-- Панель массовых действий -->
      <div v-if="selectedFiles.size > 0" class="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-white/5 rounded-lg border border-white/10 flex-wrap">
        <span class="text-xs sm:text-sm text-white/60">{{ $t('files.selected') }}: {{ selectedFiles.size }}</span>
        <button @click="selectAll" class="text-xs text-emerald-300 hover:text-emerald-200">{{ $t('files.selectAll') }}</button>
        <button @click="clearSelection" class="text-xs text-white/40 hover:text-white/60">{{ $t('files.reset') }}</button>
        <button @click="downloadSelected" :disabled="downloadingArchive" class="ml-auto bg-emerald-300 hover:bg-emerald-200 text-black border border-transparent px-2 sm:px-3 py-1 rounded-lg text-xs sm:text-sm transition-all flex items-center gap-1 disabled:opacity-50">
          <span v-if="downloadingArchive" class="w-3.5 h-3.5 sm:w-4 sm:h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"></span>
          <svg v-else class="w-3.5 h-3.5 sm:w-4 sm:h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
            <rect width="24" height="24" fill="none"/>
            <path fill="currentColor" d="M20 16a1 1 0 0 1 1 1v2a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-2a1 1 0 0 1 2 0v2a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2a1 1 0 0 1 1-1M12 3a1 1 0 0 1 1 1v9.585l3.293-3.292a1 1 0 0 1 1.414 1.414l-5 5a1 1 0 0 1-.09.08l.09-.08a1 1 0 0 1-.674.292L12 17h-.032l-.054-.004L12 17a1 1 0 0 1-.617-.213a1 1 0 0 1-.09-.08l-5-5a1 1 0 0 1 1.414-1.414L11 13.585V4a1 1 0 0 1 1-1"/>
          </svg>
          <span class="hidden sm:inline">{{ downloadingArchive ? $t('files.archiving') : $t('files.downloadArchive') }}</span>
        </button>
        <button @click="deleteSelected" class="bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 px-2 sm:px-3 py-1 rounded-lg text-xs sm:text-sm transition-all flex items-center gap-1">
          <svg class="w-3.5 h-3.5 sm:w-4 sm:h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
            <rect width="24" height="24" fill="none"/>
            <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7h16m-10 4v6m4-6v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"/>
          </svg>
          <span class="hidden sm:inline">{{ $t('files.delete') }}</span>
        </button>
      </div>

      <!-- Список файлов -->
      <div v-if="loading" class="text-center py-12">
        <div class="w-8 h-8 mx-auto border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
        <p class="text-white/40 mt-4 text-sm">{{ $t('files.loading') }}</p>
      </div>

      <div v-else-if="error" class="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
        <p class="text-red-400 text-sm">{{ error }}</p>
      </div>

      <div v-else class="border border-white/10 rounded-lg overflow-x-auto">
        <table class="w-full text-xs sm:text-sm">
          <thead class="bg-white/5 border-b border-white/10">
            <tr>
              <th class="w-8 sm:w-10 py-2 sm:py-3 px-2 sm:px-4"><UiToggle :model-value="allSelected" @change="toggleAll" small /></th>
              <th class="text-left py-2 sm:py-3 px-2 sm:px-4 text-white/40 font-medium">{{ $t('files.name') }}</th>
              <th class="text-left py-2 sm:py-3 px-2 sm:px-4 text-white/40 font-medium w-20 sm:w-24 hidden sm:table-cell">{{ $t('files.size') }}</th>
              <th class="text-left py-2 sm:py-3 px-2 sm:px-4 text-white/40 font-medium w-36 sm:w-40 hidden md:table-cell">{{ $t('files.modified') }}</th>
              <th class="text-left py-2 sm:py-3 px-2 sm:px-4 text-white/40 font-medium w-32 sm:w-40"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="file in files" :key="file.name" @contextmenu.prevent="openCtx(file, $event)" class="border-b border-white/5 hover:bg-white/5 transition-colors group" :class="{ 'bg-emerald-300/5': selectedFiles.has(file.name) }">
              <td class="py-2 sm:py-3 px-2 sm:px-4"><UiToggle :model-value="selectedFiles.has(file.name)" @change="toggleSelect(file)" small /></td>
              <td class="py-2 sm:py-3 px-2 sm:px-4">
                <div class="flex items-center gap-1.5 sm:gap-2 cursor-pointer" @dblclick="file.directory ? enterDirectory(file.name) : openEditor(file.name)">
                  <svg v-if="file.directory" class="w-4 h-4 sm:w-5 sm:h-5 text-emerald-300 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" fill="none"/><path fill="currentColor" d="M9 3a1 1 0 0 1 .608.206l.1.087L12.414 6H19a3 3 0 0 1 2.995 2.824L22 9v8a3 3 0 0 1-2.824 2.995L19 20H5a3 3 0 0 1-2.995-2.824L2 17V6a3 3 0 0 1 2.824-2.995L5 3z"/></svg>
                  <svg v-else-if="isImage(file.name)" class="w-4 h-4 sm:w-5 sm:h-5 text-green-400 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" fill="none"/><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M15 8h.01M3 6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3z"/><path d="m3 16l5-5c.928-.893 2.072-.893 3 0l5 5"/><path d="m14 14l1-1c.928-.893 2.072-.893 3 0l3 3"/></g></svg>
                  <svg v-else-if="isArchive(file.name)" class="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" fill="none"/><path fill="currentColor" d="M2 5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2m17 4c.513 0 .936.463.993 1.06l.007.14v7.2c0 1.917-1.249 3.484-2.824 3.594L17 21H7c-1.598 0-2.904-1.499-2.995-3.388L4 17.4v-7.2C4 9.537 4.448 9 5 9zm-5 2h-4l-.117.007a1 1 0 0 0 0 1.986L10 13h4l.117-.007a1 1 0 0 0 0-1.986z"/></svg>
                  <svg v-else-if="isCode(file.name)" class="w-4 h-4 sm:w-5 sm:h-5 text-purple-400 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" fill="none"/><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M7 7H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-1"/><path d="M20.385 6.585a2.1 2.1 0 0 0-2.97-2.97L9 12v3h3zM16 5l3 3"/></g></svg>
                  <svg v-else class="w-4 h-4 sm:w-5 sm:h-5 text-white/60 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" fill="none"/><g fill="currentColor"><path d="m12 2l.117.007a1 1 0 0 1 .876.876L13 3v4l.005.15a2 2 0 0 0 1.838 1.844L15 9h4l.117.007a1 1 0 0 1 .876.876L20 10v9a3 3 0 0 1-2.824 2.995L17 22H7a3 3 0 0 1-2.995-2.824L4 19V5a3 3 0 0 1 2.824-2.995L7 2z"/><path d="M19 7h-4l-.001-4.001z"/></g></svg>
                  <span :class="file.directory ? 'text-emerald-300 hover:underline' : 'text-white/80'" class="truncate max-w-[120px] sm:max-w-[200px] lg:max-w-[300px]">{{ file.name }}</span>
                </div>
              </td>
              <td class="py-2 sm:py-3 px-2 sm:px-4 text-white/60 hidden sm:table-cell">{{ file.directory ? '—' : formatBytes(file.size) }}</td>
              <td class="py-2 sm:py-3 px-2 sm:px-4 text-white/60 hidden md:table-cell">{{ formatDate(file.modified) }}</td>
              <td class="py-2 sm:py-3 px-2 sm:px-4">
                <div class="flex items-center gap-0.5 sm:gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button @click="chmodFileInt(file)" class="text-orange-400 hover:text-orange-300 p-1" :title="$t('files.rights')"><svg class="w-3.5 h-3.5 sm:w-4 sm:h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" fill="none"/><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2l4-4m5.618-4.016A11.955 11.955 0 0 1 12 2.944a11.955 11.955 0 0 1-8.618 3.04A12.02 12.02 0 0 0 3 9c0 5.591 3.824 10.29 9 11.622c5.176-1.332 9-6.03 9-11.622c0-1.042-.133-2.052-.382-3.016z"/></svg></button>
                  <button v-if="!file.directory" @click="openEditor(file.name)" class="text-green-400 hover:text-green-300 p-1" :title="$t('files.editFile')"><svg class="w-3.5 h-3.5 sm:w-4 sm:h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" fill="none"/><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M7 7H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-1"/><path d="M20.385 6.585a2.1 2.1 0 0 0-2.97-2.97L9 12v3h3zM16 5l3 3"/></g></svg></button>
                  <button v-if="!file.directory" @click="downloadFile(file.name)" class="text-emerald-300 hover:text-emerald-200 p-1" :title="$t('files.download')"><svg class="w-3.5 h-3.5 sm:w-4 sm:h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" fill="none"/><path fill="currentColor" d="M20 16a1 1 0 0 1 1 1v2a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-2a1 1 0 0 1 2 0v2a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2a1 1 0 0 1 1-1M12 3a1 1 0 0 1 1 1v9.585l3.293-3.292a1 1 0 0 1 1.414 1.414l-5 5a1 1 0 0 1-.09.08l.09-.08a1 1 0 0 1-.674.292L12 17h-.032l-.054-.004L12 17a1 1 0 0 1-.617-.213a1 1 0 0 1-.09-.08l-5-5a1 1 0 0 1 1.414-1.414L11 13.585V4a1 1 0 0 1 1-1"/></svg></button>
                  <button v-if="file.directory" @click="archiveDir(file.name)" class="text-emerald-300 hover:text-emerald-200 p-1" :title="$t('files.downloadArchive')"><svg class="w-3.5 h-3.5 sm:w-4 sm:h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="5" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/></svg></button>
                  <button @click="renameFile(file)" class="text-yellow-400 hover:text-yellow-300 p-1" :title="$t('files.rename')"><svg class="w-3.5 h-3.5 sm:w-4 sm:h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" fill="none"/><path fill="currentColor" d="m12.085 6.5l5.415 5.415l-8.793 8.792A1 1 0 0 1 8 21H4a1 1 0 0 1-1-1v-4a1 1 0 0 1 .293-.707zm5.406-2.698a3.828 3.828 0 0 1 1.716 6.405l-.292.293L13.5 5.085l.293-.292a3.83 3.83 0 0 1 3.698-.991"/></svg></button>
                  <button @click="deleteFile(file.name)" class="text-red-400 hover:text-red-300 p-1" :title="$t('files.delete')"><svg class="w-3.5 h-3.5 sm:w-4 sm:h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" fill="none"/><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7h16m-10 4v6m4-6v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"/></svg></button>
                </div>
              </td>
            </tr>
            <tr v-if="files.length === 0"><td colspan="5" class="text-center py-12 text-white/40 text-sm">{{ $t('files.empty') }}</td></tr>
          </tbody>
        </table>
      </div>

      <!-- Контекстное меню (правая кнопка по файлу/папке) -->
      <Teleport to="body">
        <div
          v-if="ctxOpen"
          class="kt-menu fixed z-[100] w-56 rounded-xl border border-white/15 bg-[#161616] shadow-xl shadow-black/60 py-1.5"
          :style="{ left: ctxX + 'px', top: ctxY + 'px' }"
          @click.stop
        >
          <p class="px-3.5 pt-1.5 pb-1 text-[11px] text-white/35 truncate font-mono">{{ ctxFile?.name }}</p>
          <button
            @click="ctxAction('open')"
            class="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors text-left"
          >
            <UiIcon :name="ctxFile?.directory ? 'folder-open' : 'pencil'" class="w-4 h-4 text-emerald-300 flex-shrink-0" />
            {{ ctxFile?.directory ? $t('files.open') : $t('files.editFile') }}
          </button>
          <button
            @click="ctxAction('download')"
            class="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors text-left"
          >
            <UiIcon name="download" class="w-4 h-4 text-emerald-300 flex-shrink-0" />
            {{ ctxFile?.directory ? $t('files.downloadZip') : $t('files.download') }}
          </button>
          <button
            @click="ctxAction('rename')"
            class="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors text-left"
          >
            <UiIcon name="pencil" class="w-4 h-4 text-white/50 flex-shrink-0" />
            {{ $t('files.rename') }}
          </button>
          <button
            @click="ctxAction('chmod')"
            class="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors text-left"
          >
            <UiIcon name="shield" class="w-4 h-4 text-white/50 flex-shrink-0" />
            {{ $t('files.rights') }}
          </button>
          <div class="my-1 border-t border-white/10" />
          <button
            @click="ctxAction('delete')"
            class="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors text-left"
          >
            <UiIcon name="trash" class="w-4 h-4 flex-shrink-0" />
            {{ $t('files.delete') }}
          </button>
        </div>
      </Teleport>

      <!-- Модалки: в body, чтобы всегда были строго по центру экрана,
           а не относительно прокрученного списка файлов -->
      <Teleport to="body">
      <div v-if="showNewFolderModal" class="fixed inset-0 z-[110] flex items-center justify-center p-4" @click.self="showNewFolderModal = false">
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm kt-fade-in"></div>
        <div class="kt-pop relative bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 w-full max-w-md">
          <h3 class="text-xl font-bold text-white mb-4">{{ $t('files.newFolder') }}</h3>
          <input v-model="newFolderName" type="text" :placeholder="$t('files.newFolder')" class="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 text-white mb-4" @keyup.enter="createFolder" />
          <div class="flex gap-3"><button @click="showNewFolderModal = false" class="flex-1 bg-white/5 hover:bg-white/10 text-white/70 rounded-lg px-4 py-2.5">{{ $t('files.cancel') }}</button><button @click="createFolder" class="flex-1 bg-emerald-300 hover:bg-emerald-200 text-black border border-transparent rounded-lg px-4 py-2.5">{{ $t('files.create') }}</button></div>
        </div>
      </div>

      <div v-if="showNewFileModal" class="fixed inset-0 z-[110] flex items-center justify-center p-4" @click.self="showNewFileModal = false">
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm kt-fade-in"></div>
        <div class="kt-pop relative bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 w-full max-w-md">
          <h3 class="text-xl font-bold text-white mb-4">{{ $t('files.newFile') }}</h3>
          <input v-model="newFileName" type="text" :placeholder="$t('files.newFile')" class="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 text-white mb-4" @keyup.enter="createFile" />
          <div class="flex gap-3"><button @click="showNewFileModal = false" class="flex-1 bg-white/5 hover:bg-white/10 text-white/70 rounded-lg px-4 py-2.5">{{ $t('files.cancel') }}</button><button @click="createFile" class="flex-1 bg-emerald-300 hover:bg-emerald-200 text-black border border-transparent rounded-lg px-4 py-2.5">{{ $t('files.create') }}</button></div>
        </div>
      </div>

      <div v-if="showRenameModal" class="fixed inset-0 z-[110] flex items-center justify-center p-4" @click.self="showRenameModal = false">
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm kt-fade-in"></div>
        <div class="kt-pop relative bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 w-full max-w-md">
          <h3 class="text-xl font-bold text-white mb-4">{{ $t('files.rename') }}</h3>
          <input v-model="renameNewName" type="text" class="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 text-white mb-4" @keyup.enter="confirmRename" />
          <div class="flex gap-3"><button @click="showRenameModal = false" class="flex-1 bg-white/5 hover:bg-white/10 text-white/70 rounded-lg px-4 py-2.5">{{ $t('files.cancel') }}</button><button @click="confirmRename" class="flex-1 bg-emerald-300 hover:bg-emerald-200 text-black border border-transparent rounded-lg px-4 py-2.5">{{ $t('files.rename') }}</button></div>
        </div>
      </div>

      <div v-if="showChmodModal" class="fixed inset-0 z-[110] flex items-center justify-center p-4" @click.self="showChmodModal = false">
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm kt-fade-in"></div>
        <div class="kt-pop relative bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 w-full max-w-sm">
          <h3 class="text-xl font-bold text-white mb-4">{{ $t('files.rights') }}: {{ chmodTarget?.name }}</h3>
          <div class="mb-4"><label class="block text-sm text-white/60 mb-2">644</label><input v-model="chmodValue" type="text" maxlength="3" placeholder="755" class="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 text-white text-center text-2xl font-mono" /></div>
          <div v-if="chmodError" class="text-red-400 text-sm text-center bg-red-500/10 py-2 rounded-lg mb-3">{{ chmodError }}</div>
          <div class="flex gap-3"><button @click="showChmodModal = false" class="flex-1 bg-white/5 hover:bg-white/10 text-white/70 rounded-lg px-4 py-2.5">{{ $t('files.cancel') }}</button><button @click="applyChmod" :disabled="chmodLoading" class="flex-1 bg-emerald-300 hover:bg-emerald-200 text-black border border-transparent rounded-lg px-4 py-2.5 font-medium disabled:opacity-50">{{ chmodLoading ? $t('files.applying') : $t('files.apply') }}</button></div>
        </div>
      </div>
      </Teleport>
    </template>

    <!-- Режим редактирования -->
    <template v-else>
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-3">
          <button @click="closeEditor" class="text-white/40 hover:text-white/60 p-1" :title="$t('files.backTitle')"><svg class="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" fill="none"/><path fill="currentColor" d="M9.586 4L3 10.586a2 2 0 0 0 0 2.828L9.586 20a2 2 0 0 0 2.18.434l.145-.068A2 2 0 0 0 13 18.586V16h7a2 2 0 0 0 2-2v-4l-.005-.15A2 2 0 0 0 20 8l-7-.001V5.414A2 2 0 0 0 9.586 4"/></svg></button>
          <div><h3 class="text-lg font-medium text-white">{{ $t('files.editFile') }}: <span class="text-emerald-300">{{ editingFile }}</span></h3><p class="text-xs text-white/40">{{ editingFilePath }}</p></div>
        </div>
        <div class="flex items-center gap-2">
          <span v-if="fileSaved" class="text-xs text-green-400 bg-green-500/10 px-2 py-1 rounded">{{ $t('files.saved') }}</span>
          <span v-if="fileError" class="text-xs text-red-400 bg-red-500/10 px-2 py-1 rounded">{{ fileError }}</span>
          <button @click="saveEditor" :disabled="savingFile" class="bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 flex items-center gap-1">
            <svg v-if="savingFile" class="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" fill="none"/><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6l2.1 2.1m0-12.8l-2.1 2.1M7.7 16.3l-2.1 2.1"/></svg>
            <svg v-else class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" fill="none"/><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
            {{ savingFile ? $t('files.saving') : $t('files.save') }}
          </button>
        </div>
      </div>
      <div v-if="editorLoading" class="w-full min-h-[400px] sm:min-h-[600px] bg-[#0a0a0a] border border-white/10 rounded-lg flex items-center justify-center">
        <div class="flex items-center gap-2 text-white/40 text-sm">
          <span class="w-4 h-4 border-2 border-emerald-300/30 border-t-emerald-300 rounded-full animate-spin"></span>
          {{ $t('files.editorLoading') }}
        </div>
      </div>
      <textarea
        v-else-if="usePlainEditor"
        v-model="fileContent"
        class="w-full min-h-[400px] sm:min-h-[600px] bg-[#0a0a0a] border border-white/10 rounded-lg p-4 sm:p-5 text-white font-mono text-sm resize-none focus:outline-none focus:border-emerald-300/50 leading-relaxed"
        @keydown="onEditorKeydown"
        spellcheck="false"
      />
      <div v-show="!editorLoading && !usePlainEditor" ref="monacoEl" class="w-full h-[400px] sm:h-[600px] bg-[#0a0a0a] border border-white/10 rounded-lg overflow-hidden" />
      <div class="flex items-center justify-between mt-3 text-xs text-white/30"><span class="truncate">{{ editingFilePath }} • {{ editorLangLabel }}</span><span class="flex-shrink-0 ml-2">{{ editorLines }} {{ $t('files.lines') }} • {{ editorChars }} {{ $t('files.chars') }}</span></div>
    </template>

    <!-- Прогресс загрузки -->
    <div v-if="uploads.length > 0" class="space-y-2">
      <div v-for="upload in uploads" :key="upload.name" class="bg-white/5 rounded-lg p-3">
        <div class="flex items-center justify-between text-sm mb-1"><span class="text-white/80 truncate">{{ upload.name }}</span><span class="text-white/40 flex-shrink-0 ml-2">{{ upload.progress }}%</span></div>
        <div class="w-full h-2 bg-white/10 rounded-full overflow-hidden"><div class="h-full bg-emerald-300 rounded-full transition-all" :style="{ width: `${upload.progress}%` }" /></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// @ts-nocheck
const props = defineProps<{ serverId: number }>()

const { t } = useI18n()

const currentPath = ref('/')
const files = ref<any[]>([])
const loading = ref(false)
const error = ref('')
const selectedFiles = ref<Set<string>>(new Set())
const uploads = ref<any[]>([])
const fileInput = ref<HTMLInputElement>()
const folderInput = ref<HTMLInputElement>()

const showUploadDropdown = ref(false)
const showNewFolderModal = ref(false)
const newFolderName = ref('')
const showNewFileModal = ref(false)
const newFileName = ref('')
const showRenameModal = ref(false)
const renameOldName = ref('')
const renameNewName = ref('')
const editingFile = ref('')
const editingFilePath = ref('')
const fileContent = ref('')
const savingFile = ref(false)

// Monaco (VS Code) редактор: грузится лениво, только при открытии файла.
// Фолбэк на textarea: файлы >2МБ и ошибка загрузки движка.
const monacoEl = ref<HTMLElement>()
let monacoNS = null
let monacoEditor = null
let monacoSetup = false
const editorLoading = ref(false)
const usePlainEditor = ref(false)
const editorLangLabel = ref('')
const editorLines = ref(0)
const editorChars = ref(0)

const langForFile = (name: string): { id: string; label: string } => {
  const ext = String(name || '').split('.').pop()?.toLowerCase() || ''
  const map: Record<string, [string, string]> = {
    yml: ['yaml', 'YAML'], yaml: ['yaml', 'YAML'],
    json: ['json', 'JSON'],
    js: ['javascript', 'JavaScript'], mjs: ['javascript', 'JavaScript'], cjs: ['javascript', 'JavaScript'],
    ts: ['typescript', 'TypeScript'],
    py: ['python', 'Python'],
    java: ['java', 'Java'],
    sh: ['shell', 'Shell'], bash: ['shell', 'Shell'],
    xml: ['xml', 'XML'], html: ['html', 'HTML'], htm: ['html', 'HTML'],
    css: ['css', 'CSS'],
    md: ['markdown', 'Markdown'],
    sql: ['sql', 'SQL'],
    toml: ['ini', 'TOML'], cfg: ['ini', 'INI'], conf: ['ini', 'INI'],
    ini: ['ini', 'INI'], properties: ['ini', 'Properties'],
    log: ['plaintext', 'Text'], txt: ['plaintext', 'Text'],
  }
  const hit = map[ext]
  return hit ? { id: hit[0], label: hit[1] } : { id: 'plaintext', label: 'Text' }
}

const ensureMonaco = async () => {
  if (monacoNS) return monacoNS
  const mod = await import('monaco-editor')
  if (!monacoSetup) {
    monacoSetup = true
    try {
      // Относительный путь в обход exports-map пакета (?worker не матчится
      // в сабпаты — сборщик падает на этапе резолва, а не в рантайме).
      const workerMod = await import('../../node_modules/monaco-editor/esm/vs/editor/editor.worker.js?worker')
      const EditorWorker = workerMod.default || workerMod
      self.MonacoEnvironment = { getWorker: () => new EditorWorker() }
    } catch {}
  }
  monacoNS = mod
  return mod
}

const refreshEditorStats = () => {
  const model = monacoEditor?.getModel?.()
  if (!model) {
    const text = fileContent.value || ''
    editorLines.value = text ? text.split('\n').length : 0
    editorChars.value = text.length
    return
  }
  editorLines.value = model.getLineCount()
  editorChars.value = model.getValueLength()
}

const openMonaco = async (text: string) => {
  editorLoading.value = true
  try {
    // Огромные файлы (логи!) в Monaco тормозят — правим как текст.
    if ((text || '').length > 2 * 1024 * 1024) {
      usePlainEditor.value = true
      fileContent.value = text
      refreshEditorStats()
      return
    }
    usePlainEditor.value = false
    const monaco = await ensureMonaco()
    await nextTick()
    const lang = langForFile(editingFile.value)
    editorLangLabel.value = lang.label
    if (!monacoEditor) {
      monacoEditor = monaco.editor.create(monacoEl.value, {
        theme: 'vs-dark',
        fontSize: 13,
        fontFamily: "'JetBrains Mono', Consolas, 'Courier New', monospace",
        minimap: { enabled: true, scale: 1 },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        padding: { top: 12 },
        renderLineHighlight: 'all',
        smoothScrolling: true,
        cursorBlinking: 'smooth',
        stickyScroll: { enabled: false },
      })
      monacoEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => saveEditor())
      monacoEditor.onDidChangeModelContent(() => {
        fileSaved.value = false
        refreshEditorStats()
      })
    } else {
      await nextTick()
      monacoEditor.layout()
    }
    const model = monaco.editor.createModel(text || '', lang.id)
    try { monacoEditor.getModel()?.dispose?.() } catch {}
    monacoEditor.setModel(model)
    monacoEditor.setScrollTop(0)
    refreshEditorStats()
  } catch (e) {
    usePlainEditor.value = true
    fileContent.value = text
    refreshEditorStats()
  } finally {
    editorLoading.value = false
  }
}

const closeMonaco = () => {
  try {
    monacoEditor?.getModel?.()?.dispose?.()
  } catch {}
  monacoEditor = null
  editorLangLabel.value = ''
  editorLines.value = 0
  editorChars.value = 0
}
const fileSaved = ref(false)
const fileError = ref('')

const showChmodModal = ref(false)
const chmodTarget = ref<any>(null)
const chmodValue = ref('644')
const chmodLoading = ref(false)
const chmodError = ref('')

const pathParts = computed(() => currentPath.value.split('/').filter(p => p))
const allSelected = computed(() => files.value.length > 0 && files.value.every(f => selectedFiles.value.has(f.name)))

const closeDropdown = () => { showUploadDropdown.value = false }
const selectFiles = () => { showUploadDropdown.value = false; fileInput.value?.click() }
const selectFolder = () => { showUploadDropdown.value = false; folderInput.value?.click() }

const loadFiles = async () => {
  loading.value = true; error.value = ''
  try {
    const data = await $fetch(`/api/servers/${props.serverId}/files`, { params: { path: currentPath.value } })
    // Как в Pterodactyl: сначала папки, затем файлы, внутри групп — по имени.
    files.value = (data || []).sort((a, b) => {
      const da = a?.directory ? 0 : 1
      const db = b?.directory ? 0 : 1
      if (da !== db) return da - db
      return String(a?.name || '').localeCompare(String(b?.name || ''), 'ru', { numeric: true })
    })
    clearSelection()
  }
  catch (e: any) { if (deny(e)) error.value = ''; else error.value = e.data?.message || t('files.errLoad') }
  finally { loading.value = false }
}

const refresh = () => loadFiles()
const enterDirectory = (name: string) => { currentPath.value = currentPath.value === '/' ? `/${name}` : `${currentPath.value}/${name}`; loadFiles() }
const goUp = () => { if (currentPath.value === '/') return; const parts = currentPath.value.split('/').filter(p => p); parts.pop(); currentPath.value = parts.length === 0 ? '/' : '/' + parts.join('/'); loadFiles() }
const goToPath = (path: string) => { currentPath.value = path; loadFiles() }
const toggleSelect = (file: any) => { if (selectedFiles.value.has(file.name)) selectedFiles.value.delete(file.name); else selectedFiles.value.add(file.name) }
const toggleAll = () => allSelected.value ? clearSelection() : selectAll()
const selectAll = () => files.value.forEach(f => selectedFiles.value.add(f.name))
const clearSelection = () => selectedFiles.value.clear()
const downloadFile = (name: string) => { const path = currentPath.value === '/' ? `/${name}` : `${currentPath.value}/${name}`; window.open(`/api/servers/${props.serverId}/files/download?path=${encodeURIComponent(path)}`) }
const archiveDir = (name: string) => { const path = currentPath.value === '/' ? `/${name}` : `${currentPath.value}/${name}`; window.open(`/api/servers/${props.serverId}/files/archive?path=${encodeURIComponent(path)}`) }
const downloadingArchive = ref(false)

// Скачивание выделенного одним архивом: один файл качается как есть,
// всё остальное (несколько файлов, папки, смесь) упаковывается
// в .zip через POST /files/archive.
const downloadSelected = async () => {
  const names = [...selectedFiles.value]
  if (!names.length || downloadingArchive.value) return
  const paths = names.map(n => currentPath.value === '/' ? `/${n}` : `${currentPath.value}/${n}`)
  if (paths.length === 1) {
    const f = files.value.find(x => x.name === names[0])
    if (f && !f.directory) { downloadFile(names[0]); return }
  }
  downloadingArchive.value = true
  try {
    const r = await fetch(`/api/servers/${props.serverId}/files/archive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths }),
    })
    if (!r.ok) {
      let msg = t('files.errArchive')
      try { const j = await r.json(); msg = j?.message || j?.data?.message || msg } catch {}
      throw new Error(msg)
    }
    const blob = await r.blob()
    let fileName = `archive-${paths.length}-files.zip`
    const m = (r.headers.get('content-disposition') || '').match(/filename="([^"]+)"/)
    if (m) fileName = m[1]
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    setTimeout(() => { URL.revokeObjectURL(url); a.remove() }, 1000)
  } catch (e: any) {
    if (!deny(e)) alert(e?.data?.message || e?.message || t('files.errArchive'))
  } finally {
    downloadingArchive.value = false
  }
}

// Контекстное меню по правому клику: те же действия, что в строке и в
// массовом выделении (открыть/скачать/архив/переименовать/права/удалить).
const ctxOpen = ref(false)
const ctxFile = ref<any>(null)
const ctxX = ref(0)
const ctxY = ref(0)

const openCtx = (file: any, e: MouseEvent) => {
  ctxFile.value = file
  const w = 224
  const h = file.directory ? 250 : 214
  ctxX.value = Math.max(8, Math.min(e.clientX, window.innerWidth - w - 8))
  ctxY.value = Math.max(8, Math.min(e.clientY, window.innerHeight - h - 8))
  ctxOpen.value = true
}

const closeCtx = () => { ctxOpen.value = false }

const ctxAction = (action: string) => {
  const file = ctxFile.value
  closeCtx()
  if (!file) return
  switch (action) {
    case 'open':
      file.directory ? enterDirectory(file.name) : openEditor(file.name)
      break
    case 'download':
      file.directory ? archiveDir(file.name) : downloadFile(file.name)
      break
    case 'rename':
      renameFile(file)
      break
    case 'chmod':
      chmodFileInt(file)
      break
    case 'delete':
      deleteFile(file.name)
      break
  }
}

watch(ctxOpen, (v) => {
  if (v) {
    document.addEventListener('click', closeCtx)
    window.addEventListener('blur', closeCtx)
    window.addEventListener('resize', closeCtx)
  } else {
    document.removeEventListener('click', closeCtx)
    window.removeEventListener('blur', closeCtx)
    window.removeEventListener('resize', closeCtx)
  }
})

onUnmounted(() => {
  document.removeEventListener('click', closeCtx)
  window.removeEventListener('blur', closeCtx)
  window.removeEventListener('resize', closeCtx)
})
const deleteFile = async (name: string) => { if (!(await confirmDialog({ message: t('files.confirmDeleteOne', { name }), confirmText: t('files.delete'), danger: true }))) return; const path = currentPath.value === '/' ? `/${name}` : `${currentPath.value}/${name}`; try { await $fetch(`/api/servers/${props.serverId}/files`, { method: 'DELETE', body: { path } }); loadFiles() } catch (e: any) { if (!deny(e)) alert(e.data?.message || t('files.errDelete')) } }
const deleteSelected = async () => { if (!(await confirmDialog({ message: t('files.confirmDeleteMany', { count: selectedFiles.value.size }), confirmText: t('files.delete'), danger: true }))) return; for (const name of selectedFiles.value) { const path = currentPath.value === '/' ? `/${name}` : `${currentPath.value}/${name}`; try { await $fetch(`/api/servers/${props.serverId}/files`, { method: 'DELETE', body: { path } }) } catch (e) {} }; loadFiles() }
const renameFile = (file: any) => { renameOldName.value = file.name; renameNewName.value = file.name; showRenameModal.value = true }
const confirmRename = async () => { if (!renameNewName.value || renameNewName.value === renameOldName.value) { showRenameModal.value = false; return }; const oldPath = currentPath.value === '/' ? `/${renameOldName.value}` : `${currentPath.value}/${renameOldName.value}`; const newPath = currentPath.value === '/' ? `/${renameNewName.value}` : `${currentPath.value}/${renameNewName.value}`; try { await $fetch(`/api/servers/${props.serverId}/files/rename`, { method: 'POST', body: { from: oldPath, to: newPath } }); showRenameModal.value = false; loadFiles() } catch (e: any) { if (!deny(e)) alert(e.data?.message || t('files.errRename')) } }
const createFolder = async () => { if (!newFolderName.value) return; const path = currentPath.value === '/' ? `/${newFolderName.value}` : `${currentPath.value}/${newFolderName.value}`; try { await $fetch(`/api/servers/${props.serverId}/files/folder`, { method: 'POST', body: { path } }); showNewFolderModal.value = false; newFolderName.value = ''; loadFiles() } catch (e: any) { if (!deny(e)) alert(e.data?.message || t('files.errMkdir')) } }

const createFile = async () => {
  const name = newFileName.value.trim().replace(/\\/g, '/')
  if (!name || name.includes('/')) return
  if (files.value.some((f) => f.name === name && !f.directory)) { showNewFileModal.value = false; newFileName.value = ''; openEditor(name); return }
  const path = currentPath.value === '/' ? `/${name}` : `${currentPath.value}/${name}`
  try {
    await $fetch(`/api/servers/${props.serverId}/files/write`, { method: 'POST', body: { path, content: '' } })
    showNewFileModal.value = false
    newFileName.value = ''
    await loadFiles()
    openEditor(name)
  } catch (e: any) { if (!deny(e)) alert(e.data?.message || t('files.errFileSave')) }
}

const chmodFileInt = (file: any) => { chmodTarget.value = file; chmodValue.value = ''; chmodError.value = ''; showChmodModal.value = true }
const applyChmod = async () => { if (!chmodValue.value.match(/^[0-7]{3}$/)) { chmodError.value = t('files.errChmodFormat'); return }; chmodLoading.value = true; chmodError.value = ''; try { const filePath = currentPath.value === '/' ? `/${chmodTarget.value.name}` : `${currentPath.value}/${chmodTarget.value.name}`; await $fetch(`/api/servers/${props.serverId}/files/chmod`, { method: 'POST', body: { file: filePath, mode: chmodValue.value } }); showChmodModal.value = false; loadFiles() } catch (e: any) { if (deny(e)) chmodError.value = ''; else chmodError.value = e.data?.message || t('files.errChmod') } finally { chmodLoading.value = false } }

const openEditor = async (fileName: string) => { editingFile.value = fileName; editingFilePath.value = currentPath.value === '/' ? `/${fileName}` : `${currentPath.value}/${fileName}`; fileSaved.value = false; fileError.value = ''; editorLangLabel.value = ''; try { const content = await $fetch(`/api/servers/${props.serverId}/files/contents`, { params: { path: editingFilePath.value } }); const text = typeof content === 'string' ? content : JSON.stringify(content); fileContent.value = text; await openMonaco(text) } catch (e: any) { if (deny(e)) fileError.value = ''; else fileError.value = e.data?.message || t('files.errFileLoad'); fileContent.value = ''; closeMonaco() } }
const closeEditor = () => { closeMonaco(); editingFile.value = ''; editingFilePath.value = ''; fileContent.value = ''; fileSaved.value = false; fileError.value = '' }
const saveEditor = async () => { savingFile.value = true; fileSaved.value = false; fileError.value = ''; try { if (monacoEditor && !usePlainEditor.value) { try { fileContent.value = monacoEditor.getValue() } catch {} } await $fetch(`/api/servers/${props.serverId}/files/write`, { method: 'POST', body: { path: editingFilePath.value, content: fileContent.value } }); fileSaved.value = true; setTimeout(() => { fileSaved.value = false }, 2000) } catch (e: any) { if (deny(e)) fileError.value = ''; else fileError.value = e.data?.message || t('files.errFileSave') } finally { savingFile.value = false } }
const onEditorKeydown = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveEditor() } }

const uploadFiles = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const fileList = target.files
  if (!fileList) return

  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i]
    const upload = { name: file.name, progress: 0 }
    uploads.value.push(upload)

    const formData = new FormData()
    formData.append('files', file)
    formData.append('path', currentPath.value)

    try {
      await $fetch(`/api/servers/${props.serverId}/files`, { method: 'POST', body: formData })
      uploads.value = uploads.value.filter(u => u.name !== file.name)
    } catch (e: any) {
      // Показываем причину с сервера (лимит ноды, обрыв), а не голое имя.
      if (!deny(e)) alert(t('files.errUpload', { name: file.name, error: e?.data?.message || e?.message || t('files.errUnknown') }))
      uploads.value = uploads.value.filter(u => u.name !== file.name)
    }
  }
  target.value = ''
  loadFiles()
}

const formatBytes = (bytes: number) => { if (!bytes) return '0 B'; const sizes = ['B', 'KB', 'MB', 'GB', 'TB']; const i = Math.floor(Math.log(bytes) / Math.log(1024)); return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}` }
const formatDate = (dateStr: string) => { if (!dateStr) return '—'; return new Date(dateStr).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) }
const isImage = (name: string) => /\.(jpg|jpeg|png|gif|webp|svg|ico)$/i.test(name)
const isArchive = (name: string) => /\.(zip|tar|gz|rar|7z|bz2)$/i.test(name)
const isCode = (name: string) => /\.(js|ts|jsx|tsx|vue|py|java|cpp|c|go|rs|php|html|css|json|xml|yaml|yml|txt|conf|properties|log)$/i.test(name)

const vClickOutside = { mounted(el: any, binding: any) { el.clickOutsideEvent = (event: Event) => { if (!(el === event.target || el.contains(event.target))) binding.value() }; document.addEventListener('click', el.clickOutsideEvent) }, unmounted(el: any) { document.removeEventListener('click', el.clickOutsideEvent) } }

onMounted(loadFiles)

onUnmounted(() => {
  try { monacoEditor?.dispose?.() } catch {}
  monacoEditor = null
})
</script>

<style scoped>
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.animate-spin { animation: spin 1s linear infinite; }
</style>

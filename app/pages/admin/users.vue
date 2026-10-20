<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h2 class="text-xl font-bold text-white/95">{{ $t('admin.users') }}</h2>
      <div class="flex items-center gap-2">
        <span class="text-[11px] text-white/40 bg-white/[0.03] px-3 py-1 rounded-full border border-white/[0.07]">
          {{ $t('admin.total') }}: {{ totalUsers }}
        </span>
        <button
          v-if="!creating"
          @click="creating = true"
          class="bg-emerald-300 hover:bg-emerald-200 text-black px-3 py-1 rounded-full text-[11px] font-medium transition-all"
        >
          {{ $t('usersAdmin.newUser') }}
        </button>
      </div>
    </div>

    <!-- Создание аккаунта: модалка -->
    <Teleport to="body">
    <div v-if="creating" class="fixed inset-0 z-[100] flex items-center justify-center p-4" @click.self="closeCreate">
      <div class="absolute inset-0 bg-black/70 backdrop-blur-sm kt-fade-in"></div>
      <div class="kt-pop relative bg-[#141414] border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-6 space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-base sm:text-lg font-medium text-white">{{ $t('usersAdmin.newTitle') }}</h3>
            <p class="text-white/35 text-xs mt-0.5">{{ $t('usersAdmin.newHint') }}</p>
          </div>
          <button @click="closeCreate" :title="$t('common.close')" class="text-white/40 hover:text-white/80 p-1 transition-colors">
            <svg class="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <div class="grid sm:grid-cols-2 gap-3">
          <div class="sm:col-span-2">
            <label class="text-white/70 text-xs block mb-1">{{ $t('usersAdmin.fEmail') }} *</label>
            <input v-model="newUser.email" type="email" placeholder="user@example.com" @keyup.enter="createUser" autocomplete="off" class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-emerald-300/40" />
          </div>
          <div>
            <label class="text-white/70 text-xs block mb-1">{{ $t('usersAdmin.fName') }}</label>
            <input v-model="newUser.name" type="text" :placeholder="$t('usersAdmin.nameOptional')" @keyup.enter="createUser" autocomplete="off" class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-emerald-300/40" />
          </div>
          <div>
            <label class="text-white/70 text-xs block mb-1">{{ $t('usersAdmin.fRole') }}</label>
            <div class="relative" data-role-create>
              <button
                type="button"
                @click="roleOpen = !roleOpen"
                class="w-full flex items-center gap-1.5 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white/90 hover:bg-black/40 transition-all"
              >
                <svg v-if="newUser.role === 'admin'" class="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                  <rect width="24" height="24" fill="none"/>
                  <path fill="currentColor" d="m11.998 2l.118.007l.059.008l.061.013l.111.034a1 1 0 0 1 .217.112l.104.082l.255.218a11 11 0 0 0 7.189 2.537l.342-.01a1 1 0 0 1 1.005.717a13 13 0 0 1-9.208 16.25a1 1 0 0 1-.502 0A13 13 0 0 1 2.54 5.718a1 1 0 0 1 1.005-.717a11 11 0 0 0 7.531-2.527l.263-.225l.096-.075a1 1 0 0 1 .217-.112l.112-.034a1 1 0 0 1 .119-.021zM12 9a2 2 0 0 0-1.995 1.85L10 11l.005.15A2 2 0 0 0 11 12.731V14.5l.007.117A1 1 0 0 0 13 14.5l.001-1.768A2 2 0 0 0 12 9"/>
                </svg>
                <svg v-else class="w-3.5 h-3.5 text-emerald-300 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                  <rect width="24" height="24" fill="none"/>
                  <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0-8 0M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
                </svg>
                <span class="flex-1 text-left">{{ newUser.role === 'admin' ? $t('usersAdmin.adminFull') : $t('usersAdmin.userFull') }}</span>
                <svg class="w-4 h-4 text-white/40 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M6 9l6 6 6-6"/>
                </svg>
              </button>
              <div
                v-if="roleOpen"
                class="absolute left-0 right-0 top-full mt-1 bg-[#12141b] border border-white/[0.07] rounded-xl shadow-lg overflow-hidden z-10"
              >
                <button
                  type="button"
                  @click="newUser.role = 'user'; roleOpen = false"
                  class="w-full text-left px-4 py-2.5 text-sm text-white/80 hover:bg-white/10 transition-all flex items-center gap-2"
                >
                  <svg class="w-4 h-4 text-emerald-300" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                    <rect width="24" height="24" fill="none"/>
                    <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0-8 0M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
                  </svg>
                  {{ $t('usersAdmin.userFull') }}
                </button>
                <button
                  type="button"
                  @click="newUser.role = 'admin'; roleOpen = false"
                  class="w-full text-left px-4 py-2.5 text-sm text-white/80 hover:bg-white/10 transition-all flex items-center gap-2 border-t border-white/5"
                >
                  <svg class="w-4 h-4 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                    <rect width="24" height="24" fill="none"/>
                    <path fill="currentColor" d="m11.998 2l.118.007l.059.008l.061.013l.111.034a1 1 0 0 1 .217.112l.104.082l.255.218a11 11 0 0 0 7.189 2.537l.342-.01a1 1 0 0 1 1.005.717a13 13 0 0 1-9.208 16.25a1 1 0 0 1-.502 0A13 13 0 0 1 2.54 5.718a1 1 0 0 1 1.005-.717a11 11 0 0 0 7.531-2.527l.263-.225l.096-.075a1 1 0 0 1 .217-.112l.112-.034a1 1 0 0 1 .119-.021zM12 9a2 2 0 0 0-1.995 1.85L10 11l.005.15A2 2 0 0 0 11 12.731V14.5l.007.117A1 1 0 0 0 13 14.5l.001-1.768A2 2 0 0 0 12 9"/>
                  </svg>
                  {{ $t('usersAdmin.adminFull') }}
                </button>
              </div>
            </div>
          </div>
          <div class="sm:col-span-2">
            <label class="text-white/70 text-xs block mb-1">{{ $t('usersAdmin.fPassword') }} *</label>
            <input v-model="newUser.password" type="password" autocomplete="new-password" :placeholder="$t('usersAdmin.pwPh')" @keyup.enter="createUser" class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-emerald-300/40" />
          </div>
        </div>
        <div v-if="createError" class="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">{{ createError }}</div>
        <div v-if="createdInfo" class="text-emerald-300 text-sm bg-emerald-300/10 border border-emerald-300/30 rounded-xl px-3 py-2">{{ $t('usersAdmin.createdLine', { v: createdInfo }) }}</div>
        <div class="flex gap-2">
          <button @click="closeCreate" class="flex-1 bg-white/5 hover:bg-white/10 text-white/70 rounded-xl px-4 py-2.5 text-sm transition-all">{{ $t('admin.cancel') }}</button>
          <button @click="createUser" :disabled="creatingUser || !newUser.email || !newUser.password" class="flex-1 bg-emerald-300 hover:bg-emerald-200 text-black rounded-xl px-4 py-2.5 text-sm font-medium transition-all disabled:opacity-50">
            {{ creatingUser ? $t('common.creating') : $t('admin.create') }}
          </button>
        </div>
      </div>
    </div>
    </Teleport>

    <!-- Текущий пользователь (админ) -->
    <div class="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-6">
      <h3 class="text-lg font-medium text-white/90 mb-4 flex items-center gap-2">
        <span class="w-2 h-2 bg-emerald-300 rounded-full animate-pulse"></span>
        {{ $t('usersAdmin.session') }}
      </h3>

      <div class="flex items-start gap-4">
        <div class="flex-shrink-0">
          <div v-if="session?.user?.image" class="w-14 h-14 rounded-full overflow-hidden border-2 border-emerald-300/30">
            <img :src="session.user.image" :alt="session.user.name" class="w-full h-full object-cover" />
          </div>
          <div v-else class="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-300/30 to-emerald-300/10 border-2 border-emerald-300/30 flex items-center justify-center">
            <span class="text-xl text-white font-bold">{{ userInitial }}</span>
          </div>
        </div>

        <div class="flex-1">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p class="text-white/50 text-xs mb-1">{{ $t('usersAdmin.colName') }}</p>
              <p class="text-white/90 font-medium">{{ session?.user?.name || $t('account.notSpecified') }}</p>
            </div>
            <div>
              <p class="text-white/50 text-xs mb-1">Email</p>
              <p class="text-white/90 font-medium">{{ session?.user?.email || $t('account.notSpecifiedEmail') }}</p>
            </div>
            <div>
              <p class="text-white/50 text-xs mb-1">ID</p>
              <p class="text-white/90 font-mono text-sm">{{ session?.user?.id || '—' }}</p>
            </div>
            <div>
              <p class="text-white/50 text-xs mb-1">{{ $t('usersAdmin.colProvider') }}</p>
              <p class="text-white/90 font-medium flex items-center gap-1">
                <span :class="providerBadgeClass">{{ providerName }}</span>
              </p>
            </div>
            <div>
              <p class="text-white/50 text-xs mb-1">{{ $t('usersAdmin.colRole') }}</p>
              <span :class="roleBadgeClass">
                <svg v-if="session?.user?.role === 'admin'" class="w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                  <rect width="24" height="24" fill="none"/>
                  <path fill="currentColor" d="m11.998 2l.118.007l.059.008l.061.013l.111.034a1 1 0 0 1 .217.112l.104.082l.255.218a11 11 0 0 0 7.189 2.537l.342-.01a1 1 0 0 1 1.005.717a13 13 0 0 1-9.208 16.25a1 1 0 0 1-.502 0A13 13 0 0 1 2.54 5.718a1 1 0 0 1 1.005-.717a11 11 0 0 0 7.531-2.527l.263-.225l.096-.075a1 1 0 0 1 .217-.112l.112-.034a1 1 0 0 1 .119-.021zM12 9a2 2 0 0 0-1.995 1.85L10 11l.005.15A2 2 0 0 0 11 12.731V14.5l.007.117A1 1 0 0 0 13 14.5l.001-1.768A2 2 0 0 0 12 9"/>
                </svg>
                <svg v-else class="w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                  <rect width="24" height="24" fill="none"/>
                  <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0-8 0M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
                </svg>
                {{ roleName }}
              </span>
            </div>
            <div>
              <p class="text-white/50 text-xs mb-1">{{ $t('usersAdmin.colLastLogin') }}</p>
              <p class="text-white/90 text-sm">{{ lastLoginFormatted }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Список всех пользователей -->
    <div class="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-6">
      <h3 class="text-lg font-medium text-white/90 mb-4">{{ $t('usersAdmin.allUsers') }}</h3>

      <div v-if="pending" class="text-center py-12">
        <div class="w-8 h-8 mx-auto border-2 border-emerald-300/30 border-t-emerald-300 rounded-full animate-spin"></div>
        <p class="text-white/50 mt-4">{{ $t('usersAdmin.loading') }}</p>
      </div>

      <div v-else-if="error" class="text-center py-12">
        <p class="text-red-400">{{ $t('usersAdmin.loadError', { msg: error }) }}</p>
      </div>

      <div v-else-if="usersList.length === 0" class="text-center py-12">
        <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
          <svg class="w-8 h-8 text-white/30" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        </div>
        <p class="text-white/50 mb-2">{{ $t('usersAdmin.empty') }}</p>
      </div>

      <div v-else class="space-y-2">
        <div
          v-for="user in usersList"
          :key="user.id"
          class="flex items-center gap-4 p-3 rounded-xl hover:bg-white/[0.04] transition-all border border-white/[0.06]"
          :class="{ 'border-emerald-300/30 bg-emerald-300/5': user.id === session?.user?.id }"
        >
          <!-- Аватар -->
          <div class="flex-shrink-0">
            <div v-if="user.avatar" class="w-10 h-10 rounded-full overflow-hidden">
              <img :src="user.avatar" :alt="user.name" class="w-full h-full object-cover" />
            </div>
            <div v-else class="w-10 h-10 rounded-full bg-white/[0.06] flex items-center justify-center">
              <span class="text-sm text-white/70 font-medium">{{ getUserInitial(user.name) }}</span>
            </div>
          </div>

          <!-- Инфо -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <p class="text-white/90 font-medium truncate">{{ user.name || $t('usersAdmin.noName') }}</p>
              <span v-if="user.id === session?.user?.id" class="text-[10px] bg-emerald-300/15 text-emerald-300 border border-emerald-300/30 px-2 py-0.5 rounded-full">{{ $t('usersAdmin.you') }}</span>
            </div>
            <p class="text-white/50 text-sm truncate">{{ user.email }}</p>
            <span v-if="user.totpEnabled" :title="$t('usersAdmin.twoFaBadge')" class="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-300/10 text-emerald-300 border border-emerald-300/25 mt-1">2FA</span>
          </div>

          <!-- ID -->
          <div class="text-white/40 text-xs font-mono w-20 text-center hidden xl:block">
            #{{ user.id }}
          </div>

          <!-- Провайдер -->
          <div class="flex items-center gap-2">
            <span :class="getProviderBadgeClass(user.provider)">{{ formatProvider(user.provider) }}</span>

            <!-- Кастомный селектор роли -->
            <div class="relative" data-role-dropdown>
              <button
                @click="toggleRoleDropdown(user.id)"
                :disabled="user.id === session?.user?.id && user.role === 'admin' && isLastAdmin"
                class="flex items-center gap-1.5 bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white/90 cursor-pointer hover:bg-black/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg v-if="user.role === 'admin'" class="w-3.5 h-3.5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                  <rect width="24" height="24" fill="none"/>
                  <path fill="currentColor" d="m11.998 2l.118.007l.059.008l.061.013l.111.034a1 1 0 0 1 .217.112l.104.082l.255.218a11 11 0 0 0 7.189 2.537l.342-.01a1 1 0 0 1 1.005.717a13 13 0 0 1-9.208 16.25a1 1 0 0 1-.502 0A13 13 0 0 1 2.54 5.718a1 1 0 0 1 1.005-.717a11 11 0 0 0 7.531-2.527l.263-.225l.096-.075a1 1 0 0 1 .217-.112l.112-.034a1 1 0 0 1 .119-.021zM12 9a2 2 0 0 0-1.995 1.85L10 11l.005.15A2 2 0 0 0 11 12.731V14.5l.007.117A1 1 0 0 0 13 14.5l.001-1.768A2 2 0 0 0 12 9"/>
                </svg>
                <svg v-else class="w-3.5 h-3.5 text-emerald-300" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                  <rect width="24" height="24" fill="none"/>
                  <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0-8 0M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
                </svg>
                {{ formatRole(user.role) }}
                <div v-if="changingRole === user.id" class="w-4 h-4 border-2 border-emerald-300 border-t-transparent rounded-full animate-spin"></div>
                <svg v-else class="w-4 h-4 text-white/40" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M6 9l6 6 6-6"/>
                </svg>
              </button>

              <!-- Дропдаун -->
              <div
                v-if="openRoleDropdown === user.id"
                class="absolute right-0 top-full mt-1 bg-[#12141b] border border-white/[0.07] rounded-xl shadow-lg overflow-hidden z-10 min-w-[180px]"
              >
                <button
                  @click="changeRoleInline(user.id, 'user')"
                  class="w-full text-left px-4 py-2.5 text-sm text-white/80 hover:bg-white/10 transition-all flex items-center gap-2"
                >
                  <svg class="w-4 h-4 text-emerald-300" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                    <rect width="24" height="24" fill="none"/>
                    <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0-8 0M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
                  </svg>
                  {{ $t('usersAdmin.userFull') }}
                </button>
                <button
                  @click="changeRoleInline(user.id, 'admin')"
                  class="w-full text-left px-4 py-2.5 text-sm text-white/80 hover:bg-white/10 transition-all flex items-center gap-2 border-t border-white/5"
                >
                  <svg class="w-4 h-4 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                    <rect width="24" height="24" fill="none"/>
                    <path fill="currentColor" d="m11.998 2l.118.007l.059.008l.061.013l.111.034a1 1 0 0 1 .217.112l.104.082l.255.218a11 11 0 0 0 7.189 2.537l.342-.01a1 1 0 0 1 1.005.717a13 13 0 0 1-9.208 16.25a1 1 0 0 1-.502 0A13 13 0 0 1 2.54 5.718a1 1 0 0 1 1.005-.717a11 11 0 0 0 7.531-2.527l.263-.225l.096-.075a1 1 0 0 1 .217-.112l.112-.034a1 1 0 0 1 .119-.021zM12 9a2 2 0 0 0-1.995 1.85L10 11l.005.15A2 2 0 0 0 11 12.731V14.5l.007.117A1 1 0 0 0 13 14.5l.001-1.768A2 2 0 0 0 12 9"/>
                  </svg>
                  {{ $t('usersAdmin.adminFull') }}
                </button>
              </div>
            </div>
            <button
              @click="openEdit(user)"
              :title="t('usersAdmin.editUser')"
              class="text-white/40 hover:text-emerald-300 p-1.5 transition-colors"
            >
              <svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></svg>
            </button>
            <button
              v-if="user.id !== session?.user?.id"
              @click="removeUser(user)"
              :title="t('usersAdmin.deleteUser')"
              class="text-red-400/70 hover:text-red-300 p-1.5 transition-colors"
            >
              <svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></svg>
            </button>
          </div>

          <!-- Дата входа -->
          <div class="text-white/40 text-xs hidden lg:block w-32 text-right">
            {{ formatDate(user.lastLogin) }}
          </div>
        </div>
      </div>
    </div>

    <!-- Редактирование: модалка -->
    <Teleport to="body">
    <div v-if="editing" class="fixed inset-0 z-[100] flex items-center justify-center p-4" @click.self="closeEdit">
      <div class="absolute inset-0 bg-black/70 backdrop-blur-sm kt-fade-in"></div>
      <div class="kt-pop relative bg-[#141414] border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-6 space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-base sm:text-lg font-medium text-white">{{ $t('usersAdmin.editTitle') }}</h3>
            <p class="text-white/35 text-xs mt-0.5">{{ editForm.email }}</p>
          </div>
          <button @click="closeEdit" :title="$t('common.close')" class="text-white/40 hover:text-white/80 p-1 transition-colors">
            <svg class="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <div class="grid sm:grid-cols-2 gap-3">
          <div class="sm:col-span-2">
            <label class="text-white/70 text-xs block mb-1">{{ $t('usersAdmin.fEmail') }} *</label>
            <input v-model="editForm.email" type="email" autocomplete="off" @keyup.enter="saveEdit" class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-emerald-300/40" />
          </div>
          <div>
            <label class="text-white/70 text-xs block mb-1">{{ $t('usersAdmin.fName') }}</label>
            <input v-model="editForm.name" type="text" autocomplete="off" @keyup.enter="saveEdit" class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-emerald-300/40" />
          </div>
          <div>
            <label class="text-white/70 text-xs block mb-1">{{ $t('usersAdmin.fRole') }}</label>
            <select v-model="editForm.role" class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white/90 focus:outline-none focus:border-emerald-300/40">
              <option value="user">{{ $t('usersAdmin.userFull') }}</option>
              <option value="admin">{{ $t('usersAdmin.adminFull') }}</option>
            </select>
          </div>
          <div class="sm:col-span-2">
            <label class="text-white/70 text-xs block mb-1">{{ $t('usersAdmin.newPwOptional') }}</label>
            <input v-model="editForm.password" type="password" autocomplete="new-password" :placeholder="$t('usersAdmin.pwPh')" @keyup.enter="saveEdit" class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-emerald-300/40" />
          </div>
        </div>
        <div v-if="editError" class="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">{{ editError }}</div>
        <div class="flex gap-2">
          <button @click="closeEdit" class="flex-1 bg-white/5 hover:bg-white/10 text-white/70 rounded-xl px-4 py-2.5 text-sm transition-all">{{ $t('common.cancel') }}</button>
          <button @click="saveEdit" :disabled="savingEdit || !editForm.email" class="flex-1 bg-emerald-300 hover:bg-emerald-200 text-black rounded-xl px-4 py-2.5 text-sm font-medium transition-all disabled:opacity-50">
            {{ savingEdit ? $t('usersAdmin.savingUser') : $t('usersAdmin.saveUser') }}
          </button>
        </div>
      </div>
    </div>
    </Teleport>

    <!-- Уведомление -->
    <div
      v-if="notification.show"
      :class="[
        'fixed bottom-4 right-4 px-4 py-3 rounded-lg text-sm font-medium transition-all z-50',
        notification.type === 'success' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
      ]"
    >
      {{ notification.message }}
    </div>
  </div>
</template>

<script setup>
const { t } = useI18n()
definePageMeta({
  layout: 'admin',
  middleware: 'admin'
})

const { data: session } = useAuth()

const { data: usersData, pending, error, refresh } = await useFetch('/api/admin/users')

const usersList = computed(() => usersData.value || [])

const changingRole = ref(null)
const openRoleDropdown = ref(null)
const notification = ref({ show: false, message: '', type: 'success' })

// Создание аккаунта админом (вход по почте+паролю)
const creating = ref(false)
const creatingUser = ref(false)
const createError = ref('')
const createdInfo = ref('')
const newUser = ref({ email: '', name: '', password: '', role: 'user' })
const roleOpen = ref(false)

const closeCreate = () => {
  creating.value = false
  createError.value = ''
  createdInfo.value = ''
  newUser.value = { email: '', name: '', password: '', role: 'user' }
}

const createUser = async () => {
  creatingUser.value = true
  createError.value = ''
  createdInfo.value = ''
  try {
    const data = await $fetch('/api/admin/users', {
      method: 'POST',
      body: { email: newUser.value.email.trim(), name: newUser.value.name.trim(), password: newUser.value.password, role: newUser.value.role },
    })
    createdInfo.value = t('usersAdmin.createdAs', { email: data.email, role: data.role === 'admin' ? t('usersAdmin.roleAdminShort') : t('usersAdmin.roleUserShort') })
    newUser.value = { email: '', name: '', password: '', role: 'user' }
    await refresh()
    showNotification(t('usersAdmin.accountCreated'))
  } catch (e) {
    createError.value = e.data?.message || t('usersAdmin.createError')
  } finally {
    creatingUser.value = false
  }
}

const isLastAdmin = computed(() => {
  const adminCount = usersList.value.filter(u => u.role === 'admin').length
  return adminCount <= 1
})

const totalUsers = computed(() => usersList.value.length)

const userInitial = computed(() => {
  const name = session.value?.user?.name
  if (!name) return '?'
  return name.charAt(0).toUpperCase()
})

const getUserInitial = (name) => {
  if (!name) return '?'
  return name.charAt(0).toUpperCase()
}

const providerName = computed(() => formatProvider(session.value?.user?.provider))

const formatProvider = (provider) => {
  const providers = {
    github: 'GitHub',
    google: 'Google',
    discord: 'Discord',
    credentials: t('usersAdmin.providerMail')
  }
  return providers[provider] || provider || t('usersAdmin.unknown')
}

const formatRole = (role) => {
  const roles = { user: t('usersAdmin.roleUser'), admin: t('usersAdmin.roleAdmin') }
  return roles[role] || role || t('usersAdmin.roleUser')
}

const roleName = computed(() => formatRole(session.value?.user?.role))

const providerBadgeClass = computed(() => getProviderBadgeClass(session.value?.user?.provider))

const getProviderBadgeClass = (provider) => {
  const classes = {
    github: 'bg-gray-500/20 text-gray-400 border border-gray-500/30 px-2 py-0.5 rounded-full text-xs',
    google: 'bg-emerald-300/15 text-emerald-300 border border-emerald-300/30 px-2 py-0.5 rounded-full text-xs',
    discord: 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-2 py-0.5 rounded-full text-xs'
  }
  return classes[provider] || 'bg-white/10 text-white/60 px-2 py-0.5 rounded-full text-xs'
}

const roleBadgeClass = computed(() => getRoleBadgeClass(session.value?.user?.role))

const getRoleBadgeClass = (role) => {
  const classes = {
    admin: 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30',
    user: 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-300/15 text-emerald-300 border border-emerald-300/30'
  }
  return classes[role] || classes.user
}

const formatDate = (dateStr) => {
  if (!dateStr) return '—'
  const date = new Date(dateStr)
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

const lastLoginFormatted = computed(() => formatDateTime(session.value?.user?.lastLogin))

const formatDateTime = (dateStr) => {
  if (!dateStr) return t('usersAdmin.firstLogin')
  const date = new Date(dateStr)
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

const showNotification = (message, type = 'success') => {
  notification.value = { show: true, message, type }
  setTimeout(() => {
    notification.value.show = false
  }, 3000)
}

const toggleRoleDropdown = (userId) => {
  if (openRoleDropdown.value === userId) {
    openRoleDropdown.value = null
  } else {
    openRoleDropdown.value = userId
  }
}

const changeRoleInline = async (userId, newRole) => {
  openRoleDropdown.value = null
  await changeRole(userId, newRole)
}

const changeRole = async (userId, newRole) => {
  if (changingRole.value) return

  changingRole.value = userId

  try {
    await $fetch(`/api/admin/users/${userId}/role`, {
      method: 'PUT',
      body: { role: newRole }
    })

    await refresh()
    showNotification(t('usersAdmin.roleChanged', { role: formatRole(newRole) }))
  } catch (e) {
    showNotification(e.data?.message || t('usersAdmin.roleError'), 'error')
  } finally {
    changingRole.value = null
  }
}

// Редактирование пользователя: полный CRUD (GET single + PUT).
const editing = ref(null)
const savingEdit = ref(false)
const editError = ref('')
const editForm = ref({ id: 0, email: '', name: '', role: 'user', password: '' })

const openEdit = async (user) => {
  editError.value = ''
  editForm.value = { id: user.id, email: user.email || '', name: user.name || '', role: user.role || 'user', password: '' }
  editing.value = user.id
  try {
    const full = await $fetch(`/api/admin/users/${user.id}`)
    editForm.value = { id: full.id, email: full.email || '', name: full.name || '', role: full.role || 'user', password: '' }
  } catch {}
}

const closeEdit = () => {
  editing.value = null
  editError.value = ''
  editForm.value = { id: 0, email: '', name: '', role: 'user', password: '' }
}

const saveEdit = async () => {
  savingEdit.value = true
  editError.value = ''
  try {
    const body = { email: editForm.value.email.trim(), name: editForm.value.name.trim(), role: editForm.value.role }
    if (editForm.value.password) body.password = editForm.value.password
    await $fetch(`/api/admin/users/${editForm.value.id}`, {
      method: 'PUT',
      body,
    })
    closeEdit()
    await refresh()
    showNotification(t('usersAdmin.updated'))
  } catch (e) {
    editError.value = e.data?.message || t('usersAdmin.updateError')
  } finally {
    savingEdit.value = false
  }
}

const removeUser = async (user) => {
  if (!(await confirmDialog({ message: t('usersAdmin.deleteConfirm', { email: user.email }), confirmText: t('usersAdmin.deleteUser'), danger: true }))) return
  try {
    await $fetch(`/api/admin/users/${user.id}`, { method: 'DELETE' })
    await refresh()
    showNotification(t('usersAdmin.deleted'))
  } catch (e) {
    showNotification(e.data?.message || t('usersAdmin.deleteError'), 'error')
  }
}

onMounted(() => {
  document.addEventListener('click', (e) => {
    if (!e.target.closest('[data-role-dropdown]')) {
      openRoleDropdown.value = null
    }
    if (!e.target.closest('[data-role-create]')) {
      roleOpen.value = false
    }
  })
})
</script>

<style scoped>
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
.animate-spin {
  animation: spin 1s linear infinite;
}
</style>

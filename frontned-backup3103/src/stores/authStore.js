import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useAuthStore = create(
    persist(
        (set, get) => ({
            token: null,
            user: null,
            bootstrapped: false,

            setSession: ({ token, user }) => set({ token, user }),
            setUser: (user) => set({ user }),
            setBootstrapped: (bootstrapped) => set({ bootstrapped }),
            clearSession: () => set({ token: null, user: null, bootstrapped: true }),

            isAuthenticated: () => Boolean(get().token),

            // Roles come from API as plain strings e.g. ['super-admin', 'cashier']
            // (UserResource returns roles->pluck('name'))
            hasRole: (roleName) => {
                const roles = get().user?.roles ?? []
                return roles.some((r) =>
                    typeof r === 'string' ? r === roleName : r?.name === roleName
                )
            },

            isAdminLike: () => {
                const u = get().user
                if (!u) return false
                return (
                    u.is_super_admin ||
                    u.is_admin ||
                    get().hasRole('super-admin') ||
                    get().hasRole('admin') ||
                    get().hasRole('branch-manager')
                )
            },

            isSuperAdmin: () => get().hasRole('super-admin'),
        }), {
            name: 'edlp-pos-auth',
            partialize: (s) => ({ token: s.token, user: s.user }),
        },
    ),
)

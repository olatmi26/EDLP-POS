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
            hasRole: (roleName) => {
                const roles = get().user?.roles ?? []
                return roles.some((r) => r?.name === roleName)
            },
            isAdminLike: () => {
                const u = get().user
                if (!u) return false
                return u.is_super_admin || u.is_admin || get().hasRole('super-admin') || get().hasRole('admin')
            },
        }), {
            name: 'edlp-pos-auth',
            partialize: (s) => ({ token: s.token, user: s.user }),
        },
    ),
)
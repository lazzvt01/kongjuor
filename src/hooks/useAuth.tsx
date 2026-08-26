import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'

import { supabase } from '@/lib/supabase'
import { obterPerfil } from '@/services/api/auth'
import type { Profile } from '@/types'

interface AuthContextValue {
  session: Session | null
  profile: Profile | null
  loading: boolean
  refreshing: boolean
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadProfile = async (user: Session | null) => {
    if (!user) {
      setProfile(null)
      return
    }
    const perfil = await obterPerfil()
    setProfile(perfil)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      void loadProfile(data.session)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      if (_event === 'SIGNED_OUT') {
        setProfile(null)
      } else {
        void loadProfile(newSession)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const refresh = async () => {
    setRefreshing(true)
    try {
      const {
        data: { session: s },
      } = await supabase.auth.getSession()
      setSession(s)
      await loadProfile(s)
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <AuthContext.Provider value={{ session, profile, loading, refreshing, refresh }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}

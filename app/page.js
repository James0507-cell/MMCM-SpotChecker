'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Lock, Mail, Loader2, AlertCircle, Home, CheckCircle2, ArrowRight } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [isSignUp, setIsSignUp] = useState(false)
  const [isForgotPassword, setIsForgotPassword] = useState(false)
  const [isResettingPassword, setIsResettingPassword] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsResettingPassword(true)
        setIsForgotPassword(false)
        setIsSignUp(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleAuth = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    if (isResettingPassword) {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      })
      if (error) setError(error.message)
      else {
        setSuccess('Password updated! You can now sign in.')
        setIsResettingPassword(false)
        setNewPassword('')
      }
    } else if (isForgotPassword) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/`,
      })
      if (error) setError(error.message)
      else setSuccess('Check your email for the password reset link!')
    } else if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      })
      if (error) setError(error.message)
      else setSuccess('Check your email for the confirmation link!')
    } else {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      
      if (authError) {
        setError(authError.message)
      } else if (data?.user) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .single()

        if (profileError) {
          router.push('/dashboard')
        } else if (profile.role === 'admin') {
          router.push('/admin')
        } else if (profile.role === 'counter') {
          router.push('/counter')
        } else {
          router.push('/dashboard')
        }
      }
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col justify-center relative overflow-hidden">
      {/* Dynamic Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-100/50 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-100/50 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />

      <div className="relative z-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md mx-auto">
          {/* Logo & Header */}
          <div className="text-center mb-10">
            <div className="inline-flex p-4 bg-white rounded-3xl shadow-xl shadow-indigo-100 mb-6 group transition-transform hover:scale-105 duration-300">
              <div className="relative h-16 w-16">
                <Image 
                  src="/Logo-Final_noname_1 (3).png" 
                  alt="MMCM Logo" 
                  fill
                  className="object-contain"
                  priority
                />
              </div>
            </div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-2">
              Spot<span className="text-indigo-600">Checker</span>
            </h1>
            <p className="text-slate-500 font-medium">Mapúa Malayan Colleges Mindanao</p>
          </div>

          {/* Form Card */}
          <div className="bg-white/80 backdrop-blur-xl rounded-[2.5rem] shadow-2xl shadow-slate-200/50 border border-white p-10 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 via-blue-500 to-indigo-500" />
            
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-slate-900">
                {isResettingPassword ? 'Set new password' : isForgotPassword ? 'Reset password' : isSignUp ? 'Create account' : 'Welcome back'}
              </h2>
              <p className="text-slate-500 mt-1.5 text-sm font-medium">
                {isResettingPassword ? (
                   'Enter your new password to secure your account.'
                ) : isForgotPassword ? (
                  <button onClick={() => setIsForgotPassword(false)} className="text-indigo-600 hover:underline inline-flex items-center gap-1">
                    Back to login <ArrowRight className="h-3 w-3" />
                  </button>
                ) : (
                  <>
                    {isSignUp ? 'Already have an account?' : 'Don\'t have an account?'}
                    <button
                      onClick={() => setIsSignUp(!isSignUp)}
                      className="ml-1.5 font-bold text-indigo-600 hover:text-indigo-700 transition-colors"
                    >
                      {isSignUp ? 'Sign in' : 'Register now'}
                    </button>
                  </>
                )}
              </p>
            </div>

            <form className="space-y-6" onSubmit={handleAuth}>
              {error && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-800 text-sm font-semibold animate-in slide-in-from-top-2">
                  <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
                  {error}
                </div>
              )}

              {success && (
                <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-3 text-emerald-800 text-sm font-semibold animate-in slide-in-from-top-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                  {success}
                </div>
              )}

              {isResettingPassword ? (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">New Password</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors group-focus-within:text-indigo-500 text-slate-400">
                      <Lock className="h-5 w-5" />
                    </div>
                    <input
                      type="password"
                      required
                      className="block w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-transparent rounded-2xl focus:border-indigo-500 focus:bg-white focus:ring-0 transition-all outline-none font-medium placeholder-slate-400"
                      placeholder="••••••••"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors group-focus-within:text-indigo-500 text-slate-400">
                        <Mail className="h-5 w-5" />
                      </div>
                      <input
                        type="email"
                        required
                        className="block w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-transparent rounded-2xl focus:border-indigo-500 focus:bg-white focus:ring-0 transition-all outline-none font-medium placeholder-slate-400"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                  </div>

                  {!isForgotPassword && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between px-1">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Password</label>
                        {!isSignUp && (
                          <button
                            type="button"
                            onClick={() => setIsForgotPassword(true)}
                            className="text-xs font-bold text-indigo-500 hover:text-indigo-600 transition-colors"
                          >
                            Forgot?
                          </button>
                        )}
                      </div>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors group-focus-within:text-indigo-500 text-slate-400">
                          <Lock className="h-5 w-5" />
                        </div>
                        <input
                          type="password"
                          required={!isForgotPassword}
                          className="block w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-transparent rounded-2xl focus:border-indigo-500 focus:bg-white focus:ring-0 transition-all outline-none font-medium placeholder-slate-400"
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-slate-900 hover:bg-black text-white py-4 rounded-2xl font-bold shadow-xl shadow-slate-200 transition-all active:scale-[0.98] flex items-center justify-center gap-2 group disabled:opacity-70"
              >
                {loading ? (
                  <Loader2 className="animate-spin h-5 w-5" />
                ) : (
                  <>
                    {isResettingPassword ? 'Update Password' : isForgotPassword ? 'Send Reset Link' : isSignUp ? 'Create Account' : 'Sign In'}
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Footer Info */}
          <div className="mt-10 text-center space-y-4">
             <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-white shadow-sm border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all active:scale-95"
              >
                <Home className="h-4 w-4" />
                View as Guest
              </Link>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">
              &copy; {new Date().getFullYear()} MMCM SpotChecker
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

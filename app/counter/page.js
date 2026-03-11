'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Plus, Minus, LogOut, Loader2, Activity, ShieldAlert, Zap, Radio, ChevronRight } from 'lucide-react'

export default function CounterDashboard() {
  const [assignment, setAssignment] = useState(null)
  const [facility, setFacility] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const router = useRouter()

  const fetchAssignment = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push('/')
      return
    }

    const { data: assignData, error: assignError } = await supabase
      .from('counter_assignments')
      .select('*, facilities(*)')
      .single()

    if (assignError) {
      setError('You are not assigned to any facility. Please contact an administrator.')
      setLoading(false)
      return
    }

    setAssignment(assignData)
    setFacility(assignData.facilities)
    setLoading(false)

    const channel = supabase
      .channel(`realtime:facility:${assignData.facility_id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'facilities', filter: `id=eq.${assignData.facility_id}` }, (payload) => {
        setFacility(payload.new)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [router])

  useEffect(() => {
    fetchAssignment()
  }, [fetchAssignment])

  const handleUpdate = async (amount) => {
    setFacility(prev => ({
      ...prev,
      current_occupancy: Math.max(0, prev.current_occupancy + amount)
    }))

    const { error } = await supabase.rpc('increment_occupancy', { 
      row_id: assignment.facility_id, 
      amount 
    })

    if (error) {
      const { data } = await supabase.from('facilities').select('*').eq('id', assignment.facility_id).single()
      if (data) setFacility(data)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-indigo-500/5 blur-[120px] rounded-full" />
        <Loader2 className="h-12 w-12 animate-spin text-indigo-500 mb-6 relative z-10" />
        <p className="text-slate-400 font-black uppercase tracking-[0.3em] text-[10px] relative z-10">Initializing Counter Hub</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-8 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-rose-500/5 blur-[120px] rounded-full" />
        <div className="bg-rose-500/10 p-6 rounded-[2.5rem] mb-8 border border-rose-500/20 relative z-10 shadow-2xl shadow-rose-500/10">
          <ShieldAlert className="h-16 w-16 text-rose-500" />
        </div>
        <h1 className="text-3xl font-black text-white mb-4 tracking-tight relative z-10">Access Restricted</h1>
        <p className="text-slate-400 mb-10 max-w-sm font-medium leading-relaxed relative z-10">{error}</p>
        <button
          onClick={handleLogout}
          className="px-10 py-4 bg-white text-slate-950 font-black rounded-2xl hover:bg-slate-100 transition-all active:scale-95 inline-flex items-center gap-3 relative z-10 shadow-xl shadow-white/5"
        >
          <LogOut className="h-5 w-5" />
          Terminate Session
        </button>
      </div>
    )
  }

  const isEntry = assignment.type === 'entry'
  const percentage = Math.min(100, Math.round((facility.current_occupancy / facility.max_occupancy) * 100))
  
  return (
    <div className="min-h-screen bg-[#020617] text-white flex flex-col relative overflow-hidden">
      {/* HUD-like background */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
         <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_-20%,#3730a3,transparent)]" />
         <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] mix-blend-overlay opacity-30" />
      </div>

      {/* Dynamic Header */}
      <header className="p-8 flex justify-between items-center relative z-20">
        <div className="flex items-center gap-5">
          <div className="p-2.5 bg-white rounded-2xl shadow-xl shadow-indigo-500/10">
            <div className="relative h-10 w-10">
              <Image src="/Logo-Final_noname_1 (3).png" alt="MMCM Logo" fill className="object-contain" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight leading-none mb-1">{facility.facility_name}</h1>
            <div className="flex items-center gap-2">
               <span className={`h-1.5 w-1.5 rounded-full ${isEntry ? 'bg-emerald-500' : 'bg-rose-500'} animate-pulse`} />
               <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{assignment.type} portal authorized</span>
            </div>
          </div>
        </div>
        <button onClick={handleLogout} className="p-4 bg-slate-900/50 hover:bg-rose-500/20 text-slate-500 hover:text-rose-500 rounded-[1.5rem] transition-all border border-slate-800 hover:border-rose-500/30 group">
          <LogOut className="h-6 w-6 group-hover:-translate-x-1 transition-transform" />
        </button>
      </header>

      {/* Main Control Interface */}
      <div className="flex-grow flex flex-col items-center justify-center px-8 relative z-10">
        {/* Occupancy HUD */}
        <div className="relative mb-16 flex flex-col items-center group">
          <div className="absolute -inset-20 bg-indigo-500/10 blur-[100px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
          <div className="relative">
            <div className="text-[12rem] font-black leading-none tracking-tighter tabular-nums select-none drop-shadow-[0_0_40px_rgba(255,255,255,0.1)] mb-2">
              {facility.current_occupancy}
            </div>
            <div className="flex items-center justify-center gap-3">
               <span className="h-px w-8 bg-slate-800" />
               <span className="text-slate-500 text-xs font-black uppercase tracking-[0.4em]">Capacity {facility.max_occupancy}</span>
               <span className="h-px w-8 bg-slate-800" />
            </div>
          </div>
          
          {/* Circular Progress (Simplified) */}
          <div className="mt-12 w-80 h-3 bg-slate-900 rounded-full overflow-hidden p-1 shadow-inner relative">
             <div 
              className={`h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_20px_rgba(0,0,0,0.5)] ${
                percentage >= 90 ? 'bg-rose-600 shadow-[0_0_15px_rgba(225,29,72,0.4)]' : 
                percentage >= 70 ? 'bg-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.4)]' : 
                'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)]'
              }`}
              style={{ width: `${percentage}%` }}
             />
          </div>
        </div>

        {/* Massive Interactive Trigger */}
        <div className="w-full max-w-sm aspect-square relative group">
          {/* Background Aura */}
          <div className={`absolute -inset-10 blur-[80px] rounded-full transition-all duration-500 opacity-20 ${isEntry ? 'bg-emerald-500 group-hover:opacity-40' : 'bg-rose-500 group-hover:opacity-40'}`} />
          
          {isEntry ? (
            <button
              onClick={() => handleUpdate(1)}
              className="w-full h-full bg-emerald-500 hover:bg-emerald-400 active:scale-95 transition-all rounded-[4rem] shadow-2xl flex flex-col items-center justify-center gap-6 group relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-black/20 to-transparent" />
              <div className="relative">
                <Plus className="h-40 w-40 text-slate-950 stroke-[4] drop-shadow-lg" />
              </div>
              <div className="flex items-center gap-2 bg-slate-950/20 px-6 py-2 rounded-2xl backdrop-blur-sm relative">
                 <Zap className="h-4 w-4 text-slate-950 fill-current" />
                 <span className="text-2xl font-black text-slate-950 tracking-widest uppercase">Register Entry</span>
              </div>
            </button>
          ) : (
            <button
              onClick={() => handleUpdate(-1)}
              disabled={facility.current_occupancy <= 0}
              className="w-full h-full bg-rose-500 hover:bg-rose-400 active:scale-95 transition-all rounded-[4rem] shadow-2xl flex flex-col items-center justify-center gap-6 group relative overflow-hidden disabled:opacity-30 disabled:grayscale"
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-black/20 to-transparent" />
              <div className="relative">
                <Minus className="h-40 w-40 text-slate-950 stroke-[4] drop-shadow-lg" />
              </div>
              <div className="flex items-center gap-2 bg-slate-950/20 px-6 py-2 rounded-2xl backdrop-blur-sm relative">
                 <Radio className="h-4 w-4 text-slate-950" />
                 <span className="text-2xl font-black text-slate-950 tracking-widest uppercase">Register Exit</span>
              </div>
            </button>
          )}
        </div>
      </div>
      
      {/* System Status Bar */}
      <footer className="p-10 relative z-20">
        <div className="max-w-md mx-auto bg-slate-900/40 backdrop-blur-2xl p-4 rounded-3xl border border-slate-800/50 flex items-center justify-between shadow-2xl">
           <div className="flex items-center gap-4">
              <div className="p-2 bg-emerald-500/10 rounded-xl">
                 <Activity className="h-5 w-5 text-emerald-500 animate-bounce" />
              </div>
              <div>
                 <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Connection</p>
                 <p className="text-xs font-bold text-white">Live Sync Active</p>
              </div>
           </div>
           <div className="h-8 w-px bg-slate-800" />
           <div className="flex items-center gap-3">
              <div className="text-right">
                 <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Session</p>
                 <p className="text-xs font-bold text-white">Authorized</p>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-700" />
           </div>
        </div>
      </footer>
    </div>
  )
}

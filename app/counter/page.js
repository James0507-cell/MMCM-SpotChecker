'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Plus, Minus, LogOut, Loader2, Activity } from 'lucide-react'

export default function CounterDashboard() {
  const [assignment, setAssignment] = useState(null)
  const [facility, setFacility] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const router = useRouter()

  const fetchAssignment = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push('/login')
      return
    }

    // 1. Get counter assignment
    const { data: assignData, error: assignError } = await supabase
      .from('counter_assignments')
      .select('*, facilities(*)')
      .single()

    if (assignError) {
      console.error('No assignment found:', assignError)
      setError('You are not assigned to any facility. Please contact an administrator.')
      setLoading(false)
      return
    }

    setAssignment(assignData)
    setFacility(assignData.facilities)
    setLoading(false)

    // 2. Real-time subscription for the facility - Listen to ALL changes to this specific facility
    const channel = supabase
      .channel(`realtime:facility:${assignData.facility_id}`)
      .on(
        'postgres_changes', 
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'facilities', 
          filter: `id=eq.${assignData.facility_id}` 
        }, 
        (payload) => {
          // Update the local state with the latest data from the database
          setFacility(payload.new)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [router])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAssignment()
  }, [fetchAssignment])

  const handleUpdate = async (amount) => {
    // Optimistic UI
    setFacility(prev => ({
      ...prev,
      current_occupancy: Math.max(0, prev.current_occupancy + amount)
    }))

    const { error } = await supabase.rpc('increment_occupancy', { 
      row_id: assignment.facility_id, 
      amount 
    })

    if (error) {
      console.error('Update failed:', error)
      // Revert on error
      const { data } = await supabase.from('facilities').select('*').eq('id', assignment.facility_id).single()
      if (data) setFacility(data)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center text-white">
        <Loader2 className="h-12 w-12 animate-spin text-indigo-500 mb-4" />
        <p className="text-gray-400">Loading counter...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-red-500/10 p-4 rounded-full mb-6">
          <Activity className="h-12 w-12 text-red-500" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Access Restricted</h1>
        <p className="text-gray-400 mb-8 max-w-md">{error}</p>
        <button
          onClick={handleLogout}
          className="px-6 py-3 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-colors inline-flex items-center gap-2"
        >
          <LogOut className="h-5 w-5" />
          Sign out
        </button>
      </div>
    )
  }

  const isEntry = assignment.type === 'entry'
  const percentage = Math.min(100, Math.round((facility.current_occupancy / facility.max_occupancy) * 100))
  
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col overflow-hidden">
      {/* Dynamic Header */}
      <div className="p-6 border-b border-white/10 flex justify-between items-center bg-gray-900/50 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-10">
            <Image 
              src="/Logo-Final_noname_1 (3).png" 
              alt="MMCM Logo" 
              fill
              className="object-contain"
            />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">{facility.facility_name}</h1>
            <p className="text-xs font-medium uppercase tracking-widest text-indigo-400">{assignment.type} counter</p>
          </div>
        </div>
        <button 
          onClick={handleLogout}
          className="p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-colors border border-white/10"
        >
          <LogOut className="h-5 w-5 text-gray-400" />
        </button>
      </div>

      {/* Main Stats */}
      <div className="flex-grow flex flex-col items-center justify-center p-8">
        <div className="relative mb-12 flex flex-col items-center">
          <div className="text-[10rem] font-black leading-none tracking-tighter tabular-nums select-none drop-shadow-2xl">
            {facility.current_occupancy}
          </div>
          <div className="text-gray-500 text-lg font-medium tracking-wide">
             OF <span className="text-white">{facility.max_occupancy}</span> CAPACITY
          </div>
          
          <div className="mt-8 w-64 h-2 bg-white/10 rounded-full overflow-hidden">
             <div 
              className={`h-full transition-all duration-500 ${percentage >= 90 ? 'bg-red-500' : percentage >= 70 ? 'bg-orange-500' : 'bg-green-500'}`}
              style={{ width: `${percentage}%` }}
             />
          </div>
        </div>

        {/* Massive Interactive Area */}
        <div className="w-full max-w-md aspect-square">
          {isEntry ? (
            <button
              onClick={() => handleUpdate(1)}
              className="w-full h-full bg-green-500 hover:bg-green-400 active:scale-[0.98] transition-all rounded-[3rem] shadow-[0_20px_60px_-15px_rgba(34,197,94,0.3)] flex flex-col items-center justify-center gap-4 group"
            >
              <Plus className="h-32 w-32 text-black stroke-[3]" />
              <span className="text-3xl font-black text-black">ENTRY</span>
            </button>
          ) : (
            <button
              onClick={() => handleUpdate(-1)}
              disabled={facility.current_occupancy <= 0}
              className="w-full h-full bg-red-500 hover:bg-red-400 active:scale-[0.98] transition-all rounded-[3rem] shadow-[0_20px_60px_-15px_rgba(239,68,68,0.3)] flex flex-col items-center justify-center gap-4 group disabled:opacity-50 disabled:grayscale disabled:scale-100"
            >
              <Minus className="h-32 w-32 text-black stroke-[3]" />
              <span className="text-3xl font-black text-black">EXIT</span>
            </button>
          )}
        </div>
      </div>
      
      {/* Bottom context bar */}
      <div className="p-8 text-center bg-white/5 border-t border-white/10 backdrop-blur-xl">
        <p className="text-sm text-gray-400 flex items-center justify-center gap-2">
          <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          Live connection established
        </p>
      </div>
    </div>
  )
}

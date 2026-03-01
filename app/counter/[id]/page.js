'use client'

import { useState, useEffect, use, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import { Plus, Minus, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function CounterPage({ params }) {
  const { id } = use(params); // Unwrapping params for Next.js 15+ 
  const [facility, setFacility] = useState(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const checkUser = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push(`/?redirect=/counter/${id}`)
    }
  }, [id, router])

  const fetchFacility = useCallback(async () => {
    const { data, error } = await supabase
      .from('facilities')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error fetching facility:', error)
      alert('Facility not found or access denied')
      router.push('/admin')
    } else {
      setFacility(data)
    }
    setLoading(false)
  }, [id, router])

  useEffect(() => {
    checkUser()
    // eslint-disable-next-line
    fetchFacility()

    const channel = supabase
      .channel(`public:facilities:id=eq.${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'facilities', filter: `id=eq.${id}` }, (payload) => {
        setFacility(payload.new)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [id, checkUser, fetchFacility])

  const updateOccupancy = async (amount) => {
    // Optimistic UI update
    setFacility((prev) => ({
      ...prev,
      current_occupancy: Math.max(0, prev.current_occupancy + amount)
    }))

    const { error } = await supabase.rpc('increment_occupancy', { row_id: id, amount })
    
    if (error) {
      console.error('Error updating occupancy:', error)
      // Revert if error
      fetchFacility() 
    }
  }

  if (loading || !facility) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    )
  }

  const percentage = Math.min(100, Math.round((facility.current_occupancy / facility.max_occupancy) * 100))
  let colorClass = 'text-green-500'
  if (percentage >= 70) colorClass = 'text-orange-500'
  if (percentage >= 90) colorClass = 'text-red-500'

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <div className="p-4 flex justify-between items-center border-b border-gray-800">
        <Link href="/admin" className="p-2 rounded-full hover:bg-gray-800 transition-colors">
          <ArrowLeft className="h-6 w-6 text-gray-400" />
        </Link>
        <div className="text-center">
          <h1 className="text-lg font-bold text-gray-200">{facility.facility_name}</h1>
          <p className="text-sm text-gray-500">{facility.building_name}</p>
        </div>
        <div className="w-10"></div> {/* Spacer */}
      </div>

      {/* Main Content */}
      <div className="flex-grow flex flex-col items-center justify-center p-4">
        
        {/* Counter Display */}
        <div className="mb-12 text-center">
          <div className={`text-9xl font-bold font-mono tracking-tighter ${colorClass}`}>
            {facility.current_occupancy}
          </div>
          <div className="text-gray-500 mt-2 text-xl">
             of <span className="text-gray-300">{facility.max_occupancy}</span> capacity
          </div>
          
          {/* Progress Bar */}
          <div className="mt-8 w-64 md:w-96 bg-gray-800 rounded-full h-4 overflow-hidden mx-auto">
            <div 
              className={`h-full transition-all duration-300 ${percentage >= 90 ? 'bg-red-600' : percentage >= 70 ? 'bg-orange-500' : 'bg-green-500'}`}
              style={{ width: `${percentage}%` }}
            ></div>
          </div>
          <p className="mt-2 text-gray-400 font-medium">{percentage}% Full</p>
        </div>

        {/* Controls */}
        <div className="grid grid-cols-2 gap-6 w-full max-w-2xl">
          <button
            onClick={() => updateOccupancy(-1)}
            disabled={facility.current_occupancy <= 0}
            className="flex flex-col items-center justify-center p-8 bg-gray-800 rounded-3xl active:bg-gray-700 transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed border-2 border-gray-700 hover:border-red-500 group"
          >
            <Minus className="h-16 w-16 text-red-500 group-hover:text-red-400 mb-2" />
            <span className="text-xl font-bold text-gray-300 group-hover:text-white">EXIT</span>
          </button>

          <button
            onClick={() => updateOccupancy(1)}
            className="flex flex-col items-center justify-center p-8 bg-gray-800 rounded-3xl active:bg-gray-700 transition-all transform active:scale-95 border-2 border-gray-700 hover:border-green-500 group"
          >
            <Plus className="h-16 w-16 text-green-500 group-hover:text-green-400 mb-2" />
            <span className="text-xl font-bold text-gray-300 group-hover:text-white">ENTRY</span>
          </button>
        </div>
      </div>
    </div>
  )
}

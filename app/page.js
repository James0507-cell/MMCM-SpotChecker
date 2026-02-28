'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Search, SortAsc, SortDesc, MapPin, Users, Activity } from 'lucide-react'
import Link from 'next/link'

export default function StudentDashboard() {
  const [facilities, setFacilities] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState('facility_name')
  const [sortOrder, setSortOrder] = useState('asc')
  const [loading, setLoading] = useState(true)

  const fetchFacilities = useCallback(async () => {
    const { data, error } = await supabase
      .from('facilities')
      .select('*')
      .order('facility_name', { ascending: true })

    if (error) console.error('Error fetching facilities:', error)
    else setFacilities(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line
    fetchFacilities()

    // Realtime subscription
    const channel = supabase
      .channel('public:facilities')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'facilities' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setFacilities((prev) => [...prev, payload.new])
        } else if (payload.eventType === 'UPDATE') {
          setFacilities((prev) => prev.map((f) => (f.id === payload.new.id ? payload.new : f)))
        } else if (payload.eventType === 'DELETE') {
          setFacilities((prev) => prev.filter((f) => f.id !== payload.old.id))
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchFacilities])

  // Calculate Occupancy Level
  const getOccupancyLevel = (current, max) => {
    if (max === 0) return 0
    return Math.min(100, Math.round((current / max) * 100))
  }

  // Filter & Sort Logic
  const filteredFacilities = facilities
    .filter((facility) =>
      facility.facility_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      facility.building_name.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      let valA = a[sortBy]
      let valB = b[sortBy]

      if (sortBy === 'occupancy_level') {
        valA = getOccupancyLevel(a.current_occupancy, a.max_occupancy)
        valB = getOccupancyLevel(b.current_occupancy, b.max_occupancy)
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1
      return 0
    })

  const getLevelColor = (level) => {
    if (level >= 90) return 'text-red-600 bg-red-50 border-red-200'
    if (level >= 70) return 'text-orange-600 bg-orange-50 border-orange-200'
    return 'text-green-600 bg-green-50 border-green-200'
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <Activity className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">MMCM SpotChecker</h1>
          </div>
          <div className="flex gap-3">
             <Link href="/login" className="px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors">
              Staff Login
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Controls */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-grow">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-sm"
              placeholder="Search facilities, buildings..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <select
              className="block pl-3 pr-10 py-3 border border-gray-200 rounded-xl leading-5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="facility_name">Name</option>
              <option value="building_name">Building</option>
              <option value="occupancy_level">Occupancy Level</option>
              <option value="current_occupancy">Current Count</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="p-3 border border-gray-200 rounded-xl bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm transition-colors"
            >
              {sortOrder === 'asc' ? <SortAsc className="h-5 w-5 text-gray-600" /> : <SortDesc className="h-5 w-5 text-gray-600" />}
            </button>
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-4 text-gray-500">Loading spots...</p>
          </div>
        ) : filteredFacilities.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl shadow-sm border border-gray-100">
            <MapPin className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900">No facilities found</h3>
            <p className="text-gray-500">Try adjusting your search or filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredFacilities.map((facility) => {
              const level = getOccupancyLevel(facility.current_occupancy, facility.max_occupancy)
              const levelColorClass = getLevelColor(level)

              return (
                <div key={facility.id} className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 border border-gray-100 overflow-hidden group">
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 mb-2">
                          {facility.building_name}
                        </span>
                        <h3 className="text-xl font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">
                          {facility.facility_name}
                        </h3>
                      </div>
                      <div className={`flex flex-col items-center justify-center h-14 w-14 rounded-xl border ${levelColorClass}`}>
                        <span className="text-sm font-bold">{level}%</span>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                        <div
                          className={`h-2.5 rounded-full transition-all duration-500 ${
                            level >= 90 ? 'bg-red-500' : level >= 70 ? 'bg-orange-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${level}%` }}
                        ></div>
                      </div>

                      <div className="flex justify-between text-sm text-gray-600 font-medium">
                        <div className="flex items-center gap-1.5">
                          <Users className="h-4 w-4 text-gray-400" />
                          <span>Occupancy</span>
                        </div>
                        <span className="text-gray-900">
                          {facility.current_occupancy} <span className="text-gray-400">/ {facility.max_occupancy}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}

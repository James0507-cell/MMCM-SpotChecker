'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Search, SortAsc, SortDesc, MapPin, Users, Activity, X, Plus, LogOut, LayoutDashboard, Shield, Key } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { timSort } from '@/lib/sorting'
import ChangePasswordModal from '@/components/ChangePasswordModal'

export default function StudentDashboard() {
  const [facilities, setFacilities] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [sortStack, setSortStack] = useState([{ field: 'facility_name', order: 'asc' }])
  const [selectedBuilding, setSelectedBuilding] = useState('all')
  const [selectedOccupancyLevel, setSelectedOccupancyLevel] = useState('all')
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const [userRole, setUserRole] = useState(null)
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false)
  const router = useRouter()

  const fetchUser = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      setUser(session.user)
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()
      setUserRole(profile?.role)
    }
  }, [])

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
    fetchUser()
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
  }, [fetchFacilities, fetchUser])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setUserRole(null)
    router.push('/')
  }

  // Get unique buildings for the filter
  const buildings = useMemo(() => {
    const unique = ['all', ...new Set(facilities.map(f => f.building_name))]
    return timSort(unique, (a, b) => {
      if (a === 'all') return -1
      if (b === 'all') return 1
      return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    })
  }, [facilities])

  // Calculate Occupancy Level
  const getOccupancyLevel = (current, max) => {
    if (max === 0) return 0
    return Math.min(100, Math.round((current / max) * 100))
  }

  // Create a Hash-based Inverted Index for fast searching
  const searchIndex = useMemo(() => {
    const index = new Map() // Token -> Set of Facility IDs

    facilities.forEach(f => {
      const level = getOccupancyLevel(f.current_occupancy, f.max_occupancy)
      // Tokenize all 5 attributes
      const tokens = new Set([
        ...f.facility_name.toLowerCase().split(/\s+/),
        ...f.building_name.toLowerCase().split(/\s+/),
        level.toString(),
        f.current_occupancy.toString(),
        f.max_occupancy.toString()
      ])

      tokens.forEach(token => {
        if (token) {
          if (!index.has(token)) index.set(token, new Set())
          index.get(token).add(f.id)
        }
      })
    })
    return index
  }, [facilities])

  // Multi-level Sort Logic
  const filteredFacilities = useMemo(() => {
    // Split search terms by comma and trim whitespace
    const searchTerms = searchTerm.split(',').map(term => term.trim().toLowerCase()).filter(term => term !== '')

    const filtered = facilities.filter((facility) => {
      const level = getOccupancyLevel(facility.current_occupancy, facility.max_occupancy)
      
      // If no search terms, everything matches
      let matchesSearch = true
      if (searchTerms.length > 0) {
        // Every term must be found in the index OR match partially (fallback)
        matchesSearch = searchTerms.every(term => {
          // 1. Direct Hash Match (O(1))
          if (searchIndex.get(term)?.has(facility.id)) return true

          // 2. Partial Match Fallback (O(n) for the term, but better UX)
          // This allows "Gym" to still match "Gymnasium" if "gym" isn't a full token
          return (
            facility.facility_name.toLowerCase().includes(term) ||
            facility.building_name.toLowerCase().includes(term) ||
            level.toString().includes(term) ||
            facility.current_occupancy.toString().includes(term) ||
            facility.max_occupancy.toString().includes(term)
          )
        })
      }
      
      const matchesBuilding = selectedBuilding === 'all' || facility.building_name === selectedBuilding
      
      let matchesLevel = true
      if (selectedOccupancyLevel === 'available') matchesLevel = level < 70
      else if (selectedOccupancyLevel === 'high') matchesLevel = level >= 70 && level < 95
      else if (selectedOccupancyLevel === 'full') matchesLevel = level >= 95

      return matchesSearch && matchesBuilding && matchesLevel
    })

    return timSort(filtered, (a, b) => {
      for (const sort of sortStack) {
        let valA = a[sort.field]
        let valB = b[sort.field]

        if (sort.field === 'occupancy_level') {
          valA = getOccupancyLevel(a.current_occupancy, a.max_occupancy)
          valB = getOccupancyLevel(b.current_occupancy, b.max_occupancy)
        }

        if (typeof valA === 'string' && typeof valB === 'string') {
          const res = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' })
          if (res !== 0) {
            return sort.order === 'asc' ? res : -res
          }
        } else {
          if (valA < valB) return sort.order === 'asc' ? -1 : 1
          if (valA > valB) return sort.order === 'asc' ? 1 : -1
        }
      }
      return 0
    })
  }, [facilities, searchTerm, sortStack, selectedBuilding, selectedOccupancyLevel])

  const addSortLevel = () => {
    setSortStack([...sortStack, { field: 'facility_name', order: 'asc' }])
  }

  const removeSortLevel = (index) => {
    if (sortStack.length > 1) {
      setSortStack(sortStack.filter((_, i) => i !== index))
    }
  }

  const updateSortLevel = (index, updates) => {
    const newStack = [...sortStack]
    newStack[index] = { ...newStack[index], ...updates }
    setSortStack(newStack)
  }

  const getLevelColor = (level) => {
    if (level >= 90) return 'text-red-600 bg-red-50 border-red-200'
    if (level >= 70) return 'text-orange-600 bg-orange-50 border-orange-200'
    return 'text-green-600 bg-green-50 border-green-200'
  }

  const sortOptions = [
    { label: 'Facility Name', value: 'facility_name' },
    { label: 'Building Name', value: 'building_name' },
    { label: 'Occupancy Level', value: 'occupancy_level' },
    { label: 'Occupancy Count', value: 'current_occupancy' },
    { label: 'Max Occupancy', value: 'max_occupancy' },
  ]

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="relative h-10 w-10">
              <Image 
                src="/Logo-Final_noname_1 (3).png" 
                alt="MMCM Logo" 
                fill
                className="object-contain"
              />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">MMCM SpotChecker</h1>
          </div>
          <div className="flex gap-3">
            {user ? (
              <div className="flex items-center gap-3">
                {userRole === 'admin' && (
                  <Link href="/admin" className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-all">
                    <Shield className="h-4 w-4" />
                    Admin
                  </Link>
                )}
                {userRole === 'counter' && (
                  <Link href="/counter" className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-all">
                    <LayoutDashboard className="h-4 w-4" />
                    Counter
                  </Link>
                )}
                <button 
                  onClick={() => setIsPasswordModalOpen(true)}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all"
                >
                  <Key className="h-4 w-4" />
                  Password
                </button>
                <button 
                  onClick={handleLogout} 
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-all"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </div>
            ) : (
              <Link href="/" className="px-5 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-100 transition-all active:scale-95">
                Staff Login
              </Link>
            )}
          </div>
        </div>
      </header>

      <ChangePasswordModal 
        isOpen={isPasswordModalOpen} 
        onClose={() => setIsPasswordModalOpen(false)} 
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search and Filters */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <div className="relative lg:col-span-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-sm"
              placeholder="Search (e.g. Gym, Building 1, 50%)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4 lg:col-span-2">
            <div className="flex flex-col gap-1.5">
              <select
                className="block w-full pl-3 pr-10 py-3 border border-gray-200 rounded-xl leading-5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm"
                value={selectedBuilding}
                onChange={(e) => setSelectedBuilding(e.target.value)}
              >
                {buildings.map(b => (
                  <option key={b} value={b}>{b === 'all' ? 'All Buildings' : b}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <select
                className="block w-full pl-3 pr-10 py-3 border border-gray-200 rounded-xl leading-5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm"
                value={selectedOccupancyLevel}
                onChange={(e) => setSelectedOccupancyLevel(e.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="available">Available (&lt;70%)</option>
                <option value="high">High (70-95%)</option>
                <option value="full">Full (&gt;95%)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Sorting Controls */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm mb-8">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
              <SortAsc className="h-4 w-4" />
              Sorting Priority
            </h3>
            <button
              onClick={addSortLevel}
              className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors flex items-center gap-1"
            >
              <Plus className="h-3 w-3" />
              Add Sort Level
            </button>
          </div>
          
          <div className="flex flex-wrap gap-3">
            {sortStack.map((sort, index) => (
              <div key={index} className="flex items-center gap-2 bg-gray-50 p-2 rounded-xl border border-gray-100 animate-in fade-in slide-in-from-left-2">
                <span className="text-xs font-bold text-gray-400 ml-1">{index + 1}.</span>
                <select
                  className="bg-transparent text-sm font-medium focus:outline-none border-none p-0 pr-6"
                  value={sort.field}
                  onChange={(e) => updateSortLevel(index, { field: e.target.value })}
                >
                  {sortOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <button
                  onClick={() => updateSortLevel(index, { order: sort.order === 'asc' ? 'desc' : 'asc' })}
                  className="p-1 hover:bg-white rounded-md transition-colors"
                  title={sort.order === 'asc' ? 'Ascending' : 'Descending'}
                >
                  {sort.order === 'asc' ? <SortAsc className="h-4 w-4 text-indigo-600" /> : <SortDesc className="h-4 w-4 text-indigo-600" />}
                </button>
                {sortStack.length > 1 && (
                  <button
                    onClick={() => removeSortLevel(index)}
                    className="p-1 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-md transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
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

'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Search, SortAsc, SortDesc, MapPin, Users, Activity, X, Plus, LogOut, LayoutDashboard, Shield, Key, Filter, ChevronDown } from 'lucide-react'
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
  const [isFilterVisible, setIsFilterVisible] = useState(false)
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
    fetchFacilities()

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

  const buildings = useMemo(() => {
    const unique = ['all', ...new Set(facilities.map(f => f.building_name))]
    return timSort(unique, (a, b) => {
      if (a === 'all') return -1
      if (b === 'all') return 1
      return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    })
  }, [facilities])

  const getOccupancyLevel = (current, max) => {
    if (max === 0) return 0
    return Math.min(100, Math.round((current / max) * 100))
  }

  const searchIndex = useMemo(() => {
    const index = new Map()
    facilities.forEach(f => {
      const level = getOccupancyLevel(f.current_occupancy, f.max_occupancy)
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

  const filteredFacilities = useMemo(() => {
    const searchTerms = searchTerm.split(',').map(term => term.trim().toLowerCase()).filter(term => term !== '')
    const filtered = facilities.filter((facility) => {
      const level = getOccupancyLevel(facility.current_occupancy, facility.max_occupancy)
      let matchesSearch = true
      if (searchTerms.length > 0) {
        matchesSearch = searchTerms.every(term => {
          if (searchIndex.get(term)?.has(facility.id)) return true
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
          if (res !== 0) return sort.order === 'asc' ? res : -res
        } else {
          if (valA < valB) return sort.order === 'asc' ? -1 : 1
          if (valA > valB) return sort.order === 'asc' ? 1 : -1
        }
      }
      return 0
    })
  }, [facilities, searchTerm, sortStack, selectedBuilding, selectedOccupancyLevel, searchIndex])

  const addSortLevel = () => setSortStack([...sortStack, { field: 'facility_name', order: 'asc' }])
  const removeSortLevel = (index) => sortStack.length > 1 && setSortStack(sortStack.filter((_, i) => i !== index))
  const updateSortLevel = (index, updates) => {
    const newStack = [...sortStack]
    newStack[index] = { ...newStack[index], ...updates }
    setSortStack(newStack)
  }

  const getLevelColor = (level) => {
    if (level >= 90) return 'text-rose-600 bg-rose-50 border-rose-100'
    if (level >= 70) return 'text-amber-600 bg-amber-50 border-amber-100'
    return 'text-emerald-600 bg-emerald-50 border-emerald-100'
  }

  const sortOptions = [
    { label: 'Facility Name', value: 'facility_name' },
    { label: 'Building Name', value: 'building_name' },
    { label: 'Occupancy Level', value: 'occupancy_level' },
    { label: 'Occupancy Count', value: 'current_occupancy' },
    { label: 'Max Occupancy', value: 'max_occupancy' },
  ]

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-xl sticky top-0 z-30 border-b border-slate-200/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-white rounded-2xl shadow-lg shadow-indigo-100/50">
              <div className="relative h-10 w-10">
                <Image src="/Logo-Final_noname_1 (3).png" alt="MMCM Logo" fill className="object-contain" />
              </div>
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none">SpotChecker</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Real-time Occupancy</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex flex-col items-end mr-2">
                  <span className="text-xs font-bold text-slate-900">{user.email?.split('@')[0]}</span>
                  <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">{userRole}</span>
                </div>
                {userRole === 'admin' && (
                  <Link href="/admin" className="p-2.5 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-2xl transition-all" title="Admin Panel">
                    <Shield className="h-5 w-5" />
                  </Link>
                )}
                {userRole === 'counter' && (
                  <Link href="/counter" className="p-2.5 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-2xl transition-all" title="Counter Dashboard">
                    <LayoutDashboard className="h-5 w-5" />
                  </Link>
                )}
                <button onClick={() => setIsPasswordModalOpen(true)} className="p-2.5 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-2xl transition-all" title="Change Password">
                  <Key className="h-5 w-5" />
                </button>
                <button onClick={handleLogout} className="p-2.5 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-2xl transition-all" title="Logout">
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            ) : (
              <Link href="/" className="px-6 py-3 text-sm font-bold text-white bg-slate-900 hover:bg-black rounded-2xl shadow-xl shadow-slate-200 transition-all active:scale-95">
                Staff Login
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Welcome Section */}
        <div className="mb-10">
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Available Spots</h2>
          <p className="text-slate-500 font-medium mt-1">Check current occupancy levels across MMCM facilities.</p>
        </div>

        {/* Search & Actions Bar */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-1 group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors">
              <Search className="h-5 w-5" />
            </div>
            <input
              type="text"
              className="block w-full pl-12 pr-4 py-4 bg-white border-2 border-transparent rounded-[1.5rem] shadow-sm focus:border-indigo-500 focus:ring-0 transition-all outline-none font-medium text-slate-600 placeholder-slate-400"
              placeholder="Search facilities, buildings, or levels..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button 
            onClick={() => setIsFilterVisible(!isFilterVisible)}
            className={`px-6 py-4 rounded-[1.5rem] font-bold flex items-center justify-center gap-2 transition-all shadow-sm ${
              isFilterVisible ? 'bg-indigo-600 text-white shadow-indigo-200' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-100'
            }`}
          >
            <Filter className="h-5 w-5" />
            Filters
            <ChevronDown className={`h-4 w-4 transition-transform ${isFilterVisible ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Expandable Filters & Sorting */}
        {isFilterVisible && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-10 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="lg:col-span-4 space-y-4">
              <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Filter By</h3>
                <div className="space-y-3">
                  <select
                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium text-slate-600 transition-all appearance-none"
                    value={selectedBuilding}
                    onChange={(e) => setSelectedBuilding(e.target.value)}
                  >
                    {buildings.map(b => (
                      <option key={b} value={b}>{b === 'all' ? '🏢 All Buildings' : `🏢 ${b}`}</option>
                    ))}
                  </select>
                  <select
                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium text-slate-600 transition-all appearance-none"
                    value={selectedOccupancyLevel}
                    onChange={(e) => setSelectedOccupancyLevel(e.target.value)}
                  >
                    <option value="all">📊 All Statuses</option>
                    <option value="available">🟢 Available (&lt;70%)</option>
                    <option value="high">🟡 High (70-95%)</option>
                    <option value="full">🔴 Full (&gt;95%)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="lg:col-span-8">
              <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm h-full">
                <div className="flex justify-between items-center mb-6 px-1">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Sorting Priority</h3>
                  <button onClick={addSortLevel} className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1.5 p-1">
                    <Plus className="h-4 w-4" /> Add Level
                  </button>
                </div>
                <div className="flex flex-wrap gap-3">
                  {sortStack.map((sort, index) => (
                    <div key={index} className="flex items-center gap-2 bg-slate-50 pl-4 pr-2 py-2.5 rounded-2xl border border-slate-100 group">
                      <span className="text-[10px] font-black text-slate-300">{index + 1}</span>
                      <select
                        className="bg-transparent text-xs font-bold text-slate-600 focus:outline-none border-none p-0 pr-4"
                        value={sort.field}
                        onChange={(e) => updateSortLevel(index, { field: e.target.value })}
                      >
                        {sortOptions.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => updateSortLevel(index, { order: sort.order === 'asc' ? 'desc' : 'asc' })}
                        className="p-1.5 hover:bg-white rounded-xl transition-all text-indigo-600"
                      >
                        {sort.order === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
                      </button>
                      {sortStack.length > 1 && (
                        <button onClick={() => removeSortLevel(index)} className="p-1.5 hover:bg-rose-50 text-slate-300 hover:text-rose-500 rounded-xl transition-all">
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Facility Grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 animate-pulse">
            <div className="h-12 w-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Syncing real-time data...</p>
          </div>
        ) : filteredFacilities.length === 0 ? (
          <div className="text-center py-24 bg-white rounded-[3rem] shadow-sm border border-slate-100">
            <div className="p-6 bg-slate-50 rounded-full inline-flex mb-6 text-slate-300">
              <Search className="h-12 w-12" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900">No facilities match</h3>
            <p className="text-slate-500 mt-2 font-medium">Try adjusting your filters or search terms.</p>
          </div>
        ) : (
          <div className="max-h-[70vh] overflow-y-auto pr-4 -mr-4 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-10">
              {filteredFacilities.map((facility) => {
                const level = getOccupancyLevel(facility.current_occupancy, facility.max_occupancy)
                const colorClasses = getLevelColor(level)

                return (
                  <div key={facility.id} className="group bg-white rounded-[2.5rem] shadow-sm hover:shadow-2xl hover:shadow-slate-200 transition-all duration-500 border border-slate-100/60 overflow-hidden relative flex flex-col">
                    <div className="p-8 pb-4">
                      <div className="flex justify-between items-start mb-6">
                        <div className="space-y-1">
                          <span className="inline-flex px-3 py-1 bg-slate-100 rounded-full text-[10px] font-black text-slate-500 uppercase tracking-widest">
                            {facility.building_name}
                          </span>
                          <h3 className="text-2xl font-black text-slate-900 group-hover:text-indigo-600 transition-colors leading-tight pt-1">
                            {facility.facility_name}
                          </h3>
                        </div>
                        <div className={`flex flex-col items-center justify-center h-16 w-16 rounded-3xl border-2 font-black text-lg shadow-sm ${colorClasses}`}>
                          {level}%
                        </div>
                      </div>

                      <div className="space-y-6">
                        {/* Better Progress Bar */}
                        <div className="space-y-2">
                          <div className="flex justify-between items-end px-1">
                             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Capacity Usage</span>
                             <span className="text-sm font-bold text-slate-900">{facility.current_occupancy} <span className="text-slate-300">/ {facility.max_occupancy}</span></span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden p-0.5">
                            <div
                              className={`h-full rounded-full transition-all duration-700 ease-out ${
                                level >= 90 ? 'bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.4)]' : 
                                level >= 70 ? 'bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.4)]' : 
                                'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.4)]'
                              }`}
                              style={{ width: `${level}%` }}
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between py-4 border-t border-slate-50">
                          <div className="flex items-center gap-2.5 text-slate-400">
                            <div className="p-2 bg-slate-50 rounded-xl group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-colors">
                              <Activity className="h-4 w-4" />
                            </div>
                            <span className="text-xs font-bold uppercase tracking-widest">Live Status</span>
                          </div>
                          <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-lg ${
                             level >= 95 ? 'text-rose-600 bg-rose-50' : 
                             level >= 70 ? 'text-amber-600 bg-amber-50' : 
                             'text-emerald-600 bg-emerald-50'
                          }`}>
                            {level >= 95 ? 'Critical' : level >= 70 ? 'Busy' : 'Available'}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Decorative element */}
                    <div className="mt-auto h-1.5 w-full bg-slate-50 group-hover:bg-indigo-500 transition-colors duration-500" />
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </main>

      <ChangePasswordModal isOpen={isPasswordModalOpen} onClose={() => setIsPasswordModalOpen(false)} />
      
      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 border-t border-slate-100 mt-20">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
            <div className="relative h-8 w-8">
              <Image src="/Logo-Final_noname_1 (3).png" alt="MMCM Logo" fill className="object-contain" />
            </div>
            <span className="font-black text-slate-900 tracking-tight">SpotChecker</span>
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
            Empowering MMCM Student Life &copy; {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </div>
  )
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Plus, Trash2, LogOut, Building2, LayoutDashboard, UserPlus, Users, ArrowRight, Activity, Search, Trash, Shield } from 'lucide-react'

export default function AdminDashboard() {
  const [facilities, setFacilities] = useState([])
  const [profiles, setProfiles] = useState([])
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [userSearchTerm, setUserSearchTerm] = useState('')
  const [newFacility, setNewFacility] = useState({ building_name: '', facility_name: '', max_occupancy: '' })
  const [assignmentForm, setAssignmentForm] = useState({ user_id: '', facility_id: '', type: 'entry' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()

  const checkUser = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push('/login')
      return
    }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
    if (profile?.role !== 'admin') {
      router.push('/counter')
    }
  }, [router])

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [facs, profs, assigns] = await Promise.all([
      supabase.from('facilities').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*').order('role', { ascending: true }),
      supabase.from('counter_assignments').select('*, facilities(facility_name)')
    ])

    if (facs.data) setFacilities(facs.data)
    if (profs.data) setProfiles(profs.data)
    if (assigns.data) setAssignments(assigns.data)
    setLoading(false)
  }, [])

  useEffect(() => {
    checkUser()
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData()

    const channel = supabase
      .channel('admin:realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'facilities' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => fetchData())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [checkUser, fetchData])

  const handleUpdateRole = async (userId, newRole) => {
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId)

    if (error) alert(error.message)
    else fetchData()
  }

  const handleAddFacility = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)
    const { data, error } = await supabase.from('facilities').insert([{
      building_name: newFacility.building_name,
      facility_name: newFacility.facility_name,
      max_occupancy: parseInt(newFacility.max_occupancy)
    }]).select()

    if (error) alert(error.message)
    else {
      setFacilities([data[0], ...facilities])
      setNewFacility({ building_name: '', facility_name: '', max_occupancy: '' })
    }
    setIsSubmitting(false)
  }

  const handleAssignCounter = async (e) => {
    e.preventDefault()
    const { error } = await supabase.from('counter_assignments').upsert([{
      user_id: assignmentForm.user_id,
      facility_id: assignmentForm.facility_id,
      type: assignmentForm.type
    }])

    if (error) alert(error.message)
    else fetchData()
  }

  const handleDeleteAssignment = async (id) => {
    const { error } = await supabase.from('counter_assignments').delete().eq('id', id)
    if (error) alert(error.message)
    else fetchData()
  }

  const handleDeleteFacility = async (id) => {
    if (!confirm('Are you sure? This will delete all associated assignments.')) return
    const { error } = await supabase.from('facilities').delete().eq('id', id)
    if (error) alert(error.message)
    else fetchData()
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="relative h-8 w-8">
                <Image 
                  src="/Logo-Final_noname_1 (3).png" 
                  alt="MMCM Logo" 
                  fill
                  className="object-contain"
                />
              </div>
              <span className="text-xl font-bold tracking-tight">Admin Control</span>
            </div>
            <div className="flex items-center gap-6">
              <Link href="/" className="text-sm font-medium text-gray-500 hover:text-indigo-600 transition-colors">
                Student Site
              </Link>
              <button onClick={handleLogout} className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Statistics Strip */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Total Facilities</p>
              <p className="text-2xl font-bold">{facilities.length}</p>
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-green-50 rounded-xl text-green-600">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Active Counters</p>
              <p className="text-2xl font-bold">{assignments.length}</p>
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-orange-50 rounded-xl text-orange-600">
              <Activity className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">System Health</p>
              <p className="text-2xl font-bold">Stable</p>
            </div>
          </div>
        </div>

        {/* User Management Section */}
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              User Management
              <span className="text-sm font-medium bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{profiles.length}</span>
            </h2>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50">
               <div className="relative">
                  <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input 
                    type="text" 
                    placeholder="Search users by ID..." 
                    className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    value={userSearchTerm}
                    onChange={e => setUserSearchTerm(e.target.value)}
                  />
               </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50/50 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">User ID</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Role</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {profiles.filter(p => p.id.toLowerCase().includes(userSearchTerm.toLowerCase())).map(profile => (
                    <tr key={profile.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <span className="text-sm font-mono text-gray-600">{profile.id}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          profile.role === 'admin' ? 'bg-indigo-100 text-indigo-800' : 'bg-green-100 text-green-800'
                        }`}>
                          {profile.role === 'admin' ? <Shield className="h-3 w-3 mr-1" /> : <Users className="h-3 w-3 mr-1" />}
                          {profile.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <select
                          className="text-sm bg-white border border-gray-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-500"
                          value={profile.role}
                          onChange={(e) => handleUpdateRole(profile.id, e.target.value)}
                        >
                          <option value="counter">Counter</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Facilities Management */}
          <div className="lg:col-span-8 space-y-8">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                Facilities 
                <span className="text-sm font-medium bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{facilities.length}</span>
              </h2>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50">
                 <div className="relative">
                    <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input 
                      type="text" 
                      placeholder="Search facilities..." 
                      className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                    />
                 </div>
              </div>
              <ul className="divide-y divide-gray-100">
                {facilities.filter(f => f.facility_name.toLowerCase().includes(searchTerm.toLowerCase())).map(facility => {
                  const level = Math.round((facility.current_occupancy / facility.max_occupancy) * 100)
                  return (
                    <li key={facility.id} className="p-6 flex items-center justify-between hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 font-bold">
                          {facility.facility_name[0]}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">{facility.facility_name}</p>
                          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">{facility.building_name}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-8">
                         <div className="text-right">
                            <p className="text-sm font-bold">{facility.current_occupancy} / {facility.max_occupancy}</p>
                            <div className="w-24 h-1.5 bg-gray-100 rounded-full mt-1 overflow-hidden">
                               <div className={`h-full ${level >= 90 ? 'bg-red-500' : 'bg-indigo-500'}`} style={{ width: `${level}%` }} />
                            </div>
                         </div>
                         <button 
                          onClick={() => handleDeleteFacility(facility.id)}
                          className="p-2 text-gray-300 hover:text-red-600 transition-colors"
                         >
                          <Trash className="h-5 w-5" />
                         </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>

            <div className="bg-white p-8 rounded-3xl border border-dashed border-gray-200 shadow-sm">
               <h3 className="text-lg font-bold mb-6">Create New Facility</h3>
               <form onSubmit={handleAddFacility} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <input 
                    type="text" placeholder="Facility Name" required
                    className="p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    value={newFacility.facility_name}
                    onChange={e => setNewFacility({...newFacility, facility_name: e.target.value})}
                  />
                  <input 
                    type="text" placeholder="Building" required
                    className="p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    value={newFacility.building_name}
                    onChange={e => setNewFacility({...newFacility, building_name: e.target.value})}
                  />
                  <div className="flex gap-2">
                    <input 
                      type="number" placeholder="Max" required
                      className="p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 w-full"
                      value={newFacility.max_occupancy}
                      onChange={e => setNewFacility({...newFacility, max_occupancy: e.target.value})}
                    />
                    <button type="submit" className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors">
                      <Plus className="h-6 w-6" />
                    </button>
                  </div>
               </form>
            </div>
          </div>

          {/* User Assignments */}
          <div className="lg:col-span-4 space-y-8">
            <h2 className="text-2xl font-bold tracking-tight">Counter Roles</h2>
            
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-6">
               <h3 className="font-bold flex items-center gap-2"><UserPlus className="h-4 w-4" /> Assign Counter</h3>
               <form onSubmit={handleAssignCounter} className="space-y-4">
                  <select 
                    className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none"
                    value={assignmentForm.user_id}
                    required
                    onChange={e => setAssignmentForm({...assignmentForm, user_id: e.target.value})}
                  >
                    <option value="">Select User ID...</option>
                    {profiles.map(p => (
                      <option key={p.id} value={p.id}>{p.id.slice(0, 13)}...</option>
                    ))}
                  </select>
                  <select 
                    className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none"
                    value={assignmentForm.facility_id}
                    required
                    onChange={e => setAssignmentForm({...assignmentForm, facility_id: e.target.value})}
                  >
                    <option value="">Select Facility...</option>
                    {facilities.map(f => (
                      <option key={f.id} value={f.id}>{f.facility_name}</option>
                    ))}
                  </select>
                  <select 
                    className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none"
                    value={assignmentForm.type}
                    required
                    onChange={e => setAssignmentForm({...assignmentForm, type: e.target.value})}
                  >
                    <option value="entry">Entry Only</option>
                    <option value="exit">Exit Only</option>
                  </select>
                  <button className="w-full py-3 bg-gray-900 text-white font-bold rounded-xl hover:bg-black transition-colors">
                    Save Assignment
                  </button>
               </form>
               <p className="text-[10px] text-gray-400 font-medium leading-relaxed">
                 Note: Users must register an account first. Use their UUID to assign them to a facility.
               </p>
            </div>

            <div className="space-y-4">
               <h3 className="font-bold text-gray-500 text-sm uppercase tracking-widest">Active Links</h3>
               {assignments.map(a => (
                 <div key={a.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                       <div className={`h-2 w-2 rounded-full ${a.type === 'entry' ? 'bg-green-500' : 'bg-red-500'}`} />
                       <div>
                          <p className="text-sm font-bold">{a.facilities?.facility_name}</p>
                          <p className="text-[10px] text-gray-400 font-mono">{a.user_id.slice(0, 13)}...</p>
                       </div>
                    </div>
                    <button onClick={() => handleDeleteAssignment(a.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                 </div>
               ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

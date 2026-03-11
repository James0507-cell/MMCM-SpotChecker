'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Plus, Trash2, LogOut, Building2, LayoutDashboard, UserPlus, Users, Activity, Search, Trash, Shield, ArrowRight, Settings, ExternalLink } from 'lucide-react'

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
      router.push('/')
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
      supabase.from('profiles_with_emails').select('*').order('role', { ascending: true }),
      supabase.from('counter_assignments').select(`
        *,
        facilities (
          facility_name
        )
      `)
    ])

    if (facs.data) setFacilities(facs.data)
    if (profs.data) setProfiles(profs.data)
    if (assigns.data) setAssignments(assigns.data)
    setLoading(false)
  }, [])

  useEffect(() => {
    checkUser()
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
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-[#f1f5f9] text-slate-900 font-sans">
      {/* Admin Top Nav */}
      <nav className="bg-slate-900 text-white sticky top-0 z-30 shadow-xl shadow-slate-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-20">
            <div className="flex items-center gap-4">
              <div className="p-1.5 bg-white rounded-xl">
                <div className="relative h-8 w-8">
                  <Image src="/Logo-Final_noname_1 (3).png" alt="MMCM Logo" fill className="object-contain" />
                </div>
              </div>
              <div>
                <span className="text-xl font-black tracking-tight block leading-none">Admin Hub</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Management Portal</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-300 hover:text-white transition-all bg-slate-800 rounded-xl">
                <ExternalLink className="h-4 w-4" /> Student Site
              </Link>
              <div className="h-8 w-[1px] bg-slate-700" />
              <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-rose-400 hover:text-rose-300 transition-all bg-rose-500/10 hover:bg-rose-500/20 rounded-xl border border-rose-500/20">
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-10 px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">System Overview</h1>
            <p className="text-slate-500 font-medium mt-1">Manage infrastructure, user roles, and assignments.</p>
          </div>
          <div className="flex gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
            <span className="px-3 py-1 bg-white border border-slate-200 rounded-lg">Last Updated: {new Date().toLocaleTimeString()}</span>
          </div>
        </div>

        {/* Analytics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-[2rem] border border-slate-200/60 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 text-indigo-50 transition-transform group-hover:scale-110 duration-500">
              <Building2 className="h-16 w-16" />
            </div>
            <div className="relative z-10">
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Total Facilities</p>
              <p className="text-4xl font-black text-slate-900">{facilities.length}</p>
              <div className="mt-4 flex items-center gap-1.5 text-xs font-bold text-indigo-600">
                <div className="h-1.5 w-1.5 rounded-full bg-indigo-600 animate-pulse" /> Live in system
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-[2rem] border border-slate-200/60 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 text-emerald-50 transition-transform group-hover:scale-110 duration-500">
              <Users className="h-16 w-16" />
            </div>
            <div className="relative z-10">
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Assigned Counters</p>
              <p className="text-4xl font-black text-slate-900">{assignments.length}</p>
              <div className="mt-4 flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" /> Active nodes
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-[2rem] border border-slate-200/60 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 text-amber-50 transition-transform group-hover:scale-110 duration-500">
              <Shield className="h-16 w-16" />
            </div>
            <div className="relative z-10">
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Admin Users</p>
              <p className="text-4xl font-black text-slate-900">{profiles.filter(p => p.role === 'admin').length}</p>
              <div className="mt-4 flex items-center gap-1.5 text-xs font-bold text-amber-600">
                High privilege access
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-[2rem] border border-slate-200/60 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 text-rose-50 transition-transform group-hover:scale-110 duration-500">
              <Activity className="h-16 w-16" />
            </div>
            <div className="relative z-10">
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">System Load</p>
              <p className="text-4xl font-black text-slate-900">Optimal</p>
              <div className="mt-4 flex items-center gap-1.5 text-xs font-bold text-rose-600">
                Real-time syncing
              </div>
            </div>
          </div>
        </div>

        {/* User Management Section */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-white rounded-2xl shadow-sm border border-slate-200">
                <Users className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">User Management</h2>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Assign roles and verify access</p>
              </div>
            </div>
            <div className="relative max-w-xs w-full">
              <Search className="h-4 w-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search users by email..." 
                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all shadow-sm"
                value={userSearchTerm}
                onChange={e => setUserSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="bg-white rounded-[2.5rem] border border-slate-200/60 shadow-xl shadow-slate-200/40 overflow-hidden">
            <div className="max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
              <table className="w-full text-left">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-slate-50 border-b border-slate-200/60">
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Identity</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Role Type</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {profiles.filter(p => p.email.toLowerCase().includes(userSearchTerm.toLowerCase())).map(profile => (
                    <tr key={profile.id} className="group hover:bg-slate-50/50 transition-colors">
                      <td className="px-8 py-6">
                        <div className="flex flex-col">
                          <span className="text-sm font-black text-slate-900 group-hover:text-indigo-600 transition-colors">{profile.email}</span>
                          <span className="text-[10px] font-mono text-slate-400 mt-0.5 tracking-tighter">{profile.id}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <span className={`inline-flex items-center px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                          profile.role === 'admin' ? 'bg-indigo-50 text-indigo-700' : 
                          profile.role === 'counter' ? 'bg-emerald-50 text-emerald-700' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {profile.role === 'admin' ? <Shield className="h-3 w-3 mr-1.5" /> : 
                           profile.role === 'counter' ? <Users className="h-3 w-3 mr-1.5" /> :
                           <Activity className="h-3 w-3 mr-1.5" />}
                          {profile.role}
                        </span>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="inline-flex items-center p-1 bg-white border border-slate-200 rounded-xl shadow-sm">
                          <select
                            className="text-xs font-bold bg-transparent border-none px-3 py-1.5 outline-none focus:ring-0 text-slate-600"
                            value={profile.role}
                            onChange={(e) => handleUpdateRole(profile.id, e.target.value)}
                          >
                            <option value="student">Student</option>
                            <option value="counter">Counter</option>
                            <option value="admin">Admin</option>
                          </select>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 pt-6">
          {/* Facilities Management */}
          <div className="lg:col-span-7 space-y-8">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-white rounded-2xl shadow-sm border border-slate-200">
                <Building2 className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Infrastructure</h2>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Facilities & Capacity Control</p>
              </div>
            </div>

            <div className="bg-white rounded-[2.5rem] border border-slate-200/60 shadow-xl shadow-slate-200/40 overflow-hidden">
              <div className="px-8 py-6 border-b border-slate-200/60 flex items-center justify-between gap-4">
                 <div className="relative flex-1">
                    <Search className="h-4 w-4 absolute left-0 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Filter facilities..." 
                      className="w-full pl-6 pr-4 py-2 bg-transparent text-sm font-bold text-slate-600 outline-none placeholder-slate-400"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                    />
                 </div>
              </div>
              <div className="max-h-[500px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                <ul className="divide-y divide-slate-50">
                  {facilities.filter(f => f.facility_name.toLowerCase().includes(searchTerm.toLowerCase())).map(facility => {
                    const level = Math.round((facility.current_occupancy / facility.max_occupancy) * 100)
                    return (
                      <li key={facility.id} className="px-8 py-6 flex items-center justify-between group hover:bg-slate-50/50 transition-colors">
                        <div className="flex items-center gap-5">
                          <div className="h-14 w-14 bg-slate-900 text-white rounded-[1.25rem] flex items-center justify-center text-xl font-black shadow-lg shadow-slate-200">
                            {facility.facility_name[0]}
                          </div>
                          <div>
                            <p className="text-lg font-black text-slate-900 leading-tight group-hover:text-indigo-600 transition-colors">{facility.facility_name}</p>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-0.5">{facility.building_name}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-10">
                           <div className="text-right space-y-2">
                              <p className="text-sm font-black text-slate-900">{facility.current_occupancy} <span className="text-slate-300">/ {facility.max_occupancy}</span></p>
                              <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden p-0.5 shadow-inner">
                                 <div className={`h-full rounded-full transition-all duration-700 ${level >= 90 ? 'bg-rose-500' : 'bg-indigo-500'}`} style={{ width: `${level}%` }} />
                              </div>
                           </div>
                           <button 
                            onClick={() => handleDeleteFacility(facility.id)}
                            className="p-3 text-slate-200 hover:text-rose-600 hover:bg-rose-50 rounded-2xl transition-all"
                           >
                            <Trash2 className="h-5 w-5" />
                           </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </div>

            <div className="bg-indigo-600 p-10 rounded-[2.5rem] shadow-2xl shadow-indigo-200 relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-12 text-indigo-500/20 rotate-12 transition-transform group-hover:scale-110 duration-700">
                  <Plus className="h-32 w-32" />
               </div>
               <div className="relative z-10">
                 <h3 className="text-2xl font-black text-white mb-8">Deploy New Facility</h3>
                 <form onSubmit={handleAddFacility} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-indigo-200 uppercase tracking-widest ml-1">Name</label>
                      <input 
                        type="text" placeholder="e.g. Student Center" required
                        className="w-full p-4 bg-white/10 border border-white/20 rounded-2xl outline-none focus:bg-white focus:text-slate-900 transition-all text-white placeholder-indigo-300 font-bold"
                        value={newFacility.facility_name}
                        onChange={e => setNewFacility({...newFacility, facility_name: e.target.value})}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-indigo-200 uppercase tracking-widest ml-1">Building</label>
                      <input 
                        type="text" placeholder="e.g. Building 1" required
                        className="w-full p-4 bg-white/10 border border-white/20 rounded-2xl outline-none focus:bg-white focus:text-slate-900 transition-all text-white placeholder-indigo-300 font-bold"
                        value={newFacility.building_name}
                        onChange={e => setNewFacility({...newFacility, building_name: e.target.value})}
                      />
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                      <label className="text-[10px] font-black text-indigo-200 uppercase tracking-widest ml-1">Max Capacity</label>
                      <div className="flex gap-3">
                        <input 
                          type="number" placeholder="50" required
                          className="flex-1 p-4 bg-white/10 border border-white/20 rounded-2xl outline-none focus:bg-white focus:text-slate-900 transition-all text-white placeholder-indigo-300 font-bold"
                          value={newFacility.max_occupancy}
                          onChange={e => setNewFacility({...newFacility, max_occupancy: e.target.value})}
                        />
                        <button type="submit" className="px-8 bg-white text-indigo-600 rounded-2xl font-black hover:bg-slate-100 transition-all active:scale-95 shadow-xl shadow-indigo-700/20">
                          Create
                        </button>
                      </div>
                    </div>
                 </form>
               </div>
            </div>
          </div>

          {/* User Assignments */}
          <div className="lg:col-span-5 space-y-8">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-white rounded-2xl shadow-sm border border-slate-200">
                <Settings className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Access Links</h2>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Active counter assignments</p>
              </div>
            </div>
            
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200/60 shadow-xl shadow-slate-200/40 space-y-8">
               <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2"><UserPlus className="h-4 w-4" /> Link New Counter</h3>
               <form onSubmit={handleAssignCounter} className="space-y-5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Staff Member</label>
                    <select 
                      className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 font-bold text-slate-600 appearance-none transition-all"
                      value={assignmentForm.user_id}
                      required
                      onChange={e => setAssignmentForm({...assignmentForm, user_id: e.target.value})}
                    >
                      <option value="">Select Counter...</option>
                      {profiles.filter(p => p.role === 'counter').map(p => (
                        <option key={p.id} value={p.id}>{p.email}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Assigned Spot</label>
                    <select 
                      className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 font-bold text-slate-600 appearance-none transition-all"
                      value={assignmentForm.facility_id}
                      required
                      onChange={e => setAssignmentForm({...assignmentForm, facility_id: e.target.value})}
                    >
                      <option value="">Select Facility...</option>
                      {facilities.map(f => (
                        <option key={f.id} value={f.id}>{f.facility_name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Flow Direction</label>
                    <div className="grid grid-cols-2 gap-3">
                       <button 
                        type="button" 
                        onClick={() => setAssignmentForm({...assignmentForm, type: 'entry'})}
                        className={`py-3.5 px-4 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all ${assignmentForm.type === 'entry' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200' : 'bg-slate-50 text-slate-400 border border-slate-100 hover:bg-slate-100'}`}
                       >
                         Entry Only
                       </button>
                       <button 
                        type="button" 
                        onClick={() => setAssignmentForm({...assignmentForm, type: 'exit'})}
                        className={`py-3.5 px-4 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all ${assignmentForm.type === 'exit' ? 'bg-rose-600 text-white shadow-lg shadow-rose-200' : 'bg-slate-50 text-slate-400 border border-slate-100 hover:bg-slate-100'}`}
                       >
                         Exit Only
                       </button>
                    </div>
                  </div>
                  <button className="w-full py-5 bg-slate-900 text-white font-black rounded-2xl hover:bg-black transition-all active:scale-[0.98] shadow-2xl shadow-slate-300">
                    Authorize Link
                  </button>
               </form>
            </div>

            <div className="space-y-4">
               <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest px-4">Current Assignments</h3>
               <div className="space-y-3">
                 {assignments.map(a => {
                   const profile = profiles.find(p => p.id === a.user_id)
                   return (
                     <div key={a.id} className="bg-white p-5 rounded-[2rem] border border-slate-200/60 shadow-sm flex items-center justify-between group transition-all hover:border-indigo-200">
                        <div className="flex items-center gap-4">
                           <div className={`h-12 w-12 rounded-2xl flex items-center justify-center ${a.type === 'entry' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                              <Activity className="h-5 w-5" />
                           </div>
                           <div>
                              <p className="text-sm font-black text-slate-900 group-hover:text-indigo-600 transition-colors">{a.facilities?.facility_name}</p>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{profile?.email || 'Unknown User'}</p>
                           </div>
                        </div>
                        <button onClick={() => handleDeleteAssignment(a.id)} className="p-2.5 text-slate-200 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all">
                          <Trash2 className="h-4 w-4" />
                        </button>
                     </div>
                   )
                 })}
               </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

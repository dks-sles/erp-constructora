import React, { useState, useEffect, createContext, useContext, useCallback } from 'react'
import { supabase, uploadEvidence, getUserProfile, getUserProjects, EVIDENCE_BUCKET } from './supabaseClient'

// Expose supabase globally for admin functions
window.supabase = supabase

// ============================================
// CONSTRUCTION ERP v5.0 - SUPABASE INTEGRATION
// Full Cloud Database with Real-Time Updates
// ============================================

// ============================================
// TOAST NOTIFICATION SYSTEM
// ============================================
const ToastContext = createContext(null)

function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([])
    
    const addToast = useCallback((message, type = 'success', duration = 4000) => {
        const id = Date.now()
        setToasts(prev => [...prev, { id, message, type }])
        
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id))
        }, duration)
    }, [])
    
    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id))
    }, [])
    
    return (
        <ToastContext.Provider value={{ addToast, removeToast }}>
            {children}
            <ToastContainer toasts={toasts} removeToast={removeToast} />
        </ToastContext.Provider>
    )
}

function useToast() {
    const context = useContext(ToastContext)
    if (!context) {
        throw new Error('useToast must be used within ToastProvider')
    }
    return context
}

function ToastContainer({ toasts, removeToast }) {
    return (
        <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
            {toasts.map(toast => (
                <Toast key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
            ))}
        </div>
    )
}

function Toast({ toast, onClose }) {
    const bgColor = {
        success: 'bg-green-50 border-green-200 text-green-800',
        error: 'bg-red-50 border-red-200 text-red-800',
        warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
        info: 'bg-blue-50 border-blue-200 text-blue-800'
    }[toast.type] || 'bg-green-50 border-green-200 text-green-800'
    
    const icon = {
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ℹ'
    }[toast.type] || '✓'
    
    return (
        <div className={`${bgColor} border rounded-xl px-4 py-3 shadow-lg flex items-start gap-3 animate-slide-in`}>
            <span className="text-lg mt-0.5">{icon}</span>
            <p className="flex-1 text-sm font-medium">{toast.message}</p>
            <button 
                onClick={onClose}
                className="text-current opacity-50 hover:opacity-100 transition-opacity"
            >
                ✕
            </button>
        </div>
    )
}

// App Context for Global State
const AppContext = createContext(null)

// SUNAT Standard Units
const SUNAT_UNITS = [
    { code: 'UND', name: 'Unidad' },
    { code: 'M3', name: 'Metro Cúbico' },
    { code: 'M2', name: 'Metro Cuadrado' },
    { code: 'ML', name: 'Metro Lineal' },
    { code: 'KG', name: 'Kilogramo' },
    { code: 'TN', name: 'Tonelada' },
    { code: 'BLS', name: 'Bolsa' },
    { code: 'GLB', name: 'Global' },
    { code: 'GAL', name: 'Galón' },
    { code: 'PTO', name: 'Punto' },
    { code: 'PLZ', name: 'Pliego' },
    { code: 'VJE', name: 'Viaje' },
    { code: 'HH', name: 'Hora Hombre' },
    { code: 'HM', name: 'Hora Máquina' }
]

// ============================================
// APP PROVIDER - Global State Management
// ============================================
function AppProvider({ children }) {
    const [user, setUser] = useState(null)
    const [profile, setProfile] = useState(null)
    const [loading, setLoading] = useState(true)
    const [projects, setProjects] = useState([])
    const [currentProject, setCurrentProject] = useState(null)
    const [materials, setMaterials] = useState([])
    const [machinery, setMachinery] = useState([])
    const [personnelTypes, setPersonnelTypes] = useState([])
    const [boqItems, setBoqItems] = useState([])
    const [dailyLogs, setDailyLogs] = useState([])
    const [requisitions, setRequisitions] = useState([])
    const [settings, setSettings] = useState({
        companyName: 'Construction ERP',
        logoUrl: '',
        currency: 'PEN',
        taxRate: 18
    })
    const [error, setError] = useState(null)
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

    // Check auth state on mount
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
                handleAuthUser(session.user)
            } else {
                setLoading(false)
            }
        })

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session?.user) {
                handleAuthUser(session.user)
            } else {
                setUser(null)
                setProfile(null)
                setProjects([])
                setLoading(false)
            }
        })

        return () => subscription.unsubscribe()
    }, [])

    // Handle authenticated user
    const handleAuthUser = async (authUser) => {
        try {
            setLoading(true)
            const userProfile = await getUserProfile(authUser.id)
            setUser(authUser)
            setProfile(userProfile)
            
            // Load user's projects
            const userProjects = await getUserProjects(authUser.id, userProfile.role)
            setProjects(userProjects)
            
            // Load materials catalog
            await loadMaterialsCatalog()
            
            // Load machinery catalog
            await loadMachineryCatalog()
            
            // Load personnel types
            await loadPersonnelTypes()
            
            // Load company settings
            await loadCompanySettings()
            
        } catch (err) {
            console.error('Error loading user data:', err)
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    // Load materials catalog
    const loadMaterialsCatalog = async () => {
        const { data, error } = await supabase
            .from('materials_catalog')
            .select('*')
            .eq('is_active', true)
            .order('name')
        
        if (error) throw error
        setMaterials(data || [])
    }

    // Load machinery catalog
    const loadMachineryCatalog = async () => {
        const { data, error } = await supabase
            .from('machinery_catalog')
            .select('*')
            .eq('is_active', true)
            .order('name')
        
        if (error) throw error
        setMachinery(data || [])
    }

    // Load personnel types
    const loadPersonnelTypes = async () => {
        const { data, error } = await supabase
            .from('personnel_types')
            .select('*')
            .eq('is_active', true)
            .order('name')
        
        if (error) throw error
        setPersonnelTypes(data || [])
    }

    // Load company settings
    const loadCompanySettings = async () => {
        const { data, error } = await supabase
            .from('companies')
            .select('*')
            .limit(1)
            .single()
        
        if (!error && data) {
            setSettings({
                companyName: data.name,
                logoUrl: data.logo_url || '',
                currency: data.currency || 'PEN',
                taxRate: data.tax_rate || 18
            })
        }
    }

    // Load project-specific data
    const loadProjectData = async (projectId) => {
        try {
            setLoading(true)
            
            // Load BOQ items
            const { data: boq, error: boqError } = await supabase
                .from('boq_items')
                .select('*')
                .eq('project_id', projectId)
                .order('sort_order')
            
            if (boqError) throw boqError
            setBoqItems(boq || [])
            
            // Load daily logs
            const { data: logs, error: logsError } = await supabase
                .from('daily_logs')
                .select(`
                    *,
                    foreman:profiles!foreman_id(full_name, avatar_url),
                    boq_item:boq_items(code, description, unit)
                `)
                .eq('project_id', projectId)
                .order('log_date', { ascending: false })
            
            if (logsError) throw logsError
            setDailyLogs(logs || [])
            
            // Load requisitions
            const { data: reqs, error: reqsError } = await supabase
                .from('requisitions')
                .select(`
                    *,
                    requester:profiles!requested_by(full_name),
                    approver:profiles!approved_by(full_name),
                    purchaser:profiles!purchased_by(full_name)
                `)
                .eq('project_id', projectId)
                .order('requested_at', { ascending: false })
            
            if (reqsError) throw reqsError
            setRequisitions(reqs || [])
            
        } catch (err) {
            console.error('Error loading project data:', err)
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    // Select a project and load its data
    const selectProject = async (project) => {
        setCurrentProject(project)
        if (project) {
            await loadProjectData(project.id)
            setupRealtimeSubscriptions(project.id)
        }
    }

    // Setup real-time subscriptions for a project
    const setupRealtimeSubscriptions = (projectId) => {
        // Subscribe to daily_logs changes
        const logsChannel = supabase
            .channel(`logs-${projectId}`)
            .on('postgres_changes', 
                { event: '*', schema: 'public', table: 'daily_logs', filter: `project_id=eq.${projectId}` },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        setDailyLogs(prev => [payload.new, ...prev])
                    } else if (payload.eventType === 'UPDATE') {
                        setDailyLogs(prev => prev.map(l => l.id === payload.new.id ? payload.new : l))
                    } else if (payload.eventType === 'DELETE') {
                        setDailyLogs(prev => prev.filter(l => l.id !== payload.old.id))
                    }
                }
            )
            .subscribe()

        // Subscribe to requisitions changes
        const reqsChannel = supabase
            .channel(`reqs-${projectId}`)
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'requisitions', filter: `project_id=eq.${projectId}` },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        setRequisitions(prev => [payload.new, ...prev])
                    } else if (payload.eventType === 'UPDATE') {
                        setRequisitions(prev => prev.map(r => r.id === payload.new.id ? payload.new : r))
                    }
                }
            )
            .subscribe()

        // Subscribe to BOQ changes
        const boqChannel = supabase
            .channel(`boq-${projectId}`)
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'boq_items', filter: `project_id=eq.${projectId}` },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        setBoqItems(prev => [...prev, payload.new])
                    } else if (payload.eventType === 'UPDATE') {
                        setBoqItems(prev => prev.map(b => b.id === payload.new.id ? payload.new : b))
                    }
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(logsChannel)
            supabase.removeChannel(reqsChannel)
            supabase.removeChannel(boqChannel)
        }
    }

    // Sign in with email/password
    const signIn = async (email, password) => {
        setLoading(true)
        setError(null)
        
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        })
        
        if (error) {
            setError(error.message)
            setLoading(false)
            return false
        }
        
        // Check if user is active
        if (data.user) {
            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('is_active')
                .eq('id', data.user.id)
                .single()
            
            if (profileError || profileData?.is_active === false) {
                await supabase.auth.signOut()
                setError('Usuario desactivado. Contacte al administrador.')
                setLoading(false)
                return false
            }
        }
        
        return true
    }

    // Sign out
    const signOut = async () => {
        await supabase.auth.signOut()
        setUser(null)
        setProfile(null)
        setProjects([])
        setCurrentProject(null)
        setBoqItems([])
        setDailyLogs([])
        setRequisitions([])
    }

    // Create daily log
    const createDailyLog = async (logData, evidenceFile) => {
        try {
            setLoading(true)
            
            let evidenceUrl = null
            if (evidenceFile) {
                evidenceUrl = await uploadEvidence(evidenceFile, `daily-logs/${currentProject.id}`)
            }
            
            const { data, error } = await supabase
                .from('daily_logs')
                .insert({
                    project_id: currentProject.id,
                    boq_item_id: logData.boqItemId,
                    foreman_id: user.id,
                    log_date: logData.date,
                    quantity_executed: logData.quantityExecuted,
                    labor_json: logData.labor,
                    materials_json: logData.materials,
                    machinery_json: logData.machinery,
                    evidence_urls: evidenceUrl ? [evidenceUrl] : [],
                    notes: logData.notes,
                    status: 'pending'
                })
                .select()
                .single()
            
            if (error) throw error
            
            return data
        } catch (err) {
            setError(err.message)
            throw err
        } finally {
            setLoading(false)
        }
    }

    // Approve/Reject daily log
    const updateLogStatus = async (logId, status, rejectionReason = null) => {
        const { error } = await supabase
            .from('daily_logs')
            .update({
                status,
                reviewed_by: user.id,
                reviewed_at: new Date().toISOString(),
                rejection_reason: rejectionReason
            })
            .eq('id', logId)
        
        if (error) throw error
    }

    // Create requisition
    const createRequisition = async (reqData) => {
        const { data, error } = await supabase
            .from('requisitions')
            .insert({
                project_id: currentProject.id,
                material_id: reqData.materialId,
                item_name: reqData.itemName,
                item_description: reqData.description,
                quantity: reqData.quantity,
                unit: reqData.unit,
                urgency: reqData.urgency,
                requested_by: user.id,
                request_notes: reqData.notes,
                status: 'pending_pm'
            })
            .select()
            .single()
        
        if (error) throw error
        return data
    }

    // Update requisition status
    const updateRequisitionStatus = async (reqId, status, additionalData = {}) => {
        const updateData = { status, ...additionalData }
        
        if (status === 'approved' || status === 'to_buy') {
            updateData.approved_by = user.id
            updateData.approved_at = new Date().toISOString()
        } else if (status === 'in_transit') {
            updateData.purchased_by = user.id
            updateData.purchased_at = new Date().toISOString()
        } else if (status === 'received' || status === 'completed') {
            updateData.received_by = user.id
            updateData.received_at = new Date().toISOString()
        }
        
        const { error } = await supabase
            .from('requisitions')
            .update(updateData)
            .eq('id', reqId)
        
        if (error) throw error
    }

    // Create BOQ item
    const createBoqItem = async (itemData) => {
        const { data, error } = await supabase
            .from('boq_items')
            .insert({
                project_id: currentProject.id,
                code: itemData.code,
                description: itemData.description,
                unit: itemData.unit,
                category: itemData.category,
                total_metrado: itemData.totalMetrado,
                unit_price: itemData.unitPrice,
                created_by: user.id
            })
            .select()
            .single()
        
        if (error) throw error
        return data
    }

    // Update BOQ item
    const updateBoqItem = async (itemId, updates) => {
        const { error } = await supabase
            .from('boq_items')
            .update(updates)
            .eq('id', itemId)
        
        if (error) throw error
    }

    // Refresh projects list
    const refreshProjects = async () => {
        if (profile) {
            const userProjects = await getUserProjects(user.id, profile.role)
            setProjects(userProjects)
        }
    }

    const value = {
        // Auth state
        user,
        profile,
        loading,
        error,
        
        // Data
        projects,
        currentProject,
        materials,
        machinery,
        personnelTypes,
        boqItems,
        dailyLogs,
        requisitions,
        settings,
        
        // UI state
        mobileMenuOpen,
        setMobileMenuOpen,
        
        // Actions
        signIn,
        signOut,
        selectProject,
        createDailyLog,
        updateLogStatus,
        createRequisition,
        updateRequisitionStatus,
        createBoqItem,
        updateBoqItem,
        refreshProjects,
        loadProjectData,
        setError
    }

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

// Custom hook to use app context
function useApp() {
    const context = useContext(AppContext)
    if (!context) {
        throw new Error('useApp must be used within AppProvider')
    }
    return context
}

// ============================================
// UTILITY FUNCTIONS
// ============================================
function formatCurrency(amount, currency = 'PEN') {
    return new Intl.NumberFormat('es-PE', {
        style: 'currency',
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount)
}

function formatDate(date) {
    return new Date(date).toLocaleDateString('es-PE')
}

function getRoleName(role) {
    const roles = {
        admin: 'Administrador',
        ceo: 'CEO',
        pm: 'Project Manager',
        engineer: 'Ing. Residente',
        foreman: 'Maestro de Obra',
        logistics: 'Logística'
    }
    return roles[role] || role
}

function getRoleColor(role) {
    const colors = {
        admin: 'bg-purple-100 text-purple-700',
        ceo: 'bg-blue-100 text-blue-700',
        pm: 'bg-indigo-100 text-indigo-700',
        engineer: 'bg-green-100 text-green-700',
        foreman: 'bg-orange-100 text-orange-700',
        logistics: 'bg-teal-100 text-teal-700'
    }
    return colors[role] || 'bg-gray-100 text-gray-700'
}

function getStatusBadge(status) {
    const badges = {
        pending: { bg: 'bg-yellow-100', text: 'text-yellow-700', icon: '🕒', label: 'Pendiente' },
        approved: { bg: 'bg-green-100', text: 'text-green-700', icon: '✅', label: 'Aprobado' },
        rejected: { bg: 'bg-red-100', text: 'text-red-700', icon: '❌', label: 'Rechazado' },
        pending_pm: { bg: 'bg-yellow-100', text: 'text-yellow-700', icon: '🕒', label: 'Pendiente PM' },
        to_buy: { bg: 'bg-blue-100', text: 'text-blue-700', icon: '🛒', label: 'Por Comprar' },
        in_transit: { bg: 'bg-orange-100', text: 'text-orange-700', icon: '🚚', label: 'En Tránsito' },
        received: { bg: 'bg-green-100', text: 'text-green-700', icon: '📦', label: 'Recibido' },
        completed: { bg: 'bg-green-100', text: 'text-green-700', icon: '✅', label: 'Completado' }
    }
    const badge = badges[status] || badges.pending
    return (
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${badge.bg} ${badge.text}`}>
            {badge.icon} {badge.label}
        </span>
    )
}

function getUrgencyBadge(urgency) {
    const badges = {
        low: { bg: 'bg-green-100', text: 'text-green-700', label: '🟢 Baja' },
        medium: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: '🟡 Media' },
        high: { bg: 'bg-red-100', text: 'text-red-700', label: '🔴 Alta' },
        critical: { bg: 'bg-red-200', text: 'text-red-800', label: '⚠️ Crítica' }
    }
    const badge = badges[urgency] || badges.medium
    return (
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${badge.bg} ${badge.text}`}>
            {badge.label}
        </span>
    )
}

// ============================================
// LOADING SPINNER COMPONENT
// ============================================
function LoadingSpinner({ message = 'Cargando...' }) {
    return (
        <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-slate-500">{message}</p>
        </div>
    )
}

// ============================================
// ERROR ALERT COMPONENT
// ============================================
function ErrorAlert({ message, onClose }) {
    if (!message) return null
    
    return (
        <div className="fixed top-4 right-4 z-50 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg shadow-lg flex items-center gap-3">
            <span>⚠️</span>
            <span>{message}</span>
            <button onClick={onClose} className="ml-4 text-red-500 hover:text-red-700">✕</button>
        </div>
    )
}

// ============================================
// LOGIN PAGE
// ============================================
function LoginPage() {
    const { signIn, loading, error, settings, setError } = useApp()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')

    const handleSubmit = async (e) => {
        e.preventDefault()
        await signIn(email, password)
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 flex items-center justify-center p-4">
            <ErrorAlert message={error} onClose={() => setError(null)} />
            
            <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
                <div className="text-center mb-8">
                    <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                        {settings.logoUrl ? (
                            <img src={settings.logoUrl} alt="Logo" className="h-12 w-12 object-contain" />
                        ) : (
                            <span className="text-4xl">🏗️</span>
                        )}
                    </div>
                    <h1 className="text-3xl font-bold text-slate-800">{settings.companyName}</h1>
                    <p className="text-slate-500 mt-2">Sistema de Gestión ERP v5.0</p>
                </div>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Correo Electrónico
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50"
                            placeholder="correo@empresa.com"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Contraseña
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50"
                            placeholder="••••••••"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg disabled:opacity-50"
                    >
                        {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
                    </button>
                </form>
            </div>
        </div>
    )
}

// ============================================
// SIDEBAR COMPONENT
// ============================================
function Sidebar({ menuItems }) {
    const { profile, signOut, settings, mobileMenuOpen, setMobileMenuOpen } = useApp()

    if (!profile) return null

    return (
        <>
            {/* Mobile Overlay */}
            {mobileMenuOpen && (
                <div 
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={() => setMobileMenuOpen(false)}
                />
            )}
            
            {/* Sidebar */}
            <aside className={`
                fixed left-0 top-0 h-full bg-slate-900 text-white z-50 w-64
                transform transition-transform duration-300 ease-in-out
                ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
                lg:translate-x-0
            `}>
                <div className="p-5 border-b border-slate-700">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            {settings.logoUrl ? (
                                <img src={settings.logoUrl} alt="Logo" className="h-10 w-10 object-contain rounded-lg" />
                            ) : (
                                <span className="text-3xl">🏗️</span>
                            )}
                            <div>
                                <h1 className="font-bold text-lg">{settings.companyName.split(' ')[0]}</h1>
                                <p className="text-xs text-slate-400">ERP v5.0</p>
                            </div>
                        </div>
                        <button 
                            onClick={() => setMobileMenuOpen(false)}
                            className="lg:hidden p-2 rounded-lg hover:bg-slate-800"
                        >
                            ✕
                        </button>
                    </div>
                </div>
                
                <div className="p-4 border-b border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center text-xl">
                            {profile.avatar_url ? (
                                <img src={profile.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                            ) : (
                                '👤'
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{profile.full_name}</p>
                            <p className="text-xs text-slate-400">{getRoleName(profile.role)}</p>
                        </div>
                    </div>
                </div>
                
                <nav className="p-3 space-y-1 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 250px)' }}>
                    {menuItems.map((item, index) => (
                        <button
                            key={index}
                            onClick={() => {
                                item.onClick()
                                setMobileMenuOpen(false)
                            }}
                            className={`
                                w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors
                                ${item.active ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'}
                            `}
                        >
                            <span className="text-lg">{item.icon}</span>
                            <span className="text-sm font-medium">{item.label}</span>
                        </button>
                    ))}
                </nav>
                
                <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-700">
                    <button
                        onClick={signOut}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-400 hover:bg-slate-800 transition-colors"
                    >
                        <span className="text-lg">🚪</span>
                        <span className="text-sm font-medium">Cerrar Sesión</span>
                    </button>
                </div>
            </aside>
        </>
    )
}

// ============================================
// MOBILE HEADER
// ============================================
function MobileHeader() {
    const { profile, setMobileMenuOpen, settings } = useApp()
    
    if (!profile) return null
    
    return (
        <div className="fixed top-0 left-0 right-0 bg-slate-900 text-white z-30 px-4 py-3 flex items-center justify-between lg:hidden">
            <button 
                onClick={() => setMobileMenuOpen(true)}
                className="p-2 rounded-lg hover:bg-slate-800"
            >
                <span className="text-2xl">☰</span>
            </button>
            <div className="flex items-center gap-2">
                {settings.logoUrl ? (
                    <img src={settings.logoUrl} alt="Logo" className="h-8 w-8 object-contain" />
                ) : (
                    <span className="text-2xl">🏗️</span>
                )}
                <span className="font-bold">{settings.companyName.split(' ')[0]}</span>
            </div>
            <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center">
                👤
            </div>
        </div>
    )
}

// ============================================
// PROJECT SELECTOR (Card Grid)
// ============================================
function ProjectSelector({ title, subtitle }) {
    const { projects, selectProject, loading } = useApp()
    
    if (loading) {
        return <LoadingSpinner message="Cargando proyectos..." />
    }
    
    if (projects.length === 0) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="text-center">
                    <span className="text-6xl mb-4 block">📁</span>
                    <h2 className="text-xl font-semibold text-slate-700 mb-2">Sin Proyectos Asignados</h2>
                    <p className="text-slate-500">Contacte al administrador para asignar proyectos.</p>
                </div>
            </div>
        )
    }
    
    return (
        <div className="min-h-screen bg-slate-50 p-4 sm:p-6 pt-20 lg:pt-6">
            <div className="max-w-6xl mx-auto">
                <div className="text-center mb-8">
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-2">{title}</h1>
                    <p className="text-slate-500">{subtitle}</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                    {projects.map(project => {
                        const progressColor = project.progress >= 75 ? 'bg-green-500' 
                            : project.progress >= 50 ? 'bg-blue-500' 
                            : project.progress >= 25 ? 'bg-yellow-500' 
                            : 'bg-red-500'
                        
                        return (
                            <div
                                key={project.id}
                                onClick={() => selectProject(project)}
                                className="bg-white rounded-2xl shadow-sm hover:shadow-lg transition-all cursor-pointer border border-slate-100 overflow-hidden group"
                            >
                                <div className={`h-2 ${progressColor}`}></div>
                                <div className="p-5 sm:p-6">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-semibold text-slate-800 group-hover:text-blue-600 transition-colors truncate">
                                                {project.name}
                                            </h3>
                                            <p className="text-sm text-slate-500 font-mono">{project.code}</p>
                                        </div>
                                        <span className={`px-2 py-1 text-xs font-medium rounded-full shrink-0 ml-2 ${
                                            project.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'
                                        }`}>
                                            {project.status === 'active' ? '● Activo' : project.status}
                                        </span>
                                    </div>
                                    
                                    <div className="space-y-2 mb-4">
                                        <div className="flex items-center gap-2 text-sm text-slate-600">
                                            <span>🏢</span>
                                            <span className="truncate">{project.client_name}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-slate-600">
                                            <span>📍</span>
                                            <span className="truncate">{project.location}</span>
                                        </div>
                                    </div>
                                    
                                    <div className="mb-4">
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="text-slate-500">Avance</span>
                                            <span className="font-semibold text-slate-700">{project.progress || 0}%</span>
                                        </div>
                                        <div className="w-full bg-slate-200 rounded-full h-2.5">
                                            <div 
                                                className={`h-2.5 rounded-full ${progressColor} transition-all`} 
                                                style={{ width: `${project.progress || 0}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100">
                                        <div>
                                            <p className="text-xs text-slate-500">Presupuesto</p>
                                            <p className="font-semibold text-slate-800 text-sm truncate">
                                                {formatCurrency(project.budget)}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs text-slate-500">Ejecutado</p>
                                            <p className="font-semibold text-green-600 text-sm truncate">
                                                {formatCurrency(project.spent || 0)}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

// ============================================
// MAIN CONTENT WRAPPER
// ============================================
function MainContent({ children, title, subtitle, showBackButton = false }) {
    const { selectProject } = useApp()
    
    return (
        <main className="lg:ml-64 min-h-screen bg-slate-50 p-4 sm:p-6 pt-20 lg:pt-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{title}</h1>
                    {subtitle && <p className="text-sm sm:text-base text-slate-500 mt-1">{subtitle}</p>}
                </div>
                {showBackButton && (
                    <button 
                        onClick={() => selectProject(null)}
                        className="flex items-center gap-2 text-blue-600 hover:text-blue-700 px-3 py-2 rounded-lg hover:bg-blue-50"
                    >
                        <span>←</span> Volver al listado
                    </button>
                )}
            </div>
            {children}
        </main>
    )
}

// ============================================
// FOREMAN MODULE
// ============================================
function ForemanModule() {
    const { 
        currentProject, 
        boqItems, 
        dailyLogs, 
        materials, 
        machinery, 
        personnelTypes,
        createDailyLog,
        loading,
        profile 
    } = useApp()
    
    const [activeTab, setActiveTab] = useState('progress')
    const [formData, setFormData] = useState({
        boqItemId: '',
        date: new Date().toISOString().split('T')[0],
        quantityExecuted: '',
        notes: '',
        labor: [],
        materials: [],
        machinery: []
    })
    const [evidenceFile, setEvidenceFile] = useState(null)
    const [submitting, setSubmitting] = useState(false)

    // Add labor row
    const addLaborRow = () => {
        setFormData(prev => ({
            ...prev,
            labor: [...prev.labor, { role: personnelTypes[0]?.name || '', count: 1, hours: 8 }]
        }))
    }

    // Update labor row
    const updateLaborRow = (index, field, value) => {
        setFormData(prev => ({
            ...prev,
            labor: prev.labor.map((row, i) => i === index ? { ...row, [field]: value } : row)
        }))
    }

    // Remove labor row
    const removeLaborRow = (index) => {
        setFormData(prev => ({
            ...prev,
            labor: prev.labor.filter((_, i) => i !== index)
        }))
    }

    // Add material row
    const addMaterialRow = () => {
        setFormData(prev => ({
            ...prev,
            materials: [...prev.materials, { name: materials[0]?.name || '', qty: 1, unit: materials[0]?.unit || 'UND' }]
        }))
    }

    // Update material row
    const updateMaterialRow = (index, field, value) => {
        setFormData(prev => ({
            ...prev,
            materials: prev.materials.map((row, i) => i === index ? { ...row, [field]: value } : row)
        }))
    }

    // Remove material row
    const removeMaterialRow = (index) => {
        setFormData(prev => ({
            ...prev,
            materials: prev.materials.filter((_, i) => i !== index)
        }))
    }

    // Add machinery row
    const addMachineryRow = () => {
        setFormData(prev => ({
            ...prev,
            machinery: [...prev.machinery, { name: machinery[0]?.name || '', hours: 1 }]
        }))
    }

    // Update machinery row
    const updateMachineryRow = (index, field, value) => {
        setFormData(prev => ({
            ...prev,
            machinery: prev.machinery.map((row, i) => i === index ? { ...row, [field]: value } : row)
        }))
    }

    // Remove machinery row
    const removeMachineryRow = (index) => {
        setFormData(prev => ({
            ...prev,
            machinery: prev.machinery.filter((_, i) => i !== index)
        }))
    }

    // Handle file selection
    const handleFileSelect = (e) => {
        const file = e.target.files[0]
        if (file) {
            setEvidenceFile(file)
        }
    }

    // Validate quantity against budget
    const validateQuantity = () => {
        if (!formData.boqItemId || !formData.quantityExecuted) return { valid: true }
        
        const boqItem = boqItems.find(b => b.id === formData.boqItemId)
        if (!boqItem) return { valid: false, message: 'Partida no encontrada' }
        
        const approvedQty = dailyLogs
            .filter(l => l.boq_item_id === formData.boqItemId && l.status === 'approved')
            .reduce((sum, l) => sum + l.quantity_executed, 0)
        
        const pendingQty = dailyLogs
            .filter(l => l.boq_item_id === formData.boqItemId && l.status === 'pending')
            .reduce((sum, l) => sum + l.quantity_executed, 0)
        
        const newQty = parseFloat(formData.quantityExecuted)
        const totalAfterNew = approvedQty + pendingQty + newQty
        
        if (totalAfterNew > boqItem.total_metrado) {
            return {
                valid: false,
                message: `Error: Mayor Metrado. El avance (${totalAfterNew.toFixed(2)}) supera el expediente técnico (${boqItem.total_metrado})`
            }
        }
        
        return { valid: true, remaining: boqItem.total_metrado - totalAfterNew }
    }

    // Get toast context
    const { addToast } = useToast()
    
    // Submit daily log
    const handleSubmit = async (e) => {
        e.preventDefault()
        
        const validation = validateQuantity()
        if (!validation.valid) {
            addToast(validation.message, 'error')
            return
        }
        
        try {
            setSubmitting(true)
            
            await createDailyLog({
                boqItemId: formData.boqItemId,
                date: formData.date,
                quantityExecuted: parseFloat(formData.quantityExecuted),
                notes: formData.notes,
                labor: formData.labor,
                materials: formData.materials,
                machinery: formData.machinery
            }, evidenceFile)
            
            // Reset form
            setFormData({
                boqItemId: '',
                date: new Date().toISOString().split('T')[0],
                quantityExecuted: '',
                notes: '',
                labor: [],
                materials: [],
                machinery: []
            })
            setEvidenceFile(null)
            
            addToast('Reporte enviado correctamente', 'success')
        } catch (err) {
            addToast('Error al enviar reporte: ' + err.message, 'error')
        } finally {
            setSubmitting(false)
        }
    }

    // My logs for this project
    const myLogs = dailyLogs.filter(l => l.foreman_id === profile?.id)

    const menuItems = [
        { icon: '📝', label: 'Reportar Avance', active: activeTab === 'progress', onClick: () => setActiveTab('progress') },
        { icon: '📋', label: 'Mis Partidas', active: activeTab === 'partidas', onClick: () => setActiveTab('partidas') }
    ]

    if (!currentProject) {
        return (
            <>
                <MobileHeader />
                <ProjectSelector 
                    title="Reporte de Avance" 
                    subtitle="Seleccione un proyecto para reportar avance diario"
                />
            </>
        )
    }

    return (
        <>
            <MobileHeader />
            <Sidebar menuItems={menuItems} />
            <MainContent 
                title={currentProject.name} 
                subtitle="Reporte de Avance Diario"
                showBackButton
            >
                {loading ? <LoadingSpinner /> : (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 sm:p-6">
                        {activeTab === 'progress' && (
                            <>
                                <h3 className="text-lg font-semibold text-slate-800 mb-4">📝 Nuevo Reporte de Avance</h3>
                                
                                <form onSubmit={handleSubmit} className="space-y-6">
                                    {/* BOQ Item Selection */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Partida</label>
                                            <select
                                                value={formData.boqItemId}
                                                onChange={(e) => setFormData(prev => ({ ...prev, boqItemId: e.target.value }))}
                                                required
                                                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg bg-white"
                                            >
                                                <option value="">Seleccionar...</option>
                                                {boqItems.filter(b => b.progress < 100).map(item => (
                                                    <option key={item.id} value={item.id}>
                                                        {item.code} - {item.description} ({item.progress || 0}%)
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Fecha</label>
                                            <input
                                                type="date"
                                                value={formData.date}
                                                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                                                required
                                                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg"
                                            />
                                        </div>
                                    </div>
                                    
                                    {/* Quantity and Notes */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Cantidad Ejecutada</label>
                                            <input
                                                type="number"
                                                value={formData.quantityExecuted}
                                                onChange={(e) => setFormData(prev => ({ ...prev, quantityExecuted: e.target.value }))}
                                                required
                                                min="0"
                                                step="0.01"
                                                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Observaciones</label>
                                            <input
                                                type="text"
                                                value={formData.notes}
                                                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                                                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg"
                                                placeholder="Notas adicionales..."
                                            />
                                        </div>
                                    </div>
                                    
                                    {/* Labor Section */}
                                    <div className="border border-slate-200 rounded-xl p-4">
                                        <div className="flex justify-between items-center mb-3">
                                            <h4 className="font-medium text-slate-700">👷 Mano de Obra</h4>
                                            <button
                                                type="button"
                                                onClick={addLaborRow}
                                                className="text-sm text-blue-600 hover:underline"
                                            >
                                                + Agregar
                                            </button>
                                        </div>
                                        <div className="space-y-2">
                                            {formData.labor.map((row, index) => (
                                                <div key={index} className="grid grid-cols-4 gap-2">
                                                    <select
                                                        value={row.role}
                                                        onChange={(e) => updateLaborRow(index, 'role', e.target.value)}
                                                        className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                                    >
                                                        {personnelTypes.map(t => (
                                                            <option key={t.id} value={t.name}>{t.name}</option>
                                                        ))}
                                                    </select>
                                                    <input
                                                        type="number"
                                                        value={row.count}
                                                        onChange={(e) => updateLaborRow(index, 'count', parseInt(e.target.value))}
                                                        className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                                        placeholder="Cantidad"
                                                        min="1"
                                                    />
                                                    <input
                                                        type="number"
                                                        value={row.hours}
                                                        onChange={(e) => updateLaborRow(index, 'hours', parseFloat(e.target.value))}
                                                        className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                                        placeholder="Horas"
                                                        min="0"
                                                        step="0.5"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => removeLaborRow(index)}
                                                        className="text-red-500 text-sm"
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            ))}
                                            {formData.labor.length === 0 && (
                                                <p className="text-sm text-slate-400 text-center py-2">
                                                    Sin mano de obra registrada
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    
                                    {/* Materials Section */}
                                    <div className="border border-slate-200 rounded-xl p-4">
                                        <div className="flex justify-between items-center mb-3">
                                            <h4 className="font-medium text-slate-700">📦 Materiales</h4>
                                            <button
                                                type="button"
                                                onClick={addMaterialRow}
                                                className="text-sm text-blue-600 hover:underline"
                                            >
                                                + Agregar
                                            </button>
                                        </div>
                                        <div className="space-y-2">
                                            {formData.materials.map((row, index) => (
                                                <div key={index} className="grid grid-cols-4 gap-2">
                                                    <select
                                                        value={row.name}
                                                        onChange={(e) => {
                                                            const mat = materials.find(m => m.name === e.target.value)
                                                            updateMaterialRow(index, 'name', e.target.value)
                                                            if (mat) updateMaterialRow(index, 'unit', mat.unit)
                                                        }}
                                                        className="px-3 py-2 border border-slate-200 rounded-lg text-sm col-span-2"
                                                    >
                                                        {materials.map(m => (
                                                            <option key={m.id} value={m.name}>{m.name}</option>
                                                        ))}
                                                    </select>
                                                    <input
                                                        type="number"
                                                        value={row.qty}
                                                        onChange={(e) => updateMaterialRow(index, 'qty', parseFloat(e.target.value))}
                                                        className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                                        placeholder="Cantidad"
                                                        min="0"
                                                        step="0.01"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => removeMaterialRow(index)}
                                                        className="text-red-500 text-sm"
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            ))}
                                            {formData.materials.length === 0 && (
                                                <p className="text-sm text-slate-400 text-center py-2">
                                                    Sin materiales registrados
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    
                                    {/* Machinery Section */}
                                    <div className="border border-slate-200 rounded-xl p-4">
                                        <div className="flex justify-between items-center mb-3">
                                            <h4 className="font-medium text-slate-700">🚜 Maquinaria</h4>
                                            <button
                                                type="button"
                                                onClick={addMachineryRow}
                                                className="text-sm text-blue-600 hover:underline"
                                            >
                                                + Agregar
                                            </button>
                                        </div>
                                        <div className="space-y-2">
                                            {formData.machinery.map((row, index) => (
                                                <div key={index} className="grid grid-cols-3 gap-2">
                                                    <select
                                                        value={row.name}
                                                        onChange={(e) => updateMachineryRow(index, 'name', e.target.value)}
                                                        className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                                    >
                                                        {machinery.map(m => (
                                                            <option key={m.id} value={m.name}>{m.name}</option>
                                                        ))}
                                                    </select>
                                                    <input
                                                        type="number"
                                                        value={row.hours}
                                                        onChange={(e) => updateMachineryRow(index, 'hours', parseFloat(e.target.value))}
                                                        className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                                        placeholder="Horas"
                                                        min="0"
                                                        step="0.5"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => removeMachineryRow(index)}
                                                        className="text-red-500 text-sm"
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            ))}
                                            {formData.machinery.length === 0 && (
                                                <p className="text-sm text-slate-400 text-center py-2">
                                                    Sin maquinaria registrada
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    
                                    {/* Evidence Upload */}
                                    <div className="border border-slate-200 rounded-xl p-4">
                                        <h4 className="font-medium text-slate-700 mb-3">📷 Evidencia Fotográfica</h4>
                                        <label className={`
                                            block border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
                                            ${evidenceFile ? 'border-green-500 bg-green-50' : 'border-slate-300 hover:border-blue-500'}
                                        `}>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={handleFileSelect}
                                                className="hidden"
                                            />
                                            {evidenceFile ? (
                                                <>
                                                    <span className="text-3xl block mb-2">✅</span>
                                                    <span className="text-green-600 font-medium">{evidenceFile.name}</span>
                                                </>
                                            ) : (
                                                <>
                                                    <span className="text-3xl block mb-2">📤</span>
                                                    <span className="text-slate-500">Clic para subir foto</span>
                                                </>
                                            )}
                                        </label>
                                    </div>
                                    
                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
                                    >
                                        {submitting ? 'Enviando...' : '✓ Registrar Avance'}
                                    </button>
                                </form>
                            </>
                        )}
                        
                        {activeTab === 'partidas' && (
                            <>
                                <h3 className="text-lg font-semibold text-slate-800 mb-4">📋 Mis Partidas y Reportes</h3>
                                
                                {/* BOQ Items Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                                    {boqItems.map(item => (
                                        <div key={item.id} className="bg-slate-50 rounded-xl p-4">
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <span className="font-mono text-xs text-slate-500">{item.code}</span>
                                                    <p className="font-medium">{item.description}</p>
                                                </div>
                                                <span className={`px-2 py-1 text-xs rounded-full ${
                                                    item.progress === 100 ? 'bg-green-100 text-green-700' 
                                                    : item.progress > 0 ? 'bg-blue-100 text-blue-700' 
                                                    : 'bg-slate-100 text-slate-700'
                                                }`}>
                                                    {item.progress === 100 ? 'Completado' : item.progress > 0 ? 'En Progreso' : 'Pendiente'}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3 text-sm text-slate-500 mb-2">
                                                <span>{item.total_metrado} {item.unit}</span>
                                                <span>•</span>
                                                <span>{item.category}</span>
                                            </div>
                                            <div className="w-full bg-slate-200 rounded-full h-2">
                                                <div 
                                                    className="h-2 rounded-full bg-blue-500" 
                                                    style={{ width: `${item.progress || 0}%` }}
                                                ></div>
                                            </div>
                                            <p className="text-right text-sm font-medium mt-1">{item.progress || 0}%</p>
                                        </div>
                                    ))}
                                </div>
                                
                                {/* My Reports */}
                                <h4 className="font-semibold text-slate-700 mb-3">📝 Mis Reportes</h4>
                                <div className="space-y-3">
                                    {myLogs.length === 0 && (
                                        <p className="text-slate-500 text-center py-8">Sin reportes aún</p>
                                    )}
                                    {myLogs.map(log => {
                                        const boqItem = boqItems.find(b => b.id === log.boq_item_id)
                                        return (
                                            <div key={log.id} className="bg-slate-50 rounded-xl p-4">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div>
                                                        <p className="font-medium">{boqItem?.description || log.boq_item?.description}</p>
                                                        <p className="text-sm text-slate-500">{log.notes}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="font-medium text-blue-600">
                                                            +{log.quantity_executed} {boqItem?.unit || log.boq_item?.unit}
                                                        </span>
                                                        <p className="text-xs text-slate-400">{formatDate(log.log_date)}</p>
                                                    </div>
                                                </div>
                                                <div className="flex flex-wrap gap-2 mt-2">
                                                    {log.labor_json?.length > 0 && (
                                                        <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
                                                            👷 {log.labor_json.reduce((s, l) => s + l.count, 0)} trabajadores
                                                        </span>
                                                    )}
                                                    {log.materials_json?.length > 0 && (
                                                        <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">
                                                            📦 {log.materials_json.length} material(es)
                                                        </span>
                                                    )}
                                                    {log.machinery_json?.length > 0 && (
                                                        <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded">
                                                            🚜 {log.machinery_json.length} maquinaria(s)
                                                        </span>
                                                    )}
                                                    {log.evidence_urls?.length > 0 && (
                                                        <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded">📷</span>
                                                    )}
                                                    {getStatusBadge(log.status)}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </>
                        )}
                    </div>
                )}
            </MainContent>
        </>
    )
}

// ============================================
// ENGINEER MODULE
// ============================================
function EngineerModule() {
    const { 
        currentProject, 
        boqItems, 
        dailyLogs, 
        requisitions,
        updateLogStatus,
        createRequisition,
        updateRequisitionStatus,
        materials,
        loading 
    } = useApp()
    
    const [activeTab, setActiveTab] = useState('approve')
    const [reqForm, setReqForm] = useState({
        materialId: '',
        itemName: '',
        quantity: '',
        unit: 'UND',
        urgency: 'medium',
        notes: ''
    })

    // Get toast context
    const { addToast } = useToast()
    
    // Pending logs for approval
    const pendingLogs = dailyLogs.filter(l => l.status === 'pending')
    
    // In-transit requisitions
    const inTransitReqs = requisitions.filter(r => r.status === 'in_transit')

    const handleApproveLog = async (logId) => {
        try {
            await updateLogStatus(logId, 'approved')
            addToast('Parte diario aprobado', 'success')
        } catch (err) {
            addToast('Error: ' + err.message, 'error')
        }
    }

    const handleRejectLog = async (logId) => {
        const reason = prompt('Razón del rechazo:')
        if (reason) {
            try {
                await updateLogStatus(logId, 'rejected', reason)
                addToast('Parte diario rechazado', 'warning')
            } catch (err) {
                addToast('Error: ' + err.message, 'error')
            }
        }
    }

    const handleCreateRequisition = async (e) => {
        e.preventDefault()
        try {
            await createRequisition(reqForm)
            setReqForm({
                materialId: '',
                itemName: '',
                quantity: '',
                unit: 'UND',
                urgency: 'medium',
                notes: ''
            })
            addToast('Requerimiento enviado correctamente', 'success')
        } catch (err) {
            addToast('Error: ' + err.message, 'error')
        }
    }

    const handleConfirmReceived = async (reqId) => {
        try {
            await updateRequisitionStatus(reqId, 'completed')
            addToast('Material recibido confirmado', 'success')
        } catch (err) {
            addToast('Error: ' + err.message, 'error')
        }
    }

    // Calculate valuations
    const totalBudget = boqItems.reduce((s, i) => s + (i.total_metrado * i.unit_price), 0)
    const totalValorized = boqItems.reduce((s, i) => s + (i.total_metrado * i.unit_price * (i.progress || 0) / 100), 0)

    // Download CSV
    const downloadCSV = () => {
        let csv = 'Código,Descripción,Unidad,Metrado,P.U.,Total,% Avance,Valorizado\n'
        boqItems.forEach(item => {
            const total = item.total_metrado * item.unit_price
            const valorized = total * (item.progress || 0) / 100
            csv += `"${item.code}","${item.description}","${item.unit}",${item.total_metrado},${item.unit_price},${total},${item.progress || 0}%,${valorized}\n`
        })
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = `valorizacion_${currentProject.code}_${new Date().toISOString().split('T')[0]}.csv`
        link.click()
    }

    const menuItems = [
        { icon: '✅', label: 'Aprobar Partes', active: activeTab === 'approve', onClick: () => setActiveTab('approve') },
        { icon: '📊', label: 'Valorizaciones', active: activeTab === 'valuations', onClick: () => setActiveTab('valuations') },
        { icon: '🛒', label: 'Requerimientos', active: activeTab === 'requisitions', onClick: () => setActiveTab('requisitions') },
        { icon: '📷', label: 'Evidencias', active: activeTab === 'evidence', onClick: () => setActiveTab('evidence') }
    ]

    if (!currentProject) {
        return (
            <>
                <MobileHeader />
                <ProjectSelector 
                    title="Supervisión Técnica" 
                    subtitle="Seleccione un proyecto para supervisar"
                />
            </>
        )
    }

    return (
        <>
            <MobileHeader />
            <Sidebar menuItems={menuItems} />
            <MainContent 
                title={currentProject.name} 
                subtitle="Supervisión Técnica"
                showBackButton
            >
                {loading ? <LoadingSpinner /> : (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 sm:p-6">
                        {activeTab === 'approve' && (
                            <>
                                <h3 className="text-lg font-semibold text-slate-800 mb-4">✅ Aprobar Partes Diarios</h3>
                                
                                {pendingLogs.length === 0 ? (
                                    <p className="text-slate-500 text-center py-8">No hay partes pendientes de aprobación</p>
                                ) : (
                                    <div className="space-y-4">
                                        {pendingLogs.map(log => {
                                            const boqItem = boqItems.find(b => b.id === log.boq_item_id)
                                            return (
                                                <div key={log.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                                                    <div className="flex justify-between items-start mb-3">
                                                        <div>
                                                            <p className="font-semibold text-slate-800">{boqItem?.description}</p>
                                                            <p className="text-sm text-slate-500">{log.notes}</p>
                                                            <p className="text-xs text-slate-400 mt-1">
                                                                Por: {log.foreman?.full_name} | {formatDate(log.log_date)}
                                                            </p>
                                                        </div>
                                                        <span className="font-bold text-blue-600">
                                                            +{log.quantity_executed} {boqItem?.unit}
                                                        </span>
                                                    </div>
                                                    
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 text-sm">
                                                        <div className="bg-white p-3 rounded-lg">
                                                            <p className="font-medium text-slate-700 mb-2">👷 Mano de Obra</p>
                                                            {log.labor_json?.map((l, i) => (
                                                                <p key={i} className="text-slate-500">{l.role}: {l.count} x {l.hours}h</p>
                                                            )) || <p className="text-slate-400">-</p>}
                                                        </div>
                                                        <div className="bg-white p-3 rounded-lg">
                                                            <p className="font-medium text-slate-700 mb-2">📦 Materiales</p>
                                                            {log.materials_json?.map((m, i) => (
                                                                <p key={i} className="text-slate-500">{m.name}: {m.qty} {m.unit}</p>
                                                            )) || <p className="text-slate-400">-</p>}
                                                        </div>
                                                        <div className="bg-white p-3 rounded-lg">
                                                            <p className="font-medium text-slate-700 mb-2">🚜 Maquinaria</p>
                                                            {log.machinery_json?.map((m, i) => (
                                                                <p key={i} className="text-slate-500">{m.name}: {m.hours}h</p>
                                                            )) || <p className="text-slate-400">-</p>}
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="flex items-center justify-between">
                                                        <span className={log.evidence_urls?.length > 0 ? 'text-green-600' : 'text-slate-400'}>
                                                            {log.evidence_urls?.length > 0 ? '📷 Con evidencia fotográfica' : '📷 Sin foto'}
                                                        </span>
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => handleRejectLog(log.id)}
                                                                className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
                                                            >
                                                                ✗ Rechazar
                                                            </button>
                                                            <button
                                                                onClick={() => handleApproveLog(log.id)}
                                                                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                                                            >
                                                                ✓ Aprobar
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </>
                        )}
                        
                        {activeTab === 'valuations' && (
                            <>
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-lg font-semibold text-slate-800">📊 Cuadro de Valorización</h3>
                                    <button
                                        onClick={downloadCSV}
                                        className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                                    >
                                        📥 Descargar CSV
                                    </button>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                                    <div className="bg-blue-50 rounded-lg p-4">
                                        <p className="text-sm text-blue-600 mb-1">Presupuesto</p>
                                        <p className="text-xl font-bold text-blue-700">{formatCurrency(totalBudget)}</p>
                                    </div>
                                    <div className="bg-green-50 rounded-lg p-4">
                                        <p className="text-sm text-green-600 mb-1">Valorizado</p>
                                        <p className="text-xl font-bold text-green-700">{formatCurrency(totalValorized)}</p>
                                    </div>
                                    <div className="bg-orange-50 rounded-lg p-4">
                                        <p className="text-sm text-orange-600 mb-1">Pendiente</p>
                                        <p className="text-xl font-bold text-orange-700">{formatCurrency(totalBudget - totalValorized)}</p>
                                    </div>
                                    <div className="bg-purple-50 rounded-lg p-4">
                                        <p className="text-sm text-purple-600 mb-1">% Avance</p>
                                        <p className="text-xl font-bold text-purple-700">
                                            {totalBudget > 0 ? Math.round(totalValorized / totalBudget * 100) : 0}%
                                        </p>
                                    </div>
                                </div>
                                
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-slate-100">
                                            <tr>
                                                <th className="px-3 py-2 text-left">Código</th>
                                                <th className="px-3 py-2 text-left">Descripción</th>
                                                <th className="px-3 py-2 text-center">Und</th>
                                                <th className="px-3 py-2 text-right">Metrado</th>
                                                <th className="px-3 py-2 text-right">P.U.</th>
                                                <th className="px-3 py-2 text-right">Parcial</th>
                                                <th className="px-3 py-2 text-center">%</th>
                                                <th className="px-3 py-2 text-right">Valorizado</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {boqItems.map(item => {
                                                const total = item.total_metrado * item.unit_price
                                                const valorized = total * (item.progress || 0) / 100
                                                return (
                                                    <tr key={item.id} className="hover:bg-slate-50">
                                                        <td className="px-3 py-2 font-mono">{item.code}</td>
                                                        <td className="px-3 py-2">{item.description}</td>
                                                        <td className="px-3 py-2 text-center">{item.unit}</td>
                                                        <td className="px-3 py-2 text-right">{item.total_metrado.toLocaleString()}</td>
                                                        <td className="px-3 py-2 text-right">{item.unit_price.toFixed(2)}</td>
                                                        <td className="px-3 py-2 text-right">{formatCurrency(total)}</td>
                                                        <td className="px-3 py-2 text-center">
                                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                                                (item.progress || 0) >= 75 ? 'bg-green-100 text-green-700' 
                                                                : (item.progress || 0) >= 50 ? 'bg-blue-100 text-blue-700' 
                                                                : 'bg-orange-100 text-orange-700'
                                                            }`}>
                                                                {item.progress || 0}%
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-2 text-right text-green-600 font-medium">
                                                            {formatCurrency(valorized)}
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                        <tfoot className="bg-slate-100 font-bold">
                                            <tr>
                                                <td colSpan="5" className="px-3 py-2">TOTAL</td>
                                                <td className="px-3 py-2 text-right">{formatCurrency(totalBudget)}</td>
                                                <td className="px-3 py-2 text-center">
                                                    {totalBudget > 0 ? Math.round(totalValorized / totalBudget * 100) : 0}%
                                                </td>
                                                <td className="px-3 py-2 text-right text-green-600">{formatCurrency(totalValorized)}</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </>
                        )}
                        
                        {activeTab === 'requisitions' && (
                            <>
                                <h3 className="text-lg font-semibold text-slate-800 mb-4">🛒 Requerimientos de Compra</h3>
                                
                                {/* New Requisition Form */}
                                <div className="bg-slate-50 rounded-xl p-6 mb-6">
                                    <h4 className="font-semibold text-slate-700 mb-4">➕ Nuevo Requerimiento</h4>
                                    <form onSubmit={handleCreateRequisition} className="grid grid-cols-1 md:grid-cols-5 gap-4">
                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Material</label>
                                            <select
                                                value={reqForm.itemName}
                                                onChange={(e) => {
                                                    const mat = materials.find(m => m.name === e.target.value)
                                                    setReqForm(prev => ({
                                                        ...prev,
                                                        itemName: e.target.value,
                                                        materialId: mat?.id || '',
                                                        unit: mat?.unit || 'UND'
                                                    }))
                                                }}
                                                required
                                                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                                            >
                                                <option value="">Seleccionar...</option>
                                                {materials.map(m => (
                                                    <option key={m.id} value={m.name}>{m.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Cantidad</label>
                                            <input
                                                type="number"
                                                value={reqForm.quantity}
                                                onChange={(e) => setReqForm(prev => ({ ...prev, quantity: e.target.value }))}
                                                required
                                                min="1"
                                                step="0.01"
                                                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Unidad</label>
                                            <select
                                                value={reqForm.unit}
                                                onChange={(e) => setReqForm(prev => ({ ...prev, unit: e.target.value }))}
                                                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                                            >
                                                {SUNAT_UNITS.map(u => (
                                                    <option key={u.code} value={u.code}>{u.code} - {u.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Urgencia</label>
                                            <select
                                                value={reqForm.urgency}
                                                onChange={(e) => setReqForm(prev => ({ ...prev, urgency: e.target.value }))}
                                                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                                            >
                                                <option value="low">🟢 Baja</option>
                                                <option value="medium">🟡 Media</option>
                                                <option value="high">🔴 Alta</option>
                                            </select>
                                        </div>
                                        <div className="md:col-span-4">
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Notas</label>
                                            <input
                                                type="text"
                                                value={reqForm.notes}
                                                onChange={(e) => setReqForm(prev => ({ ...prev, notes: e.target.value }))}
                                                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                                                placeholder="Observaciones..."
                                            />
                                        </div>
                                        <div className="flex items-end">
                                            <button
                                                type="submit"
                                                className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 font-medium"
                                            >
                                                Solicitar
                                            </button>
                                        </div>
                                    </form>
                                </div>
                                
                                {/* In Transit - Confirm Receipt */}
                                {inTransitReqs.length > 0 && (
                                    <div className="mb-6">
                                        <h4 className="font-semibold text-slate-700 mb-3">🚚 En Tránsito - Confirmar Recepción</h4>
                                        <div className="space-y-3">
                                            {inTransitReqs.map(req => (
                                                <div key={req.id} className="p-4 bg-orange-50 rounded-xl border border-orange-200">
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <p className="font-medium">{req.item_name}</p>
                                                            <p className="text-sm text-slate-500">{req.quantity} {req.unit}</p>
                                                        </div>
                                                        <button
                                                            onClick={() => handleConfirmReceived(req.id)}
                                                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
                                                        >
                                                            📦 Confirmar Recepción
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                
                                {/* All Requisitions */}
                                <h4 className="font-semibold text-slate-700 mb-3">📋 Historial de Requerimientos</h4>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-slate-100">
                                            <tr>
                                                <th className="px-3 py-2 text-left">Material</th>
                                                <th className="px-3 py-2 text-center">Cantidad</th>
                                                <th className="px-3 py-2 text-center">Urgencia</th>
                                                <th className="px-3 py-2 text-center">Estado</th>
                                                <th className="px-3 py-2 text-left">Fecha</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {requisitions.map(req => (
                                                <tr key={req.id} className="hover:bg-slate-50">
                                                    <td className="px-3 py-2">{req.item_name}</td>
                                                    <td className="px-3 py-2 text-center">{req.quantity} {req.unit}</td>
                                                    <td className="px-3 py-2 text-center">{getUrgencyBadge(req.urgency)}</td>
                                                    <td className="px-3 py-2 text-center">{getStatusBadge(req.status)}</td>
                                                    <td className="px-3 py-2 text-slate-500">{formatDate(req.requested_at)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}
                        
                        {activeTab === 'evidence' && (
                            <>
                                <h3 className="text-lg font-semibold text-slate-800 mb-4">📷 Evidencias Fotográficas</h3>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {dailyLogs.map(log => {
                                        const boqItem = boqItems.find(b => b.id === log.boq_item_id)
                                        const hasPhoto = log.evidence_urls?.length > 0
                                        return (
                                            <div key={log.id} className="bg-slate-50 rounded-xl overflow-hidden">
                                                <div className={`h-40 ${hasPhoto ? 'bg-green-100' : 'bg-red-100'} flex items-center justify-center`}>
                                                    {hasPhoto ? (
                                                        <img 
                                                            src={log.evidence_urls[0]} 
                                                            alt="Evidence" 
                                                            className="w-full h-full object-cover"
                                                        />
                                                    ) : (
                                                        <span className="text-slate-400 text-sm">Sin evidencia</span>
                                                    )}
                                                </div>
                                                <div className="p-4">
                                                    <p className="font-medium text-sm">{boqItem?.description}</p>
                                                    <p className="text-xs text-slate-500 mt-1">{log.notes}</p>
                                                    <div className="flex justify-between items-center mt-2">
                                                        <span className="text-xs text-slate-400">{formatDate(log.log_date)}</span>
                                                        <span className={`px-2 py-1 text-xs rounded-full ${
                                                            hasPhoto ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                                        }`}>
                                                            {hasPhoto ? '✓ Con foto' : '✗ Sin foto'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </>
                        )}
                    </div>
                )}
            </MainContent>
        </>
    )
}

// ============================================
// LOGISTICS MODULE
// ============================================
function LogisticsModule() {
    const { requisitions, updateRequisitionStatus, loading } = useApp()
    const { addToast } = useToast()
    const [activeTab, setActiveTab] = useState('pending')
    const [uploadModal, setUploadModal] = useState(null)
    const [documents, setDocuments] = useState({ factura: false, guia: false, foto: false })

    const toBuyReqs = requisitions.filter(r => r.status === 'to_buy')
    const inTransitReqs = requisitions.filter(r => r.status === 'in_transit')
    const completedReqs = requisitions.filter(r => r.status === 'completed' || r.status === 'received')

    const handlePurchase = async (reqId) => {
        if (!documents.factura) {
            addToast('La factura es requerida', 'warning')
            return
        }
        
        try {
            await updateRequisitionStatus(reqId, 'in_transit', {
                evidence_urls: {
                    factura: documents.factura ? 'FAC-' + Date.now() + '.pdf' : null,
                    guia_remision: documents.guia ? 'GR-' + Date.now() + '.pdf' : null,
                    foto_material: documents.foto ? 'FOTO-' + Date.now() + '.jpg' : null
                }
            })
            setUploadModal(null)
            setDocuments({ factura: false, guia: false, foto: false })
            addToast('Compra registrada exitosamente', 'success')
        } catch (err) {
            addToast('Error: ' + err.message, 'error')
        }
    }

    const menuItems = [
        { icon: '🛒', label: 'Por Comprar', active: activeTab === 'pending', onClick: () => setActiveTab('pending') },
        { icon: '🚚', label: 'En Tránsito', active: activeTab === 'transit', onClick: () => setActiveTab('transit') },
        { icon: '📦', label: 'Completados', active: activeTab === 'completed', onClick: () => setActiveTab('completed') }
    ]

    return (
        <>
            <MobileHeader />
            <Sidebar menuItems={menuItems} />
            <MainContent title="Logística - Compras" subtitle="Gestión de Requerimientos">
                {loading ? <LoadingSpinner /> : (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 sm:p-6">
                        {/* Stats */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                            <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                                <p className="text-sm text-blue-600 mb-1">🛒 Por Comprar</p>
                                <p className="text-2xl font-bold text-blue-700">{toBuyReqs.length}</p>
                            </div>
                            <div className="bg-orange-50 rounded-xl p-4 border border-orange-100">
                                <p className="text-sm text-orange-600 mb-1">🚚 En Tránsito</p>
                                <p className="text-2xl font-bold text-orange-700">{inTransitReqs.length}</p>
                            </div>
                            <div className="bg-green-50 rounded-xl p-4 border border-green-100">
                                <p className="text-sm text-green-600 mb-1">📦 Completados</p>
                                <p className="text-2xl font-bold text-green-700">{completedReqs.length}</p>
                            </div>
                        </div>
                        
                        {activeTab === 'pending' && (
                            <>
                                <h3 className="text-lg font-semibold text-slate-800 mb-4">🛒 Requerimientos Por Comprar</h3>
                                
                                {toBuyReqs.length === 0 ? (
                                    <p className="text-slate-500 text-center py-8 bg-slate-50 rounded-xl">
                                        No hay requerimientos pendientes de compra
                                    </p>
                                ) : (
                                    <div className="space-y-4">
                                        {toBuyReqs.map(req => (
                                            <div key={req.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                                                <div className="flex justify-between items-start mb-3">
                                                    <div>
                                                        <p className="font-semibold text-slate-800">{req.item_name}</p>
                                                        <p className="text-xs text-slate-400 mt-1">
                                                            Solicitado por: {req.requester?.full_name} | {formatDate(req.requested_at)}
                                                        </p>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="font-bold text-blue-600 text-lg">
                                                            {req.quantity} {req.unit}
                                                        </span>
                                                        <div className="mt-1">{getUrgencyBadge(req.urgency)}</div>
                                                    </div>
                                                </div>
                                                {req.request_notes && (
                                                    <p className="text-sm text-slate-600 mb-3 bg-white p-2 rounded">
                                                        {req.request_notes}
                                                    </p>
                                                )}
                                                <div className="flex justify-end">
                                                    <button
                                                        onClick={() => setUploadModal(req.id)}
                                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                                                    >
                                                        📄 Registrar Compra
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                        
                        {activeTab === 'transit' && (
                            <>
                                <h3 className="text-lg font-semibold text-slate-800 mb-4">🚚 En Tránsito</h3>
                                
                                {inTransitReqs.length === 0 ? (
                                    <p className="text-slate-500 text-center py-8 bg-slate-50 rounded-xl">
                                        No hay envíos en tránsito
                                    </p>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className="bg-slate-100">
                                                <tr>
                                                    <th className="px-4 py-3 text-left">Material</th>
                                                    <th className="px-4 py-3 text-center">Cantidad</th>
                                                    <th className="px-4 py-3 text-center">Documentos</th>
                                                    <th className="px-4 py-3 text-center">Fecha Compra</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {inTransitReqs.map(req => (
                                                    <tr key={req.id} className="hover:bg-slate-50">
                                                        <td className="px-4 py-3 font-medium">{req.item_name}</td>
                                                        <td className="px-4 py-3 text-center">{req.quantity} {req.unit}</td>
                                                        <td className="px-4 py-3 text-center">
                                                            <div className="flex justify-center gap-1">
                                                                {req.evidence_urls?.factura && (
                                                                    <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full">✅ Factura</span>
                                                                )}
                                                                {req.evidence_urls?.guia_remision && (
                                                                    <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full">✅ Guía</span>
                                                                )}
                                                                {req.evidence_urls?.foto_material && (
                                                                    <span className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded-full">✅ Foto</span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-center text-slate-500">
                                                            {formatDate(req.purchased_at)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </>
                        )}
                        
                        {activeTab === 'completed' && (
                            <>
                                <h3 className="text-lg font-semibold text-slate-800 mb-4">📦 Completados</h3>
                                
                                {completedReqs.length === 0 ? (
                                    <p className="text-slate-500 text-center py-8 bg-slate-50 rounded-xl">
                                        No hay requerimientos completados
                                    </p>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className="bg-slate-100">
                                                <tr>
                                                    <th className="px-4 py-3 text-left">Material</th>
                                                    <th className="px-4 py-3 text-center">Cantidad</th>
                                                    <th className="px-4 py-3 text-center">Estado</th>
                                                    <th className="px-4 py-3 text-center">Recibido</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {completedReqs.map(req => (
                                                    <tr key={req.id} className="hover:bg-slate-50">
                                                        <td className="px-4 py-3 font-medium">{req.item_name}</td>
                                                        <td className="px-4 py-3 text-center">{req.quantity} {req.unit}</td>
                                                        <td className="px-4 py-3 text-center">{getStatusBadge(req.status)}</td>
                                                        <td className="px-4 py-3 text-center text-green-600">
                                                            {formatDate(req.received_at)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}
                
                {/* Upload Modal */}
                {uploadModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl">
                            <h3 className="text-lg font-semibold mb-4">📄 Registrar Compra</h3>
                            
                            <div className="space-y-3 mb-6">
                                <div
                                    onClick={() => setDocuments(prev => ({ ...prev, factura: !prev.factura }))}
                                    className={`flex items-center justify-between p-3 border-2 rounded-lg cursor-pointer transition-all ${
                                        documents.factura ? 'border-green-500 bg-green-50' : 'border-slate-200 hover:border-blue-400'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="text-2xl">{documents.factura ? '✅' : '📄'}</span>
                                        <div>
                                            <p className="font-medium text-slate-800">Factura / Comprobante</p>
                                            <p className="text-xs text-red-500">* Requerido</p>
                                        </div>
                                    </div>
                                    <span className={`text-sm ${documents.factura ? 'text-green-600 font-medium' : 'text-slate-400'}`}>
                                        {documents.factura ? 'Cargado' : 'Clic para subir'}
                                    </span>
                                </div>
                                
                                <div
                                    onClick={() => setDocuments(prev => ({ ...prev, guia: !prev.guia }))}
                                    className={`flex items-center justify-between p-3 border-2 rounded-lg cursor-pointer transition-all ${
                                        documents.guia ? 'border-green-500 bg-green-50' : 'border-slate-200 hover:border-blue-400'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="text-2xl">{documents.guia ? '✅' : '📋'}</span>
                                        <div>
                                            <p className="font-medium text-slate-800">Guía de Remisión</p>
                                            <p className="text-xs text-slate-400">Opcional</p>
                                        </div>
                                    </div>
                                    <span className={`text-sm ${documents.guia ? 'text-green-600 font-medium' : 'text-slate-400'}`}>
                                        {documents.guia ? 'Cargado' : 'Clic para subir'}
                                    </span>
                                </div>
                                
                                <div
                                    onClick={() => setDocuments(prev => ({ ...prev, foto: !prev.foto }))}
                                    className={`flex items-center justify-between p-3 border-2 rounded-lg cursor-pointer transition-all ${
                                        documents.foto ? 'border-green-500 bg-green-50' : 'border-slate-200 hover:border-blue-400'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="text-2xl">{documents.foto ? '✅' : '📷'}</span>
                                        <div>
                                            <p className="font-medium text-slate-800">Foto del Material</p>
                                            <p className="text-xs text-slate-400">Opcional</p>
                                        </div>
                                    </div>
                                    <span className={`text-sm ${documents.foto ? 'text-green-600 font-medium' : 'text-slate-400'}`}>
                                        {documents.foto ? 'Cargado' : 'Clic para subir'}
                                    </span>
                                </div>
                            </div>
                            
                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        setUploadModal(null)
                                        setDocuments({ factura: false, guia: false, foto: false })
                                    }}
                                    className="flex-1 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={() => handlePurchase(uploadModal)}
                                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                                >
                                    ✓ Confirmar Compra
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </MainContent>
        </>
    )
}

// ============================================
// CEO MODULE (Simplified for brevity)
// ============================================
function CEOModule() {
    const { projects, loading, settings } = useApp()
    
    if (loading) {
        return <LoadingSpinner message="Cargando dashboard..." />
    }
    
    const totalBudget = projects.reduce((s, p) => s + (p.budget || 0), 0)
    const totalSpent = projects.reduce((s, p) => s + (p.spent || 0), 0)
    const avgProgress = projects.length > 0 
        ? Math.round(projects.reduce((s, p) => s + (p.progress || 0), 0) / projects.length) 
        : 0

    const menuItems = [
        { icon: '📊', label: 'Dashboard', active: true, onClick: () => {} },
        { icon: '📈', label: 'Imprimir Reporte', active: false, onClick: () => window.print() }
    ]

    return (
        <>
            <MobileHeader />
            <Sidebar menuItems={menuItems} />
            <MainContent title="Dashboard Ejecutivo" subtitle="Portafolio de Proyectos - Vista Global">
                {/* KPIs */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                        <p className="text-sm text-slate-500 mb-1">Proyectos Activos</p>
                        <p className="text-3xl font-bold text-blue-600">
                            {projects.filter(p => p.status === 'active').length}
                        </p>
                    </div>
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                        <p className="text-sm text-slate-500 mb-1">Presupuesto Total</p>
                        <p className="text-xl font-bold text-slate-800 truncate">{formatCurrency(totalBudget)}</p>
                    </div>
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                        <p className="text-sm text-slate-500 mb-1">Ejecutado</p>
                        <p className="text-xl font-bold text-green-600 truncate">{formatCurrency(totalSpent)}</p>
                    </div>
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                        <p className="text-sm text-slate-500 mb-1">Avance Promedio</p>
                        <p className="text-3xl font-bold text-purple-600">{avgProgress}%</p>
                    </div>
                </div>
                
                {/* Projects Grid */}
                <h2 className="text-lg font-semibold text-slate-800 mb-4">Proyectos del Portafolio</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {projects.map(project => {
                        const progressColor = (project.progress || 0) >= 75 ? 'bg-green-500' 
                            : (project.progress || 0) >= 50 ? 'bg-blue-500' 
                            : (project.progress || 0) >= 25 ? 'bg-yellow-500' 
                            : 'bg-red-500'
                        
                        return (
                            <div key={project.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <h3 className="font-semibold text-slate-800">{project.name}</h3>
                                        <p className="text-sm text-slate-500">{project.code}</p>
                                    </div>
                                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                        project.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'
                                    }`}>
                                        {project.status === 'active' ? '● Activo' : project.status}
                                    </span>
                                </div>
                                <p className="text-sm text-slate-600 mb-3">{project.client_name}</p>
                                <div className="mb-3">
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-slate-500">Avance</span>
                                        <span className="font-medium">{project.progress || 0}%</span>
                                    </div>
                                    <div className="w-full bg-slate-200 rounded-full h-2">
                                        <div 
                                            className={`h-2 rounded-full ${progressColor}`} 
                                            style={{ width: `${project.progress || 0}%` }}
                                        ></div>
                                    </div>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <div>
                                        <p className="text-slate-500">Presupuesto</p>
                                        <p className="font-semibold text-slate-800 truncate">{formatCurrency(project.budget)}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-slate-500">Ejecutado</p>
                                        <p className="font-semibold text-green-600 truncate">{formatCurrency(project.spent || 0)}</p>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </MainContent>
        </>
    )
}

// ============================================
// PM MODULE (Simplified for brevity)
// ============================================
function PMModule() {
    const { currentProject, boqItems, createBoqItem, updateBoqItem, loading } = useApp()
    const { addToast } = useToast()
    const [activeTab, setActiveTab] = useState('boq')
    const [showAddForm, setShowAddForm] = useState(false)
    const [newItem, setNewItem] = useState({
        code: '',
        description: '',
        unit: 'UND',
        category: 'estructuras',
        totalMetrado: '',
        unitPrice: ''
    })

    const handleAddItem = async (e) => {
        e.preventDefault()
        try {
            await createBoqItem(newItem)
            setShowAddForm(false)
            setNewItem({
                code: '',
                description: '',
                unit: 'UND',
                category: 'estructuras',
                totalMetrado: '',
                unitPrice: ''
            })
            addToast('Partida agregada correctamente', 'success')
        } catch (err) {
            addToast('Error: ' + err.message, 'error')
        }
    }

    const menuItems = [
        { icon: '📋', label: 'Gestión BOQ', active: activeTab === 'boq', onClick: () => setActiveTab('boq') },
        { icon: '📊', label: 'Avance', active: activeTab === 'progress', onClick: () => setActiveTab('progress') },
        { icon: '🔧', label: 'Recursos', active: activeTab === 'resources', onClick: () => setActiveTab('resources') }
    ]

    if (!currentProject) {
        return (
            <>
                <MobileHeader />
                <ProjectSelector 
                    title="Gestión de Proyectos" 
                    subtitle="Seleccione un proyecto para gestionar"
                />
            </>
        )
    }

    const totalBudget = boqItems.reduce((s, i) => s + (i.total_metrado * i.unit_price), 0)

    return (
        <>
            <MobileHeader />
            <Sidebar menuItems={menuItems} />
            <MainContent 
                title={currentProject.name} 
                subtitle="Gestión de Expediente Técnico"
                showBackButton
            >
                {loading ? <LoadingSpinner /> : (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 sm:p-6">
                        {activeTab === 'boq' && (
                            <>
                                <div className="flex justify-between items-center mb-6">
                                    <div>
                                        <h3 className="text-lg font-semibold text-slate-800">📋 Gestión de Expediente Técnico (BOQ)</h3>
                                        <p className="text-sm text-slate-500">Presupuesto Total: {formatCurrency(totalBudget)}</p>
                                    </div>
                                    <button
                                        onClick={() => setShowAddForm(!showAddForm)}
                                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm"
                                    >
                                        ➕ Agregar Partida
                                    </button>
                                </div>
                                
                                {showAddForm && (
                                    <div className="mb-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
                                        <h4 className="font-semibold text-blue-800 mb-4">Nueva Partida</h4>
                                        <form onSubmit={handleAddItem} className="grid grid-cols-1 md:grid-cols-6 gap-4">
                                            <div>
                                                <label className="block text-xs font-medium text-slate-600 mb-1">Código</label>
                                                <input
                                                    type="text"
                                                    value={newItem.code}
                                                    onChange={(e) => setNewItem(prev => ({ ...prev, code: e.target.value }))}
                                                    required
                                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                                                    placeholder="EST-001"
                                                />
                                            </div>
                                            <div className="md:col-span-2">
                                                <label className="block text-xs font-medium text-slate-600 mb-1">Descripción</label>
                                                <input
                                                    type="text"
                                                    value={newItem.description}
                                                    onChange={(e) => setNewItem(prev => ({ ...prev, description: e.target.value }))}
                                                    required
                                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-slate-600 mb-1">Unidad</label>
                                                <select
                                                    value={newItem.unit}
                                                    onChange={(e) => setNewItem(prev => ({ ...prev, unit: e.target.value }))}
                                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                                                >
                                                    {SUNAT_UNITS.map(u => (
                                                        <option key={u.code} value={u.code}>{u.code}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-slate-600 mb-1">Metrado</label>
                                                <input
                                                    type="number"
                                                    value={newItem.totalMetrado}
                                                    onChange={(e) => setNewItem(prev => ({ ...prev, totalMetrado: e.target.value }))}
                                                    required
                                                    min="0"
                                                    step="0.01"
                                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-slate-600 mb-1">P.U.</label>
                                                <input
                                                    type="number"
                                                    value={newItem.unitPrice}
                                                    onChange={(e) => setNewItem(prev => ({ ...prev, unitPrice: e.target.value }))}
                                                    required
                                                    min="0"
                                                    step="0.01"
                                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                                                />
                                            </div>
                                            <div className="md:col-span-6 flex gap-2">
                                                <button type="submit" className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700">
                                                    ✓ Guardar
                                                </button>
                                                <button 
                                                    type="button" 
                                                    onClick={() => setShowAddForm(false)}
                                                    className="bg-slate-200 px-4 py-2 rounded-lg hover:bg-slate-300"
                                                >
                                                    Cancelar
                                                </button>
                                            </div>
                                        </form>
                                    </div>
                                )}
                                
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-slate-100">
                                            <tr>
                                                <th className="px-4 py-2 text-left">Código</th>
                                                <th className="px-4 py-2 text-left">Descripción</th>
                                                <th className="px-4 py-2 text-center">Unidad</th>
                                                <th className="px-4 py-2 text-right">Metrado</th>
                                                <th className="px-4 py-2 text-right">P.U.</th>
                                                <th className="px-4 py-2 text-right">Parcial</th>
                                                <th className="px-4 py-2 text-center">Avance</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {boqItems.map(item => (
                                                <tr key={item.id} className="hover:bg-slate-50">
                                                    <td className="px-4 py-2 font-mono text-blue-600">{item.code}</td>
                                                    <td className="px-4 py-2">{item.description}</td>
                                                    <td className="px-4 py-2 text-center text-slate-500">{item.unit}</td>
                                                    <td className="px-4 py-2 text-right font-mono">{item.total_metrado?.toLocaleString()}</td>
                                                    <td className="px-4 py-2 text-right font-mono">{item.unit_price?.toFixed(2)}</td>
                                                    <td className="px-4 py-2 text-right font-medium">
                                                        {formatCurrency(item.total_metrado * item.unit_price)}
                                                    </td>
                                                    <td className="px-4 py-2 text-center">
                                                        <span className={`px-2 py-1 text-xs rounded-full ${
                                                            (item.progress || 0) >= 75 ? 'bg-green-100 text-green-700' 
                                                            : (item.progress || 0) >= 50 ? 'bg-blue-100 text-blue-700' 
                                                            : 'bg-orange-100 text-orange-700'
                                                        }`}>
                                                            {item.progress || 0}%
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </MainContent>
        </>
    )
}

// ============================================
// ADMIN MODULE - FULLY FUNCTIONAL
// ============================================
function AdminModule() {
    const { settings, loading, projects, refreshProjects, setError } = useApp()
    const { addToast } = useToast()
    const [activeTab, setActiveTab] = useState('personal')
    const [users, setUsers] = useState([])
    const [userAssignments, setUserAssignments] = useState({}) // userId -> [projectIds]
    const [loadingUsers, setLoadingUsers] = useState(false)
    const [showPasswords, setShowPasswords] = useState({})
    const [editingUser, setEditingUser] = useState(null)
    const [editUserForm, setEditUserForm] = useState({ role: '', assignedProjects: [] })
    const [createdUserModal, setCreatedUserModal] = useState(null) // { email, fullName, password }
    const [deleteConfirmUser, setDeleteConfirmUser] = useState(null)
    const [editingProject, setEditingProject] = useState(null)
    const [showActiveOnly, setShowActiveOnly] = useState(true)
    
    // New User Form State
    const [newUser, setNewUser] = useState({
        email: '',
        fullName: '',
        role: 'foreman',
        password: '',
        assignedProjects: []
    })
    
    // New Project Form State
    const [newProject, setNewProject] = useState({
        code: '',
        name: '',
        clientName: '',
        location: '',
        budget: '',
        startDate: '',
        endDate: ''
    })
    const [showProjectForm, setShowProjectForm] = useState(false)
    
    // Settings Form State
    const [settingsForm, setSettingsForm] = useState({
        companyName: settings.companyName,
        logoUrl: settings.logoUrl,
        currency: settings.currency,
        taxRate: settings.taxRate
    })
    
    // Load users on mount
    useEffect(() => {
        loadUsers()
    }, [])
    
    // Update settings form when settings change
    useEffect(() => {
        setSettingsForm({
            companyName: settings.companyName,
            logoUrl: settings.logoUrl,
            currency: settings.currency,
            taxRate: settings.taxRate
        })
    }, [settings])
    
    // Load users from database
    const loadUsers = async () => {
        setLoadingUsers(true)
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: false })
            
            if (error) throw error
            setUsers(data || [])
            
            // Load project assignments for all users
            const { data: assignments, error: assignError } = await supabase
                .from('project_assignments')
                .select('profile_id, project_id')
                .eq('is_active', true)
            
            if (!assignError && assignments) {
                const assignmentMap = {}
                assignments.forEach(a => {
                    if (!assignmentMap[a.profile_id]) {
                        assignmentMap[a.profile_id] = []
                    }
                    assignmentMap[a.profile_id].push(a.project_id)
                })
                setUserAssignments(assignmentMap)
            }
        } catch (err) {
            console.error('Error loading users:', err)
            setError(err.message)
        } finally {
            setLoadingUsers(false)
        }
    }
    
    // Generate random password
    const generatePassword = () => {
        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
        let password = ''
        for (let i = 0; i < 10; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length))
        }
        return password
    }
    
    // Create new user
    const handleCreateUser = async (e) => {
        e.preventDefault()
        
        try {
            setLoadingUsers(true)
            
            // Generate password if not provided
            const password = newUser.password || generatePassword()
            
            // Create auth user using admin API
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: newUser.email,
                password: password,
                options: {
                    data: {
                        full_name: newUser.fullName,
                        role: newUser.role
                    }
                }
            })
            
            if (authError) throw authError
            
            if (authData.user) {
                // Force update profile with correct role
                const { error: profileError } = await supabase
                    .from('profiles')
                    .upsert({
                        id: authData.user.id,
                        email: newUser.email,
                        full_name: newUser.fullName,
                        role: newUser.role,
                        is_active: true
                    })
                
                if (profileError) {
                    console.error('Profile update error:', profileError)
                    throw profileError
                }
                
                // Insert project assignments immediately
                if (newUser.assignedProjects.length > 0) {
                    const assignments = newUser.assignedProjects.map(projectId => ({
                        profile_id: authData.user.id,
                        project_id: projectId,
                        is_active: true,
                        permissions: { read: true, write: true }
                    }))
                    
                    const { error: assignError } = await supabase
                        .from('project_assignments')
                        .insert(assignments)
                    
                    if (assignError) console.error('Assignment error:', assignError)
                }
            }
            
            // Show password modal with copy functionality
            setCreatedUserModal({
                email: newUser.email,
                fullName: newUser.fullName,
                password: password
            })
            
            // Reset form
            setNewUser({
                email: '',
                fullName: '',
                role: 'foreman',
                password: '',
                assignedProjects: []
            })
            
            // Reload users
            await loadUsers()
            
        } catch (err) {
            addToast('Error al crear usuario: ' + err.message, 'error')
        } finally {
            setLoadingUsers(false)
        }
    }
    
    // Edit user - open modal
    const handleOpenEditUser = (user) => {
        setEditingUser(user)
        setEditUserForm({
            role: user.role,
            assignedProjects: userAssignments[user.id] || []
        })
    }
    
    // Update user role and assignments
    const handleUpdateUser = async (e) => {
        e.preventDefault()
        
        try {
            setLoadingUsers(true)
            
            // Update profile role
            const { error: profileError } = await supabase
                .from('profiles')
                .update({ role: editUserForm.role })
                .eq('id', editingUser.id)
            
            if (profileError) throw profileError
            
            // Delete all existing assignments for this user
            await supabase
                .from('project_assignments')
                .delete()
                .eq('profile_id', editingUser.id)
            
            // Insert new assignments
            if (editUserForm.assignedProjects.length > 0) {
                const assignments = editUserForm.assignedProjects.map(projectId => ({
                    profile_id: editingUser.id,
                    project_id: projectId,
                    is_active: true,
                    permissions: { read: true, write: true }
                }))
                
                const { error: assignError } = await supabase
                    .from('project_assignments')
                    .insert(assignments)
                
                if (assignError) throw assignError
            }
            
            addToast('Usuario actualizado correctamente', 'success')
            setEditingUser(null)
            await loadUsers()
            
        } catch (err) {
            addToast('Error: ' + err.message, 'error')
        } finally {
            setLoadingUsers(false)
        }
    }
    
    // Deactivate user (soft delete)
    const handleDeactivateUser = async (userId) => {
        try {
            setLoadingUsers(true)
            
            const { error } = await supabase
                .from('profiles')
                .update({ is_active: false })
                .eq('id', userId)
            
            if (error) throw error
            
            addToast('Usuario desactivado', 'success')
            setDeleteConfirmUser(null)
            await loadUsers()
            
        } catch (err) {
            addToast('Error: ' + err.message, 'error')
        } finally {
            setLoadingUsers(false)
        }
    }
    
    // Reactivate user
    const handleReactivateUser = async (userId) => {
        try {
            setLoadingUsers(true)
            
            const { error } = await supabase
                .from('profiles')
                .update({ is_active: true })
                .eq('id', userId)
            
            if (error) throw error
            
            addToast('Usuario reactivado', 'success')
            await loadUsers()
            
        } catch (err) {
            addToast('Error: ' + err.message, 'error')
        } finally {
            setLoadingUsers(false)
        }
    }
    
    // Toggle edit project assignment
    const toggleEditProjectAssignment = (projectId) => {
        setEditUserForm(prev => ({
            ...prev,
            assignedProjects: prev.assignedProjects.includes(projectId)
                ? prev.assignedProjects.filter(id => id !== projectId)
                : [...prev.assignedProjects, projectId]
        }))
    }
    
    // Send password reset email
    const handleSendPasswordReset = async (email) => {
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: window.location.origin
            })
            
            if (error) throw error
            
            addToast(`Email de recuperación enviado a ${email}`, 'success')
        } catch (err) {
            addToast('Error: ' + err.message, 'error')
        }
    }
    
    // Toggle password visibility
    const togglePassword = (userId) => {
        setShowPasswords(prev => ({ ...prev, [userId]: !prev[userId] }))
    }
    
    // Create new project
    const handleCreateProject = async (e) => {
        e.preventDefault()
        
        try {
            setLoadingUsers(true)
            
            const { data, error } = await supabase
                .from('projects')
                .insert({
                    code: newProject.code,
                    name: newProject.name,
                    client_name: newProject.clientName,
                    location: newProject.location,
                    budget: parseFloat(newProject.budget) || 0,
                    start_date: newProject.startDate || null,
                    end_date: newProject.endDate || null,
                    status: 'active',
                    progress: 0,
                    spent: 0
                })
                .select()
                .single()
            
            if (error) throw error
            
            addToast('Proyecto creado exitosamente', 'success')
            
            // Reset form
            setNewProject({
                code: '',
                name: '',
                clientName: '',
                location: '',
                budget: '',
                startDate: '',
                endDate: ''
            })
            setShowProjectForm(false)
            
            // Refresh projects list
            await refreshProjects()
            
        } catch (err) {
            addToast('Error al crear proyecto: ' + err.message, 'error')
        } finally {
            setLoadingUsers(false)
        }
    }
    
    // Update project
    const handleUpdateProject = async (e) => {
        e.preventDefault()
        
        try {
            setLoadingUsers(true)
            
            const { error } = await supabase
                .from('projects')
                .update({
                    name: editingProject.name,
                    client_name: editingProject.client_name,
                    location: editingProject.location,
                    budget: parseFloat(editingProject.budget) || 0,
                    status: editingProject.status
                })
                .eq('id', editingProject.id)
            
            if (error) throw error
            
            addToast('Proyecto actualizado', 'success')
            setEditingProject(null)
            await refreshProjects()
            
        } catch (err) {
            addToast('Error: ' + err.message, 'error')
        } finally {
            setLoadingUsers(false)
        }
    }
    
    // Delete/Deactivate project
    const handleDeactivateProject = async (projectId) => {
        if (!confirm('¿Está seguro de desactivar este proyecto?')) return
        
        try {
            const { error } = await supabase
                .from('projects')
                .update({ status: 'cancelled' })
                .eq('id', projectId)
            
            if (error) throw error
            
            await refreshProjects()
            addToast('Proyecto desactivado', 'success')
        } catch (err) {
            addToast('Error: ' + err.message, 'error')
        }
    }
    
    // Save settings
    const handleSaveSettings = async () => {
        try {
            const { error } = await supabase
                .from('companies')
                .update({
                    name: settingsForm.companyName,
                    logo_url: settingsForm.logoUrl,
                    currency: settingsForm.currency,
                    tax_rate: settingsForm.taxRate
                })
                .eq('id', '00000000-0000-0000-0000-000000000001')
            
            if (error) throw error
            
            addToast('Configuración guardada correctamente', 'success')
        } catch (err) {
            addToast('Error: ' + err.message, 'error')
        }
    }
    
    // Copy to clipboard
    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text).then(() => {
            addToast('Copiado al portapapeles', 'info')
        })
    }
    
    // Toggle project assignment for user
    const toggleProjectAssignment = (projectId) => {
        setNewUser(prev => ({
            ...prev,
            assignedProjects: prev.assignedProjects.includes(projectId)
                ? prev.assignedProjects.filter(id => id !== projectId)
                : [...prev.assignedProjects, projectId]
        }))
    }

    const menuItems = [
        { icon: '👥', label: 'Personal', active: activeTab === 'personal', onClick: () => setActiveTab('personal') },
        { icon: '🔐', label: 'Credenciales', active: activeTab === 'credentials', onClick: () => setActiveTab('credentials') },
        { icon: '📁', label: 'Proyectos', active: activeTab === 'projects', onClick: () => setActiveTab('projects') },
        { icon: '⚙️', label: 'Configuración', active: activeTab === 'settings', onClick: () => setActiveTab('settings') }
    ]

    return (
        <>
            <MobileHeader />
            <Sidebar menuItems={menuItems} />
            <MainContent title="Panel de Administración" subtitle="Gestión de usuarios, proyectos y configuración">
                {loading ? <LoadingSpinner /> : (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 sm:p-6">
                        
                        {/* PERSONAL TAB */}
                        {activeTab === 'personal' && (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {/* Create User Form */}
                                <div>
                                    <h3 className="text-lg font-semibold text-slate-800 mb-4">➕ Crear Nuevo Usuario</h3>
                                    <form onSubmit={handleCreateUser} className="space-y-4 bg-slate-50 p-6 rounded-xl">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
                                            <input
                                                type="email"
                                                value={newUser.email}
                                                onChange={(e) => setNewUser(prev => ({ ...prev, email: e.target.value }))}
                                                required
                                                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg bg-white"
                                                placeholder="usuario@empresa.com"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Nombre Completo *</label>
                                            <input
                                                type="text"
                                                value={newUser.fullName}
                                                onChange={(e) => setNewUser(prev => ({ ...prev, fullName: e.target.value }))}
                                                required
                                                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg bg-white"
                                                placeholder="Juan Pérez"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Rol *</label>
                                            <select
                                                value={newUser.role}
                                                onChange={(e) => setNewUser(prev => ({ ...prev, role: e.target.value }))}
                                                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg bg-white"
                                            >
                                                <option value="foreman">🔧 Maestro de Obra</option>
                                                <option value="engineer">👷 Ing. Residente</option>
                                                <option value="pm">📋 Project Manager</option>
                                                <option value="logistics">📦 Logística</option>
                                                <option value="ceo">👩‍💼 CEO</option>
                                                <option value="admin">👤 Administrador</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                                Contraseña <span className="text-slate-400">(dejar vacío para auto-generar)</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={newUser.password}
                                                onChange={(e) => setNewUser(prev => ({ ...prev, password: e.target.value }))}
                                                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg bg-white"
                                                placeholder="Auto-generada si vacía"
                                            />
                                        </div>
                                        
                                        {/* Project Assignment - Grid Layout */}
                                        {['pm', 'engineer', 'foreman'].includes(newUser.role) && (
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-2">Asignar Proyectos</label>
                                                <div className="max-h-48 overflow-y-auto p-3 bg-white border border-slate-200 rounded-lg">
                                                    {projects.length === 0 ? (
                                                        <p className="text-sm text-slate-400">No hay proyectos disponibles</p>
                                                    ) : (
                                                        <div className="grid grid-cols-1 gap-2">
                                                            {projects.filter(p => p.status === 'active').map(project => (
                                                                <label key={project.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={newUser.assignedProjects.includes(project.id)}
                                                                        onChange={() => toggleProjectAssignment(project.id)}
                                                                        className="rounded text-blue-600 w-4 h-4"
                                                                    />
                                                                    <div className="flex-1">
                                                                        <p className="text-sm font-medium">{project.name}</p>
                                                                        <p className="text-xs text-slate-400">{project.code}</p>
                                                                    </div>
                                                                </label>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                        
                                        <button
                                            type="submit"
                                            disabled={loadingUsers}
                                            className="w-full bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
                                        >
                                            {loadingUsers ? 'Creando...' : '✓ Crear Usuario'}
                                        </button>
                                    </form>
                                </div>
                                
                                {/* Users List */}
                                <div>
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="text-lg font-semibold text-slate-800">👥 Usuarios Registrados</h3>
                                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={showActiveOnly}
                                                onChange={() => setShowActiveOnly(!showActiveOnly)}
                                                className="rounded text-blue-600"
                                            />
                                            <span>Solo activos</span>
                                        </label>
                                    </div>
                                    {loadingUsers ? <LoadingSpinner message="Cargando usuarios..." /> : (
                                        <div className="space-y-3 max-h-[500px] overflow-y-auto">
                                            {users.filter(u => showActiveOnly ? u.is_active !== false : true).length === 0 ? (
                                                <p className="text-slate-500 text-center py-8">No hay usuarios registrados</p>
                                            ) : (
                                                users.filter(u => showActiveOnly ? u.is_active !== false : true).map(user => (
                                                    <div key={user.id} className={`p-4 rounded-xl border ${user.is_active === false ? 'bg-slate-100 border-slate-200 opacity-60' : 'bg-slate-50 border-slate-100'}`}>
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-12 h-12 bg-gradient-to-br from-slate-200 to-slate-300 rounded-full flex items-center justify-center text-xl">
                                                                    {user.avatar_url ? (
                                                                        <img src={user.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                                                                    ) : (
                                                                        user.full_name?.charAt(0)?.toUpperCase() || '👤'
                                                                    )}
                                                                </div>
                                                                <div>
                                                                    <p className="font-medium text-slate-800">{user.full_name}</p>
                                                                    <p className="text-sm text-slate-500">{user.email}</p>
                                                                    {userAssignments[user.id]?.length > 0 && (
                                                                        <p className="text-xs text-blue-600 mt-0.5">
                                                                            📁 {userAssignments[user.id].length} proyecto(s) asignado(s)
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <span className={`px-3 py-1 text-xs font-medium rounded-full ${getRoleColor(user.role)}`}>
                                                                    {getRoleName(user.role)}
                                                                </span>
                                                                {user.is_active === false && (
                                                                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700">
                                                                        Inactivo
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        
                                                        {/* Action Buttons */}
                                                        <div className="flex gap-2 mt-3 pt-3 border-t border-slate-200">
                                                            <button
                                                                onClick={() => handleOpenEditUser(user)}
                                                                className="flex-1 text-sm py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 font-medium"
                                                            >
                                                                ✏️ Editar
                                                            </button>
                                                            {user.is_active === false ? (
                                                                <button
                                                                    onClick={() => handleReactivateUser(user.id)}
                                                                    className="flex-1 text-sm py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 font-medium"
                                                                >
                                                                    ↩️ Reactivar
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    onClick={() => setDeleteConfirmUser(user)}
                                                                    className="flex-1 text-sm py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 font-medium"
                                                                >
                                                                    🗑️ Desactivar
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                        
                        {/* Created User Modal - Copy Password */}
                        {createdUserModal && (
                            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                                <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
                                    <div className="text-center mb-6">
                                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <span className="text-3xl">✅</span>
                                        </div>
                                        <h3 className="text-xl font-bold text-slate-800">Usuario Creado</h3>
                                        <p className="text-slate-500 mt-1">Guarde estas credenciales</p>
                                    </div>
                                    
                                    <div className="space-y-4 mb-6">
                                        <div className="p-4 bg-slate-50 rounded-xl">
                                            <p className="text-sm text-slate-500 mb-1">Nombre</p>
                                            <p className="font-medium text-slate-800">{createdUserModal.fullName}</p>
                                        </div>
                                        <div className="p-4 bg-slate-50 rounded-xl">
                                            <p className="text-sm text-slate-500 mb-1">Email</p>
                                            <div className="flex items-center justify-between">
                                                <p className="font-medium text-slate-800">{createdUserModal.email}</p>
                                                <button
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(createdUserModal.email)
                                                        addToast('Email copiado', 'info')
                                                    }}
                                                    className="text-blue-600 text-sm hover:underline"
                                                >
                                                    📋 Copiar
                                                </button>
                                            </div>
                                        </div>
                                        <div className="p-4 bg-green-50 rounded-xl border-2 border-green-200">
                                            <p className="text-sm text-green-600 mb-1">🔐 Contraseña</p>
                                            <div className="flex items-center justify-between">
                                                <code className="font-mono text-lg font-bold text-green-700">{createdUserModal.password}</code>
                                                <button
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(createdUserModal.password)
                                                        addToast('Contraseña copiada', 'success')
                                                    }}
                                                    className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
                                                >
                                                    📋 Copiar
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <button
                                        onClick={() => setCreatedUserModal(null)}
                                        className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700"
                                    >
                                        ✓ Entendido, Cerrar
                                    </button>
                                </div>
                            </div>
                        )}
                        
                        {/* Edit User Modal */}
                        {editingUser && (
                            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                                <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl">
                                    <h3 className="text-lg font-bold text-slate-800 mb-4">✏️ Editar Usuario</h3>
                                    
                                    <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl mb-4">
                                        <div className="w-12 h-12 bg-gradient-to-br from-slate-200 to-slate-300 rounded-full flex items-center justify-center text-xl">
                                            {editingUser.full_name?.charAt(0)?.toUpperCase() || '👤'}
                                        </div>
                                        <div>
                                            <p className="font-medium text-slate-800">{editingUser.full_name}</p>
                                            <p className="text-sm text-slate-500">{editingUser.email}</p>
                                        </div>
                                    </div>
                                    
                                    <form onSubmit={handleUpdateUser} className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Rol</label>
                                            <select
                                                value={editUserForm.role}
                                                onChange={(e) => setEditUserForm(prev => ({ ...prev, role: e.target.value }))}
                                                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg bg-white"
                                            >
                                                <option value="foreman">🔧 Maestro de Obra</option>
                                                <option value="engineer">👷 Ing. Residente</option>
                                                <option value="pm">📋 Project Manager</option>
                                                <option value="logistics">📦 Logística</option>
                                                <option value="ceo">👩‍💼 CEO</option>
                                                <option value="admin">👤 Administrador</option>
                                            </select>
                                        </div>
                                        
                                        {['pm', 'engineer', 'foreman'].includes(editUserForm.role) && (
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-2">Proyectos Asignados</label>
                                                <div className="max-h-48 overflow-y-auto p-3 bg-slate-50 border border-slate-200 rounded-lg">
                                                    {projects.filter(p => p.status === 'active').length === 0 ? (
                                                        <p className="text-sm text-slate-400">No hay proyectos disponibles</p>
                                                    ) : (
                                                        <div className="grid grid-cols-1 gap-2">
                                                            {projects.filter(p => p.status === 'active').map(project => (
                                                                <label key={project.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white cursor-pointer">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={editUserForm.assignedProjects.includes(project.id)}
                                                                        onChange={() => toggleEditProjectAssignment(project.id)}
                                                                        className="rounded text-blue-600 w-4 h-4"
                                                                    />
                                                                    <div className="flex-1">
                                                                        <p className="text-sm font-medium">{project.name}</p>
                                                                        <p className="text-xs text-slate-400">{project.code}</p>
                                                                    </div>
                                                                </label>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                        
                                        <div className="flex gap-3 pt-4">
                                            <button
                                                type="button"
                                                onClick={() => setEditingUser(null)}
                                                className="flex-1 px-4 py-2.5 border border-slate-200 rounded-lg hover:bg-slate-50"
                                            >
                                                Cancelar
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={loadingUsers}
                                                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
                                            >
                                                {loadingUsers ? 'Guardando...' : '✓ Guardar Cambios'}
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        )}
                        
                        {/* Delete Confirmation Modal */}
                        {deleteConfirmUser && (
                            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                                <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
                                    <div className="text-center mb-6">
                                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <span className="text-3xl">⚠️</span>
                                        </div>
                                        <h3 className="text-xl font-bold text-slate-800">¿Desactivar Usuario?</h3>
                                        <p className="text-slate-500 mt-2">
                                            ¿Está seguro que desea desactivar a <strong>{deleteConfirmUser.full_name}</strong>?
                                        </p>
                                        <p className="text-sm text-slate-400 mt-1">
                                            El usuario no podrá iniciar sesión hasta que sea reactivado.
                                        </p>
                                    </div>
                                    
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setDeleteConfirmUser(null)}
                                            className="flex-1 px-4 py-2.5 border border-slate-200 rounded-lg hover:bg-slate-50"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            onClick={() => handleDeactivateUser(deleteConfirmUser.id)}
                                            disabled={loadingUsers}
                                            className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium disabled:opacity-50"
                                        >
                                            {loadingUsers ? 'Desactivando...' : '🗑️ Sí, Desactivar'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                        
                        {/* CREDENTIALS TAB */}
                        {activeTab === 'credentials' && (
                            <div>
                                <h3 className="text-lg font-semibold text-slate-800 mb-4">🔐 Gestión de Credenciales</h3>
                                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                                    <p className="text-sm text-blue-800">
                                        <strong>Nota de seguridad:</strong> Por políticas de Supabase Auth, las contraseñas no pueden cambiarse directamente desde el panel. 
                                        Use "Enviar Reset" para que el usuario reciba un email y pueda establecer su nueva contraseña.
                                    </p>
                                </div>
                                
                                {loadingUsers ? <LoadingSpinner /> : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className="bg-slate-100">
                                                <tr>
                                                    <th className="px-4 py-3 text-left">Usuario</th>
                                                    <th className="px-4 py-3 text-left">Email</th>
                                                    <th className="px-4 py-3 text-left">Rol</th>
                                                    <th className="px-4 py-3 text-left">Estado</th>
                                                    <th className="px-4 py-3 text-left">Última Conexión</th>
                                                    <th className="px-4 py-3 text-center">Acciones</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {users.map(user => (
                                                    <tr key={user.id} className="hover:bg-slate-50">
                                                        <td className="px-4 py-3">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-10 h-10 bg-gradient-to-br from-slate-200 to-slate-300 rounded-full flex items-center justify-center text-lg">
                                                                    {user.avatar_url ? (
                                                                        <img src={user.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                                                                    ) : (
                                                                        user.full_name?.charAt(0)?.toUpperCase() || '👤'
                                                                    )}
                                                                </div>
                                                                <span className="font-medium">{user.full_name}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-slate-600">{user.email}</td>
                                                        <td className="px-4 py-3">
                                                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getRoleColor(user.role)}`}>
                                                                {getRoleName(user.role)}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                                                user.is_active !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                                            }`}>
                                                                {user.is_active !== false ? '● Activo' : '○ Inactivo'}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-slate-500">
                                                            {user.last_login ? formatDate(user.last_login) : 'Nunca'}
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <button
                                                                onClick={() => handleSendPasswordReset(user.email)}
                                                                className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 text-sm font-medium"
                                                            >
                                                                📧 Enviar Reset
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}
                        
                        {/* PROJECTS TAB */}
                        {activeTab === 'projects' && (
                            <div>
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-lg font-semibold text-slate-800">📁 Gestión de Proyectos</h3>
                                    <button
                                        onClick={() => setShowProjectForm(!showProjectForm)}
                                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm"
                                    >
                                        ➕ Nuevo Proyecto
                                    </button>
                                </div>
                                
                                {/* New Project Form */}
                                {showProjectForm && (
                                    <div className="mb-6 p-6 bg-blue-50 rounded-xl border border-blue-200">
                                        <h4 className="font-semibold text-blue-800 mb-4">Crear Nuevo Proyecto</h4>
                                        <form onSubmit={handleCreateProject} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">Código *</label>
                                                <input
                                                    type="text"
                                                    value={newProject.code}
                                                    onChange={(e) => setNewProject(prev => ({ ...prev, code: e.target.value }))}
                                                    required
                                                    className="w-full px-4 py-2 border border-slate-200 rounded-lg bg-white"
                                                    placeholder="PRJ-001"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre *</label>
                                                <input
                                                    type="text"
                                                    value={newProject.name}
                                                    onChange={(e) => setNewProject(prev => ({ ...prev, name: e.target.value }))}
                                                    required
                                                    className="w-full px-4 py-2 border border-slate-200 rounded-lg bg-white"
                                                    placeholder="Edificio Central"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">Cliente</label>
                                                <input
                                                    type="text"
                                                    value={newProject.clientName}
                                                    onChange={(e) => setNewProject(prev => ({ ...prev, clientName: e.target.value }))}
                                                    className="w-full px-4 py-2 border border-slate-200 rounded-lg bg-white"
                                                    placeholder="Empresa XYZ"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">Ubicación</label>
                                                <input
                                                    type="text"
                                                    value={newProject.location}
                                                    onChange={(e) => setNewProject(prev => ({ ...prev, location: e.target.value }))}
                                                    className="w-full px-4 py-2 border border-slate-200 rounded-lg bg-white"
                                                    placeholder="Lima, Perú"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">Presupuesto (S/)</label>
                                                <input
                                                    type="number"
                                                    value={newProject.budget}
                                                    onChange={(e) => setNewProject(prev => ({ ...prev, budget: e.target.value }))}
                                                    min="0"
                                                    step="0.01"
                                                    className="w-full px-4 py-2 border border-slate-200 rounded-lg bg-white"
                                                    placeholder="1000000"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">Fecha Inicio</label>
                                                <input
                                                    type="date"
                                                    value={newProject.startDate}
                                                    onChange={(e) => setNewProject(prev => ({ ...prev, startDate: e.target.value }))}
                                                    className="w-full px-4 py-2 border border-slate-200 rounded-lg bg-white"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">Fecha Fin</label>
                                                <input
                                                    type="date"
                                                    value={newProject.endDate}
                                                    onChange={(e) => setNewProject(prev => ({ ...prev, endDate: e.target.value }))}
                                                    className="w-full px-4 py-2 border border-slate-200 rounded-lg bg-white"
                                                />
                                            </div>
                                            <div className="md:col-span-2 flex gap-2">
                                                <button
                                                    type="submit"
                                                    disabled={loadingUsers}
                                                    className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
                                                >
                                                    {loadingUsers ? 'Creando...' : '✓ Crear Proyecto'}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowProjectForm(false)}
                                                    className="bg-slate-200 px-4 py-2 rounded-lg hover:bg-slate-300"
                                                >
                                                    Cancelar
                                                </button>
                                            </div>
                                        </form>
                                    </div>
                                )}
                                
                                {/* Projects List */}
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {projects.length === 0 ? (
                                        <p className="text-slate-500 text-center py-8 col-span-full">No hay proyectos registrados</p>
                                    ) : (
                                        projects.map(project => {
                                            const progressColor = (project.progress || 0) >= 75 ? 'bg-green-500' 
                                                : (project.progress || 0) >= 50 ? 'bg-blue-500' 
                                                : (project.progress || 0) >= 25 ? 'bg-yellow-500' 
                                                : 'bg-red-500'
                                            
                                            return (
                                                <div key={project.id} className="bg-slate-50 rounded-xl p-5 border border-slate-100">
                                                    <div className="flex justify-between items-start mb-3">
                                                        <div>
                                                            <p className="font-semibold text-slate-800">{project.name}</p>
                                                            <p className="text-sm text-slate-500 font-mono">{project.code}</p>
                                                        </div>
                                                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                                            project.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'
                                                        }`}>
                                                            {project.status === 'active' ? '● Activo' : project.status}
                                                        </span>
                                                    </div>
                                                    
                                                    <p className="text-sm text-slate-600 mb-2">{project.client_name || 'Sin cliente'}</p>
                                                    <p className="text-sm text-slate-500 mb-3">📍 {project.location || 'Sin ubicación'}</p>
                                                    
                                                    <div className="mb-3">
                                                        <div className="flex justify-between text-sm mb-1">
                                                            <span>Avance</span>
                                                            <span className="font-medium">{project.progress || 0}%</span>
                                                        </div>
                                                        <div className="w-full bg-slate-200 rounded-full h-2">
                                                            <div className={`h-2 rounded-full ${progressColor}`} style={{ width: `${project.progress || 0}%` }}></div>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="flex justify-between text-sm mb-3">
                                                        <span className="text-slate-500">Presupuesto:</span>
                                                        <span className="font-medium">{formatCurrency(project.budget)}</span>
                                                    </div>
                                                    
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => handleDeactivateProject(project.id)}
                                                            className="flex-1 text-sm py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
                                                        >
                                                            Desactivar
                                                        </button>
                                                    </div>
                                                </div>
                                            )
                                        })
                                    )}
                                </div>
                            </div>
                        )}
                        
                        {/* SETTINGS TAB */}
                        {activeTab === 'settings' && (
                            <div>
                                <h3 className="text-lg font-semibold text-slate-800 mb-4">⚙️ Configuración del Sistema</h3>
                                <div className="max-w-xl space-y-4 bg-slate-50 p-6 rounded-xl">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Nombre de la Empresa</label>
                                        <input
                                            type="text"
                                            value={settingsForm.companyName}
                                            onChange={(e) => setSettingsForm(prev => ({ ...prev, companyName: e.target.value }))}
                                            className="w-full px-4 py-2.5 border border-slate-200 rounded-lg bg-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">URL del Logo</label>
                                        <input
                                            type="url"
                                            value={settingsForm.logoUrl}
                                            onChange={(e) => setSettingsForm(prev => ({ ...prev, logoUrl: e.target.value }))}
                                            className="w-full px-4 py-2.5 border border-slate-200 rounded-lg bg-white"
                                            placeholder="https://ejemplo.com/logo.png"
                                        />
                                        {settingsForm.logoUrl && (
                                            <div className="mt-2 p-3 bg-white rounded-lg border border-slate-200">
                                                <p className="text-xs text-slate-500 mb-2">Vista previa:</p>
                                                <img 
                                                    src={settingsForm.logoUrl} 
                                                    alt="Logo preview" 
                                                    className="h-12 w-12 object-contain"
                                                    onError={(e) => e.target.style.display = 'none'}
                                                />
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Moneda</label>
                                        <select
                                            value={settingsForm.currency}
                                            onChange={(e) => setSettingsForm(prev => ({ ...prev, currency: e.target.value }))}
                                            className="w-full px-4 py-2.5 border border-slate-200 rounded-lg bg-white"
                                        >
                                            <option value="PEN">Soles (PEN)</option>
                                            <option value="USD">Dólares (USD)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Tasa de Impuesto (%)</label>
                                        <input
                                            type="number"
                                            value={settingsForm.taxRate}
                                            onChange={(e) => setSettingsForm(prev => ({ ...prev, taxRate: parseFloat(e.target.value) || 0 }))}
                                            min="0"
                                            max="100"
                                            step="0.01"
                                            className="w-full px-4 py-2.5 border border-slate-200 rounded-lg bg-white"
                                        />
                                    </div>
                                    <button 
                                        onClick={handleSaveSettings}
                                        className="w-full bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 font-medium"
                                    >
                                        💾 Guardar Configuración
                                    </button>
                                </div>
                            </div>
                        )}
                        
                    </div>
                )}
            </MainContent>
        </>
    )
}

// ============================================
// MAIN APP COMPONENT
// ============================================
function AppContent() {
    const { user, profile, loading, error, setError } = useApp()
    
    if (loading) {
        return (
            <div className="min-h-screen bg-slate-100 flex items-center justify-center">
                <LoadingSpinner message="Cargando aplicación..." />
            </div>
        )
    }
    
    if (!user || !profile) {
        return <LoginPage />
    }
    
    // Render based on role
    const renderModule = () => {
        switch (profile.role) {
            case 'admin':
                return <AdminModule />
            case 'ceo':
                return <CEOModule />
            case 'pm':
                return <PMModule />
            case 'engineer':
                return <EngineerModule />
            case 'foreman':
                return <ForemanModule />
            case 'logistics':
                return <LogisticsModule />
            default:
                return <LoginPage />
        }
    }
    
    return (
        <>
            <ErrorAlert message={error} onClose={() => setError(null)} />
            {renderModule()}
        </>
    )
}

// ============================================
// ROOT APP WITH PROVIDER
// ============================================
export default function App() {
    return (
        <ToastProvider>
            <AppProvider>
                <style>{`
                    @keyframes slide-in {
                        from {
                            transform: translateX(100%);
                            opacity: 0;
                        }
                        to {
                            transform: translateX(0);
                            opacity: 1;
                        }
                    }
                    .animate-slide-in {
                        animation: slide-in 0.3s ease-out;
                    }
                `}</style>
                <AppContent />
            </AppProvider>
        </ToastProvider>
    )
}
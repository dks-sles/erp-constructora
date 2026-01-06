import { useState, useEffect, useCallback } from 'react';
import { supabase, uploadEvidence, getUserProfile, getUserProjects } from './supabaseClient';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell
} from 'recharts';

// ============== UTILITY FUNCTIONS ==============
const generatePassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};

const exportToCSV = (data, filename) => {
  if (!data || data.length === 0) return;
  
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const cell = row[header] ?? '';
        const escaped = String(cell).replace(/"/g, '""');
        return `"${escaped}"`;
      }).join(',')
    )
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
};

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    minimumFractionDigits: 2
  }).format(amount || 0);
};

// ============== LOADING SPINNER COMPONENT ==============
const Spinner = ({ size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  };
  return (
    <div className={`${sizeClasses[size]} border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin`}></div>
  );
};

const LoadingOverlay = ({ message = 'Cargando...' }) => (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="bg-white rounded-lg p-6 flex flex-col items-center gap-4">
      <Spinner size="lg" />
      <p className="text-gray-700 font-medium">{message}</p>
    </div>
  </div>
);

// ============== MODAL COMPONENT ==============
const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full transition"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
};

// ============== PASSWORD MODAL COMPONENT ==============
const PasswordModal = ({ isOpen, onClose, userData }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(userData?.password || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen || !userData) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Usuario Creado Exitosamente">
      <div className="space-y-4">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-green-800 font-medium flex items-center gap-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Usuario creado correctamente
          </p>
        </div>
        
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-600">Email</label>
            <p className="text-gray-900 font-mono bg-gray-50 p-2 rounded">{userData.email}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600">Nombre</label>
            <p className="text-gray-900 bg-gray-50 p-2 rounded">{userData.full_name}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600">Contraseña (solo se muestra una vez)</label>
            <div className="flex gap-2">
              <p className="flex-1 text-gray-900 font-mono bg-yellow-50 border border-yellow-300 p-2 rounded">
                {userData.password}
              </p>
              <button
                onClick={handleCopy}
                className={`px-4 py-2 rounded font-medium transition ${
                  copied 
                    ? 'bg-green-500 text-white' 
                    : 'bg-blue-500 text-white hover:bg-blue-600'
                }`}
              >
                {copied ? '¡Copiado!' : 'Copiar'}
              </button>
            </div>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-4">
          <p className="text-amber-800 text-sm">
            <strong>⚠️ Importante:</strong> Guarde esta contraseña ahora. No podrá verla nuevamente.
          </p>
        </div>

        <button
          onClick={onClose}
          className="w-full mt-4 bg-gray-800 text-white py-2 rounded-lg hover:bg-gray-900 transition"
        >
          Entendido, Cerrar
        </button>
      </div>
    </Modal>
  );
};

// ============== ADMIN MODULE ==============
const AdminModule = ({ currentUser }) => {
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [createdUserData, setCreatedUserData] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    role: 'foreman',
    assigned_projects: []
  });
  const [submitting, setSubmitting] = useState(false);

  const roles = [
    { value: 'admin', label: 'Administrador' },
    { value: 'ceo', label: 'CEO' },
    { value: 'engineer', label: 'Ingeniero' },
    { value: 'foreman', label: 'Capataz' },
    { value: 'logistics', label: 'Logística' }
  ];

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, projectsRes] = await Promise.all([
        supabase.from('profiles').select('*, project_assignments(project_id)').order('created_at', { ascending: false }),
        supabase.from('projects').select('*').eq('is_active', true)
      ]);

      if (usersRes.data) setUsers(usersRes.data);
      if (projectsRes.data) setProjects(projectsRes.data);
    } catch (error) {
      console.error('Error fetching admin data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const password = generatePassword();

      // 1. Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: password,
        options: {
          data: {
            full_name: formData.full_name,
            role: formData.role
          }
        }
      });

      if (authError) throw authError;

      const userId = authData.user.id;

      // 2. Insert into profiles
      const { error: profileError } = await supabase.from('profiles').insert({
        id: userId,
        email: formData.email,
        full_name: formData.full_name,
        role: formData.role,
        is_active: true
      });

      if (profileError) throw profileError;

      // 3. Insert project assignments
      if (formData.assigned_projects.length > 0) {
        const assignments = formData.assigned_projects.map(projectId => ({
          user_id: userId,
          project_id: projectId
        }));

        const { error: assignError } = await supabase.from('project_assignments').insert(assignments);
        if (assignError) throw assignError;
      }

      // 4. Show password modal
      setCreatedUserData({
        email: formData.email,
        full_name: formData.full_name,
        password: password
      });
      setShowCreateModal(false);
      setShowPasswordModal(true);
      
      // Reset form
      setFormData({
        email: '',
        full_name: '',
        role: 'foreman',
        assigned_projects: []
      });
      
      fetchData();
    } catch (error) {
      console.error('Error creating user:', error);
      alert('Error al crear usuario: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditUser = async (e) => {
    e.preventDefault();
    if (!selectedUser) return;
    setSubmitting(true);

    try {
      // 1. Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name,
          role: formData.role
        })
        .eq('id', selectedUser.id);

      if (profileError) throw profileError;

      // 2. Delete old assignments
      const { error: deleteError } = await supabase
        .from('project_assignments')
        .delete()
        .eq('user_id', selectedUser.id);

      if (deleteError) throw deleteError;

      // 3. Insert new assignments
      if (formData.assigned_projects.length > 0) {
        const assignments = formData.assigned_projects.map(projectId => ({
          user_id: selectedUser.id,
          project_id: projectId
        }));

        const { error: assignError } = await supabase.from('project_assignments').insert(assignments);
        if (assignError) throw assignError;
      }

      setShowEditModal(false);
      setSelectedUser(null);
      fetchData();
      alert('Usuario actualizado correctamente');
    } catch (error) {
      console.error('Error updating user:', error);
      alert('Error al actualizar usuario: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSoftDelete = async (userId) => {
    if (!confirm('¿Está seguro de desactivar este usuario?')) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: false })
        .eq('id', userId);

      if (error) throw error;
      fetchData();
    } catch (error) {
      console.error('Error deactivating user:', error);
      alert('Error al desactivar usuario: ' + error.message);
    }
  };

  const openEditModal = (user) => {
    setSelectedUser(user);
    setFormData({
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      assigned_projects: user.project_assignments?.map(pa => pa.project_id) || []
    });
    setShowEditModal(true);
  };

  const handleProjectToggle = (projectId) => {
    setFormData(prev => ({
      ...prev,
      assigned_projects: prev.assigned_projects.includes(projectId)
        ? prev.assigned_projects.filter(id => id !== projectId)
        : [...prev.assigned_projects, projectId]
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-2xl font-bold text-gray-800">Gestión de Usuarios</h2>
        <button
          onClick={() => {
            setFormData({ email: '', full_name: '', role: 'foreman', assigned_projects: [] });
            setShowCreateModal(true);
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nuevo Usuario
        </button>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usuario</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rol</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Proyectos</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users.map(user => (
                <tr key={user.id} className={!user.is_active ? 'bg-gray-50 opacity-60' : ''}>
                  <td className="px-4 py-4">
                    <div>
                      <p className="font-medium text-gray-900">{user.full_name}</p>
                      <p className="text-sm text-gray-500">{user.email}</p>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      user.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                      user.role === 'ceo' ? 'bg-blue-100 text-blue-800' :
                      user.role === 'engineer' ? 'bg-green-100 text-green-800' :
                      user.role === 'foreman' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {roles.find(r => r.value === user.role)?.label || user.role}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      user.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {user.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-sm text-gray-600">
                      {user.project_assignments?.length || 0} proyecto(s)
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right space-x-2">
                    <button
                      onClick={() => openEditModal(user)}
                      className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                    >
                      Editar
                    </button>
                    {user.is_active && user.id !== currentUser?.id && (
                      <button
                        onClick={() => handleSoftDelete(user.id)}
                        className="text-red-600 hover:text-red-800 font-medium text-sm"
                      >
                        Eliminar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create User Modal */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Crear Nuevo Usuario">
        <form onSubmit={handleCreateUser} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="usuario@empresa.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Completo</label>
            <input
              type="text"
              required
              value={formData.full_name}
              onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Juan Pérez"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {roles.map(role => (
                <option key={role.value} value={role.value}>{role.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Proyectos Asignados</label>
            <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-2">
              {projects.map(project => (
                <label key={project.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                  <input
                    type="checkbox"
                    checked={formData.assigned_projects.includes(project.id)}
                    onChange={() => handleProjectToggle(project.id)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{project.name}</span>
                </label>
              ))}
              {projects.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-2">No hay proyectos disponibles</p>
              )}
            </div>
          </div>
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting && <Spinner size="sm" />}
              {submitting ? 'Creando...' : 'Crear Usuario'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit User Modal */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Editar Usuario">
        <form onSubmit={handleEditUser} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              disabled
              value={formData.email}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 text-gray-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Completo</label>
            <input
              type="text"
              required
              value={formData.full_name}
              onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {roles.map(role => (
                <option key={role.value} value={role.value}>{role.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Proyectos Asignados</label>
            <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-2">
              {projects.map(project => (
                <label key={project.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                  <input
                    type="checkbox"
                    checked={formData.assigned_projects.includes(project.id)}
                    onChange={() => handleProjectToggle(project.id)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{project.name}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => setShowEditModal(false)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting && <Spinner size="sm" />}
              {submitting ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Password Modal */}
      <PasswordModal
        isOpen={showPasswordModal}
        onClose={() => {
          setShowPasswordModal(false);
          setCreatedUserData(null);
        }}
        userData={createdUserData}
      />
    </div>
  );
};

// ============== FOREMAN MODULE ==============
const ForemanModule = ({ project, currentUser }) => {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [partidas, setPartidas] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [selectedPartida, setSelectedPartida] = useState(null);
  const [laborRows, setLaborRows] = useState([{ worker_type: 'peon', hours: '' }]);
  const [materialRows, setMaterialRows] = useState([{ material_id: '', quantity: '' }]);
  const [photos, setPhotos] = useState([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [notes, setNotes] = useState('');
  const [progressInput, setProgressInput] = useState('');
  const [validationError, setValidationError] = useState('');

  const workerTypes = [
    { value: 'peon', label: 'Peón', rate: 80 },
    { value: 'oficial', label: 'Oficial', rate: 120 },
    { value: 'operario', label: 'Operario', rate: 150 },
    { value: 'capataz', label: 'Capataz', rate: 200 }
  ];

  useEffect(() => {
    const fetchData = async () => {
      if (!project?.id) return;
      setLoading(true);

      try {
        const [partidasRes, materialsRes] = await Promise.all([
          supabase
            .from('partidas')
            .select('*')
            .eq('project_id', project.id)
            .order('code'),
          supabase
            .from('materials_catalog')
            .select('*')
            .eq('is_active', true)
            .order('name')
        ]);

        if (partidasRes.data) setPartidas(partidasRes.data);
        if (materialsRes.data) setMaterials(materialsRes.data);
      } catch (error) {
        console.error('Error fetching foreman data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [project?.id]);

  const addLaborRow = () => {
    setLaborRows(prev => [...prev, { worker_type: 'peon', hours: '' }]);
  };

  const removeLaborRow = (index) => {
    if (laborRows.length > 1) {
      setLaborRows(prev => prev.filter((_, i) => i !== index));
    }
  };

  const updateLaborRow = (index, field, value) => {
    setLaborRows(prev => prev.map((row, i) => 
      i === index ? { ...row, [field]: value } : row
    ));
  };

  const addMaterialRow = () => {
    setMaterialRows(prev => [...prev, { material_id: '', quantity: '' }]);
  };

  const removeMaterialRow = (index) => {
    if (materialRows.length > 1) {
      setMaterialRows(prev => prev.filter((_, i) => i !== index));
    }
  };

  const updateMaterialRow = (index, field, value) => {
    setMaterialRows(prev => prev.map((row, i) => 
      i === index ? { ...row, [field]: value } : row
    ));
  };

  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploadingPhotos(true);
    const uploadedPhotos = [];

    try {
      for (const file of files) {
        const url = await uploadEvidence(file, project.id, 'daily-reports');
        if (url) {
          uploadedPhotos.push({
            url,
            name: file.name,
            uploaded_at: new Date().toISOString()
          });
        }
      }
      setPhotos(prev => [...prev, ...uploadedPhotos]);
    } catch (error) {
      console.error('Error uploading photos:', error);
      alert('Error al subir algunas fotos');
    } finally {
      setUploadingPhotos(false);
    }
  };

  const removePhoto = (index) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const validateSubmission = () => {
    if (!selectedPartida) {
      setValidationError('Debe seleccionar una partida');
      return false;
    }

    const progress = parseFloat(progressInput) || 0;
    const currentProgress = selectedPartida.current_progress || 0;
    const totalBudgeted = selectedPartida.total_budgeted || 0;

    if (currentProgress + progress > totalBudgeted) {
      setValidationError(
        `El avance excede el presupuesto. Actual: ${currentProgress}, Ingresado: ${progress}, Máximo permitido: ${totalBudgeted - currentProgress}`
      );
      return false;
    }

    const validLabor = laborRows.some(row => row.hours && parseFloat(row.hours) > 0);
    if (!validLabor) {
      setValidationError('Debe ingresar al menos una fila de mano de obra con horas válidas');
      return false;
    }

    setValidationError('');
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateSubmission()) return;

    setSubmitting(true);

    try {
      // Calculate labor costs
      const laborData = laborRows
        .filter(row => row.hours && parseFloat(row.hours) > 0)
        .map(row => {
          const workerType = workerTypes.find(wt => wt.value === row.worker_type);
          return {
            worker_type: row.worker_type,
            hours: parseFloat(row.hours),
            rate: workerType?.rate || 0,
            cost: parseFloat(row.hours) * (workerType?.rate || 0)
          };
        });

      // Prepare materials data
      const materialsData = materialRows
        .filter(row => row.material_id && row.quantity && parseFloat(row.quantity) > 0)
        .map(row => {
          const material = materials.find(m => m.id === row.material_id);
          return {
            material_id: row.material_id,
            material_name: material?.name || '',
            quantity: parseFloat(row.quantity),
            unit: material?.unit || '',
            unit_cost: material?.unit_cost || 0,
            total_cost: parseFloat(row.quantity) * (material?.unit_cost || 0)
          };
        });

      // Create daily report
      const { data: reportData, error: reportError } = await supabase
        .from('daily_reports')
        .insert({
          project_id: project.id,
          partida_id: selectedPartida.id,
          user_id: currentUser.id,
          report_date: new Date().toISOString().split('T')[0],
          progress_value: parseFloat(progressInput) || 0,
          labor_data: laborData,
          materials_data: materialsData,
          photos: photos,
          notes: notes,
          total_labor_cost: laborData.reduce((sum, l) => sum + l.cost, 0),
          total_materials_cost: materialsData.reduce((sum, m) => sum + m.total_cost, 0)
        })
        .select()
        .single();

      if (reportError) throw reportError;

      // Update partida progress
      const newProgress = (selectedPartida.current_progress || 0) + (parseFloat(progressInput) || 0);
      const { error: updateError } = await supabase
        .from('partidas')
        .update({ current_progress: newProgress })
        .eq('id', selectedPartida.id);

      if (updateError) throw updateError;

      // Reset form
      setSelectedPartida(null);
      setLaborRows([{ worker_type: 'peon', hours: '' }]);
      setMaterialRows([{ material_id: '', quantity: '' }]);
      setPhotos([]);
      setNotes('');
      setProgressInput('');
      
      alert('Reporte diario guardado exitosamente');
      
      // Refresh partidas
      const { data: refreshedPartidas } = await supabase
        .from('partidas')
        .select('*')
        .eq('project_id', project.id)
        .order('code');
      
      if (refreshedPartidas) setPartidas(refreshedPartidas);

    } catch (error) {
      console.error('Error submitting report:', error);
      alert('Error al guardar el reporte: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Reporte Diario de Avance</h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Partida Selection */}
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Seleccionar Partida</h3>
          <select
            value={selectedPartida?.id || ''}
            onChange={(e) => {
              const partida = partidas.find(p => p.id === e.target.value);
              setSelectedPartida(partida);
              setValidationError('');
            }}
            className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">-- Seleccione una partida --</option>
            {partidas.map(partida => (
              <option key={partida.id} value={partida.id}>
                {partida.code} - {partida.name} (Avance: {partida.current_progress || 0}/{partida.total_budgeted || 0} {partida.unit})
              </option>
            ))}
          </select>
          
          {selectedPartida && (
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="text-xs text-blue-600 font-medium">Unidad</p>
                <p className="text-lg font-bold text-blue-800">{selectedPartida.unit}</p>
              </div>
              <div className="bg-green-50 p-3 rounded-lg">
                <p className="text-xs text-green-600 font-medium">Presupuestado</p>
                <p className="text-lg font-bold text-green-800">{selectedPartida.total_budgeted || 0}</p>
              </div>
              <div className="bg-yellow-50 p-3 rounded-lg">
                <p className="text-xs text-yellow-600 font-medium">Avance Actual</p>
                <p className="text-lg font-bold text-yellow-800">{selectedPartida.current_progress || 0}</p>
              </div>
              <div className="bg-purple-50 p-3 rounded-lg">
                <p className="text-xs text-purple-600 font-medium">Disponible</p>
                <p className="text-lg font-bold text-purple-800">
                  {(selectedPartida.total_budgeted || 0) - (selectedPartida.current_progress || 0)}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Progress Input */}
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Avance del Día</h3>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cantidad Ejecutada ({selectedPartida?.unit || 'unidad'})
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={progressInput}
                onChange={(e) => {
                  setProgressInput(e.target.value);
                  setValidationError('');
                }}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0.00"
              />
            </div>
          </div>
        </div>

        {/* Labor Section */}
        <div className="bg-white rounded-xl shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">Mano de Obra</h3>
            <button
              type="button"
              onClick={addLaborRow}
              className="text-blue-600 hover:text-blue-800 font-medium text-sm flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Agregar Fila
            </button>
          </div>
          
          <div className="space-y-3">
            {laborRows.map((row, index) => (
              <div key={index} className="flex gap-3 items-center">
                <select
                  value={row.worker_type}
                  onChange={(e) => updateLaborRow(index, 'worker_type', e.target.value)}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                >
                  {workerTypes.map(wt => (
                    <option key={wt.value} value={wt.value}>
                      {wt.label} (S/ {wt.rate}/hora)
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  placeholder="Horas"
                  value={row.hours}
                  onChange={(e) => updateLaborRow(index, 'hours', e.target.value)}
                  className="w-32 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                />
                {laborRows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeLaborRow(index)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Materials Section */}
        <div className="bg-white rounded-xl shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">Materiales Utilizados</h3>
            <button
              type="button"
              onClick={addMaterialRow}
              className="text-blue-600 hover:text-blue-800 font-medium text-sm flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Agregar Material
            </button>
          </div>
          
          <div className="space-y-3">
            {materialRows.map((row, index) => (
              <div key={index} className="flex gap-3 items-center">
                <select
                  value={row.material_id}
                  onChange={(e) => updateMaterialRow(index, 'material_id', e.target.value)}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Seleccionar material --</option>
                  {materials.map(mat => (
                    <option key={mat.id} value={mat.id}>
                      {mat.name} ({mat.unit}) - S/ {mat.unit_cost}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Cantidad"
                  value={row.quantity}
                  onChange={(e) => updateMaterialRow(index, 'quantity', e.target.value)}
                  className="w-32 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                />
                {materialRows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeMaterialRow(index)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Photos Section */}
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Evidencia Fotográfica</h3>
          
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition">
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handlePhotoUpload}
              className="hidden"
              id="photo-upload"
              disabled={uploadingPhotos}
            />
            <label
              htmlFor="photo-upload"
              className="cursor-pointer flex flex-col items-center gap-2"
            >
              {uploadingPhotos ? (
                <>
                  <Spinner size="md" />
                  <span className="text-gray-600">Subiendo fotos...</span>
                </>
              ) : (
                <>
                  <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-gray-600">Haga clic para subir fotos</span>
                  <span className="text-sm text-gray-400">JPG, PNG hasta 10MB</span>
                </>
              )}
            </label>
          </div>

          {photos.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              {photos.map((photo, index) => (
                <div key={index} className="relative group">
                  <img
                    src={photo.url}
                    alt={photo.name}
                    className="w-full h-24 object-cover rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(index)}
                    className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Observaciones</h3>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Ingrese observaciones del día, incidentes, clima, etc."
          />
        </div>

        {/* Validation Error */}
        {validationError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {validationError}
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={submitting || uploadingPhotos}
          className="w-full bg-blue-600 text-white py-4 rounded-xl font-semibold text-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {submitting && <Spinner size="sm" />}
          {submitting ? 'Guardando Reporte...' : 'Guardar Reporte Diario'}
        </button>
      </form>
    </div>
  );
};

// ============== ENGINEER MODULE ==============
const EngineerModule = ({ project }) => {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('progress');
  const [partidas, setPartidas] = useState([]);
  const [dailyReports, setDailyReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!project?.id) return;
      setLoading(true);

      try {
        const [partidasRes, reportsRes] = await Promise.all([
          supabase
            .from('partidas')
            .select('*')
            .eq('project_id', project.id)
            .order('code'),
          supabase
            .from('daily_reports')
            .select('*, profiles(full_name), partidas(code, name)')
            .eq('project_id', project.id)
            .order('report_date', { ascending: false })
        ]);

        if (partidasRes.data) setPartidas(partidasRes.data);
        if (reportsRes.data) setDailyReports(reportsRes.data);
      } catch (error) {
        console.error('Error fetching engineer data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [project?.id]);

  const handleExportCSV = () => {
    const exportData = partidas.map(p => ({
      Codigo: p.code,
      Partida: p.name,
      Unidad: p.unit,
      Presupuestado: p.total_budgeted || 0,
      'Avance Actual': p.current_progress || 0,
      'Porcentaje (%)': ((p.current_progress || 0) / (p.total_budgeted || 1) * 100).toFixed(2),
      'Precio Unitario': p.unit_price || 0,
      'Costo Presupuestado': (p.total_budgeted || 0) * (p.unit_price || 0),
      'Costo Ejecutado': (p.current_progress || 0) * (p.unit_price || 0)
    }));

    exportToCSV(exportData, `avance_${project.name.replace(/\s+/g, '_')}`);
  };

  const tabs = [
    { id: 'progress', label: 'Avance de Partidas' },
    { id: 'reports', label: 'Reportes Diarios' },
    { id: 'evidence', label: 'Evidencia Fotográfica' }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-2xl font-bold text-gray-800">Panel de Ingeniero</h2>
        <button
          onClick={handleExportCSV}
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Exportar Excel
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-3 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Progress Tab */}
      {activeTab === 'progress' && (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Código</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Partida</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Unidad</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Presupuestado</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ejecutado</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Avance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {partidas.map(partida => {
                  const progress = ((partida.current_progress || 0) / (partida.total_budgeted || 1)) * 100;
                  return (
                    <tr key={partida.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-sm text-gray-600">{partida.code}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{partida.name}</td>
                      <td className="px-4 py-3 text-center text-gray-600">{partida.unit}</td>
                      <td className="px-4 py-3 text-center text-gray-600">{partida.total_budgeted || 0}</td>
                      <td className="px-4 py-3 text-center font-medium text-gray-900">{partida.current_progress || 0}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${
                                progress >= 100 ? 'bg-green-500' : progress >= 50 ? 'bg-blue-500' : 'bg-yellow-500'
                              }`}
                              style={{ width: `${Math.min(progress, 100)}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium text-gray-600 w-12 text-right">
                            {progress.toFixed(0)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Reports Tab */}
      {activeTab === 'reports' && (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Partida</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reportado por</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Avance</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Costo MO</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Costo Mat.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {dailyReports.map(report => (
                  <tr
                    key={report.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => setSelectedReport(report)}
                  >
                    <td className="px-4 py-3 text-gray-600">
                      {new Date(report.report_date).toLocaleDateString('es-PE')}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm text-gray-500">{report.partidas?.code}</span>
                      <span className="ml-2 text-gray-900">{report.partidas?.name}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{report.profiles?.full_name}</td>
                    <td className="px-4 py-3 text-center font-medium text-gray-900">{report.progress_value}</td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {formatCurrency(report.total_labor_cost)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {formatCurrency(report.total_materials_cost)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Evidence Tab */}
      {activeTab === 'evidence' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {dailyReports
            .filter(report => report.photos && report.photos.length > 0)
            .map(report => (
              <div key={report.id} className="bg-white rounded-xl shadow overflow-hidden">
                <div className="p-4 border-b">
                  <p className="font-medium text-gray-900">
                    {new Date(report.report_date).toLocaleDateString('es-PE')}
                  </p>
                  <p className="text-sm text-gray-500">{report.partidas?.name}</p>
                  <p className="text-xs text-gray-400">Por: {report.profiles?.full_name}</p>
                </div>
                <div className="grid grid-cols-2 gap-1 p-1">
                  {report.photos.map((photo, idx) => (
                    <a
                      key={idx}
                      href={photo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block"
                    >
                      <img
                        src={photo.url}
                        alt={`Evidencia ${idx + 1}`}
                        className="w-full h-24 object-cover hover:opacity-80 transition"
                      />
                    </a>
                  ))}
                </div>
                {report.notes && (
                  <div className="p-3 bg-gray-50 text-sm text-gray-600">
                    {report.notes}
                  </div>
                )}
              </div>
            ))}
          {dailyReports.filter(r => r.photos?.length > 0).length === 0 && (
            <div className="col-span-full text-center py-12 text-gray-500">
              No hay evidencia fotográfica disponible
            </div>
          )}
        </div>
      )}

      {/* Report Detail Modal */}
      <Modal
        isOpen={!!selectedReport}
        onClose={() => setSelectedReport(null)}
        title={`Reporte del ${selectedReport ? new Date(selectedReport.report_date).toLocaleDateString('es-PE') : ''}`}
      >
        {selectedReport && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Partida</p>
                <p className="font-medium">{selectedReport.partidas?.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Avance</p>
                <p className="font-medium">{selectedReport.progress_value}</p>
              </div>
            </div>

            {selectedReport.labor_data?.length > 0 && (
              <div>
                <p className="text-sm text-gray-500 mb-2">Mano de Obra</p>
                <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                  {selectedReport.labor_data.map((labor, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="capitalize">{labor.worker_type}</span>
                      <span>{labor.hours}h × S/{labor.rate} = {formatCurrency(labor.cost)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedReport.materials_data?.length > 0 && (
              <div>
                <p className="text-sm text-gray-500 mb-2">Materiales</p>
                <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                  {selectedReport.materials_data.map((mat, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span>{mat.material_name}</span>
                      <span>{mat.quantity} {mat.unit} = {formatCurrency(mat.total_cost)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedReport.notes && (
              <div>
                <p className="text-sm text-gray-500 mb-2">Observaciones</p>
                <p className="bg-gray-50 rounded-lg p-3 text-sm">{selectedReport.notes}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

// ============== CEO MODULE ==============
const CEOModule = () => {
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState([]);
  const [cashFlowData, setCashFlowData] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      try {
        const { data: projectsData, error } = await supabase
          .from('projects')
          .select(`
            *,
            partidas(id, current_progress, total_budgeted, unit_price),
            daily_reports(id, total_labor_cost, total_materials_cost, report_date)
          `)
          .eq('is_active', true);

        if (error) throw error;

        // Process project data
        const processedProjects = projectsData.map(project => {
          const totalBudget = project.partidas?.reduce((sum, p) => 
            sum + ((p.total_budgeted || 0) * (p.unit_price || 0)), 0
          ) || project.total_budget || 0;

          const executedCost = project.daily_reports?.reduce((sum, r) => 
            sum + (r.total_labor_cost || 0) + (r.total_materials_cost || 0), 0
          ) || 0;

          const overallProgress = project.partidas?.length > 0
            ? project.partidas.reduce((sum, p) => {
                const pProgress = ((p.current_progress || 0) / (p.total_budgeted || 1)) * 100;
                return sum + pProgress;
              }, 0) / project.partidas.length
            : 0;

          return {
            ...project,
            totalBudget,
            executedCost,
            overallProgress: Math.min(overallProgress, 100)
          };
        });

        setProjects(processedProjects);

        // Generate cash flow data (last 6 months)
        const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const now = new Date();
        const cashFlow = [];

        for (let i = 5; i >= 0; i--) {
          const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          
          let monthIncome = 0;
          let monthExpense = 0;

          projectsData.forEach(project => {
            project.daily_reports?.forEach(report => {
              if (report.report_date?.startsWith(monthKey)) {
                monthExpense += (report.total_labor_cost || 0) + (report.total_materials_cost || 0);
              }
            });
          });

          // Simulate income based on progress (in real app, this would come from invoices)
          monthIncome = monthExpense * 1.15;

          cashFlow.push({
            month: monthNames[date.getMonth()],
            ingresos: Math.round(monthIncome),
            egresos: Math.round(monthExpense),
            balance: Math.round(monthIncome - monthExpense)
          });
        }

        setCashFlowData(cashFlow);
      } catch (error) {
        console.error('Error fetching CEO data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const totalBudget = projects.reduce((sum, p) => sum + p.totalBudget, 0);
  const totalExecuted = projects.reduce((sum, p) => sum + p.executedCost, 0);
  const avgProgress = projects.length > 0
    ? projects.reduce((sum, p) => sum + p.overallProgress, 0) / projects.length
    : 0;

  const pieData = projects.map(p => ({
    name: p.name,
    value: p.totalBudget
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Dashboard Ejecutivo</h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-5 text-white">
          <p className="text-blue-100 text-sm font-medium">Total Proyectos</p>
          <p className="text-3xl font-bold mt-1">{projects.length}</p>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-5 text-white">
          <p className="text-green-100 text-sm font-medium">Presupuesto Total</p>
          <p className="text-lg font-bold mt-1 truncate" title={formatCurrency(totalBudget)}>
            {formatCurrency(totalBudget)}
          </p>
        </div>
        <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl p-5 text-white">
          <p className="text-yellow-100 text-sm font-medium">Ejecutado</p>
          <p className="text-lg font-bold mt-1 truncate" title={formatCurrency(totalExecuted)}>
            {formatCurrency(totalExecuted)}
          </p>
        </div>
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-5 text-white">
          <p className="text-purple-100 text-sm font-medium">Avance Promedio</p>
          <p className="text-3xl font-bold mt-1">{avgProgress.toFixed(1)}%</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cash Flow Chart */}
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Flujo de Caja (Últimos 6 meses)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={cashFlowData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="month" stroke="#6B7280" />
              <YAxis stroke="#6B7280" tickFormatter={(v) => `S/${(v/1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(value) => formatCurrency(value)}
                labelStyle={{ color: '#374151' }}
              />
              <Legend />
              <Bar dataKey="ingresos" name="Ingresos" fill="#10B981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="egresos" name="Egresos" fill="#EF4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Budget Distribution */}
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Distribución de Presupuesto</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
                label={({ name, percent }) => `${name.substring(0, 10)}... (${(percent * 100).toFixed(0)}%)`}
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => formatCurrency(value)} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Balance Trend */}
      <div className="bg-white rounded-xl shadow p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Tendencia de Balance</h3>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={cashFlowData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis dataKey="month" stroke="#6B7280" />
            <YAxis stroke="#6B7280" tickFormatter={(v) => `S/${(v/1000).toFixed(0)}k`} />
            <Tooltip formatter={(value) => formatCurrency(value)} />
            <Line
              type="monotone"
              dataKey="balance"
              name="Balance"
              stroke="#8B5CF6"
              strokeWidth={3}
              dot={{ fill: '#8B5CF6', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Projects List */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-semibold text-gray-800">Todos los Proyectos</h3>
        </div>
        <div className="divide-y divide-gray-100">
          {projects.map((project, index) => (
            <div
              key={project.id}
              className="p-4 hover:bg-gray-50 cursor-pointer transition"
              onClick={() => setSelectedProject(project)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <div>
                    <p className="font-medium text-gray-900">{project.name}</p>
                    <p className="text-sm text-gray-500">{project.location || 'Sin ubicación'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold text-gray-900 truncate max-w-[150px]" title={formatCurrency(project.totalBudget)}>
                    {formatCurrency(project.totalBudget)}
                  </p>
                  <div className="flex items-center gap-2 justify-end">
                    <div className="w-20 bg-gray-200 rounded-full h-2">
                      <div
                        className="h-2 rounded-full bg-blue-500"
                        style={{ width: `${project.overallProgress}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-600">{project.overallProgress.toFixed(0)}%</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Project Detail Modal */}
      <Modal
        isOpen={!!selectedProject}
        onClose={() => setSelectedProject(null)}
        title={selectedProject?.name || 'Detalle del Proyecto'}
      >
        {selectedProject && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-xs text-gray-500">Presupuesto</p>
                <p className="font-semibold text-gray-900 truncate">{formatCurrency(selectedProject.totalBudget)}</p>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-xs text-gray-500">Ejecutado</p>
                <p className="font-semibold text-gray-900 truncate">{formatCurrency(selectedProject.executedCost)}</p>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-xs text-gray-500">Avance</p>
                <p className="font-semibold text-gray-900">{selectedProject.overallProgress.toFixed(1)}%</p>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-xs text-gray-500">Partidas</p>
                <p className="font-semibold text-gray-900">{selectedProject.partidas?.length || 0}</p>
              </div>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Progreso General</p>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-gray-200 rounded-full h-3">
                  <div
                    className="h-3 rounded-full bg-blue-500 transition-all"
                    style={{ width: `${selectedProject.overallProgress}%` }}
                  />
                </div>
                <span className="font-medium text-gray-700">{selectedProject.overallProgress.toFixed(0)}%</span>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

// ============== LOGISTICS MODULE ==============
const LogisticsModule = ({ project }) => {
  const [loading, setLoading] = useState(true);
  const [materials, setMaterials] = useState([]);
  const [materialUsage, setMaterialUsage] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      if (!project?.id) return;
      setLoading(true);

      try {
        const [catalogRes, reportsRes] = await Promise.all([
          supabase.from('materials_catalog').select('*').eq('is_active', true),
          supabase
            .from('daily_reports')
            .select('materials_data, report_date')
            .eq('project_id', project.id)
        ]);

        if (catalogRes.data) setMaterials(catalogRes.data);

        // Aggregate material usage
        const usageMap = new Map();
        reportsRes.data?.forEach(report => {
          report.materials_data?.forEach(mat => {
            const existing = usageMap.get(mat.material_id) || {
              material_id: mat.material_id,
              material_name: mat.material_name,
              total_quantity: 0,
              total_cost: 0,
              unit: mat.unit
            };
            existing.total_quantity += mat.quantity || 0;
            existing.total_cost += mat.total_cost || 0;
            usageMap.set(mat.material_id, existing);
          });
        });

        setMaterialUsage(Array.from(usageMap.values()));
      } catch (error) {
        console.error('Error fetching logistics data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [project?.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Logística de Materiales</h2>

      {/* Material Usage Summary */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-semibold text-gray-800">Consumo de Materiales</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Material</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Unidad</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Cantidad Usada</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Costo Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {materialUsage.map(usage => (
                <tr key={usage.material_id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{usage.material_name}</td>
                  <td className="px-4 py-3 text-center text-gray-600">{usage.unit}</td>
                  <td className="px-4 py-3 text-center font-medium text-gray-900">
                    {usage.total_quantity.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-900">
                    {formatCurrency(usage.total_cost)}
                  </td>
                </tr>
              ))}
              {materialUsage.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                    No hay consumo de materiales registrado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Materials Catalog */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-semibold text-gray-800">Catálogo de Materiales</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
          {materials.map(mat => (
            <div key={mat.id} className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900">{mat.name}</h4>
              <p className="text-sm text-gray-500">{mat.description || 'Sin descripción'}</p>
              <div className="mt-2 flex justify-between text-sm">
                <span className="text-gray-600">{mat.unit}</span>
                <span className="font-medium text-gray-900">{formatCurrency(mat.unit_cost)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ============== MAIN APP COMPONENT ==============
export default function App() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [activeModule, setActiveModule] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Check auth state on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUser(session.user);
          const userProfile = await getUserProfile(session.user.id);
          setProfile(userProfile);
          
          if (userProfile) {
            const userProjects = await getUserProjects(session.user.id, userProfile.role);
            setProjects(userProjects || []);
          }
        }
      } catch (error) {
        console.error('Auth check error:', error);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user);
        const userProfile = await getUserProfile(session.user.id);
        setProfile(userProfile);
        
        if (userProfile) {
          const userProjects = await getUserProjects(session.user.id, userProfile.role);
          setProjects(userProjects || []);
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        setProjects([]);
        setSelectedProject(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: loginForm.email,
        password: loginForm.password
      });

      if (error) throw error;
    } catch (error) {
      setLoginError(error.message || 'Error al iniciar sesión');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const getModulesForRole = (role) => {
    const modules = {
      admin: [
        { id: 'users', label: 'Usuarios', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' }
      ],
      ceo: [
        { id: 'dashboard', label: 'Dashboard', icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z' }
      ],
      engineer: [
        { id: 'progress', label: 'Avance', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' }
      ],
      foreman: [
        { id: 'report', label: 'Reporte Diario', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' }
      ],
      logistics: [
        { id: 'materials', label: 'Materiales', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' }
      ]
    };

    return modules[role] || [];
  };

  const needsProjectSelection = (role) => {
    return ['engineer', 'foreman', 'logistics'].includes(role);
  };

  const renderContent = () => {
    if (!profile) return null;

    const role = profile.role;

    // Admin module
    if (role === 'admin') {
      return <AdminModule currentUser={profile} />;
    }

    // CEO module
    if (role === 'ceo') {
      return <CEOModule />;
    }

    // Roles that need project selection
    if (needsProjectSelection(role) && !selectedProject) {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">Seleccione un Proyecto</h3>
          <p className="text-gray-500">Use el menú lateral para elegir un proyecto</p>
        </div>
      );
    }

    switch (role) {
      case 'engineer':
        return <EngineerModule project={selectedProject} />;
      case 'foreman':
        return <ForemanModule project={selectedProject} currentUser={profile} />;
      case 'logistics':
        return <LogisticsModule project={selectedProject} />;
      default:
        return <div className="text-center py-12 text-gray-500">Rol no reconocido</div>;
    }
  };

  // Loading state
  if (loading) {
    return <LoadingOverlay message="Cargando aplicación..." />;
  }

  // Login screen
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-purple-700 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-800">Sistema de Gestión</h1>
            <p className="text-gray-500 mt-1">Control de Obras</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {loginError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {loginError}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Correo Electrónico</label>
              <input
                type="email"
                required
                value={loginForm.email}
                onChange={(e) => setLoginForm(prev => ({ ...prev, email: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                placeholder="usuario@empresa.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
              <input
                type="password"
                required
                value={loginForm.password}
                onChange={(e) => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loginLoading && <Spinner size="sm" />}
              {loginLoading ? 'Ingresando...' : 'Ingresar'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const modules = getModulesForRole(profile?.role);
  const showProjects = needsProjectSelection(profile?.role);

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Mobile Hamburger Button */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="md:hidden fixed top-4 left-4 z-40 bg-white p-2 rounded-lg shadow-lg"
      >
        <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Sidebar Overlay (Mobile) */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-64 bg-gray-900 text-white transform transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-4 border-b border-gray-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <span className="font-bold text-lg">Control Obras</span>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="md:hidden p-1 hover:bg-gray-800 rounded"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* User Info */}
          <div className="p-4 border-b border-gray-800">
            <p className="font-medium truncate">{profile?.full_name}</p>
            <p className="text-sm text-gray-400 capitalize">{profile?.role}</p>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-4 space-y-2">
            {/* Module Links */}
            {modules.map(module => (
              <button
                key={module.id}
                onClick={() => {
                  setActiveModule(module.id);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                  activeModule === module.id
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={module.icon} />
                </svg>
                {module.label}
              </button>
            ))}

            {/* Projects Section */}
            {showProjects && projects.length > 0 && (
              <div className="mt-6">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-4">
                  Proyectos
                </p>
                {projects.map(project => (
                  <button
                    key={project.id}
                    onClick={() => {
                      setSelectedProject(project);
                      setSidebarOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                      selectedProject?.id === project.id
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-300 hover:bg-gray-800'
                    }`}
                  >
                    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    <span className="truncate">{project.name}</span>
                  </button>
                ))}
              </div>
            )}
          </nav>

          {/* Logout */}
          <div className="p-4 border-t border-gray-800">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-300 hover:bg-gray-800 transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Cerrar Sesión
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {/* Top Header */}
        <header className="bg-white shadow-sm px-4 md:px-6 py-4 sticky top-0 z-30">
          <div className="flex items-center justify-between">
            <div className="ml-10 md:ml-0">
              {selectedProject ? (
                <div>
                  <h1 className="text-xl font-bold text-gray-800">{selectedProject.name}</h1>
                  <p className="text-sm text-gray-500">{selectedProject.location || 'Sin ubicación'}</p>
                </div>
              ) : (
                <h1 className="text-xl font-bold text-gray-800">
                  {profile?.role === 'admin' ? 'Administración' :
                   profile?.role === 'ceo' ? 'Dashboard Ejecutivo' :
                   'Sistema de Control de Obras'}
                </h1>
              )}
            </div>
            <div className="flex items-center gap-4">
              <span className="hidden sm:block text-sm text-gray-500">
                {new Date().toLocaleDateString('es-PE', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-4 md:p-6">
          {renderContent()}
        </div>
      </main>
    </div>
  );
}
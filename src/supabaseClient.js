import { createClient } from '@supabase/supabase-js'

// TUS CREDENCIALES
const supabaseUrl = 'https://kmunyebyfyxobmkfptqe.supabase.co'
const supabaseKey = 'sb_publishable_Oj98rTHfSyRtrfv2BW3lGg_p5T_oX2f'

// 1. La Conexión Principal
export const supabase = createClient(supabaseUrl, supabaseKey)

// 2. Nombre del "Bucket" (Carpeta en la nube donde se guardan fotos)
export const EVIDENCE_BUCKET = 'evidence-photos'

// 3. Función para subir fotos (El Maestro y Logística la usan)
export async function uploadEvidence(file, folder = 'misc') {
  const fileExt = file.name.split('.').pop()
  const fileName = `${Math.random()}.${fileExt}`
  const filePath = `${folder}/${fileName}`

  // Subir archivo
  const { error: uploadError } = await supabase.storage
    .from(EVIDENCE_BUCKET)
    .upload(filePath, file)

  if (uploadError) {
    console.error('Error subiendo imagen:', uploadError)
    return null
  }

  // Obtener la URL pública para verla
  const { data } = supabase.storage
    .from(EVIDENCE_BUCKET)
    .getPublicUrl(filePath)

  return data.publicUrl
}

// 4. Función para obtener el perfil del usuario (Nombre, Rol)
export async function getUserProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  
  if (error) return null
  return data
}

// 5. Función para saber qué proyectos puede ver el usuario
export async function getUserProjects(userId, userRole) {
  // Si es Admin o CEO, ve todo
  if (userRole === 'admin' || userRole === 'ceo') {
     const { data } = await supabase.from('projects').select('*')
     return data || []
  }
  
  // Si es mortal, solo sus asignados
  const { data, error } = await supabase
    .from('project_assignments')
    .select('project_id, projects(*)')
    .eq('user_id', userId)
  
  if (error || !data) return []
  // Limpiamos el formato de datos
  return data.map(item => item.projects)
}
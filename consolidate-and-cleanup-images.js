/**
 * Script para consolidar imágenes repetidas en productos de Supabase con el mismo nombre,
 * y luego eliminar los archivos de imagen huérfanos/redundantes del bucket 'productos_img'.
 * 
 * INSTRUCCIONES:
 * 1. Instala las dependencias si no lo están: npm install @supabase/supabase-js
 * 2. Ejecuta: node consolidate-and-cleanup-images.js
 */

const { createClient } = require('@supabase/supabase-js');

// USA TUS CREDENCIALES DE SUPABASE (iguales a las de tu app)
const supabaseUrl = 'https://oxsaaxehamevzfnxqefx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94c2FheGVoYW1ldnpmbnhxZWZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NzQ1NjIsImV4cCI6MjA5MjQ1MDU2Mn0.5J9func6UyhvBxt5XakKEQiQsXdUV5KO-7W4O8atXMQ';

const supabase = createClient(supabaseUrl, supabaseKey);
const BUCKET = 'productos_img';

async function consolidateAndCleanup() {
  console.log('🔍 Cargando productos de la base de datos...\n');
  
  const { data: productos, error: prodError } = await supabase
    .from('productos')
    .select('id, nombre, codigo_sku, imagen_url');

  if (prodError) {
    console.error('❌ Error al cargar productos:', prodError.message);
    return;
  }

  if (!productos || productos.length === 0) {
    console.log('📂 No hay productos registrados.');
    return;
  }

  console.log(`📦 Se encontraron ${productos.length} productos.`);

  // 1. Agrupar productos por nombre (sin acentos, en minúsculas y sin espacios adicionales)
  const normalizeName = (name) => {
    if (!name) return '';
    return name
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  };

  const groups = {};
  for (const p of productos) {
    const normName = normalizeName(p.nombre);
    if (!groups[normName]) {
      groups[normName] = [];
    }
    groups[normName].push(p);
  }

  console.log(`✨ Agrupados en ${Object.keys(groups).length} nombres únicos.`);
  console.log('\n🔄 Consolidando imágenes para variantes con el mismo nombre...');

  let dbUpdatesCount = 0;

  for (const normName in groups) {
    const group = groups[normName];
    // Encontrar el primer producto en el grupo que ya tenga una imagen asociada
    const mainImageProduct = group.find(p => p.imagen_url && p.imagen_url.trim() !== '');
    
    if (mainImageProduct) {
      const sharedImageUrl = mainImageProduct.imagen_url;
      // Para todos los productos en el mismo grupo, asignarles esta misma imagen si difiere
      for (const p of group) {
        if (p.imagen_url !== sharedImageUrl) {
          console.log(`  Actualizando [${p.nombre}] (${p.codigo_sku || 'S/SKU'}) para usar imagen consolidada.`);
          const { error: updateError } = await supabase
            .from('productos')
            .update({ imagen_url: sharedImageUrl })
            .eq('id', p.id);
          
          if (updateError) {
            console.error(`  ❌ Error actualizando producto ${p.id}:`, updateError.message);
          } else {
            dbUpdatesCount++;
          }
        }
      }
    }
  }

  console.log(`\n✅ Se actualizaron ${dbUpdatesCount} productos en la base de datos.`);

  // 2. Obtener lista de imágenes en uso (después de la consolidación)
  const { data: updatedProductos, error: reError } = await supabase
    .from('productos')
    .select('imagen_url');

  if (reError) {
    console.error('❌ Error al recargar productos para verificar URLs en uso:', reError.message);
    return;
  }

  const usedFilenames = new Set();
  for (const p of updatedProductos) {
    if (p.imagen_url && p.imagen_url.trim() !== '') {
      // Extraer el nombre de archivo del URL
      const filename = p.imagen_url.substring(p.imagen_url.lastIndexOf('/') + 1);
      usedFilenames.add(filename);
    }
  }

  console.log(`\n📌 Hay ${usedFilenames.size} archivos de imagen únicos actualmente en uso por productos.`);

  // 3. Listar archivos del bucket de Supabase
  console.log('📂 Listando archivos en el bucket de almacenamiento...');
  const { data: files, error: listError } = await supabase.storage
    .from(BUCKET)
    .list('', {
      limit: 1000,
      sortBy: { column: 'name', order: 'asc' }
    });

  if (listError) {
    console.error('❌ Error listando bucket:', listError.message);
    return;
  }

  if (!files || files.length === 0) {
    console.log('📂 El bucket está vacío.');
    return;
  }

  // Filtrar solo archivos de imagen
  const imageFiles = files.filter(f => 
    !f.name.startsWith('.') && 
    (f.name.endsWith('.jpg') || f.name.endsWith('.jpeg') || f.name.endsWith('.png') || f.name.endsWith('.webp'))
  );

  console.log(`📂 Se encontraron ${imageFiles.length} archivos totales en el bucket.`);

  // 4. Encontrar archivos huérfanos/no utilizados
  const orphanedFiles = [];
  let totalOrphanedSize = 0;

  for (const file of imageFiles) {
    if (!usedFilenames.has(file.name)) {
      orphanedFiles.push(file.name);
      totalOrphanedSize += (file.metadata?.size || 0);
    }
  }

  console.log(`\n🧹 Se identificaron ${orphanedFiles.length} imágenes huérfanas (sin productos que las usen).`);
  console.log(`💾 Espacio ocupado por huérfanas: ${(totalOrphanedSize / (1024 * 1024)).toFixed(2)} MB`);

  if (orphanedFiles.length > 0) {
    console.log('\n🗑️ Eliminando archivos huérfanos del bucket...');
    // Supabase permite eliminar hasta 100 archivos por petición
    const chunkSize = 50;
    let deletedCount = 0;
    
    for (let i = 0; i < orphanedFiles.length; i += chunkSize) {
      const chunk = orphanedFiles.slice(i, i + chunkSize);
      const { error: deleteError } = await supabase.storage.from(BUCKET).remove(chunk);
      if (deleteError) {
        console.error('  ❌ Error eliminando lote de archivos:', deleteError.message);
      } else {
        deletedCount += chunk.length;
        console.log(`  🗑️ Eliminados ${deletedCount}/${orphanedFiles.length} archivos...`);
      }
    }

    console.log(`\n🎉 Limpieza completa. Se liberaron ${(totalOrphanedSize / (1024 * 1024)).toFixed(2)} MB en Supabase.`);
  } else {
    console.log('\n✨ No se encontraron imágenes redundantes para eliminar.');
  }
}

consolidateAndCleanup().catch(console.error);

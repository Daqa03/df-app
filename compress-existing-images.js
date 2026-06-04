/**
 * Script para comprimir TODAS las imágenes existentes en el bucket 'productos_img' de Supabase.
 * 
 * INSTRUCCIONES:
 * 1. Instala las dependencias: npm install @supabase/supabase-js sharp
 * 2. Ejecuta: node compress-existing-images.js <tu-correo> <tu-contraseña>
 */

const { createClient } = require('@supabase/supabase-js');

// USA TUS CREDENCIALES DE SUPABASE
const supabaseUrl = 'https://oxsaaxehamevzfnxqefx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94c2FheGVoYW1ldnpmbnhxZWZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NzQ1NjIsImV4cCI6MjA5MjQ1MDU2Mn0.5J9func6UyhvBxt5XakKEQiQsXdUV5KO-7W4O8atXMQ';

const supabase = createClient(supabaseUrl, supabaseKey);

const BUCKET = 'productos_img';
const MAX_WIDTH = 800;
const QUALITY = 70;

async function compressExistingImages() {
  const email = process.argv[2];
  const password = process.argv[3];

  if (!email || !password) {
    console.log('⚠️  Para ejecutar este script, debes iniciar sesión con tus credenciales de la app.');
    console.log('Uso: node compress-existing-images.js <correo> <contraseña>\n');
    return;
  }

  console.log('🔑 Iniciando sesión en Supabase...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (authError) {
    console.error('❌ Error al iniciar sesión:', authError.message);
    return;
  }

  console.log(`✅ Sesión iniciada con éxito (${authData.user.email})\n`);
  console.log('🔍 Listando archivos en el bucket...\n');
  
  const { data: files, error } = await supabase.storage.from(BUCKET).list('', {
    limit: 1000,
    sortBy: { column: 'name', order: 'asc' }
  });

  if (error) {
    console.error('❌ Error listando archivos:', error.message);
    return;
  }

  if (!files || files.length === 0) {
    console.log('📂 No se encontraron archivos en el bucket.');
    return;
  }

  // Filtrar solo imágenes
  const imageFiles = files.filter(f => 
    !f.id?.startsWith('.') && 
    (f.name.endsWith('.jpg') || f.name.endsWith('.jpeg') || f.name.endsWith('.png') || f.name.endsWith('.webp'))
  );

  console.log(`📷 Se encontraron ${imageFiles.length} imágenes para comprimir.\n`);

  let totalOriginal = 0;
  let totalCompressed = 0;
  let processed = 0;
  let skipped = 0;
  let errored = 0;

  // Intentar importar sharp
  let sharp;
  try {
    sharp = require('sharp');
  } catch (e) {
    console.error('❌ Error: "sharp" no está instalado. Ejecuta: npm install sharp');
    return;
  }

  for (const file of imageFiles) {
    try {
      process.stdout.write(`  [${processed + 1}/${imageFiles.length}] ${file.name}... `);

      // 1. Descargar la imagen original
      const { data: downloadData, error: downloadError } = await supabase.storage
        .from(BUCKET)
        .download(file.name);

      if (downloadError || !downloadData) {
        console.log('⚠️ No se pudo descargar, saltando.');
        skipped++;
        continue;
      }

      const originalBuffer = Buffer.from(await downloadData.arrayBuffer());
      const originalSize = originalBuffer.length;
      totalOriginal += originalSize;

      // 2. Comprimir con sharp
      const compressedBuffer = await sharp(originalBuffer)
        .resize(MAX_WIDTH, null, { 
          withoutEnlargement: true, 
          fit: 'inside' 
        })
        .jpeg({ quality: QUALITY })
        .toBuffer();

      const compressedSize = compressedBuffer.length;
      totalCompressed += compressedSize;

      // Solo re-subir si la compresión realmente redujo el tamaño
      if (compressedSize < originalSize * 0.9) { // Al menos 10% más pequeño
        // 3. Eliminar el archivo original
        await supabase.storage.from(BUCKET).remove([file.name]);

        // 4. Subir la versión comprimida
        const newName = file.name.replace(/\.[^.]+$/, '.jpg'); // Asegurar extensión .jpg
        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(newName, compressedBuffer, {
            contentType: 'image/jpeg',
            upsert: true
          });

        if (uploadError) {
          console.log(`⚠️ Error al subir: ${uploadError.message}`);
          errored++;
        } else {
          const saved = ((1 - compressedSize / originalSize) * 100).toFixed(1);
          console.log(`✅ ${(originalSize/1024).toFixed(0)}KB → ${(compressedSize/1024).toFixed(0)}KB (-${saved}%)`);
        }
      } else {
        console.log(`⏭️ Ya está optimizada (${(originalSize/1024).toFixed(0)}KB)`);
        totalCompressed += originalSize - compressedSize; // Ajustar
      }

      processed++;

    } catch (err) {
      console.log(`❌ Error: ${err.message}`);
      errored++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 RESUMEN DE COMPRESIÓN');
  console.log('='.repeat(50));
  console.log(`  Archivos procesados: ${processed}`);
  console.log(`  Archivos saltados:   ${skipped}`);
  console.log(`  Errores:             ${errored}`);
  console.log(`  Tamaño original:     ${(totalOriginal / (1024*1024)).toFixed(2)} MB`);
  console.log(`  Tamaño comprimido:   ${(totalCompressed / (1024*1024)).toFixed(2)} MB`);
  console.log(`  Espacio liberado:    ${((totalOriginal - totalCompressed) / (1024*1024)).toFixed(2)} MB`);
  console.log('='.repeat(50));
}

compressExistingImages().catch(console.error);

/**
 * Utilidades de compresión de imágenes para D&F App.
 * Comprime imágenes antes de subirlas a Supabase para ahorrar espacio.
 */

/**
 * Comprime una imagen dada su URI, redimensionándola y reduciendo calidad.
 * Funciona en web usando Canvas.
 * 
 * @param uri - URI de la imagen (puede ser base64, blob URL, o file URI)
 * @param maxWidth - Ancho máximo en píxeles (default 800)
 * @param quality - Calidad JPEG de 0 a 1 (default 0.7)
 * @returns Un Blob de la imagen comprimida listo para subir
 */
export async function compressImageForUpload(
  uri: string,
  maxWidth: number = 800,
  quality: number = 0.7
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (uri.startsWith('http://') || uri.startsWith('https://')) {
      img.crossOrigin = 'anonymous';
    }
    
    img.onload = () => {
      // Calcular dimensiones manteniendo aspect ratio
      let width = img.width;
      let height = img.height;
      
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      
      // Crear canvas y dibujar imagen redimensionada
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('No se pudo crear el contexto del canvas'));
        return;
      }
      
      ctx.drawImage(img, 0, 0, width, height);
      
      // Convertir a blob JPEG comprimido
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Error al comprimir la imagen'));
          }
        },
        'image/jpeg',
        quality
      );
    };
    
    img.onerror = () => {
      reject(new Error('Error al cargar la imagen para comprimir'));
    };
    
    img.src = uri;
  });
}

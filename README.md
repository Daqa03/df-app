# D&F Cosmetics — Sistema de Gestión Financiera e Inventario

Este es el repositorio oficial de **D&F Cosmetics**, una aplicación web progresiva y móvil desarrollada para la administración integral de inventario, punto de venta (POS), compras a proveedores, control de deudas (cuentas por cobrar y por pagar) y administración del flujo de caja de múltiples cuentas con soporte multi-moneda (COP, USD, VES).

El sistema está construido sobre **React Native (Expo Web)** en el frontend y **Supabase** como backend en la nube.

---

## 🚀 Tecnologías Principales

*   **Frontend**: React Native, React Native Web, Expo SDK 54, TypeScript, StyleSheet (diseño premium, responsivo y adaptado tanto para escritorio como para móviles).
*   **Base de Datos y Backend**: Supabase (PostgreSQL con triggers automáticos de saldo, Supabase Storage para fotos de productos y Supabase Auth para acceso seguro).
*   **Herramientas y Utilidades**: Canvas API (compresión de imágenes en el cliente) y la librería `sharp` para optimización masiva en servidores.

---

## 🎨 Características Destacadas

### 1. Autenticación y Seguridad (`LoginScreen`)
*   Protección de acceso mediante **Supabase Auth**.
*   Persistencia de sesión: el usuario permanece conectado hasta que decida cerrar sesión.
*   **Row Level Security (RLS)**: Todas las tablas de la base de datos están protegidas en Supabase; solo los usuarios autenticados pueden ver, insertar o modificar información.

### 2. Dashboard General (`DashboardScreen`)
*   Resumen financiero en tiempo real:
    *   Venta del día (COP).
    *   Compras del mes (COP).
    *   Cuentas por cobrar activas (Dinero en la calle).
    *   Cuentas por pagar activas (Deudas a proveedores).
    *   Patrimonio total consolidado.
*   Gráficos simplificados o resúmenes con los movimientos de caja más recientes.

### 3. Punto de Venta Inteligente (`PosScreen`)
*   **Buscador Inteligente**: Búsqueda en tiempo real tolerante a tildes, mayúsculas y minúsculas (ej. "rimel" o "RÍMEL" encuentran "Rímel Profesional").
*   **Feedback Visual Avanzado**:
    *   Notificación tipo *Toast* animado (desliza y se desvanece) al agregar un producto.
    *   Resaltado temporal con borde verde brillante de 800ms en la tarjeta del producto seleccionado.
*   **Carrito Flexible**: Permite elegir venta al detal o al mayor y aplicar el precio correspondiente al vuelo.
*   **Cierre de Venta**: Se puede cobrar al contado (eligiendo la cuenta receptora) o a crédito (creando una cuenta por cobrar/San de forma automática para el cliente).

### 4. Ingreso de Mercancía / Compras (`ComprasScreen`)
*   Buscador rápido e incorporación de productos existentes al inventario con actualización del costo de compra (costo promedio).
*   **Creación de Productos On-the-fly**: Posibilidad de registrar un producto nuevo que no exista en el catálogo desde el mismo modal de compras, incluyendo la captura o subida de foto.
*   **Método de Pago**: Las compras pueden financiarse al contado (generando egreso de la cuenta de caja seleccionada) o a crédito (creando una cuenta por pagar activa al proveedor).

### 5. Flujo de Caja y Multi-Moneda (`FlujoCajaScreen`)
*   **Consolidación de Patrimonio**: Muestra el dinero total acumulado convertido a pesos colombianos (COP), dólares (USD) y bolívares (VES) según las tasas del día.
*   **Múltiples Cuentas**: Tarjetas con los saldos independientes de cuentas de banco, efectivo, billeteras virtuales, etc.
*   **Transferencia entre Cuentas**:
    *   Permite mover fondos entre cualquier cuenta del sistema.
    *   Si las cuentas usan monedas diferentes (ej. transferir de USD a VES), el sistema calcula y muestra la **tasa de cambio resultante** en tiempo real.
    *   Registra un Egreso en la cuenta origen y un Ingreso en la cuenta destino con la descripción de la tasa.
*   **Préstamos Directos**:
    *   Permite prestar dinero a cualquier contacto del directorio directamente desde una cuenta.
    *   Registra el Egreso en la caja origen y **crea de forma automática una Cuenta por Cobrar (Crédito/San) activa** a nombre del cliente por el equivalente en COP.

### 6. Cuentas por Cobrar — Créditos y Sanes (`SanesScreen`)
*   Control estricto de dinero prestado y ventas a crédito.
*   Visualización de progreso: Barra de porcentaje de pago completado en cada deuda.
*   **Abonos Multi-moneda**: Permite registrar abonos en cualquier moneda (COP, USD, VES), calculando la equivalencia al vuelo y actualizando tanto el saldo de la deuda como la cuenta de caja receptora.

### 7. Cuentas por Pagar (`CuentasPorPagarScreen`)
*   Control de deudas pendientes con proveedores de mercancía.
*   Registro de abonos parciales o totales con actualización automática de egreso en el flujo de caja.

### 8. Catálogo e Inventario (`ListaProductosScreen`)
*   Lista interactiva con múltiples modos de visualización: **Lista**, **Cuadrícula (Grid)** y **Compacto**.
*   Filtros rápidos de ordenamiento (A-Z, Z-A, mayor/menor stock, SKU).
*   Edición rápida en línea (SKU, nombre, costo, precios de venta, stock y cambio de fotografía).

### 9. Optimización de Almacenamiento y Carga de Imágenes
*   **Compresión Client-side (`imageUtils.ts`)**: Antes de subir cualquier foto a Supabase Storage, la aplicación la carga en un Canvas HTML5 y la comprime a un ancho máximo de **800px** con una calidad JPEG de **70%**. Esto reduce fotos de 5 MB a solo ~100 KB de manera transparente para el usuario.
*   **Deduplicación de Variantes (Doble Imagen)**: Al guardar o editar productos, si ya existe un producto con el mismo nombre e imagen, la app reutiliza esa misma dirección de imagen en lugar de almacenar un archivo duplicado. Además, si actualizas la foto de un producto, todas sus variantes (ej. tonos del mismo labial) se actualizarán en cascada.
*   **Búsqueda Tolerante (`searchUtils.ts`)**: Normaliza cadenas con el formato Unicode NFD para facilitar búsquedas insensibles a diacríticos/acentos.
*   **Persistencia de Navegación**: Usa el `localStorage` en `App.tsx` para evitar que la aplicación regrese al Dashboard cuando el usuario recarga la página.

---

## 📂 Estructura del Proyecto

```
app_web_df/
├── App.tsx                          # Navegación principal, sidebar y persistencia de pantalla
├── app.json                         # Configuración general de Expo
├── index.ts                         # Punto de entrada de la aplicación
├── supabase.ts                      # Configuración de cliente Supabase (URL y Anon Key)
├── compress-existing-images.js      # Script de Node para comprimir imágenes históricas en Supabase
├── consolidate-and-cleanup-images.js# Script de Node para unificar fotos de variantes y borrar huérfanas
├── src/
│   ├── components/
│   │   └── Toast.tsx                # Alerta Toast animada de éxito
│   ├── utils/
│   │   ├── imageUtils.ts            # Utilidades de compresión y redimensionamiento en Canvas
│   │   └── searchUtils.ts           # Algoritmo de normalización de textos (búsqueda fuzzy)
│   └── screens/
│       ├── DashboardScreen.tsx      # Estadísticas y métricas financieras
│       ├── PosScreen.tsx            # Punto de venta (POS) y cobro a clientes
│       ├── ComprasScreen.tsx        # Entrada de stock y registro de costo de mercancía
│       ├── FlujoCajaScreen.tsx      # Balance patrimonial, transferencias y préstamos
│       ├── SanesScreen.tsx          # Gestión de cobros a clientes (créditos)
│       ├── CuentasPorPagarScreen.tsx# Gestión de pagos pendientes a proveedores
│       ├── ListaProductosScreen.tsx # Inventario detallado con edición en línea
│       ├── DirectorioScreen.tsx     # Directorio telefónico de clientes/proveedores
│       ├── LoginScreen.tsx          # Pantalla de acceso (Supabase Auth)
│       └── ConfiguracionScreen.tsx  # Configuración y tasas de cambio
```

---

## ⚙️ Instalación y Configuración Local

### Prerrequisitos
1.  Tener instalado **Node.js** (versión LTS recomendada).
2.  Tener instalado **Git**.

### Pasos
1.  Clona el repositorio en tu computadora:
    ```bash
    git clone https://github.com/Daqa03/df-app.git
    cd df-app
    ```
2.  Instala las dependencias necesarias:
    ```bash
    npm install
    ```
3.  Inicia el servidor de desarrollo local de Expo Web:
    ```bash
    npm run web
    ```
    Esto abrirá automáticamente la aplicación en tu navegador web local (usualmente en `http://localhost:8081`).

---

## 🛠️ Mantenimiento y Optimización del Servidor (Supabase)

Para evitar rebasar el límite de almacenamiento de **1 GB** del plan gratuito de Supabase, se desarrollaron dos scripts que se ejecutan desde la consola de tu computadora:

### 1. Consolidar Imágenes Repetidas y Borrar Huérfanas
Este script unifica las bases de datos para que todos los productos con el mismo nombre compartan el mismo enlace de imagen. Luego, escanea el Storage de Supabase y borra permanentemente todos los archivos redundantes (ahorrando cientos de MB).
Ejecución:
```bash
node consolidate-and-cleanup-images.js <tu-correo-de-login> <tu-contraseña>
```

### 2. Comprimir en Lote Imágenes Existentes
Si tienes imágenes pesadas antiguas subidas antes del sistema de compresión, este script las descarga una por una de Supabase, las redimensiona a máx 800px con 70% calidad (usando la librería `sharp`), y las vuelve a subir sobrescribiendo la original.
Ejecución:
```bash
# Asegúrate de instalar sharp
npm install sharp
# Ejecuta el script
node compress-existing-images.js <tu-correo-de-login> <tu-contraseña>
```

---

## 🌐 Despliegue en Producción
El proyecto está configurado para un despliegue continuo mediante **Vercel**:
*   Cada `git push` a la rama `main` en GitHub activa automáticamente una nueva compilación y despliegue en Vercel.
*   La aplicación es una PWA (Progressive Web App) y se compila para la plataforma web ejecutando `npx expo export --platform web`.

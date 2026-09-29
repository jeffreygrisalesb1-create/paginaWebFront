const CLAVES_IMAGENES = {
    vehiculos: 'inemVentas.vehicleImages.v1',
    productos: 'inemVentas.productImages.v1'
};
const listaInventario = document.getElementById('inventoryImageList');
const estadoGestorImagenes = document.getElementById('imageManagerStatus');
const campoBusqueda = document.getElementById('inventorySearch');
let inventarioActivo = 'vehiculos';
let inventarioPorTipo = { vehiculos: [], productos: [] };
let categoriasProductosGestor = [];
let imagenesPorTipo = {
    vehiculos: leerMapaImagenes(CLAVES_IMAGENES.vehiculos),
    productos: leerMapaImagenes(CLAVES_IMAGENES.productos)
};

campoBusqueda.addEventListener('input', filtrarInventario);
listaInventario.addEventListener('input', actualizarVistaPrevia);
listaInventario.addEventListener('change', guardarImagen);
document.querySelectorAll('[data-inventory-tab]').forEach(boton => {
    boton.addEventListener('click', () => cambiarInventario(boton.dataset.inventoryTab));
});
document.getElementById('exportImageMap').addEventListener('click', exportarMapaImagenes);
document.addEventListener('DOMContentLoaded', cargarInventario);

function leerMapaImagenes(clave) {
    try {
        const imagenes = JSON.parse(window.localStorage.getItem(clave) || '{}');
        return imagenes && typeof imagenes === 'object' && !Array.isArray(imagenes) ? imagenes : {};
    } catch {
        return {};
    }
}

function leerCampo(registro, ...nombres) {
    for (const nombre of nombres) {
        const clave = Object.keys(registro || {}).find(campo => campo.toLowerCase() === nombre.toLowerCase());
        if (clave !== undefined) return registro[clave];
    }
    return '';
}

function escaparHtml(valor) {
    return String(valor ?? '').replace(/[&<>\'"]/g, caracter => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
    }[caracter]));
}

function validarUrlImagen(valor) {
    try {
        const url = new URL(valor, window.location.href);
        return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch {
        return '';
    }
}

async function cargarInventario() {
    try {
        const [vehiculos, productos, categorias, imagenesCompartidas] = await Promise.all([
            solicitarAPI('vehiculos'),
            solicitarAPI('productos'),
            solicitarAPI('categoriaProductos'),
            cargarImagenesCompartidas()
        ]);
        if (!Array.isArray(vehiculos) || !Array.isArray(productos) || !Array.isArray(categorias)) {
            throw new Error('La API no devolvió todos los datos del inventario.');
        }
        imagenesPorTipo = {
            vehiculos: { ...imagenesCompartidas.vehiculos, ...imagenesPorTipo.vehiculos },
            productos: { ...imagenesCompartidas.productos, ...imagenesPorTipo.productos }
        };
        inventarioPorTipo = { vehiculos, productos };
        categoriasProductosGestor = categorias;
        renderizarInventario();
    } catch (error) {
        listaInventario.innerHTML = '<p class="image-manager-error">No se pudo cargar el inventario.</p>';
        estadoGestorImagenes.textContent = `${error.message} Comprueba que el backend esté activo en localhost:3000.`;
    }
}

function cambiarInventario(tipo) {
    if (!inventarioPorTipo[tipo]) return;
    inventarioActivo = tipo;
    document.querySelectorAll('[data-inventory-tab]').forEach(boton => {
        const activo = boton.dataset.inventoryTab === tipo;
        boton.classList.toggle('active', activo);
        boton.setAttribute('aria-pressed', String(activo));
    });
    campoBusqueda.placeholder = tipo === 'vehiculos' ? 'Nombre, marca o placa' : 'Nombre o categoría';
    campoBusqueda.value = '';
    renderizarInventario();
}

function renderizarInventario() {
    const registros = inventarioPorTipo[inventarioActivo];
    const esVehiculo = inventarioActivo === 'vehiculos';
    const claveId = esVehiculo ? 'Vehiculo_id' : 'Producto_id';
    const nombreTipo = esVehiculo ? 'vehículos' : 'productos';
    estadoGestorImagenes.textContent = `${registros.length} ${nombreTipo} cargados.`;

    if (!registros.length) {
        listaInventario.innerHTML = '<p class="image-manager-loading">No hay elementos en esta categoría.</p>';
        return;
    }

    listaInventario.innerHTML = registros.map(registro => {
        const id = Number(leerCampo(registro, claveId, 'id'));
        const nombre = leerCampo(registro, 'nombre') || 'Elemento sin nombre';
        const marca = esVehiculo ? leerCampo(registro, 'Marca', 'marca') : '';
        const modelo = esVehiculo ? leerCampo(registro, 'Modelo', 'modelo') : '';
        const placa = esVehiculo ? leerCampo(registro, 'Placa', 'placa') : '';
        const categoria = esVehiculo
            ? 'Vehículo'
            : leerCampo(categoriasProductosGestor.find(item => Number(leerCampo(item, 'CatPro_id')) === Number(leerCampo(registro, 'CatPro_id'))), 'nombre') || 'Categoría sin nombre';
        const textoDetalle = esVehiculo
            ? [marca, modelo, placa ? `Placa ${placa}` : ''].filter(Boolean).join(' · ')
            : categoria;
        const datosBusqueda = `${nombre} ${marca} ${modelo} ${placa} ${categoria}`.toLowerCase();
        const urlGuardada = imagenesPorTipo[inventarioActivo][String(id)] || '';
        const vistaPrevia = urlGuardada
            ? `<img src="${escaparHtml(urlGuardada)}" alt="${escaparHtml(nombre)}" data-preview-image>`
            : '<span class="image-preview-empty">Sin imagen</span>';
        const tipoId = esVehiculo ? 'vehicle' : 'product';

        return `
            <article class="image-inventory-row" data-search-text="${escaparHtml(datosBusqueda)}">
                <div class="image-inventory-preview">${vistaPrevia}</div>
                <div class="image-inventory-info">
                    <h2>${escaparHtml(nombre)}</h2>
                    <p>${escaparHtml(textoDetalle)}</p>
                    <label for="${tipoId}-image-${id}">Enlace de imagen</label>
                    <input id="${tipoId}-image-${id}" type="url" inputmode="url" placeholder="https://sitio.com/imagen.jpg" value="${escaparHtml(urlGuardada)}" data-inventory-image data-inventory-type="${inventarioActivo}" data-inventory-id="${id}">
                    <span class="image-save-state" data-save-state>${urlGuardada ? 'Guardada' : 'Sin imagen'}</span>
                </div>
            </article>
        `;
    }).join('');

    listaInventario.querySelectorAll('[data-preview-image]').forEach(imagen => {
        imagen.addEventListener('error', () => {
            imagen.replaceWith(Object.assign(document.createElement('span'), {
                className: 'image-preview-empty',
                textContent: 'No se pudo cargar'
            }));
        });
    });
}

function filtrarInventario() {
    const consulta = campoBusqueda.value.trim().toLowerCase();
    listaInventario.querySelectorAll('.image-inventory-row').forEach(fila => {
        fila.hidden = !fila.dataset.searchText.includes(consulta);
    });
}

function actualizarVistaPrevia(evento) {
    const entrada = evento.target.closest('[data-inventory-image]');
    if (!entrada) return;
    const fila = entrada.closest('.image-inventory-row');
    const estado = fila.querySelector('[data-save-state]');
    const url = validarUrlImagen(entrada.value.trim());
    if (entrada.value.trim() && !url) {
        estado.textContent = 'Enlace no válido';
        return;
    }

    mostrarVistaPrevia(fila, url);
    estado.textContent = entrada.value.trim() ? 'Pendiente de guardar' : 'Se quitará al salir del campo';
}

function mostrarVistaPrevia(fila, url) {
    const contenedor = fila.querySelector('.image-inventory-preview');
    if (!url) {
        contenedor.innerHTML = '<span class="image-preview-empty">Sin imagen</span>';
        return;
    }
    contenedor.innerHTML = `<img src="${escaparHtml(url)}" alt="Vista previa" data-preview-image>`;
    contenedor.querySelector('img').addEventListener('error', () => {
        contenedor.innerHTML = '<span class="image-preview-empty">No se pudo cargar</span>';
    });
}

function guardarImagen(evento) {
    const entrada = evento.target.closest('[data-inventory-image]');
    if (!entrada) return;
    const id = entrada.dataset.inventoryId;
    const tipo = entrada.dataset.inventoryType;
    const fila = entrada.closest('.image-inventory-row');
    const estado = fila.querySelector('[data-save-state]');
    const texto = entrada.value.trim();
    const url = validarUrlImagen(texto);

    if (texto && !url) {
        estado.textContent = 'Enlace no válido';
        return;
    }

    if (url) imagenesPorTipo[tipo][id] = url;
    else delete imagenesPorTipo[tipo][id];

    try {
        window.localStorage.setItem(CLAVES_IMAGENES[tipo], JSON.stringify(imagenesPorTipo[tipo]));
        estado.textContent = url ? 'Guardada' : 'Imagen quitada';
        const registros = inventarioPorTipo[tipo];
        const claveId = tipo === 'vehiculos' ? 'Vehiculo_id' : 'Producto_id';
        const registro = registros.find(item => String(leerCampo(item, claveId, 'id')) === id);
        estadoGestorImagenes.textContent = `Imagen ${url ? 'guardada' : 'quitada'} para ${leerCampo(registro, 'nombre') || 'el elemento'}.`;
    } catch {
        estado.textContent = 'No se pudo guardar';
        estadoGestorImagenes.textContent = 'El navegador no permite guardar imágenes en este origen.';
    }
}

function exportarMapaImagenes() {
    const archivo = new Blob([`${JSON.stringify(imagenesPorTipo, null, 2)}\n`], { type: 'application/json' });
    const enlace = document.createElement('a');
    enlace.href = URL.createObjectURL(archivo);
    enlace.download = 'imagenes.json';
    enlace.click();
    URL.revokeObjectURL(enlace.href);
    estadoGestorImagenes.textContent = 'Archivo exportado. Reemplaza data/imagenes.json y sube ese cambio al repositorio.';
}
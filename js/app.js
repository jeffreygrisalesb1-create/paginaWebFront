let baseDeDatos = [];
let categoriasVehiculos = [];
let categoriasProductos = [];
let comprasRegistradas = [];
let empleadosRegistrados = [];
let empleadosDisponibles = false;
let clientesRegistrados = [];
let paisesRegistrados = [];
let ciudadesRegistradas = [];
let transportadorasRegistradas = [];
let enviosRegistrados = [];
let empleadoActivo = null;
let detallesProductosCompra = [];
let detallesVehiculosCompra = [];
let chartInstancia = null;
let managerChartInstancia = null;
let managerTopVehiclesChartInstancia = null;
const CLAVE_IMAGENES_VEHICULOS = 'inemVentas.vehicleImages.v1';
const CLAVE_IMAGENES_PRODUCTOS = 'inemVentas.productImages.v1';
let imagenesVehiculos = {};
let imagenesProductos = {};
const diagnosticosSimulados = {
    19: { diagnostico: 'Falla grave simulada: fuga de líquido de frenos en el cilindro maestro, con pérdida de presión hidráulica.', recomendacion: 'No conducirlo. Revisar o reemplazar el cilindro maestro, purgar el circuito y comprobar los frenos antes de usarlo.' },
    23: { diagnostico: 'Falla grave simulada: tensor de la cadena de distribución defectuoso, con riesgo de daño interno del motor.', recomendacion: 'No encenderlo hasta inspeccionar la distribución y reparar el tensor; después, verificar el motor en un taller.' },
    48: { diagnostico: 'Falla grave simulada: pérdida de refrigerante que provoca sobrecalentamiento del motor.', recomendacion: 'Detener el vehículo y revisar mangueras, bomba de agua y termostato; no volver a conducirlo hasta corregir la fuga.' },
    49: { diagnostico: 'Falla grave simulada: avería del sistema ABS que puede impedir el funcionamiento correcto del antibloqueo de frenos.', recomendacion: 'Solicitar diagnóstico electrónico y reparación del ABS; evitar circular hasta comprobar el sistema de frenado.' }
};

/* ===========================
   SISTEMA DE TOAST NOTIFICATIONS
   =========================== */
function mostrarToast(mensaje, tipo = 'info') {
    const contenedor = document.getElementById('toastContainer');
    if (!contenedor) return;
    const iconos = { success: 'fa-circle-check', error: 'fa-circle-xmark', info: 'fa-circle-info' };
    const toast = document.createElement('div');
    toast.className = `toast toast-${tipo}`;
    toast.innerHTML = `<i class="fa-solid ${iconos[tipo] || iconos.info}"></i><span>${esc(mensaje)}</span>`;
    contenedor.appendChild(toast);
    setTimeout(() => toast.remove(), 4200);
}

/* ===========================
   MENÚ HAMBURGUESA
   =========================== */
function toggleMenu() {
    document.getElementById('navLinks').classList.toggle('open');
    document.getElementById('hamburgerBtn').classList.toggle('active');
}

function closeMenu() {
    document.getElementById('navLinks').classList.remove('open');
    document.getElementById('hamburgerBtn').classList.remove('active');
}

/* ===========================
   NAVBAR SCROLL EFFECT
   =========================== */
window.addEventListener('scroll', () => {
    document.getElementById('mainNavbar')?.classList.toggle('scrolled', window.scrollY > 50);
}, { passive: true });

/* ===========================
   ANIMACIONES AL SCROLL
   =========================== */
const observerReveal = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            observerReveal.unobserve(entry.target);
        }
    });
}, { threshold: 0.15 });

function inicializarAnimacionesScroll() {
    document.querySelectorAll('.reveal-on-scroll').forEach(el => observerReveal.observe(el));
}

/* ===========================
   CONTADORES ANIMADOS
   =========================== */
function animarContadores() {
    const contadores = document.querySelectorAll('.stat-counter strong[data-count]');
    const obs = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            const el = entry.target;
            const objetivo = parseInt(el.dataset.count, 10);
            const duracion = 2000;
            const inicio = performance.now();
            const animar = (ahora) => {
                const progreso = Math.min((ahora - inicio) / duracion, 1);
                const ease = 1 - Math.pow(1 - progreso, 3);
                el.textContent = `+${Math.floor(ease * objetivo).toLocaleString('es-CO')}`;
                if (progreso < 1) requestAnimationFrame(animar);
            };
            requestAnimationFrame(animar);
            obs.unobserve(el);
        });
    }, { threshold: 0.5 });
    contadores.forEach(el => obs.observe(el));
}

/* ===========================
   INICIALIZACIÓN
   =========================== */
document.addEventListener("DOMContentLoaded", async () => {
    const imagenesCompartidas = await cargarImagenesCompartidas();
    imagenesVehiculos = { ...imagenesCompartidas.vehiculos, ...leerMapaImagenes(CLAVE_IMAGENES_VEHICULOS) };
    imagenesProductos = { ...imagenesCompartidas.productos, ...leerMapaImagenes(CLAVE_IMAGENES_PRODUCTOS) };
    inicializarAnimacionesScroll();
    animarContadores();
    cargarDatosReales();
});

/* ===========================
   UTILIDADES
   =========================== */
function esc(text) {
    return String(text ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}

function leerCampo(registro, ...nombres) {
    for (const nombre of nombres) {
        const clave = Object.keys(registro || {}).find(campo => campo.toLowerCase() === nombre.toLowerCase());
        if (clave !== undefined) return registro[clave];
    }
    return null;
}

function leerMapaImagenes(clave) {
    try {
        const imagenes = JSON.parse(window.localStorage.getItem(clave) || '{}');
        return imagenes && typeof imagenes === 'object' && !Array.isArray(imagenes) ? imagenes : {};
    } catch { return {}; }
}

function agruparCategoriaProducto(nombre) {
    return /repuesto|parte/i.test(nombre || '') ? 'Repuestos' : 'Productos';
}

/* ===========================
   DIAGNÓSTICO VEHICULAR
   =========================== */
function clasificarCondicionVehiculo(nombre) {
    const condicion = String(nombre ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (/\bsin fallas?\b|\bninguna falla\b|\bpracticamente nuev[oa]\b|\bseminuev[oa]\b|\bnuev[oa]\b|\bfuncional\b|\boperativ[oa]\b|\bexcelente\b|\bbuen estado\b/.test(condicion)) return 'verde';
    if (/\bno\s+(?:tan\s+)?grave\b|\bfalla(?:s)?\s+(?:leve|menor)\b|\bsegunda\b|\bproblema\b|\bdetalle\b|\bregular\b|\bleve\b|\bmenor\b|\breparacion\b/.test(condicion)) return 'amarillo';
    if (/\bgrave\b|\bsever[oa]\b|\bcritic[oa]\b|\bno funciona\b|\binoperativ[oa]\b|\baveriad[oa]\b|\bdanad[oa]\b|\bdefectuos[oa]\b|\bfalla(?:s)?\b/.test(condicion)) return 'rojo';
    return 'amarillo';
}

function resumirCondicionVehiculo(item) {
    const nivel = clasificarCondicionVehiculo(String(item.diagnostico || '').trim() || item.categoryName);
    const categoria = String(item.categoryName || 'Condición no informada');
    let diagnostico = String(item.diagnostico || '').trim();
    if (!diagnostico) {
        const categoriaNormalizada = categoria.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        if (nivel === 'verde') diagnostico = `Clasificado como ${categoria}; no hay fallas específicas registradas.`;
        else if (/\bsegunda\b/.test(categoriaNormalizada)) diagnostico = 'La categoría indica que es un vehículo de segunda; no hay una falla concreta registrada en la base de datos.';
        else if (nivel === 'rojo') diagnostico = `Falla grave reportada: ${categoria}.`;
        else if (/\bproblema\b|\bfalla\b|\bdetalle\b|\bregular\b|\bleve\b|\bmenor\b/.test(categoriaNormalizada)) diagnostico = `La ficha indica «${categoria}», pero no contiene más detalles de la falla.`;
        else diagnostico = 'La base de datos no especifica una falla concreta para este vehículo.';
    }
    const recomendacion = String(item.recomendacion || '').trim() || (nivel === 'rojo'
        ? 'No conducirlo hasta que un técnico revise y repare la falla reportada.'
        : nivel === 'amarillo'
            ? 'Solicitar una inspección mecánica y aclarar cualquier detalle antes de comprarlo.'
            : 'Mantener las revisiones preventivas y verificar el historial de mantenimiento.');
    return { nivel, etiqueta: nivel === 'rojo' ? 'Falla grave' : nivel === 'amarillo' ? 'Revisión recomendada' : 'En buen estado', diagnostico, recomendacion, simulado: item.diagnosticoSimulado === true };
}

/* ===========================
   MAPEADORES DE DATOS
   =========================== */
function mapearVehiculo(registro) {
    const vehiculoId = Number(leerCampo(registro, 'Vehiculo_id', 'id'));
    const categoriaId = leerCampo(registro, 'Categoria_id');
    const categoria = categoriasVehiculos.find(item => Number(leerCampo(item, 'Categoria_id')) === Number(categoriaId));
    const diagnosticoRegistro = leerCampo(registro, 'Falla', 'Diagnostico', 'Diagnóstico', 'Descripcion_falla', 'Descripción_falla', 'Problema', 'Observaciones');
    const recomendacionRegistro = leerCampo(registro, 'Recomendacion', 'Recomendación', 'Accion_recomendada', 'Acción_recomendada');
    const diagnosticoDemo = diagnosticosSimulados[vehiculoId];
    const cantidad = leerCampo(registro, 'Cantidad', 'cantidad');
    const stock = cantidad === null || cantidad === '' ? null : Number(cantidad);
    return {
        id: `vehiculo-${vehiculoId}`, dbId: vehiculoId,
        name: leerCampo(registro, 'nombre') || 'Sin nombre',
        brand: leerCampo(registro, 'Marca', 'marca') || '',
        model: leerCampo(registro, 'Modelo', 'modelo') || '',
        plate: leerCampo(registro, 'Placa', 'placa') || '',
        color: leerCampo(registro, 'Color', 'color') || '',
        category: 'Vehículos',
        categoryName: leerCampo(categoria, 'nombre') || 'Condición no informada',
        status: leerCampo(categoria, 'nombre') || 'Consultar',
        diagnostico: diagnosticoRegistro || diagnosticoDemo?.diagnostico || '',
        recomendacion: recomendacionRegistro || diagnosticoDemo?.recomendacion || '',
        diagnosticoSimulado: !diagnosticoRegistro && Boolean(diagnosticoDemo),
        price: Number(leerCampo(registro, 'precio')) || 0,
        stock: stock !== null && Number.isFinite(stock) ? stock : null,
        image: imagenesVehiculos[String(vehiculoId)] || ''
    };
}

function mapearProducto(registro) {
    const productoId = Number(leerCampo(registro, 'Producto_id', 'id'));
    const categoriaId = leerCampo(registro, 'CatPro_id');
    const categoria = categoriasProductos.find(item => Number(leerCampo(item, 'CatPro_id')) === Number(categoriaId));
    const categoryName = leerCampo(categoria, 'nombre') || 'Tipo no informado';
    return {
        id: `producto-${productoId}`, dbId: productoId,
        name: leerCampo(registro, 'nombre') || 'Sin nombre',
        brand: '', model: '',
        category: agruparCategoriaProducto(categoryName), categoryName,
        status: categoryName,
        price: Number(leerCampo(registro, 'precio')) || 0,
        stock: null,
        image: imagenesProductos[String(productoId)] || ''
    };
}

/* ===========================
   CARGA DE DATOS DESDE API
   =========================== */
async function cargarDatosReales() {
    const estado = document.getElementById('catalogStatus');
    const skeleton = document.getElementById('skeletonGrid');
    estado.textContent = 'Conectando con el inventario...';
    if (skeleton) skeleton.style.display = '';
    try {
        const [vehiculos, productos, categoriasV, categoriasP] = await Promise.all([
            solicitarAPI('vehiculos'), solicitarAPI('productos'),
            solicitarAPI('categorias'), solicitarAPI('categoriaProductos')
        ]);
        categoriasVehiculos = Array.isArray(categoriasV) ? categoriasV : [];
        categoriasProductos = Array.isArray(categoriasP) ? categoriasP : [];
        baseDeDatos = [
            ...(Array.isArray(vehiculos) ? vehiculos.map(mapearVehiculo) : []),
            ...(Array.isArray(productos) ? productos.map(mapearProducto) : [])
        ];
        const [respuestaCompras, respuestaEmpleados, respuestaDetallesProductos, respuestaDetallesVehiculos, respuestaClientes, respuestaPaises, respuestaCiudades, respuestaTransportadoras, respuestaEnvios] = await Promise.all([
            solicitarAPI('compras').catch(e => { console.error('No fue posible cargar las compras:', e); return []; }),
            solicitarAPI('empleados').catch(e => { console.error('No fue posible cargar los empleados:', e); return null; }),
            solicitarAPI('cp').catch(e => { console.error('No fue posible cargar los detalles de productos:', e); return []; }),
            solicitarAPI('cv').catch(e => { console.error('No fue posible cargar los detalles de vehículos:', e); return []; }),
            solicitarAPI('clientes').catch(e => { console.error('No fue posible cargar los clientes:', e); return []; }),
            solicitarAPI('paises').catch(e => { console.error('No fue posible cargar los países:', e); return []; }),
            solicitarAPI('ciudades').catch(e => { console.error('No fue posible cargar las ciudades:', e); return []; }),
            solicitarAPI('transportadoras').catch(e => { console.error('No fue posible cargar las transportadoras:', e); return []; }),
            solicitarAPI('envios').catch(e => { console.error('No fue posible cargar los envíos:', e); return []; })
        ]);
        comprasRegistradas = Array.isArray(respuestaCompras) ? respuestaCompras : [];
        empleadosDisponibles = Array.isArray(respuestaEmpleados);
        empleadosRegistrados = empleadosDisponibles ? respuestaEmpleados : [];
        detallesProductosCompra = Array.isArray(respuestaDetallesProductos) ? respuestaDetallesProductos : [];
        detallesVehiculosCompra = Array.isArray(respuestaDetallesVehiculos) ? respuestaDetallesVehiculos : [];
        clientesRegistrados = Array.isArray(respuestaClientes) ? respuestaClientes : [];
        paisesRegistrados = Array.isArray(respuestaPaises) ? respuestaPaises : [];
        ciudadesRegistradas = Array.isArray(respuestaCiudades) ? respuestaCiudades : [];
        transportadorasRegistradas = Array.isArray(respuestaTransportadoras) ? respuestaTransportadoras : [];
        enviosRegistrados = Array.isArray(respuestaEnvios) ? respuestaEnvios : [];
        if (skeleton) skeleton.style.display = 'none';
        renderizarCatalogo(baseDeDatos);
        actualizarSelectMarcas();
        actualizarFiltroCategorias();
        actualizarFormularioCategoria();
        renderizarTablaInventario();
        actualizarKpis();
        actualizarGrafico();
        actualizarPanelGerente();
        renderizarComprasPendientes();
        estado.textContent = `Inventario sincronizado: ${baseDeDatos.length} registros.`;
    } catch (error) {
        console.error('No fue posible cargar el inventario desde la API:', error);
        baseDeDatos = [];
        if (skeleton) skeleton.style.display = 'none';
        renderizarCatalogo([]);
        estado.textContent = `No se pudo conectar con el backend (${error.message}). Comprueba que esté activo en localhost:3000.`;
    }
}

/* ===========================
   NAVEGACIÓN ENTRE VISTAS Y CATÁLOGO
   =========================== */
function abrirInventario(seccionDestino = 'catalogo') {
    const contenedor = document.getElementById('contenidoCatalogo');
    const footer = document.getElementById('siteFooter');

    if (contenedor) {
        contenedor.classList.remove('is-hidden');
    }
    if (footer) {
        footer.style.display = '';
    }

    inicializarAnimacionesScroll();
    animarContadores();

    const navLinks = document.querySelectorAll('.nav-links a');
    navLinks.forEach(link => link.classList.remove('active'));
    const targetLink = document.querySelector(`.nav-links a[href="#${seccionDestino}"]`);
    if (targetLink) targetLink.classList.add('active');

    const elemento = document.getElementById(seccionDestino) || document.getElementById('catalogo');
    if (elemento) {
        setTimeout(() => {
            elemento.scrollIntoView({ behavior: 'smooth' });
        }, 50);
    }
}

function irAInicio() {
    showSection('cliente');
    closeMenu();
    const navLinks = document.querySelectorAll('.nav-links a');
    navLinks.forEach(link => link.classList.remove('active'));
    const inicioLink = document.querySelector('.nav-links a[href="#inicio"]');
    if (inicioLink) inicioLink.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showSection(contexto) {
    const clientView = document.getElementById('clientView');
    const workerView = document.getElementById('adminView');
    const managerView = document.getElementById('managerView');
    const footer = document.getElementById('siteFooter');

    clientView.style.display = 'none';
    workerView.classList.remove('active');
    managerView.classList.remove('active');
    if (footer) footer.style.display = 'none';

    if (contexto === 'trabajador') {
        workerView.classList.add('active');
        inicializarGrafico();
        renderizarTablaInventario();
        actualizarKpis();
        renderizarComprasPendientes();
    } else if (contexto === 'gerente') {
        actualizarPanelGerente();
        managerView.classList.add('active');
    } else {
        clientView.style.display = 'block';
        const contenedor = document.getElementById('contenidoCatalogo');
        if (footer && (!contenedor || !contenedor.classList.contains('is-hidden'))) {
            footer.style.display = '';
        }
    }
}

/* ===========================
   PANEL GERENCIA
   =========================== */
function actualizarPanelGerente() {
    const capital = baseDeDatos.reduce((total, item) => total + (item.category === 'Vehículos' ? Number(item.price || 0) * Number(item.stock || 0) : 0), 0);
    const vehiculos = baseDeDatos.reduce((total, item) => total + (item.category === 'Vehículos' ? Number(item.stock || 0) : 0), 0);

    document.getElementById('managerCapital').innerText = `$${capital.toLocaleString('en-US')}`;
    document.getElementById('managerVehicles').innerText = `${vehiculos} Unidades`;
    document.getElementById('managerParts').innerText = `${baseDeDatos.filter(item => item.category !== 'Vehículos').length} Referencias`;

    const tbody = document.getElementById('managerEmployeesBody');
    const salesNote = document.getElementById('managerSalesNote');
    if (!empleadosDisponibles) {
        tbody.innerHTML = '<tr><td colspan="6">No fue posible cargar los empleados desde la API.</td></tr>';
        salesNote.textContent = 'No se pudo calcular el resumen porque no está disponible el endpoint de empleados.';
    } else if (empleadosRegistrados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6">No hay empleados registrados.</td></tr>';
        salesNote.textContent = 'No hay empleados para asociar con las compras.';
    } else {
        const resumenPorEmpleado = new Map(empleadosRegistrados.map(emp => [String(leerCampo(emp, 'Empleado_id')), { compras: 0, articulos: 0, ingresoEstimado: 0 }]));
        const empleadoPorCompra = new Map();
        comprasRegistradas.forEach(compra => {
            const empleadoId = leerCampo(compra, 'Empleado_id');
            if (empleadoId === null || empleadoId === '') return;
            const empleadoKey = String(empleadoId);
            const compraId = String(leerCampo(compra, 'Compra_id'));
            const resumen = resumenPorEmpleado.get(empleadoKey);
            if (!resumen) return;
            resumen.compras += 1;
            empleadoPorCompra.set(compraId, empleadoKey);
        });

        const productoPorId = new Map(baseDeDatos.filter(item => item.category !== 'Vehículos').map(item => [String(item.dbId), item]));
        const vehiculoPorId = new Map(baseDeDatos.filter(item => item.category === 'Vehículos').map(item => [String(item.dbId), item]));
        let lineasContabilizadas = 0;
        const agregarDetalle = (detalles, campoIdArticulo, articulosPorId) => {
            detalles.forEach(detalle => {
                const empleadoKey = empleadoPorCompra.get(String(leerCampo(detalle, 'Compra_id')));
                const resumen = resumenPorEmpleado.get(empleadoKey);
                const articulo = articulosPorId.get(String(leerCampo(detalle, campoIdArticulo)));
                if (!resumen || !articulo) return;
                resumen.articulos += 1;
                resumen.ingresoEstimado += Number(articulo.price) || 0;
                lineasContabilizadas += 1;
            });
        };
        agregarDetalle(detallesProductosCompra, 'Producto_id', productoPorId);
        agregarDetalle(detallesVehiculosCompra, 'Vehiculo_id', vehiculoPorId);
        const totalLineas = detallesProductosCompra.length + detallesVehiculosCompra.length;
        salesNote.textContent = `${lineasContabilizadas} líneas asociadas contabilizadas; ${totalLineas - lineasContabilizadas} detalles sin compra o empleado válido excluidos. El ingreso suma precios actuales, no el precio histórico de venta.`;

        const empleadosOrdenados = [...empleadosRegistrados].sort((a, b) => {
            const rA = resumenPorEmpleado.get(String(leerCampo(a, 'Empleado_id')));
            const rB = resumenPorEmpleado.get(String(leerCampo(b, 'Empleado_id')));
            return rB.ingresoEstimado - rA.ingresoEstimado || String(leerCampo(a, 'nombre') || '').localeCompare(String(leerCampo(b, 'nombre') || ''), 'es');
        });

        tbody.innerHTML = empleadosOrdenados.map((emp, i) => {
            const empId = leerCampo(emp, 'Empleado_id');
            const r = resumenPorEmpleado.get(String(empId));
            return `<tr>
                <td class="manager-rank">${i + 1}</td>
                <td>${esc(empId)}</td>
                <td>${esc(leerCampo(emp, 'nombre') || 'Nombre no disponible')}</td>
                <td>${r.compras}</td><td>${r.articulos}</td>
                <td class="manager-income">$${r.ingresoEstimado.toLocaleString('es-CO')}</td>
            </tr>`;
        }).join('');
    }
    inicializarGraficoGerente();
    inicializarGraficoVehiculosMasVendidos();
}

function inicializarGraficoGerente() {
    const canvas = document.getElementById('managerInventoryChart');
    if (!canvas) return;
    const valores = {
        'Vehículos': baseDeDatos.filter(item => item.category === 'Vehículos').length,
        'Productos': baseDeDatos.filter(item => item.category === 'Productos').length,
        'Repuestos': baseDeDatos.filter(item => item.category === 'Repuestos').length
    };
    if (managerChartInstancia) managerChartInstancia.destroy();
    managerChartInstancia = new Chart(canvas.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: Object.keys(valores),
            datasets: [{ data: Object.values(valores), backgroundColor: ['#1769ff', '#00d9ff', '#4a3dff'], borderColor: '#fffaf2', borderWidth: 2, hoverOffset: 5 }]
        },
        options: {
            responsive: true, maintainAspectRatio: false, cutout: '58%',
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw} referencias` } } }
        }
    });
}

function inicializarGraficoVehiculosMasVendidos() {
    const canvas = document.getElementById('managerTopVehiclesChart');
    const note = document.getElementById('managerTopVehiclesNote');
    if (!canvas || !note) return;

    const comprasConfirmadas = new Set(comprasRegistradas
        .filter(c => { const eid = leerCampo(c, 'Empleado_id'); return eid !== null && eid !== '' && Number(eid) !== 0; })
        .map(c => String(leerCampo(c, 'Compra_id'))));
    const unidadesPorVehiculo = new Map();
    detallesVehiculosCompra.forEach(d => {
        if (!comprasConfirmadas.has(String(leerCampo(d, 'Compra_id')))) return;
        const vid = String(leerCampo(d, 'Vehiculo_id'));
        unidadesPorVehiculo.set(vid, (unidadesPorVehiculo.get(vid) || 0) + Math.max(1, Number(leerCampo(d, 'Cantidad')) || 1));
    });

    const vehiculosPorId = new Map(baseDeDatos.filter(item => item.category === 'Vehículos').map(item => [String(item.dbId), item]));
    const ranking = [...unidadesPorVehiculo.entries()]
        .map(([id, u]) => ({ vehiculo: vehiculosPorId.get(id), unidades: u }))
        .filter(v => v.vehiculo)
        .sort((a, b) => b.unidades - a.unidades || a.vehiculo.name.localeCompare(b.vehiculo.name, 'es'))
        .slice(0, 5);

    if (managerTopVehiclesChartInstancia) managerTopVehiclesChartInstancia.destroy();
    if (!ranking.length) { note.textContent = 'Aún no hay ventas de vehículos confirmadas.'; return; }

    note.textContent = `Top ${ranking.length} según unidades vendidas.`;
    managerTopVehiclesChartInstancia = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels: ranking.map(v => v.vehiculo.name),
            datasets: [{ label: 'Unidades vendidas', data: ranking.map(v => v.unidades), backgroundColor: ['#ff3151', '#00d9a6', '#f2c14e', '#55a7ff', '#ff8b42'], borderRadius: 3, maxBarThickness: 30 }]
        },
        options: {
            indexAxis: 'y', responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${ctx.raw} unidades` } } },
            scales: {
                x: { beginAtZero: true, ticks: { color: '#9acbdc', precision: 0 }, grid: { color: 'rgba(0,217,255,.12)' } },
                y: { ticks: { color: '#e8faff' }, grid: { display: false } }
            }
        }
    });
}

/* ===========================
   RENDERIZADO DEL CATÁLOGO
   =========================== */
function renderizarCatalogo(items) {
    const grid = document.getElementById('catalogGrid');
    grid.innerHTML = '';
    if (items.length === 0) {
        grid.innerHTML = `<p style="grid-column:1/-1;text-align:center;color:var(--text-muted);padding:3rem;">No hay registros que coincidan con los filtros.</p>`;
        return;
    }
    items.forEach(item => {
        const badgeClass = item.stock === null ? 'badge-consultar' : item.stock > 0 ? 'badge-disponible' : 'badge-agotado';
        const resumen = item.category === 'Vehículos' ? resumirCondicionVehiculo(item) : null;
        const dotHtml = resumen?.nivel
            ? `<span class="vehicle-condition-dot ${resumen.nivel}" title="${esc(resumen.simulado ? 'Diagnóstico simulado: ' + resumen.diagnostico : 'Condición: ' + resumen.diagnostico)}"></span>` : '';
        const etiquetaStock = item.stock === null ? 'Existencias no informadas' : `${item.stock} unidades`;
        const imagen = item.image
            ? `<img src="${esc(item.image)}" alt="${esc(item.name)}" loading="lazy">`
            : `<div style="height:100%;display:grid;place-content:center;gap:.6rem;text-align:center;color:var(--text-muted);"><i class="fa-solid ${item.category === 'Vehículos' ? 'fa-car-side' : 'fa-box-open'}" style="font-size:2rem;"></i><span>Imagen no registrada</span></div>`;
        grid.innerHTML += `
            <div class="card">
                <div class="card-img-wrapper">
                    ${imagen}
                    <span class="badge-status ${badgeClass}">${esc(item.categoryName)}</span>
                </div>
                <div class="card-content">
                    <span class="card-category">${esc(item.category)}${dotHtml}</span>
                    <h3 class="card-title">${esc(item.name)}</h3>
                    <span class="card-brand">${item.brand ? `Marca: <strong>${esc(item.brand)}</strong> · ` : ''}${item.model ? `Modelo: <strong>${esc(item.model)}</strong> · ` : ''}${esc(etiquetaStock)}</span>
                    <div class="card-footer">
                        <span class="card-price">$${Number(item.price).toLocaleString('es-CO')}</span>
                        <div class="card-actions">
                            <button class="btn-detail" onclick="abrirDetalle('${esc(item.id)}')">Ver detalles</button>
                            <a class="btn-buy" href="compra.html?item=${encodeURIComponent(item.id)}" ${item.stock === 0 ? 'aria-disabled="true" tabindex="-1"' : ''}>COMPRAR</a>
                        </div>
                    </div>
                </div>
            </div>`;
    });
}

/* ===========================
   GESTIÓN AVANZADA DE PEDIDOS (CLIENTE Y TRABAJADOR)
   =========================== */
const CLAVE_ESTADOS_PEDIDOS = 'inemMotors.orderStatusMap';
const FLUJO_ESTADOS = ['Pendiente', 'Aprobado', 'Asignado a Transportadora', 'Entregado'];
let compraIdParaRechazar = null;

function leerMapaEstadosPedidos() {
    try {
        const guardados = JSON.parse(localStorage.getItem(CLAVE_ESTADOS_PEDIDOS) || '{}');
        return (guardados && typeof guardados === 'object') ? guardados : {};
    } catch {
        return {};
    }
}

function guardarEstadoPedido(compraId, data) {
    const mapa = leerMapaEstadosPedidos();
    mapa[String(compraId)] = { ...(mapa[String(compraId)] || {}), ...data, fechaActualizacion: new Date().toISOString() };
    localStorage.setItem(CLAVE_ESTADOS_PEDIDOS, JSON.stringify(mapa));
}

function obtenerEstadoPedido(compraId, compra, envio) {
    const mapa = leerMapaEstadosPedidos();
    const guardado = mapa[String(compraId)];
    if (guardado?.estado) return guardado;

    const desc = String(leerCampo(envio, 'Descripcion') || '').toLowerCase();
    const empleadoId = leerCampo(compra, 'Empleado_id');

    if (desc.includes('rechazad') || desc.includes('denegad') || desc.includes('cancelad')) {
        return { estado: 'Rechazado', motivoRechazo: leerCampo(envio, 'Descripcion') || 'Datos no verificados' };
    }
    if (desc.includes('entregad')) {
        return { estado: 'Entregado', motivoRechazo: '' };
    }
    if (desc.includes('en camino') || desc.includes('transport') || desc.includes('despachad')) {
        return { estado: 'Asignado a Transportadora', motivoRechazo: '' };
    }
    if (empleadoId !== null && empleadoId !== '' && Number(empleadoId) !== 0) {
        return { estado: 'Aprobado', motivoRechazo: '' };
    }
    return { estado: 'Pendiente', motivoRechazo: '' };
}

function avanzarPasoSiguiente(compraId) {
    if (!empleadoActivo) {
        mostrarToast('Debes iniciar sesión como trabajador para gestionar pedidos.', 'error');
        return;
    }
    const compra = comprasRegistradas.find(item => String(leerCampo(item, 'Compra_id')) === String(compraId));
    const envio = enviosRegistrados.find(item => String(leerCampo(item, 'Compra_id')) === String(compraId));
    const infoActual = obtenerEstadoPedido(compraId, compra, envio);
    const indexActual = FLUJO_ESTADOS.indexOf(infoActual.estado);

    if (infoActual.estado === 'Rechazado') {
        mostrarToast('Este pedido fue rechazado. Puedes cambiar su estado manualmente desde el selector.', 'info');
        return;
    }
    if (indexActual >= 0 && indexActual < FLUJO_ESTADOS.length - 1) {
        const siguiente = FLUJO_ESTADOS[indexActual + 1];
        cambiarEstadoManual(compraId, siguiente);
    } else if (indexActual === FLUJO_ESTADOS.length - 1) {
        mostrarToast(`El pedido #${compraId} ya está marcado como Entregado.`, 'info');
    }
}

async function cambiarEstadoManual(compraId, nuevoEstado) {
    if (!empleadoActivo) {
        mostrarToast('Debes iniciar sesión como trabajador para cambiar estados.', 'error');
        return;
    }
    const compra = comprasRegistradas.find(item => String(leerCampo(item, 'Compra_id')) === String(compraId));
    const envio = enviosRegistrados.find(item => String(leerCampo(item, 'Compra_id')) === String(compraId));
    const envioId = leerCampo(envio, 'Envio_id');
    const transporteId = Number(document.getElementById(`orderCarrier-${compraId}`)?.value || leerCampo(envio, 'Transporte_id') || 1);
    const descActual = document.getElementById(`orderDescription-${compraId}`)?.value.trim() || leerCampo(envio, 'Descripcion') || '';

    guardarEstadoPedido(compraId, {
        estado: nuevoEstado,
        trabajadorNombre: leerCampo(empleadoActivo, 'nombre') || 'Trabajador',
        trabajadorId: leerCampo(empleadoActivo, 'Empleado_id'),
        descripcionEnvio: descActual,
        transportadoraId: transporteId
    });

    try {
        if (envioId) {
            await solicitarAPI(`envios/${encodeURIComponent(envioId)}`, {
                method: 'PUT',
                body: JSON.stringify({
                    CiudadO_id: leerCampo(envio, 'CiudadO_id'),
                    CiudadD_id: leerCampo(envio, 'CiudadD_id'),
                    Transporte_id: transporteId,
                    FechaE: String(leerCampo(envio, 'FechaE') || '').slice(0, 10),
                    FechaL: leerCampo(envio, 'FechaL') ? String(leerCampo(envio, 'FechaL')).slice(0, 10) : null,
                    Direccion: leerCampo(envio, 'Direccion'),
                    Compra_id: compraId,
                    Descripcion: `${nuevoEstado}: ${descActual}`
                })
            }).catch(() => {});
        }
        if (nuevoEstado !== 'Pendiente' && nuevoEstado !== 'Rechazado') {
            await solicitarAPI(`compras/${encodeURIComponent(compraId)}`, {
                method: 'PUT',
                body: JSON.stringify({
                    fecha: String(leerCampo(compra, 'fecha') || '').slice(0, 10),
                    Cliente_id: leerCampo(compra, 'Cliente_id'),
                    Empleado_id: leerCampo(empleadoActivo, 'Empleado_id')
                })
            }).catch(() => {});
            comprasRegistradas = comprasRegistradas.map(item => String(leerCampo(item, 'Compra_id')) === String(compraId)
                ? { ...item, Empleado_id: leerCampo(empleadoActivo, 'Empleado_id') } : item);
        }
    } catch (e) {
        console.warn('Sincronización API parcial:', e);
    }

    renderizarComprasPendientes();
    actualizarPanelGerente();
    actualizarKpis();
    mostrarToast(`Pedido #${compraId} actualizado a '${nuevoEstado}'.`, 'success');
}

function abrirModalRechazo(compraId) {
    if (!empleadoActivo) {
        mostrarToast('Inicia sesión como trabajador para gestionar pedidos.', 'error');
        return;
    }
    compraIdParaRechazar = compraId;
    document.getElementById('rejectOrderId').value = compraId;
    const compra = comprasRegistradas.find(item => String(leerCampo(item, 'Compra_id')) === String(compraId));
    const cliente = clientesRegistrados.find(c => String(leerCampo(c, 'Cliente_id')) === String(leerCampo(compra, 'Cliente_id')));
    const sub = document.getElementById('rejectModalOrderSubtitle');
    if (sub) {
        sub.innerHTML = `Pedido <strong>#${esc(compraId)}</strong> de <strong>${esc(leerCampo(cliente, 'nombre') || 'Cliente')}</strong>.<br>Indica el motivo del rechazo para que el cliente lo vea en su panel.`;
    }
    document.getElementById('quickRejectReason').value = '';
    document.getElementById('rejectReasonDetails').value = '';
    document.getElementById('rejectOrderModal').classList.add('active');
}

function cerrarModalRechazo() {
    compraIdParaRechazar = null;
    document.getElementById('rejectOrderModal')?.classList.remove('active');
}

function seleccionarMotivoRapido(motivo) {
    if (motivo) {
        document.getElementById('rejectReasonDetails').value = motivo;
    }
}

async function confirmarRechazoPedido(e) {
    e.preventDefault();
    if (!compraIdParaRechazar) return;
    const compraId = compraIdParaRechazar;
    const motivo = document.getElementById('rejectReasonDetails').value.trim() || 'Datos no verificados';

    guardarEstadoPedido(compraId, {
        estado: 'Rechazado',
        motivoRechazo: motivo,
        trabajadorNombre: leerCampo(empleadoActivo, 'nombre') || 'Trabajador',
        trabajadorId: leerCampo(empleadoActivo, 'Empleado_id')
    });

    const envio = enviosRegistrados.find(item => String(leerCampo(item, 'Compra_id')) === String(compraId));
    const envioId = leerCampo(envio, 'Envio_id');

    if (envioId) {
        solicitarAPI(`envios/${encodeURIComponent(envioId)}`, {
            method: 'PUT',
            body: JSON.stringify({
                CiudadO_id: leerCampo(envio, 'CiudadO_id'),
                CiudadD_id: leerCampo(envio, 'CiudadD_id'),
                Transporte_id: Number(leerCampo(envio, 'Transporte_id')) || 1,
                FechaE: String(leerCampo(envio, 'FechaE') || '').slice(0, 10),
                FechaL: leerCampo(envio, 'FechaL') ? String(leerCampo(envio, 'FechaL')).slice(0, 10) : null,
                Direccion: leerCampo(envio, 'Direccion'),
                Compra_id: compraId,
                Descripcion: `Rechazado: ${motivo}`
            })
        }).catch(() => {});
    }

    cerrarModalRechazo();
    renderizarComprasPendientes();
    actualizarPanelGerente();
    actualizarKpis();
    mostrarToast(`Pedido #${compraId} marcado como Rechazado.`, 'info');
}

function renderizarComprasPendientes() {
    const tbody = document.getElementById('pendingPurchasesBody');
    if (!tbody) return;

    const filtro = document.getElementById('workerOrderFilter')?.value || 'todos';
    const itemsPorId = new Map(baseDeDatos.map(item => [String(item.dbId), item]));

    const listaCompleta = comprasRegistradas.map(compra => {
        const compraId = String(leerCampo(compra, 'Compra_id'));
        const envio = enviosRegistrados.find(item => String(leerCampo(item, 'Compra_id')) === compraId);
        const infoEstado = obtenerEstadoPedido(compraId, compra, envio);
        return { compra, envio, compraId, estado: infoEstado.estado, infoEstado };
    });

    const filtrados = listaCompleta.filter(entry => {
        if (filtro === 'todos') return true;
        return entry.estado === filtro;
    });

    if (!filtrados.length) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:2rem;color:var(--text-muted);">No hay pedidos en la categoría seleccionada (${esc(filtro)}).</td></tr>`;
        return;
    }

    tbody.innerHTML = filtrados.map(entry => {
        const { compra, envio, compraId, estado, infoEstado } = entry;
        const lineas = [
            ...detallesProductosCompra.filter(d => String(leerCampo(d, 'Compra_id')) === compraId).map(d => itemsPorId.get(String(leerCampo(d, 'Producto_id')))),
            ...detallesVehiculosCompra.filter(d => String(leerCampo(d, 'Compra_id')) === compraId).map(d => itemsPorId.get(String(leerCampo(d, 'Vehiculo_id'))))
        ].filter(Boolean);
        const cliente = clientesRegistrados.find(item => String(leerCampo(item, 'Cliente_id')) === String(leerCampo(compra, 'Cliente_id')));
        const transporteId = leerCampo(envio, 'Transporte_id');
        const total = lineas.reduce((sum, item) => sum + Number(item.price || 0), 0);
        const fecha = String(leerCampo(compra, 'fecha') || '').slice(0, 10);

        const badgeClass = {
            'Pendiente': 'badge-pending',
            'Aprobado': 'badge-approved',
            'Asignado a Transportadora': 'badge-carrier',
            'Entregado': 'badge-delivered',
            'Rechazado': 'badge-rejected'
        }[estado] || 'badge-pending';

        const esRechazado = estado === 'Rechazado';
        const motivo = infoEstado.motivoRechazo || infoEstado.motivo || '';

        const siguienteLabel = {
            'Pendiente': 'Aprobar',
            'Aprobado': 'Despachar',
            'Asignado a Transportadora': 'Entregar'
        }[estado];

        return `<tr>
            <td style="font-family:'Orbitron';font-weight:700;">#${esc(compraId)}</td>
            <td>
                <strong>${esc(leerCampo(cliente, 'nombre') || `Cliente #${leerCampo(compra, 'Cliente_id') || '—'}`)}</strong><br>
                <small style="color:var(--text-muted);"><i class="fa-solid fa-id-card"></i> ${esc(leerCampo(cliente, 'dni') || 'Sin DNI')} | <i class="fa-solid fa-phone"></i> ${esc(leerCampo(cliente, 'telefono') || '—')}</small>
            </td>
            <td>
                <strong>${lineas.length ? lineas.map(item => esc(item.name)).join(', ') : 'Detalle no disponible'}</strong>
            </td>
            <td>${esc(fecha || '—')}</td>
            <td>$${total.toLocaleString('es-CO')}</td>
            <td>
                <span class="order-status-badge ${badgeClass}">${esc(estado)}</span>
            </td>
            <td>
                ${esRechazado ? `
                    <span class="rejected-badge-text"><i class="fa-solid fa-ban"></i> Motivo: ${esc(motivo || 'Rechazado')}</span>
                ` : `
                    <select class="order-carrier-select" id="orderCarrier-${esc(compraId)}" ${empleadoActivo ? '' : 'disabled'}>
                        <option value="">Transportadora...</option>
                        ${transportadorasRegistradas.map(t => { const id = leerCampo(t, 'Transporte_id'); return `<option value="${esc(id)}" ${String(id) === String(transporteId) ? 'selected' : ''}>${esc(leerCampo(t, 'nombre'))}</option>`; }).join('')}
                    </select>
                    <input class="order-description-input" id="orderDescription-${esc(compraId)}" type="text" maxlength="255" value="${esc(leerCampo(envio, 'Descripcion') || '')}" placeholder="Guía / Nota de entrega" ${empleadoActivo ? '' : 'disabled'}>
                `}
            </td>
            <td>
                <div class="worker-order-actions">
                    <select class="order-state-manual-select" onchange="cambiarEstadoManual('${esc(compraId)}', this.value)" ${empleadoActivo ? '' : 'disabled'} title="Cambiar estado manual">
                        <option value="Pendiente" ${estado === 'Pendiente' ? 'selected' : ''}>🟡 Pendiente</option>
                        <option value="Aprobado" ${estado === 'Aprobado' ? 'selected' : ''}>🟢 Aprobado</option>
                        <option value="Asignado a Transportadora" ${estado === 'Asignado a Transportadora' ? 'selected' : ''}>🚚 Asignado a Transportadora</option>
                        <option value="Entregado" ${estado === 'Entregado' ? 'selected' : ''}>🏁 Entregado</option>
                        <option value="Rechazado" ${estado === 'Rechazado' ? 'selected' : ''}>🔴 Rechazado</option>
                    </select>
                    ${siguienteLabel ? `
                        <button class="btn-step-next" onclick="avanzarPasoSiguiente('${esc(compraId)}')" ${empleadoActivo ? '' : 'disabled'} title="Avanzar al siguiente paso: ${siguienteLabel}">
                            <i class="fa-solid fa-forward-step"></i> ${siguienteLabel}
                        </button>
                    ` : ''}
                    ${!esRechazado ? `
                        <button class="btn-order-reject" onclick="abrirModalRechazo('${esc(compraId)}')" ${empleadoActivo ? '' : 'disabled'} title="Rechazar este pedido">
                            <i class="fa-solid fa-xmark"></i> Rechazar
                        </button>
                    ` : ''}
                </div>
            </td>
        </tr>`;
    }).join('');
}

/* ===========================
   MIS PEDIDOS (VISTA CLIENTE)
   =========================== */
function abrirModalMisPedidos() {
    const modal = document.getElementById('ordersModal');
    if (!modal) return;
    modal.classList.add('active');

    const lastDni = localStorage.getItem('inemMotors.lastCustomerDni');
    const input = document.getElementById('orderSearchInput');
    if (input && lastDni && !input.value) {
        input.value = lastDni;
    }
    buscarMisPedidos();
}

function cerrarModalMisPedidos() {
    document.getElementById('ordersModal')?.classList.remove('active');
}

function buscarMisPedidos() {
    const query = document.getElementById('orderSearchInput')?.value.trim().toLowerCase() || '';
    const contenedor = document.getElementById('ordersResultsList');
    if (!contenedor) return;

    if (!comprasRegistradas.length) {
        contenedor.innerHTML = '<div class="empty-orders-state"><i class="fa-solid fa-box-archive"></i><p>No hay pedidos registrados en el sistema actualmente.</p></div>';
        return;
    }

    const itemsPorId = new Map(baseDeDatos.map(item => [String(item.dbId), item]));

    const filtrados = comprasRegistradas.filter(compra => {
        const compraId = String(leerCampo(compra, 'Compra_id') || '');
        const cliente = clientesRegistrados.find(c => String(leerCampo(c, 'Cliente_id')) === String(leerCampo(compra, 'Cliente_id')));
        const dni = String(leerCampo(cliente, 'dni') || '').toLowerCase();
        const correo = String(leerCampo(cliente, 'correo') || '').toLowerCase();
        const nombre = String(leerCampo(cliente, 'nombre') || '').toLowerCase();

        if (!query) return true;
        return compraId === query || compraId.includes(query) || dni.includes(query) || correo.includes(query) || nombre.includes(query);
    });

    if (!filtrados.length) {
        contenedor.innerHTML = `
            <div class="empty-orders-state">
                <i class="fa-solid fa-magnifying-glass"></i>
                <p>No se encontraron pedidos con el criterio <strong>"${esc(query)}"</strong>.</p>
                <small>Verifica tu DNI, correo o número de compra.</small>
            </div>
        `;
        return;
    }

    contenedor.innerHTML = filtrados.map(compra => {
        const compraId = String(leerCampo(compra, 'Compra_id'));
        const cliente = clientesRegistrados.find(c => String(leerCampo(c, 'Cliente_id')) === String(leerCampo(compra, 'Cliente_id')));
        const envio = enviosRegistrados.find(e => String(leerCampo(e, 'Compra_id')) === compraId);
        const transportadora = transportadorasRegistradas.find(t => String(leerCampo(t, 'Transporte_id')) === String(leerCampo(envio, 'Transporte_id')));
        const infoEstado = obtenerEstadoPedido(compraId, compra, envio);
        const estado = infoEstado.estado || 'Pendiente';

        const lineasVehiculos = detallesVehiculosCompra.filter(d => String(leerCampo(d, 'Compra_id')) === compraId).map(d => itemsPorId.get(String(leerCampo(d, 'Vehiculo_id')))).filter(Boolean);
        const lineasProductos = detallesProductosCompra.filter(d => String(leerCampo(d, 'Compra_id')) === compraId).map(d => itemsPorId.get(String(leerCampo(d, 'Producto_id')))).filter(Boolean);
        const todasLineas = [...lineasVehiculos, ...lineasProductos];
        const total = todasLineas.reduce((sum, item) => sum + Number(item.price || 0), 0);

        const estadoConfig = {
            'Pendiente': { badge: 'badge-pending', icon: 'fa-clock', label: '🟡 Pendiente de revisión', step: 1 },
            'Aprobado': { badge: 'badge-approved', icon: 'fa-circle-check', label: '🟢 Aprobado por el concesionario', step: 2 },
            'Asignado a Transportadora': { badge: 'badge-carrier', icon: 'fa-truck-fast', label: '🚚 Asignado a Transportadora (En camino)', step: 3 },
            'Entregado': { badge: 'badge-delivered', icon: 'fa-flag-checkered', label: '🏁 Entregado con éxito', step: 4 },
            'Rechazado': { badge: 'badge-rejected', icon: 'fa-ban', label: '🔴 Solicitud Rechazada', step: 0 }
        }[estado] || { badge: 'badge-pending', icon: 'fa-clock', label: estado, step: 1 };

        const esRechazado = estado === 'Rechazado';
        const motivo = infoEstado.motivoRechazo || infoEstado.motivo || leerCampo(envio, 'Descripcion') || 'Datos no verificados';

        return `
            <div class="client-order-card ${esRechazado ? 'is-rejected' : ''}">
                <div class="client-order-header">
                    <div>
                        <span class="client-order-id"><i class="fa-solid fa-receipt"></i> Pedido #${esc(compraId)}</span>
                        <span class="client-order-date"><i class="fa-regular fa-calendar"></i> ${esc(String(leerCampo(compra, 'fecha') || '').slice(0, 10))}</span>
                    </div>
                    <span class="order-status-badge ${estadoConfig.badge}">
                        <i class="fa-solid ${estadoConfig.icon}"></i> ${estadoConfig.label}
                    </span>
                </div>

                ${!esRechazado ? `
                <div class="order-timeline">
                    <div class="timeline-step ${estadoConfig.step >= 1 ? 'completed' : ''}">
                        <div class="timeline-dot"><i class="fa-solid fa-receipt"></i></div>
                        <span>Registrado</span>
                    </div>
                    <div class="timeline-line ${estadoConfig.step >= 2 ? 'completed' : ''}"></div>
                    <div class="timeline-step ${estadoConfig.step >= 2 ? 'completed' : ''}">
                        <div class="timeline-dot"><i class="fa-solid fa-check"></i></div>
                        <span>Aprobado</span>
                    </div>
                    <div class="timeline-line ${estadoConfig.step >= 3 ? 'completed' : ''}"></div>
                    <div class="timeline-step ${estadoConfig.step >= 3 ? 'completed' : ''}">
                        <div class="timeline-dot"><i class="fa-solid fa-truck-fast"></i></div>
                        <span>En Transporte</span>
                    </div>
                    <div class="timeline-line ${estadoConfig.step >= 4 ? 'completed' : ''}"></div>
                    <div class="timeline-step ${estadoConfig.step >= 4 ? 'completed' : ''}">
                        <div class="timeline-dot"><i class="fa-solid fa-box-open"></i></div>
                        <span>Entregado</span>
                    </div>
                </div>` : ''}

                ${esRechazado ? `
                <div class="order-rejection-alert">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                    <div>
                        <strong>Motivo del rechazo de la solicitud:</strong>
                        <p>${esc(motivo)}</p>
                    </div>
                </div>` : ''}

                <div class="client-order-body">
                    <div class="client-order-items">
                        <h4>Artículos / Vehículos adquiridos:</h4>
                        ${todasLineas.length ? todasLineas.map(item => `
                            <div class="client-order-item-row">
                                <i class="fa-solid ${item.category === 'Vehículos' ? 'fa-car-side' : 'fa-spray-can-sparkles'}"></i>
                                <span>${esc(item.name)} <small>(${esc(item.categoryName)})</small></span>
                                <strong>$${Number(item.price || 0).toLocaleString('es-CO')}</strong>
                            </div>
                        `).join('') : '<p class="text-muted">Detalles del artículo no disponibles.</p>'}
                    </div>

                    <div class="client-order-summary-box">
                        <div class="summary-line"><span>Destino:</span><strong>${esc(leerCampo(envio, 'Direccion') || 'No informado')}</strong></div>
                        <div class="summary-line"><span>Transportadora:</span><strong>${esc(leerCampo(transportadora, 'nombre') || 'Por confirmar')}</strong></div>
                        ${leerCampo(envio, 'Descripcion') && !esRechazado ? `<div class="summary-line note"><span>Nota de entrega:</span><em>"${esc(leerCampo(envio, 'Descripcion'))}"</em></div>` : ''}
                        <div class="summary-line total"><span>Total:</span><strong>$${total.toLocaleString('es-CO')}</strong></div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

window.addEventListener('hashchange', () => {
    if (window.location.hash === '#mis-pedidos') abrirModalMisPedidos();
});
if (window.location.hash === '#mis-pedidos') {
    setTimeout(abrirModalMisPedidos, 400);
}

/* ===========================
   MODAL DE DETALLES
   =========================== */
function abrirDetalle(id) {
    const item = baseDeDatos.find(x => x.id === id);
    if (!item) return;
    const resumen = item.category === 'Vehículos' ? resumirCondicionVehiculo(item) : null;
    const especificaciones = item.category === 'Vehículos'
        ? [['Categoría', item.categoryName], ['Marca', item.brand], ['Modelo', item.model], ['Placa', item.plate], ['Color', item.color], ['Cantidad', item.stock]]
        : [['Tipo', item.categoryName], ['Existencias', 'No informadas']];
    const imagenDetalle = item.image ? `<img src="${esc(item.image)}" alt="${esc(item.name)}" data-detail-image>` : '';
    document.getElementById('vehicleDetailBody').innerHTML = `
        <button class="vehicle-detail-close" onclick="cerrarDetalle()" aria-label="Cerrar"><i class="fa-solid fa-xmark"></i></button>
        <div class="vehicle-detail-grid">
            <div class="vehicle-detail-image">
                ${imagenDetalle}
                <div class="vehicle-detail-image-placeholder" ${item.image ? 'hidden' : ''}><i class="fa-solid ${item.category === 'Vehículos' ? 'fa-car-side' : 'fa-box-open'}" aria-hidden="true"></i><span>${item.image ? 'No se pudo cargar la imagen' : 'Imagen no registrada'}</span></div>
            </div>
            <div class="vehicle-detail-info">
                <span class="vehicle-detail-kicker">${esc(item.category)} · ${esc(item.categoryName)}</span>
                <h2>${esc(item.name)}</h2>
                <div class="vehicle-detail-price">$${Number(item.price).toLocaleString('es-CO')}</div>
                <div class="vehicle-specs">${especificaciones.map(([etiqueta, valor]) => `
                    <div class="vehicle-spec"><small>${esc(etiqueta)}</small><strong>${valor === null || valor === '' || valor === undefined ? 'No informado' : esc(valor)}</strong></div>
                `).join('')}</div>
                ${resumen ? `
                    <section class="diagnostic-box">
                        <div class="diagnostic-head">
                            <span class="diagnostic-light ${resumen.nivel}" aria-hidden="true"></span>
                            <div>
                                <div class="diagnostic-title">${esc(resumen.etiqueta)}</div>
                                <span class="diagnostic-status ${resumen.nivel}">${esc(item.categoryName)}</span>
                                ${resumen.simulado ? '<span class="diagnostic-demo-label">Diagnóstico simulado</span>' : ''}
                            </div>
                        </div>
                        <p class="diagnostic-line"><strong>Falla / condición:</strong> ${esc(resumen.diagnostico)}</p>
                        <p class="diagnostic-line"><strong>Recomendación:</strong> ${esc(resumen.recomendacion)}</p>
                    </section>` : ''}
            </div>
        </div>
        <div class="vehicle-detail-footer">
            <p class="vehicle-detail-note"><i class="fa-solid fa-circle-info"></i> Los datos mostrados corresponden a los campos guardados en la base de datos.</p>
        </div>`;
    const imagen = document.querySelector('#vehicleDetailBody [data-detail-image]');
    if (imagen) {
        imagen.addEventListener('error', () => {
            imagen.hidden = true;
            document.querySelector('#vehicleDetailBody .vehicle-detail-image-placeholder').hidden = false;
        }, { once: true });
    }
    document.getElementById('vehicleDetailModal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function cerrarDetalle() {
    document.getElementById('vehicleDetailModal').classList.remove('active');
    document.body.style.overflow = '';
}

window.addEventListener('storage', event => {
    if (event.key === CLAVE_IMAGENES_VEHICULOS) imagenesVehiculos = leerMapaImagenes(CLAVE_IMAGENES_VEHICULOS);
    else if (event.key === CLAVE_IMAGENES_PRODUCTOS) imagenesProductos = leerMapaImagenes(CLAVE_IMAGENES_PRODUCTOS);
    else return;
    baseDeDatos = baseDeDatos.map(item => item.category === 'Vehículos'
        ? { ...item, image: imagenesVehiculos[String(item.dbId)] || '' }
        : { ...item, image: imagenesProductos[String(item.dbId)] || '' });
    if (baseDeDatos.length) filtrarCatalogo();
});

document.getElementById('vehicleDetailModal').addEventListener('click', function (e) {
    if (e.target === this) cerrarDetalle();
});

/* ===========================
   FILTROS Y SELECTS
   =========================== */
function actualizarSelectMarcas() {
    const selectBrand = document.getElementById('filterBrand');
    const seleccion = selectBrand.value;
    const marcas = [...new Set(baseDeDatos.map(item => item.brand).filter(Boolean))];
    selectBrand.innerHTML = '<option value="todos">Todas las marcas</option>';
    marcas.forEach(marca => { selectBrand.innerHTML += `<option value="${esc(marca)}">${esc(marca)}</option>`; });
    if (marcas.includes(seleccion)) selectBrand.value = seleccion;
}

function actualizarFiltroCategorias() {
    const selectStatus = document.getElementById('filterStatus');
    const seleccion = selectStatus.value;
    const categorias = [...new Set(baseDeDatos.map(item => item.categoryName).filter(Boolean))];
    selectStatus.innerHTML = '<option value="todos">Todas</option>';
    categorias.forEach(cat => { selectStatus.innerHTML += `<option value="${esc(cat)}">${esc(cat)}</option>`; });
    if (categorias.includes(seleccion)) selectStatus.value = seleccion;
}

function actualizarFormularioCategoria() {
    const formCatEl = document.getElementById('formCategory');
    if (!formCatEl) return;
    // Populate the category select if empty
    if (formCatEl.options.length === 0) {
        formCatEl.innerHTML = '<option value="Vehículos">Vehículo</option><option value="Productos">Producto / accesorio</option><option value="Repuestos">Repuesto</option>';
    }
    const grupo = formCatEl.value;
    const esVehiculo = grupo === 'Vehículos';
    const select = document.getElementById('formDbCategory');
    const gruposVehiculo = ['formBrandGroup', 'formModelGroup', 'formPlateGroup', 'formColorGroup', 'formStockGroup'];
    gruposVehiculo.forEach(id => {
        const contenedor = document.getElementById(id);
        if (!contenedor) return;
        contenedor.hidden = !esVehiculo;
        const campo = contenedor.querySelector('input');
        if (campo) campo.required = esVehiculo;
    });
    const categorias = esVehiculo
        ? categoriasVehiculos.map(item => ({ id: leerCampo(item, 'Categoria_id'), nombre: leerCampo(item, 'nombre') }))
        : categoriasProductos
            .filter(item => agruparCategoriaProducto(leerCampo(item, 'nombre')) === grupo)
            .map(item => ({ id: leerCampo(item, 'CatPro_id'), nombre: leerCampo(item, 'nombre') }));
    select.innerHTML = categorias.length
        ? categorias.map(item => `<option value="${esc(item.id)}">${esc(item.nombre)}</option>`).join('')
        : '<option value="">No hay clasificaciones disponibles</option>';
}

function filtrarCatalogo() {
    const busqueda = document.getElementById('searchInput').value.toLowerCase();
    const categoria = document.getElementById('filterCategory').value;
    const marca = document.getElementById('filterBrand').value;
    const estado = document.getElementById('filterStatus').value;
    const precioMax = document.getElementById('filterPrice').value;
    const resultado = baseDeDatos.filter(item => {
        const texto = [item.name, item.brand, item.category, item.categoryName, item.model, item.plate].filter(Boolean).join(' ').toLowerCase();
        return texto.includes(busqueda)
            && (categoria === 'todos' || item.category === categoria)
            && (marca === 'todos' || item.brand === marca)
            && (estado === 'todos' || item.categoryName === estado)
            && (precioMax === 'todos' || Number(item.price) <= parseFloat(precioMax));
    });
    renderizarCatalogo(resultado);
}

/* ===========================
   BACKOFFICE — INVENTARIO
   =========================== */
function renderizarTablaInventario() {
    const tbody = document.getElementById('inventoryTableBody');
    if (!tbody) return;
    tbody.innerHTML = baseDeDatos.map(item => {
        const stockAlerta = item.stock === null
            ? '<span style="color:var(--text-muted)">No informado</span>'
            : item.stock <= 2
                ? `<span class="alert-stock"><i class="fa-solid fa-triangle-exclamation"></i> Bajo Stock</span>`
                : `<span style="color:var(--success)">Normal</span>`;
        return `<tr>
            <td style="font-family:'Orbitron';">#${esc(item.dbId)}</td>
            <td><strong>${esc(item.name)}</strong></td>
            <td>${esc(item.categoryName)}</td>
            <td>${esc(item.brand || 'No registrada')}</td>
            <td>$${Number(item.price).toLocaleString('es-CO')}</td>
            <td>${item.stock === null ? 'No informado' : `${Number(item.stock)} unidades`}</td>
            <td>${stockAlerta}</td>
        </tr>`;
    }).join('');
}

function actualizarKpis() {
    const ahora = new Date();
    const ventasDelMes = comprasRegistradas.filter(c => {
        const fecha = leerCampo(c, 'fecha');
        if (!fecha) return false;
        const f = new Date(fecha);
        return !Number.isNaN(f.getTime()) && f.getMonth() === ahora.getMonth() && f.getFullYear() === ahora.getFullYear();
    }).length;
    const comprasValidas = new Set(comprasRegistradas.map(c => String(leerCampo(c, 'Compra_id'))));
    const productosPorId = new Map(baseDeDatos.filter(item => item.category !== 'Vehículos').map(item => [String(item.dbId), item]));
    const vehiculosPorId = new Map(baseDeDatos.filter(item => item.category === 'Vehículos').map(item => [String(item.dbId), item]));
    const sumarDetalles = (detalles, campoId, articulosPorId) => detalles.reduce((total, d) => {
        const cid = leerCampo(d, 'Compra_id');
        if (cid === null || cid === '' || !comprasValidas.has(String(cid))) return total;
        const art = articulosPorId.get(String(leerCampo(d, campoId)));
        if (!art) return total;
        const importe = leerCampo(d, 'subtotal', 'total', 'importe', 'valor_total', 'precio_total');
        if (importe !== null && importe !== '' && Number.isFinite(Number(importe))) return total + Number(importe);
        const precio = leerCampo(d, 'precio_unitario', 'valor_unitario', 'precio');
        const cantidad = leerCampo(d, 'cantidad');
        const pu = precio === null || precio === '' ? Number(art.price) : Number(precio);
        const u = cantidad === null || cantidad === '' ? 1 : Number(cantidad);
        return total + (Number.isFinite(pu) && Number.isFinite(u) ? pu * u : 0);
    }, 0);
    const ingresos = sumarDetalles(detallesProductosCompra, 'Producto_id', productosPorId) + sumarDetalles(detallesVehiculosCompra, 'Vehiculo_id', vehiculosPorId);

    document.getElementById('kpiVentasCount').innerText = ventasDelMes;
    document.getElementById('kpiIngresos').innerText = `$${ingresos.toLocaleString('es-CO')}`;
    const semaforo = document.getElementById('semaforoIndicador');
    const texto = document.getElementById('semaforoTexto');
    semaforo.className = 'semaforo';
    semaforo.style.backgroundColor = 'var(--text-muted)';
    texto.innerText = 'Métricas no disponibles';
    texto.style.color = 'var(--text-muted)';
}

async function agregarNuevoItem(e) {
    e.preventDefault();
    const grupo = document.getElementById('formCategory').value;
    const clasificacion = Number(document.getElementById('formDbCategory').value);
    const nombre = document.getElementById('formName').value.trim();
    const precio = Number(document.getElementById('formPrice').value);
    const esVehiculo = grupo === 'Vehículos';
    const recurso = esVehiculo ? 'vehiculos' : 'productos';
    const registro = esVehiculo
        ? { nombre, Marca: document.getElementById('formBrand').value.trim(), Modelo: document.getElementById('formModel').value.trim(), Placa: document.getElementById('formPlate').value.trim(), Color: document.getElementById('formColor').value.trim(), Cantidad: Number(document.getElementById('formStock').value), Categoria_id: clasificacion, precio }
        : { nombre, precio, CatPro_id: clasificacion };
    try {
        await solicitarAPI(recurso, { method: 'POST', body: JSON.stringify(registro) });
        document.getElementById('newItemForm').reset();
        actualizarFormularioCategoria();
        await cargarDatosReales();
        mostrarToast(`Registro '${nombre}' creado exitosamente.`, 'success');
    } catch (error) {
        mostrarToast(`No fue posible guardar el registro: ${error.message}`, 'error');
    }
}

/* ===========================
   GRÁFICOS CHART.JS
   =========================== */
function inicializarGrafico() {
    const ctx = document.getElementById('salesChart')?.getContext('2d');
    if (!ctx) return;
    const valores = {
        'Vehículos': baseDeDatos.filter(item => item.category === 'Vehículos').length,
        'Productos': baseDeDatos.filter(item => item.category === 'Productos').length,
        'Repuestos': baseDeDatos.filter(item => item.category === 'Repuestos').length
    };
    if (chartInstancia) chartInstancia.destroy();
    chartInstancia = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(valores),
            datasets: [{ label: 'Registros en la base de datos', data: Object.values(valores), backgroundColor: ['rgba(23,105,255,0.78)', 'rgba(0,217,255,0.72)', 'rgba(74,61,255,0.72)'], borderColor: ['#1769ff', '#00d9ff', '#4a3dff'], borderWidth: 2, borderRadius: 4 }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { labels: { color: '#ffffff', font: { family: 'Inter' } } } },
            scales: {
                y: { ticks: { color: '#b8ab9a' }, grid: { color: 'rgba(80,60,40,0.12)' } },
                x: { ticks: { color: '#b8ab9a' }, grid: { display: false } }
            }
        }
    });
}

function actualizarGrafico() {
    if (!chartInstancia) return;
    const valores = {
        'Vehículos': baseDeDatos.filter(item => item.category === 'Vehículos').length,
        'Productos': baseDeDatos.filter(item => item.category === 'Productos').length,
        'Repuestos': baseDeDatos.filter(item => item.category === 'Repuestos').length
    };
    chartInstancia.data.datasets[0].data = Object.values(valores);
    chartInstancia.update();
}

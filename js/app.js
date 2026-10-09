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
    19: {
        diagnostico: 'Falla grave simulada: fuga de líquido de frenos en el cilindro maestro, con pérdida de presión hidráulica.',
        recomendacion: 'No conducirlo. Revisar o reemplazar el cilindro maestro, purgar el circuito y comprobar los frenos antes de usarlo.'
    },
    23: {
        diagnostico: 'Falla grave simulada: tensor de la cadena de distribución defectuoso, con riesgo de daño interno del motor.',
        recomendacion: 'No encenderlo hasta inspeccionar la distribución y reparar el tensor; después, verificar el motor en un taller.'
    },
    48: {
        diagnostico: 'Falla grave simulada: pérdida de refrigerante que provoca sobrecalentamiento del motor.',
        recomendacion: 'Detener el vehículo y revisar mangueras, bomba de agua y termostato; no volver a conducirlo hasta corregir la fuga.'
    },
    49: {
        diagnostico: 'Falla grave simulada: avería del sistema ABS que puede impedir el funcionamiento correcto del antibloqueo de frenos.',
        recomendacion: 'Solicitar diagnóstico electrónico y reparación del ABS; evitar circular hasta comprobar el sistema de frenado.'
    }
};

// Inicialización al cargar el DOM
document.addEventListener("DOMContentLoaded", async () => {
    const imagenesCompartidas = await cargarImagenesCompartidas();
    imagenesVehiculos = { ...imagenesCompartidas.vehiculos, ...leerMapaImagenes(CLAVE_IMAGENES_VEHICULOS) };
    imagenesProductos = { ...imagenesCompartidas.productos, ...leerMapaImagenes(CLAVE_IMAGENES_PRODUCTOS) };
    cargarDatosReales();
});

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
    } catch {
        return {};
    }
}

function agruparCategoriaProducto(nombre) {
    return /repuesto|parte/i.test(nombre || '') ? 'Repuestos' : 'Productos';
}

function clasificarCondicionVehiculo(nombre) {
    const condicion = String(nombre ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
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
        if (nivel === 'verde') {
            diagnostico = `Clasificado como ${categoria}; no hay fallas específicas registradas.`;
        } else if (/\bsegunda\b/.test(categoriaNormalizada)) {
            diagnostico = 'La categoría indica que es un vehículo de segunda; no hay una falla concreta registrada en la base de datos.';
        } else if (nivel === 'rojo') {
            diagnostico = `Falla grave reportada: ${categoria}.`;
        } else if (/\bproblema\b|\bfalla\b|\bdetalle\b|\bregular\b|\bleve\b|\bmenor\b/.test(categoriaNormalizada)) {
            diagnostico = `La ficha indica «${categoria}», pero no contiene más detalles de la falla.`;
        } else {
            diagnostico = 'La base de datos no especifica una falla concreta para este vehículo.';
        }
    }

    const recomendacion = String(item.recomendacion || '').trim() || (nivel === 'rojo'
        ? 'No conducirlo hasta que un técnico revise y repare la falla reportada.'
        : nivel === 'amarillo'
            ? 'Solicitar una inspección mecánica y aclarar cualquier detalle antes de comprarlo.'
            : 'Mantener las revisiones preventivas y verificar el historial de mantenimiento.');

    return {
        nivel,
        etiqueta: nivel === 'rojo' ? 'Falla grave' : nivel === 'amarillo' ? 'Revisión recomendada' : 'En buen estado',
        diagnostico,
        recomendacion,
        simulado: item.diagnosticoSimulado === true
    };
}

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
        id: `vehiculo-${vehiculoId}`,
        dbId: vehiculoId,
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
        id: `producto-${productoId}`,
        dbId: productoId,
        name: leerCampo(registro, 'nombre') || 'Sin nombre',
        brand: '',
        model: '',
        category: agruparCategoriaProducto(categoryName),
        categoryName,
        status: categoryName,
        price: Number(leerCampo(registro, 'precio')) || 0,
        stock: null,
        image: imagenesProductos[String(productoId)] || ''
    };
}

async function cargarDatosReales() {
    const estado = document.getElementById('catalogStatus');
    estado.textContent = 'Conectando con el inventario...';
    try {
        const [vehiculos, productos, categoriasV, categoriasP] = await Promise.all([
            solicitarAPI('vehiculos'),
            solicitarAPI('productos'),
            solicitarAPI('categorias'),
            solicitarAPI('categoriaProductos')
        ]);
        categoriasVehiculos = Array.isArray(categoriasV) ? categoriasV : [];
        categoriasProductos = Array.isArray(categoriasP) ? categoriasP : [];
        baseDeDatos = [
            ...(Array.isArray(vehiculos) ? vehiculos.map(mapearVehiculo) : []),
            ...(Array.isArray(productos) ? productos.map(mapearProducto) : [])
        ];
        const [respuestaCompras, respuestaEmpleados, respuestaDetallesProductos, respuestaDetallesVehiculos, respuestaClientes, respuestaPaises, respuestaCiudades, respuestaTransportadoras, respuestaEnvios] = await Promise.all([
            solicitarAPI('compras').catch(error => { console.error('No fue posible cargar las compras:', error); return []; }),
            solicitarAPI('empleados').catch(error => { console.error('No fue posible cargar los empleados:', error); return null; }),
            solicitarAPI('cp').catch(error => { console.error('No fue posible cargar los detalles de productos:', error); return []; }),
            solicitarAPI('cv').catch(error => { console.error('No fue posible cargar los detalles de vehículos:', error); return []; }),
            solicitarAPI('clientes').catch(error => { console.error('No fue posible cargar los clientes:', error); return []; }),
            solicitarAPI('paises').catch(error => { console.error('No fue posible cargar los países:', error); return []; }),
            solicitarAPI('ciudades').catch(error => { console.error('No fue posible cargar las ciudades:', error); return []; }),
            solicitarAPI('transportadoras').catch(error => { console.error('No fue posible cargar las transportadoras:', error); return []; }),
            solicitarAPI('envios').catch(error => { console.error('No fue posible cargar los envíos:', error); return []; })
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
        renderizarCatalogo(baseDeDatos);
        actualizarSelectMarcas();
        actualizarFiltroCategorias();
        actualizarFormularioCategoria();
        renderizarTablaInventario();
        actualizarKpis();
        actualizarGrafico();
        actualizarPanelGerente();
        renderizarComprasPendientes();
        estado.textContent = `Inventario sincronizado con la base de datos: ${baseDeDatos.length} registros.`;
    } catch (error) {
        console.error('No fue posible cargar el inventario desde la API:', error);
        baseDeDatos = [];
        renderizarCatalogo([]);
        estado.textContent = `No se pudo conectar con el backend (${error.message}). Comprueba que esté activo en localhost:3000.`;
    }
}

// CONTROL DE NAVEGACIÓN ENTRE VISTAS
function showSection(contexto) {
    const clientView = document.getElementById('clientView');
    const workerView = document.getElementById('adminView');
    const managerView = document.getElementById('managerView');

    clientView.style.display = 'none';
    workerView.classList.remove('active');
    managerView.classList.remove('active');

    if (contexto === 'trabajador') {
        clientView.style.display = 'none';
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
    }
}

// PANEL DE GERENCIA GENERAL
function actualizarPanelGerente() {
    const capital = baseDeDatos.reduce((total, item) => {
        return total + (item.category === 'Vehículos' ? Number(item.price || 0) * Number(item.stock || 0) : 0);
    }, 0);
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
        const resumenPorEmpleado = new Map(empleadosRegistrados.map(empleado => [String(leerCampo(empleado, 'Empleado_id')), {
            compras: 0,
            articulos: 0,
            ingresoEstimado: 0
        }]));
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
            const resumenA = resumenPorEmpleado.get(String(leerCampo(a, 'Empleado_id')));
            const resumenB = resumenPorEmpleado.get(String(leerCampo(b, 'Empleado_id')));
            return resumenB.ingresoEstimado - resumenA.ingresoEstimado || String(leerCampo(a, 'nombre') || '').localeCompare(String(leerCampo(b, 'nombre') || ''), 'es');
        });

        tbody.innerHTML = empleadosOrdenados.map((empleado, index) => {
            const empleadoId = leerCampo(empleado, 'Empleado_id');
            const resumen = resumenPorEmpleado.get(String(empleadoId));
            return `
                <tr>
                    <td class="manager-rank">${index + 1}</td>
                    <td>${esc(empleadoId)}</td>
                    <td>${esc(leerCampo(empleado, 'nombre') || 'Nombre no disponible')}</td>
                    <td>${resumen.compras}</td>
                    <td>${resumen.articulos}</td>
                    <td class="manager-income">$${resumen.ingresoEstimado.toLocaleString('es-CO')}</td>
                </tr>
            `;
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
            datasets: [{
                data: Object.values(valores),
                backgroundColor: ['#1769ff', '#00d9ff', '#4a3dff'],
                borderColor: '#fffaf2',
                borderWidth: 2,
                hoverOffset: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '58%',
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw} referencias` } }
            }
        }
    });
}

function inicializarGraficoVehiculosMasVendidos() {
    const canvas = document.getElementById('managerTopVehiclesChart');
    const note = document.getElementById('managerTopVehiclesNote');
    if (!canvas || !note) return;

    const comprasConfirmadas = new Set(comprasRegistradas
        .filter(compra => {
            const empleadoId = leerCampo(compra, 'Empleado_id');
            return empleadoId !== null && empleadoId !== '' && Number(empleadoId) !== 0;
        })
        .map(compra => String(leerCampo(compra, 'Compra_id'))));
    const unidadesPorVehiculo = new Map();
    detallesVehiculosCompra.forEach(detalle => {
        if (!comprasConfirmadas.has(String(leerCampo(detalle, 'Compra_id')))) return;
        const vehiculoId = String(leerCampo(detalle, 'Vehiculo_id'));
        const cantidad = Math.max(1, Number(leerCampo(detalle, 'Cantidad')) || 1);
        unidadesPorVehiculo.set(vehiculoId, (unidadesPorVehiculo.get(vehiculoId) || 0) + cantidad);
    });

    const vehiculosPorId = new Map(baseDeDatos
        .filter(item => item.category === 'Vehículos')
        .map(item => [String(item.dbId), item]));
    const ranking = [...unidadesPorVehiculo.entries()]
        .map(([id, unidades]) => ({ vehiculo: vehiculosPorId.get(id), unidades }))
        .filter(venta => venta.vehiculo)
        .sort((a, b) => b.unidades - a.unidades || a.vehiculo.name.localeCompare(b.vehiculo.name, 'es'))
        .slice(0, 5);

    if (managerTopVehiclesChartInstancia) managerTopVehiclesChartInstancia.destroy();
    if (!ranking.length) {
        note.textContent = 'Aún no hay ventas de vehículos confirmadas.';
        return;
    }

    note.textContent = `Top ${ranking.length} según unidades vendidas.`;
    managerTopVehiclesChartInstancia = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels: ranking.map(venta => venta.vehiculo.name),
            datasets: [{
                label: 'Unidades vendidas',
                data: ranking.map(venta => venta.unidades),
                backgroundColor: ['#ff3151', '#00d9a6', '#f2c14e', '#55a7ff', '#ff8b42'],
                borderRadius: 3,
                maxBarThickness: 30
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: context => ` ${context.raw} unidades` } }
            },
            scales: {
                x: { beginAtZero: true, ticks: { color: '#9acbdc', precision: 0 }, grid: { color: 'rgba(0,217,255,.12)' } },
                y: { ticks: { color: '#e8faff' }, grid: { display: false } }
            }
        }
    });
}

// RENDERIZACIÓN DE COMPONENTES DEL CLIENTE
function renderizarCatalogo(items) {
    const grid = document.getElementById('catalogGrid');
    grid.innerHTML = '';
    if(items.length === 0) {
        grid.innerHTML = `<p style="grid-column:1/-1;text-align:center;color:var(--text-muted);padding:3rem;">No hay registros que coincidan con los filtros.</p>`;
        return;
    }
    items.forEach(item => {
        const badgeClass = item.stock === null ? 'badge-consultar' : item.stock > 0 ? 'badge-disponible' : 'badge-agotado';
        const resumenCondicion = item.category === 'Vehículos' ? resumirCondicionVehiculo(item) : null;
        const estadoCondicion = resumenCondicion?.nivel || '';
        const indicadorCondicion = estadoCondicion
            ? `<span class="vehicle-condition-dot ${estadoCondicion}" title="${esc(resumenCondicion.simulado ? 'Diagnóstico simulado: ' + resumenCondicion.diagnostico : 'Condición: ' + resumenCondicion.diagnostico)}" aria-label="${esc(resumenCondicion.simulado ? 'Diagnóstico simulado: ' + resumenCondicion.diagnostico : 'Condición del vehículo: ' + resumenCondicion.diagnostico)}"></span>`
            : '';
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
                    <span class="card-category">${esc(item.category)}${indicadorCondicion}</span>
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
            </div>
        `;
    });
}

function renderizarComprasPendientes() {
    const tbody = document.getElementById('pendingPurchasesBody');
    if (!tbody) return;
    const pendientes = comprasRegistradas.filter(compra => {
        const empleadoId = leerCampo(compra, 'Empleado_id');
        return empleadoId === null || empleadoId === '' || Number(empleadoId) === 0;
    });
    if (!pendientes.length) {
        tbody.innerHTML = '<tr><td colspan="8">No hay pedidos pendientes.</td></tr>';
        return;
    }

    const itemsPorId = new Map(baseDeDatos.map(item => [String(item.dbId), item]));
    tbody.innerHTML = pendientes.map(compra => {
        const compraId = leerCampo(compra, 'Compra_id');
        const lineas = [
            ...detallesProductosCompra.filter(detalle => String(leerCampo(detalle, 'Compra_id')) === String(compraId)).map(detalle => itemsPorId.get(String(leerCampo(detalle, 'Producto_id')))),
            ...detallesVehiculosCompra.filter(detalle => String(leerCampo(detalle, 'Compra_id')) === String(compraId)).map(detalle => itemsPorId.get(String(leerCampo(detalle, 'Vehiculo_id'))))
        ].filter(Boolean);
        const cliente = clientesRegistrados.find(item => String(leerCampo(item, 'Cliente_id')) === String(leerCampo(compra, 'Cliente_id')));
        const envio = enviosRegistrados.find(item => String(leerCampo(item, 'Compra_id')) === String(compraId));
        const ciudad = ciudadesRegistradas.find(item => String(leerCampo(item, 'Ciudad_id')) === String(leerCampo(envio, 'CiudadD_id')));
        const transporteId = leerCampo(envio, 'Transporte_id');
        const total = lineas.reduce((sum, item) => sum + Number(item.price || 0), 0);
        return `
            <tr>
                <td>#${esc(compraId)}</td>
                <td>${esc(leerCampo(cliente, 'nombre') || `Cliente #${leerCampo(compra, 'Cliente_id') || '—'}`)}</td>
                <td>${lineas.length ? lineas.map(item => esc(item.name)).join(', ') : 'Detalle no disponible'}</td>
                <td>$${total.toLocaleString('es-CO')}</td>
                <td>
                    <select class="order-carrier-select" id="orderCarrier-${esc(compraId)}" aria-label="Transportadora del pedido ${esc(compraId)}" ${empleadoActivo ? '' : 'disabled'}>
                        <option value="">Selecciona transportadora</option>
                        ${transportadorasRegistradas.map(transportadora => {
                            const id = leerCampo(transportadora, 'Transporte_id');
                            const selected = String(id) === String(transporteId) ? 'selected' : '';
                            return `<option value="${esc(id)}" ${selected}>${esc(leerCampo(transportadora, 'nombre'))}</option>`;
                        }).join('')}
                    </select>
                </td>
                <td><input class="order-description-input" id="orderDescription-${esc(compraId)}" type="text" maxlength="255" value="${esc(leerCampo(envio, 'Descripcion') || '')}" placeholder="Tu pedido llega en 15 días" aria-label="Descripción del pedido ${esc(compraId)}" ${empleadoActivo ? '' : 'disabled'}></td>
                <td>${esc(leerCampo(ciudad, 'nombre') || 'No informado')}</td>
                <td><button class="btn-confirm-order" onclick="confirmarCompra('${esc(compraId)}')" ${empleadoActivo ? '' : 'disabled'}>Confirmar</button></td>
            </tr>
        `;
    }).join('');
}

async function confirmarCompra(compraId) {
    if (!empleadoActivo) {
        alert('Inicia sesión como trabajador para confirmar un pedido.');
        return;
    }
    const compra = comprasRegistradas.find(item => String(leerCampo(item, 'Compra_id')) === String(compraId));
    if (!compra || leerCampo(compra, 'Empleado_id')) return;
    const envio = enviosRegistrados.find(item => String(leerCampo(item, 'Compra_id')) === String(compraId));
    const envioId = leerCampo(envio, 'Envio_id');
    const transporteId = Number(document.getElementById(`orderCarrier-${compraId}`)?.value);
    const descripcion = document.getElementById(`orderDescription-${compraId}`)?.value.trim();
    if (!envioId) {
        alert('El pedido no tiene un envío asociado. No se puede confirmar.');
        return;
    }
    if (!transporteId || !descripcion) {
        alert('Selecciona una transportadora y escribe una descripción breve para el cliente.');
        return;
    }
    try {
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
                Descripcion: descripcion
            })
        });
        enviosRegistrados = enviosRegistrados.map(item => String(leerCampo(item, 'Envio_id')) === String(envioId)
            ? { ...item, Transporte_id: transporteId, Descripcion: descripcion }
            : item);
        await solicitarAPI(`compras/${encodeURIComponent(compraId)}`, {
            method: 'PUT',
            body: JSON.stringify({
                fecha: String(leerCampo(compra, 'fecha') || '').slice(0, 10),
                Cliente_id: leerCampo(compra, 'Cliente_id'),
                Empleado_id: leerCampo(empleadoActivo, 'Empleado_id')
            })
        });
        comprasRegistradas = comprasRegistradas.map(item => String(leerCampo(item, 'Compra_id')) === String(compraId)
            ? { ...item, Empleado_id: leerCampo(empleadoActivo, 'Empleado_id') }
            : item);
        renderizarComprasPendientes();
        actualizarPanelGerente();
        actualizarKpis();
        alert(`Pedido #${compraId} confirmado.`);
    } catch (error) {
        alert(`No fue posible confirmar el pedido: ${error.message}`);
    }
}

function esc(text) {
    return String(text ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

function abrirDetalle(id) {
    const item = baseDeDatos.find(x => x.id === id);
    if (!item) return;
    const resumenCondicion = item.category === 'Vehículos' ? resumirCondicionVehiculo(item) : null;
    const especificaciones = item.category === 'Vehículos'
        ? [['Categoría', item.categoryName], ['Marca', item.brand], ['Modelo', item.model], ['Placa', item.plate], ['Color', item.color], ['Cantidad', item.stock]]
        : [['Tipo', item.categoryName], ['Existencias', 'No informadas']];
    const imagenDetalle = item.image
        ? `<img src="${esc(item.image)}" alt="${esc(item.name)}" data-detail-image>`
        : '';
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
                ${resumenCondicion ? `
                    <section class="diagnostic-box">
                        <div class="diagnostic-head">
                            <span class="diagnostic-light ${resumenCondicion.nivel}" aria-hidden="true"></span>
                            <div>
                                <div class="diagnostic-title">${esc(resumenCondicion.etiqueta)}</div>
                                <span class="diagnostic-status ${resumenCondicion.nivel}">${esc(item.categoryName)}</span>
                                ${resumenCondicion.simulado ? '<span class="diagnostic-demo-label">Diagnóstico simulado</span>' : ''}
                            </div>
                        </div>
                        <p class="diagnostic-line"><strong>Falla / condición:</strong> ${esc(resumenCondicion.diagnostico)}</p>
                        <p class="diagnostic-line"><strong>Recomendación:</strong> ${esc(resumenCondicion.recomendacion)}</p>
                    </section>
                ` : ''}
            </div>
        </div>
        <div class="vehicle-detail-footer">
            <p class="vehicle-detail-note"><i class="fa-solid fa-circle-info"></i> Los datos mostrados corresponden a los campos guardados en la base de datos.</p>
        </div>
    `;
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

document.getElementById('vehicleDetailModal').addEventListener('click', function(e) {
    if (e.target === this) cerrarDetalle();
});

function actualizarSelectMarcas() {
    const selectBrand = document.getElementById('filterBrand');
    const seleccion = selectBrand.value;
    const marcas = [...new Set(baseDeDatos.map(item => item.brand).filter(Boolean))];
    
    selectBrand.innerHTML = '<option value="todos">Todas las marcas</option>';
    marcas.forEach(marca => {
        selectBrand.innerHTML += `<option value="${esc(marca)}">${esc(marca)}</option>`;
    });
    if (marcas.includes(seleccion)) selectBrand.value = seleccion;
}

function actualizarFiltroCategorias() {
    const selectStatus = document.getElementById('filterStatus');
    const seleccion = selectStatus.value;
    const categorias = [...new Set(baseDeDatos.map(item => item.categoryName).filter(Boolean))];
    selectStatus.innerHTML = '<option value="todos">Todas</option>';
    categorias.forEach(categoria => {
        selectStatus.innerHTML += `<option value="${esc(categoria)}">${esc(categoria)}</option>`;
    });
    if (categorias.includes(seleccion)) selectStatus.value = seleccion;
}

function actualizarFormularioCategoria() {
    const grupo = document.getElementById('formCategory').value;
    const esVehiculo = grupo === 'Vehículos';
    const select = document.getElementById('formDbCategory');
    const gruposVehiculo = ['formBrandGroup', 'formModelGroup', 'formPlateGroup', 'formColorGroup', 'formStockGroup'];
    gruposVehiculo.forEach(id => {
        const contenedor = document.getElementById(id);
        contenedor.hidden = !esVehiculo;
        const campo = contenedor.querySelector('input');
        campo.required = esVehiculo;
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

// MOTOR DE BÚSQUEDA Y FILTRADO AVANZADO
function filtrarCatalogo() {
    const busqueda = document.getElementById('searchInput').value.toLowerCase();
    const categoria = document.getElementById('filterCategory').value;
    const marca = document.getElementById('filterBrand').value;
    const estado = document.getElementById('filterStatus').value;
    const precioMax = document.getElementById('filterPrice').value;

    const resultado = baseDeDatos.filter(item => {
        const textoBusqueda = [item.name, item.brand, item.category, item.categoryName, item.model, item.plate].filter(Boolean).join(' ').toLowerCase();
        const cumpleBusqueda = textoBusqueda.includes(busqueda);
        const cumpleCategoria = (categoria === 'todos' || item.category === categoria);
        const cumpleMarca = (marca === 'todos' || item.brand === marca);
        const cumpleEstado = (estado === 'todos' || item.categoryName === estado);
        const cumplePrecio = (precioMax === 'todos' || Number(item.price) <= parseFloat(precioMax));

        return cumpleBusqueda && cumpleCategoria && cumpleMarca && cumpleEstado && cumplePrecio;
    });

    renderizarCatalogo(resultado);
}

// LÓGICA DE ADMINISTRACIÓN (BACKOFFICE)
function renderizarTablaInventario() {
    const tbody = document.getElementById('inventoryTableBody');
    tbody.innerHTML = '';

    baseDeDatos.forEach(item => {
        const stockAlerta = item.stock === null
            ? '<span style="color:var(--text-muted)">No informado</span>'
            : item.stock <= 2
                ? `<span class="alert-stock"><i class="fa-solid fa-triangle-exclamation"></i> Bajo Stock</span>`
                : `<span style="color:var(--success)">Normal</span>`;
        tbody.innerHTML += `
            <tr>
                <td style="font-family:'Orbitron';">#${esc(item.dbId)}</td>
                <td><strong>${esc(item.name)}</strong></td>
                <td>${esc(item.categoryName)}</td>
                <td>${esc(item.brand || 'No registrada')}</td>
                <td>$${Number(item.price).toLocaleString('es-CO')}</td>
                <td>${item.stock === null ? 'No informado' : `${Number(item.stock)} unidades`}</td>
                <td>${stockAlerta}</td>
            </tr>
        `;
    });
}

function actualizarKpis() {
    const ahora = new Date();
    const ventasDelMes = comprasRegistradas.filter(compra => {
        const fecha = leerCampo(compra, 'fecha');
        if (!fecha) return false;
        const fechaCompra = new Date(fecha);
        return !Number.isNaN(fechaCompra.getTime()) && fechaCompra.getMonth() === ahora.getMonth() && fechaCompra.getFullYear() === ahora.getFullYear();
    }).length;
    const comprasValidas = new Set(comprasRegistradas.map(compra => String(leerCampo(compra, 'Compra_id'))));
    const productosPorId = new Map(baseDeDatos.filter(item => item.category !== 'Vehículos').map(item => [String(item.dbId), item]));
    const vehiculosPorId = new Map(baseDeDatos.filter(item => item.category === 'Vehículos').map(item => [String(item.dbId), item]));
    const sumarDetalles = (detalles, campoIdArticulo, articulosPorId) => detalles.reduce((total, detalle) => {
        const compraId = leerCampo(detalle, 'Compra_id');
        if (compraId === null || compraId === '' || !comprasValidas.has(String(compraId))) return total;
        const articulo = articulosPorId.get(String(leerCampo(detalle, campoIdArticulo)));
        if (!articulo) return total;

        const importe = leerCampo(detalle, 'subtotal', 'total', 'importe', 'valor_total', 'precio_total');
        if (importe !== null && importe !== '' && Number.isFinite(Number(importe))) return total + Number(importe);

        const precio = leerCampo(detalle, 'precio_unitario', 'valor_unitario', 'precio');
        const cantidad = leerCampo(detalle, 'cantidad');
        const precioUnitario = precio === null || precio === '' ? Number(articulo.price) : Number(precio);
        const unidades = cantidad === null || cantidad === '' ? 1 : Number(cantidad);
        return total + (Number.isFinite(precioUnitario) && Number.isFinite(unidades) ? precioUnitario * unidades : 0);
    }, 0);
    const ingresosTotales = sumarDetalles(detallesProductosCompra, 'Producto_id', productosPorId)
        + sumarDetalles(detallesVehiculosCompra, 'Vehiculo_id', vehiculosPorId);

    document.getElementById('kpiVentasCount').innerText = ventasDelMes;
    document.getElementById('kpiIngresos').innerText = `$${ingresosTotales.toLocaleString('es-CO')}`;

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
        ? {
            nombre,
            Marca: document.getElementById('formBrand').value.trim(),
            Modelo: document.getElementById('formModel').value.trim(),
            Placa: document.getElementById('formPlate').value.trim(),
            Color: document.getElementById('formColor').value.trim(),
            Cantidad: Number(document.getElementById('formStock').value),
            Categoria_id: clasificacion,
            precio
        }
        : { nombre, precio, CatPro_id: clasificacion };

    try {
        await solicitarAPI(recurso, { method: 'POST', body: JSON.stringify(registro) });
        document.getElementById('newItemForm').reset();
        actualizarFormularioCategoria();
        await cargarDatosReales();
        alert(`Registro '${nombre}' creado en la base de datos.`);
    } catch (error) {
        alert(`No fue posible guardar el registro: ${error.message}`);
    }
}

// GENERACIÓN DE REPORTES GRÁFICOS (CHART.JS)
function inicializarGrafico() {
    const ctx = document.getElementById('salesChart').getContext('2d');
    
    const categoriasValores = {
        'Vehículos': baseDeDatos.filter(item => item.category === 'Vehículos').length,
        'Productos': baseDeDatos.filter(item => item.category === 'Productos').length,
        'Repuestos': baseDeDatos.filter(item => item.category === 'Repuestos').length
    };

    if (chartInstancia) {
        chartInstancia.destroy();
    }

    chartInstancia = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(categoriasValores),
            datasets: [{
                label: 'Registros en la base de datos',
                data: Object.values(categoriasValores),
                        backgroundColor: ['rgba(23,105,255,0.78)', 'rgba(0,217,255,0.72)', 'rgba(74,61,255,0.72)'],
                        borderColor: ['#1769ff', '#00d9ff', '#4a3dff'],
                borderWidth: 2,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: '#ffffff', font: { family: 'Inter' } } }
            },
            scales: {
                y: { ticks: { color: '#b8ab9a' }, grid: { color: 'rgba(80,60,40,0.12)' } },
                x: { ticks: { color: '#b8ab9a' }, grid: { display: false } }
            }
        }
    });
}

function actualizarGrafico() {
    if(chartInstancia) {
        const categoriasValores = {
            'Vehículos': baseDeDatos.filter(item => item.category === 'Vehículos').length,
            'Productos': baseDeDatos.filter(item => item.category === 'Productos').length,
            'Repuestos': baseDeDatos.filter(item => item.category === 'Repuestos').length
        };
        chartInstancia.data.datasets[0].data = Object.values(categoriasValores);
        chartInstancia.update();
    }
}

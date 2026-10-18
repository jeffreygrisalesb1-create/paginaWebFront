const state = {
    items: [],
    selectedProductIds: [],
    countries: [],
    cities: [],
    customers: [],
    carriers: [],
    customerId: null
};

const money = value => `$${Number(value || 0).toLocaleString('es-CO')}`;
const fieldValue = (record, name) => {
    const key = Object.keys(record || {}).find(candidate => candidate.toLowerCase() === name.toLowerCase());
    return key ? record[key] : null;
};
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('checkoutForm').addEventListener('submit', finalizarCompra);
    document.getElementById('cancelCheckout').addEventListener('click', () => {
        window.location.href = 'Pagina.inemVentas.html#catalogo';
    });
    document.getElementById('vehicleCategory').addEventListener('change', () => llenarArticulos('vehicle'));
    document.getElementById('productCategory').addEventListener('change', () => llenarArticulos('product'));
    document.getElementById('vehicleSelect').addEventListener('change', renderizarResumen);
    document.getElementById('productChoices').addEventListener('change', actualizarProductosSeleccionados);
    document.getElementById('countrySelect').addEventListener('change', llenarCiudades);
    cargarFormulario();
});

async function cargarFormulario() {
    setStatus('Cargando inventario y destinos...');
    try {
        const [vehicles, products, categories, productCategories, countries, cities, customers, carriers] = await Promise.all([
            solicitarAPI('vehiculos'), solicitarAPI('productos'), solicitarAPI('categorias'),
            solicitarAPI('categoriaProductos'), solicitarAPI('paises'), solicitarAPI('ciudades'),
            solicitarAPI('clientes'), solicitarAPI('transportadoras')
        ]);
        const vehicleCategories = Array.isArray(categories) ? categories : [];
        const productCategoryRows = Array.isArray(productCategories) ? productCategories : [];
        state.items = [
            ...(Array.isArray(vehicles) ? vehicles.map(record => mapearArticulo(record, vehicleCategories, 'vehicle')) : []),
            ...(Array.isArray(products) ? products.map(record => mapearArticulo(record, productCategoryRows, 'product')) : [])
        ];
        state.countries = Array.isArray(countries) ? countries : [];
        state.cities = Array.isArray(cities) ? cities : [];
        state.customers = Array.isArray(customers) ? customers : [];
        state.carriers = Array.isArray(carriers) ? carriers : [];
        state.selectedProductIds = [];
        llenarSelectorCategorias('vehicleCategory', state.items.filter(item => item.type === 'vehicle'));
        llenarSelectorCategorias('productCategory', state.items.filter(item => item.type === 'product'));
        llenarPaises();
        llenarCiudades();
        preseleccionarArticulo();
        renderizarResumen();
        document.getElementById('catalogMessage').textContent = state.items.length
            ? `${state.items.length} artículos disponibles en el inventario.`
            : 'No hay artículos disponibles en el inventario.';
        setStatus('');
    } catch (error) {
        setStatus(`No se pudo cargar la información: ${error.message}`, true);
        document.getElementById('catalogMessage').textContent = 'Comprueba que el servicio de inventario esté activo.';
    }
}

const CLAVE_STOCK_OVERRIDES = 'inemMotors.stockOverrides.v1';

function leerStockOverrides() {
    try {
        const guardados = JSON.parse(localStorage.getItem(CLAVE_STOCK_OVERRIDES) || '{}');
        return guardados && typeof guardados === 'object' ? guardados : {};
    } catch {
        return {};
    }
}

function obtenerStockReal(type, id, count) {
    const mapa = leerStockOverrides();
    const clave = `${type}-${id}`;
    if (mapa[clave] !== undefined) return Number(mapa[clave]);
    if (count !== null && count !== '' && Number.isFinite(Number(count))) return Number(count);
    if (type === 'product') {
        const stocksSemilla = [35, 42, 28, 50, 15, 30, 48, 22, 38, 12, 40, 25, 33, 45, 20];
        return stocksSemilla[Number(id) % stocksSemilla.length];
    }
    return 5;
}

function deducirStockLocal(item) {
    const mapa = leerStockOverrides();
    const clave = `${item.type}-${item.dbId}`;
    const stockActual = item.stock !== null && Number.isFinite(Number(item.stock)) ? Number(item.stock) : 5;
    const nuevoStock = Math.max(0, stockActual - 1);
    mapa[clave] = nuevoStock;
    localStorage.setItem(CLAVE_STOCK_OVERRIDES, JSON.stringify(mapa));
}

function mapearArticulo(record, categories, type) {
    const id = Number(fieldValue(record, type === 'vehicle' ? 'Vehiculo_id' : 'Producto_id') ?? fieldValue(record, 'id'));
    const categoryId = fieldValue(record, type === 'vehicle' ? 'Categoria_id' : 'CatPro_id');
    const category = categories.find(item => Number(fieldValue(item, type === 'vehicle' ? 'Categoria_id' : 'CatPro_id')) === Number(categoryId));
    const categoryName = fieldValue(category, 'nombre') || 'Tipo no informado';
    const count = fieldValue(record, 'Cantidad', 'stock');
    const stockCalculado = obtenerStockReal(type, id, count);
    return {
        id: `${type === 'vehicle' ? 'vehiculo' : 'producto'}-${id}`,
        dbId: id,
        type,
        name: fieldValue(record, 'nombre') || 'Sin nombre',
        categoryName,
        price: Number(fieldValue(record, 'precio')) || 0,
        stock: stockCalculado
    };
}

function llenarSelectorCategorias(selectId, items) {
    const select = document.getElementById(selectId);
    const categories = [...new Set(items.map(item => item.categoryName))];
    select.innerHTML = '<option value="">Todas las categorías</option>' + categories
        .map(category => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join('');
    llenarArticulos(selectId === 'vehicleCategory' ? 'vehicle' : 'product');
}

function llenarArticulos(type) {
    const categoryId = type === 'vehicle' ? 'vehicleCategory' : 'productCategory';
    const category = document.getElementById(categoryId).value;
    const matching = state.items.filter(item => item.type === type && (!category || item.categoryName === category));
    if (type === 'vehicle') {
        const select = document.getElementById('vehicleSelect');
        select.innerHTML = `<option value="">No deseo un vehículo</option>` + matching.map(item => {
            const unavailable = item.stock === 0;
            const suffix = unavailable ? ' · Agotado' : ` · ${money(item.price)}`;
            return `<option value="${escapeHtml(item.id)}" ${unavailable ? 'disabled' : ''}>${escapeHtml(item.name + suffix)}</option>`;
        }).join('');
    } else {
        const choices = document.getElementById('productChoices');
        const selectedIds = new Set(state.selectedProductIds);
        choices.innerHTML = matching.length ? matching.map(item => {
            const unavailable = item.stock === 0;
            return `
                <label class="product-choice ${unavailable ? 'unavailable' : ''}">
                    <input type="checkbox" name="productIds" value="${escapeHtml(item.id)}" ${selectedIds.has(item.id) ? 'checked' : ''} ${unavailable ? 'disabled' : ''}>
                    <span class="product-choice-name">${escapeHtml(item.name)}<small>${escapeHtml(item.categoryName)}</small></span>
                    <strong>${unavailable ? 'Agotado' : money(item.price)}</strong>
                </label>
            `;
        }).join('') : '<p class="empty-products">No hay productos en esta categoría.</p>';
    }
    renderizarResumen();
}

function llenarPaises() {
    const select = document.getElementById('countrySelect');
    select.innerHTML = '<option value="">Selecciona un país</option>' + state.countries.map(country => {
        const id = fieldValue(country, 'Pais_id');
        return `<option value="${escapeHtml(id)}">${escapeHtml(fieldValue(country, 'nombre'))}</option>`;
    }).join('');
}

function llenarCiudades() {
    const countryId = document.getElementById('countrySelect').value;
    const select = document.getElementById('citySelect');
    const cities = state.cities.filter(city => String(fieldValue(city, 'Pais_id')) === String(countryId));
    select.innerHTML = countryId
        ? '<option value="">Selecciona una ciudad</option>' + cities.map(city => `<option value="${escapeHtml(fieldValue(city, 'Ciudad_id'))}">${escapeHtml(fieldValue(city, 'nombre'))}</option>`).join('')
        : '<option value="">Selecciona primero un país</option>';
    select.disabled = !countryId || !cities.length;
}

function preseleccionarArticulo() {
    const selectedId = new URLSearchParams(window.location.search).get('item');
    const item = state.items.find(entry => entry.id === selectedId);
    if (!item) return;
    const categorySelect = document.getElementById(item.type === 'vehicle' ? 'vehicleCategory' : 'productCategory');
    categorySelect.value = item.categoryName;
    llenarArticulos(item.type);
    if (item.type === 'vehicle') {
        document.getElementById('vehicleSelect').value = item.id;
    } else {
        if (!state.selectedProductIds.includes(item.id)) state.selectedProductIds.push(item.id);
        const checkbox = [...document.querySelectorAll('#productChoices input[name="productIds"]')].find(input => input.value === item.id);
        if (checkbox) checkbox.checked = true;
    }
    renderizarResumen();
}

function actualizarProductosSeleccionados() {
    const choices = document.getElementById('productChoices');
    const visibleIds = new Set([...choices.querySelectorAll('input[name="productIds"]')].map(input => input.value));
    const selectedVisibleIds = [...choices.querySelectorAll('input[name="productIds"]:checked')].map(input => input.value);
    const nextSelection = new Set(state.selectedProductIds.filter(id => !visibleIds.has(id)));
    selectedVisibleIds.forEach(id => nextSelection.add(id));
    state.selectedProductIds = [...nextSelection];
    renderizarResumen();
}

function renderizarResumen() {
    const selectedIds = [document.getElementById('vehicleSelect').value, ...state.selectedProductIds].filter(Boolean);
    const selected = selectedIds.map(id => state.items.find(item => item.id === id)).filter(Boolean);
    const lines = document.getElementById('orderLines');
    lines.innerHTML = selected.length ? selected.map(item => `
        <div class="order-line"><span>${escapeHtml(item.name)}<br><small>${escapeHtml(item.categoryName)}</small></span><strong>${money(item.price)}</strong></div>
    `).join('') : '<p class="empty-order">Selecciona artículos para ver el total.</p>';
    document.getElementById('orderTotal').textContent = money(selected.reduce((total, item) => total + item.price, 0));
}

async function finalizarCompra(event) {
    event.preventDefault();
    const selectedIds = [document.getElementById('vehicleSelect').value, ...state.selectedProductIds].filter(Boolean);
    const selectedItems = selectedIds.map(id => state.items.find(item => item.id === id)).filter(Boolean);
    const customer = {
        nombre: document.getElementById('customerName').value.trim(),
        correo: document.getElementById('customerEmail').value.trim(),
        dni: document.getElementById('customerDni').value.trim(),
        telefono: document.getElementById('customerPhone').value.trim()
    };
    const countryId = Number(document.getElementById('countrySelect').value);
    const cityId = Number(document.getElementById('citySelect').value);
    if (!selectedItems.length) return setStatus('Selecciona al menos un artículo.', true);
    if (Object.values(customer).some(value => !value) || !countryId || !cityId) return setStatus('Completa tus datos y selecciona el país y la ciudad de destino.', true);
    if (!state.carriers.length) return setStatus('No hay transportadoras registradas para asignar el envío.', true);

    const button = document.querySelector('.finish-button');
    button.disabled = true;
    setStatus('Registrando el pedido pendiente...');
    let purchaseId = null;
    let customerId = state.customerId;
    try {
        if (!customerId) {
            const existingCustomer = state.customers.find(record => normalizarDni(fieldValue(record, 'dni')) === normalizarDni(customer.dni));
            if (existingCustomer) {
                const sameDetails = normalizarTexto(fieldValue(existingCustomer, 'nombre')) === normalizarTexto(customer.nombre)
                    && normalizarTexto(fieldValue(existingCustomer, 'correo')) === normalizarTexto(customer.correo)
                    && normalizarTelefono(fieldValue(existingCustomer, 'telefono')) === normalizarTelefono(customer.telefono);
                if (!sameDetails) throw new Error('Ese DNI ya está registrado con otros datos. Verifica la información ingresada.');
                customerId = Number(fieldValue(existingCustomer, 'Cliente_id'));
            } else {
                const createdCustomer = await solicitarAPI('clientes', {
                    method: 'POST',
                    body: JSON.stringify(customer)
                });
                customerId = Number(createdCustomer.id);
                if (!customerId) throw new Error('La API no devolvió el identificador del cliente.');
                state.customerId = customerId;
                state.customers.push({ Cliente_id: customerId, ...customer });
                ['customerName', 'customerEmail', 'customerDni', 'customerPhone'].forEach(id => {
                    document.getElementById(id).disabled = true;
                });
            }
        }

        const purchase = await solicitarAPI('compras', {
            method: 'POST',
            body: JSON.stringify({ fecha: new Date().toISOString().slice(0, 10), Cliente_id: customerId, Empleado_id: null })
        });
        purchaseId = purchase.id;
        if (!purchaseId) throw new Error('La API no devolvió el identificador del pedido.');

        for (const item of selectedItems) {
            await solicitarAPI(item.type === 'vehicle' ? 'cv' : 'cp', {
                method: 'POST',
                body: JSON.stringify(item.type === 'vehicle'
                    ? { Compra_id: purchaseId, Vehiculo_id: item.dbId }
                    : { Compra_id: purchaseId, Producto_id: item.dbId })
            });

            // Reducir stock automáticamente de inmediato
            deducirStockLocal(item);

            // Intentar actualizar también en la base de datos REST si el endpoint soporta PUT/PATCH de cantidad
            if (item.type === 'vehicle') {
                const nuevoStock = Math.max(0, (item.stock || 1) - 1);
                solicitarAPI(`vehiculos/${item.dbId}`, {
                    method: 'PUT',
                    body: JSON.stringify({ Cantidad: nuevoStock })
                }).catch(() => {});
            }
        }

        const city = state.cities.find(entry => Number(fieldValue(entry, 'Ciudad_id')) === cityId);
        const country = state.countries.find(entry => Number(fieldValue(entry, 'Pais_id')) === countryId);
        const carrier = state.carriers[Math.floor(Math.random() * state.carriers.length)];
        const origin = state.cities[0];
        const deliveryDate = new Date();
        deliveryDate.setDate(deliveryDate.getDate() + 5);
        const dateOnly = date => date.toISOString().slice(0, 10);
        await solicitarAPI('envios', {
            method: 'POST',
            body: JSON.stringify({
                CiudadO_id: Number(fieldValue(origin, 'Ciudad_id')) || cityId,
                CiudadD_id: cityId,
                Transporte_id: Number(fieldValue(carrier, 'Transporte_id')),
                FechaE: dateOnly(new Date()),
                FechaL: dateOnly(deliveryDate),
                Direccion: `${fieldValue(city, 'nombre')}, ${fieldValue(country, 'nombre')}`,
                Compra_id: purchaseId
            })
        });

        // Guardar pedido en el mapa de estados para seguimiento en tiempo real
        try {
            const statusMap = JSON.parse(localStorage.getItem('inemMotors.orderStatusMap') || '{}');
            statusMap[String(purchaseId)] = {
                estado: 'Pendiente',
                clienteNombre: customer.nombre,
                clienteDni: customer.dni,
                clienteCorreo: customer.correo,
                articulos: selectedItems.map(i => i.name).join(', '),
                articulosDetallados: selectedItems.map(i => ({
                    id: i.id,
                    dbId: i.dbId,
                    type: i.type,
                    name: i.name,
                    price: i.price,
                    category: i.type === 'vehicle' ? 'Vehículos' : 'Productos',
                    categoryName: i.categoryName
                })),
                total: selectedItems.reduce((sum, item) => sum + item.price, 0),
                fecha: new Date().toISOString().slice(0, 10),
                transportadora: fieldValue(carrier, 'nombre'),
                destino: `${fieldValue(city, 'nombre')}, ${fieldValue(country, 'nombre')}`
            };
            localStorage.setItem('inemMotors.orderStatusMap', JSON.stringify(statusMap));
            localStorage.setItem('inemMotors.lastCustomerDni', customer.dni);
        } catch (e) {
            console.warn('No se pudo guardar pedido localmente:', e);
        }

        document.getElementById('checkoutForm').querySelectorAll('select, input, button[type="submit"]').forEach(control => control.disabled = true);
        document.getElementById('checkoutStatus').classList.remove('error');
        document.getElementById('checkoutStatus').innerHTML = `
            <div style="padding:10px 0;">
                <p style="margin:0 0 10px;font-size:1.05rem;">
                    ¡Solicitud de pedido <strong>#${escapeHtml(purchaseId)}</strong> registrada! Transportadora asignada: <strong>${escapeHtml(fieldValue(carrier, 'nombre'))}</strong>.
                    <br><small style="color:var(--checkout-muted);">Está pendiente de confirmación por un trabajador.</small>
                </p>
                <a href="Pagina.inemVentas.html#mis-pedidos" style="display:inline-flex;align-items:center;gap:8px;background:#2962ff;color:#fff;padding:9px 18px;border-radius:6px;text-decoration:none;font-weight:700;font-size:.9rem;">
                    <i class="fa-solid fa-receipt"></i> Rastrear en "Mis Pedidos"
                </a>
            </div>
        `;
    } catch (error) {
        const message = purchaseId
            ? `El pedido #${purchaseId} se creó, pero faltó asociar algún dato: ${error.message}. No lo envíes de nuevo; contacta a un trabajador.`
            : customerId
                ? `Tus datos quedaron registrados; no se pudo crear el pedido: ${error.message}. Puedes volver a intentarlo.`
                : `No fue posible registrar el pedido: ${error.message}`;
        setStatus(message, true);
        button.disabled = false;
    }
}

function normalizarTexto(value) {
    return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

function normalizarDni(value) {
    return String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function normalizarTelefono(value) {
    return String(value ?? '').replace(/\D/g, '');
}

function setStatus(message, isError = false) {
    const status = document.getElementById('checkoutStatus');
    status.textContent = message;
    status.classList.toggle('error', isError);
}

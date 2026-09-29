async function cargarImagenesCompartidas() {
    const vacias = { vehiculos: {}, productos: {} };
    try {
        const respuesta = await fetch('data/imagenes.json', { cache: 'no-store' });
        if (!respuesta.ok) return vacias;
        const datos = await respuesta.json();
        const validarMapa = mapa => mapa && typeof mapa === 'object' && !Array.isArray(mapa) ? mapa : {};
        return {
            vehiculos: validarMapa(datos.vehiculos),
            productos: validarMapa(datos.productos)
        };
    } catch {
        return vacias;
    }
}
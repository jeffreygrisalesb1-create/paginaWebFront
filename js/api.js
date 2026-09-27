const API_BASE_URL = 'http://localhost:3000/api';

async function solicitarAPI(recurso, opciones = {}) {
    const respuesta = await fetch(`${API_BASE_URL}/${recurso}`, {
        ...opciones,
        headers: { 'Content-Type': 'application/json', ...(opciones.headers || {}) }
    });
    const datos = await respuesta.json().catch(() => null);
    if (!respuesta.ok) throw new Error(datos?.mensaje || `Error HTTP ${respuesta.status}`);
    return datos;
}

function openLoginModal() {
    document.getElementById('loginModal').classList.add('active');
}

function closeLoginModal() {
    document.getElementById('loginModal').classList.remove('active');
}

function cambiarTipoAcceso() {
    const esTrabajador = document.getElementById('accessRole').value === 'trabajador';
    document.getElementById('staffNameGroup').hidden = !esTrabajador;
    document.getElementById('staffDniGroup').hidden = !esTrabajador;
    document.getElementById('staffCodeGroup').hidden = esTrabajador;
    document.getElementById('staffPassGroup').hidden = esTrabajador;
    document.getElementById('staffName').required = esTrabajador;
    document.getElementById('staffDni').required = esTrabajador;
    document.getElementById('staffCode').required = !esTrabajador;
    document.getElementById('staffPass').required = !esTrabajador;
}

function normalizarTextoAcceso(valor) {
    return String(valor ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .replace(/\s+/g, ' ')
        .toLocaleLowerCase('es');
}

function normalizarDni(valor) {
    return String(valor ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

async function validarAcceso(e) {
    e.preventDefault();
    const rol = document.getElementById('accessRole').value;
    let accesoValido = false;

    if (rol === 'trabajador') {
        try {
            const empleados = await solicitarAPI('empleados');
            const nombreIngresado = normalizarTextoAcceso(document.getElementById('staffName').value);
            const dniIngresado = normalizarDni(document.getElementById('staffDni').value);
            accesoValido = Array.isArray(empleados) && empleados.some(empleado =>
                normalizarTextoAcceso(empleado.nombre) === nombreIngresado &&
                normalizarDni(empleado.dni) === dniIngresado
            );
        } catch (error) {
            alert(`No fue posible validar los datos con la base de datos: ${error.message}`);
            return;
        }
    } else {
        const codigo = document.getElementById('staffCode').value.trim().toUpperCase();
        const pass = document.getElementById('staffPass').value;
        accesoValido = rol === 'gerente' && codigo === 'GERENTE' && pass === '5678';
    }

    if (accesoValido) {
        closeLoginModal();
        showSection(rol);
        document.getElementById('authBtn').innerHTML = rol === 'gerente'
            ? `<i class="fa-solid fa-user-tie"></i> Gerente Activo`
            : `<i class="fa-solid fa-user-gear"></i> Trabajador Activo`;
        document.getElementById('staffCode').value = '';
        document.getElementById('staffPass').value = '';
        document.getElementById('staffName').value = '';
        document.getElementById('staffDni').value = '';
    } else {
        alert('No se encontró una coincidencia entre los datos y el empleado registrado.');
    }
}

function logout() {
    showSection('cliente');
    document.getElementById('authBtn').innerHTML = `<i class="fa-solid fa-lock-open"></i> Acceso Personal`;
}

cambiarTipoAcceso();

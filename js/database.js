// 1. Matriz maestra de casas válidas en la colonia (Regla de negocio)
const CASAS_VALIDAS = ["A-01", "A-02", "B-05", "C-10", "123", "Eje. A-01"];

// 2. Credenciales de la cuenta administrativa preexistente
const ADMIN_CREDENTIALS = {
    correo: "admin@pagopdp.com",
    password: "admin123"
};

const RESIDENTE_DEFAULTS = {
    estadoPago: 'pendiente',
    monto: 25.00,
    montoOriginal: 25.00,
    montoPagadoAcumulado: 0.00,
    ultimoPago: '',
    proximoVence: ''
};

function normalizarResidente(residente) {
    const estadoPago = (residente?.estadoPago || RESIDENTE_DEFAULTS.estadoPago).toLowerCase();
    const montoBase = Number(residente?.monto ?? RESIDENTE_DEFAULTS.monto);
    const montoOriginal = Number(residente?.montoOriginal ?? montoBase);
    const montoPagadoGuardado = Number(residente?.montoPagadoAcumulado ?? NaN);

    let montoPagadoCalculado = 0;
    if (Number.isFinite(montoPagadoGuardado) && montoPagadoGuardado > 0) {
        montoPagadoCalculado = montoPagadoGuardado;
    } else if (estadoPago === 'pagado') {
        // Si ya está pagado y no hay acumulado, asumimos que se pagó el monto original.
        montoPagadoCalculado = montoOriginal;
    } else if (estadoPago === 'incompleto') {
        // Para pagos parciales, el acumulado es lo ya cubierto contra el monto original.
        montoPagadoCalculado = Math.max(montoOriginal - montoBase, 0);
    }

    return {
        nombre: residente?.nombre || '',
        apellido: residente?.apellido || '',
        casa: residente?.casa || '',
        correo: residente?.correo || '',
        password: residente?.password || '',
        estadoPago,
        monto: montoBase,
        montoOriginal,
        montoPagadoAcumulado: Number(montoPagadoCalculado.toFixed(2)),
        ultimoPago: residente?.ultimoPago || RESIDENTE_DEFAULTS.ultimoPago,
        proximoVence: residente?.proximoVence || RESIDENTE_DEFAULTS.proximoVence
    };
}

function leerResidentesLocal() {
    const residentes = JSON.parse(localStorage.getItem('residentes_db')) || [];
    return residentes.map(normalizarResidente);
}

function guardarResidentesLocal(residentes) {
    localStorage.setItem('residentes_db', JSON.stringify(residentes.map(normalizarResidente)));
}

function migrarResidentesLocal() {
    const residentes = leerResidentesLocal();
    if (residentes.length > 0) {
        guardarResidentesLocal(residentes);
    }
}

// 3. Inicialización de la Base de Datos local para Residentes 
function inicializarDB() {
    // Si la base de datos local no existe, la creamos
    if (!localStorage.getItem('residentes_db')) {
        
        // Creamos un arreglo con un residente de prueba preexistente 
        const residentesIniciales = [
            {
                nombre: "Carlos",
                apellido: "Meía",
                casa: "A-01", 
                correo: "carlos.mejia@correo.com",
                password: "residente123",
                estadoPago: "pagado",
                monto: 25.00,
                montoOriginal: 25.00,
                montoPagadoAcumulado: 25.00,
                ultimoPago: "2025-06-05",
                proximoVence: "2025-07-05"
            }
        ];
        
        // Guardamos el usuario de prueba en el almacenamiento del navegador 
        guardarResidentesLocal(residentesIniciales);
    }

    migrarResidentesLocal();
}

// Ejecutar inicialización al cargar el script
inicializarDB();

// 4. Obtener listado de residentes actuales
function obtenerResidentes() {
    return leerResidentesLocal();
}
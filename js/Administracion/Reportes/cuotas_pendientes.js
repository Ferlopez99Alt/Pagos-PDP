import { db } from '../../Firebase_BD/firebase-config.js';
import { 
    collection, 
    getDocs, 
    doc, 
    updateDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const filtroCasa = document.getElementById('filtro-casa');
const filtroResidente = document.getElementById('filtro-residente');
const filtroEstado = document.getElementById('filtro-estado');
const btnAplicarFiltros = document.getElementById('btn-aplicar-filtros');
const btnLimpiarFiltros = document.getElementById('btn-limpiar-filtros');
const btnExportarPDF = document.getElementById('btn-exportar-pdf');
const btnExportarCSV = document.getElementById('btn-exportar-csv');
const tablaPendientes = document.getElementById('tabla-cuotas-pendientes');
const kpiMontoAdeudado = document.getElementById('kpi-monto-adeudado');
const kpiCuotasPendientes = document.getElementById('kpi-cuotas-pendientes');
const kpiEficiencia = document.getElementById('kpi-eficiencia');
const modalRegistrarPago = document.getElementById('modal-registrar-pago');
const inputModalCasa = document.getElementById('modal-casa');
const inputModalResidente = document.getElementById('modal-residente');
const inputModalMontoPendiente = document.getElementById('modal-monto-pendiente');
const selectModalTipoPago = document.getElementById('modal-tipo-pago');
const inputModalMontoPagado = document.getElementById('modal-monto-pagado');
const btnCancelarPago = document.getElementById('btn-cancelar-pago');
const btnGuardarPago = document.getElementById('btn-guardar-pago');
let filas = [];
let residenteEnGestion = null;

// Referencia global unificada a la colección de residentes en Firebase (Concordado con admin.js)
const residentesRef = collection(db, "residentes");

function exportarCSVTabla(tableSelector, fileName) {
    const tabla = document.querySelector(tableSelector);
    if (!tabla) return;

    const headers = Array.from(tabla.querySelectorAll('thead th')).map(th => th.textContent.trim());
    const filasVisibles = Array.from(tabla.querySelectorAll('tbody tr')).filter(fila => fila.style.display !== 'none');
    const registros = filasVisibles.map(fila =>
        Array.from(fila.querySelectorAll('td')).map(td => `"${td.textContent.trim().replace(/"/g, '""')}"`)
    );

    const csv = [headers.join(','), ...registros.map(cols => cols.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
}

function exportarPDFVista(titulo, tableSelector) {
    const tabla = document.querySelector(tableSelector);
    if (!tabla) return;

    const win = window.open('', '_blank');
    if (!win) return;

    win.document.write(`
        <html>
            <head>
                <title>${titulo}</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    h1 { margin: 0 0 16px; font-size: 20px; }
                    table { width: 100%; border-collapse: collapse; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
                    th { background: #f5f5f5; }
                </style>
            </head>
            <body>
                <h1>${titulo}</h1>
                ${tabla.outerHTML}
            </body>
        </html>
    `);
    win.document.close();
    win.focus();
    win.print();
}

/**
 * Trae a todos los residentes desde Cloud Firestore de forma asíncrona
 */
async function leerResidentes() {
    try {
        const querySnapshot = await getDocs(residentesRef);
        const residentes = [];
        querySnapshot.forEach((doc) => {
            residentes.push({ id: doc.id, ...doc.data() });
        });
        return residentes;
    } catch (error) {
        console.error("Error al leer residentes desde Firestore:", error);
        return [];
    }
}

function normalizarResidenteBasico(residente) {
    return {
        nombre: residente?.nombre || '',
        apellido: residente?.apellido || '',
        casa: residente?.casa || '',
        correo: residente?.correo || '',
        password: residente?.password || '',
        estadoPago: residente?.estadoPago || 'pendiente',
        monto: Number(residente?.monto ?? 25),
        montoOriginal: Number(residente?.montoOriginal ?? residente?.monto ?? 25),
        montoPagadoAcumulado: Number(residente?.montoPagadoAcumulado ?? 0),
        ultimoPago: residente?.ultimoPago || '',
        proximoVence: residente?.proximoVence || ''
    };
}

/**
 * Filtra los usuarios cuyo estado de pago no sea "pagado"
 */
function obtenerPendientes(residentes) {
    return residentes.filter(residente => {
        const estado = (residente.estadoPago || '').toLowerCase();
        return estado !== 'pagado';
    });
}

function obtenerEstadoPorVencimiento(fechaISO) {
    if (!fechaISO) return 'pendiente';

    const fechaVencimiento = new Date(fechaISO + 'T00:00:00');
    const hoy = new Date();
    const hoySinHora = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());

    return fechaVencimiento < hoySinHora ? 'enmora' : 'pendiente';
}

function formatearFecha(fechaISO) {
    if (!fechaISO) return '—';
    const [y, m, d] = fechaISO.split('-');
    if (!y || !m || !d) return '—';
    return `${d}/${m}/${y}`;
}

function actualizarResumen(residentes, pendientes) {
    const totalAdeudado = pendientes.reduce((acc, residente) => acc + Number(residente.monto || 0), 0);
    const total = residentes.length;
    const pagados = residentes.filter(r => (r.estadoPago || '').toLowerCase() === 'pagado').length;
    const eficiencia = total > 0 ? Math.round((pagados / total) * 100) : 0;

    kpiMontoAdeudado.textContent = `$${totalAdeudado.toFixed(2)}`;
    kpiCuotasPendientes.textContent = pendientes.length;
    kpiEficiencia.textContent = `${eficiencia}%`;
}

/**
 * Renderiza la tabla consumiendo el flujo asíncrono desde el servidor remoto
 */
async function renderizarTabla() {
    tablaPendientes.innerHTML = '<tr><td colspan="6" class="text-center" style="padding: 24px; color: var(--gris-texto);">Sincronizando base de datos en tiempo real...</td></tr>';
    
    const residentes = await leerResidentes();
    const pendientes = obtenerPendientes(residentes);
    actualizarResumen(residentes, pendientes);

    if (pendientes.length === 0) {
        tablaPendientes.innerHTML = '<tr><td colspan="6" class="empty-state">No hay cuotas pendientes almacenadas para mostrar.</td></tr>';
        filas = [];
        return;
    }

    tablaPendientes.innerHTML = pendientes.map(residente => {
        const nombreCompleto = `${residente.nombre || ''} ${residente.apellido || ''}`.trim();
        const estado = obtenerEstadoPorVencimiento(residente.proximoVence || '');
        const esPendiente = estado === 'pendiente';
        const etiquetaEstado = esPendiente ? 'Pendiente' : 'En mora';
        const claseEstado = esPendiente ? 'badge-pendiente' : 'badge-incompleto';

        return `
            <tr data-casa="${residente.casa || ''}" data-residente="${nombreCompleto}" data-estado="${estado}">
                <td>${residente.casa || '—'}</td>
                <td>${nombreCompleto || '—'}</td>
                <td>$${Number(residente.monto || 0).toFixed(2)}</td>
                <td>${formatearFecha(residente.proximoVence || '')}</td>
                <td><span class="badge ${claseEstado}">${etiquetaEstado}</span></td>
                <td><button class="btn-export btn-gestionar" data-casa="${residente.casa || ''}" type="button" style="padding:6px 10px;font-size:0.8rem;">Gestionar</button></td>
            </tr>
        `;
    }).join('');

    filas = Array.from(document.querySelectorAll('#tabla-cuotas-pendientes tr[data-casa]'));
    aplicarFiltros();
}

function estadoCoincide(valorEstado, estadoFila) {
    if (valorEstado === 'todos') return true;
    return estadoFila === valorEstado;
}

function aplicarFiltros() {
    const valorCasa = filtroCasa.value.trim().toLowerCase();
    const valorResidente = filtroResidente.value.trim().toLowerCase();
    const valorEstado = filtroEstado.value;

    filas.forEach(fila => {
        const casa = (fila.dataset.casa || '').toLowerCase();
        const residente = (fila.dataset.residente || '').toLowerCase();
        const estado = (fila.dataset.estado || '').toLowerCase();

        const coincideCasa = !valorCasa || casa.includes(valorCasa);
        const coincideResidente = !valorResidente || residente.includes(valorResidente);
        const coincideEstado = estadoCoincide(valorEstado, estado);

        fila.style.display = coincideCasa && coincideResidente && coincideEstado ? '' : 'none';
    });
}

function limpiarFiltros() {
    filtroCasa.value = '';
    filtroResidente.value = '';
    filtroEstado.value = 'todos';
    filas.forEach(fila => fila.style.display = '');
}

async function abrirModalGestion(casa) {
    const residentes = await leerResidentes();
    residenteEnGestion = residentes.find(residente => (residente.casa || '').toLowerCase() === (casa || '').toLowerCase()) || null;
    if (!residenteEnGestion) return;

    const nombreCompleto = `${residenteEnGestion.nombre || ''} ${residenteEnGestion.apellido || ''}`.trim();
    const montoPendiente = Number(residenteEnGestion.monto || 0);

    inputModalCasa.value = residenteEnGestion.casa || '';
    inputModalResidente.value = nombreCompleto;
    inputModalMontoPendiente.value = `$${montoPendiente.toFixed(2)}`;
    selectModalTipoPago.value = 'total';
    inputModalMontoPagado.value = montoPendiente.toFixed(2);
    inputModalMontoPagado.readOnly = true;

    modalRegistrarPago.classList.add('show');
    modalRegistrarPago.setAttribute('aria-hidden', 'false');
}

function cerrarModalGestion() {
    modalRegistrarPago.classList.remove('show');
    modalRegistrarPago.setAttribute('aria-hidden', 'true');
    residenteEnGestion = null;
}

async function guardarPagoGestion() {
    if (!residenteEnGestion) return;

    const tipoPago = selectModalTipoPago.value;
    const residentes = await leerResidentes();
    const indice = residentes.findIndex(residente => (residente.casa || '').toLowerCase() === (residenteEnGestion.casa || '').toLowerCase());
    if (indice === -1) {
        cerrarModalGestion();
        return;
    }

    const hoy = new Date();
    const hoyISO = hoy.toISOString().slice(0, 10);
    const montoActual = Number(residentes[indice].monto || 0);
    const montoPagadoAcumuladoActual = Number(residentes[indice].montoPagadoAcumulado || 0);
    let montoPago = Number(inputModalMontoPagado.value || 0);

    if (tipoPago === 'total') {
        montoPago = montoActual;
    }

    if (montoPago <= 0) {
        alert('El monto a registrar debe ser mayor a 0.');
        return;
    }

    if (montoPago > montoActual) {
        alert('El monto a registrar no puede ser mayor al monto pendiente.');
        return;
    }

    let datosActualizados = {};

    if (tipoPago === 'total' || montoPago === montoActual) {
        const proximo = new Date(hoy);
        proximo.setMonth(proximo.getMonth() + 1);

        datosActualizados = normalizarResidenteBasico({
            ...residentes[indice],
            estadoPago: 'pagado',
            monto: 0,
            montoPagadoAcumulado: Number((montoPagadoAcumuladoActual + montoActual).toFixed(2)),
            ultimoPago: hoyISO,
            proximoVence: proximo.toISOString().slice(0, 10)
        });
    } else {
        datosActualizados = normalizarResidenteBasico({
            ...residentes[indice],
            estadoPago: 'incompleto',
            monto: Number((montoActual - montoPago).toFixed(2)),
            montoPagadoAcumulado: Number((montoPagadoAcumuladoActual + montoPago).toFixed(2)),
            ultimoPago: hoyISO
        });
    }

    try {
        // En concordancia exacta con Firebase_BD/database-firebase.js, actualiza usando el ID del documento
        const residenteDocRef = doc(db, "residentes", residenteEnGestion.id);
        await updateDoc(residenteDocRef, datosActualizados);
        
        cerrarModalGestion();
        await renderizarTabla();
    } catch (error) {
        console.error("Error al guardar el pago en Firestore: ", error);
        alert("Ocurrió un error al procesar el pago en el servidor.");
    }
}

// Vinculación de Event Listeners del DOM
btnAplicarFiltros.addEventListener('click', aplicarFiltros);
btnLimpiarFiltros.addEventListener('click', limpiarFiltros);
filtroCasa.addEventListener('input', aplicarFiltros);
filtroResidente.addEventListener('input', aplicarFiltros);
filtroEstado.addEventListener('change', aplicarFiltros);
btnExportarCSV.addEventListener('click', () => exportarCSVTabla('.data-table', 'reporte_cuotas_pendientes.csv'));
btnExportarPDF.addEventListener('click', () => exportarPDFVista('Reporte de Cuotas Pendientes', '.data-table'));

tablaPendientes.addEventListener('click', (event) => {
    const botonGestion = event.target.closest('.btn-gestionar');
    if (!botonGestion) return;
    abrirModalGestion(botonGestion.dataset.casa || '');
});

selectModalTipoPago.addEventListener('change', () => {
    const montoTexto = inputModalMontoPendiente.value.replace('$', '');
    const montoPendiente = Number(montoTexto || 0);
    const esParcial = selectModalTipoPago.value === 'parcial';
    inputModalMontoPagado.readOnly = !esParcial;
    inputModalMontoPagado.value = montoPendiente.toFixed(2);
    if (esParcial) {
        inputModalMontoPagado.focus();
        inputModalMontoPagado.select();
    }
});

btnCancelarPago.addEventListener('click', cerrarModalGestion);
btnGuardarPago.addEventListener('click', guardarPagoGestion);

modalRegistrarPago.addEventListener('click', (event) => {
    if (event.target === modalRegistrarPago) {
        cerrarModalGestion();
    }
});

// Carga asíncrona inicial
document.addEventListener('DOMContentLoaded', async () => {
    await renderizarTabla();
});
import { db } from '../../Firebase_BD/firebase-config.js';
import { 
    collection, 
    getDocs
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const inputBusqueda = document.getElementById('filtro-residente-casa');
const inputFechaInicio = document.getElementById('filtro-fecha-inicio');
const inputFechaFin = document.getElementById('filtro-fecha-fin');
const btnAplicarFiltros = document.getElementById('btn-aplicar-filtros');
const btnLimpiarFiltros = document.getElementById('btn-limpiar-filtros');
const btnExportarPDF = document.getElementById('btn-exportar-pdf');
const btnExportarCSV = document.getElementById('btn-exportar-csv');
const tbody = document.getElementById('tabla-pagos-pagados');
const kpiTotalPagado = document.getElementById('kpi-total-pagado');
const kpiRegistros = document.getElementById('kpi-registros');
let filasReporte = [];

// Referencia global a la colección de residentes en Firebase (Concordado con admin.js)
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

function formatearFecha(fechaISO) {
    if (!fechaISO) return '—';
    const [y, m, d] = fechaISO.split('-');
    if (!y || !m || !d) return '—';
    return `${d}/${m}/${y}`;
}

/**
 * Lee los residentes de forma asíncrona directamente desde Cloud Firestore
 */
async function leerResidentesFirestore() {
    try {
        const querySnapshot = await getDocs(residentesRef);
        const residentes = [];
        querySnapshot.forEach((doc) => {
            residentes.push({ id: doc.id, ...doc.data() });
        });
        return residentes;
    } catch (error) {
        console.error("Error al obtener los residentes para el reporte:", error);
        return [];
    }
}

/**
 * Filtra los usuarios que tengan estado "pagado" basándose en los datos concordados de Firebase
 */
async function obtenerPagados() {
    const todos = await leerResidentesFirestore();
    return todos.filter(residente => (residente.estadoPago || '').toLowerCase() === 'pagado');
}

function actualizarResumen(pagados) {
    // Calcula la suma usando montoPagadoAcumulado o monto en concordancia con database-firebase.js
    const total = pagados.reduce((acumulado, residente) => {
        const montoMostrado = Number(residente.montoPagadoAcumulado ?? residente.monto ?? 0);
        return acumulado + montoMostrado;
    }, 0);
    kpiTotalPagado.textContent = `$${total.toFixed(2)}`;
    kpiRegistros.textContent = pagados.length;
}

/**
 * Renderiza la tabla consumiendo el flujo de datos asíncrono de Firebase
 */
async function renderizarTabla() {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center" style="padding: 24px; color: var(--gris-texto);">Sincronizando con base de datos en tiempo real...</td></tr>';
    
    const pagados = await obtenerPagados();
    actualizarResumen(pagados);

    if (pagados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No hay pagos registrados para mostrar.</td></tr>';
        filasReporte = [];
        return;
    }

    tbody.innerHTML = pagados.map(residente => {
        const nombreCompleto = `${residente.nombre || ''} ${residente.apellido || ''}`.trim();
        // Toma la fecha del último pago del ciclo generado por fecha_cobro.js
        const fechaPago = residente.ultimoPago || '';
        const montoMostrado = Number(residente.montoPagadoAcumulado ?? residente.monto ?? 0);
        return `
            <tr data-casa="${residente.casa || ''}" data-residente="${nombreCompleto}" data-fecha="${fechaPago}">
                <td>${residente.casa || '—'}</td>
                <td>${nombreCompleto || '—'}</td>
                <td>${formatearFecha(fechaPago)}</td>
                <td>$${montoMostrado.toFixed(2)}</td>
                <td><span class="badge badge-pagado">Pagado</span></td>
            </tr>
        `;
    }).join('');

    filasReporte = Array.from(document.querySelectorAll('#tabla-pagos-pagados tr[data-casa]'));
    aplicarFiltros();
}

function aplicarFiltros() {
    const texto = inputBusqueda.value.trim().toLowerCase();
    const fechaInicio = inputFechaInicio.value ? new Date(inputFechaInicio.value + 'T00:00:00') : null;
    const fechaFin = inputFechaFin.value ? new Date(inputFechaFin.value + 'T23:59:59') : null;

    filasReporte.forEach(fila => {
        const casa = (fila.dataset.casa || '').toLowerCase();
        const residente = (fila.dataset.residente || '').toLowerCase();
        const fechaPago = fila.dataset.fecha ? new Date(fila.dataset.fecha + 'T00:00:00') : null;

        const coincideTexto = !texto || casa.includes(texto) || residente.includes(texto);
        const coincideInicio = !fechaInicio || (fechaPago && fechaPago >= fechaInicio);
        const coincideFin = !fechaFin || (fechaPago && fechaPago <= fechaFin);

        fila.style.display = coincideTexto && coincideInicio && coincideFin ? '' : 'none';
    });
}

function limpiarFiltros() {
    inputBusqueda.value = '';
    inputFechaInicio.value = '';
    inputFechaFin.value = '';
    filasReporte.forEach(fila => {
        fila.style.display = '';
    });
}

// Vinculación de Event Listeners de la interfaz
btnAplicarFiltros.addEventListener('click', aplicarFiltros);
btnLimpiarFiltros.addEventListener('click', limpiarFiltros);
inputBusqueda.addEventListener('input', aplicarFiltros);
btnExportarCSV.addEventListener('click', () => exportarCSVTabla('.data-table', 'reporte_cuotas_pagadas.csv'));
btnExportarPDF.addEventListener('click', () => exportarPDFVista('Reporte de Cuotas Pagadas', '.data-table'));

// Carga inicial al cargar el script modular
document.addEventListener('DOMContentLoaded', async () => {
    await renderizarTabla();
});
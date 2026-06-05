import { db } from '../../Firebase_BD/firebase-config.js';
import { 
    collection, 
    getDocs 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const filtroCasa = document.getElementById('filtro-casa');
const filtroResidente = document.getElementById('filtro-residente');
const btnExportarPDF = document.getElementById('btn-exportar-pdf');
const btnExportarCSV = document.getElementById('btn-exportar-csv');
const btnAplicarFiltros = document.getElementById('btn-aplicar-filtros');
const btnLimpiarFiltros = document.getElementById('btn-limpiar-filtros');
const tablaPagosParciales = document.getElementById('tabla-pagos-parciales');
const kpiTotalRecaudado = document.getElementById('kpi-total-recaudado');
const kpiSaldoTotal = document.getElementById('kpi-saldo-total');
const kpiCumplimiento = document.getElementById('kpi-cumplimiento');
let filas = [];

// Referencia unificada a la colección de Cloud Firestore
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
 * Consulta de forma asíncrona la lista de residentes almacenados en Firebase
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
        console.error("Error al recuperar los residentes desde Firestore:", error);
        return [];
    }
}

function calcularMontos(residente) {
    const montoOriginal = Number(residente.montoOriginal ?? residente.monto ?? 0);
    let pagado = Number(residente.montoPagadoAcumulado ?? 0);
    const estado = (residente.estadoPago || '').toLowerCase();

    // Compatibilidad con registros antiguos sin acumulado.
    if (pagado <= 0 && estado === 'pagado') {
        pagado = montoOriginal;
    }

    const saldo = Math.max(montoOriginal - pagado, 0);
    return { montoOriginal, pagado, saldo, estado };
}

function obtenerEtiquetaEstado(pagado, saldo) {
    if (saldo <= 0 && pagado > 0) {
        return { texto: 'Completado', clase: 'badge-pagado' };
    }
    if (pagado > 0) {
        return { texto: 'Parcial', clase: 'badge-pendiente' };
    }
    return { texto: 'Pendiente', clase: 'badge-incompleto' };
}

function formatearFecha(fechaISO) {
    if (!fechaISO) return '—';
    const [y, m, d] = fechaISO.split('-');
    if (!y || !m || !d) return '—';
    return `${d}/${m}/${y}`;
}

function actualizarResumen(residentes) {
    const montos = residentes.map(calcularMontos);
    const totalRecaudado = montos.reduce((acc, item) => acc + item.pagado, 0);
    const saldoTotal = montos.reduce((acc, item) => acc + item.saldo, 0);
    const completados = montos.filter(item => item.saldo <= 0 && item.montoOriginal > 0).length;
    const cumplimiento = residentes.length > 0 ? Math.round((completados / residentes.length) * 100) : 0;

    kpiTotalRecaudado.textContent = `$${totalRecaudado.toFixed(2)}`;
    kpiSaldoTotal.textContent = `$${saldoTotal.toFixed(2)}`;
    kpiCumplimiento.textContent = `${cumplimiento}%`;
}

/**
 * Renderiza la estructura de la tabla consumiendo los datos de la nube
 */
async function renderizarTabla() {
    tablaPagosParciales.innerHTML = '<tr><td colspan="6" class="text-center" style="padding: 24px; color: var(--gris-texto);">Sincronizando información financiera...</td></tr>';

    const residentes = await leerResidentes();
    actualizarResumen(residentes);

    if (residentes.length === 0) {
        tablaPagosParciales.innerHTML = '<tr><td colspan="6" class="empty-state">No hay datos almacenados para mostrar.</td></tr>';
        filas = [];
        return;
    }

    tablaPagosParciales.innerHTML = residentes.map(residente => {
        const nombreCompleto = `${residente.nombre || ''} ${residente.apellido || ''}`.trim();
        const { pagado, saldo } = calcularMontos(residente);
        const estadoUi = obtenerEtiquetaEstado(pagado, saldo);
        const fechaVencimiento = residente.proximoVence || '';

        return `
            <tr data-casa="${residente.casa || ''}" data-residente="${nombreCompleto}" data-vencimiento="${fechaVencimiento}">
                <td>${residente.casa || '—'}</td>
                <td>${nombreCompleto || '—'}</td>
                <td>$${pagado.toFixed(2)}</td>
                <td>$${saldo.toFixed(2)}</td>
                <td>${formatearFecha(fechaVencimiento)}</td>
                <td><span class="badge ${estadoUi.clase}">${estadoUi.texto}</span></td>
            </tr>
        `;
    }).join('');

    filas = Array.from(document.querySelectorAll('#tabla-pagos-parciales tr[data-casa]'));
    aplicarFiltros();
}

function aplicarFiltros() {
    const valorCasa = filtroCasa.value.trim().toLowerCase();
    const valorResidente = filtroResidente.value.trim().toLowerCase();

    filas.forEach(fila => {
        const casa = (fila.dataset.casa || '').toLowerCase();
        const residente = (fila.dataset.residente || '').toLowerCase();

        const coincideCasa = !valorCasa || casa.includes(valorCasa);
        const coincideResidente = !valorResidente || residente.includes(valorResidente);

        fila.style.display = coincideCasa && coincideResidente ? '' : 'none';
    });
}

function limpiarFiltros() {
    filtroCasa.value = '';
    filtroResidente.value = '';
    filas.forEach(fila => fila.style.display = '');
}

// Escuchadores de eventos para la interfaz de reportes
btnAplicarFiltros.addEventListener('click', aplicarFiltros);
btnLimpiarFiltros.addEventListener('click', limpiarFiltros);
filtroCasa.addEventListener('input', aplicarFiltros);
filtroResidente.addEventListener('input', aplicarFiltros);
btnExportarCSV.addEventListener('click', () => exportarCSVTabla('.data-table', 'reporte_pagos_parciales.csv'));
btnExportarPDF.addEventListener('click', () => exportarPDFVista('Reporte de Pagos Parciales', '.data-table'));

// Inicialización asíncrona al cargar el script estructurado
document.addEventListener('DOMContentLoaded', async () => {
    await renderizarTabla();
});
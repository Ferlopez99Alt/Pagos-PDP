const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

let filtroActual = 'todos';
let paginaActual = 1;
const FILAS_POR_PAGINA = 7;

document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('sesion_activa') !== 'admin') {
        window.location.href = 'index.html';
        return;
    }
    inicializarDatosPrueba();
    mostrarMesActual();
    actualizarKPIs();
    renderizarTabla();
});

function mostrarMesActual() {
    const hoy = new Date();
    document.getElementById('subtitulo-mes').textContent =
        `${MESES[hoy.getMonth()]} ${hoy.getFullYear()}`;
}

function inicializarDatosPrueba() {
    let residentes = JSON.parse(localStorage.getItem('residentes_db')) || [];

    const prueba = [
        { nombre: 'María',   apellido: 'González',  casa: 'A-02', correo: 'maria@correo.com',   password: 'res123', estadoPago: 'pagado',    monto: 25.00, ultimoPago: '2025-06-05', proximoVence: '2025-07-05' },
        { nombre: 'Pedro',   apellido: 'Hernández', casa: 'B-01', correo: 'pedro@correo.com',   password: 'res123', estadoPago: 'pendiente',  monto: 25.00, ultimoPago: '2025-05-05', proximoVence: '2025-06-05' },
        { nombre: 'Lucía',   apellido: 'Martínez',  casa: 'B-02', correo: 'lucia@correo.com',   password: 'res123', estadoPago: 'incompleto', monto: 25.00, ultimoPago: '2025-04-10', proximoVence: '2025-06-10' },
        { nombre: 'Jorge',   apellido: 'López',     casa: 'B-03', correo: 'jorge@correo.com',   password: 'res123', estadoPago: 'pagado',    monto: 25.00, ultimoPago: '2025-06-01', proximoVence: '2025-07-01' },
        { nombre: 'Ana',     apellido: 'Ramírez',   casa: 'C-01', correo: 'ana@correo.com',     password: 'res123', estadoPago: 'pendiente',  monto: 25.00, ultimoPago: '2025-05-01', proximoVence: '2025-06-01' },
        { nombre: 'Luis',    apellido: 'Flores',    casa: 'C-02', correo: 'luis@correo.com',    password: 'res123', estadoPago: 'pagado',    monto: 25.00, ultimoPago: '2025-06-03', proximoVence: '2025-07-03' },
        { nombre: 'Sofía',   apellido: 'Torres',    casa: 'C-03', correo: 'sofia@correo.com',   password: 'res123', estadoPago: 'incompleto', monto: 25.00, ultimoPago: '2025-03-15', proximoVence: '2025-06-15' },
        { nombre: 'Diego',   apellido: 'Morales',   casa: 'D-01', correo: 'diego@correo.com',   password: 'res123', estadoPago: 'pagado',    monto: 25.00, ultimoPago: '2025-06-04', proximoVence: '2025-07-04' },
        { nombre: 'Elena',   apellido: 'Jiménez',   casa: 'D-02', correo: 'elena@correo.com',   password: 'res123', estadoPago: 'pendiente',  monto: 25.00, ultimoPago: '2025-05-10', proximoVence: '2025-06-10' },
        { nombre: 'Roberto', apellido: 'Castillo',  casa: 'D-03', correo: 'roberto@correo.com', password: 'res123', estadoPago: 'pagado',    monto: 25.00, ultimoPago: '2025-06-02', proximoVence: '2025-07-02' },
        { nombre: 'Carmen',  apellido: 'Vásquez',   casa: 'E-01', correo: 'carmen@correo.com',  password: 'res123', estadoPago: 'incompleto', monto: 25.00, ultimoPago: '2025-02-20', proximoVence: '2025-06-20' },
    ];

    // Agregar estadoPago a residentes existentes que no lo tienen
    residentes = residentes.map(r => {
        if (!r.estadoPago) {
            return { ...r, estadoPago: 'pagado', monto: 25.00, ultimoPago: '2025-06-05', proximoVence: '2025-07-05' };
        }
        return r;
    });

    // Agregar residentes de prueba que no existan por numero de casa
    const casasExistentes = new Set(residentes.map(r => r.casa));
    for (const r of prueba) {
        if (!casasExistentes.has(r.casa)) {
            residentes.push(r);
            casasExistentes.add(r.casa);
        }
    }

    localStorage.setItem('residentes_db', JSON.stringify(residentes));
}

function leerResidentes() {
    return JSON.parse(localStorage.getItem('residentes_db')) || [];
}

function obtenerFiltrados() {
    const todos = leerResidentes();
    if (filtroActual === 'todos') return todos;
    return todos.filter(r => r.estadoPago === filtroActual);
}

function actualizarKPIs() {
    const todos = leerResidentes();
    const total      = todos.length;
    const pagados    = todos.filter(r => r.estadoPago === 'pagado').length;
    const pendientes = todos.filter(r => r.estadoPago === 'pendiente').length;
    const incompletos = todos.filter(r => r.estadoPago === 'incompleto').length;
    const pct = n => total > 0 ? Math.round((n / total) * 100) + '%' : '0%';

    document.getElementById('kpi-total').textContent      = total;
    document.getElementById('kpi-total-pct').textContent  = '100%';
    document.getElementById('kpi-pagados').textContent    = pagados;
    document.getElementById('kpi-pagados-pct').textContent = pct(pagados);
    document.getElementById('kpi-pendientes').textContent  = pendientes;
    document.getElementById('kpi-pendientes-pct').textContent = pct(pendientes);
    document.getElementById('kpi-incompletos').textContent = incompletos;
    document.getElementById('kpi-incompletos-pct').textContent = pct(incompletos);
}

function renderizarTabla() {
    const filtrados = obtenerFiltrados();
    const inicio    = (paginaActual - 1) * FILAS_POR_PAGINA;
    const pagina    = filtrados.slice(inicio, inicio + FILAS_POR_PAGINA);
    const tbody     = document.getElementById('tabla-residentes');
    tbody.innerHTML = '';

    if (pagina.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center" style="padding:24px;color:var(--gris-texto)">No hay registros para mostrar.</td></tr>';
    } else {
        for (const r of pagina) {
            const badgeClass = r.estadoPago === 'pagado' ? 'badge-pagado'
                             : r.estadoPago === 'pendiente' ? 'badge-pendiente'
                             : 'badge-incompleto';
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${r.casa}</td>
                <td>${r.nombre} ${r.apellido}</td>
                <td><span class="badge ${badgeClass}">${r.estadoPago}</span></td>
                <td>$${Number(r.monto).toFixed(2)}</td>
                <td>${formatearFecha(r.ultimoPago)}</td>
                <td>${formatearFecha(r.proximoVence)}</td>
                <td><button class="btn-ver" onclick="verDetalle('${r.casa}')">Ver detalle</button></td>
            `;
            tbody.appendChild(tr);
        }
    }

    renderizarPaginacion(filtrados.length);
}

function formatearFecha(fechaISO) {
    if (!fechaISO) return '—';
    const [y, m, d] = fechaISO.split('-');
    return `${d}/${m}/${y}`;
}

function renderizarPaginacion(totalRegistros) {
    const totalPaginas = Math.ceil(totalRegistros / FILAS_POR_PAGINA);
    const paginacion   = document.getElementById('paginacion');
    paginacion.innerHTML = '';
    if (totalPaginas <= 1) return;

    for (let i = 1; i <= totalPaginas; i++) {
        const btn = document.createElement('button');
        btn.className = 'btn-page' + (i === paginaActual ? ' active' : '');
        btn.textContent = i;
        btn.onclick = () => { paginaActual = i; renderizarTabla(); };
        paginacion.appendChild(btn);
    }
}

function aplicarFiltro(filtro) {
    filtroActual = filtro;
    paginaActual = 1;
    document.querySelectorAll('.btn-filter').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === filtro);
    });
    renderizarTabla();
}

function verDetalle(casa) {
    const r = leerResidentes().find(x => x.casa === casa);
    if (!r) return;
    alert(
        `Casa: ${r.casa}\n` +
        `Residente: ${r.nombre} ${r.apellido}\n` +
        `Correo: ${r.correo}\n` +
        `Estado: ${r.estadoPago}\n` +
        `Monto: $${Number(r.monto).toFixed(2)}\n` +
        `Último pago: ${formatearFecha(r.ultimoPago)}\n` +
        `Próximo vence: ${formatearFecha(r.proximoVence)}`
    );
}

function exportarCSV() {
    const filtrados = obtenerFiltrados();
    const encabezado = ['Casa','Residente','Estado','Monto','Último Pago','Próximo Vence'];
    const filas = filtrados.map(r => [
        r.casa,
        `${r.nombre} ${r.apellido}`,
        r.estadoPago,
        Number(r.monto).toFixed(2),
        r.ultimoPago  || '',
        r.proximoVence || ''
    ]);
    const csv  = [encabezado, ...filas].map(f => f.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'reporte_pagos.csv';
    a.click();
    URL.revokeObjectURL(url);
}

function cerrarSesion() {
    localStorage.removeItem('sesion_activa');
    localStorage.removeItem('sesion_activa_casa');
    window.location.href = 'index.html';
}

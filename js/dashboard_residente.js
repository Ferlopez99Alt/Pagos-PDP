// ==========================================
// 1. Verificación de Seguridad (Proteger la ruta)
// ==========================================
const sesionActualTexto = localStorage.getItem('sesion_actual');

// Si no hay sesión guardada, lo regresamos al login
if (!sesionActualTexto) {
    alert("Acceso denegado. Por favor, inicia sesión.");
    window.location.href = "index.html";
}

const sesionActual = JSON.parse(sesionActualTexto);
const sesionResidente = typeof normalizarResidente === 'function'
    ? normalizarResidente(sesionActual)
    : sesionActual;

// ==========================================
// 2. Base de datos de pagos (Generador de pruebas)
// ==========================================
function inicializarPagosDB() {
    let pagos = JSON.parse(localStorage.getItem('pagos_db'));
    
    // Si no existen pagos aún, creamos unos de prueba para esta casa
    if (!pagos) {
        pagos = [
            { id: "PAG-001", casa: sesionResidente.casa, mes: "Marzo 2026", monto: 50.00, estado: "pagado" },
            { id: "PAG-002", casa: sesionResidente.casa, mes: "Abril 2026", monto: 50.00, estado: "pagado" },
            { id: "PAG-003", casa: sesionResidente.casa, mes: "Mayo 2026", monto: 50.00, estado: "pendiente" }
        ];
        localStorage.setItem('pagos_db', JSON.stringify(pagos));
    }
}

// ==========================================
// 3. Renderizar la Interfaz
// ==========================================
function cargarDashboard() {
    // 3.1 Pintar Info del usuario en el HTML
    document.getElementById('residente-nombre').innerText = `Hola, ${sesionResidente.nombre} ${sesionResidente.apellido}`;
    document.getElementById('residente-casa').innerText = sesionResidente.casa;

    // 3.2 Obtener los pagos
    const todosLosPagos = JSON.parse(localStorage.getItem('pagos_db')) || [];
    
    // Filtrar solo los pagos que pertenecen a la casa que inició sesión
    const misPagos = todosLosPagos.filter(p => p.casa.toLowerCase() === sesionResidente.casa.toLowerCase());

    const tbody = document.getElementById('tabla-pagos-body');
    tbody.innerHTML = ''; // Limpiamos la tabla por si recargamos la función

    let tieneMora = false;
    let pagoPendiente = null;

    // 3.3 Construir tabla fila por fila
    misPagos.forEach(pago => {
        // Detectar si hay algún pago pendiente
        if (pago.estado === "pendiente") {
            tieneMora = true;
            pagoPendiente = pago;
        }

        const tr = document.createElement('tr');
        
        // Clases CSS que ya definiste en styles.css
        const claseBadge = pago.estado === 'pagado' ? 'badge-pagado' : 'badge-pendiente';
        const textoBadge = pago.estado === 'pagado' ? 'Pagado' : 'Pendiente';

        tr.innerHTML = `
            <td>${pago.mes}</td>
            <td>$${pago.monto.toFixed(2)}</td>
            <td><span class="badge ${claseBadge}">${textoBadge}</span></td>
        `;
        tbody.appendChild(tr);
    });

    // 3.4 Actualizar la Tarjeta de Estado Visual
    const statusCard = document.getElementById('status-card');
    const statusTitle = document.getElementById('status-title');
    const statusMessage = document.getElementById('status-message');
    const paymentAction = document.getElementById('payment-action-container');

    // Limpiar clases de colores previos
    statusCard.classList.remove('al-dia', 'en-mora');

    if (tieneMora) {
        statusCard.classList.add('en-mora');
        statusTitle.innerText = "🚨 Pago Pendiente";
        statusMessage.innerText = `Tienes un saldo pendiente para el mes de ${pagoPendiente.mes}. Evita recargos realizando tu pago hoy.`;
        
        paymentAction.classList.remove('hidden');
        document.getElementById('monto-pendiente').innerText = pagoPendiente.monto.toFixed(2);
        
        // Asignar el ID del pago al botón para que sepa qué cobrar
        document.getElementById('btn-pagar').onclick = () => procesarPago(pagoPendiente.id);
    } else {
        statusCard.classList.add('al-dia');
        statusTitle.innerText = "✅ Al Día";
        statusMessage.innerText = "¡Gracias! No tienes pagos pendientes en este momento.";
        paymentAction.classList.add('hidden');
    }
}

// ==========================================
// 4. Lógica para procesar el pago
// ==========================================
function procesarPago(idPago) {
    if(confirm("¿Confirmas que deseas realizar este pago en el sistema?")) {
        let pagos = JSON.parse(localStorage.getItem('pagos_db'));
        
        // Buscar la posición exacta del pago en el arreglo
        const indice = pagos.findIndex(p => p.id === idPago);
        
        if (indice !== -1) {
            pagos[indice].estado = "pagado"; // Cambiamos el estado
            localStorage.setItem('pagos_db', JSON.stringify(pagos)); // Guardamos en la base

            const residentes = typeof leerResidentesLocal === 'function'
                ? leerResidentesLocal()
                : (JSON.parse(localStorage.getItem('residentes_db')) || []);
            const indiceResidente = residentes.findIndex(r => r.casa.toLowerCase() === sesionResidente.casa.toLowerCase());

            if (indiceResidente !== -1) {
                const fechaHoy = new Date();
                const proximo = new Date(fechaHoy);
                proximo.setMonth(proximo.getMonth() + 1);

                residentes[indiceResidente] = typeof normalizarResidente === 'function'
                    ? normalizarResidente({
                        ...residentes[indiceResidente],
                        estadoPago: 'pagado',
                        montoPagadoAcumulado: Number(residentes[indiceResidente].montoPagadoAcumulado || 0) + Number(pagos[indice].monto || 0),
                        ultimoPago: fechaHoy.toISOString().slice(0, 10),
                        proximoVence: proximo.toISOString().slice(0, 10)
                    })
                    : {
                        ...residentes[indiceResidente],
                        estadoPago: 'pagado',
                        montoPagadoAcumulado: Number(residentes[indiceResidente].montoPagadoAcumulado || 0) + Number(pagos[indice].monto || 0),
                        ultimoPago: fechaHoy.toISOString().slice(0, 10),
                        proximoVence: proximo.toISOString().slice(0, 10)
                    };

                if (typeof guardarResidentesLocal === 'function') {
                    guardarResidentesLocal(residentes);
                } else {
                    localStorage.setItem('residentes_db', JSON.stringify(residentes));
                }
            }
            
            alert("¡Pago procesado con éxito! Tu estado de cuenta ha sido actualizado.");
            cargarDashboard(); // Volvemos a pintar la interfaz automáticamente
        }
    }
}

// ==========================================
// 5. Lógica para Cerrar Sesión
// ==========================================
document.getElementById('btn-logout').addEventListener('click', () => {
    localStorage.removeItem('sesion_actual'); // Borramos la sesión
    window.location.href = "index.html"; // Regresamos al login
});

// ==========================================
// Arrancar la ejecución al cargar la página
// ==========================================
inicializarPagosDB();
cargarDashboard();
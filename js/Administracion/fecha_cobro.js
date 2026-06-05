import { db } from '../Firebase_BD/firebase-config.js';
import { 
    collection, 
    getDocs, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    doc,
    writeBatch
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Referencias a las colecciones de Cloud Firestore
const cobrosRef = collection(db, "fechas_cobro");
const residentesRef = collection(db, "residentes");

const modal = document.getElementById('modal-cobro');
const formCobro = document.getElementById('form-fecha-cobro');
const tbody = document.getElementById('tabla-fechas-cobro');

document.addEventListener('DOMContentLoaded', async () => {
    // Protección de ruta de administración unificada según tus especificaciones de admin.js
    const sesionActual = JSON.parse(localStorage.getItem('sesion_actual') || 'null');
    const esAdmin = (sesionActual && sesionActual.rol === 'admin') || localStorage.getItem('sesion_activa') === 'admin';

    if (!esAdmin) {
        window.location.href = 'index.html';
        return;
    }

    // Inicializar listeners del modal
    document.getElementById('btn-abrir-modal').addEventListener('click', () => abrirModal());
    document.getElementById('btn-cerrar-modal').addEventListener('click', cerrarModal);
    formCobro.addEventListener('submit', guardarCobro);

    // Carga inicial remota
    await listarFechasCobro();
});

function abrirModal(datos = null) {
    formCobro.reset();
    if (datos) {
        document.getElementById('modal-titulo').textContent = "Modificar Ciclo de Cobro";
        document.getElementById('cobro-id').value = datos.id;
        document.getElementById('cobro-descripcion').value = datos.descripcion;
        document.getElementById('cobro-monto').value = datos.monto;
        document.getElementById('cobro-emision').value = datos.ultimoPago;
        document.getElementById('cobro-vence').value = datos.proximoVence;
    } else {
        document.getElementById('modal-titulo').textContent = "Nueva Fecha de Cobro";
        document.getElementById('cobro-id').value = "";
    }
    modal.classList.remove('hidden');
}

function cerrarModal() {
    modal.classList.add('hidden');
}

/**
 * Lee los ciclos de facturación vigentes desde la base de datos
 */
async function listarFechasCobro() {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center" style="padding: 24px; color: var(--gris-texto);">Consultando base de datos remota...</td></tr>';
    try {
        const querySnapshot = await getDocs(cobrosRef);
        tbody.innerHTML = '';

        if (querySnapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center" style="padding: 24px; color: var(--gris-texto);">No hay fechas de cobro programadas.</td></tr>';
            return;
        }

        querySnapshot.forEach((documento) => {
            const data = documento.data();
            const id = documento.id;
            const tr = document.createElement('tr');
            
            tr.innerHTML = `
                <td><strong>${data.descripcion}</strong></td>
                <td>$${Number(data.monto).toFixed(2)}</td>
                <td>${formatearFecha(data.ultimoPago)}</td>
                <td>${formatearFecha(data.proximoVence)}</td>
                <td class="actions-cell">
                    <button class="btn-ver btn-editar">Modificar</button>
                    <button class="btn-eliminar">Eliminar</button>
                </td>
            `;

            // Enlazar eventos individuales evitando variables globales
            tr.querySelector('.btn-editar').addEventListener('click', () => abrirModal({ id, ...data }));
            tr.querySelector('.btn-eliminar').addEventListener('click', () => eliminarCobro(id));

            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error("Error al obtener los ciclos de cobro:", error);
        tbody.innerHTML = '<tr><td colspan="5" class="text-center" style="color:var(--rojo-incompleto);">Error crítico al conectar con Firestore.</td></tr>';
    }
}

/**
 * Orquestador para persistir o actualizar datos y propagarlos a los residentes
 */
async function guardarCobro(e) {
    e.preventDefault();
    
    const id = document.getElementById('cobro-id').value;
    const descripcion = document.getElementById('cobro-descripcion').value.trim();
    const monto = parseFloat(document.getElementById('cobro-monto').value);
    const ultimoPago = document.getElementById('cobro-emision').value;
    const proximoVence = document.getElementById('cobro-vence').value;

    const datosCobro = { descripcion, monto, ultimoPago, proximoVence };

    try {
        if (id) {
            // Edición de ciclo preexistente
            const cobroDoc = doc(db, "fechas_cobro", id);
            await updateDoc(cobroDoc, datosCobro);
        } else {
            // Creación de nuevo ciclo
            await addDoc(cobrosRef, datosCobro);
        }

        // PROPAGACIÓN AUTOMÁTICA EN TIEMPO REAL A RESIDENTES
        // Cambia el estado financiero de las viviendas para reflejar las nuevas fechas y montos adeudados
        await propagarCambiosAResidentes(monto, ultimoPago, proximoVence);

        cerrarModal();
        await listarFechasCobro();
        alert("Ciclo de cobro guardado y asignado a las cuentas de los residentes exitosamente.");
    } catch (error) {
        console.error("Error en la transacción del cobro:", error);
        alert("Surgió un inconveniente al guardar en el servidor.");
    }
}

/**
 * Operación por lotes (Batch) para actualizar las propiedades de los residentes sin sobrecargar la red
 */
async function propagarCambiosAResidentes(monto, ultimoPago, proximoVence) {
    try {
        const querySnapshot = await getDocs(residentesRef);
        const batch = writeBatch(db);

        querySnapshot.forEach((residenteDoc) => {
            const residenteRefInstance = doc(db, "residentes", residenteDoc.id);
            
            batch.update(residenteRefInstance, {
                monto: monto,
                montoOriginal: monto,
                ultimoPago: ultimoPago,
                proximoVence: proximoVence,
                estadoPago: 'pendiente'
            });
        });

        await batch.commit();
    } catch (error) {
        console.error("Error en la propagación masiva a residentes:", error);
    }
}

/**
 * Elimina una planificación de cobro de los registros históricos
 */
async function eliminarCobro(id) {
    if (!confirm("¿Está seguro de que desea eliminar este ciclo de facturación? Esto no alterará los montos actuales de los residentes ya emitidos.")) return;
    try {
        const cobroDoc = doc(db, "fechas_cobro", id);
        await deleteDoc(cobroDoc);
        await listarFechasCobro();
    } catch (error) {
        console.error("Error al remover el cobro:", error);
        alert("No se pudo remover el elemento solicitado.");
    }
}

function formatearFecha(fechaISO) {
    if (!fechaISO) return '—';
    const [y, m, d] = fechaISO.split('-');
    return `${d}/${m}/${y}`;
}
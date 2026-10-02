/* === CONFIGURACIÓN FIREBASE === */
const firebaseConfig = {
    apiKey: "AIzaSyALqKuQR6UCfleFPv6lFCu__okW8WgDFrk",
    authDomain: "procesos-andares.firebaseapp.com",
    projectId: "procesos-andares",
    storageBucket: "procesos-andares.firebasestorage.app",
    messagingSenderId: "302005670169",
    appId: "1:302005670169:web:2ce78ae04faaac49ecb588"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();
const secondaryApp = firebase.initializeApp(firebaseConfig, "SecondaryApp");

/* === VERIFICAR SESIÓN ACTIVA Y SEGURIDAD DE FIREBASE === */
const sesionRaw = sessionStorage.getItem('sesionActiva');
if (!sesionRaw) {
    window.location.href = 'Index.html';
}
const sesionEncargado = JSON.parse(sesionRaw);

// Validamos que la sesión coincida con el motor de Firebase Auth
firebase.auth().onAuthStateChanged((user) => {
    if (!user) {
        // Si Firebase dice que no hay nadie logueado, lo regresamos al index
        sessionStorage.removeItem('sesionActiva');
        window.location.href = 'Index.html';
    }
});

// Variables de estado local del flujo de registro
let activeEmpleadoCurrent = null;
let currentRegistroToFree = null;
let funcionEliminarPendiente = null;

document.addEventListener("DOMContentLoaded", () => {
    // BLOQUEAR LETRAS EN FORMULARIOS DEL DASHBOARD (Asignación, Liberación y Altas)
    const inputsDash = ['asig-emp-num', 'asig-emp-nip', 'new-nip-val', 'new-nip-val2', 'libera-emp-nip', 'new-emp-id'];
    inputsDash.forEach(id => {
        const input = document.getElementById(id);
        if(input) {
            input.setAttribute('inputmode', 'numeric');
            input.addEventListener('input', function() {
                this.value = this.value.replace(/[^0-9]/g, '');
            });
        }
    });
    // Configurar interfaz de usuario logueado con formato Nombre, (Puesto)
    document.getElementById('user-display').innerHTML = 
        `<span style="font-size: 14px; font-weight: 600; color: #000;">${sesionEncargado.nombre}, (${sesionEncargado.puesto})</span>`;

    if (sesionEncargado.puesto === 'Admin') {
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'block');
    }

    document.getElementById('btn-cerrar-sesion').addEventListener('click', () => {
        sessionStorage.removeItem('sesionActiva');
        window.location.href = 'Index.html';
    });

    // Ejecutar mantenimiento silencioso de registros
    realizarMantenimientoAutomatico();

    // Cargar listas en tiempo real
    escucharEstadoActivo();
    inicializarSelectorHistorial();

    // Eventos del modal de asignación
    document.getElementById('btn-validar-emp').addEventListener('click', validarEmpleadoRegistro);
    document.getElementById('btn-save-first-nip').addEventListener('click', guardarPrimerNip);
    document.getElementById('select-device-type').addEventListener('change', cargarNumerosDisponibles);
    
    document.getElementById('btn-add-more-device').addEventListener('click', () => registrarDispositivoActual(false));
    document.getElementById('btn-finish-device').addEventListener('click', () => registrarDispositivoActual(true));
    
    document.getElementById('btn-confirm-liberar').addEventListener('click', procesarLiberacion);

    // Evento del modal de confirmación de eliminación
    const btnAccionEliminar = document.getElementById('btn-confirmar-eliminar-accion');
    if (btnAccionEliminar) {
        btnAccionEliminar.addEventListener('click', async () => {
            if (funcionEliminarPendiente) {
                await funcionEliminarPendiente();
                funcionEliminarPendiente = null;
            }
            const modalEl = document.getElementById('confirmarEliminarModal');
            const modalInstance = bootstrap.Modal.getInstance(modalEl);
            if (modalInstance) modalInstance.hide();
        });
    }

    // --- FUNCIONALIDAD DEL MENÚ MÓVIL DESPLEGABLE ---
    const mobileSelect = document.getElementById('mobile-tab-select');
    if (mobileSelect) {
        mobileSelect.addEventListener('change', (e) => {
            const targetId = e.target.value;
            const tabButton = document.querySelector(`button[data-bs-target="${targetId}"]`);
            if (tabButton) {
                const tab = new bootstrap.Tab(tabButton);
                tab.show();
            }
        });

        document.querySelectorAll('button[data-bs-toggle="tab"]').forEach(btn => {
            btn.addEventListener('shown.bs.tab', (e) => {
                mobileSelect.value = e.target.getAttribute('data-bs-target');
            });
        });
    }

    // Formulario Nuevo Empleado (Modal)
    const formNuevoEmp = document.getElementById('form-nuevo-empleado');
    if (formNuevoEmp) {
        formNuevoEmp.addEventListener('submit', async (e) => {
            e.preventDefault();
            const num = document.getElementById('new-emp-id').value.trim();
            const nombre = document.getElementById('new-emp-nombre').value.trim().toUpperCase();
            const apellido = document.getElementById('new-emp-apellido').value.trim().toUpperCase();
            const puesto = document.getElementById('new-emp-puesto').value;

            await db.collection('Plantilla').doc(num).set({
                nombre: nombre,
                apellido: apellido,
                puesto: puesto,
                nip: "",
                primer_ingreso: true
            });

            formNuevoEmp.reset();
            const modalEl = document.getElementById('nuevoEmpleadoModal');
            const modalInstance = bootstrap.Modal.getInstance(modalEl);
            if (modalInstance) modalInstance.hide();
        });
    }

    // Formulario Editar Empleado (Modal)
    const formEditarEmp = document.getElementById('form-editar-empleado');
    if (formEditarEmp) {
        formEditarEmp.addEventListener('submit', async (e) => {
            e.preventDefault();

            const id = document.getElementById('edit-emp-id').value;
            const nombre = document.getElementById('edit-emp-nombre').value.trim().toUpperCase();
            const apellido = document.getElementById('edit-emp-apellido').value.trim().toUpperCase();
            const puesto = document.getElementById('edit-emp-puesto').value;
            const debeResetearNip = document.getElementById('edit-emp-reset-nip').checked;

            const datosActualizar = {
                nombre: nombre,
                apellido: apellido,
                puesto: puesto
            };

            if (debeResetearNip) {
                datosActualizar.nip = "";
                datosActualizar.primer_ingreso = true;
            }

            await db.collection('Plantilla').doc(id).update(datosActualizar);

            const modalEl = document.getElementById('editarEmpleadoModal');
            const modalInstance = bootstrap.Modal.getInstance(modalEl);
            if (modalInstance) modalInstance.hide();
        });
    }

    // Formulario Nuevo Dispositivo (Modal)
    const formNuevoDev = document.getElementById('form-nuevo-dispositivo');
    if (formNuevoDev) {
        formNuevoDev.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nombre = document.getElementById('new-dev-nombre').value.trim();
            const cantidad = parseInt(document.getElementById('new-dev-cantidad').value);

            await db.collection('Dispositivos').add({
                nombre: nombre,
                cantidad: cantidad
            });

            formNuevoDev.reset();
            const modalEl = document.getElementById('nuevoDispositivoModal');
            const modalInstance = bootstrap.Modal.getInstance(modalEl);
            if (modalInstance) modalInstance.hide();
        });
    }

    // Formulario Editar Dispositivo (Modal)
    const formEditarDev = document.getElementById('form-editar-dispositivo');
    if (formEditarDev) {
        formEditarDev.addEventListener('submit', async (e) => {
            e.preventDefault();
            const docId = document.getElementById('edit-dev-id').value;
            const nombre = document.getElementById('edit-dev-nombre').value.trim();
            const cantidad = parseInt(document.getElementById('edit-dev-cantidad').value);

            await db.collection('Dispositivos').doc(docId).update({
                nombre: nombre,
                cantidad: cantidad
            });

            const modalEl = document.getElementById('editarDispositivoModal');
            const modalInstance = bootstrap.Modal.getInstance(modalEl);
            if (modalInstance) modalInstance.hide();
        });
    }
});

/* === MÓDULO 1: LECTURA EN TIEMPO REAL (REGISTROS ACTIVOS) === */
function escucharEstadoActivo() {
    db.collection('Estado').onSnapshot(snapshot => {
        const tbody = document.getElementById('tabla-activos-body');
        tbody.innerHTML = '';

        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">No hay dispositivos registrados en uso actualmente.</td></tr>';
            return;
        }

        snapshot.forEach(doc => {
            const item = doc.data();
            const dateObj = item.hora_inicio ? item.hora_inicio.toDate() : new Date();
// Agregamos hour12: false para forzar el formato 24 hrs
const horaStr = dateObj.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });

const tr = document.createElement('tr');
tr.innerHTML = `
    <td><strong>${item.empleado_nombre}</strong></td>
    <td>${item.dispositivo}</td>
    <td style="font-weight: 600;">#${item.numero_asignado}</td>
    <td>${horaStr}</td>
    <td>${item.encargado_asigna}</td>
                <td>
                    <button class="btn-guardar" style="padding: 4px 10px; font-size: 11px;" 
                        onclick="abrirModalLiberar('${doc.id}', '${item.empleado_nombre}', '${item.numero_empleado}', '${item.dispositivo}', ${item.numero_asignado})">
                        Liberar
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    });
}

/* === MÓDULO 1.1: HISTORIAL FILTRADO POR DÍA === */
function inicializarSelectorHistorial() {
    const select = document.getElementById('select-fecha-historial');
    if (!select) return;
    select.innerHTML = '';

    const hoy = new Date();
    
    for (let i = 0; i < 7; i++) {
        const fecha = new Date();
        fecha.setDate(hoy.getDate() - i);

        const yyyy = fecha.getFullYear();
        const mm = String(fecha.getMonth() + 1).padStart(2, '0');
        const dd = String(fecha.getDate()).padStart(2, '0');
        const fechaValor = `${yyyy}-${mm}-${dd}`;

        const opcionesFecha = { weekday: 'short', day: 'numeric', month: 'short' };
        let fechaTexto = fecha.toLocaleDateString('es-MX', opcionesFecha);
        if (i === 0) fechaTexto += ' (Hoy)';
        if (i === 1) fechaTexto += ' (Ayer)';

        select.innerHTML += `<option value="${fechaValor}">${fechaTexto}</option>`;
    }

    select.addEventListener('change', (e) => {
        consultarHistorialPorDia(e.target.value);
    });

    consultarHistorialPorDia(select.value);
}

let unsubscribeHistorial = null;

function consultarHistorialPorDia(fechaYYYYMMDD) {
    if (unsubscribeHistorial) unsubscribeHistorial();

    const inicioDia = new Date(`${fechaYYYYMMDD}T00:00:00`);
    const finDia = new Date(`${fechaYYYYMMDD}T23:59:59`);

    const tbody = document.getElementById('tabla-historial-body');
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">Cargando registros...</td></tr>';

    unsubscribeHistorial = db.collection('Historial')
        .where('hora_inicio', '>=', inicioDia)
        .where('hora_inicio', '<=', finDia)
        .orderBy('hora_inicio', 'desc')
        .onSnapshot(snapshot => {
            tbody.innerHTML = '';

            if (snapshot.empty) {
                tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">No hay registros de entregas para este día.</td></tr>';
                return;
            }

            snapshot.forEach(doc => {
                const item = doc.data();
                const dIni = item.hora_inicio ? item.hora_inicio.toDate().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false }) : '-';
                const dFin = item.hora_fin ? item.hora_fin.toDate().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false }) : '24:00';

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${item.empleado_nombre}</td>
                    <td>${item.dispositivo}</td>
                    <td style="font-weight: 600;">#${item.numero_asignado}</td>
                    <td style="font-size: 13px;">${dIni}</td>
                    <td style="font-size: 13px;">${dFin}</td>
                    <td>${item.encargado_asigna}</td>
                    <td>${item.encargado_libera || '<span class="text-muted">Auto</span>'}</td>
                `;
                tbody.appendChild(tr);
            });
        }, error => {
            console.error("Error al consultar historial:", error);
            tbody.innerHTML = '<tr><td colspan="7" class="text-center text-danger py-4">Error al cargar datos.</td></tr>';
        });
}

/* === MÓDULO 2: FLUJO DE ASIGNACIÓN === */
async function validarEmpleadoRegistro() {
    const num = document.getElementById('asig-emp-num').value.trim();
    const nip = document.getElementById('asig-emp-nip').value.trim();
    const errDiv = document.getElementById('asig-auth-error');
    errDiv.style.display = 'none';

    if (!num) { showErr(errDiv, 'Ingresa el número de empleado.'); return; }

    const docSnap = await db.collection('Plantilla').doc(num).get();
    if (!docSnap.exists) { showErr(errDiv, 'El empleado no existe en la plantilla.'); return; }

    const empData = docSnap.data();

    if (empData.primer_ingreso) {
        activeEmpleadoCurrent = { id: num, data: empData };
        document.getElementById('step-auth').style.display = 'none';
        document.getElementById('step-first-nip').style.display = 'block';
        return;
    }

// Validamos silenciosamente con la app secundaria
const correoFicticio = `${num}@andares.com`;
try {
    await secondaryApp.auth().signInWithEmailAndPassword(correoFicticio, nip);
    await secondaryApp.auth().signOut(); // Cerramos la sesión secundaria de inmediato
} catch (error) {
    showErr(errDiv, 'NIP de empleado incorrecto.');
    return;
}

    activeEmpleadoCurrent = { id: num, data: empData };
    iniciarSeleccionDispositivo();
}

async function guardarPrimerNip() {
    const newNip = document.getElementById('new-nip-val').value.trim();
    const confirmNip = document.getElementById('new-nip-val2').value.trim();
    const errDiv = document.getElementById('asig-auth-error');
    
    errDiv.style.display = 'none';

    if (newNip.length !== 6) { 
        showErr(errDiv, 'El NIP debe tener 6 dígitos.');
        return; 
    }
    if (newNip !== confirmNip) {
        showErr(errDiv, 'Las contraseñas no coinciden. Intenta de nuevo.');
        return;
    }
    try {
        const correoFicticio = `${activeEmpleadoCurrent.id}@andares.com`;
        // Registramos al usuario en Auth usando la app secundaria
        await secondaryApp.auth().createUserWithEmailAndPassword(correoFicticio, newNip);
        await secondaryApp.auth().signOut();

        await db.collection('Plantilla').doc(activeEmpleadoCurrent.id).update({
            nip: "",
            primer_ingreso: false
        });

        activeEmpleadoCurrent.data.nip = "";
        activeEmpleadoCurrent.data.primer_ingreso = false;
    } catch (error) {
        showErr(document.getElementById('asig-auth-error'), 'Error al registrar NIP.');
        return;
    }

    document.getElementById('step-first-nip').style.display = 'none';
    iniciarSeleccionDispositivo();
}

async function iniciarSeleccionDispositivo() {
    document.getElementById('step-auth').style.display = 'none';
    document.getElementById('step-device').style.display = 'block';
    document.getElementById('selected-emp-name').innerText = 
        `${activeEmpleadoCurrent.data.nombre} ${activeEmpleadoCurrent.data.apellido}`;

    const snapDevs = await db.collection('Dispositivos').get();
    const selectType = document.getElementById('select-device-type');
    selectType.innerHTML = '';

    snapDevs.forEach(doc => {
        const dev = doc.data();
        selectType.innerHTML += `<option value="${dev.nombre}" data-cantidad="${dev.cantidad}">${dev.nombre}</option>`;
    });

    cargarNumerosDisponibles();
}

async function cargarNumerosDisponibles() {
    const selectType = document.getElementById('select-device-type');
    if (!selectType.options.length) return;

    const devNombre = selectType.value;
    const cantidadTotal = parseInt(selectType.options[selectType.selectedIndex].dataset.cantidad);

    const snapEstado = await db.collection('Estado').where('dispositivo', '==', devNombre).get();
    const ocupados = [];
    snapEstado.forEach(doc => ocupados.push(doc.data().numero_asignado));

    const selectNum = document.getElementById('select-device-num');
    selectNum.innerHTML = '';

    for (let i = 1; i <= cantidadTotal; i++) {
        const isOcupado = ocupados.includes(i);
        if (isOcupado) {
            selectNum.innerHTML += `<option value="${i}" disabled style="color: #bbb;">${i} (En Uso)</option>`;
        } else {
            selectNum.innerHTML += `<option value="${i}">${i}</option>`;
        }
    }
}

async function registrarDispositivoActual(esFinalizar) {
    const dispositivo = document.getElementById('select-device-type').value;
    const numero_asignado = parseInt(document.getElementById('select-device-num').value);

    if (!numero_asignado) {
        return;
    }

    await db.collection('Estado').add({
        numero_empleado: activeEmpleadoCurrent.id,
        empleado_nombre: `${activeEmpleadoCurrent.data.nombre} ${activeEmpleadoCurrent.data.apellido}`,
        dispositivo: dispositivo,
        numero_asignado: numero_asignado,
        hora_inicio: firebase.firestore.FieldValue.serverTimestamp(),
        encargado_asigna: sesionEncargado.nombre
    });

    if (!esFinalizar) {
        document.getElementById('step-device').style.display = 'none';
        iniciarSeleccionDispositivo();
    } else {
        const modalEl = document.getElementById('asignarModal');
        const modalInstance = bootstrap.Modal.getInstance(modalEl);
        modalInstance.hide();
        resetModalAsignar();
    }
}

function resetModalAsignar() {
    activeEmpleadoCurrent = null;
    document.getElementById('step-auth').style.display = 'block';
    document.getElementById('step-first-nip').style.display = 'none';
    document.getElementById('step-device').style.display = 'none';
    document.getElementById('asig-emp-num').value = '';
    document.getElementById('asig-emp-nip').value = '';
    document.getElementById('new-nip-val').value = '';
    document.getElementById('new-nip-val2').value = ''; 
}

/* === MÓDULO 3: LIBERACIÓN DE DISPOSITIVOS === */
function abrirModalLiberar(docId, empNombre, empNum, dispositivo, numAsig) {
    currentRegistroToFree = { docId, empNum, empNombre, dispositivo, numAsig };
    document.getElementById('libera-info-txt').innerText = 
        `Liberando ${dispositivo} ${numAsig} de ${empNombre}.`;
    document.getElementById('libera-emp-nip').value = '';
    document.getElementById('libera-error').style.display = 'none';
    
    const modal = new bootstrap.Modal(document.getElementById('liberarModal'));
    modal.show();
}

async function procesarLiberacion() {
    const nip = document.getElementById('libera-emp-nip').value.trim();
    const errDiv = document.getElementById('libera-error');
    errDiv.style.display = 'none';

    const empSnap = await db.collection('Plantilla').doc(currentRegistroToFree.empNum).get();
    if (!empSnap.exists) {
        showErr(errDiv, 'El empleado no existe.');
        return;
    }

    const correoFicticio = `${currentRegistroToFree.empNum}@andares.com`;
    try {
        await secondaryApp.auth().signInWithEmailAndPassword(correoFicticio, nip);
        await secondaryApp.auth().signOut();
    } catch (error) {
        showErr(errDiv, 'NIP de confirmación incorrecto.');
        return;
    }

    const docEstadoRef = db.collection('Estado').doc(currentRegistroToFree.docId);
    const docSnap = await docEstadoRef.get();
    
    if (docSnap.exists) {
        const data = docSnap.data();

        await db.collection('Historial').add({
            ...data,
            hora_fin: firebase.firestore.FieldValue.serverTimestamp(),
            encargado_libera: sesionEncargado.nombre
        });

        await docEstadoRef.delete();
    }

    const modalEl = document.getElementById('liberarModal');
    const modalInstance = bootstrap.Modal.getInstance(modalEl);
    modalInstance.hide();
}

function showErr(element, text) {
    element.innerText = text;
    element.style.display = 'block';
}

/* === MÓDULO 4: MANTENIMIENTO AUTOMÁTICO (Cierre y Limpieza) === */
async function realizarMantenimientoAutomatico() {
    try {
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0); 

        const batch = db.batch();
        let operaciones = 0;

        const estadoSnap = await db.collection('Estado').get();
        estadoSnap.forEach(doc => {
            const data = doc.data();
            const fechaRegistro = data.hora_inicio ? data.hora_inicio.toDate() : new Date();
            
            if (fechaRegistro < hoy) {
                const histRef = db.collection('Historial').doc();
                batch.set(histRef, {
                    ...data,
                    hora_fin: null,
                    encargado_libera: ""
                });
                batch.delete(doc.ref);
                operaciones++;
            }
        });

        const limiteDias = new Date();
        limiteDias.setDate(limiteDias.getDate() - 8);
        
        const histSnap = await db.collection('Historial')
            .where('hora_inicio', '<', limiteDias)
            .get();
            
        histSnap.forEach(doc => {
            batch.delete(doc.ref);
            operaciones++;
        });

        if (operaciones > 0) {
            await batch.commit();
        }
    } catch (error) {
        console.error("Error en mantenimiento automático:", error);
    }
}

/* === MÓDULO 5: GESTIÓN DE PLANTILLA Y EQUIPOS (ADMIN) === */
if (sesionEncargado.puesto === 'Admin') {
    // Escuchar cambios en Plantilla
    db.collection('Plantilla').onSnapshot(snapshot => {
        const tbody = document.getElementById('tabla-plantilla-body');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-4">No hay empleados registrados.</td></tr>';
            return;
        }

        snapshot.forEach(doc => {
            const emp = doc.data();
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${doc.id}</td>
                <td>${emp.nombre} ${emp.apellido}</td>
                <td style="font-weight: 600;">${emp.puesto}</td>
                <td>
                    <button class="btn-guardar" style="padding: 3px 8px; font-size: 10px;" onclick="abrirModalEditarEmpleado('${doc.id}', '${emp.nombre}', '${emp.apellido}', '${emp.puesto}')">Editar</button>
                    <button class="btn-guardar" style="padding: 3px 8px; font-size: 10px; border-color: var(--red-alert); color: var(--red-alert);" onclick="eliminarEmpleadoAdmin('${doc.id}', '${emp.nombre}', '${emp.apellido}')">Eliminar</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    });

    // Escuchar cambios en Dispositivos
    db.collection('Dispositivos').onSnapshot(snapshot => {
        const tbody = document.getElementById('tabla-dispositivos-body');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted py-4">No hay equipos registrados.</td></tr>';
            return;
        }

        snapshot.forEach(doc => {
            const dev = doc.data();
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${dev.nombre}</td>
                <td><strong>${dev.cantidad}</strong>    </td>
                <td>
                    <button class="btn-guardar" style="padding: 3px 8px; font-size: 10px;" onclick="abrirModalEditarEquipo('${doc.id}', '${dev.nombre}', ${dev.cantidad})">Editar</button>
                    <button class="btn-guardar" style="padding: 3px 8px; font-size: 10px; border-color: var(--red-alert); color: var(--red-alert);" onclick="eliminarEquipoAdmin('${doc.id}', '${dev.nombre}')">Eliminar</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    });
}

/* === MODALES DE ACCIÓN === */
window.abrirModalEditarEmpleado = function(id, nombre, apellido, puesto) {
    document.getElementById('edit-emp-id').value = id;
    document.getElementById('edit-emp-id-display').value = id;
    document.getElementById('edit-emp-nombre').value = nombre;
    document.getElementById('edit-emp-apellido').value = apellido;
    document.getElementById('edit-emp-puesto').value = puesto;
    document.getElementById('edit-emp-reset-nip').checked = false;

    const modal = new bootstrap.Modal(document.getElementById('editarEmpleadoModal'));
    modal.show();
};

window.abrirModalEditarEquipo = function(docId, nombre, cantidad) {
    document.getElementById('edit-dev-id').value = docId;
    document.getElementById('edit-dev-nombre').value = nombre;
    document.getElementById('edit-dev-cantidad').value = cantidad;

    const modal = new bootstrap.Modal(document.getElementById('editarDispositivoModal'));
    modal.show();
};

function mostrarModalEliminar(mensaje, callbackAccion) {
    document.getElementById('confirmar-eliminar-texto').innerText = mensaje;
    funcionEliminarPendiente = callbackAccion;
    
    const modal = new bootstrap.Modal(document.getElementById('confirmarEliminarModal'));
    modal.show();
}

window.eliminarEmpleadoAdmin = function(idEmpleado, nombre, apellido) {
    mostrarModalEliminar(`¿Estás seguro de eliminar a ${nombre} ${apellido}? Esta acción no se puede deshacer.`, async () => {
        await db.collection('Plantilla').doc(idEmpleado).delete();
    });
};

window.eliminarEquipoAdmin = function(docId, nombre) {
    mostrarModalEliminar(`¿Estás seguro de eliminar el equipo "${nombre}" del inventario? Esta acción no se puede deshacer.`, async () => {
        await db.collection('Dispositivos').doc(docId).delete();
    });
};

/* === CONFIGURACIÓN DE FIREBASE === */

const firebaseConfig = {
    apiKey: "AIzaSyALqKuQR6UCfleFPv6lFCu__okW8WgDFrk",
    authDomain: "procesos-andares.firebaseapp.com",
    projectId: "procesos-andares",
    storageBucket: "procesos-andares.firebasestorage.app",
    messagingSenderId: "302005670169",
    appId: "1:302005670169:web:2ce78ae04faaac49ecb588"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

/* === LÓGICA DE INICIO DE SESIÓN === */
document.addEventListener("DOMContentLoaded", () => {
    // BLOQUEAR LETRAS EN FORMULARIOS DE LOGIN
    const inputsLogin = ['empNumero', 'empNip', 'newNip1', 'newNip2'];
    inputsLogin.forEach(id => {
        const input = document.getElementById(id);
        if(input) {
            input.setAttribute('inputmode', 'numeric'); // Fuerza el teclado numérico en móviles
            input.addEventListener('input', function() {
                this.value = this.value.replace(/[^0-9]/g, ''); // Elimina automáticamente letras y símbolos
            });
        }
    });
    const loginForm = document.getElementById('loginForm');
    const loginError = document.getElementById('loginError');
    const step1 = document.getElementById('login-step-1');
    const step2 = document.getElementById('login-step-2');
    const btnIngresar2 = document.getElementById('btn-ingresar-2');
    
    let activeLoginId = null;
    let activeLoginEmp = null;

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            loginError.style.display = 'none';

            // Validar Paso 1
            if (step1.style.display !== 'none') {
                const numEmpleado = document.getElementById('empNumero').value.trim();
                const nip = document.getElementById('empNip').value.trim();
                const correoFicticio = `${numEmpleado}@andares.com`;

                try {
                    const docRef = db.collection('Plantilla').doc(numEmpleado);
                    const docSnap = await docRef.get();

                    if (docSnap.exists) {
                        const datosEmpleado = docSnap.data();

                        // Autorizar acceso a Admin, Encargado y Op
                        if (datosEmpleado.puesto === 'Admin' || datosEmpleado.puesto === 'Encargado' || datosEmpleado.puesto === 'Op') {
                            
                            // Si es su primera vez, lo mandamos al paso 2
                            if (datosEmpleado.primer_ingreso) {
                                activeLoginId = numEmpleado;
                                activeLoginEmp = datosEmpleado;
                                step1.style.display = 'none';
                                step2.style.display = 'block';
                                // Hacemos que el NIP normal deje de ser "required" para que no bloquee el formulario
                                document.getElementById('empNip').removeAttribute('required');
                                return;
                            }

                  // Si NO es primera vez, validar NIP con Firebase Auth
                  const correoFicticio = `${numEmpleado}@andares.com`;
                  try {
                      await firebase.auth().signInWithEmailAndPassword(correoFicticio, nip);
                      
                      sessionStorage.setItem('sesionActiva', JSON.stringify({
                          numero: numEmpleado,
                          nombre: datosEmpleado.nombre,
                          puesto: datosEmpleado.puesto
                      }));
                      window.location.href = 'dashboard.html';
                  } catch (error) {
                      loginError.innerText = "NIP incorrecto.";
                      loginError.style.display = 'block';
                  }
                        } else {
                            loginError.innerText = "Acceso denegado. Se requieren permisos especiales.";
                            loginError.style.display = 'block';
                        }
                    } else {
                        loginError.innerText = "El número de empleado no está registrado.";
                        loginError.style.display = 'block';
                    }
                } catch (error) {
                    console.error("Error al iniciar sesión:", error);
                    loginError.innerText = "Error de conexión con la base de datos.";
                    loginError.style.display = 'block';
                }
            }
        });
        
        // Validar Paso 2 (Crear y guardar nuevo NIP)
        if (btnIngresar2) {
            btnIngresar2.addEventListener('click', async () => {
                const nip1 = document.getElementById('newNip1').value.trim();
                const nip2 = document.getElementById('newNip2').value.trim();
                loginError.style.display = 'none';

                if (nip1.length !== 6) {
                    loginError.innerText = "El NIP debe tener 6 dígitos.";
                    loginError.style.display = 'block';
                    return;
                }

                if (nip1 !== nip2) {
                    loginError.innerText = "Las contraseñas no coinciden. Intenta de nuevo.";
                    loginError.style.display = 'block';
                    return;
                }

                try {
                    // Creamos el correo ficticio para Firebase Auth
                    const correoFicticio = `${activeLoginId}@andares.com`;
                    
                    // 1. Registramos al usuario de forma segura en Firebase
                    await auth.createUserWithEmailAndPassword(correoFicticio, nip1);

                    // 2. Actualizamos Firestore (ya no guardamos el nip como texto plano)
                    await db.collection('Plantilla').doc(activeLoginId).update({
                        nip: "", 
                        primer_ingreso: false
                    });

                    // 3. Guardamos sesión local para la UI y redirigimos
                    sessionStorage.setItem('sesionActiva', JSON.stringify({
                        numero: activeLoginId,
                        nombre: activeLoginEmp.nombre,
                        puesto: activeLoginEmp.puesto
                    }));
                    window.location.href = 'dashboard.html';
                } catch (error) {
                    console.error("Error al guardar contraseña en Auth:", error);
                    loginError.innerText = "Error al registrar el NIP en el sistema.";
                    loginError.style.display = 'block';
                }
            });
        }
    }
});
// Escuchador para el cambio de estación (Verano / Invierno) con Animación
const seasonToggle = document.getElementById('season-toggle');
if (seasonToggle) {
    seasonToggle.addEventListener('change', () => {
        // 1. Forzar el recálculo de las tablas del camión
        document.querySelectorAll('.calc-input').forEach(input => {
            if(input.value) { 
                input.dispatchEvent(new Event('input'));
            }
        });
        
        // 2. Disparar la animación de partículas
        lanzarEfectoEstacion();
    });
}

// Función encargada de crear la lluvia de hojas o nieve
function lanzarEfectoEstacion() {
    const esInvierno = document.getElementById('season-toggle').checked;
    
    // Limpiar partículas viejas si el usuario clickea muy rápido
    document.querySelectorAll('.estacion-particula').forEach(p => p.remove());
    
    // Definimos los símbolos a usar según la temporada
    const simbolos = esInvierno ? ['❄', '❅', '❆', '•'] : ['🍂', '🍁', '🍃'];
    const cantidad = 30; // Número de elementos que caerán

    for (let i = 0; i < cantidad; i++) {
        const particula = document.createElement('div');
        particula.className = 'estacion-particula';
        
        // Selecciona un símbolo al azar de la lista
        particula.innerText = simbolos[Math.floor(Math.random() * simbolos.length)];
        
        // Generamos variaciones aleatorias para que se vea natural y orgánico
        const posicionIzquierda = Math.random() * 100; // En qué parte horizontal de la pantalla inicia
        const duracion = Math.random() * 3 + 2.5;     // Tiempo en caer (entre 2.5 y 5.5 segundos)
        const retraso = Math.random() * 1.5;          // Retraso para que no caigan todas al mismo tiempo
        const tamano = esInvierno ? (Math.random() * 14 + 10) : (Math.random() * 18 + 14); // Tamaño en px
        
        // Aplicamos los estilos aleatorios directamente
        particula.style.left = `${posicionIzquierda}%`;
        particula.style.animationDuration = `${duracion}s`;
        particula.style.animationDelay = `${retraso}s`;
        particula.style.fontSize = `${tamano}px`;
        
        // Si es invierno, le damos un sutil brillo blanco para que resalte en el fondo oscuro
        if (esInvierno) {
            particula.style.color = '#ffffff';
            particula.style.textShadow = '0 0 5px rgba(255,255,255,0.6)';
        }

        document.body.appendChild(particula);

        // Al terminar su animación, el navegador la elimina automáticamente para no consumir memoria
        particula.addEventListener('animationend', () => {
            particula.remove();
        });
    }
}

/* === LÓGICA DE FECHA DINÁMICA DE COMPARACIÓN (INLINE) === */
const cmDiasInput = document.getElementById('cm-dias-input');
const cmFechaHoy = document.getElementById('cm-fecha-hoy');
const cmFechaPasada = document.getElementById('cm-fecha-pasada');

function actualizarFechasInline() {
    const dias = parseInt(cmDiasInput.value) || 0;
    const hoy = new Date();
    
    // 1. Calcular y formatear la fecha de hoy
    const ddHoy = String(hoy.getDate()).padStart(2, '0');
    const mmHoy = String(hoy.getMonth() + 1).padStart(2, '0');
    const yyyyHoy = hoy.getFullYear();
    const fechaHoyFormateada = `${ddHoy}/${mmHoy}/${yyyyHoy}`;
    cmFechaHoy.textContent = fechaHoyFormateada;
    
    // 2. Calcular y formatear la fecha pasada
    const fechaPasada = new Date();
    fechaPasada.setDate(hoy.getDate() - dias);
    const ddPasada = String(fechaPasada.getDate()).padStart(2, '0');
    const mmPasada = String(fechaPasada.getMonth() + 1).padStart(2, '0');
    const yyyyPasada = fechaPasada.getFullYear();
    const fechaPasadaFormateada = `${ddPasada}/${mmPasada}/${yyyyPasada}`;
    cmFechaPasada.textContent = fechaPasadaFormateada;

    // 3. ACTUALIZAR LOS ENCABEZADOS DE TODAS LAS TABLAS
    document.querySelectorAll('.th-fecha-pasada').forEach(th => {
        th.textContent = fechaPasadaFormateada;
    });
    document.querySelectorAll('.th-fecha-hoy').forEach(th => {
        th.textContent = fechaHoyFormateada;
    });
}

if(cmDiasInput) {
    cmDiasInput.addEventListener('input', actualizarFechasInline);
    actualizarFechasInline();
}

/* === LÓGICA GENERADOR QR === */
const btnGenerarQR = document.getElementById('btn-generar-qr');
const qrcodeDisplay = document.getElementById('qrcode-display');
const qrResultadoTexto = document.getElementById('qr-resultado-texto');
const qrResultArea = document.getElementById('qr-result-area');

if(btnGenerarQR) {
    btnGenerarQR.addEventListener('click', () => {
        const apartadoSufijo = document.getElementById('qr-apartado').value;
        const posicionInput = document.getElementById('qr-posicion').value;

        // Validación simple
        if (!posicionInput || posicionInput <= 0) {
            alert("Por favor, ingresa un número de posición válido.");
            return;
        }

        // Formatear a 3 dígitos y armar la clave
        // Formatear para que la posición siempre ocupe 5 espacios, rellenando con ceros a la izquierda
        const posicionPadded = posicionInput.toString().padStart(5, '0');
        const claveFinal = `${posicionPadded}${apartadoSufijo}`;

        // Limpiar y mostrar el área de resultado
        qrcodeDisplay.innerHTML = "";
        qrResultArea.style.display = "flex"; 

        // Determinar el color del código QR
        // "01" (Señora) = Rojo fuerte | "02" (Caballero) = Azul profundo
        const colorQr = apartadoSufijo === "01" ? "#cc0000" : "#0055cc";

        // Generar QR con el color seleccionado
        new QRCode(qrcodeDisplay, {
            text: claveFinal,
            width: 200,
            height: 200,
            colorDark : colorQr,
            colorLight : "#ffffff",
            correctLevel : QRCode.CorrectLevel.H
        });

        // Mostrar el texto (también le aplicamos el color para que combine)
        qrResultadoTexto.innerText = claveFinal;
        qrResultadoTexto.style.color = colorQr;
    });
}

/* === PANTALLA DE CARGA === */
setTimeout(() => {
    const splash = document.getElementById("splash-screen");
    if (splash) {
        splash.classList.add("fade-out");
    }
}, 2000); // 2000 milisegundos = 2 segundos

document.addEventListener("DOMContentLoaded", () => {

/* === ANIMACIÓN SCROLL HERO === */
const heroText = document.getElementById('hero-text');
const topbar = document.getElementById('top');

window.addEventListener('scroll', () => {
    // Cuando baje más de 50px se activa la animación
    if (window.scrollY > 50) {
        if(heroText) heroText.classList.add('scrolled');
        if(topbar) topbar.classList.add('scrolled');
    } else {
        if(heroText) heroText.classList.remove('scrolled');
        if(topbar) topbar.classList.remove('scrolled');
    }
});

/* === MENÚ Y NAVEGACIÓN === */
const menuBtn = document.getElementById("menu-btn");
const sidebar = document.getElementById("sidebar");
const overlay = document.getElementById("menu-overlay");
function openMenu() { sidebar.classList.add("open"); overlay.classList.add("show"); }
function closeMenu() { sidebar.classList.remove("open"); overlay.classList.remove("show"); }
menuBtn.addEventListener("click", (e) => { e.stopPropagation(); if (sidebar.classList.contains("open")) closeMenu(); else openMenu(); });
overlay.addEventListener("click", () => closeMenu());
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeMenu(); });
sidebar.querySelectorAll("a[data-scroll-to]").forEach(link => {
    link.addEventListener("click", (ev) => {
    ev.preventDefault(); const target = link.getAttribute("href"); closeMenu();
    setTimeout(() => {
        const el = document.querySelector(target);
        if(el) { const top = Math.max(0, el.getBoundingClientRect().top + window.pageYOffset - 20); window.scrollTo({ top, behavior: "smooth" }); }
    }, 180);
    });
});

/* === LÓGICA TABS 3D FLIP === */
const tabBtnsArr = Array.from(document.querySelectorAll('.tab-btn'));
const tabs = ['total', 'espana', 'mexico'];
let currentTabIndex = 0;
let currentRot = 0;
let flipTimeout;

tabBtnsArr.forEach((btn, index) => {
    btn.addEventListener('click', () => {
    if (index === currentTabIndex) return;

    // Actualizar visual de los botones
    tabBtnsArr.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // Calcular dirección. Derecha a Izquierda = girar a la izquierda (-1), Izquierda a Derecha = girar a la derecha (1)
    const diff = index - currentTabIndex;
    const direction = diff > 0 ? -1 : 1; 
    currentRot += direction * 180;

    const targetTabName = tabs[index];
    clearTimeout(flipTimeout);

    ['senora', 'caballero'].forEach(side => {
        const targetFace = document.getElementById(`${side}-${targetTabName}`);
        const inner = document.getElementById(`inner-${side}`);

        // 1. Preparar la cara objetivo para que esté alineada con el contenedor ANTES de girar
        targetFace.style.display = 'block';
        targetFace.style.transform = `rotateY(${currentRot}deg)`;

        // Forzar un reflow para que el display:block asiente antes de la transición CSS
        void targetFace.offsetWidth;

        // 2. Girar el contenedor completo 180 grados
        inner.style.transform = `rotateY(${currentRot}deg)`;
    });

    // 3. Limpiar caras ocultas exactamente al terminar la animación (0.8s) para no estorbar
    flipTimeout = setTimeout(() => {
        ['senora', 'caballero'].forEach(side => {
        tabs.forEach((t, i) => {
            if (i !== index) {
            document.getElementById(`${side}-${t}`).style.display = 'none';
            }
        });
        });
    }, 800);

    currentTabIndex = index;
    });
});

// Fórmulas matemáticas
function redondear(valor){ return Math.round(Number(valor)); }

function calcularSenora(unidades){
    const switchEstacion = document.getElementById('season-toggle');
    const divisorEstacion = (switchEstacion && switchEstacion.checked) ? 25 : 35;
    
    const u = Number(unidades) || 0; 
    return {
        buffer: redondear((u * 0.7) / divisorEstacion / 5), 
        piso: redondear((u * 0.3) / divisorEstacion / 4)
    };
}

function calcularCaballero(unidades){
    const switchEstacion = document.getElementById('season-toggle');
    const divisorEstacion = (switchEstacion && switchEstacion.checked) ? 20 : 30;
    
    const u = Number(unidades) || 0; 
    return {
        buffer: redondear((u * 0.7) / divisorEstacion / 5), 
        piso: redondear((u * 0.3) / divisorEstacion / 4)
    };
}

// Actualiza los números visuales en pantalla
function actualizarCantidades(tab, side, unidades) {
    let calcs = side === 'senora' ? calcularSenora(unidades) : calcularCaballero(unidades);
    document.getElementById(`${side}-buffer-${tab}`).textContent = isFinite(calcs.buffer) ? calcs.buffer : 0;
    document.getElementById(`${side}-piso-${tab}`).textContent = isFinite(calcs.piso) ? calcs.piso : 0;
}

// Suma España y México y lo manda a Total
function syncTotales(side) {
    const valEspana = Number(document.getElementById(`${side}-input-espana`).value) || 0;
    const valMexico = Number(document.getElementById(`${side}-input-mexico`).value) || 0;
    const suma = valEspana + valMexico;

    const inputTotal = document.getElementById(`${side}-input-total`);
    inputTotal.value = suma > 0 ? suma : ""; 
    actualizarCantidades('total', side, suma);
}

// Escucha cada vez que se escribe en un input
document.querySelectorAll('.calc-input').forEach(input => {
    input.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/[^0-9.]/g,''); // Evita letras
        const val = Number(e.target.value) || 0;
        const tab = e.target.dataset.tab;
        const side = e.target.dataset.side;

        // Actualiza la pestaña en la que estás escribiendo
        actualizarCantidades(tab, side, val);

        // Si estás en España o México, actualiza el Total en segundo plano
        if (tab === 'espana' || tab === 'mexico') {
            syncTotales(side);
        }
    });
});

/* =========================================
    LÓGICA GENERAR PDF (AMBAS SECCIONES)
    ========================================= */
    
// 1. PDF MATERIAL DE CAMIÓN
const btnGuardarPdf = document.getElementById("btn-guardar-pdf");
if(btnGuardarPdf) {
    btnGuardarPdf.addEventListener("click", () => {
        // Llamamos a la librería directamente para evitar conflictos
        const doc = new window.jspdf.jsPDF();

        doc.setFillColor(17, 17, 17);
        doc.rect(0, 0, 210, 45, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(22);
        doc.text("MATERIAL DE CAMIÓN", 105, 22, { align: "center" });
        
        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        const dateStr = document.getElementById("cm-fecha-hoy") ? document.getElementById("cm-fecha-hoy").textContent : new Date().toLocaleDateString('es-MX');
        doc.text(`PULL&BEAR ANDARES 5344   |   Fecha: ${dateStr}`, 105, 32, { align: "center" });

        doc.setTextColor(0, 0, 0); 
        let y = 60; 

        const tabsToExport = [
            { id: 'total', title: 'TOTAL GENERAL' },
            { id: 'espana', title: 'ESPAÑA' },
            { id: 'mexico', title: 'MÉXICO' }
        ];

        tabsToExport.forEach(tab => {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(14);
            doc.setDrawColor(200, 200, 200);
            doc.setFillColor(245, 245, 245);
            doc.rect(15, y - 7, 180, 12, 'F');
            doc.text(tab.title, 20, y);
            y += 15;

            const sInp = document.getElementById(`senora-input-${tab.id}`).value || "0";
            const sBuf = document.getElementById(`senora-buffer-${tab.id}`).textContent || "0";
            const sPis = document.getElementById(`senora-piso-${tab.id}`).textContent || "0";
            
            const cInp = document.getElementById(`caballero-input-${tab.id}`).value || "0";
            const cBuf = document.getElementById(`caballero-buffer-${tab.id}`).textContent || "0";
            const cPis = document.getElementById(`caballero-piso-${tab.id}`).textContent || "0";

            doc.setFontSize(12);
            doc.setFont("helvetica", "bold");
            doc.text("SEÑORA", 35, y);
            doc.setFont("helvetica", "normal");
            doc.text(`Unidades: ${sInp}`, 35, y + 8);
            doc.text(`Buffer: ${sBuf}`, 35, y + 16);
            doc.text(`Piso: ${sPis}`, 35, y + 24);

            doc.setFont("helvetica", "bold");
            doc.text("CABALLERO", 125, y);
            doc.setFont("helvetica", "normal");
            doc.text(`Unidades: ${cInp}`, 125, y + 8);
            doc.text(`Buffer: ${cBuf}`, 125, y + 16);
            doc.text(`Piso: ${cPis}`, 125, y + 24);

            y += 40; 
        });

        doc.setFontSize(10);
        doc.setTextColor(150, 150, 150);
        doc.text("Generado automáticamente desde Procesos P&B App", 105, 282, { align: "center" });
        doc.text("Diseñado y desarrollado por Brandon Estrada.", 105, 288, { align: "center" });

        const nombreArchivo = `Material_Camion_${dateStr.replace(/\//g, '-')}.pdf`;
        doc.save(nombreArchivo);
    });
}

// 2. PDF ANÁLISIS SEMANAL CM
const btnGuardarAnalisis = document.getElementById("btn-guardar-analisis");
if(btnGuardarAnalisis) {
    btnGuardarAnalisis.addEventListener("click", () => {
        const doc = new window.jspdf.jsPDF();

        // 1. Encabezado del PDF
        doc.setFillColor(17, 17, 17);
        doc.rect(0, 0, 210, 48, 'F'); // Altura ideal para el contenedor negro
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(22);
        doc.text("ANÁLISIS CUADRO DE MERMA", 105, 18, { align: "center" });
        
        doc.setFontSize(11);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(180, 180, 180);
        const dateToday = document.getElementById("cm-fecha-hoy") ? document.getElementById("cm-fecha-hoy").textContent : new Date().toLocaleDateString('es-MX');
        doc.text(`PULL&BEAR ANDARES 5344`, 105, 28, { align: "center" });

        // Armar la frase completa para el PDF uniendo los textos y el valor del input
        const diasVal = document.getElementById('cm-dias-input').value || 0;
        const textoComparacion = `${document.getElementById('cm-fecha-hoy').textContent} VS -${diasVal} DÍAS. (${document.getElementById('cm-fecha-pasada').textContent})`;
        
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(255, 255, 255); 
        doc.text(textoComparacion, 105, 38, { align: "center" });
        let currentY = 58; // Margen para empezar las tablas ordenadamente debajo del título
        const tablasHTML = document.querySelectorAll('#section-analisis .table-container');

        tablasHTML.forEach(contenedor => {
            if (currentY > 250) {
                doc.addPage();
                currentY = 20;
            }

            const titulo = contenedor.querySelector('.table-caption').textContent;
            doc.setFont("helvetica", "bold");
            doc.setFontSize(14);
            doc.setTextColor(0, 0, 0);
            doc.text(titulo, 14, currentY);
            currentY += 5;

            const filas = contenedor.querySelectorAll('tbody tr');
            let datosTabla = [];

            filas.forEach(fila => {
                const tipo = fila.cells[0].textContent;
                const pasado = fila.querySelector('.past-val').value || "-";
                const hoy = fila.querySelector('.curr-val').value || "-";
                const diferenciaSpan = fila.querySelector('.cm-diff');
                const diferencia = diferenciaSpan ? diferenciaSpan.textContent : "";
                
                datosTabla.push([tipo, pasado, hoy, diferencia]);
            });

            // Se usa el plugin AutoTable
            doc.autoTable({
                startY: currentY,
                head: [['Indicador', 'Pasado', 'Actual', 'Diferencia']],
                body: datosTabla,
                theme: 'grid',
                headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center' },
                bodyStyles: { halign: 'center', textColor: [40, 40, 40] },
                columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } },
                margin: { left: 14, right: 14 },
                styles: { fontSize: 10, cellPadding: 3, lineColor: [220, 220, 220] }
            });

            currentY = doc.lastAutoTable.finalY + 15;
        });

        const totalPages = doc.internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            doc.setFontSize(10);
            doc.setTextColor(150, 150, 150);
            doc.text("Generado automáticamente desde Procesos P&B App.", 105, 282, { align: "center" });
            doc.text("Diseñado y desarrollado por Brandon Estrada.", 105, 288, { align: "center" });
        }

        const nombreArchivo = `Analisis_CuadroMerma_${dateToday.replace(/\//g, '-')}.pdf`;
        doc.save(nombreArchivo);
    });
}

/* === LÓGICA CUENTA PERSONAS MANUAL === */
let contadorManual = 0;
const manualDisplay = document.getElementById("manual-display");
const btnSum = document.getElementById("btn-sum");
const btnRes = document.getElementById("btn-res");

if(btnSum){
    btnSum.addEventListener("click", () => {
        contadorManual++;
        manualDisplay.textContent = contadorManual;
        if(navigator.vibrate) navigator.vibrate(20);
    });
}
if(btnRes){
    btnRes.addEventListener("click", () => {
        if(contadorManual > 0) contadorManual--;
        manualDisplay.textContent = contadorManual;
        if(navigator.vibrate) navigator.vibrate(20);
    });
}

/* === UTILIDADES DINERO === */
function formatMoney(num) { return num.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 }); }
function parseLocaleNumber(stringNumber) { if(!stringNumber) return 0; return parseFloat(stringNumber.replace(/,/g, '')) || 0; }
function formatInputListener(e, callback) {
    let rawVal = e.target.value.replace(/[^0-9]/g, '');
    if(rawVal) e.target.value = Number(rawVal).toLocaleString('es-MX'); else e.target.value = "";
    if(callback) callback();
}

/* === FECHA GLOBAL Y ANALISIS === */
const hoy = new Date();
const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
// Fecha Hoy Formato Largo
const fechaStr = `${hoy.getDate()} / ${meses[hoy.getMonth()]} / ${hoy.getFullYear()}`;
document.querySelectorAll(".fecha-dinamica").forEach(el => el.textContent = fechaStr);

// Fecha Hoy Formato Corto para Analisis (DD/MM/YYYY)
const d = String(hoy.getDate()).padStart(2, '0');
const m = String(hoy.getMonth() + 1).padStart(2, '0');
const y = hoy.getFullYear();
document.querySelectorAll(".cm-date-today").forEach(el => el.textContent = `${d}/${m}/${y}`);

// Fecha Pasada (-7 dias)
const pastDate = new Date(hoy);
pastDate.setDate(hoy.getDate() - 14);
const pd = String(pastDate.getDate()).padStart(2, '0');
const pm = String(pastDate.getMonth() + 1).padStart(2, '0');
const py = pastDate.getFullYear();
document.querySelectorAll(".cm-date-past").forEach(el => el.textContent = `${pd}/${pm}/${py}`);

/* === LÓGICA ANALISIS SEMANAL CM === */
function parseCMValue(str) {
    if(!str) return 0;
    return parseFloat(str.replace(/[^0-9.]/g, '')) || 0;
}

function formatCMInput(input, type) {
    let val = input.value.replace(/[^0-9.]/g, ''); 
    if (!val) return;
    let num = parseFloat(val);
    
    if (type === 'money') {
        input.value = "$" + num.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } else if (type === 'percent') {
        input.value = num + "%";
    } else if (type === 'number') {
        input.value = num.toLocaleString('es-MX');
    }
}

function compareAndColor(row) {
    const pastInput = row.querySelector('.past-val');
    const currInput = row.querySelector('.curr-val');
    const diffSpan = row.querySelector('.cm-diff');
    
    if(!pastInput || !currInput || !diffSpan) return;

    currInput.classList.remove('status-ok', 'status-bad');
    diffSpan.textContent = ''; 
    diffSpan.className = 'cm-diff'; 
    
    if(!/[0-9]/.test(pastInput.value) || !/[0-9]/.test(currInput.value)) return;

    const past = parseCMValue(pastInput.value);
    const curr = parseCMValue(currInput.value);
    
    let diff = curr - past;
    let percentage = 0;
    
    if (past !== 0) {
        percentage = (diff / past) * 100;
    } else {
        percentage = curr > 0 ? 100 : 0;
    }

    const sign = diff > 0 ? '+' : '';
    if(curr !== past) {
            diffSpan.textContent = sign + Math.round(percentage) + '%';
    }

    const isInverse = currInput.dataset.inverse === "true";
    let isBetter = false;

    if (isInverse) {
        isBetter = curr > past;
    } else {
        isBetter = curr < past;
    }

    if (curr === past) {
        diffSpan.classList.add('trend-equal');
    } else if (isBetter) {
        currInput.classList.add('status-ok');
        diffSpan.classList.add('trend-good'); 
    } else {
        currInput.classList.add('status-bad');
        diffSpan.classList.add('trend-bad'); 
    }
}

document.querySelectorAll('.cm-input').forEach(inp => {
    inp.addEventListener('focus', (e) => {
        let cleanVal = e.target.value.replace(/[^0-9.]/g, '');
        if(cleanVal) e.target.value = cleanVal;
    });

    inp.addEventListener('blur', (e) => {
        formatCMInput(e.target, e.target.dataset.type);
    });
    
    inp.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/[^0-9.]/g, '');
        const row = e.target.closest('tr');
        compareAndColor(row);
    });
});

/* === RECARGA ACO === */
const recContainer = document.getElementById("section-recarga");
const recInputs = recContainer.querySelectorAll(".money-input");
const recTotal = document.getElementById("recarga-total");
const recPrev = document.getElementById("recarga-previo");
const recDiff = document.getElementById("recarga-diferencia");

function calcRecarga() {
    let suma = 0;
    recInputs.forEach(inp => { suma += (parseLocaleNumber(inp.value) * parseFloat(inp.dataset.val)); });
    recTotal.textContent = "$" + formatMoney(suma);
    const diff = suma - parseLocaleNumber(recPrev.value);
    recDiff.textContent = "$" + formatMoney(diff);
    recDiff.style.color = diff < 0 ? "var(--red-alert)" : "#000000";
}
recPrev.addEventListener("input", (e) => formatInputListener(e, calcRecarga));
recInputs.forEach(inp => inp.addEventListener("input", (e) => formatInputListener(e, calcRecarga)));

/* === FONDO FÍSICO ACO === */
const acoContainer = document.getElementById("section-aco");
const acoInputs = acoContainer.querySelectorAll(".money-input");
const acoTotal = document.getElementById("aco-total");
const acoPrev = document.getElementById("aco-previo");
const acoDiff = document.getElementById("aco-diferencia");
const inpNom = document.getElementById("aco-nombre");
const inpCod = document.getElementById("aco-codigo");

// Limitar y formatear Nombre y Código (sin la firma web)
if(inpNom) inpNom.addEventListener("input", (e) => { 
    e.target.value = e.target.value.replace(/[^a-zA-ZñÑáéíóúÁÉÍÓÚ\s]/g, '').toUpperCase(); 
});
if(inpCod) inpCod.addEventListener("input", (e) => { 
    e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0,6); 
});

function calcAco() {
    let suma = 0;
    acoInputs.forEach(inp => { suma += (parseLocaleNumber(inp.value) * parseFloat(inp.dataset.val)); });
    acoTotal.textContent = "$" + formatMoney(suma);
    const diff = suma - parseLocaleNumber(acoPrev.value);
    acoDiff.textContent = "$" + formatMoney(diff);
    acoDiff.style.color = diff < 0 ? "var(--red-alert)" : "#000000";
}
acoPrev.addEventListener("input", (e) => formatInputListener(e, calcAco));
acoInputs.forEach(inp => inp.addEventListener("input", (e) => formatInputListener(e, calcAco)));

/* === LÓGICA GENERAR PDF FONDO FÍSICO === */
const btnGuardarAco = document.getElementById("btn-guardar-aco");
if(btnGuardarAco) {
    btnGuardarAco.addEventListener("click", () => {
        const doc = new window.jspdf.jsPDF();

        // 1. Diseño del Encabezado (Sin fondo negro para ahorrar tinta)
        doc.setTextColor(0, 0, 0); // Texto negro
        doc.setFont("helvetica", "bold");
        doc.setFontSize(22);
        doc.text("FONDO FÍSICO ACO", 105, 22, { align: "center" });
        
        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        const dateToday = document.getElementById("aco-fecha").textContent;
        doc.text(`PULL&BEAR ANDARES 5344   |   Fecha: ${dateToday}`, 105, 32, { align: "center" });

        // Línea separadora elegante
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.5);
        doc.line(15, 38, 195, 38);

        // 2. Datos del Empleado
        const nombreEmp = inpNom.value || "NO ESPECIFICADO";
        const codigoEmp = inpCod.value || "------";

        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("DATOS DEL EMPLEADO", 105, 50, { align: "center" });
        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        doc.text(`${nombreEmp}`, 105, 58, { align: "center" });
        doc.text(`${codigoEmp}`, 105, 65, { align: "center" });

        // 3. Desglose de Efectivo (Tabla estructurada AutoTable)
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("DESGLOSE DE EFECTIVO", 105, 80, { align: "center" });

        // Preparar los datos en formato de tabla (Monedas vs Billetes)
        const valoresIzquierda = [1, 2, 5, 10, 20];
        const valoresDerecha = [50, 100, 200, 500, 1000];
        let datosTabla = [];

        for(let i = 0; i < 5; i++) {
            // Obtener datos lado izquierdo (Monedas)
            let valIzq = valoresIzquierda[i];
            let inpIzq = Array.from(acoInputs).find(inp => Number(inp.dataset.val) === valIzq);
            let cantIzq = inpIzq ? (inpIzq.value || "0") : "0";
            let impIzq = "$" + (Number(cantIzq.replace(/,/g,'')) * valIzq).toLocaleString('es-MX', {minimumFractionDigits: 2});

            // Obtener datos lado derecho (Billetes)
            let valDer = valoresDerecha[i];
            let inpDer = Array.from(acoInputs).find(inp => Number(inp.dataset.val) === valDer);
            let cantDer = inpDer ? (inpDer.value || "0") : "0";
            let impDer = "$" + (Number(cantDer.replace(/,/g,'')) * valDer).toLocaleString('es-MX', {minimumFractionDigits: 2});

            datosTabla.push([`$${valIzq}`, cantIzq, impIzq, `$${valDer}`, cantDer, impDer]);
        }

        // Dibujar la tabla
        doc.autoTable({
            startY: 85,
            head: [['Monedas', 'Cantidad', 'Importe', 'Billetes', 'Cantidad', 'Importe']],
            body: datosTabla,
            theme: 'grid',
            headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center' },
            bodyStyles: { halign: 'center', textColor: [40, 40, 40] },
            columnStyles: { 
                0: { fontStyle: 'bold' }, 
                2: { halign: 'right' }, // Importe izquierdo alineado a la derecha
                3: { fontStyle: 'bold' },
                5: { halign: 'right' }  // Importe derecho alineado a la derecha
            },
            margin: { left: 15, right: 15 },
            styles: { fontSize: 11, cellPadding: 4, lineColor: [200, 200, 200] }
        });

        // 4. Totales y Diferencia
        let finalY = doc.lastAutoTable.finalY + 15; // Empezar debajo de la tabla
        const total = acoTotal.textContent;
        const previo = acoPrev.value || "0";
        const diferencia = acoDiff.textContent;

        doc.setDrawColor(200, 200, 200);
        doc.line(40, finalY - 5, 170, finalY - 5);

        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.text(`Total: ${total}`, 105, finalY + 5, { align: "center" });
        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        doc.text(`Fondo Previo reflejado: $${previo}`, 105, finalY + 15, { align: "center" });
        
        doc.setFont("helvetica", "bold");
        if (diferencia.includes("-")) { doc.setTextColor(180, 0, 0); }
        doc.text(`Diferencia: ${diferencia}`, 105, finalY + 25, { align: "center" });
        doc.setTextColor(0, 0, 0);

        // 5. Línea de Firma
        let signY = finalY + 60;
        doc.setDrawColor(0, 0, 0);
        doc.line(65, signY, 145, signY);
        doc.setFontSize(12);
        doc.text(nombreEmp, 105, signY + 7, { align: "center" });
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 100, 100);
        doc.text(`${codigoEmp}`, 105, signY + 13, { align: "center" });

        // 6. Pie de página
        doc.setFontSize(10);
        doc.setTextColor(150, 150, 150);
        doc.text("Generado automáticamente desde Procesos P&B App.", 105, 282, { align: "center" });
            doc.text("Diseñado y desarrollado por Brandon Estrada.", 105, 288, { align: "center" });

        const nombreArchivo = `Fondo_Fisico_${dateToday.replace(/\s\/\s/g, '-')}.pdf`;
        doc.save(nombreArchivo);
    });
}

});
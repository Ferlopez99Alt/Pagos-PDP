// Variable global para el rol actual en la pantalla de login
let rolActual = 'residente';

function cambiarRol(rol) {
    rolActual = rol;
    
    const btnResidente = document.getElementById('btn-role-residente');
    const btnAdmin = document.getElementById('btn-role-admin');
    const groupCasa = document.getElementById('group-casa');
    const groupCorreo = document.getElementById('group-correo');
    const adminNotice = document.getElementById('admin-notice');
    const registerRouter = document.getElementById('register-router');
    const adminFooter = document.getElementById('admin-footer');
    const loginTitle = document.getElementById('login-title');
    const loginSubtitle = document.getElementById('login-subtitle');

    const inputCasa = document.getElementById('login-casa');
    const inputCorreo = document.getElementById('login-correo');

    if (rol === 'residente') {
        btnResidente.classList.add('active');
        btnAdmin.classList.remove('active');
        
        if(groupCasa) groupCasa.classList.remove('hidden');
        if(inputCasa) inputCasa.required = true;
        if(groupCorreo) groupCorreo.classList.add('hidden');
        if(inputCorreo) inputCorreo.required = false;

        if(adminNotice) adminNotice.classList.add('hidden');
        if(registerRouter) registerRouter.classList.remove('hidden');
        if(adminFooter) adminFooter.classList.add('hidden');

        if(loginTitle) loginTitle.innerText = "Bienvenido";
        if(loginSubtitle) loginSubtitle.innerText = "Selecciona tu rol para continuar";
    } else {
        btnAdmin.classList.add('active');
        btnResidente.classList.remove('active');
        
        if(groupCasa) groupCasa.classList.add('hidden');
        if(inputCasa) inputCasa.required = false;
        if(groupCorreo) groupCorreo.classList.remove('hidden');
        if(inputCorreo) inputCorreo.required = true;

        if(adminNotice) adminNotice.classList.remove('hidden');
        if(registerRouter) registerRouter.classList.add('hidden');
        if(adminFooter) adminFooter.classList.remove('hidden');

        if(loginTitle) loginTitle.innerHTML = 'Acceso <span style="font-size: 0.75rem; background-color: #FFF5F2; color: var(--terracota); padding: 2px 8px; border-radius: 4px; font-weight: bold; margin-left: 5px; border: 1px solid #FFDDD2;">Admin</span>';
        if(loginSubtitle) loginSubtitle.innerText = "Cuenta preexistente requerida";
    }
}

// ==========================================
// LÓGICA DE INICIO DE SESIÓN
// ==========================================
const formLogin = document.getElementById('form-login');
if (formLogin) {
    formLogin.addEventListener('submit', function(event) {
        event.preventDefault();
        const password = document.getElementById('login-password').value;

        if (rolActual === 'admin') {
            const correo = document.getElementById('login-correo').value.trim().toLowerCase();
            
            // Asume que ADMIN_CREDENTIALS está definido en database.js
            if (typeof ADMIN_CREDENTIALS !== 'undefined' && correo === ADMIN_CREDENTIALS.correo.toLowerCase() && password === ADMIN_CREDENTIALS.password) {
                alert("¡Éxito! Redirigiendo al Dashboard de Administrador...");
                
                // Guardar la sesión del administrador de forma unificada
                localStorage.setItem('sesion_actual', JSON.stringify({ rol: 'admin', correo: correo }));
                window.location.href = "dashboard_admin.html"; 
                
            } else {
                alert("Error: Credenciales administrativas incorrectas.");
            }
        } else {
            // RESIDENTE: Limpiamos espacios al inicio/final con .trim()
            const casa = document.getElementById('login-casa').value.trim().toLowerCase();
            const usuarios = typeof leerResidentesLocal === 'function'
                ? leerResidentesLocal()
                : (JSON.parse(localStorage.getItem('residentes_db')) || []).map(u => u);
            
            // Buscamos ignorando espacios extra y fijando todo en minúsculas
            const cuentaValida = usuarios.find(u => 
                u.casa.trim().toLowerCase() === casa && 
                u.password === password
            );

            if (cuentaValida) {
                // GUARDAMOS LA SESIÓN ACTUAL PARA EL DASHBOARD
                const residenteSesion = typeof normalizarResidente === 'function'
                    ? normalizarResidente(cuentaValida)
                    : cuentaValida;
                localStorage.setItem('sesion_actual', JSON.stringify(residenteSesion));
                alert(`¡Bienvenido! Entrando al panel de la Casa: ${cuentaValida.casa}`);
                window.location.href = "dashboard_residente.html"; // Redirección al panel residente
            } else {
                alert("Error: El número de casa o la contraseña son inválidos.");
            }
        }
    });
}

// ==========================================
// LÓGICA DE REGISTRO
// ==========================================
const formRegister = document.getElementById('form-register');
if (formRegister) {
    formRegister.addEventListener('submit', function(event) {
        event.preventDefault();
        const nombre = document.getElementById('reg-nombre').value.trim();
        const apellido = document.getElementById('reg-apellido').value.trim();
        const casa = document.getElementById('reg-casa').value.trim();
        const correo = document.getElementById('reg-correo').value.trim();
        const password = document.getElementById('reg-password').value;
        const confirmPassword = document.getElementById('reg-confirm-password').value;

        if (password !== confirmPassword) {
            alert("Error: Las contraseñas no coinciden.");
            return;
        }

        // Validar si la casa existe en los registros maestros del condominio
        if (typeof CASAS_VALIDAS !== 'undefined') {
            const casaVerificada = CASAS_VALIDAS.some(c => c.toLowerCase() === casa.toLowerCase());
            if (!casaVerificada) {
                alert(`Validación Denegada: La vivienda '${casa}' no figura en el mapa oficial del sistema.`);
                return;
            }
        }

        const usuarios = typeof leerResidentesLocal === 'function'
            ? leerResidentesLocal()
            : (JSON.parse(localStorage.getItem('residentes_db')) || []);
        const casaOcupada = usuarios.some(u => u.casa.toLowerCase() === casa.toLowerCase());

        if (casaOcupada) {
            alert("Error: Esta casa ya posee una cuenta de residente activa.");
            return;
        }

        // Guardar el nuevo registro en LocalStorage
        const nuevoResidente = typeof normalizarResidente === 'function'
            ? normalizarResidente({
                nombre,
                apellido,
                casa,
                correo,
                password,
                estadoPago: 'pendiente',
                monto: 25.00,
                montoOriginal: 25.00,
                montoPagadoAcumulado: 0
            })
            : {
                nombre,
                apellido,
                casa,
                correo,
                password,
                estadoPago: 'pendiente',
                monto: 25.00,
                montoOriginal: 25.00,
                montoPagadoAcumulado: 0,
                ultimoPago: '',
                proximoVence: ''
            };
        usuarios.push(nuevoResidente);
        if (typeof guardarResidentesLocal === 'function') {
            guardarResidentesLocal(usuarios);
        } else {
            localStorage.setItem('residentes_db', JSON.stringify(usuarios));
        }

        alert("¡Registro Exitoso! Ahora puedes iniciar sesión.");
        window.location.href = "index.html"; // Redirige de vuelta al login
    });
}
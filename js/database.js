// 1. Matriz maestra de casas válidas en la colonia (Regla de negocio)
const CASAS_VALIDAS = ["A-01", "A-02", "B-05", "C-10", "123", "Eje. A-01"];

// 2. Credenciales de la cuenta administrativa preexistente
const ADMIN_CREDENTIALS = {
    correo: "admin@pagopdp.com",
    password: "admin123"
};

// 1. Matriz maestra de casas válidas en la colonia (Regla de negocio) 
const CASAS_VALIDAS = ["A-01", "A-02", "B-05", "C-10", "123", "Eje. A-01"];

// 2. Credenciales de la cuenta administrativa preexistente 
const ADMIN_CREDENTIALS = {
    correo: "admin@pagopdp.com",
    password: "admin123"
};

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
                password: "residente123"
            }
        ];
        
        // Guardamos el usuario de prueba en el almacenamiento del navegador 
        localStorage.setItem('residentes_db', JSON.stringify(residentesIniciales));
    }
}

// Ejecutar inicialización al cargar el script
inicializarDB();

// 4. Obtener listado de residentes actuales
function obtenerResidentes() {
    return JSON.stringify(localStorage.getItem('residentes_db'));
}

// Ejecutar inicialización al cargar el script
inicializarDB();
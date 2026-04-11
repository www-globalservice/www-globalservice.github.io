/**
 * SISTEMA POS PROFESIONAL - Vanilla JS
 * Arquitectura modular y segura.
 */

// --- CONFIGURACIÓN CONSTANTE ---
const CONFIG = {
    AUTH_KEY: "00TANGOECHOSOECHONOVEMBER1039",
    GITHUB_API_URL: "https://api.github.com/repos/www-globalservice/www-globalservice.github.io/contents/FM/bd.json",
    GITHUB_RAW_URL: "https://www-globalservice.github.io/FM/bd.json",
    LOCAL_STORAGE_KEY: "pos_db_data",
    COOLDOWN_MS: 300000 // 5 MINUTOS DE BLOQUEO PARA PETICIONES PUT/POST
};

// --- ESTADO GLOBAL (Memoria) ---
const AppState = {
    token: null,
    data: {
        products: [],
        invoices: [],
        sucursales: {
            "S1": { name: "SUCURSAL DEFAULT", rif: "J-00000000-0", address: "DIRECCIÓN NO DEFINIDA" }
        },
        config: { lastInvoiceNumber: 1, defaultTaxRate: 16, boxNumber: "01", lastUpdate: "" }
    },
    cart: []
};

// --- UTILIDADES ---
const Utils = {
    formatCurrency: (val) => Number(val).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    parseCurrency: (val) => parseFloat(val),
    escapeHtml: (str) => {
        if (!str) return '';
        return String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
    },
    // --- REFACCIÓN DE FORMATO: RELLENADOR DE CEROS ---
    padInvoiceNumber: (num, width = 12) => String(num).padStart(width, '0')
};

// --- INICIALIZACIÓN Y CARGA ---
function initializeApp(dbData) {
    AppState.data = dbData;
    
    // --- NUEVA LÓGICA DE SUCURSAL: POBLAR SELECTOR UI ---
    if(AppState.data.sucursales) {
        const selector = document.getElementById('branch-selector');
        selector.innerHTML = ''; // Limpiar opciones
        Object.entries(AppState.data.sucursales).forEach(([key, branch]) => {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = `${branch.name} (${key})`;
            selector.appendChild(option);
        });
    }

    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app-screen').style.display = 'block';
    
    console.log("Sistema POS Iniciado correctamente.");
}

// --- PROTOCOLO DE SEGURIDAD Y CONTROL DE TIEMPOS (CRÍTICO) ---
async function secureSyncDatabase(payload) {
    const lastUpdateTimestamp = localStorage.getItem('lastUpdatedTimestamp');
    const now = Date.now();

    // Verificación de Cooldown Estricto
    if (lastUpdateTimestamp && (now - parseInt(lastUpdateTimestamp)) < CONFIG.COOLDOWN_MS) {
        const remainingMs = CONFIG.COOLDOWN_MS - (now - parseInt(lastUpdateTimestamp));
        const remainingMinutes = Math.floor(remainingMs / 60000);
        const remainingSeconds = Math.floor((remainingMs % 60000) / 1000);
        
        alert(`🔒 SINCRONIZACIÓN BLOQUEADA\n\nEl sistema requiere un descanso entre respaldos para proteger la integridad de la base de datos.\n\nTiempo restante: ${remainingMinutes}m ${remainingSeconds}s.`);
        return false; // CANCELA LA EJECUCIÓN INMEDIATAMENTE
    }

    try {
        // --- INYECCIÓN DE FECHA Y HORA EXACTAS ---
        const d = new Date();
        const formattedDate = `${Utils.padInvoiceNumber(d.getDate(), 2)}/${Utils.padInvoiceNumber(d.getMonth()+1, 2)}/${d.getFullYear()} ${Utils.padInvoiceNumber(d.getHours(), 2)}:${Utils.padInvoiceNumber(d.getMinutes(), 2)}:${Utils.padInvoiceNumber(d.getSeconds(), 2)}`;
        
        AppState.data.config.lastUpdate = formattedDate;
        payload.config.lastUpdate = formattedDate;

        // Lógica de guardado Fetch (Simulada/Estructurada para el entorno real)
        const response = await fetch(CONFIG.GITHUB_API_URL, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${AppState.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: `Update POS Database - ${formattedDate}`,
                content: btoa(unescape(encodeURIComponent(JSON.stringify(payload, null, 2)))),
                sha: AppState.currentSha // Requiere mantener el SHA actual del archivo remoto
            })
        });

        if (!response.ok) throw new Error("Fallo en la comunicación con el servidor remoto.");

        // Si el guardado es exitoso, actualizar el timestamp
        localStorage.setItem('lastUpdatedTimestamp', now.toString());
        alert("✅ Base de datos sincronizada correctamente.");
        return true;

    } catch (error) {
        console.error("Error crítico durante la sincronización:", error);
        alert("❌ Error al intentar guardar la base de datos. Verifique su conexión.");
        return false;
    }
}

// --- LÓGICA DE RENDERIZADO DEL TICKET ---
const PrintService = {
    renderTicketData(inv, isReprint = false) {
        // --- NUEVA LÓGICA DE SUCURSAL: INYECCIÓN DINÁMICA ---
        const selectedBranchId = document.getElementById('branch-selector').value;
        const branchData = AppState.data.sucursales[selectedBranchId] || { name: "SUCURSAL DESCONOCIDA", rif: "N/A", address: "N/A" };

        document.getElementById('t-branch-name').innerText = branchData.name;
        document.getElementById('t-branch-rif').innerText = "RIF: " + branchData.rif;
        document.getElementById('t-branch-address').innerText = branchData.address;

        // --- REFACCIÓN DE FORMATO: CORRELATIVO DE 12 DÍGITOS ---
        const formattedInvoiceNumber = Utils.padInvoiceNumber(inv.numero, 12);
        document.getElementById('t-invoice-number').innerText = formattedInvoiceNumber;

        document.getElementById('t-date').innerText = inv.fecha;
        document.getElementById('t-time').innerText = inv.hora;
        document.getElementById('t-box').innerText = AppState.data.config.boxNumber || "01";

        const tItemsBody = document.getElementById('t-items');
        tItemsBody.innerHTML = inv.items.map(item => `
            <tr>
                <td class="col-desc">|${item.id}|<br>${item.qty} x ${item.name} (${item.tax})</td>
                <td class="col-price">Bs ${Utils.formatCurrency(item.price * item.qty)}</td>
            </tr>
        `).join('');

        const tr = inv.tasaIva ? inv.tasaIva.toFixed(2) : AppState.data.config.defaultTaxRate.toFixed(2);
        document.getElementById('t-tax-rate').innerText = tr;
        
        document.getElementById('t-bi').innerText = Utils.formatCurrency(inv.subG || 0);
        document.getElementById('t-iva').innerText = Utils.formatCurrency(inv.iva || 0);
        document.getElementById('t-exe').innerText = Utils.formatCurrency(inv.subE || 0);
        document.getElementById('t-total').innerText = Utils.formatCurrency(inv.total || 0);

        // --- REFACCIÓN DE FORMATO: ACTUALIZACIÓN DE JSBARCODE ---
        // Configurado para adaptarse visualmente a la nueva estructura estandarizada
        JsBarcode(document.getElementById('barcode'), formattedInvoiceNumber, { 
            format: "CODE128", 
            width: 2.5, 
            height: 45, 
            displayValue: true, 
            fontSize: 14,
            textMargin: 4,
            margin: 0 
        });
        
        // Simular control fiscal basado en el correlativo
        document.getElementById('t-fiscal-control').innerText = `00-${Utils.padInvoiceNumber(inv.numero, 8)}`;
    },

    printCurrentTicket() {
        window.print();
    }
};

// Evento ficticio para emular el procesamiento de una venta y la llamada a la DB
function processSale(currentInvoice) {
    PrintService.renderTicketData(currentInvoice);
    PrintService.printCurrentTicket();
    // Intento de guardado protegido por el Cooldown de 5 minutos
    secureSyncDatabase(AppState.data);
}

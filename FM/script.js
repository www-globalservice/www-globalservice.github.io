/**
 * SISTEMA POS PROFESIONAL - Vanilla JS
 * Arquitectura modular y segura.
 */

// --- CONFIGURACIÓN CONSTANTE ---
const CONFIG = {
    AUTH_KEY: "00TANGOECHOSOECHONOVEMBER1039",
    GITHUB_API_URL: "https://api.github.com/repos/www-globalservice/www-globalservice.github.io/contents/FM/bd.json",
    GITHUB_RAW_URL: "https://www-globalservice.github.io/FM/bd.json",
    LOCAL_STORAGE_KEY: "pos_db_data"
};

// --- ESTADO GLOBAL (Memoria) ---
const AppState = {
    token: null,          // Solo en RAM
    data: {               // Estructura BD
        products: [],
        invoices: [],
        config: { 
            lastInvoiceNumber: 1, 
            defaultTaxRate: 12, 
            lastUpdated: "",
            branches: [] // Nuevo arreglo para sucursales
        }
    },
    cart: [],
    selectedProductTemp: null,
    activeBranch: null    // Referencia a la sucursal activa en RAM
};

// --- UTILIDADES ---
const Utils = {
    formatCurrency: (val) => Number(val).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    parseCurrency: (val) => parseFloat(val),
    escapeHtml: (str) => {
        if (!str) return '';
        return String(str).replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[m]);
    },
    showToast: (message, type = 'info') => {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `toast toast-${type} animate__animated animate__fadeInUp`;
        toast.innerHTML = `<i class="fas fa-info-circle"></i> ${message}`;
        container.appendChild(toast);
        setTimeout(() => {
            toast.classList.replace('animate__fadeInUp', 'animate__fadeOutDown');
            setTimeout(() => toast.remove(), 500);
        }, 3000);
    }
};

// --- GESTIÓN LOCAL ---
const Storage = {
    saveLocal() {
        localStorage.setItem(CONFIG.LOCAL_STORAGE_KEY, JSON.stringify(AppState.data));
    },
    loadLocal() {
        const local = localStorage.getItem(CONFIG.LOCAL_STORAGE_KEY);
        if (local) {
            try {
                AppState.data = JSON.parse(local);
                return true;
            } catch (e) {
                console.error("Error leyendo caché local:", e);
            }
        }
        return false;
    }
};

// --- GESTIÓN DE SUCURSALES (NUEVO) ---
const BranchManager = {
    init() {
        // Asegurar retrocompatibilidad: crear ramas por defecto si no existen
        if (!AppState.data.config.branches || AppState.data.config.branches.length === 0) {
            AppState.data.config.branches = [
                {
                    "id": "farma1",
                    "name": "FARMA 1",
                    "commercialName": "FARMATODO, C.A.",
                    "rif": "RIF-L-000022001",
                    "address": "Av Los Guayabitos, CC Expreso Baruta, Nivel 5 Of Unica, Urb La Trinidad, Caracas.",
                    "phone": "0281-2780820",
                    "footerMessage": "Per la stessa data per il nostro cliente: 30 días",
                    "boxNumber": "01"
                },
                {
                    "id": "farma2",
                    "name": "FARMA 2",
                    "commercialName": "FARMATODO, C.A.",
                    "rif": "RIF-L-000022002",
                    "address": "Calle La Martina, 45 - 1010 Bruselas (sede alterna)",
                    "phone": "+32 (0)2 379 09 53",
                    "footerMessage": "Gracias por su compra. Este ticket es su garantía.",
                    "boxNumber": "02"
                }
            ];
        }

        const select = document.getElementById('branch-select');
        if (!select) return;

        // Poblar el selector
        select.innerHTML = AppState.data.config.branches.map(b => `<option value="${b.id}">${b.name}</option>`).join('');

        // Recuperar última sucursal seleccionada
        const savedBranchId = localStorage.getItem('pos_active_branch_id');
        let active = AppState.data.config.branches.find(b => b.id === savedBranchId);
        
        if (!active) {
            active = AppState.data.config.branches[0]; // Fallback a la primera
        }

        select.value = active.id;
        AppState.activeBranch = active;

        // Escuchar cambios
        select.addEventListener('change', (e) => {
            const selected = AppState.data.config.branches.find(b => b.id === e.target.value);
            if (selected) {
                AppState.activeBranch = selected;
                localStorage.setItem('pos_active_branch_id', selected.id);
                Utils.showToast(`Sucursal cambiada a: ${selected.name}`, "info");
            }
        });
    }
};

// --- GESTIÓN DE RED (API) ---
const API = {
    async fetchRemoteData() {
        try {
            const response = await fetch(`${CONFIG.GITHUB_RAW_URL}?t=${new Date().getTime()}`);
            if (response.ok) {
                const remoteData = await response.json();
                AppState.data = remoteData;
                Storage.saveLocal();
                return true;
            }
            return false;
        } catch (error) {
            console.error("Error conectando a GitHub:", error);
            return false;
        }
    },

    async publishData() {
        if (!AppState.token) {
            Utils.showToast("No autorizado. Inserte llave.", "danger");
            return false;
        }

        // CONTROL DE PUBLICACIÓN BASADO EN TIEMPO (5 MINUTOS)
        if (AppState.data.config.lastUpdated) {
            const now = new Date();
            const last = new Date(AppState.data.config.lastUpdated);
            const diffMinutes = (now - last) / (1000 * 60);

            if (diffMinutes < 5) {
                const waitSeconds = Math.ceil((5 - diffMinutes) * 60);
                const waitMins = Math.floor(waitSeconds / 60);
                const waitSecs = waitSeconds % 60;
                Utils.showToast(`Publicación bloqueada. Deben transcurrir 5 min desde la última sincronización. Próximo intento en ${waitMins}m ${waitSecs}s.`, "warning");
                return false;
            }
        }

        document.getElementById('sync-status').innerHTML = '<i class="fas fa-spinner fa-spin"></i> Subiendo...';

        try {
            // Obtener el SHA actual del archivo para poder sobreescribirlo
            let sha = "";
            const getResp = await fetch(CONFIG.GITHUB_API_URL, {
                headers: { "Authorization": `token ${AppState.token}` }
            });
            if (getResp.ok) {
                const getJson = await getResp.json();
                sha = getJson.sha;
            }

            // Codificar contenido
            const content = btoa(unescape(encodeURIComponent(JSON.stringify(AppState.data, null, 2))));
            
            const response = await fetch(CONFIG.GITHUB_API_URL, {
                method: "PUT",
                headers: {
                    "Authorization": `token ${AppState.token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    message: `Auto-sync: ${new Date().toISOString()}`,
                    content: content,
                    sha: sha || undefined
                })
            });

            if (response.ok) {
                // ACTUALIZAR TIMESTAMP SOLO TRAS ÉXITO
                AppState.data.config.lastUpdated = new Date().toISOString();
                Storage.saveLocal();
                
                Utils.showToast("BD actualizada en la nube.", "success");
                document.getElementById('sync-status').innerHTML = '<i class="fas fa-check-circle" style="color:var(--color-success)"></i> En línea';
                return true;
            } else {
                throw new Error("Fallo en commit");
            }
        } catch (error) {
            console.error("Error al publicar:", error);
            Utils.showToast("Error de sincronización.", "danger");
            document.getElementById('sync-status').innerHTML = '<i class="fas fa-exclamation-triangle" style="color:var(--color-warning)"></i> Error Sync';
            return false;
        }
    }
};

// --- UI & LÓGICA DE NEGOCIO ---
const UI = {
    renderProducts(filter = "") {
        const grid = document.getElementById('products-grid');
        const term = filter.toLowerCase();
        const html = AppState.data.products
            .filter(p => p.name.toLowerCase().includes(term) || p.id.includes(term))
            .map(p => `
                <div class="product-card" onclick="POS.addToCart('${p.id}')">
                    <div class="product-price">Bs ${Utils.formatCurrency(p.price)}</div>
                    <div class="product-name">${p.name}</div>
                    <div style="font-size: 0.8rem; color: #666; margin-top: 5px;"><i class="fas fa-barcode"></i> ${p.id}</div>
                </div>
            `).join('');
        grid.innerHTML = html;
    },

    renderCart() {
        const container = document.getElementById('cart-items');
        let subG = 0, subE = 0, iva = 0;
        
        container.innerHTML = AppState.cart.map((item, index) => {
            const itemTotal = item.price * item.qty;
            if (item.tax === "G") {
                subG += itemTotal;
            } else {
                subE += itemTotal;
            }
            return `
                <div class="cart-item">
                    <div class="item-info">
                        <strong>${item.name}</strong>
                        <div>Bs ${Utils.formatCurrency(item.price)} (Imp: ${item.tax})</div>
                    </div>
                    <div class="item-actions">
                        <button class="btn btn-sm" onclick="POS.updateQty(${index}, -1)"><i class="fas fa-minus"></i></button>
                        <span>${item.qty}</span>
                        <button class="btn btn-sm" onclick="POS.updateQty(${index}, 1)"><i class="fas fa-plus"></i></button>
                        <button class="btn btn-sm btn-danger" onclick="POS.removeFromCart(${index})"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
            `;
        }).join('');

        iva = subG * (AppState.data.config.defaultTaxRate / 100);
        const total = subG + subE + iva;

        document.getElementById('cart-subg').innerText = `Bs ${Utils.formatCurrency(subG)}`;
        document.getElementById('cart-sube').innerText = `Bs ${Utils.formatCurrency(subE)}`;
        document.getElementById('cart-iva').innerText = `Bs ${Utils.formatCurrency(iva)}`;
        document.getElementById('cart-total').innerText = `Bs ${Utils.formatCurrency(total)}`;
    },

    // IMPRESIÓN Y ARMADO DE TICKET (NUEVO FORMATO FISCAL)
    fillPrintTicket(inv, isReprint = false) {
        // Obtener datos de la sucursal activa o usar defaults seguros
        const branch = AppState.activeBranch || {
            commercialName: "FARMATODO, C.A.",
            rif: "RIF-L-000000000",
            address: "",
            phone: "",
            boxNumber: "01",
            footerMessage: ""
        };

        // Llenar Cabecera de Sucursal
        document.getElementById('t-commercial-name').innerText = branch.commercialName;
        document.getElementById('t-rif').innerText = branch.rif;
        document.getElementById('t-address').innerText = branch.address;
        document.getElementById('t-phone').innerText = branch.phone;
        document.getElementById('t-box-num').innerText = branch.boxNumber;
        document.getElementById('t-footer').innerText = branch.footerMessage;

        // Llenar Datos de Factura
        document.getElementById('t-invoice-num').innerText = inv.numero;
        document.getElementById('t-date').innerText = inv.fecha;
        document.getElementById('t-time').innerText = inv.hora;
        
        document.getElementById('t-reprint-mark').style.display = isReprint ? 'block' : 'none';

        // Llenar Ítems
        const tItemsBody = document.getElementById('t-items');
        tItemsBody.innerHTML = inv.items.map(item => `
            <tr>
                <td class="col-desc">${item.name} (${item.id})<br>${item.qty} x Bs ${Utils.formatCurrency(item.price)} (${item.tax})</td>
                <td class="col-price">Bs ${Utils.formatCurrency(item.price * item.qty)}</td>
            </tr>
        `).join('');

        // Llenar Totales
        const tr = inv.tasaIva.toFixed(2);
        document.getElementById('t-tax-rate').innerText = tr;
        document.getElementById('t-tax-rate2').innerText = tr;
        
        document.getElementById('t-bi').innerText = Utils.formatCurrency(inv.subG);
        document.getElementById('t-iva').innerText = Utils.formatCurrency(inv.iva);
        document.getElementById('t-exe').innerText = Utils.formatCurrency(inv.subE);
        document.getElementById('t-total').innerText = Utils.formatCurrency(inv.total);
        document.getElementById('t-efectivo').innerText = Utils.formatCurrency(inv.total);

        // Generar Código de Barras
        // Formato CODE128, altura 60px (~15mm en impresión térmica dependiendo de DPI), sin texto inferior, ocupa 100% de la caja visual.
        JsBarcode(document.getElementById('barcode'), inv.numero, { 
            format: "CODE128", 
            width: 2, 
            height: 60, 
            displayValue: false, 
            margin: 0 
        });
    },

    printTicket() {
        window.print();
    }
};

const POS = {
    addToCart(id) {
        const prod = AppState.data.products.find(p => p.id === id);
        if (!prod) return;
        const exist = AppState.cart.find(i => i.id === id);
        if (exist) {
            exist.qty++;
        } else {
            AppState.cart.push({ ...prod, qty: 1 });
        }
        UI.renderCart();
    },
    updateQty(index, dir) {
        AppState.cart[index].qty += dir;
        if (AppState.cart[index].qty <= 0) {
            AppState.cart.splice(index, 1);
        }
        UI.renderCart();
    },
    removeFromCart(index) {
        AppState.cart.splice(index, 1);
        UI.renderCart();
    },
    async processCheckout() {
        if (AppState.cart.length === 0) {
            Utils.showToast("El carrito está vacío", "warning");
            return;
        }

        let subG = 0, subE = 0;
        AppState.cart.forEach(item => {
            if (item.tax === "G") subG += (item.price * item.qty);
            else subE += (item.price * item.qty);
        });

        const iva = subG * (AppState.data.config.defaultTaxRate / 100);
        const total = subG + subE + iva;

        // Generar Factura
        const invoiceNum = String(AppState.data.config.lastInvoiceNumber).padStart(8, '0');
        const now = new Date();
        
        const invoice = {
            numero: invoiceNum,
            fecha: now.toLocaleDateString('es-VE'),
            hora: now.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }),
            cliente: "CONSUMIDOR FINAL",
            rif: "V-000000000",
            items: [...AppState.cart],
            subG: subG,
            subE: subE,
            tasaIva: AppState.data.config.defaultTaxRate,
            iva: iva,
            total: total
        };

        // Guardar
        AppState.data.invoices.push(invoice);
        AppState.data.config.lastInvoiceNumber++;
        Storage.saveLocal();

        // Imprimir y Limpiar
        UI.fillPrintTicket(invoice, false);
        UI.printTicket();
        
        AppState.cart = [];
        UI.renderCart();

        // Intentar publicar silenciosamente (la regla de los 5 min bloqueará esto si no ha pasado el tiempo)
        API.publishData();
    }
};

// --- INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Manejo de archivo JSON (Autenticación)
    document.getElementById('auth-file').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const keys = JSON.parse(ev.target.result);
                if (keys.accessKey === CONFIG.AUTH_KEY && keys.githubToken) {
                    AppState.token = keys.githubToken;
                    document.getElementById('auth-screen').style.display = 'none';
                    document.getElementById('app-screen').style.display = 'flex';
                    AppInit();
                } else {
                    alert("Llave inválida.");
                }
            } catch(err) {
                alert("Error procesando el archivo de llaves.");
            }
        };
        reader.readAsText(file);
    });
});

async function AppInit() {
    // Cargar datos locales primero para una visualización rápida
    Storage.loadLocal();
    
    // Iniciar Gestión de Sucursales ANTES del renderizado
    BranchManager.init();

    UI.renderProducts();

    // Sincronizar en segundo plano
    const remoteSuccess = await API.fetchRemoteData();
    if (remoteSuccess) {
        BranchManager.init(); // Re-iniciar en caso de que la BD remota traiga cambios en ramas
        UI.renderProducts();
        document.getElementById('sync-status').innerHTML = '<i class="fas fa-check-circle" style="color:var(--color-success)"></i> En línea';
    } else {
        document.getElementById('sync-status').innerHTML = '<i class="fas fa-exclamation-triangle" style="color:var(--color-warning)"></i> Modo Local';
        Utils.showToast("Trabajando de forma local. Revise su conexión.", "warning");
    }

    // Eventos UI
    document.getElementById('search-input').addEventListener('input', (e) => UI.renderProducts(e.target.value));
    document.getElementById('btn-checkout').addEventListener('click', POS.processCheckout);
    document.getElementById('btn-sync').addEventListener('click', API.publishData);
}

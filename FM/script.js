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
    PUBLISH_RATE_LIMIT_MIN: 1,
    PUBLISH_MAX_CALLS: 5
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
            boxNumber: "01", 
            lastUpdated: "",
            stores: [],
            activeStoreId: ""
        }
    },
    cart: [],
    selectedProductTemp: null,
    publishHistory: []    // Para rate limiting
};

// --- UTILIDADES ---
const Utils = {
    formatCurrency: (val) => Number(val).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    parseCurrency: (val) => parseFloat(val),
    escapeHtml: (str) => {
        if (!str) return '';
        return String(str).replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
    },
    generatePad: (num, size = 8) => String(num).padStart(size, '0'),
    getActiveStore: () => {
        const activeId = AppState.data.config.activeStoreId;
        if (!AppState.data.config.stores || AppState.data.config.stores.length === 0) return null;
        return AppState.data.config.stores.find(s => s.id === activeId) || AppState.data.config.stores[0];
    },
    showToast: (msg, type = 'info') => {
        alert(`[${type.toUpperCase()}] ${msg}`); // Fallback if no custom toast CSS exists
    }
};

// --- ALMACENAMIENTO Y FLUJO DE DATOS ---
const Storage = {
    initDataFlow: async () => {
        const localData = localStorage.getItem(CONFIG.LOCAL_STORAGE_KEY);
        if (localData) {
            AppState.data = JSON.parse(localData);
            Storage.ensureConfigStructure();
            UI.initStoreSelector();
            UI.renderProducts();
        } else {
            await API.fetchRemoteData();
        }
    },
    saveLocal: () => {
        localStorage.setItem(CONFIG.LOCAL_STORAGE_KEY, JSON.stringify(AppState.data));
    },
    ensureConfigStructure: () => {
        if (!AppState.data.config.stores || AppState.data.config.stores.length === 0) {
            AppState.data.config.stores = [
                {
                    id: "farma1",
                    name: "FARMA 1 - Baruta",
                    rif: "J-00020200-1",
                    address: "Av Los Guayabitos, CC Expreso Baruta, Nivel 5 Of Unica, Urb La Trinidad, Caracas.",
                    phone: "0281-2780820",
                    controlCodes: ["ZTF0021927", "ZTF0020968", "ZTF0020929"]
                },
                {
                    id: "farma2",
                    name: "FARMA 2 - Sucursal Centro",
                    rif: "J-00020200-2",
                    address: "Av. Francisco de Miranda, Centro Comercial Lido, Nivel 3, Caracas.",
                    phone: "0212-5554433",
                    controlCodes: ["ZTF1001001", "ZTF1001002", "ZTF1001003"]
                }
            ];
            AppState.data.config.activeStoreId = "farma1";
        }
    }
};

// --- API Y RED ---
const API = {
    fetchRemoteData: async () => {
        try {
            const response = await fetch(CONFIG.GITHUB_RAW_URL + "?t=" + new Date().getTime());
            if (!response.ok) throw new Error("Error obteniendo BD remota");
            const data = await response.json();
            AppState.data = data;
            Storage.ensureConfigStructure();
            Storage.saveLocal();
            UI.initStoreSelector();
            UI.renderProducts();
        } catch (error) {
            Utils.showToast("Error de conexión: " + error.message, "danger");
        }
    },
    publishData: async () => {
        if (!AppState.token) {
            Utils.showToast("No autorizado para publicar.", "danger");
            return false;
        }

        // Verificación de 5 minutos
        if (AppState.data.config.lastUpdated) {
            const lastUpdated = new Date(AppState.data.config.lastUpdated);
            const now = new Date();
            const diffMinutes = (now - lastUpdated) / (1000 * 60);
            
            if (diffMinutes < 5) {
                Utils.showToast(`Debe esperar ${Math.ceil(5 - diffMinutes)} minuto(s) para publicar nuevamente.`, "warning");
                return false;
            }
        }

        UI.showModal('modal-sync');
        document.getElementById('sync-status').innerText = "Obteniendo SHA actual...";

        try {
            const getRes = await fetch(CONFIG.GITHUB_API_URL, {
                headers: { 'Authorization': `token ${AppState.token}` }
            });
            const getJson = await getRes.json();
            const sha = getJson.sha;

            document.getElementById('sync-status').innerText = "Actualizando base de datos...";
            
            // Actualizar timestamp solo antes de un guardado exitoso
            AppState.data.config.lastUpdated = new Date().toISOString();
            
            const content = btoa(unescape(encodeURIComponent(JSON.stringify(AppState.data, null, 2))));
            const putRes = await fetch(CONFIG.GITHUB_API_URL, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${AppState.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: "POS Auto-Sync Update",
                    content: content,
                    sha: sha
                })
            });

            if (putRes.ok) {
                Utils.showToast("Sincronización exitosa.", "success");
            } else {
                throw new Error("Error en el PUT de GitHub");
            }
        } catch (error) {
            Utils.showToast("Fallo la sincronización: " + error.message, "danger");
            // Revertir timestamp en caso de error
            AppState.data.config.lastUpdated = new Date(Date.now() - 6 * 60 * 1000).toISOString(); 
        } finally {
            UI.closeModal('modal-sync');
        }
    }
};

// --- LÓGICA DE NEGOCIO ---
const Business = {
    addToCart: (product) => {
        const existing = AppState.cart.find(item => item.id === product.id);
        if (existing) {
            existing.qty += 1;
        } else {
            AppState.cart.push({ ...product, qty: 1 });
        }
        UI.renderCart();
    },
    calculateTotals: () => {
        let subE = 0, subG = 0, iva = 0;
        const rate = AppState.data.config.defaultTaxRate / 100;
        
        AppState.cart.forEach(item => {
            const lineTotal = item.price * item.qty;
            if (item.tax === "G") {
                subG += lineTotal;
                iva += lineTotal * rate;
            } else {
                subE += lineTotal;
            }
        });
        
        return { subE, subG, iva, total: subE + subG + iva };
    },
    generateInvoiceRecord: () => {
        if (AppState.cart.length === 0) return null;
        
        const store = Utils.getActiveStore();
        const totals = Business.calculateTotals();
        const num = Utils.generatePad(AppState.data.config.lastInvoiceNumber++, 8);
        const inv = {
            numero: num,
            fecha: new Date().toLocaleDateString('es-VE'),
            hora: new Date().toLocaleTimeString('es-VE'),
            cliente: "CONSUMIDOR FINAL",
            rif: "V-000000000",
            storeId: store.id,
            tasaIva: AppState.data.config.defaultTaxRate,
            ...totals,
            items: JSON.parse(JSON.stringify(AppState.cart))
        };
        
        AppState.data.invoices.push(inv);
        Storage.saveLocal();
        return inv;
    },
    processCheckout: () => {
        const inv = Business.generateInvoiceRecord();
        if (!inv) return;
        
        UI.fillPrintTicket(inv, false);
        window.print();
        
        AppState.cart = [];
        UI.renderCart();
    }
};

// --- INTERFAZ DE USUARIO ---
const UI = {
    initStoreSelector: () => {
        const selector = document.getElementById('store-selector');
        selector.innerHTML = '';
        
        if (AppState.data.config.stores) {
            AppState.data.config.stores.forEach(store => {
                const opt = document.createElement('option');
                opt.value = store.id;
                opt.textContent = store.name;
                if (store.id === AppState.data.config.activeStoreId) {
                    opt.selected = true;
                }
                selector.appendChild(opt);
            });
        }
        
        selector.addEventListener('change', (e) => {
            AppState.data.config.activeStoreId = e.target.value;
            Storage.saveLocal();
        });
    },
    renderProducts: (filter = "") => {
        const grid = document.getElementById('products-grid');
        grid.innerHTML = '';
        const lowerFilter = filter.toLowerCase();
        
        AppState.data.products.filter(p => 
            p.name.toLowerCase().includes(lowerFilter) || p.id.includes(lowerFilter)
        ).forEach(p => {
            const card = document.createElement('div');
            card.className = 'product-card';
            card.innerHTML = `
                <div class="product-name">${Utils.escapeHtml(p.name)}</div>
                <div class="product-price">Bs ${Utils.formatCurrency(p.price)}</div>
            `;
            card.onclick = () => Business.addToCart(p);
            grid.appendChild(card);
        });
    },
    renderCart: () => {
        const container = document.getElementById('cart-items');
        container.innerHTML = '';
        
        AppState.cart.forEach((item, index) => {
            const el = document.createElement('div');
            el.className = 'cart-item';
            el.innerHTML = `
                <div style="flex: 1;">
                    <div style="font-weight: 600;">${Utils.escapeHtml(item.name)}</div>
                    <div style="font-size: 0.85rem; color: #666;">${item.qty} x Bs ${Utils.formatCurrency(item.price)} (${item.tax})</div>
                </div>
                <div style="font-weight: bold;">Bs ${Utils.formatCurrency(item.price * item.qty)}</div>
            `;
            container.appendChild(el);
        });
        
        const totals = Business.calculateTotals();
        document.getElementById('cart-count').innerText = `${AppState.cart.reduce((sum, i) => sum + i.qty, 0)} items`;
        document.getElementById('cart-subtotal').innerText = `Bs ${Utils.formatCurrency(totals.subE + totals.subG)}`;
        document.getElementById('cart-tax').innerText = `Bs ${Utils.formatCurrency(totals.iva)}`;
        document.getElementById('cart-total').innerText = `Bs ${Utils.formatCurrency(totals.total)}`;
    },
    fillPrintTicket: (inv, isReprint) => {
        const store = Utils.getActiveStore();
        
        // Datos Sucursal
        document.getElementById('t-store-rif').innerText = store ? store.rif : "";
        document.getElementById('t-store-name').innerText = store ? store.name.toUpperCase() : "";
        document.getElementById('t-store-address').innerText = store ? store.address : "";
        document.getElementById('t-store-phone').innerText = store ? store.phone : "";

        // Metadatos
        document.getElementById('t-date').innerText = inv.fecha;
        document.getElementById('t-time').innerText = inv.hora;
        document.getElementById('t-invoice-num').innerText = inv.numero;
        document.getElementById('t-ticket-num').innerText = inv.numero; 
        
        document.getElementById('t-reprint-mark').style.display = isReprint ? 'inline' : 'none';

        // Items
        const tItemsBody = document.getElementById('t-items');
        tItemsBody.innerHTML = inv.items.map(item => `
            <tr>
                <td class="col-desc">${item.qty} x ${Utils.escapeHtml(item.name)} (${item.tax})<br>|${item.id}|</td>
                <td class="col-price">Bs ${Utils.formatCurrency(item.price * item.qty)}</td>
            </tr>
        `).join('');

        // Totales
        const tr = inv.tasaIva.toFixed(2);
        document.getElementById('t-tax-rate').innerText = tr;
        document.getElementById('t-tax-rate2').innerText = tr;
        
        document.getElementById('t-bi').innerText = Utils.formatCurrency(inv.subG);
        document.getElementById('t-iva').innerText = Utils.formatCurrency(inv.iva);
        document.getElementById('t-exe').innerText = Utils.formatCurrency(inv.subE);
        document.getElementById('t-total').innerText = Utils.formatCurrency(inv.total);
        document.getElementById('t-efectivo').innerText = Utils.formatCurrency(inv.total);

        // Códigos de control
        const codes = store && store.controlCodes ? store.controlCodes : [];
        document.getElementById('t-control-codes').innerHTML = codes.join('<br>');

        // Barcode Compuesto
        const barcodeStr = `${inv.numero}|${inv.fecha}|${inv.total.toFixed(2)}`;
        JsBarcode(document.getElementById('barcode'), barcodeStr, { 
            format: "CODE128", 
            width: 1.5, 
            height: 40, 
            displayValue: false, 
            margin: 0 
        });
    },
    showModal: (id) => document.getElementById(id).style.display = 'flex',
    closeModal: (id) => document.getElementById(id).style.display = 'none'
};

// --- EVENTOS E INICIALIZACIÓN ---
document.getElementById('auth-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (evt) => {
        try {
            const json = JSON.parse(evt.target.result);
            if (json.accessKey === CONFIG.AUTH_KEY && json.githubToken) {
                AppState.token = json.githubToken;
                document.getElementById('auth-screen').style.display = 'none';
                document.getElementById('app-screen').style.display = 'block';
                Storage.initDataFlow();
            } else {
                Utils.showToast("Llave inválida.", "danger");
            }
        } catch (error) {
            Utils.showToast("Archivo corrupto.", "danger");
        }
    };
    reader.readAsText(file);
});

document.getElementById('search-input').addEventListener('input', (e) => {
    UI.renderProducts(e.target.value);
});

document.getElementById('btn-checkout').addEventListener('click', () => {
    if (AppState.cart.length > 0) Business.processCheckout();
});

document.getElementById('btn-sync').addEventListener('click', () => {
    API.publishData();
});

document.getElementById('btn-logout').addEventListener('click', () => {
    AppState.token = null;
    document.getElementById('app-screen').style.display = 'none';
    document.getElementById('auth-screen').style.display = 'flex';
    document.getElementById('auth-file').value = '';
});

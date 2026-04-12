/**
 * SISTEMA POS PROFESIONAL - Vanilla JS
 * Versión con multi-sucursal, nuevo ticket, rate limiting de 5 min.
 */

// --- CONFIGURACIÓN CONSTANTE ---
const CONFIG = {
    AUTH_KEY: "00TANGOECHOSOECHONOVEMBER1039",
    GITHUB_API_URL: "https://api.github.com/repos/www-globalservice/www-globalservice.github.io/contents/FM/bd.json",
    GITHUB_RAW_URL: "https://www-globalservice.github.io/FM/bd.json",
    LOCAL_STORAGE_KEY: "pos_db_data",
    PUBLISH_COOLDOWN_MIN: 5      // minutos de espera entre publicaciones
};

// --- ESTADO GLOBAL (Memoria) ---
const AppState = {
    token: null,
    data: {
        products: [],
        invoices: [],
        config: { lastInvoiceNumber: 1, defaultTaxRate: 12, boxNumber: "01", lastUpdated: "", activeBranchId: null },
        branches: []
    },
    cart: [],
    selectedProductTemp: null,
    publishHistory: []
};

// --- UTILIDADES ---
const Utils = {
    formatCurrency: (val) => Number(val).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    parseCurrency: (val) => parseFloat(val),
    escapeHtml: (str) => {
        if (!str) return '';
        return String(str).replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
    },
    generatePad: (num, size) => String(num).padStart(size, '0'),
    utf8ToBase64: (str) => btoa(unescape(encodeURIComponent(str))),
    
    showToast: (message, type = 'info') => {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        const icons = { success: 'fa-check-circle', error: 'fa-exclamation-triangle', info: 'fa-info-circle', warning: 'fa-exclamation-circle' };
        toast.innerHTML = `<i class="fas ${icons[type]}"></i> <span>${message}</span>`;
        container.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('fade-out');
            toast.addEventListener('animationend', () => toast.remove());
        }, 4000);
    },
    
    getISODate: () => new Date().toISOString(),

    // Genera código TAXAC alfanumérico de 12 caracteres (determinístico)
    generateTaxacCode: (invoice, branchSeed = '') => {
        const data = `${invoice.numero}|${Math.floor(invoice.total * 100)}|${branchSeed}`;
        let hash = 0;
        for (let i = 0; i < data.length; i++) {
            hash = ((hash << 5) - hash) + data.charCodeAt(i);
            hash |= 0;
        }
        const positiveHash = Math.abs(hash);
        const code = positiveHash.toString(36).slice(0, 12).toUpperCase().padEnd(12, 'X');
        return `TAXAC: ${code}`;
    }
};

// --- MÓDULO API GITHUB ---
const API = {
    async fetchRemoteData(cacheBust = true) {
        const url = cacheBust ? `${CONFIG.GITHUB_RAW_URL}?t=${new Date().getTime()}` : CONFIG.GITHUB_RAW_URL;
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error('Error al descargar bd.json');
            return await res.json();
        } catch (e) {
            console.error(e);
            return null;
        }
    },

    async publishData() {
        if (!AppState.token) {
            Utils.showToast("No autorizado. Token ausente.", "error");
            return false;
        }

        // === RATE LIMITING BASADO EN lastUpdated ===
        const lastUpdated = AppState.data.config.lastUpdated;
        if (lastUpdated) {
            const last = new Date(lastUpdated).getTime();
            const now = Date.now();
            const diffMinutes = (now - last) / (1000 * 60);
            if (diffMinutes < CONFIG.PUBLISH_COOLDOWN_MIN) {
                const remainingSeconds = Math.floor((CONFIG.PUBLISH_COOLDOWN_MIN - diffMinutes) * 60);
                const minutes = Math.floor(remainingSeconds / 60);
                const seconds = remainingSeconds % 60;
                Utils.showToast(`Publicación bloqueada. Debes esperar ${minutes}m ${seconds}s para volver a publicar.`, "warning");
                return false;
            }
        }

        try {
            // Obtener SHA actual
            const getRes = await fetch(CONFIG.GITHUB_API_URL, {
                headers: { 'Authorization': `token ${AppState.token}` }
            });
            if (!getRes.ok) throw new Error("No se pudo obtener el archivo del repositorio. Verifica el token y permisos.");
            const getJson = await getRes.json();
            const sha = getJson.sha;

            // Actualizar timestamp JUSTO antes de publicar
            AppState.data.config.lastUpdated = Utils.getISODate();
            Storage.saveLocal();

            // Preparar payload (PUT)
            const contentString = JSON.stringify(AppState.data, null, 2);
            const contentBase64 = Utils.utf8ToBase64(contentString);

            const putRes = await fetch(CONFIG.GITHUB_API_URL, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${AppState.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: "Actualización automática desde POS",
                    content: contentBase64,
                    sha: sha
                })
            });

            if (!putRes.ok) {
                const errData = await putRes.json();
                throw new Error(errData.message || "Error al realizar el commit.");
            }

            Utils.showToast("Cambios publicados. GitHub Pages puede tardar hasta 3 min en reflejar la actualización.", "success");
            return true;
        } catch (e) {
            console.error(e);
            Utils.showToast(e.message, "error");
            return false;
        }
    }
};

// --- MÓDULO ALMACENAMIENTO ---
const Storage = {
    hasLocalData: () => !!localStorage.getItem(CONFIG.LOCAL_STORAGE_KEY),
    
    loadLocal: () => {
        try {
            const raw = localStorage.getItem(CONFIG.LOCAL_STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                AppState.data = parsed;
                // Asegurar que existan branches y activeBranchId
                if (!AppState.data.branches) {
                    AppState.data.branches = [
                        { id: "farma1", name: "FARMACIA CEREZOS", legalName: "FARMATODO, C.A.", rif: "J-00020200-1", address: { street: "Av Los Guayabitos", center: "CC Expreso Baruta", level: "Nivel 5 Of Unica", urbanization: "Urb La Trinidad", city: "Caracas", phone: "0281-2780820" }, taxacSeed: "IGTVDF4L1KRB" },
                        { id: "farma2", name: "FARMACIA LOS SAMANES", legalName: "FARMATODO, C.A.", rif: "J-00020201-2", address: { street: "Av Principal de Los Samanes", center: "CC Los Samanes", level: "PB Local 4", urbanization: "Los Samanes", city: "Maracay", phone: "0243-1234567" }, taxacSeed: "A1B2C3D4E5F6" }
                    ];
                }
                if (!AppState.data.config.activeBranchId) {
                    AppState.data.config.activeBranchId = AppState.data.branches[0]?.id || "farma1";
                }
                if (!AppState.data.config.lastUpdated) AppState.data.config.lastUpdated = "";
            }
        } catch (e) {
            console.error("Error parseando localStorage", e);
        }
    },
    
    saveLocal: () => {
        localStorage.setItem(CONFIG.LOCAL_STORAGE_KEY, JSON.stringify(AppState.data));
        UI.updateSystemStatus();
    },

    async initDataFlow() {
        const hasLocal = this.hasLocalData();
        if (hasLocal) {
            this.loadLocal();
            document.getElementById('modal-sync').classList.add('active');
        } else {
            Utils.showToast("Primera ejecución o caché vacío. Descargando datos...", "info");
            const remoteData = await API.fetchRemoteData();
            if (remoteData) {
                AppState.data = remoteData;
                // Validar estructura
                if (!AppState.data.branches) AppState.data.branches = [];
                if (!AppState.data.config.activeBranchId && AppState.data.branches.length) AppState.data.config.activeBranchId = AppState.data.branches[0].id;
                this.saveLocal();
                UI.renderAll();
                Utils.showToast("Base de datos sincronizada", "success");
            } else {
                Utils.showToast("Error fatal: No se pudo obtener la BD inicial", "error");
                this.saveLocal();
                UI.renderAll();
            }
        }
    }
};

// --- MÓDULO NEGOCIO (POS & BD) ---
const Business = {
    addToCart(product, qty) {
        if (product.suspended) {
            Utils.showToast("Este producto está suspendido y no puede venderse.", "error");
            return;
        }
        const existing = AppState.cart.find(i => i.id === product.id);
        if (existing) existing.qty += qty;
        else AppState.cart.push({ ...product, qty });
    },
    
    removeFromCart(id) {
        AppState.cart = AppState.cart.filter(i => i.id !== id);
    },
    
    clearCart() {
        AppState.cart = [];
    },

    calculateTotals(taxRate) {
        let subG = 0, subE = 0;
        AppState.cart.forEach(item => {
            const line = item.price * item.qty;
            if (item.tax === 'G') subG += line;
            else subE += line;
        });
        const iva = subG * (taxRate / 100);
        return { subG, subE, iva, total: subG + subE + iva };
    },

    generateInvoiceRecord(client, rif, taxRate) {
        const { subG, subE, iva, total } = this.calculateTotals(taxRate);
        const now = new Date();
        // Número de factura de 9 dígitos (ej. 115005451)
        const invoiceNum = Utils.generatePad(AppState.data.config.lastInvoiceNumber, 9);
        
        const record = {
            numero: invoiceNum,
            fecha: now.toLocaleDateString('es-VE'),
            hora: now.toLocaleTimeString('es-VE', {hour:'2-digit', minute:'2-digit'}),
            cliente: client || 'CONSUMIDOR FINAL',
            rif: rif || 'V-000000000',
            tasaIva: taxRate,
            subG, subE, iva, total,
            items: AppState.cart.map(i => ({ id: i.id, name: i.name, qty: i.qty, price: i.price, tax: i.tax }))
        };

        AppState.data.invoices.unshift(record);
        AppState.data.config.lastInvoiceNumber++;
        Storage.saveLocal();
        return record;
    },

    saveProduct(prodObj) {
        const index = AppState.data.products.findIndex(p => p.id === prodObj.id);
        if (index > -1) {
            AppState.data.products[index] = { ...AppState.data.products[index], ...prodObj };
        } else {
            AppState.data.products.push({ ...prodObj, suspended: false });
        }
        Storage.saveLocal();
    },

    deleteProduct(id) {
        AppState.data.products = AppState.data.products.filter(p => p.id !== id);
        Storage.saveLocal();
    },

    toggleProductStatus(id) {
        const p = AppState.data.products.find(p => p.id === id);
        if (p) {
            p.suspended = !p.suspended;
            Storage.saveLocal();
        }
    }
};

// --- INTERFAZ DE USUARIO ---
const UI = {
    initListeners() {
        document.getElementById('auth-file').addEventListener('change', this.handleAuthFile.bind(this));

        document.querySelectorAll('.nav-btn[data-target]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.nav-btn[data-target]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
                document.getElementById(btn.dataset.target).classList.add('active');
            });
        });

        document.getElementById('btn-publish-github').addEventListener('click', async (e) => {
            const btn = e.currentTarget;
            btn.disabled = true;
            btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> <span>Publicando...</span>`;
            await API.publishData();
            btn.disabled = false;
            btn.innerHTML = `<i class="fas fa-cloud-upload-alt"></i> <span>Publicar</span>`;
        });

        document.getElementById('btn-sync-local').addEventListener('click', () => {
            Storage.loadLocal();
            UI.closeModal('modal-sync');
            UI.renderAll();
            Utils.showToast("Cargando base de datos local", "info");
        });
        document.getElementById('btn-sync-remote').addEventListener('click', async () => {
            UI.closeModal('modal-sync');
            Utils.showToast("Descargando desde GitHub...", "info");
            const remote = await API.fetchRemoteData();
            if (remote) {
                AppState.data = remote;
                if (!AppState.data.branches) AppState.data.branches = [];
                if (!AppState.data.config.activeBranchId && AppState.data.branches.length) AppState.data.config.activeBranchId = AppState.data.branches[0].id;
                Storage.saveLocal();
                UI.renderAll();
                Utils.showToast("Base de datos actualizada", "success");
            } else {
                Utils.showToast("Error al conectar. Usando copia local.", "error");
                UI.renderAll();
            }
        });

        // Selector de sucursal
        const branchSelect = document.getElementById('branch-select');
        branchSelect.addEventListener('change', (e) => {
            AppState.data.config.activeBranchId = e.target.value;
            Storage.saveLocal();
            Utils.showToast(`Sucursal cambiada a ${e.target.options[e.target.selectedIndex].text}`, "info");
        });

        // POS Autocomplete
        const searchInput = document.getElementById('pos-search');
        searchInput.addEventListener('input', (e) => this.handlePosSearch(e.target.value));
        document.addEventListener('click', e => { if(!searchInput.contains(e.target)) document.getElementById('pos-suggestions').style.display='none'; });

        document.getElementById('btn-add-cart').addEventListener('click', () => this.handleAddToCart());
        document.getElementById('btn-cancel-sale').addEventListener('click', () => {
            Business.clearCart();
            this.renderCart();
            Utils.showToast("Venta cancelada", "info");
        });
        document.getElementById('btn-emit-invoice').addEventListener('click', () => this.handleEmitInvoice());

        document.getElementById('db-search').addEventListener('input', (e) => this.renderDBTable(e.target.value));
        document.getElementById('btn-open-new-prod').addEventListener('click', () => {
            document.getElementById('form-product').reset();
            document.getElementById('form-prod-original-id').value = '';
            document.getElementById('form-prod-id').disabled = false;
            document.getElementById('modal-product-title').innerText = "Nuevo Producto";
            document.getElementById('modal-product').classList.add('active');
        });
        document.getElementById('form-product').addEventListener('submit', this.handleSaveProduct.bind(this));
    },

    handleAuthFile(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const creds = JSON.parse(ev.target.result);
                if (creds.accessKey === CONFIG.AUTH_KEY && creds.githubToken) {
                    AppState.token = creds.githubToken;
                    document.getElementById('auth-screen').style.display = 'none';
                    document.getElementById('app-screen').style.display = 'flex';
                    Utils.showToast("Autenticación exitosa", "success");
                    Storage.initDataFlow();
                } else {
                    Utils.showToast("Llave de seguridad inválida", "error");
                }
            } catch (err) {
                Utils.showToast("Archivo corrupto o formato incorrecto", "error");
            }
            e.target.value = '';
        };
        reader.readAsText(file);
    },

    populateBranchSelector() {
        const select = document.getElementById('branch-select');
        if (!select) return;
        select.innerHTML = '';
        if (AppState.data.branches && AppState.data.branches.length) {
            AppState.data.branches.forEach(b => {
                const option = document.createElement('option');
                option.value = b.id;
                option.textContent = b.name;
                if (AppState.data.config.activeBranchId === b.id) option.selected = true;
                select.appendChild(option);
            });
        } else {
            const option = document.createElement('option');
            option.value = "default";
            option.textContent = "Sucursal por defecto";
            select.appendChild(option);
        }
    },

    handlePosSearch(term) {
        term = term.trim().toLowerCase();
        const suggBox = document.getElementById('pos-suggestions');
        if (!term) { suggBox.style.display = 'none'; return; }
        const filtered = AppState.data.products
            .filter(p => !p.suspended && (p.id.toLowerCase().includes(term) || p.name.toLowerCase().includes(term)))
            .slice(0, 8);
        if (filtered.length) {
            suggBox.innerHTML = filtered.map(p => `
                <li onclick="UI.selectSearchResult('${p.id}')">
                    <span style="display:flex; flex-direction:column;">
                        <strong style="color:var(--color-primary);">${p.id}</strong>
                        <span>${Utils.escapeHtml(p.name)}</span>
                    </span>
                    <strong style="white-space:nowrap;">Bs ${Utils.formatCurrency(p.price)}</strong>
                </li>
            `).join('');
            suggBox.style.display = 'block';
        } else {
            suggBox.style.display = 'none';
        }
    },

    selectSearchResult(id) {
        const p = AppState.data.products.find(p => p.id === id);
        if (p) {
            document.getElementById('pos-search').value = p.id;
            AppState.selectedProductTemp = p;
        }
        document.getElementById('pos-suggestions').style.display = 'none';
        document.getElementById('pos-qty').focus();
    },

    handleAddToCart() {
        const searchVal = document.getElementById('pos-search').value.trim();
        let prod = AppState.selectedProductTemp;
        if (!prod || prod.id !== searchVal) {
            prod = AppState.data.products.find(p => p.id === searchVal && !p.suspended);
            if (!prod) {
                Utils.showToast("Producto no encontrado o suspendido", "error");
                return;
            }
        }
        const qty = parseInt(document.getElementById('pos-qty').value);
        if (isNaN(qty) || qty <= 0) return;
        Business.addToCart(prod, qty);
        AppState.selectedProductTemp = null;
        document.getElementById('pos-search').value = '';
        document.getElementById('pos-qty').value = '1';
        document.getElementById('pos-search').focus();
        this.renderCart();
    },

    handleEmitInvoice() {
        if (!AppState.cart.length) {
            Utils.showToast("El ticket está vacío", "warning");
            return;
        }
        const client = document.getElementById('pos-client-name').value.trim().toUpperCase();
        const rif = document.getElementById('pos-client-rif').value.trim().toUpperCase();
        const taxRate = AppState.data.config.defaultTaxRate || 12;
        const record = Business.generateInvoiceRecord(client, rif, taxRate);
        this.fillPrintTicket(record, false);
        window.print();
        Business.clearCart();
        this.renderCart();
        this.renderHistory();
        this.updateSystemStatus();
        document.getElementById('pos-client-name').value = 'Consumidor Final';
        document.getElementById('pos-client-rif').value = 'V-000000000';
    },

    handleSaveProduct(e) {
        e.preventDefault();
        const origId = document.getElementById('form-prod-original-id').value;
        const newId = document.getElementById('form-prod-id').value.trim();
        if ((origId === '' || origId !== newId) && AppState.data.products.find(p => p.id === newId)) {
            Utils.showToast("El Código SKU ya existe en la base de datos.", "error");
            return;
        }
        const prod = {
            id: newId,
            name: document.getElementById('form-prod-name').value.trim().toUpperCase(),
            price: parseFloat(document.getElementById('form-prod-price').value),
            tax: document.getElementById('form-prod-tax').value,
            stockMin: 0
        };
        if (origId && origId !== newId) {
            const oldProd = AppState.data.products.find(p => p.id === origId);
            if (oldProd) prod.suspended = oldProd.suspended;
            Business.deleteProduct(origId);
        }
        Business.saveProduct(prod);
        this.closeModal('modal-product');
        this.renderDBTable();
        Utils.showToast("Producto guardado", "success");
    },

    renderAll() {
        this.populateBranchSelector();
        this.updateSystemStatus();
        this.renderCart();
        this.renderHistory();
        this.renderDBTable();
    },

    updateSystemStatus() {
        document.getElementById('sys-last-update').innerText = AppState.data.config.lastUpdated 
            ? new Date(AppState.data.config.lastUpdated).toLocaleString('es-VE') 
            : 'Nunca';
        document.getElementById('sys-next-ticket').innerText = Utils.generatePad(AppState.data.config.lastInvoiceNumber, 9);
        document.getElementById('pos-display-tax').innerText = AppState.data.config.defaultTaxRate || 12;
    },

    renderCart() {
        const container = document.getElementById('cart-items-container');
        if (!AppState.cart.length) {
            container.innerHTML = '<div style="color:var(--color-text-muted); text-align:center; margin-top:20px;">No hay artículos</div>';
        } else {
            container.innerHTML = AppState.cart.map(item => `
                <div class="list-item cart-item">
                    <div class="item-details" style="flex:1;">
                        <strong>${Utils.escapeHtml(item.name)}</strong>
                        <span style="color:var(--color-text-muted); font-size:0.75rem;">${item.id} | Imp: ${item.tax}</span>
                    </div>
                    <div style="margin: 0 16px; text-align:center;">
                        <div style="font-weight:700;">x${item.qty}</div>
                        <div style="font-size:0.7rem; color:var(--color-text-muted);">Bs ${Utils.formatCurrency(item.price)} c/u</div>
                    </div>
                    <div class="item-price" style="width: 80px;">Bs ${Utils.formatCurrency(item.qty * item.price)}</div>
                    <button class="btn-icon delete" onclick="UI.removeCartItem('${item.id}')" style="margin-left: 8px;"><i class="fas fa-trash"></i></button>
                </div>
            `).join('');
        }
        const taxRate = AppState.data.config.defaultTaxRate || 12;
        const { subG, subE, iva, total } = Business.calculateTotals(taxRate);
        document.getElementById('cart-subg').innerText = `Bs ${Utils.formatCurrency(subG)}`;
        document.getElementById('cart-sube').innerText = `Bs ${Utils.formatCurrency(subE)}`;
        document.getElementById('cart-iva').innerText = `Bs ${Utils.formatCurrency(iva)}`;
        document.getElementById('cart-total').innerText = `Bs ${Utils.formatCurrency(total)}`;
    },

    removeCartItem(id) {
        Business.removeFromCart(id);
        this.renderCart();
    },

    renderHistory() {
        const list = document.getElementById('history-list');
        if (!AppState.data.invoices.length) {
            list.innerHTML = '<div style="padding:10px; color:var(--color-text-muted);">Sin transacciones.</div>';
            return;
        }
        list.innerHTML = AppState.data.invoices.slice(0, 20).map(inv => `
            <div class="list-item history-item" onclick="UI.showInvoiceDetail('${inv.numero}')">
                <div class="item-details">
                    <strong style="color:var(--color-primary);">#${inv.numero}</strong>
                    <span>${Utils.escapeHtml(inv.cliente)}</span>
                    <span style="color:var(--color-text-muted); font-size:0.7rem;">${inv.fecha} ${inv.hora}</span>
                </div>
                <div class="item-price" style="color:var(--color-success);">Bs ${Utils.formatCurrency(inv.total)}</div>
            </div>
        `).join('');
    },

    renderDBTable(filterTerm = '') {
        const tbody = document.getElementById('db-table-body');
        let products = AppState.data.products;
        if (filterTerm) {
            const term = filterTerm.toLowerCase();
            products = products.filter(p => p.id.toLowerCase().includes(term) || p.name.toLowerCase().includes(term));
        }
        tbody.innerHTML = products.map(p => `
            <tr>
                <td><strong>${p.id}</strong></td>
                <td>${Utils.escapeHtml(p.name)}</td>
                <td>Bs ${Utils.formatCurrency(p.price)}</td>
                <td><span class="badge ${p.tax === 'G' ? 'badge-g' : 'badge-e'}">${p.tax}</span></td>
                <td><span class="badge ${p.suspended ? 'badge-suspended' : 'badge-active'}">${p.suspended ? 'Suspendido' : 'Activo'}</span></td>
                <td style="text-align:right;">
                    <div class="actions-cell" style="justify-content: flex-end;">
                        <button class="btn-icon" onclick="UI.editProduct('${p.id}')" title="Editar"><i class="fas fa-edit"></i></button>
                        <button class="btn-icon" onclick="Business.toggleProductStatus('${p.id}'); UI.renderDBTable('${document.getElementById('db-search').value.replace(/'/g,"\\'")}');" title="${p.suspended ? 'Activar' : 'Suspender'}"><i class="fas ${p.suspended ? 'fa-play' : 'fa-pause'}" style="color:${p.suspended ? 'var(--color-success)' : 'var(--color-warning)'}"></i></button>
                        <button class="btn-icon delete" onclick="if(confirm('¿Eliminar producto definitivamente?')) { Business.deleteProduct('${p.id}'); UI.renderDBTable('${document.getElementById('db-search').value.replace(/'/g,"\\'")}'); }" title="Eliminar"><i class="fas fa-trash-alt"></i></button>
                    </div>
                </td>
            </tr>
        `).join('');
    },

    editProduct(id) {
        const p = AppState.data.products.find(x => x.id === id);
        if (!p) return;
        document.getElementById('form-prod-original-id').value = p.id;
        document.getElementById('form-prod-id').value = p.id;
        document.getElementById('form-prod-id').disabled = true;
        document.getElementById('form-prod-name').value = p.name;
        document.getElementById('form-prod-price').value = p.price;
        document.getElementById('form-prod-tax').value = p.tax;
        document.getElementById('modal-product-title').innerText = "Editar Producto";
        document.getElementById('modal-product').classList.add('active');
    },

    showInvoiceDetail(numero) {
        const inv = AppState.data.invoices.find(i => i.numero === numero);
        if (!inv) return;
        document.getElementById('inv-det-num').innerText = `#${inv.numero}`;
        document.getElementById('inv-det-cli').innerText = inv.cliente;
        document.getElementById('inv-det-rif').innerText = inv.rif;
        document.getElementById('inv-det-date').innerText = `${inv.fecha} ${inv.hora}`;
        document.getElementById('inv-det-items').innerHTML = inv.items.map(item => `
            <tr>
                <td>${item.qty}</td>
                <td>${Utils.escapeHtml(item.name)} <br><span style="font-size:0.7rem;color:#666;">${item.id} (${item.tax})</span></td>
                <td style="text-align:right;">Bs ${Utils.formatCurrency(item.qty * item.price)}</td>
            </tr>
        `).join('');
        document.getElementById('inv-det-total').innerText = `Bs ${Utils.formatCurrency(inv.total)}`;
        const btnReprint = document.getElementById('btn-reprint-invoice');
        btnReprint.onclick = () => {
            this.fillPrintTicket(inv, true);
            window.print();
        };
        document.getElementById('modal-invoice').classList.add('active');
    },

    fillPrintTicket(inv, isReprint) {
        // Obtener sucursal activa
        let branch = AppState.data.branches.find(b => b.id === AppState.data.config.activeBranchId);
        if (!branch && AppState.data.branches.length) branch = AppState.data.branches[0];
        if (!branch) {
            branch = { name: "Sucursal no definida", rif: "J-00000000-0", address: { street: "", center: "", level: "", urbanization: "", city: "", phone: "" }, taxacSeed: "" };
        }
        const addressLine1 = `${branch.address.street} ${branch.address.center}`.trim();
        const addressLine2 = `${branch.address.level} ${branch.address.urbanization} ${branch.address.city}`.trim();
        
        document.getElementById('t-branch-rif').innerText = `RIF: ${branch.rif}`;
        document.getElementById('t-branch-name').innerText = branch.name;
        document.getElementById('t-branch-address1').innerText = addressLine1;
        document.getElementById('t-branch-address2').innerText = addressLine2;
        document.getElementById('t-branch-phone').innerText = branch.address.phone;
        
        document.getElementById('t-invoice-num').innerText = inv.numero;
        document.getElementById('t-date').innerText = inv.fecha;
        document.getElementById('t-time').innerText = inv.hora;
        document.getElementById('t-client-name').innerText = inv.cliente;
        document.getElementById('t-client-rif').innerText = inv.rif;
        
        const tItemsBody = document.getElementById('t-items');
        tItemsBody.innerHTML = inv.items.map(item => `
            <tr>
                <td class="col-desc">${item.qty} x ${Utils.escapeHtml(item.name)} (${item.tax})</td>
                <td class="col-price" style="text-align:right;">Bs ${Utils.formatCurrency(item.price * item.qty)}</td>
            </tr>
        `).join('');
        
        const taxRate = inv.tasaIva.toFixed(2);
        document.getElementById('t-tax-rate').innerText = taxRate;
        document.getElementById('t-bi').innerText = Utils.formatCurrency(inv.subG);
        document.getElementById('t-iva').innerText = Utils.formatCurrency(inv.iva);
        document.getElementById('t-exe').innerText = Utils.formatCurrency(inv.subE);
        document.getElementById('t-total').innerText = Utils.formatCurrency(inv.total);
        
        const taxacCode = Utils.generateTaxacCode(inv, branch.taxacSeed);
        document.getElementById('t-taxac-code').innerText = taxacCode;
        
        // Generar código de barras con el mismo texto TAXAC
        try {
            JsBarcode(document.getElementById('barcode'), taxacCode, { format: "CODE128", width: 2, height: 35, displayValue: false, margin: 0 });
        } catch(e) { console.warn("Barcode error", e); }
        
        // Opcional: mostrar texto de reimpresión
        const reprintMark = document.getElementById('t-reprint-mark');
        if (reprintMark) reprintMark.style.display = isReprint ? 'inline' : 'none';
    },

    closeModal(id) {
        document.getElementById(id).classList.remove('active');
    }
};

// --- INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', () => {
    UI.initListeners();
});

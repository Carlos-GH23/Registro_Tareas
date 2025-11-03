document.addEventListener('DOMContentLoaded', () => {
    // DB
    const db = new PouchDB('tareas');

    // UI
    const form = document.getElementById('form');
    const inputName = document.getElementById('nombre');
    const inputFecha = document.getElementById('fecha');
    const eNombre = document.getElementById('eNombre');
    const eFecha = document.getElementById('eFecha');
    const listaPend = document.getElementById('listaPendientes');
    const listaHechas = document.getElementById('listaHechas');
    const btnExport = document.getElementById('btnExport');
    const btnImport = document.getElementById('btnImport');
    const fileInput = document.getElementById('fileInput');

    // PWA Install banner
    let deferredPrompt = null;
    const installBanner = document.getElementById('installBanner');
    const installBtn = document.getElementById('installBtn');

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        if (installBanner) installBanner.classList.add('show');
    });

    installBtn?.addEventListener('click', async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        await deferredPrompt.userChoice;
        deferredPrompt = null;
        if (installBanner) installBanner.classList.remove('show');
    });

    // --- Validación ---
    function setErr(input, el, msg) {
        input.classList.add('invalid');
        el.textContent = msg;
    }
    function clearErr(input, el) {
        input.classList.remove('invalid');
        el.textContent = '';
    }
    function validateFields() {
        const nombre = (inputName.value || '').trim();
        const fecha = inputFecha.value || '';
        let ok = true;

        if (!nombre) { setErr(inputName, eNombre, 'Ingresa el nombre de la tarea.'); ok = false; }
        else { clearErr(inputName, eNombre); }

        if (!fecha) { setErr(inputFecha, eFecha, 'Selecciona una fecha.'); ok = false; }
        else { clearErr(inputFecha, eFecha); }

        return ok;
    }
    // Validación en vivo
    inputName.addEventListener('input', () => validateFields());
    inputFecha.addEventListener('change', () => validateFields());

    // Crear tarea
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!validateFields()) return;

        const tarea = {
            _id: new Date().toISOString(),
            nombre: (inputName.value || '').trim(),
            fecha: inputFecha.value,
            status: 'pendiente',
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        try {
            await db.put(tarea);
            inputName.value = '';
            inputFecha.value = '';
            validateFields(); // limpia mensajes
            render();
        } catch (err) {
            console.error('Error al agregar tarea', err);
        }
    });

    async function toggleStatus(doc) {
        const next = doc.status === 'pendiente' ? 'hecha' : 'pendiente';
        try {
            await db.put({ ...doc, status: next, updatedAt: Date.now(), _rev: doc._rev });
            render();
        } catch (err) {
            console.error('No se pudo actualizar el estado', err);
        }
    }

    function liTemplate(doc) {
        const li = document.createElement('li');
        const left = document.createElement('div');
        left.style.display = 'grid';
        left.style.gap = '4px';

        const name = document.createElement('div');
        name.className = 'name';
        name.textContent = doc.nombre;

        const meta = document.createElement('div');
        meta.className = 'meta';
        const f = doc.fecha ? new Date(doc.fecha + 'T00:00:00') : null;
        meta.textContent = (f ? f.toLocaleDateString() + ' · ' : '') + (doc.status === 'hecha' ? 'Hecha' : 'Pendiente');

        left.appendChild(name);
        left.appendChild(meta);

        const right = document.createElement('div');
        right.className = 'actions';

        const btnToggle = document.createElement('button');
        btnToggle.className = 'btn-primary';
        btnToggle.textContent = doc.status === 'pendiente' ? 'Marcar hecha ✓' : 'Marcar pendiente ↺';
        btnToggle.addEventListener('click', () => toggleStatus(doc));

        right.appendChild(btnToggle);

        li.appendChild(left);
        li.appendChild(right);
        return li;
    }

    async function render() {
        try {
            const res = await db.allDocs({ include_docs: true, descending: true });
            const docs = res.rows.map(r => r.doc).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

            listaPend.innerHTML = '';
            listaHechas.innerHTML = '';

            docs.forEach(doc => {
                if (doc.status === 'hecha') {
                    listaHechas.appendChild(liTemplate(doc));
                } else {
                    listaPend.appendChild(liTemplate(doc));
                }
            });
        } catch (err) {
            console.error('Error al listar', err);
        }
    }

    // Export/Import
    btnExport.addEventListener('click', async () => {
        const res = await db.allDocs({ include_docs: true });
        const data = res.rows.map(r => r.doc);
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'tareas-backup.json';
        a.click();
        URL.revokeObjectURL(url);
    });

    btnImport.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const text = await file.text();
        const arr = JSON.parse(text);
        for (const doc of arr) {
            try {
                const existing = await db.get(doc._id).catch(() => null);
                if (existing) {
                    await db.put({ ...existing, ...doc, _rev: existing._rev });
                } else {
                    await db.put(doc);
                }
            } catch (err) {
                console.error('No se pudo importar doc', doc._id, err);
            }
        }
        render();
    });

    render();
});

/**
 * optimizer-img.js
 * ----------------
 * • зберігає/завантажує налаштування (localStorage)
 * • обробка зображень (EXIF, масштаб, якість, ренейм)
 * • UI: drag‑&‑drop, прогрес, прев’ю, alerts
 * • ZIP‑/Folder‑експорт
 * • модальне вікно: навігація, swipe, масштабування лише в модалі
 * • глобальний zoom вимкнено
 */

document.addEventListener('DOMContentLoaded', () => {
    /* ---------- Метадані та localStorage ---------- */
    const SETTINGS_KEY = 'img_opt_settings';
    const RENAME_KEY   = 'img_opt_rename_settings';

    const viewportMeta = document.getElementById('viewportMeta');
    const originalViewport = viewportMeta.getAttribute('content');

    // Дабл‑клік → zoom → заборона
    document.addEventListener('dblclick', e => e.preventDefault());

    const loadJSON = key => {
        try { return JSON.parse(localStorage.getItem(key) ?? null); }
        catch { return null; }
    };
    const saveJSON = (key, data) => localStorage.setItem(key, JSON.stringify(data));

    const loadSettings = () => {
        const s = loadJSON(SETTINGS_KEY) ?? {};
        document.getElementById('width').value   = s.width   ?? 0;
        document.getElementById('quality').value = s.quality ?? 80;
        document.getElementById('format').value  = s.format  ?? 'auto';
    };
    const saveSettings = () => {
        const s = {
            width:   +document.getElementById('width').value,
            quality: +document.getElementById('quality').value,
            format:  document.getElementById('format').value
        };
        saveJSON(SETTINGS_KEY, s);
    };
    const loadRenameSettings = () => {
        const s = loadJSON(RENAME_KEY) ?? {};
        renameModeEl.value = s.renameMode ?? 'none';
        document.getElementById('suffix').value   = s.suffix ?? '';
        document.getElementById('newName').value  = s.newName ?? '';
        updateRenameGroups();
    };
    const saveRenameSettings = () => {
        const s = {
            renameMode: renameModeEl.value,
            suffix:     document.getElementById('suffix').value,
            newName:    document.getElementById('newName').value
        };
        saveJSON(RENAME_KEY, s);
    };

    loadSettings();

    /* ---------- Підтримувані типи ---------- */
    const SUPPORTED_INPUTS = new Set([
        'image/jpeg','image/png','image/webp',
        'image/avif','image/bmp','image/gif'
    ]);
    const SUPPORTED_OUTPUTS = new Set([
        'image/jpeg','image/png','image/webp',
        'image/avif','image/bmp'
    ]);

    /* ---------- Утиліти ---------- */
    const readFile = f => new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onload  = () => res(fr.result);
        fr.onerror = rej;
        fr.readAsDataURL(f);
    });
    const bitmapFromFile = async f => {
        const dataURL = await readFile(f);
        const blob    = await (await fetch(dataURL)).blob();
        return await createImageBitmap(blob);
    };
    const bitsPerPixel = (file, bmp) => (file.size * 8) / (bmp.width * bmp.height);
    const shouldSkip = (file, bmp, { maxWidth, mimeOut }) => {
        const bpp = bitsPerPixel(file, bmp);
        const LOW = 0.30;
        const needResize = maxWidth > 0 && bmp.width > maxWidth;
        const lowQuality = bpp <= LOW;
        if (lowQuality && !needResize && mimeOut === file.type) {
            return { skip: true, lowQuality: true, reason: 'low quality' };
        }
        return { skip: false, lowQuality, needResize };
    };
    const applyRenaming = (origFile, idx, renameOpts) => {
        const base = origFile.name.replace(/\.\w+$/, '');
        const ext  = renameOpts.mimeOut && renameOpts.mimeOut !== 'auto'
            ? renameOpts.mimeOut.split('/')[1]
            : origFile.type.split('/')[1];

        if (renameOpts.renameMode === 'append')
            return `${base}${renameOpts.suffix ?? ''}.${ext}`;

        if (renameOpts.renameMode === 'replace') {
            const tmpl = renameOpts.newName?.trim() ?? '';
            if (!tmpl) return `${base}.${ext}`;
            let name = tmpl.replace(/\{orig\}/g, base).replace(/\{num\}/g, idx);
            if (!/\{num\}/.test(tmpl) && idx > 0) name += idx;
            return `${name}.${ext}`;
        }
        return `${base}.${ext}`;
    };
    const processImage = async (file, { maxWidth, quality, mimeOut, renameOpts, index, total }) => {
        if (!SUPPORTED_INPUTS.has(file.type.toLowerCase())) {
            return { blob: null, skipped: true, reason: 'unsupported input format' };
        }
        const desiredMime = mimeOut === 'auto' ? file.type : mimeOut;
        const outMime = SUPPORTED_OUTPUTS.has(desiredMime) ? desiredMime : null;
        if (!outMime) {
            return { blob: null, skipped: true, reason: 'unsupported output format' };
        }

        const bmp = await bitmapFromFile(file);
        const decision = shouldSkip(file, bmp, { maxWidth, mimeOut: outMime });

        if (decision.skip) {
            const copy = file.slice(0, file.size, file.type);
            copy.name = applyRenaming(file, index, { ...renameOpts, mimeOut: outMime });
            return { blob: copy, skipped: true, reason: decision.reason };
        }

        const effectiveQuality = decision.lowQuality && !decision.needResize && outMime === file.type
            ? 1
            : quality / 100;

        const scale = maxWidth > 0 ? Math.min(1, maxWidth / bmp.width) : 1;
        const w = Math.round(bmp.width * scale);
        const h = Math.round(bmp.height * scale);

        const canvas = document.createElement('canvas');
        canvas.width  = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(bmp, 0, 0, w, h);

        return new Promise((resolve, reject) => {
            canvas.toBlob(
                blob => {
                    if (!blob) { reject('toBlob failed'); return; }
                    blob.name = applyRenaming(file, index, { ...renameOpts, mimeOut: outMime });
                    resolve({ blob, skipped: false, reason: null });
                },
                outMime,
                effectiveQuality
            );
        });
    };

    /* ---------- UI‑елементи ---------- */
    const dropzone        = document.getElementById('dropzone');
    const fileInput       = document.getElementById('files');
    const preview         = document.getElementById('preview');
    const progressBar    = document.getElementById('progress');
    const downloadAllBtn  = document.getElementById('downloadAll');
    const saveFolderBtn   = document.getElementById('saveFolder');
    const alertsContainer = document.getElementById('alerts');

    const modal        = document.getElementById('modal');
    const modalImg     = document.getElementById('modalImg');
    const modalClose   = document.getElementById('modalClose');
    const modalPrev    = document.getElementById('modalPrev');
    const modalNext    = document.getElementById('modalNext');
    const modalCounter = document.getElementById('modalCounter');

    const renameModeEl = document.getElementById('renameMode');
    const appendGroup  = document.getElementById('appendGroup');
    const replaceGroup = document.getElementById('replaceGroup');

    let generatedBlobs = [];   // успішно оброблені файли
    let generatedUrls  = [];   // URL‑и для прев’ю
    let currentIndex   = 0;    // індекс у прев’ю‑масиві

    const setProgress = (done, total) => {
        progressBar.style.display = 'block';
        progressBar.textContent = `Оброблено ${done}/${total}`;
        if (done === total) setTimeout(() => (progressBar.style.display = 'none'), 1500);
    };
    const showAlert = (msg, type = 'warning') => {
        const div = document.createElement('div');
        div.className = `alert alert--${type}`;
        const icon = type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️';
        div.innerHTML = `<span>${icon}</span> ${msg}`;
        alertsContainer.appendChild(div);
    };
    const updateRenameGroups = () => {
        const mode = renameModeEl.value;
        appendGroup.classList.toggle('hidden', mode !== 'append');
        replaceGroup.classList.toggle('hidden', mode !== 'replace');
    };
    renameModeEl.addEventListener('change', updateRenameGroups);
    updateRenameGroups();
    loadRenameSettings();
    ['renameMode','suffix','newName'].forEach(id =>
        document.getElementById(id).addEventListener('change', saveRenameSettings)
    );

    /* ---------- Drag‑&‑Drop ---------- */
    ['dragenter','dragover'].forEach(ev =>
        dropzone.addEventListener(ev, e => {
            e.preventDefault(); e.stopPropagation(); dropzone.classList.add('dragover');
        })
    );
    ['dragleave','drop'].forEach(ev =>
        dropzone.addEventListener(ev, e => {
            e.preventDefault(); e.stopPropagation(); dropzone.classList.remove('dragover');
        })
    );
    dropzone.addEventListener('drop', e => {
        const files = e.dataTransfer.files;
        const dt = new DataTransfer();
        for (const f of files) dt.items.add(f);
        fileInput.files = dt.files;
    });

    /* ---------- Кнопка «Оптимізувати» ---------- */
    document.getElementById('run').addEventListener('click', async () => {
        const files = fileInput.files;
        if (!files.length) { alert('Виберіть хоча б одне зображення'); return; }

        // Очистка UI
        preview.innerHTML = '';
        alertsContainer.innerHTML = '';
        generatedBlobs = [];
        generatedUrls = [];
        downloadAllBtn.disabled = true;
        saveFolderBtn.disabled = true;

        const globalOpts = {
            maxWidth: +document.getElementById('width').value,
            quality : +document.getElementById('quality').value,
            mimeOut : document.getElementById('format').value,
            renameOpts : {
                renameMode: renameModeEl.value,
                suffix    : document.getElementById('suffix').value,
                newName   : document.getElementById('newName').value,
                mimeOut   : document.getElementById('format').value
            }
        };

        if (['image/webp','image/avif'].includes(globalOpts.mimeOut)) {
            showAlert(
                `<strong>Увага!</strong> Windows може показати діалог 
                <em>«Потенційно небезпечний файл»</em> для форматів 
                <code>${globalOpts.mimeOut.split('/')[1]}</code>.`,
                'warning'
            );
        }

        const total = files.length;
        const CONCURRENCY = 4;
        const queue = Array.from(files).map((f,i)=>({file:f, idx:i}));
        let done = 0;

        async function worker() {
            while (queue.length) {
                const {file, idx} = queue.shift();
                try {
                    const {blob, skipped, reason} = await processImage(file, {
                        ...globalOpts,
                        index: idx,
                        total
                    });

                    if (!blob) {
                        const msg = reason === 'unsupported input format'
                            ? `Формат ${file.type.split('/')[1]} не підтримується`
                            : `Обраний формат виводу (${globalOpts.mimeOut}) не підтримується`;
                        showAlert(`${msg} – файл пропущено.`, 'error');
                        done++; setProgress(done,total); continue;
                    }

                    const previewIdx = generatedBlobs.length;
                    generatedBlobs.push(blob);
                    const url = URL.createObjectURL(blob);
                    generatedUrls.push(url);

                    const card = document.createElement('div');
                    card.className = 'card';
                    card.innerHTML = `
                        <img class="card__image" src="${url}" alt="${blob.name}"
                             data-index="${previewIdx}">
                        <p class="card__info"><strong>${file.name}</strong> → <strong>${blob.name}</strong></p>
                        <p class="card__info">${(file.size/1024).toFixed(1)} KB → ${(blob.size/1024).toFixed(1)} KB</p>
                        <a class="card__download" href="${url}" download="${blob.name}">⬇️ Завантажити</a>
                    `;
                    if (skipped) {
                        const badge = document.createElement('span');
                        badge.className = 'card__badge';
                        badge.textContent = '✅ вже оптимізовано';
                        card.appendChild(badge);
                    }
                    preview.appendChild(card);
                } catch (err) {
                    console.error(err);
                    showAlert(`<strong>${file.name}</strong> – ${err}`, 'error');
                }
                done++; setProgress(done,total);
            }
        }

        await Promise.all(Array.from({length:CONCURRENCY}, worker));

        if (generatedBlobs.length) {
            downloadAllBtn.disabled = false;
            if (window.showDirectoryPicker) saveFolderBtn.disabled = false;
        }
        updateModalNavVisibility();
    });

    /* ---------- Запис у папку (FS Access API) ---------- */
    const saveFileToFolder = async (blob, dir) => {
        const handle = await dir.getFileHandle(blob.name, {create:true});
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
    };
    const saveAllToFolder = async blobs => {
        let dir;
        try { dir = await window.showDirectoryPicker(); }
        catch { return; }
        const perm = await dir.requestPermission({mode:'readwrite'});
        if (perm !== 'granted') {
            alert('Нема прав запису у обрану папку.');
            return;
        }
        for (let i=0; i<blobs.length; i++) {
            const b = blobs[i];
            if (!b) continue;
            await saveFileToFolder(b, dir);
            setProgress(i+1, blobs.length);
        }
        alert(`✅ Всі ${blobs.length} файлів записано у обрану папку`);
    };
    saveFolderBtn.addEventListener('click', async () => {
        if (!generatedBlobs.length) return;
        saveFolderBtn.disabled = true;
        try { await saveAllToFolder(generatedBlobs); }
        catch (e) { console.error(e); alert('Не вдалося зберегти файли'); }
        finally { saveFolderBtn.disabled = false; }
    });

    /* ---------- ZIP‑fallback ---------- */
    downloadAllBtn.addEventListener('click', async () => {
        if (!generatedBlobs.length) return;
        const zip = new JSZip();
        generatedBlobs.forEach(b => { if (b) zip.file(b.name, b); });

        const oldTx = downloadAllBtn.textContent;
        downloadAllBtn.textContent = '📦 Створюю ZIP…';
        downloadAllBtn.disabled = true;

        const zipBlob = await zip.generateAsync({type:'blob'});
        const zipName = `optimized_${new Date().toISOString().slice(0,10)}.zip`;

        const a = document.createElement('a');
        a.href = URL.createObjectURL(zipBlob);
        a.download = zipName;
        a.click();

        setTimeout(() => URL.revokeObjectURL(a.href), 60000);
        downloadAllBtn.textContent = oldTx;
        downloadAllBtn.disabled = false;
    });

    /* ---------- МОДАЛЬНЕ ВІКНО ---------- */
    const updateModalNavVisibility = () => {
        const visible = generatedUrls.length > 1 ? '' : 'none';
        modalPrev.style.display = visible;
        modalNext.style.display = visible;
    };
    const fitModalImg = () => {
        if (!modalImg.naturalWidth) return;
        const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
        const gap = 4 * rem;
        const maxW = window.innerWidth  - gap;
        const maxH = window.innerHeight - gap;
        const ratio = Math.min(maxW / modalImg.naturalWidth,
                              maxH / modalImg.naturalHeight, 1);
        modalImg.style.width  = Math.round(modalImg.naturalWidth  * ratio) + 'px';
        modalImg.style.height = Math.round(modalImg.naturalHeight * ratio) + 'px';
    };
    const updateCounter = () => {
        modalCounter.textContent = generatedUrls.length
            ? `${currentIndex+1}/${generatedUrls.length}`
            : '';
    };
    const showImage = idx => {
        if (idx < 0 || idx >= generatedUrls.length) return;
        currentIndex = idx;
        modalImg.classList.remove('grabbing');
        modalImg.style.opacity = '0';
        modalImg.onload = () => {
            fitModalImg();
            modalImg.style.opacity = '1';
        };
        modalImg.src = generatedUrls[idx];
        updateCounter();
    };
    const openModal = idx => {
        showImage(idx);
        modal.classList.add('open');
        document.body.classList.add('no-scroll');
        viewportMeta.setAttribute('content',
            'width=device-width,initial-scale=1,maximum-scale=5,user-scalable=yes');
    };
    const closeModal = () => {
        modal.classList.remove('open');
        modalImg.src = '';
        document.body.classList.remove('no-scroll');
        viewportMeta.setAttribute('content', originalViewport);
    };

    preview.addEventListener('click', e => {
        const img = e.target.closest('.card__image');
        if (!img) return;
        openModal(Number(img.dataset.index));
    });
    modalPrev.addEventListener('click', e => {
        e.stopPropagation();
        const prev = (currentIndex - 1 + generatedUrls.length) % generatedUrls.length;
        showImage(prev);
    });
    modalNext.addEventListener('click', e => {
        e.stopPropagation();
        const next = (currentIndex + 1) % generatedUrls.length;
        showImage(next);
    });
    modalClose.addEventListener('click', e => {
        e.stopPropagation();
        closeModal();
    });
    modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

    document.addEventListener('keydown', e => {
        if (!modal.classList.contains('open')) return;
        if (e.key === 'ArrowLeft')  modalPrev.click();
        else if (e.key === 'ArrowRight') modalNext.click();
        else if (e.key === 'Escape') closeModal();
    });

    /* ---------- Swipe (mouse & touch) ---------- */
    const SWIPE_THR = 50;
    let startX = 0, swiping = false;

    const swipeStart = x => { startX = x; swiping = true; modalImg.classList.add('grabbing'); };
    const swipeMove = x => {
        if (!swiping) return;
        const diff = x - startX;
        if (Math.abs(diff) >= SWIPE_THR) {
            if (diff > 0) {
                const prev = (currentIndex - 1 + generatedUrls.length) % generatedUrls.length;
                showImage(prev);
            } else {
                const next = (currentIndex + 1) % generatedUrls.length;
                showImage(next);
            }
            swiping = false; modalImg.classList.remove('grabbing');
        }
    };
    const swipeEnd = () => { swiping = false; modalImg.classList.remove('grabbing'); };

    // mouse
    modalImg.addEventListener('mousedown', e => swipeStart(e.clientX));
    window.addEventListener('mousemove', e => swipeMove(e.clientX));
    window.addEventListener('mouseup', swipeEnd);
    // touch
    modalImg.addEventListener('touchstart', e => swipeStart(e.touches[0].clientX));
    window.addEventListener('touchmove', e => {
        if (e.touches.length) swipeMove(e.touches[0].clientX);
    }, {passive:true});
    window.addEventListener('touchend', swipeEnd);

    window.addEventListener('resize', () => {
        if (modal.classList.contains('open')) fitModalImg();
    });
    window.addEventListener('unload', () => {
        generatedUrls.forEach(URL.revokeObjectURL);
    });

    /* ---------- Збереження налаштувань ---------- */
    ['width','quality','format'].forEach(id =>
        document.getElementById(id).addEventListener('change', saveSettings)
    );
});

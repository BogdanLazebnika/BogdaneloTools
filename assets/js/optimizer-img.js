/* ────────────────────── 0️⃣ Збереження налаштувань у localStorage ────────────────────── */
const SETTINGS_KEY   = 'img_opt_settings';
const RENAME_KEY     = 'img_opt_rename_settings';
function loadSettings(){
    try{
        const s = JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}');
        document.getElementById('width').value   = s.width   ?? 0;
        document.getElementById('quality').value = s.quality ?? 80;
        document.getElementById('format').value   = s.format  ?? 'auto';
    }catch(e){ console.error(e); }
}
function saveSettings(){
    const s = {
        width:   +document.getElementById('width').value,
        quality: +document.getElementById('quality').value,
        format:  document.getElementById('format').value
    };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}
function loadRenameSettings(){
    try{
        const s = JSON.parse(localStorage.getItem(RENAME_KEY)||'{}');
        document.getElementById('renameMode').value = s.renameMode ?? 'none';
        document.getElementById('suffix').value      = s.suffix ?? '';
        document.getElementById('newName').value     = s.newName ?? '';
        updateRenameGroups();
    }catch(e){ console.error(e); }
}
function saveRenameSettings(){
    const s = {
        renameMode: document.getElementById('renameMode').value,
        suffix:     document.getElementById('suffix').value,
        newName:    document.getElementById('newName').value
    };
    localStorage.setItem(RENAME_KEY, JSON.stringify(s));
}
loadSettings();
loadRenameSettings();
['width','quality','format'].forEach(id=>document.getElementById(id).addEventListener('change',saveSettings));
['renameMode','suffix','newName'].forEach(id=>document.getElementById(id).addEventListener('change',saveRenameSettings));

/* ────────────────────── 1️⃣ Утиліти – readFile, EXIF, bitmap ────────────────────── */
function readFile(file){
    return new Promise((res,rej)=>{
        const fr = new FileReader();
        fr.onload =()=>res(fr.result);
        fr.onerror = rej;
        fr.readAsDataURL(file);
    });
}
function getOrientation(file){
    return new Promise(resolve=>{
        EXIF.getData(file,function(){
            resolve(EXIF.getTag(this,'Orientation')||1);
        });
    });
}
async function bitmapFromFile(file){
    const dataURL = await readFile(file);
    const orientation = await getOrientation(file);
    const blob = await (await fetch(dataURL)).blob();
    const rawBmp = await createImageBitmap(blob);
    if (orientation===1) return rawBmp;

    const canvas = document.createElement('canvas');
    const ctx    = canvas.getContext('2d');
    const w = rawBmp.width, h = rawBmp.height;
    if (orientation>=5 && orientation<=8){
        canvas.width = h; canvas.height = w;
    }else{
        canvas.width = w; canvas.height = h;
    }
    switch (orientation){
        case 2: ctx.transform(-1,0,0,1,w,0); break;
        case 3: ctx.transform(-1,0,0,-1,w,h); break;
        case 4: ctx.transform(1,0,0,-1,0,h); break;
        case 5: ctx.transform(0,1,1,0,0,0); break;
        case 6: ctx.transform(0,1,-1,0,w,0); break;
        case 7: ctx.transform(0,-1,-1,0,w,h); break;
        case 8: ctx.transform(0,-1,1,0,0,h); break;
    }
    ctx.drawImage(rawBmp,0,0);
    return await createImageBitmap(canvas);
}

/* ────────────────────── 2️⃣ Оцінка біт/піксель ────────────────────── */
function bitsPerPixel(file,bmp){
    const total = bmp.width * bmp.height;
    return (file.size * 8) / total;
}
function shouldSkipCompression(file,bmp,opts){
    const bpp    = bitsPerPixel(file,bmp);
    const LOW    = 0.30;
    const needResize = opts.maxWidth>0 && bmp.width>opts.maxWidth;
    const lowQuality = bpp <= LOW;

    if (lowQuality && !needResize && opts.mimeOut===file.type){
        return {skip:true, lowQuality:true, reason:'low quality'};
    }
    return {skip:false, lowQuality, needResize};
}

/* ────────────────────── 3️⃣ Формування імені (ренейминг) ────────────────────── */
function applyRenaming(originalFile, index, total, renameOpts){
    const origBase = originalFile.name.replace(/\.\w+$/,'');
    let ext = '';
    
    // Виправлення: правильно визначаємо розширення
    if (renameOpts.mimeOut && renameOpts.mimeOut !== 'auto') {
        ext = renameOpts.mimeOut.split('/')[1];
    } else {
        ext = originalFile.type.split('/')[1];
    }
    
    // Додаткові виправлення для формату
    if (ext === 'jpeg') ext = 'jpg';
    
    // Перевірка на undefined
    if (!ext || ext === 'undefined') {
        ext = originalFile.name.split('.').pop() || 'jpg';
    }

    // -------------- СУФІКС (append) -----------------
    if (renameOpts.renameMode === 'append'){
        const suffix = renameOpts.suffix ?? '';
        return `${origBase}${suffix}.${ext}`;
    }

    // -------------- ЗАМІНА (replace) -----------------
    if (renameOpts.renameMode === 'replace'){
        const baseName = renameOpts.newName?.trim() ?? '';
        if (!baseName){
            return `${origBase}.${ext}`;
        }

        if (/\{orig\}|\{num\}/.test(baseName)){
            let name = baseName.replace(/\{orig\}/g, origBase);
            name = name.replace(/\{num\}/g, index + 1);   // індекс 1-based для користувача
            if (!/\{num\}/.test(baseName) && index>0){
                name = `${name}${index + 1}`;
            }
            return `${name}.${ext}`;
        }

        if (index === 0) return `${baseName}.${ext}`;
        return `${baseName}${index + 1}.${ext}`;
    }

    // -------------- NO RENAME (none) -----------------
    return `${origBase}.${ext}`;
}

/* ────────────────────── 4️⃣ Основна обробка з урахуванням ренеймінгу ────────────────────── */
async function processImage(file, opts){
    const {maxWidth, quality, mimeOut, renameOpts, index, total} = opts;
    const targetMime = mimeOut === 'auto' ? file.type : mimeOut;
    const canConvert = SUPPORTED_OUTPUTS.has(targetMime);

    // Якщо формат не підтримується – копіюємо без зміни
    if (!canConvert){
        if (targetMime !== file.type){
            showAlert(`Формат ${targetMime.split('/')[1]} не підтримується – файл залишено без змін.`, 'warning');
        }
        const copy = new Blob([file], {type: file.type});
        copy.name = applyRenaming(file,index,total,{...renameOpts, mimeOut: file.type});
        return {blob:copy, skipped:true, reason:'unsupported format'};
    }

    const bmp = await bitmapFromFile(file);
    const decision = shouldSkipCompression(file,bmp,{maxWidth,quality,mimeOut:targetMime});

    if (decision.skip){
        const copy = new Blob([file], {type: file.type});
        copy.name = applyRenaming(file,index,total,{...renameOpts, mimeOut: file.type});
        return {blob:copy, skipped:true, reason:decision.reason};
    }

    const effectiveQuality = (decision.lowQuality && !decision.needResize && targetMime===file.type)
        ? 1
        : quality/100;

    const scale = maxWidth>0 ? Math.min(1, maxWidth / bmp.width) : 1;
    const outW = Math.round(bmp.width * scale);
    const outH = Math.round(bmp.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width  = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bmp,0,0,outW,outH);

    return new Promise((resolve,reject)=>{
        canvas.toBlob(blob=>{
            if(!blob){reject('toBlob failed');return;}
            
            // Створюємо новий Blob з правильним ім'ям
            const namedBlob = new Blob([blob], {type: targetMime});
            namedBlob.name = applyRenaming(file,index,total,renameOpts);
            
            resolve({blob:namedBlob, skipped:false, reason:null});
        }, targetMime, effectiveQuality);
    });
}

/* ────────────────────── 5️⃣ UI: drag&drop, прогрес, прев'ю ────────────────────── */
const dropzone        = document.getElementById('dropzone');
const fileInput       = document.getElementById('files');
const preview         = document.getElementById('preview');
const progress        = document.getElementById('progress');
const downloadAllBtn  = document.getElementById('downloadAll');
const saveFolderBtn   = document.getElementById('saveFolder');
const alertsContainer = document.getElementById('alerts');

let generatedBlobs = [];   // масив готових Blob‑ів
let generatedUrls  = [];   // URL‑и для прев'ю

function setProgress(done,total){
    progress.style.display = 'block';
    progress.textContent = `Оброблено ${done}/${total}`;
    if(done===total) setTimeout(()=>progress.style.display='none',1500);
}

/* Drag‑&‑drop */
['dragenter','dragover'].forEach(ev=>dropzone.addEventListener(ev,e=>{
    e.preventDefault(); e.stopPropagation(); dropzone.classList.add('dragover');
}));
['dragleave','drop'].forEach(ev=>dropzone.addEventListener(ev,e=>{
    e.preventDefault(); e.stopPropagation(); dropzone.classList.remove('dragover');
}));
dropzone.addEventListener('drop',e=>{
    const files = e.dataTransfer.files;
    const dt = new DataTransfer();
    for(const f of files) dt.items.add(f);
    fileInput.files = dt.files;
});

/* ────────────────────── 6️⃣ Alerts (warnings / errors) ────────────────────── */
function showAlert(message, type='warning'){
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert--${type}`;
    const icon = type==='error' ? '❌' : (type==='warning' ? '⚠️' : 'ℹ️');
    alertDiv.innerHTML = `<span class="alert__icon">${icon}</span><span class="alert__message">${message}</span>`;
    alertsContainer.appendChild(alertDiv);
}

/* ────────────────────── 7️⃣ Ренейм‑UI (show/hide) ────────────────────── */
const renameModeEl = document.getElementById('renameMode');
const appendGroup  = document.getElementById('appendGroup');
const replaceGroup = document.getElementById('replaceGroup');

function updateRenameGroups(){
    const mode = renameModeEl.value;
    appendGroup.classList.toggle('hidden', mode !== 'append');
    replaceGroup.classList.toggle('hidden', mode !== 'replace');
}
renameModeEl.addEventListener('change', updateRenameGroups);
updateRenameGroups();

/* ────────────────────── 8️⃣ Кнопка «Оптимізувати» ────────────────────── */
document.getElementById('run').addEventListener('click', async()=>{

    const files = fileInput.files;
    if(!files.length){
        alert('Виберіть хоча б одне зображення');
        return;
    }

    // Очищення UI
    preview.innerHTML = '';
    alertsContainer.innerHTML = '';
    generatedBlobs = [];
    generatedUrls  = [];
    downloadAllBtn.disabled = true;
    saveFolderBtn.disabled   = true;

    // Параметри, які спільні для всіх файлів
    const globalOpts = {
        maxWidth: +document.getElementById('width').value,
        quality:  +document.getElementById('quality').value,
        mimeOut:  document.getElementById('format').value,
        renameOpts: {
            renameMode: renameModeEl.value,
            suffix:     document.getElementById('suffix').value,
            newName:    document.getElementById('newName').value,
            mimeOut:    document.getElementById('format').value
        }
    };

    // Попередження про WebP/AVIF
    if (['image/webp','image/avif'].includes(globalOpts.mimeOut)){
        showAlert(`
            <strong>Увага!</strong> Windows може показати діалог 
            <em>«Потенційно небезпечний файл»</em> для форматів 
            <code>${globalOpts.mimeOut.split('/')[1]}</code>.
            Ви можете переключитися на PNG/JPEG або просто підтвердити діалог.
        `,'warning');
    }

    const totalFiles = files.length;
    const CONCURRENCY = 4;
    const queue = Array.from(files).map((f,i)=>({file:f, idx:i}));
    let done = 0;

    async function worker(){
        while(queue.length){
            const {file, idx} = queue.shift();
            try{
                const result = await processImage(file,{
                    ...globalOpts,
                    index: idx,
                    total: totalFiles
                });
                const {blob, skipped} = result;
                generatedBlobs[idx] = blob;
                const url = URL.createObjectURL(blob);
                generatedUrls[idx] = url;

                // ---- прев'ю-картка ----
                const card = document.createElement('div');
                card.className='card';
                card.innerHTML = `
                    <img class="card__image" src="${url}" alt="${blob.name}" data-index="${idx}">
                    <p class="card__info"><strong>${file.name}</strong> → <strong>${blob.name}</strong></p>
                    <p class="card__info">${(file.size/1024).toFixed(1)} KB → ${(blob.size/1024).toFixed(1)} KB</p>
                    <a class="card__download" href="${url}" download="${blob.name}">⬇️ Завантажити</a>
                `;
                if(skipped){
                    const badge = document.createElement('span');
                    badge.className='card__badge';
                    badge.textContent='✅ вже оптимізовано';
                    card.appendChild(badge);
                }
                preview.appendChild(card);
            }catch(err){
                console.error('Error',file.name,err);
                showAlert(`<strong>${file.name}</strong> – ${err}`, 'error');
            }
            done++;
            setProgress(done,totalFiles);
        }
    }

    await Promise.all(Array.from({length:CONCURRENCY},worker));

    if(generatedBlobs.filter(b=>b).length){
        downloadAllBtn.disabled = false;
        if(window.showDirectoryPicker) saveFolderBtn.disabled = false;
    }
    updateNavVisibility();
});

/* ────────────────────── 9️⃣ Запис у папку (Filesystem Access API) ────────────────────── */
async function saveFileToFolder(blob, dirHandle){
    const fileHandle = await dirHandle.getFileHandle(blob.name,{create:true});
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
}
async function saveAllToFolder(blobs){
    let dirHandle;
    try{ dirHandle = await window.showDirectoryPicker(); }
    catch(e){ console.warn('Folder picker cancelled',e); return; }

    const perm = await dirHandle.requestPermission({mode:'readwrite'});
    if (perm!=='granted'){
        alert('Нема прав запису у обрану папку.');
        return;
    }
    for(let i=0;i<blobs.length;i++){
        const b = blobs[i];
        if(!b) continue;
        await saveFileToFolder(b, dirHandle);
        setProgress(i+1,blobs.length);
    }
    alert(`✅ Всі ${blobs.length} файл(ів) записано у обрану папку`);
}
saveFolderBtn.addEventListener('click', async()=>{
    if(!generatedBlobs.length) return;
    saveFolderBtn.disabled = true;
    try{ await saveAllToFolder(generatedBlobs.filter(b=>b)); }
    catch(e){ console.error(e); alert('Не вдалося зберегти файли'); }
    finally{ saveFolderBtn.disabled = false; }
});

/* ────────────────────── 🔟 ZIP‑fallback ────────────────────── */
downloadAllBtn.addEventListener('click', async()=>{
    if(!generatedBlobs.length) return;
    const zip = new JSZip();
    generatedBlobs.forEach(b=>{ if(b) zip.file(b.name,b); });

    const old = downloadAllBtn.textContent;
    downloadAllBtn.textContent = '📦 Створюю ZIP…';
    downloadAllBtn.disabled = true;

    const zipBlob = await zip.generateAsync({type:'blob'});
    const zipName = `optimized_${new Date().toISOString().slice(0,10)}.zip`;

    const a = document.createElement('a');
    a.href = URL.createObjectURL(zipBlob);
    a.download = zipName;
    a.click();

    setTimeout(()=>URL.revokeObjectURL(a.href),60000);
    downloadAllBtn.textContent = old;
    downloadAllBtn.disabled = false;
});

/* ────────────────────── 1️⃣1️⃣ Модальне вікно‑галерея з свайпами ────────────────────── */
const modal       = document.getElementById('modal');
const modalImg    = document.getElementById('modalImg');
const modalClose  = document.getElementById('modalClose');
const modalPrev   = document.getElementById('modalPrev');
const modalNext   = document.getElementById('modalNext');
const modalCounter = document.getElementById('modalCounter');
const modalContent = document.getElementById('modalContent');

let currentIndex = 0;
let startX = 0;
let currentX = 0;
let isSwiping = false;

function updateCounter() {
    const totalImages = generatedUrls.filter(u => u).length;
    modalCounter.textContent = `${currentIndex + 1}/${totalImages}`;
}

function updateNavVisibility(){
    const totalImages = generatedUrls.filter(u => u).length;
    const visible = totalImages > 1 ? '' : 'none';
    modalPrev.style.display = visible;
    modalNext.style.display = visible;
}

function fitModalImg(){
    if (!modalImg.naturalWidth) return;
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const gap = 4 * rem;
    const maxW = window.innerWidth - gap;
    const maxH = window.innerHeight - gap;
    const ratio = Math.min(maxW / modalImg.naturalWidth, maxH / modalImg.naturalHeight, 1);
    modalImg.style.width = Math.round(modalImg.naturalWidth * ratio) + 'px';
    modalImg.style.height = Math.round(modalImg.naturalHeight * ratio) + 'px';
}

function showImage(idx){
    const availableImages = generatedUrls.filter(u => u);
    if (idx < 0 || idx >= generatedUrls.length || !generatedUrls[idx]) return;
    
    currentIndex = idx;
    modalImg.style.opacity = 0;
    modalImg.style.transform = 'translateX(0)';
    modalImg.style.transition = 'opacity 0.3s ease';
    
    modalImg.onload = () => {
        fitModalImg();
        modalImg.style.opacity = 1;
        updateCounter();
        setTimeout(() => {
            modalImg.style.transition = '';
        }, 300);
    };
    
    modalImg.src = generatedUrls[idx];
}

function navigateToImage(newIndex) {
    if (newIndex < 0 || newIndex >= generatedUrls.length || !generatedUrls[newIndex]) return;
    
    modalImg.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
    
    if (newIndex > currentIndex) {
        // Рух праворуч
        modalImg.style.transform = 'translateX(-100%)';
        setTimeout(() => {
            showImage(newIndex);
        }, 300);
    } else {
        // Рух ліворуч
        modalImg.style.transform = 'translateX(100%)';
        setTimeout(() => {
            showImage(newIndex);
        }, 300);
    }
}

function openModal(idx){
    showImage(idx);
    modal.classList.add('open');
    updateNavVisibility();
    document.body.style.overflow = 'hidden';
}

function closeModal(){
    modal.classList.remove('open');
    modalImg.src = '';
    modalImg.style.transform = 'translateX(0)';
    document.body.style.overflow = '';
}

// Touch events для мобільних пристроїв
modalContent.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    currentX = startX;
    isSwiping = true;
    e.preventDefault();
});

modalContent.addEventListener('touchmove', (e) => {
    if (!isSwiping) return;
    currentX = e.touches[0].clientX;
    const diff = currentX - startX;
    modalImg.style.transform = `translateX(${diff}px)`;
    modalImg.style.transition = 'none';
    e.preventDefault();
});

modalContent.addEventListener('touchend', (e) => {
    if (!isSwiping) return;
    isSwiping = false;
    
    const diff = currentX - startX;
    const swipeThreshold = 50;
    const swipeThresholdPercent = window.innerWidth * 0.1; // 10% ширини екрану
    
    if (Math.abs(diff) > swipeThreshold && Math.abs(diff) > swipeThresholdPercent) {
        if (diff > 0) {
            // Свайп праворуч - попереднє зображення
            let prev = currentIndex - 1;
            while (prev >= 0 && !generatedUrls[prev]) prev--;
            if (prev < 0) return;
            
            navigateToImage(prev);
        } else {
            // Свайп ліворуч - наступне зображення
            let next = currentIndex + 1;
            while (next < generatedUrls.length && !generatedUrls[next]) next++;
            if (next >= generatedUrls.length) return;
            
            navigateToImage(next);
        }
    } else {
        // Якщо свайп замалий - повернути на місце
        modalImg.style.transition = 'transform 0.2s ease';
        modalImg.style.transform = 'translateX(0)';
    }
    
    e.preventDefault();
});

// Mouse events для десктопу - ФІКСОВАНІ
let isMouseDown = false;
let mouseStartX = 0;

modalContent.addEventListener('mousedown', (e) => {
    isMouseDown = true;
    mouseStartX = e.clientX;
    modalImg.style.transition = 'none';
    modalContent.style.cursor = 'grabbing';
    e.preventDefault();
});

// Додаємо обробники на весь документ для правильного відстеження миші
document.addEventListener('mousemove', (e) => {
    if (!isMouseDown) return;
    
    const diff = e.clientX - mouseStartX;
    modalImg.style.transform = `translateX(${diff}px)`;
});

document.addEventListener('mouseup', (e) => {
    if (!isMouseDown) return;
    isMouseDown = false;
    modalContent.style.cursor = '';
    
    const diff = e.clientX - mouseStartX;
    const swipeThreshold = 50;
    const swipeThresholdPercent = window.innerWidth * 0.1;
    
    if (Math.abs(diff) > swipeThreshold && Math.abs(diff) > swipeThresholdPercent) {
        if (diff > 0) {
            // Свайп праворуч - попереднє зображення
            let prev = currentIndex - 1;
            while (prev >= 0 && !generatedUrls[prev]) prev--;
            if (prev < 0) {
                // Якщо немає попереднього - повернути на місце
                modalImg.style.transition = 'transform 0.2s ease';
                modalImg.style.transform = 'translateX(0)';
                return;
            }
            
            navigateToImage(prev);
        } else {
            // Свайп ліворуч - наступне зображення
            let next = currentIndex + 1;
            while (next < generatedUrls.length && !generatedUrls[next]) next++;
            if (next >= generatedUrls.length) {
                // Якщо немає наступного - повернути на місце
                modalImg.style.transition = 'transform 0.2s ease';
                modalImg.style.transform = 'translateX(0)';
                return;
            }
            
            navigateToImage(next);
        }
    } else {
        // Якщо свайп замалий - повернути на місце
        modalImg.style.transition = 'transform 0.2s ease';
        modalImg.style.transform = 'translateX(0)';
    }
});

// Події для кнопок навігації
preview.addEventListener('click', e => {
    const img = e.target.closest('.card__image');
    if (!img) return;
    const idx = Number(img.dataset.index);
    openModal(idx);
});

modalPrev.addEventListener('click', e => {
    e.stopPropagation();
    let prev = currentIndex - 1;
    while (prev >= 0 && !generatedUrls[prev]) prev--;
    if (prev < 0) prev = generatedUrls.length - 1;
    while (prev >= 0 && !generatedUrls[prev]) prev--;
    if (prev >= 0) navigateToImage(prev);
});

modalNext.addEventListener('click', e => {
    e.stopPropagation();
    let next = currentIndex + 1;
    while (next < generatedUrls.length && !generatedUrls[next]) next++;
    if (next >= generatedUrls.length) next = 0;
    while (next < generatedUrls.length && !generatedUrls[next]) next++;
    if (next < generatedUrls.length) navigateToImage(next);
});

modalClose.addEventListener('click', e => {
    e.stopPropagation();
    closeModal();
});

modal.addEventListener('click', e => { 
    if (e.target === modal) closeModal(); 
});

// Клавіатурна навігація
document.addEventListener('keydown', e => {
    if (!modal.classList.contains('open')) return;
    
    if (e.key === 'ArrowLeft') {
        modalPrev.click();
    } else if (e.key === 'ArrowRight') {
        modalNext.click();
    } else if (e.key === 'Escape') {
        closeModal();
    }
});

// Адаптація до розміру вікна
window.addEventListener('resize', () => { 
    if (modal.classList.contains('open')) fitModalImg(); 
});

// Заборонити контекстне меню на зображенні
modalContent.addEventListener('contextmenu', (e) => {
    e.preventDefault();
});

// Очищення пам'яті
window.addEventListener('unload', () => { 
    generatedUrls.forEach(url => {
        if (url) URL.revokeObjectURL(url);
    });
});

/* ────── Підтримувані формати для toBlob ────── */
const SUPPORTED_OUTPUTS = new Set(['image/jpeg','image/png','image/webp','image/avif','image/bmp']);


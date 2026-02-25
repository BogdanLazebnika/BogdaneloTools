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
    
    // Створюємо тимчасове зображення для правильного обертання
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    return new Promise((resolve) => {
        img.onload = function() {
            let width = img.width;
            let height = img.height;
            
            // Корекція орієнтації
            if (orientation >= 5 && orientation <= 8) {
                [width, height] = [height, width];
            }
            
            canvas.width = width;
            canvas.height = height;
            
            // Застосовуємо трансформації для корекції орієнтації
            switch(orientation) {
                case 2: ctx.transform(-1, 0, 0, 1, width, 0); break;
                case 3: ctx.transform(-1, 0, 0, -1, width, height); break;
                case 4: ctx.transform(1, 0, 0, -1, 0, height); break;
                case 5: ctx.transform(0, 1, 1, 0, 0, 0); break;
                case 6: ctx.transform(0, 1, -1, 0, height, 0); break;
                case 7: ctx.transform(0, -1, -1, 0, height, width); break;
                case 8: ctx.transform(0, -1, 1, 0, 0, width); break;
                default: ctx.transform(1, 0, 0, 1, 0, 0);
            }
            
            ctx.drawImage(img, 0, 0);
            createImageBitmap(canvas).then(resolve);
        };
        
        img.src = dataURL;
    });
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
function getFileExtension(mimeType, originalName) {
    const extMap = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
        'image/avif': 'avif',
        'image/bmp': 'bmp',
        'image/gif': 'gif'
    };
    
    return extMap[mimeType] || originalName.split('.').pop() || 'jpg';
}

function applyRenaming(originalFile, index, total, renameOpts){
    const origBase = originalFile.name.replace(/\.[^/.]+$/, "");
    let targetMime = renameOpts.mimeOut === 'auto' ? originalFile.type : renameOpts.mimeOut;
    
    const ext = getFileExtension(targetMime, originalFile.name);

    if (renameOpts.renameMode === 'append'){
        const suffix = renameOpts.suffix ?? '';
        return `${origBase}${suffix}.${ext}`;
    }

    if (renameOpts.renameMode === 'replace'){
        const baseName = renameOpts.newName?.trim() ?? '';
        if (!baseName) return `${origBase}.${ext}`;

        if (/\{orig\}|\{num\}/.test(baseName)){
            let name = baseName.replace(/\{orig\}/g, origBase);
            name = name.replace(/\{num\}/g, index + 1);
            if (!/\{num\}/.test(baseName) && index>0){
                name = `${name}${index + 1}`;
            }
            return `${name}.${ext}`;
        }

        if (index === 0) return `${baseName}.${ext}`;
        return `${baseName}${index + 1}.${ext}`;
    }

    return `${origBase}.${ext}`;
}

/* ────────────────────── 4️⃣ Основна обробка з урахуванням ренеймінгу ────────────────────── */
async function processImage(file, opts){
    const {maxWidth, quality, mimeOut, renameOpts, index, total} = opts;
    const targetMime = mimeOut === 'auto' ? file.type : mimeOut;
    const canConvert = SUPPORTED_OUTPUTS.has(targetMime);

    if (!canConvert){
        if (targetMime !== file.type){
            showAlert(`Формат ${targetMime.split('/')[1]} не підтримується – файл залишено без змін.`, 'warning');
        }
        const copy = new Blob([await file.arrayBuffer()], {type: file.type});
        const fileName = applyRenaming(file, index, total, {...renameOpts, mimeOut: file.type});
        return {blob: Object.assign(copy, {name: fileName}), skipped:true, reason:'unsupported format'};
    }

    try {
        const bmp = await bitmapFromFile(file);
        const decision = shouldSkipCompression(file,bmp,{maxWidth,quality,mimeOut:targetMime});

        if (decision.skip){
            const copy = new Blob([await file.arrayBuffer()], {type: file.type});
            const fileName = applyRenaming(file, index, total, {...renameOpts, mimeOut: file.type});
            return {blob: Object.assign(copy, {name: fileName}), skipped:true, reason:decision.reason};
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
        
        // Забезпечуємо якісне масштабування
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(bmp, 0, 0, outW, outH);

        return new Promise((resolve,reject)=>{
            canvas.toBlob(blob=>{
                if(!blob){reject('toBlob failed');return;}
                
                const fileName = applyRenaming(file, index, total, renameOpts);
                const namedBlob = Object.assign(new Blob([blob], {type: targetMime}), {name: fileName});
                
                resolve({blob:namedBlob, skipped:false, reason:null});
            }, targetMime, effectiveQuality);
        });
    } catch (error) {
        console.error('Помилка обробки зображення:', error);
        // Якщо сталася помилка - повертаємо оригінал
        const copy = new Blob([await file.arrayBuffer()], {type: file.type});
        const fileName = applyRenaming(file, index, total, {...renameOpts, mimeOut: file.type});
        return {blob: Object.assign(copy, {name: fileName}), skipped:true, reason:'processing error'};
    }
}

/* ────────────────────── 5️⃣ UI: drag&drop, прогрес, прев'ю ────────────────────── */
const dropzone        = document.getElementById('dropzone');
const fileInput       = document.getElementById('files');
const preview         = document.getElementById('preview');
const progress        = document.getElementById('progress');
const downloadAllBtn  = document.getElementById('downloadAll');
const saveFolderBtn   = document.getElementById('saveFolder');
const alertsContainer = document.getElementById('alerts');

let generatedBlobs = [];
let generatedUrls  = [];

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

    preview.innerHTML = '';
    alertsContainer.innerHTML = '';
    generatedBlobs = [];
    generatedUrls  = [];
    downloadAllBtn.disabled = true;
    saveFolderBtn.disabled   = true;

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

                const card = document.createElement('div');
                card.className='card';
                card.innerHTML = `
                    <img class="card__image" src="${url}" alt="${blob.name}" data-index="${idx}" loading="lazy">
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

/* ────────────────────── 9️⃣ Запис у папку ────────────────────── */
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

/* ────────────────────── 1️⃣1️⃣ Модальне вікно‑галерея ────────────────────── */
const modal = document.getElementById('modal');
const modalImg = document.getElementById('modalImg');
const modalClose = document.getElementById('modalClose');
const modalPrev = document.getElementById('modalPrev');
const modalNext = document.getElementById('modalNext');
const modalCounter = document.getElementById('modalCounter');
const modalContent = document.getElementById('modalContent');

let currentIndex = 0;
let startX = 0;
let currentX = 0;
let isSwiping = false;
let isAnimating = false;

function updateCounter() {
    const totalImages = generatedUrls.filter(u => u).length;
    modalCounter.textContent = `${currentIndex + 1}/${totalImages}`;
}

function updateNavVisibility() {
    const totalImages = generatedUrls.filter(u => u).length;
    const visible = totalImages > 1 ? '' : 'none';
    modalPrev.style.display = visible;
    modalNext.style.display = visible;
}

function fitModalImg() {
    if (!modalImg.naturalWidth) return;
    
    const imgAspect = modalImg.naturalWidth / modalImg.naturalHeight;
    const windowAspect = window.innerWidth / window.innerHeight;
    
    if (imgAspect > windowAspect) {
        // Широке зображення
        modalImg.style.width = '90vw';
        modalImg.style.height = 'auto';
    } else {
        // Високе зображення
        modalImg.style.width = 'auto';
        modalImg.style.height = '90vh';
    }
}

function preloadImages() {
    // Попереднє завантаження сусідніх зображень
    const preloadIndexes = [
        (currentIndex - 1 + generatedUrls.length) % generatedUrls.length,
        (currentIndex + 1) % generatedUrls.length
    ];
    
    preloadIndexes.forEach(idx => {
        if (generatedUrls[idx] && idx !== currentIndex) {
            const img = new Image();
            img.src = generatedUrls[idx];
        }
    });
}

function showImage(idx, direction = 0) {
    if (isAnimating) return;
    if (idx < 0 || idx >= generatedUrls.length || !generatedUrls[idx]) return;
    
    isAnimating = true;
    currentIndex = idx;
    
    // Анімація переходу
    if (direction !== 0) {
        modalImg.style.transition = 'transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.3s ease';
        modalImg.style.transform = `translateX(${direction * 100}%)`;
        modalImg.style.opacity = '0';
    }
    
    setTimeout(() => {
        modalImg.onload = () => {
            fitModalImg();
            modalImg.style.opacity = '1';
            updateCounter();
            preloadImages();
            
            setTimeout(() => {
                modalImg.style.transition = '';
                isAnimating = false;
            }, 100);
        };
        
        modalImg.src = generatedUrls[idx];
        
        if (!direction) {
            modalImg.style.opacity = '1';
            modalImg.style.transform = 'translateX(0)';
            isAnimating = false;
        }
    }, direction ? 50 : 0);
}

function navigate(direction) {
    if (isAnimating) return;
    
    let newIndex = currentIndex;
    const total = generatedUrls.filter(u => u).length;
    
    if (direction === 'next') {
        do {
            newIndex = (newIndex + 1) % generatedUrls.length;
        } while (!generatedUrls[newIndex] && newIndex !== currentIndex);
    } else {
        do {
            newIndex = (newIndex - 1 + generatedUrls.length) % generatedUrls.length;
        } while (!generatedUrls[newIndex] && newIndex !== currentIndex);
    }
    
    if (newIndex !== currentIndex && generatedUrls[newIndex]) {
        showImage(newIndex, direction === 'next' ? -1 : 1);
    }
}

// Touch events для мобільних пристроїв
modalContent.addEventListener('touchstart', (e) => {
    if (isAnimating) return;
    startX = e.touches[0].clientX;
    currentX = startX;
    isSwiping = true;
});

modalContent.addEventListener('touchmove', (e) => {
    if (!isSwiping || isAnimating) return;
    currentX = e.touches[0].clientX;
    const diff = currentX - startX;
    modalImg.style.transition = 'none';
    modalImg.style.transform = `translateX(${diff}px)`;
});

modalContent.addEventListener('touchend', (e) => {
    if (!isSwiping || isAnimating) return;
    isSwiping = false;
    
    const diff = currentX - startX;
    const threshold = window.innerWidth * 0.15; // 15% ширини екрану
    
    if (Math.abs(diff) > threshold) {
        if (diff > 0) {
            navigate('prev');
        } else {
            navigate('next');
        }
    } else {
        modalImg.style.transition = 'transform 0.3s ease';
        modalImg.style.transform = 'translateX(0)';
    }
});

// Mouse events для десктопу
let mouseIsDown = false;
let mouseStartX = 0;

modalContent.addEventListener('mousedown', (e) => {
    if (isAnimating) return;
    mouseIsDown = true;
    mouseStartX = e.clientX;
    modalImg.style.transition = 'none';
    modalContent.style.cursor = 'grabbing';
});

document.addEventListener('mousemove', (e) => {
    if (!mouseIsDown || isAnimating) return;
    const diff = e.clientX - mouseStartX;
    modalImg.style.transform = `translateX(${diff}px)`;
});

document.addEventListener('mouseup', (e) => {
    if (!mouseIsDown || isAnimating) return;
    mouseIsDown = false;
    modalContent.style.cursor = '';
    
    const diff = e.clientX - mouseStartX;
    const threshold = 100; // Фіксований поріг для ПК
    
    if (Math.abs(diff) > threshold) {
        if (diff > 0) {
            navigate('prev');
        } else {
            navigate('next');
        }
    } else {
        modalImg.style.transition = 'transform 0.3s ease';
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

modalPrev.addEventListener('click', (e) => {
    e.stopPropagation();
    navigate('prev');
});

modalNext.addEventListener('click', (e) => {
    e.stopPropagation();
    navigate('next');
});

modalClose.addEventListener('click', (e) => {
    e.stopPropagation();
    closeModal();
});

modal.addEventListener('click', (e) => { 
    if (e.target === modal) closeModal(); 
});

function openModal(idx) {
    showImage(idx);
    modal.classList.add('open');
    updateNavVisibility();
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    modal.classList.remove('open');
    modalImg.src = '';
    modalImg.style.transform = 'translateX(0)';
    document.body.style.overflow = '';
    isAnimating = false;
}

// Клавіатурна навігація
document.addEventListener('keydown', (e) => {
    if (!modal.classList.contains('open') || isAnimating) return;
    
    if (e.key === 'ArrowLeft') {
        navigate('prev');
    } else if (e.key === 'ArrowRight') {
        navigate('next');
    } else if (e.key === 'Escape') {
        closeModal();
    }
});

window.addEventListener('resize', () => { 
    if (modal.classList.contains('open')) fitModalImg(); 
});

window.addEventListener('unload', () => { 
    generatedUrls.forEach(url => {
        if (url) URL.revokeObjectURL(url);
    });
});

/* ────── Підтримувані формати для toBlob ────── */
const SUPPORTED_OUTPUTS = new Set(['image/jpeg','image/png','image/webp','image/avif','image/bmp']);

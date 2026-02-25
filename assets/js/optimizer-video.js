import { FFmpeg }
from "https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js";

import { fetchFile }
from "https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.1/dist/esm/index.js";

const ffmpeg = new FFmpeg();

const fileInput = document.getElementById("files");
const runBtn = document.getElementById("run");
const preview = document.getElementById("preview");
const progressBox = document.getElementById("progress");
const downloadAllBtn = document.getElementById("downloadAll");

let generatedFiles = [];

/* ======================= */

function applyRename(file, index, mode, suffix, template, ext) {

    const base = file.name.replace(/\.\w+$/, "");

    if (mode === "append")
        return `${base}${suffix}.${ext}`;

    if (mode === "replace")
        return template
            .replace(/\{orig\}/g, base)
            .replace(/\{num\}/g, index + 1) + "." + ext;

    return `${base}.${ext}`;
}

/* ======================= */

runBtn.addEventListener("click", async () => {

    const files = fileInput.files;
    if (!files.length) return alert("Виберіть файли");

    runBtn.disabled = true;
    preview.innerHTML = "";
    generatedFiles = [];
    downloadAllBtn.disabled = true;

    progressBox.innerText = "Завантаження FFmpeg...";

    if (!ffmpeg.loaded) {
        await ffmpeg.load({
            coreURL:
                "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/ffmpeg-core.js"
        });
    }

    const bitrate = document.getElementById("bitrate").value;
    const fps = document.getElementById("fps").value;
    const width = document.getElementById("width").value;
    const format = document.getElementById("format").value;

    const renameMode = document.getElementById("renameMode").value;
    const suffix = document.getElementById("suffix").value;
    const template = document.getElementById("newName").value;

    for (let i = 0; i < files.length; i++) {

        const file = files[i];

        progressBox.innerText =
            `Обробка ${i+1} з ${files.length}`;

        await ffmpeg.writeFile(
            file.name,
            await fetchFile(file)
        );

        let filters = [];
        if (width > 0)
            filters.push(`scale=${width}:-2`);
        if (fps > 0)
            filters.push(`fps=${fps}`);

        const ext = format === "mp4" ? "mp4" : "webm";
        const output = `output_${i}.${ext}`;

        const args = [
            "-i", file.name,
            "-b:v", `${bitrate}M`,
            ...(filters.length ? ["-vf", filters.join(",")] : []),
            output
        ];

        await ffmpeg.exec(args);

        const data =
            await ffmpeg.readFile(output);

        const blob = new Blob(
            [data.buffer],
            { type: `video/${ext}` }
        );

        const newName = applyRename(
            file,
            i,
            renameMode,
            suffix,
            template,
            ext
        );

        generatedFiles.push({
            blob,
            name: newName
        });

        const url =
            URL.createObjectURL(blob);

        const card =
            document.createElement("div");

        card.className = "card";
        card.innerHTML = `
            <video controls width="100%" src="${url}"></video>
            <p>${file.name} → ${newName}</p>
            <a href="${url}"
               download="${newName}"
               class="btn btn--success">
               Завантажити
            </a>
        `;

        preview.appendChild(card);

        await ffmpeg.deleteFile(file.name);
        await ffmpeg.deleteFile(output);
    }

    progressBox.innerText = "Готово ✅";

    if (generatedFiles.length)
        downloadAllBtn.disabled = false;

    runBtn.disabled = false;
});

/* ======================= */

downloadAllBtn.addEventListener("click", async () => {

    const zip = new JSZip();

    generatedFiles.forEach(file =>
        zip.file(file.name, file.blob)
    );

    const blob =
        await zip.generateAsync({ type: "blob" });

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "optimized_videos.zip";
    a.click();
});
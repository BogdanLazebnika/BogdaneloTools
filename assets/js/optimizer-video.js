// assets/js/optimizer-video.js

const { createFFmpeg, fetchFile } = FFmpeg;

const ffmpeg = createFFmpeg({
    log: true,
    corePath: "./assets/ffmpeg/ffmpeg-core.js"
});

const fileInput = document.getElementById("files");
const runBtn = document.getElementById("run");
const preview = document.getElementById("preview");
const progress = document.getElementById("progress");

let ffmpegLoaded = false;

async function loadFFmpeg() {
    if (!ffmpegLoaded) {
        progress.innerText = "Завантаження FFmpeg...";
        await ffmpeg.load();
        progress.innerText = "FFmpeg готовий ✅";
        ffmpegLoaded = true;
    }
}

runBtn.addEventListener("click", async () => {

    if (!fileInput.files.length) {
        alert("Оберіть відео");
        return;
    }

    await loadFFmpeg();

    preview.innerHTML = "";
    progress.innerText = "Обробка...";

    for (const file of fileInput.files) {
        await processVideo(file);
    }

    progress.innerText = "Готово 🚀";
});

async function processVideo(file) {

    const inputName = file.name;
    const outputName = "compressed_" + file.name;

    // запис файлу у ffmpeg FS
    ffmpeg.FS("writeFile", inputName, await fetchFile(file));

    // просте стиснення
    await ffmpeg.run(
        "-i", inputName,
        "-vcodec", "libx264",
        "-crf", "28",
        "-preset", "veryfast",
        outputName
    );

    // читаємо результат
    const data = ffmpeg.FS("readFile", outputName);

    const blob = new Blob([data.buffer], {
        type: "video/mp4"
    });

    const url = URL.createObjectURL(blob);

    createPreview(url, outputName);

    // очищаємо памʼять
    ffmpeg.FS("unlink", inputName);
    ffmpeg.FS("unlink", outputName);
}

function createPreview(url, fileName) {

    const wrapper = document.createElement("div");
    wrapper.style.marginBottom = "20px";

    const video = document.createElement("video");
    video.src = url;
    video.controls = true;
    video.width = 320;

    const download = document.createElement("a");
    download.href = url;
    download.download = fileName;
    download.innerText = "⬇️ Завантажити";
    download.style.display = "block";
    download.style.marginTop = "10px";

    wrapper.appendChild(video);
    wrapper.appendChild(download);

    preview.appendChild(wrapper);
}
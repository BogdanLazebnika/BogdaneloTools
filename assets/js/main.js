(async () => {
        const base = '..';      // «..» тому що файл у підпапці tools
        const h = await fetch(`${base}/header.html`).then(r=>r.text());
        document.getElementById('header').innerHTML = h;
        const f = await fetch(`${base}/footer.html`).then(r=>r.text());
        document.getElementById('footer').innerHTML = f;
    })();
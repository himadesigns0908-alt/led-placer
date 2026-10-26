(function () {
  const MODULES = {
    A: { name: "A", w: 10,   l: 40,    color: "#4ea1ff" },
    B: { name: "B", w: 12.7, l: 76.2,  color: "#57d18b" }
  };

  const state = {
    parsed: null, result: null, module: "A",
    fileName: "sign.svg", svgSource: null
  };

  const $ = (id) => document.getElementById(id);
  const drop = $("drop"), fileInp = $("file");
  const gapAlongInp = $("gapAlong"), gapRowsInp = $("gapRows"), safetyInp = $("safety");
  const realWidthInp = $("realWidth");
  const forceInp = $("force");
  const preview = $("preview");
  const perGlyphEl = $("perGlyph"), warnEl = $("warn"), errEl = $("err");
  const statGlyphs = $("statGlyphs"), statTotal = $("statTotal");
  const downloadBtn = $("download");

  drop.addEventListener("click", () => fileInp.click());
  drop.addEventListener("dragover", e => { e.preventDefault(); drop.classList.add("hover"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("hover"));
  drop.addEventListener("drop", e => {
    e.preventDefault(); drop.classList.remove("hover");
    const f = e.dataTransfer.files[0]; if (f) readFile(f);
  });
  fileInp.addEventListener("change", e => { const f = e.target.files[0]; if (f) readFile(f); });

  function readFile(f) {
    errEl.innerHTML = ""; warnEl.innerHTML = "";
    state.fileName = f.name;
    const r = new FileReader();
    r.onload = () => {
      state.svgSource = r.result;
      try {
        state.parsed = SVGParser.parse(state.svgSource);
        realWidthInp.value = "";
        recompute();
      } catch (e) {
        errEl.innerHTML = `<div class="errbox">${e.message}</div>`;
      }
    };
    r.readAsText(f);
  }

  function recompute() {
    if (!state.parsed) return;
    const mod = MODULES[state.module];
    const gapAlong = +gapAlongInp.value || 0;
    const gapRows  = +gapRowsInp.value  || 0;
    const safety   = +safetyInp.value   || 0;
    const force    = forceInp.checked;

    let unitsPerMM = state.parsed.unitsPerMM;
    if (!unitsPerMM) {
      const rw = +realWidthInp.value;
      if (rw > 0) {
        unitsPerMM = state.parsed.viewBox[2] / rw;
      } else {
        errEl.innerHTML = `<div class="errbox">SVG has no unit info. Enter the real width in mm to enable placement.</div>`;
        state.result = null; renderPreview(); return;
      }
    }
    errEl.innerHTML = "";

    const result = Geometry.place(
      state.parsed.glyphs, mod, gapAlong, gapRows, safety, unitsPerMM, force
    );
    state.result = { ...result, mod, gapAlong, gapRows, safety, unitsPerMM, viewBox: state.parsed.viewBox };
    renderPreview();
    renderUI();
  }

  function renderUI() {
    if (!state.result) {
      statGlyphs.textContent = "–";
      statTotal.textContent = "–";
      perGlyphEl.innerHTML = "";
      downloadBtn.disabled = true;
      return;
    }
    const { perGlyph, total } = state.result;
    const placedCount = perGlyph.filter(g => !g.skipped || g.count > 0).length;
    statGlyphs.textContent = placedCount;
    statTotal.textContent = total;
    downloadBtn.disabled = total === 0;

    let html = "";
    perGlyph.forEach(g => {
      if (g.skipped && g.count === 0) {
        html += `<div class="skip"><span>Glyph #${g.index}</span><span>SKIPPED</span></div>`;
      } else {
        html += `<div><span>Glyph #${g.index}</span><span>${g.count}</span></div>`;
      }
    });
    perGlyphEl.innerHTML = html;

    const skipped = perGlyph.filter(g => g.skipped && g.count === 0);
    if (skipped.length) {
      warnEl.innerHTML = `<div class="warnbox"><b>Warning: ${skipped.length} glyph(s) skipped.</b><ul>` +
        skipped.map(g => `<li>Glyph #${g.index}: ${g.reason}</li>`).join("") +
        `</ul></div>`;
    } else {
      warnEl.innerHTML = "";
    }
  }

  function renderPreview() {
    const vb = state.parsed ? state.parsed.viewBox : [0,0,100,100];
    preview.setAttribute("viewBox", vb.join(" "));
    preview.innerHTML = "";
    if (!state.result) return;

    const { perGlyph, mod, unitsPerMM } = state.result;
    const margin = Math.max(vb[2], vb[3]) * 0.03;
    preview.setAttribute("viewBox", `${vb[0]-margin} ${vb[1]-margin} ${vb[2]+margin*2} ${vb[3]+margin*2}`);

    // Draw outlines (WHITE so they are visible on the dark background)
    perGlyph.forEach(g => {
      const d = g.poly.map((p,i)=> (i?"L":"M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ") + " Z";
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", d);
      path.setAttribute("fill", "rgba(255,255,255,0.05)"); // faint fill
      path.setAttribute("stroke", g.skipped && g.count===0 ? "#ff6b6b" : "#ffffff"); // white stroke
      path.setAttribute("stroke-width", Math.max(0.3, (mod.w*unitsPerMM)*0.03));
      preview.appendChild(path);
    });

    // Draw LED Modules
    const modW = mod.l * unitsPerMM;
    const modH = mod.w * unitsPerMM;
    perGlyph.forEach(g => {
      g.placed.forEach(m => {
        const r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        r.setAttribute("x", (-modW/2).toFixed(2));
        r.setAttribute("y", (-modH/2).toFixed(2));
        r.setAttribute("width", modW.toFixed(2));
        r.setAttribute("height", modH.toFixed(2));
        r.setAttribute("fill", mod.color);
        r.setAttribute("fill-opacity", "0.85");
        r.setAttribute("stroke", "#0b0e13");
        r.setAttribute("stroke-width", Math.max(0.2, modH*0.02).toFixed(2));
        r.setAttribute("transform", `translate(${m.cx.toFixed(2)} ${m.cy.toFixed(2)}) rotate(${(m.angle*180/Math.PI).toFixed(2)})`);
        preview.appendChild(r);
      });
    });
  }

  downloadBtn.addEventListener("click", () => {
    if (!state.result) return;
    const svg = SVGExport.build({
      viewBox: state.result.viewBox,
      perGlyph: state.result.perGlyph,
      total: state.result.total,
      module: state.result.mod,
      gapAlong: state.result.gapAlong,
      gapRows: state.result.gapRows,
      safety: state.result.safety,
      unitsPerMM: state.result.unitsPerMM
    });
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = state.fileName.replace(/\.svg$/i, "") + "-led.svg";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  $("reset").addEventListener("click", () => {
    state.parsed = null; state.result = null;
    fileInp.value = ""; realWidthInp.value = "";
    preview.innerHTML = ""; perGlyphEl.innerHTML = "";
    warnEl.innerHTML = ""; errEl.innerHTML = "";
    statGlyphs.textContent = "–"; statTotal.textContent = "–";
    downloadBtn.disabled = true;
  });

  document.querySelectorAll(".mod").forEach(el => {
    el.addEventListener("click", () => {
      document.querySelectorAll(".mod").forEach(m => m.classList.remove("active"));
      el.classList.add("active");
      state.module = el.dataset.mod;
      recompute();
    });
  });

  [gapAlongInp, gapRowsInp, safetyInp, realWidthInp].forEach(i => i.addEventListener("input", recompute));
  forceInp.addEventListener("change", recompute);
})();

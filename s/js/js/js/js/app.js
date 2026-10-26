(function () {
  const MODULES = {
    A: { name: "A", w: 10,   l: 40,    color: "#4ea1ff" },
    B: { name: "B", w: 12.7, l: 76.2,  color: "#57d18b" }
  };

  const state = {
    parsed: null, result: null, module: "A",
    fileName: "sign.svg", svgSource: null
  };

  const $ = id => document.getElementById(id);
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
    r.onload

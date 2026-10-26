window.SVGExport = (function () {
  function esc(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

  function build({ viewBox, perGlyph, total, module, gapAlong, gapRows, safety, unitsPerMM }) {
    const [vx, vy, vw, vh] = viewBox;
    const margin = Math.max(vw, vh) * 0.03;
    const ox = vx - margin, oy = vy - margin;
    const w = vw + margin*2, h = vh + margin*2 + 40;

    const color = module.color;
    const parts = [];
    parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${ox} ${oy} ${w} ${h}" width="${w}mm" height="${h}mm">`);
    parts.push(`<rect x="${ox}" y="${oy}" width="${w}" height="${h}" fill="white"/>`);

    for (const g of perGlyph) {
      if (!g.poly) continue;
      const d = g.poly.map((p,i)=> (i?"L":"M") + p[0].toFixed(2) + " " + p[1].toFixed(2)).join(" ") + " Z";
      parts.push(`<path d="${d}" fill="none" stroke="#888" stroke-width="${Math.max(0.5, (module.w*unitsPerMM)*0.02)}"/>`);
    }

    const modW = module.l * unitsPerMM;
    const modH = module.w * unitsPerMM;
    for (const g of perGlyph) {
      for (const m of g.placed) {
        parts.push(
          `<rect x="${(-modW/2).toFixed(2)}" y="${(-modH/2).toFixed(2)}" width="${modW.toFixed(2)}" height="${modH.toFixed(2)}" ` +
          `fill="${color}" fill-opacity="0.85" stroke="#0b0e13" stroke-width="${Math.max(0.2,(modH*0.02)).toFixed(2)}" ` +
          `transform="translate(${m.cx.toFixed(2)} ${m.cy.toFixed(2)}) rotate(${(m.angle*180/Math.PI).toFixed(2)})"/>`
        );
      }
    }

    for (const g of perGlyph) {
      if (!g.bbox) continue;
      const cx = (g.bbox[0]+g.bbox[2])/2;
      const cy = g.bbox[1] - Math.max(2, (module.w*unitsPerMM)*0.4);
      const label = g.skipped ? `#${g.index}: SKIPPED` : `#${g.index}: ${g.count}`;
      const fill = g.skipped ? "#c0392b" : "#0b0e13";
      parts.push(`<text x="${cx.toFixed(2)}" y="${cy.toFixed(2)}" font-family="Arial, sans-serif" font-size="${Math.max(3, vh*0.03).toFixed(2)}" text-anchor="middle" fill="${fill}">${esc(label)}</text>`);
    }

    const fy = oy + h - 12;
    const fontSize = Math.max(3, vh*0.025);
    parts.push(`<text x="${ox + 4}" y="${fy.toFixed(2)}" font-family="Arial, sans-serif" font-size="${fontSize.toFixed(2)}" fill="#222">` +
      `Module ${esc(module.name)} (${module.w}×${module.l} mm) · gapAlong ${gapAlong} mm · gapRows ${gapRows} mm · safety ${safety} mm · TOTAL MODULES: ${total}` +
      `</text>`);

    parts.push(`</svg>`);
    return parts.join("\n");
  }
  return { build };
})();

window.Geometry = (function () {
  
  function place(glyphs, module, gapAlongMM, gapRowsMM, safetyMM, unitsPerMM, force) {
    const stepAlong = (module.l + gapAlongMM) * unitsPerMM;
    const rowOffset = (module.w + gapRowsMM) * unitsPerMM;
    const firstOff  = (module.w / 2 + safetyMM) * unitsPerMM;
    const halfL     = (module.l / 2) * unitsPerMM;
    const halfW     = (module.w / 2) * unitsPerMM;

    const perGlyph = [];
    let total = 0;

    for (const g of glyphs) {
      const poly = g.pts;
      let placed = [];
      
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      poly.forEach(p => { minX=Math.min(minX,p[0]); minY=Math.min(minY,p[1]); maxX=Math.max(maxX,p[0]); maxY=Math.max(maxY,p[1]); });
      const minSide = Math.min(maxX-minX, maxY-minY);

      // If the box is big enough (or if Force is checked), draw a grid inside it
      if (minSide >= (module.w + 2*safetyMM) * unitsPerMM || force) {
        let y = minY + firstOff;
        
        // Loop through rows (top to bottom)
        while (y <= maxY - firstOff) {
            let x = minX + firstOff;
            
            // Loop through columns (left to right)
            while (x <= maxX - firstOff) {
                placed.push({ cx: x, cy: y, angle: 0 });
                x += stepAlong;
            }
            y += rowOffset;
        }
      }

      total += placed.length;
      perGlyph.push({ index: perGlyph.length+1, count: placed.length, skipped: placed.length === 0, reason: placed.length === 0 ? "No room" : "", placed, poly, bbox: [minX,minY,maxX,maxY] });
    }

    return { perGlyph, total };
  }

  return { place };
})();

/** Client-side "download as image" — serializes an SVG bouquet to a PNG,
 * no backend involvement. */
export async function exportSvgAsPng(svgEl: SVGSVGElement, filename: string, backgroundColor = '#fbf3e7') {
  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const size = 1000;
  clone.setAttribute('width', String(size));
  clone.setAttribute('height', String(size));

  const serialized = new XMLSerializer().serializeToString(clone);
  const svgBlob = new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' });
  const svgUrl = URL.createObjectURL(svgBlob);

  try {
    const image = await loadImage(svgUrl);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas not supported');
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(image, 0, 0, size, size);

    const pngBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!pngBlob) throw new Error('Failed to encode PNG');

    const downloadUrl = URL.createObjectURL(pngBlob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(downloadUrl);
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

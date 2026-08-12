const POSTER_WIDTH = 1000;
const POSTER_HEIGHT = 1400;
const POSTER_BACKGROUND = "#05090b";
const BRAND_CYAN = "#34E5E8";
const BRAND_PINK = "#FF2D9B";

// These paths are traced from the canonical Orbitron GoGymGo wordmark font.
// Keeping the logo as paths makes the JPEG independent of installed fonts.
const WORDMARK_PATHS = [
  {
    color: BRAND_CYAN,
    path: "M294.4 136L251.2 136Q248.3 136 245.8 134.6Q243.3 133.1 241.9 130.6Q240.4 128.2 240.4 125.2L240.4 82Q240.4 79 241.9 76.6Q243.3 74.1 245.8 72.6Q248.3 71.2 251.2 71.2L294.4 71.2Q297.4 71.2 299.9 72.6Q302.4 74.1 303.8 76.6Q305.2 79 305.2 82L305.2 84.6L297.9 84.6L297.9 82Q297.9 80.6 296.9 79.5Q295.9 78.5 294.4 78.5L251.2 78.5Q249.8 78.5 248.8 79.5Q247.7 80.6 247.7 82L247.7 125.2Q247.7 126.6 248.8 127.7Q249.8 128.7 251.2 128.7L294.4 128.7Q295.9 128.7 296.9 127.7Q297.9 126.6 297.9 125.2L297.9 109.2L281.9 109.2L281.9 101.8L305.2 101.8L305.2 125.2Q305.2 128.2 303.8 130.6Q302.4 133.1 299.9 134.6Q297.4 136 294.4 136ZM369 136L325.8 136Q322.8 136 320.3 134.6Q317.8 133.1 316.4 130.6Q315 128.2 315 125.2L315 82Q315 79 316.4 76.6Q317.8 74.1 320.3 72.6Q322.8 71.2 325.8 71.2L369 71.2Q371.9 71.2 374.4 72.6Q376.9 74.1 378.3 76.6Q379.8 79 379.8 82L379.8 125.2Q379.8 128.2 378.3 130.6Q376.9 133.1 374.4 134.6Q371.9 136 369 136ZM325.8 128.7L369 128.7Q370.4 128.7 371.4 127.7Q372.5 126.6 372.5 125.2L372.5 82Q372.5 80.6 371.4 79.5Q370.4 78.5 369 78.5L325.8 78.5Q324.3 78.5 323.3 79.5Q322.2 80.6 322.2 82L322.2 125.2Q322.2 126.6 323.3 127.7Q324.3 128.7 325.8 128.7Z",
  },
  {
    color: BRAND_PINK,
    path: "M443.7 136L400.5 136Q397.5 136 395 134.6Q392.5 133.1 391.1 130.6Q389.7 128.2 389.7 125.2L389.7 82Q389.7 79 391.1 76.6Q392.5 74.1 395 72.6Q397.5 71.2 400.5 71.2L443.7 71.2Q446.6 71.2 449.1 72.6Q451.6 74.1 453 76.6Q454.5 79 454.5 82L454.5 84.6L447.2 84.6L447.2 82Q447.2 80.6 446.1 79.5Q445.1 78.5 443.7 78.5L400.5 78.5Q399 78.5 398 79.5Q396.9 80.6 396.9 82L396.9 125.2Q396.9 126.6 398 127.7Q399 128.7 400.5 128.7L443.7 128.7Q445.1 128.7 446.1 127.7Q447.2 126.6 447.2 125.2L447.2 109.2L431.1 109.2L431.1 101.8L454.5 101.8L454.5 125.2Q454.5 128.2 453 130.6Q451.6 133.1 449.1 134.6Q446.6 136 443.7 136ZM499.3 136L492 136L492 111.6L462.2 71.2L470.6 71.2L495.7 102.9L520.5 71.2L529.1 71.2L499.3 111.6L499.3 136ZM544.2 136L536.9 136L536.9 71.2L546.9 71.2L573.8 103.2L600.7 71.2L610.7 71.2L610.7 136L603.4 136L603.4 79.5L573.8 114.7L544.2 79.5L544.2 136Z",
  },
  {
    color: BRAND_CYAN,
    path: "M674.4 136L631.2 136Q628.3 136 625.8 134.6Q623.3 133.1 621.9 130.6Q620.4 128.2 620.4 125.2L620.4 82Q620.4 79 621.9 76.6Q623.3 74.1 625.8 72.6Q628.3 71.2 631.2 71.2L674.4 71.2Q677.4 71.2 679.9 72.6Q682.3 74.1 683.8 76.6Q685.2 79 685.2 82L685.2 84.6L677.9 84.6L677.9 82Q677.9 80.6 676.9 79.5Q675.9 78.5 674.4 78.5L631.2 78.5Q629.8 78.5 628.7 79.5Q627.7 80.6 627.7 82L627.7 125.2Q627.7 126.6 628.7 127.7Q629.8 128.7 631.2 128.7L674.4 128.7Q675.9 128.7 676.9 127.7Q677.9 126.6 677.9 125.2L677.9 109.2L661.9 109.2L661.9 101.8L685.2 101.8L685.2 125.2Q685.2 128.2 683.8 130.6Q682.3 133.1 679.9 134.6Q677.4 136 674.4 136ZM748.9 136L705.7 136Q702.8 136 700.3 134.6Q697.8 133.1 696.4 130.6Q694.9 128.2 694.9 125.2L694.9 82Q694.9 79 696.4 76.6Q697.8 74.1 700.3 72.6Q702.8 71.2 705.7 71.2L748.9 71.2Q751.9 71.2 754.4 72.6Q756.9 74.1 758.3 76.6Q759.7 79 759.7 82L759.7 125.2Q759.7 128.2 758.3 130.6Q756.9 133.1 754.4 134.6Q751.9 136 748.9 136ZM705.7 128.7L748.9 128.7Q750.4 128.7 751.4 127.7Q752.5 126.6 752.5 125.2L752.5 82Q752.5 80.6 751.4 79.5Q750.4 78.5 748.9 78.5L705.7 78.5Q704.3 78.5 703.3 79.5Q702.2 80.6 702.2 82L702.2 125.2Q702.2 126.6 703.3 127.7Q704.3 128.7 705.7 128.7Z",
  },
] as const;

function loadPosterSvg(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const source = URL.createObjectURL(
      new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
    );
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(source);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(source);
      reject(new Error("The QR poster preview could not be rendered."));
    };
    image.src = source;
  });
}

function drawCanonicalWordmark(context: CanvasRenderingContext2D) {
  context.save();
  context.fillStyle = POSTER_BACKGROUND;
  context.fillRect(200, 48, 600, 112);
  context.shadowBlur = 15;

  for (const segment of WORDMARK_PATHS) {
    context.fillStyle = segment.color;
    context.shadowColor = segment.color;
    context.fill(new Path2D(segment.path));
  }

  context.restore();
}

export async function posterSvgToJpegBlob(svg: string): Promise<Blob> {
  const image = await loadPosterSvg(svg);
  const canvas = document.createElement("canvas");
  canvas.width = POSTER_WIDTH;
  canvas.height = POSTER_HEIGHT;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("This browser cannot prepare a printable QR poster.");
  }

  context.fillStyle = POSTER_BACKGROUND;
  context.fillRect(0, 0, POSTER_WIDTH, POSTER_HEIGHT);
  context.drawImage(image, 0, 0, POSTER_WIDTH, POSTER_HEIGHT);
  drawCanonicalWordmark(context);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob?.type === "image/jpeg") {
          resolve(blob);
          return;
        }
        reject(new Error("The QR poster could not be encoded as a JPEG."));
      },
      "image/jpeg",
      0.96,
    );
  });
}

export async function downloadPosterJpeg(svg: string, filename: string) {
  const blob = await posterSvgToJpegBlob(svg);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const stem = filename.replace(/\.(?:jpe?g|png|svg)$/i, "");
  link.download = `${stem}.jpg`;
  link.href = url;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

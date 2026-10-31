import { writeFileSync } from "node:fs";
import sharp from "sharp";
import { watermarkedPreview } from "../src/lib/preview-image";

async function main() {
  const directory = process.argv[2] ?? "/tmp";
  const exterior = await sharp({
    create: { width: 1400, height: 900, channels: 3, background: { r: 120, g: 176, b: 214 } },
  })
    .composite([
      {
        input: await sharp({
          create: { width: 860, height: 460, channels: 3, background: { r: 236, g: 236, b: 232 } },
        })
          .png()
          .toBuffer(),
        left: 270,
        top: 250,
      },
    ])
    .png()
    .toBuffer();
  const interior = await sharp({
    create: { width: 1400, height: 900, channels: 3, background: { r: 248, g: 248, b: 246 } },
  })
    .png()
    .toBuffer();
  writeFileSync(`${directory}/watermark-exterior.jpg`, await watermarkedPreview(exterior));
  writeFileSync(`${directory}/watermark-interior.jpg`, await watermarkedPreview(interior));
  console.log(directory);
}

main();

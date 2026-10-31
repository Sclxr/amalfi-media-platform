import { writeFileSync } from "node:fs";
import sharp from "sharp";
import { watermarkedPreview } from "../src/lib/preview-image";

async function main() {
  const destination = process.argv[2] ?? "/tmp/watermark-sample.jpg";
  const sky = await sharp({
    create: { width: 1400, height: 900, channels: 3, background: { r: 186, g: 214, b: 236 } },
  })
    .composite([
      {
        input: await sharp({
          create: { width: 900, height: 520, channels: 3, background: { r: 245, g: 245, b: 242 } },
        })
          .png()
          .toBuffer(),
        left: 250,
        top: 220,
      },
    ])
    .png()
    .toBuffer();
  writeFileSync(destination, await watermarkedPreview(sky));
  console.log(destination);
}

main();

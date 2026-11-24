import hero from "../assets/hero-2400.webp";
import g1 from "../assets/g1.webp";
import g2 from "../assets/g2.webp";
import g3 from "../assets/g3.webp";
import photo from "../assets/svc-photo.webp";
import drone from "../assets/svc-drone.webp";
import video from "../assets/svc-video.webp";
import type { ImageMetadata } from "astro";

export type Shot = {
  src: ImageMetadata;
  alt: string;
  tags: string[];
  caption: string;
};

export const shots: Shot[] = [
  { src: hero, alt: "A house at dusk with warm light in the windows and a landscaped front walk", tags: ["photo", "twilight"], caption: "Twilight exterior" },
  { src: g1, alt: "Living room with a fireplace, white sofas, and dark wood floors", tags: ["photo"], caption: "Living room" },
  { src: g3, alt: "Living room opening through sliding doors to a screened pool", tags: ["photo"], caption: "Indoor-outdoor living" },
  { src: photo, alt: "Bright kitchen with white cabinets and a large island", tags: ["photo"], caption: "Kitchen" },
  { src: drone, alt: "Aerial view of homes beside water and trees", tags: ["drone"], caption: "Aerial neighborhood" },
  { src: g2, alt: "Overhead aerial of rooftops beside a lake", tags: ["drone"], caption: "Overhead aerial" },
  { src: video, alt: "A camera on a stabilizer, ready for a walkthrough", tags: ["video"], caption: "Walkthrough setup" },
];

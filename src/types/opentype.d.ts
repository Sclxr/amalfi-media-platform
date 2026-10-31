declare module "opentype.js" {
  export function loadSync(url: string): {
    getPath(
      text: string,
      x: number,
      y: number,
      fontSize: number,
    ): {
      toPathData(decimalPlaces?: number): string;
      getBoundingBox(): { x1: number; y1: number; x2: number; y2: number };
    };
  };
}

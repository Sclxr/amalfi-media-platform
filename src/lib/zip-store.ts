import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";

function crc32(data: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(value: number) {
  return [value & 0xff, (value >> 8) & 0xff];
}

function u32(value: number) {
  return [value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >> 24) & 0xff];
}

/** ZIP archive stored uncompressed. Enough for a small gallery download. */
export function storedZip(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const locals: number[] = [];
  const central: number[] = [];
  let offset = 0;
  for (const file of files) {
    const name = new TextEncoder().encode(file.name.replace(/\\/g, "/"));
    const crc = crc32(file.data);
    const local = [
      ...u32(0x04034b50),
      ...u16(20),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u32(crc),
      ...u32(file.data.length),
      ...u32(file.data.length),
      ...u16(name.length),
      ...u16(0),
      ...name,
      ...file.data,
    ];
    locals.push(...local);
    central.push(
      ...u32(0x02014b50),
      ...u16(20),
      ...u16(20),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u32(crc),
      ...u32(file.data.length),
      ...u32(file.data.length),
      ...u16(name.length),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u32(0),
      ...u32(offset),
      ...name,
    );
    offset += local.length;
  }
  const end = [
    ...u32(0x06054b50),
    ...u16(0),
    ...u16(0),
    ...u16(files.length),
    ...u16(files.length),
    ...u32(central.length),
    ...u32(offset),
    ...u16(0),
  ];
  return Uint8Array.from([...locals, ...central, ...end]);
}

/** A download gets its own file so two people never share one bundle.zip. */
export function uniqueZipKey() {
  return `tmp/zips/${randomUUID()}.zip`;
}

function crc32Update(crc: number, data: Buffer) {
  let next = crc;
  for (const byte of data) {
    next ^= byte;
    for (let bit = 0; bit < 8; bit += 1) next = next & 1 ? (next >>> 1) ^ 0xedb88320 : next >>> 1;
  }
  return next >>> 0;
}

/** Write an uncompressed zip by streaming each source file into a unique path. */
export async function streamStoredZip(outputPath: string, files: { name: string; sourcePath: string }[]) {
  await mkdir(path.dirname(outputPath), { recursive: true });
  const out = createWriteStream(outputPath);
  const write = async (chunk: Uint8Array) => {
    if (!out.write(chunk)) await once(out, "drain");
  };
  const central: Buffer[] = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.name.replace(/\\/g, "/"));
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0x0008, 6);
    header.writeUInt16LE(name.length, 26);
    await write(header);
    await write(name);
    let crc = 0xffffffff;
    let size = 0;
    for await (const chunk of createReadStream(file.sourcePath)) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      crc = crc32Update(crc, buf);
      size += buf.length;
      await write(buf);
    }
    crc = (crc ^ 0xffffffff) >>> 0;
    const descriptor = Buffer.alloc(16);
    descriptor.writeUInt32LE(0x08074b50, 0);
    descriptor.writeUInt32LE(crc, 4);
    descriptor.writeUInt32LE(size, 8);
    descriptor.writeUInt32LE(size, 12);
    await write(descriptor);
    const record = Buffer.alloc(46);
    record.writeUInt32LE(0x02014b50, 0);
    record.writeUInt16LE(20, 4);
    record.writeUInt16LE(20, 6);
    record.writeUInt16LE(0x0008, 8);
    record.writeUInt32LE(crc, 16);
    record.writeUInt32LE(size, 20);
    record.writeUInt32LE(size, 24);
    record.writeUInt16LE(name.length, 28);
    record.writeUInt32LE(offset, 42);
    central.push(Buffer.concat([record, name]));
    offset += header.length + name.length + size + descriptor.length;
  }
  const directory = Buffer.concat(central);
  await write(directory);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  await write(end);
  out.end();
  await once(out, "finish");
}

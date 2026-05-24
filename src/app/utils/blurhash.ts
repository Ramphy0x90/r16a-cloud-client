import { decode } from 'blurhash';

const cache = new Map<string, string>();

export function blurhashToDataUrl(hash: string, width = 32, height = 32): string {
    const key = `${hash}:${width}x${height}`;
    if (cache.has(key)) return cache.get(key)!;

    const pixels = decode(hash, width, height);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    const imageData = ctx.createImageData(width, height);
    imageData.data.set(pixels);
    ctx.putImageData(imageData, 0, 0);
    const dataUrl = canvas.toDataURL();
    cache.set(key, dataUrl);
    return dataUrl;
}

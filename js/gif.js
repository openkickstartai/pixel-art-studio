/**
 * Minimal GIF encoder for pixel art animations.
 * Supports LZW compression and frame delays.
 */
class GIFEncoder {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.frames = [];
        this.delay = 100; // ms per frame
    }

    setDelay(ms) {
        this.delay = ms;
    }

    addFrame(imageData) {
        // imageData is a Uint8ClampedArray of RGBA pixels
        this.frames.push(new Uint8Array(imageData));
    }

    encode() {
        const { width, height, frames, delay } = this;
        const buf = [];

        // Collect all unique colors across all frames (max 256)
        const colorMap = new Map();
        const allPixels = [];

        for (const frame of frames) {
            const indexed = [];
            for (let i = 0; i < frame.length; i += 4) {
                const r = frame[i], g = frame[i+1], b = frame[i+2], a = frame[i+3];
                // Treat transparent as a specific color
                const key = a < 128 ? 'T' : `${r},${g},${b}`;
                if (!colorMap.has(key)) {
                    if (colorMap.size < 256) {
                        colorMap.set(key, colorMap.size);
                    }
                }
                indexed.push(colorMap.get(key) || 0);
            }
            allPixels.push(indexed);
        }

        // Build color table
        const colorTableSize = Math.max(2, Math.pow(2, Math.ceil(Math.log2(Math.max(colorMap.size, 2)))));
        const colorTableBits = Math.ceil(Math.log2(colorTableSize));
        const colorTable = new Uint8Array(colorTableSize * 3);
        let transparentIndex = -1;

        for (const [key, idx] of colorMap) {
            if (key === 'T') {
                transparentIndex = idx;
                colorTable[idx * 3] = 0;
                colorTable[idx * 3 + 1] = 0;
                colorTable[idx * 3 + 2] = 0;
            } else {
                const parts = key.split(',').map(Number);
                colorTable[idx * 3] = parts[0];
                colorTable[idx * 3 + 1] = parts[1];
                colorTable[idx * 3 + 2] = parts[2];
            }
        }

        // Header
        this._writeStr(buf, 'GIF89a');

        // Logical Screen Descriptor
        this._writeU16(buf, width);
        this._writeU16(buf, height);
        buf.push(0x80 | ((colorTableBits - 1) & 7) | (((colorTableBits - 1) & 7) << 4)); // packed
        buf.push(0); // bg color index
        buf.push(0); // pixel aspect ratio

        // Global Color Table
        for (let i = 0; i < colorTable.length; i++) {
            buf.push(colorTable[i]);
        }

        // Netscape extension for looping
        buf.push(0x21, 0xFF, 0x0B);
        this._writeStr(buf, 'NETSCAPE2.0');
        buf.push(0x03, 0x01);
        this._writeU16(buf, 0); // loop forever
        buf.push(0x00);

        // Frames
        const delayCs = Math.round(delay / 10);
        for (let f = 0; f < frames.length; f++) {
            // Graphic Control Extension
            buf.push(0x21, 0xF9, 0x04);
            if (transparentIndex >= 0) {
                buf.push(0x09); // dispose + transparent flag
            } else {
                buf.push(0x08); // dispose, no transparency
            }
            this._writeU16(buf, delayCs);
            buf.push(transparentIndex >= 0 ? transparentIndex : 0);
            buf.push(0x00);

            // Image Descriptor
            buf.push(0x2C);
            this._writeU16(buf, 0); // left
            this._writeU16(buf, 0); // top
            this._writeU16(buf, width);
            this._writeU16(buf, height);
            buf.push(0x00); // no local color table

            // LZW compressed data
            const minCodeSize = Math.max(2, colorTableBits);
            buf.push(minCodeSize);
            const lzwData = this._lzwEncode(allPixels[f], minCodeSize);
            // Write sub-blocks
            let offset = 0;
            while (offset < lzwData.length) {
                const chunkSize = Math.min(255, lzwData.length - offset);
                buf.push(chunkSize);
                for (let i = 0; i < chunkSize; i++) {
                    buf.push(lzwData[offset + i]);
                }
                offset += chunkSize;
            }
            buf.push(0x00); // block terminator
        }

        // Trailer
        buf.push(0x3B);

        return new Uint8Array(buf);
    }

    _lzwEncode(indexedPixels, minCodeSize) {
        const clearCode = 1 << minCodeSize;
        const eoiCode = clearCode + 1;
        let codeSize = minCodeSize + 1;
        let nextCode = eoiCode + 1;
        const maxCodeSize = 12;

        // Initialize code table
        let codeTable = new Map();
        for (let i = 0; i < clearCode; i++) {
            codeTable.set(String(i), i);
        }

        const output = [];
        let bitBuffer = 0;
        let bitCount = 0;

        const writeBits = (code, size) => {
            bitBuffer |= (code << bitCount);
            bitCount += size;
            while (bitCount >= 8) {
                output.push(bitBuffer & 0xFF);
                bitBuffer >>= 8;
                bitCount -= 8;
            }
        };

        // Write clear code
        writeBits(clearCode, codeSize);

        let current = String(indexedPixels[0]);
        for (let i = 1; i < indexedPixels.length; i++) {
            const next = String(indexedPixels[i]);
            const combined = current + ',' + next;

            if (codeTable.has(combined)) {
                current = combined;
            } else {
                writeBits(codeTable.get(current), codeSize);

                if (nextCode < (1 << maxCodeSize)) {
                    codeTable.set(combined, nextCode);
                    nextCode++;
                    if (nextCode > (1 << codeSize) && codeSize < maxCodeSize) {
                        codeSize++;
                    }
                } else {
                    // Reset
                    writeBits(clearCode, codeSize);
                    codeTable = new Map();
                    for (let j = 0; j < clearCode; j++) {
                        codeTable.set(String(j), j);
                    }
                    nextCode = eoiCode + 1;
                    codeSize = minCodeSize + 1;
                }

                current = next;
            }
        }

        writeBits(codeTable.get(current), codeSize);
        writeBits(eoiCode, codeSize);

        if (bitCount > 0) {
            output.push(bitBuffer & 0xFF);
        }

        return output;
    }

    _writeStr(buf, str) {
        for (let i = 0; i < str.length; i++) {
            buf.push(str.charCodeAt(i));
        }
    }

    _writeU16(buf, val) {
        buf.push(val & 0xFF);
        buf.push((val >> 8) & 0xFF);
    }
}

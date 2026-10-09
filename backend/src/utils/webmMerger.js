// Pure Node.js WebM Merger
// Concatenates WebM video files recorded by Chrome MediaRecorder
// Parses EBML structure, shifts cluster timestamps, and updates total duration

function readVint(buf, offset) {
  if (offset >= buf.length) return null;
  const b0 = buf[offset];
  let len = 1;
  let mask = 0x80;
  while (len <= 8 && !(b0 & mask)) {
    len++;
    mask >>= 1;
  }
  if (len > 8) return null;
  let val = b0 & (mask - 1);
  for (let i = 1; i < len; i++) {
    val = (val * 256) + buf[offset + i];
  }
  return { length: len, value: val };
}

function writeVint(value, length) {
  const buf = Buffer.alloc(length);
  const mask = 0x80 >> (length - 1);
  let v = value;
  for (let i = length - 1; i > 0; i--) {
    buf[i] = v & 0xFF;
    v >>= 8;
  }
  buf[0] = (v & (mask - 1)) | mask;
  return buf;
}

function readElementId(buf, offset) {
  if (offset >= buf.length) return null;
  const b0 = buf[offset];
  let len = 1;
  let mask = 0x80;
  while (len <= 4 && !(b0 & mask)) {
    len++;
    mask >>= 1;
  }
  if (len > 4) return null;
  let id = 0;
  for (let i = 0; i < len; i++) {
    id = (id * 256) + buf[offset + i];
  }
  return { length: len, id };
}

function getWebmInfo(buf) {
  let offset = 0;
  let duration = 0;
  let durationOffset = -1;
  let durationLength = 0;
  let firstClusterOffset = -1;
  let segmentOffset = -1;
  let segmentHeaderLen = 0;

  while (offset < buf.length) {
    const elId = readElementId(buf, offset);
    if (!elId) break;
    const elSize = readVint(buf, offset + elId.length);
    if (!elSize) break;
    const dataStart = offset + elId.length + elSize.length;

    if (elId.id === 0x18538067) { // Segment
      segmentOffset = offset;
      segmentHeaderLen = elId.length + elSize.length;
      offset = dataStart;
      continue;
    }
    if (elId.id === 0x1549A966) { // Info
      let infoOff = dataStart;
      while (infoOff < dataStart + elSize.value) {
        const subId = readElementId(buf, infoOff);
        if (!subId) break;
        const subSize = readVint(buf, infoOff + subId.length);
        if (!subSize) break;
        const subData = infoOff + subId.length + subSize.length;
        if (subId.id === 0x4489) { // Duration
          durationOffset = subData;
          durationLength = subSize.value;
          duration = subSize.value === 4 ? buf.readFloatBE(subData) : buf.readDoubleBE(subData);
        }
        infoOff = subData + subSize.value;
      }
    }
    if (elId.id === 0x1F43B675) { // Cluster
      firstClusterOffset = offset;
      break;
    }
    offset = dataStart + elSize.value;
  }
  return { duration, durationOffset, durationLength, firstClusterOffset, segmentOffset, segmentHeaderLen };
}

/**
 * Merges two WebM buffers into one seamless WebM buffer.
 * Accurately shifts all cluster timestamps of buf2 by buf1's duration and combines them.
 */
function mergeWebmBuffers(buf1, buf2) {
  if (!buf1 || buf1.length === 0) return { buffer: buf2, durationSec: 0, durationMs: 0 };
  if (!buf2 || buf2.length === 0) return { buffer: buf1, durationSec: 0, durationMs: 0 };

  try {
    const info1 = getWebmInfo(buf1);
    const info2 = getWebmInfo(buf2);

    if (info1.firstClusterOffset === -1 || info2.firstClusterOffset === -1) {
      return { buffer: buf2, durationSec: Math.round((info2.duration || 0) / 1000), durationMs: info2.duration || 0 };
    }

    const durationShift = Math.max(1000, Math.round(info1.duration || 0));

    // Process all clusters in buf2 starting from firstClusterOffset
    let off = info2.firstClusterOffset;
    const parts = [];

    while (off < buf2.length - 4) {
      if (buf2[off] !== 0x1F || buf2[off + 1] !== 0x43 || buf2[off + 2] !== 0xB6 || buf2[off + 3] !== 0x75) {
        // Trailing elements (e.g. Cues, Void)
        break;
      }

      const sz = readVint(buf2, off + 4);
      if (!sz) break;
      const contentStart = off + 4 + sz.length;

      if (buf2[contentStart] === 0xE7) {
        const tSz = readVint(buf2, contentStart + 1);
        if (tSz) {
          let origTime = 0;
          for (let k = 0; k < tSz.value; k++) {
            origTime = (origTime * 256) + buf2[contentStart + 1 + tSz.length + k];
          }
          const newTime = origTime + durationShift;

          // Standard 4-byte timestamp element: 0xE7, 0x84, uint32BE
          const newTimeBuf = Buffer.alloc(6);
          newTimeBuf[0] = 0xE7;
          newTimeBuf[1] = 0x84;
          newTimeBuf.writeUInt32BE(newTime, 2);

          const oldTimeHeaderLen = 1 + tSz.length + tSz.value;
          const bodyStart = contentStart + oldTimeHeaderLen;
          const bodyLen = sz.value - oldTimeHeaderLen;
          const bodyBuf = buf2.subarray(bodyStart, bodyStart + bodyLen);

          const newClusterSize = newTimeBuf.length + bodyBuf.length;
          const clusterIdBuf = Buffer.from([0x1F, 0x43, 0xB6, 0x75]);
          const szBuf = writeVint(newClusterSize, sz.length);

          parts.push(clusterIdBuf, szBuf, newTimeBuf, bodyBuf);
        } else {
          // Fallback: keep original cluster if timestamp vint unparseable
          parts.push(buf2.subarray(off, contentStart + sz.value));
        }
      } else {
        parts.push(buf2.subarray(off, contentStart + sz.value));
      }

      off = contentStart + sz.value;
    }

    const newBuf2Clusters = Buffer.concat(parts);
    const merged = Buffer.concat([buf1, newBuf2Clusters]);
    const totalDurationMs = (info1.duration || 0) + (info2.duration || 0);

    // Update duration in Info element of buf1
    if (info1.durationOffset !== -1) {
      if (info1.durationLength === 8) {
        merged.writeDoubleBE(totalDurationMs, info1.durationOffset);
      } else if (info1.durationLength === 4) {
        merged.writeFloatBE(totalDurationMs, info1.durationOffset);
      }
    }

    // Update Segment size
    const segDataSize = merged.length - info1.segmentHeaderLen;
    const segSizeVintLen = info1.segmentHeaderLen - 4;
    if (segSizeVintLen === 4 && info1.segmentOffset !== -1) {
      const newSegSz = writeVint(segDataSize, 4);
      newSegSz.copy(merged, info1.segmentOffset + 4);
    }

    return {
      buffer: merged,
      durationMs: totalDurationMs,
      durationSec: Math.round(totalDurationMs / 1000),
    };
  } catch (err) {
    console.error("[mergeWebmBuffers] error:", err.message);
    return { buffer: buf2, durationSec: 0, durationMs: 0 };
  }
}

module.exports = {
  mergeWebmBuffers,
  getWebmInfo,
  readVint,
  readElementId,
};

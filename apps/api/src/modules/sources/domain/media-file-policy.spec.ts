import { describe, expect, it } from "vitest";

import {
  InvalidMediaDurationError,
  MediaDurationTooLongError,
  SourceFileTooLargeError,
  UnsupportedSourceFileError,
} from "./source.errors";
import {
  MAX_AUDIO_FILE_BYTES,
  MAX_IMAGE_FILE_BYTES,
  MAX_VIDEO_FILE_BYTES,
  hasValidMediaSignature,
  mediaTypeFor,
  sourceTypeForUpload,
  validateDurationSeconds,
  validateSourceFiles,
} from "./source-file-policy";

function png(): Buffer {
  return Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01, 0x02,
  ]);
}

function jpeg(): Buffer {
  return Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
}

function mp3(): Buffer {
  return Buffer.from([0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x01, 0x02]);
}

function mp4(): Buffer {
  return Buffer.from([
    0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d,
  ]);
}

describe("media file policy", () => {
  it("reconhece JPEG, PNG, MP3 e MP4 por MIME, extensão e magic bytes", () => {
    expect(mediaTypeFor("manual.png", "image/png", png())).toBe("image");
    expect(mediaTypeFor("foto.JPG", "image/jpeg", jpeg())).toBe("image");
    expect(mediaTypeFor("reuniao.mp3", "audio/mpeg", mp3())).toBe("audio");
    expect(mediaTypeFor("demo.mp4", "video/mp4", mp4())).toBe("video");
  });

  it("recusa assinatura incorreta mesmo com MIME e extensão válidos", () => {
    expect(
      mediaTypeFor("foto.png", "image/png", Buffer.from("not a png")),
    ).toBeNull();
    expect(
      mediaTypeFor("audio.mp3", "audio/mpeg", Buffer.from("ID4")),
    ).toBeNull();
    expect(
      mediaTypeFor("clip.mp4", "video/mp4", Buffer.from("ftyp")),
    ).toBeNull();
    expect(hasValidMediaSignature("video", mp3())).toBe(false);
  });

  it("recusa MIME inconsistente e formatos fora da lista", () => {
    expect(mediaTypeFor("foto.png", "image/gif", png())).toBeNull();
    expect(
      sourceTypeForUpload("clip.mov", "video/quicktime", mp4(), true),
    ).toBeNull();
    expect(
      sourceTypeForUpload("clip.mp4", "video/mp4", mp4(), false),
    ).toBeNull();
  });

  it("mantém o contrato antigo quando a flag de mídia está desligada", () => {
    expect(sourceTypeForUpload("notes.txt", "text/plain", png(), false)).toBe(
      "txt",
    );
    expect(() =>
      validateSourceFiles([
        { originalName: "foto.png", mimeType: "image/png", buffer: png() },
      ]),
    ).toThrow(UnsupportedSourceFileError);
  });

  it("aplica limites diferentes por tipo de mídia", () => {
    expect(() =>
      validateSourceFiles(
        [
          {
            originalName: "big.png",
            mimeType: "image/png",
            buffer: Buffer.concat([png(), Buffer.alloc(MAX_IMAGE_FILE_BYTES)]),
          },
        ],
        MAX_IMAGE_FILE_BYTES,
        5,
        { allowMedia: true },
      ),
    ).toThrow(SourceFileTooLargeError);

    expect(MAX_AUDIO_FILE_BYTES).toBeLessThan(MAX_VIDEO_FILE_BYTES);
  });

  it("aceita mídia válida e guarda a duração informada", () => {
    const [validated] = validateSourceFiles(
      [
        {
          originalName: "aula.mp4",
          mimeType: "video/mp4",
          buffer: mp4(),
          durationSeconds: 600,
        },
      ],
      MAX_VIDEO_FILE_BYTES,
      5,
      { allowMedia: true },
    );

    expect(validated).toMatchObject({
      type: "video",
      durationSeconds: 600,
      normalizedName: "aula.mp4",
    });
  });

  it("valida duração ausente, inválida e acima de 60 minutos", () => {
    expect(validateDurationSeconds(undefined)).toBeNull();
    expect(validateDurationSeconds("")).toBeNull();
    expect(validateDurationSeconds("125")).toBe(125);
    expect(() => validateDurationSeconds("abc")).toThrow(
      InvalidMediaDurationError,
    );
    expect(() => validateDurationSeconds(-1)).toThrow(
      InvalidMediaDurationError,
    );
    expect(() => validateDurationSeconds(3601)).toThrow(
      MediaDurationTooLongError,
    );
  });
});
